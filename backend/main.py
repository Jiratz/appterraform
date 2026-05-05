import json
import uuid
import asyncio
import os
import secrets
import oci
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List

from oci_client import validate_credentials, list_compartments, list_vcns, list_subnets
from terraform_runner import run_plan, run_apply
from tenancy_store import (
    list_tenancies, get_tenancy, get_tenancy_creds,
    create_tenancy, update_tenancy, delete_tenancy,
)
from landing_zone import (
    build_landing_zone_workspace, run_lz_plan, run_lz_apply, run_lz_destroy,
    get_job, list_jobs, _jobs, WORKSPACE_DIR,
)

app = FastAPI(title="OCI Terraform Manager — Multi-Tenancy")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Internal API Key (protect sensitive endpoints) ────────────────────────────
_API_KEY = os.environ.get("OCI_MANAGER_API_KEY", "")


def _require_api_key(request: Request):
    """ตรวจ X-API-Key header — ถ้าไม่ได้ set env ก็ skip (backward compat)"""
    if not _API_KEY:
        return  # ยังไม่ได้ configure key → allow all (เพื่อ backward compat)
    key = request.headers.get("x-api-key", "")
    if not secrets.compare_digest(key, _API_KEY):
        raise HTTPException(401, "Unauthorized")


def parse_creds(x_credentials: str) -> dict:
    try:
        return json.loads(x_credentials)
    except Exception:
        return {}


def resolve_creds(tenancy_id: Optional[str], x_credentials: Optional[str]) -> dict:
    if tenancy_id:
        creds = get_tenancy_creds(tenancy_id)
        if creds:
            return creds
    return parse_creds(x_credentials or "{}")


# ══════════════════════════════════════════════════════════
#  TENANCY MANAGEMENT
# ══════════════════════════════════════════════════════════

class TenancyCreate(BaseModel):
    name: str
    tenancy_ocid: str
    user_ocid: str
    fingerprint: str
    region: str
    private_key: str

class TenancyUpdate(BaseModel):
    name: Optional[str] = None
    region: Optional[str] = None
    fingerprint: Optional[str] = None
    private_key: Optional[str] = None


@app.get("/api/tenancies")
async def api_list_tenancies():
    return {"tenancies": list_tenancies()}


@app.get("/api/tenancies/{tid}")
async def api_get_tenancy(tid: str):
    t = get_tenancy(tid)
    if not t:
        raise HTTPException(404, "Tenancy not found")
    t.pop("private_key", None)
    return t


@app.post("/api/tenancies")
async def api_create_tenancy(payload: TenancyCreate):
    creds = payload.dict()
    ok = validate_credentials(creds)
    if not ok:
        raise HTTPException(400, "Cannot connect to OCI. Please check credentials.")
    tid = create_tenancy(**creds)
    return {"id": tid, "message": "Tenancy added successfully"}


@app.patch("/api/tenancies/{tid}")
async def api_update_tenancy(tid: str, payload: TenancyUpdate):
    fields = {k: v for k, v in payload.dict().items() if v is not None}
    ok = update_tenancy(tid, **fields)
    if not ok:
        raise HTTPException(404, "Tenancy not found")
    return {"message": "Updated"}


@app.delete("/api/tenancies/{tid}")
async def api_delete_tenancy(tid: str):
    ok = delete_tenancy(tid)
    if not ok:
        raise HTTPException(404, "Tenancy not found")
    return {"message": "Deleted"}


@app.post("/api/tenancies/{tid}/validate")
async def api_validate_tenancy(tid: str):
    creds = get_tenancy_creds(tid)
    if not creds:
        raise HTTPException(404, "Tenancy not found")
    ok = validate_credentials(creds)
    return {"success": ok}


# ══════════════════════════════════════════════════════════
#  LANDING ZONE
# ══════════════════════════════════════════════════════════

class LZConfig(BaseModel):
    tenancy_id: str
    parent_compartment_ocid: Optional[str] = None
    compartments: Optional[dict] = {}
    iam: Optional[dict] = {}
    network: Optional[dict] = {}
    security: Optional[dict] = {}
    bastion: Optional[dict] = {}
    storage: Optional[dict] = {}
    vault: Optional[dict] = {}


@app.post("/api/landing-zone/plan")
async def lz_plan(payload: LZConfig):
    creds = get_tenancy_creds(payload.tenancy_id)
    if not creds:
        raise HTTPException(404, "Tenancy not found")
    cfg = payload.dict()
    cfg.setdefault("parent_compartment_ocid", creds["tenancy_ocid"])
    workspace = build_landing_zone_workspace(creds, cfg, payload.tenancy_id)
    output = await run_lz_plan(workspace)
    return {"plan_output": output}


