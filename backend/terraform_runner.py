import asyncio
import os
import json
import shutil
import subprocess
import tempfile
from jinja2 import Environment, FileSystemLoader

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "terraform_templates")
WORKSPACE_DIR = os.path.join(os.path.dirname(__file__), "terraform_workspace")

# สถานะ terraform ล่าสุด
_last_status = {"status": "idle", "output": "", "returncode": None}


def get_last_status() -> dict:
    return _last_status

def build_tfvars(creds: dict, vcn: dict, resources: dict) -> dict:
    """สร้าง tfvars dict จาก payload"""
    return {
        "tenancy_ocid":     creds.get("tenancy_ocid", ""),
        "user_ocid":        creds.get("user_ocid", ""),
        "fingerprint":      creds.get("fingerprint", ""),
        "private_key":      creds.get("private_key", ""),
        "region":           creds.get("region", "ap-pathumthani-1"),
        "compartment_ocid": vcn.get("compartment_id", creds.get("tenancy_ocid", "")),
        "vcn_id":           vcn.get("vcn_id", ""),
        "vcn_cidr":         vcn.get("cidr", "10.0.0.0/16"),
        "vcn_name":         vcn.get("name", "my-vcn"),
        "create_vcn":       vcn.get("type") == "new",
        "resources":        resources.get("resources", {}),
        "vm":               resources.get("vm", {}),
        "oke":              resources.get("oke", {}),
        "db":               resources.get("db", {}),
    }


def generate_terraform(payload: dict) -> str:
    """Generate terraform files และ return path ของ workspace"""
    session_id = tempfile.mktemp(prefix="tf_", dir=WORKSPACE_DIR)
    os.makedirs(session_id, exist_ok=True)

    creds   = payload.get("credentials", {})
    vcn     = payload.get("vcn", {})
    res     = payload.get("resources", {})
    tfvars  = build_tfvars(creds, vcn, res)

    env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))

    # สร้าง main.tf จาก template
    tmpl = env.get_template("main.tf.j2")
    with open(os.path.join(session_id, "main.tf"), "w") as f:
        f.write(tmpl.render(**tfvars))

    # เขียน terraform.tfvars.json
    safe_vars = {k: v for k, v in tfvars.items() if not isinstance(v, (dict, bool))}
    with open(os.path.join(session_id, "terraform.tfvars.json"), "w") as f:
        json.dump(safe_vars, f, indent=2)

    # เขียน private key ลงไฟล์ชั่วคราว
    key_path = os.path.join(session_id, "oci_key.pem")
    with open(key_path, "w") as f:
        f.write(creds.get("private_key", ""))
    os.chmod(key_path, 0o600)

    return session_id


def run_plan(payload: dict) -> str:
    """Run terraform plan และ return output"""
    try:
        ws = generate_terraform(payload)
        # terraform init
        subprocess.run(["terraform", "init", "-no-color"], cwd=ws, capture_output=True, timeout=120)
        # terraform plan
        result = subprocess.run(
            ["terraform", "plan", "-no-color", "-input=false"],
            cwd=ws,
            capture_output=True,
            text=True,
            timeout=120,
        )
        return result.stdout + result.stderr
    except Exception as e:
        return f"Error running plan: {str(e)}"


async def run_apply(payload: dict, log_callback):
    """Run terraform apply พร้อม streaming logs (non-blocking asyncio subprocess)"""
    try:
        await log_callback("🔧 กำลัง generate terraform files...")
        ws = generate_terraform(payload)

        await log_callback("📦 กำลัง initialize terraform (อาจใช้เวลา 1-2 นาที)...")
        init_proc = await asyncio.create_subprocess_exec(
            "terraform", "init", "-no-color",
            cwd=ws,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        async for raw in init_proc.stdout:
            line = raw.decode("utf-8", errors="replace").rstrip()
            if line.strip():
                await log_callback(line)
        await init_proc.wait()

        if init_proc.returncode != 0:
            await log_callback("❌ terraform init failed")
            return {"success": False, "outputs": {}}

        await log_callback("🚀 กำลัง apply terraform...")
        apply_proc = await asyncio.create_subprocess_exec(
            "terraform", "apply", "-auto-approve", "-no-color", "-input=false",
            cwd=ws,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        async for raw in apply_proc.stdout:
            line = raw.decode("utf-8", errors="replace").rstrip()
            if line:
                await log_callback(line)
        await apply_proc.wait()

        if apply_proc.returncode == 0:
            output_proc = await asyncio.create_subprocess_exec(
                "terraform", "output", "-json",
                cwd=ws,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            stdout, _ = await output_proc.communicate()
            try:
                raw = json.loads(stdout.decode())
                outputs = {k: v.get("value", "") for k, v in raw.items()}
            except Exception:
                outputs = {}
            return {"success": True, "outputs": outputs}
        else:
            return {"success": False, "outputs": {}}

    except Exception as e:
        await log_callback(f"❌ Exception: {str(e)}")
        return {"success": False, "outputs": {}}
