"""
Landing Zone Builder — สร้าง Terraform สำหรับ OCI Landing Zone
รองรับ modules: compartments, iam, network, security, bastion, storage, vault
"""
import os
import json
import uuid
import asyncio
import subprocess
import tempfile
from typing import Callable, Optional

WORKSPACE_DIR = os.path.join(os.path.dirname(__file__), "lz_workspaces")
TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "lz_templates")

os.makedirs(WORKSPACE_DIR, exist_ok=True)

# ─── State tracking per tenancy ─────────────────────────────────────────────

_jobs: dict = {}  # job_id → {status, logs, tenancy_id}


def get_job(job_id: str) -> Optional[dict]:
    return _jobs.get(job_id)


def list_jobs(tenancy_id: str) -> list:
    return [
        {"job_id": jid, **info}
        for jid, info in _jobs.items()
        if info.get("tenancy_id") == tenancy_id
    ]


# ─── Terraform file generators ───────────────────────────────────────────────

def _provider_tf(creds: dict) -> str:
    return f'''terraform {{
  required_providers {{
    oci = {{
      source  = "oracle/oci"
      version = ">= 5.0.0"
    }}
  }}
}}

provider "oci" {{
  tenancy_ocid     = "{creds['tenancy_ocid']}"
  user_ocid        = "{creds['user_ocid']}"
  fingerprint      = "{creds['fingerprint']}"
  region           = "{creds['region']}"
  private_key      = <<-EOT
{creds['private_key'].strip()}
  EOT
}}
'''


def _compartments_tf(cfg: dict, parent_ocid: str) -> str:
    blocks = []
    for c in cfg.get("compartments", []):
        name = c["name"]
        desc = c.get("description", f"{name} compartment")
        safe = name.lower().replace("-", "_").replace(" ", "_")
        blocks.append(f'''
resource "oci_identity_compartment" "{safe}" {{
  compartment_id = "{parent_ocid}"
  name           = "{name}"
  description    = "{desc}"
  enable_delete  = true
}}
output "{safe}_id" {{
  value = oci_identity_compartment.{safe}.id
}}
''')
    return "\n".join(blocks)


def _iam_tf(cfg: dict, tenancy_ocid: str) -> str:
    blocks = []
    for g in cfg.get("groups", []):
        name = g["name"]
        safe = name.lower().replace("-", "_").replace(" ", "_")
        blocks.append(f'''
resource "oci_identity_group" "{safe}" {{
  compartment_id = "{tenancy_ocid}"
  name           = "{name}"
  description    = "{g.get('description', name + ' group')}"
}}
''')
    for p in cfg.get("policies", []):
        pname = p["name"]
        psafe = pname.lower().replace("-", "_").replace(" ", "_")
        stmts = "\n".join([f'    "{s}",' for s in p.get("statements", [])])
        comp = p.get("compartment_id", tenancy_ocid)
        blocks.append(f'''
resource "oci_identity_policy" "{psafe}" {{
  compartment_id = "{comp}"
  name           = "{pname}"
  description    = "{p.get('description', pname)}"
  statements     = [
{stmts}
  ]
}}
''')
    return "\n".join(blocks)