@app.post("/api/landing-zone/apply")
async def lz_apply(payload: LZConfig):
    creds = get_tenancy_creds(payload.tenancy_id)
    if not creds:
        raise HTTPException(404, "Tenancy not found")
    cfg = payload.dict()
    cfg.setdefault("parent_compartment_ocid", creds["tenancy_ocid"])
    workspace = build_landing_zone_workspace(creds, cfg, payload.tenancy_id)
    job_id = str(uuid.uuid4())[:8]
    _jobs[job_id] = {"tenancy_id": payload.tenancy_id, "status": "pending", "logs": [], "workspace": workspace}

    async def _run():
        async def send_log(msg): _jobs[job_id].setdefault("logs", []).append(msg)
        await run_lz_apply(workspace, job_id, send_log)
    asyncio.create_task(_run())
    return {"job_id": job_id, "message": "Apply started"}


@app.post("/api/landing-zone/destroy/{tenancy_id}")
async def lz_destroy(tenancy_id: str):
    workspace = os.path.join(WORKSPACE_DIR, tenancy_id)
    if not os.path.exists(workspace):
        raise HTTPException(404, "No workspace found for this tenancy")
    job_id = str(uuid.uuid4())[:8]
    _jobs[job_id] = {"tenancy_id": tenancy_id, "status": "pending", "logs": [], "workspace": workspace}

    async def _run():
        async def send_log(msg): _jobs[job_id].setdefault("logs", []).append(msg)
        await run_lz_destroy(workspace, job_id, send_log)
    asyncio.create_task(_run())
    return {"job_id": job_id, "message": "Destroy started"}


@app.get("/api/landing-zone/jobs/{job_id}")
async def lz_job_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@app.get("/api/landing-zone/jobs")
async def lz_list_jobs(tenancy_id: str):
    return {"jobs": list_jobs(tenancy_id)}


@app.websocket("/ws/landing-zone/logs/{job_id}")
async def ws_lz_logs(websocket: WebSocket, job_id: str):
    await websocket.accept()
    sent = 0
    try:
        while True:
            job = get_job(job_id)
            if not job:
                await websocket.send_text(json.dumps({"type": "error", "message": "Job not found"}))
                break
            logs = job.get("logs", [])
            for line in logs[sent:]:
                await websocket.send_text(json.dumps({"type": "log", "message": line}))
            sent = len(logs)
            if job["status"] in ("success", "failed", "destroyed"):
                await websocket.send_text(json.dumps({"type": "done", "status": job["status"]}))
                break
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        pass


# ══════════════════════════════════════════════════════════
#  EXISTING APIs
# ══════════════════════════════════════════════════════════

class CredentialsPayload(BaseModel):
    tenancy_ocid: str
    user_ocid: str
    fingerprint: str
    region: str
    private_key: str


@app.post("/api/credentials/validate")
async def validate(payload: CredentialsPayload):
    creds = payload.dict()
    ok = validate_credentials(creds)
    if ok:
        return {"success": True, "message": "Connected to OCI successfully"}
    return JSONResponse(status_code=400, content={"success": False, "message": "Cannot connect to OCI."})


@app.get("/api/compartments")
async def compartments(tenancy_id: Optional[str] = None, x_credentials: Optional[str] = Header(None)):
    creds = resolve_creds(tenancy_id, x_credentials)
    try:
        return {"compartments": list_compartments(creds)}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/vcns")
async def vcns(compartment_id: str, tenancy_id: Optional[str] = None, x_credentials: Optional[str] = Header(None)):
    creds = resolve_creds(tenancy_id, x_credentials)
    try:
        return {"vcns": list_vcns(creds, compartment_id)}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/subnets")
async def subnets(vcn_id: str, compartment_id: str, tenancy_id: Optional[str] = None, x_credentials: Optional[str] = Header(None)):
    creds = resolve_creds(tenancy_id, x_credentials)
    try:
        return {"subnets": list_subnets(creds, vcn_id, compartment_id)}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


class TerraformPayload(BaseModel):
    credentials: dict
    vcn: dict
    resources: dict


@app.post("/api/terraform/plan")
async def terraform_plan(payload: TerraformPayload):
    return {"plan_output": run_plan(payload.dict())}


@app.websocket("/ws/terraform/logs")
async def ws_terraform(websocket: WebSocket):
    await websocket.accept()
    try:
        data = await websocket.receive_text()
        msg = json.loads(data)
        if msg.get("action") != "apply":
            await websocket.send_text(json.dumps({"type": "error", "message": "Unknown action"}))
            return
        async def send_log(line): await websocket.send_text(json.dumps({"type": "log", "message": line}))
        result = await run_apply(msg.get("payload", {}), send_log)
        await websocket.send_text(json.dumps({"type": "done", "success": result["success"], "outputs": result["outputs"]}))
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try: await websocket.send_text(json.dumps({"type": "error", "message": str(e)}))
        except Exception: pass


class VMActionPayload(BaseModel):
    instance_id: str
    action: str
    tenancy_id: Optional[str] = None


@app.post("/api/vms/action")
async def vm_action(payload: VMActionPayload):
    try:
        if payload.tenancy_id:
            creds = get_tenancy_creds(payload.tenancy_id)
        else:
            cfg = oci.config.from_file("~/.oci/config")
            creds = {"tenancy_ocid": cfg["tenancy"], "user_ocid": cfg["user"],
                     "fingerprint": cfg["fingerprint"], "region": cfg["region"],
                     "private_key": open(cfg["key_file"]).read()}
        from oci_client import get_oci_config
        compute = oci.core.ComputeClient(get_oci_config(creds))
        compute.instance_action(payload.instance_id, payload.action.upper())
        return {"success": True, "message": f"VM {payload.action} initiated"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


import oci as _oci_mod
OCI_NAMESPACE = "axur167sv6py"
OCI_BUCKET = "upload-bucket"
OCI_ENDPOINT = "https://objectstorage.ap-pathumthani-1.thaiaiscloud.com"


def _storage_client():
    cfg = _oci_mod.config.from_file("~/.oci/config")
    return _oci_mod.object_storage.ObjectStorageClient(cfg, service_endpoint=OCI_ENDPOINT)


@app.get("/api/upload/files")
async def list_files():
    try:
        resp = _storage_client().list_objects(OCI_NAMESPACE, OCI_BUCKET, fields="name,size,timeCreated")
        return {"files": [{"name": o.name, "size": o.size, "time_created": o.time_created.isoformat() if o.time_created else None}
                          for o in (resp.data.objects or [])]}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


from fastapi import UploadFile, File


@app.post("/api/upload/files")
async def upload_file(file: UploadFile = File(...)):
    try:
        _storage_client().put_object(OCI_NAMESPACE, OCI_BUCKET, file.filename, await file.read())
        return {"success": True, "filename": file.filename}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/upload/files/{filename}/url")
async def get_download_url(filename: str):
    try:
        from datetime import datetime, timedelta
        par = _storage_client().create_preauthenticated_request(
            OCI_NAMESPACE, OCI_BUCKET,
            _oci_mod.object_storage.models.CreatePreauthenticatedRequestDetails(
                name=f"dl-{filename}", object_name=filename,
                access_type="ObjectRead", time_expires=datetime.utcnow() + timedelta(hours=1),
            ))
        return {"url": OCI_ENDPOINT + par.data.access_uri}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.delete("/api/upload/files/{filename}")
async def delete_file(filename: str):
    try:
        _storage_client().delete_object(OCI_NAMESPACE, OCI_BUCKET, filename)
        return {"success": True}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/")
async def root():
    return {"message": "OCI Terraform Manager API — Multi-Tenancy Landing Zone 🚀"}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/terraform/status")
async def terraform_status():
    try:
        from terraform_runner import get_last_status
        return get_last_status()
    except Exception:
        return {"status": "idle", "output": ""}


# ══════════════════════════════════════════════════════════
#  DASHBOARD
# ══════════════════════════════════════════════════════════

@app.get("/api/dashboard")
async def dashboard():
    """Summary stats for the dashboard page."""
    tenancies = list_tenancies()
    tenancy_count = len(tenancies)

    # Files count
    files_count = 0
    try:
        resp = _storage_client().list_objects(OCI_NAMESPACE, OCI_BUCKET)
        files_count = len(resp.data.objects or [])
    except Exception:
        pass

    # Landing zone workspaces with terraform.tfstate (= deployed)
    lz_deployed = 0
    lz_total = 0
    try:
        for d in os.listdir(WORKSPACE_DIR):
            ws = os.path.join(WORKSPACE_DIR, d)
            if os.path.isdir(ws):
                lz_total += 1
                if os.path.exists(os.path.join(ws, "terraform.tfstate")):
                    lz_deployed += 1
    except Exception:
        pass

    # Active jobs
    active_jobs = [j for j in _jobs.values() if j.get("status") in ("pending", "running")]

    # Per-tenancy LZ status
    tenancy_lz = {}
    try:
        for d in os.listdir(WORKSPACE_DIR):
            ws = os.path.join(WORKSPACE_DIR, d)
            if os.path.isdir(ws) and os.path.exists(os.path.join(ws, "terraform.tfstate")):
                tenancy_lz[d] = "deployed"
    except Exception:
        pass

    tenancy_summary = []
    for t in tenancies:
        tid = t["id"]
        tenancy_summary.append({
            "id": tid,
            "name": t.get("name", tid),
            "region": t.get("region", ""),
            "lz_status": tenancy_lz.get(tid, "none"),
        })

    return {
        "tenancy_count": tenancy_count,
        "files_count": files_count,
        "lz_deployed": lz_deployed,
        "lz_total": lz_total,
        "active_jobs": len(active_jobs),
        "tenancies": tenancy_summary,
    }