def _network_tf(cfg: dict, compartment_ocid: str) -> str:
    blocks = []
    for vcn in cfg.get("vcns", []):
        vname = vcn["name"]
        vsafe = vname.lower().replace("-", "_").replace(" ", "_")
        cidr = vcn.get("cidr", "10.0.0.0/16")
        blocks.append(f'''
resource "oci_core_vcn" "{vsafe}" {{
  compartment_id = "{compartment_ocid}"
  display_name   = "{vname}"
  cidr_blocks    = ["{cidr}"]
  dns_label      = "{vsafe}"
}}

resource "oci_core_internet_gateway" "{vsafe}_igw" {{
  compartment_id = "{compartment_ocid}"
  vcn_id         = oci_core_vcn.{vsafe}.id
  display_name   = "{vname}-igw"
  enabled        = true
}}

resource "oci_core_nat_gateway" "{vsafe}_nat" {{
  compartment_id = "{compartment_ocid}"
  vcn_id         = oci_core_vcn.{vsafe}.id
  display_name   = "{vname}-nat"
}}

resource "oci_core_service_gateway" "{vsafe}_sgw" {{
  compartment_id = "{compartment_ocid}"
  vcn_id         = oci_core_vcn.{vsafe}.id
  display_name   = "{vname}-sgw"
  services {{
    service_id = data.oci_core_services.all.services[0].id
  }}
}}
''')
        for sn in vcn.get("subnets", []):
            snname = sn["name"]
            snsafe = snname.lower().replace("-", "_").replace(" ", "_")
            sn_cidr = sn.get("cidr", "10.0.1.0/24")
            public = str(sn.get("public", False)).lower()
            blocks.append(f'''
resource "oci_core_subnet" "{vsafe}_{snsafe}" {{
  compartment_id    = "{compartment_ocid}"
  vcn_id            = oci_core_vcn.{vsafe}.id
  display_name      = "{snname}"
  cidr_block        = "{sn_cidr}"
  prohibit_public_ip_on_vnic = {str(not sn.get("public", False)).lower()}
  dns_label         = "{snsafe}"
}}
''')
    if cfg.get("vcns"):
        blocks.insert(0, '''
data "oci_core_services" "all" {
  filter {
    name   = "name"
    values = ["All .* Services In Oracle Services Network"]
    regex  = true
  }
}
''')
    return "\n".join(blocks)


def _security_tf(cfg: dict, compartment_ocid: str, tenancy_ocid: str) -> str:
    blocks = []
    if cfg.get("cloud_guard"):
        blocks.append(f'''
resource "oci_cloud_guard_cloud_guard_configuration" "lz_cg" {{
  compartment_id   = "{tenancy_ocid}"
  reporting_region = var.region
  status           = "ENABLED"
}}
''')
    if cfg.get("audit_log"):
        blocks.append(f'''
resource "oci_ons_notification_topic" "lz_audit_topic" {{
  compartment_id = "{compartment_ocid}"
  name           = "lz-audit-topic"
  description    = "Landing Zone audit notifications"
}}
''')
    return "\n".join(blocks)


def _bastion_tf(cfg: dict, compartment_ocid: str, subnet_ocid_ref: str) -> str:
    if not cfg.get("enabled"):
        return ""
    return f'''
resource "oci_bastion_bastion" "lz_bastion" {{
  compartment_id       = "{compartment_ocid}"
  bastion_type         = "STANDARD"
  target_subnet_id     = {subnet_ocid_ref}
  name                 = "lz-bastion"
  client_cidr_block_allow_list = {json.dumps(cfg.get("allowed_cidrs", ["0.0.0.0/0"]))}
}}
'''


def _storage_tf(cfg: dict, compartment_ocid: str, tenancy_namespace: str = "") -> str:
    blocks = []
    for b in cfg.get("buckets", []):
        bname = b["name"]
        bsafe = bname.lower().replace("-", "_")
        access = b.get("access", "NoPublicAccess")
        blocks.append(f'''
resource "oci_objectstorage_bucket" "{bsafe}" {{
  compartment_id = "{compartment_ocid}"
  name           = "{bname}"
  namespace      = data.oci_objectstorage_namespace.ns.namespace
  access_type    = "{access}"
  versioning     = "{b.get('versioning', 'Disabled')}"
}}
''')
    if cfg.get("buckets"):
        blocks.insert(0, '''
data "oci_objectstorage_namespace" "ns" {
  compartment_id = var.tenancy_ocid
}
''')
    return "\n".join(blocks)


def _vault_tf(cfg: dict, compartment_ocid: str) -> str:
    if not cfg.get("enabled"):
        return ""
    return f'''
resource "oci_kms_vault" "lz_vault" {{
  compartment_id = "{compartment_ocid}"
  display_name   = "lz-vault"
  vault_type     = "DEFAULT"
}}

resource "oci_kms_key" "lz_master_key" {{
  compartment_id      = "{compartment_ocid}"
  display_name        = "lz-master-key"
  management_endpoint = oci_kms_vault.lz_vault.management_endpoint
  key_shape {{
    algorithm = "AES"
    length    = 32
  }}
}}
'''


# ─── Build workspace ─────────────────────────────────────────────────────────

def build_landing_zone_workspace(creds: dict, config: dict, tenancy_id: str) -> str:
    """
    config keys:
      parent_compartment_ocid, compartments, iam, network,
      security, bastion, storage, vault
    Returns workspace_path
    """
    workspace_path = os.path.join(WORKSPACE_DIR, tenancy_id)
    os.makedirs(workspace_path, exist_ok=True)

    parent = config.get("parent_compartment_ocid", creds["tenancy_ocid"])
    tenancy_ocid = creds["tenancy_ocid"]

    files = {
        "provider.tf": _provider_tf(creds),
        "compartments.tf": _compartments_tf(config.get("compartments", {}), parent),
        "iam.tf": _iam_tf(config.get("iam", {}), tenancy_ocid),
        "network.tf": _network_tf(config.get("network", {}), parent),
        "security.tf": _security_tf(config.get("security", {}), parent, tenancy_ocid),
        "bastion.tf": _bastion_tf(config.get("bastion", {}), parent, '""'),
        "storage.tf": _storage_tf(config.get("storage", {}), parent),
        "vault.tf": _vault_tf(config.get("vault", {}), parent),
        "variables.tf": f'''
variable "region" {{
  default = "{creds['region']}"
}}
variable "tenancy_ocid" {{
  default = "{tenancy_ocid}"
}}
''',
    }

    for fname, content in files.items():
        with open(os.path.join(workspace_path, fname), "w") as f:
            f.write(content)

    return workspace_path


# ─── Plan / Apply ────────────────────────────────────────────────────────────

async def run_lz_plan(workspace_path: str) -> str:
    """terraform init + plan — return output"""
    env = {**os.environ, "TF_IN_AUTOMATION": "1", "TF_CLI_ARGS": "-no-color"}

    init = await asyncio.create_subprocess_exec(
        "terraform", "init", "-no-color",
        cwd=workspace_path, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
        env=env,
    )
    init_out, _ = await init.communicate()

    plan = await asyncio.create_subprocess_exec(
        "terraform", "plan", "-no-color",
        cwd=workspace_path, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
        env=env,
    )
    plan_out, _ = await plan.communicate()
    return init_out.decode() + "\n" + plan_out.decode()


async def run_lz_apply(
    workspace_path: str,
    job_id: str,
    send_log: Callable,
):
    """terraform apply -auto-approve พร้อม streaming logs"""
    env = {**os.environ, "TF_IN_AUTOMATION": "1", "TF_CLI_ARGS": "-no-color"}

    _jobs[job_id]["status"] = "running"

    # init
    proc_init = await asyncio.create_subprocess_exec(
        "terraform", "init", "-no-color",
        cwd=workspace_path, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
        env=env,
    )
    async for line in proc_init.stdout:
        msg = line.decode().rstrip()
        _jobs[job_id].setdefault("logs", []).append(msg)
        await send_log(msg)
    await proc_init.wait()

    # apply
    proc = await asyncio.create_subprocess_exec(
        "terraform", "apply", "-auto-approve", "-no-color",
        cwd=workspace_path, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
        env=env,
    )
    async for line in proc.stdout:
        msg = line.decode().rstrip()
        _jobs[job_id].setdefault("logs", []).append(msg)
        await send_log(msg)

    await proc.wait()
    success = proc.returncode == 0
    _jobs[job_id]["status"] = "success" if success else "failed"
    return success


async def run_lz_destroy(workspace_path: str, job_id: str, send_log: Callable):
    env = {**os.environ, "TF_IN_AUTOMATION": "1", "TF_CLI_ARGS": "-no-color"}
    _jobs[job_id]["status"] = "destroying"

    proc = await asyncio.create_subprocess_exec(
        "terraform", "destroy", "-auto-approve", "-no-color",
        cwd=workspace_path, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
        env=env,
    )
    async for line in proc.stdout:
        msg = line.decode().rstrip()
        _jobs[job_id].setdefault("logs", []).append(msg)
        await send_log(msg)
    await proc.wait()
    success = proc.returncode == 0
    _jobs[job_id]["status"] = "destroyed" if success else "failed"
    return success
