import json
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

from oci_client import validate_credentials, list_compartments, list_vcns, list_subnets
from terraform_runner import run_plan, run_apply

app = FastAPI(title="OCI Terraform Manager")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def parse_creds(x_credentials: str) -> dict:
    try:
        return json.loads(x_credentials)
    except Exception:
        return {}


# ─────────────── Credentials ───────────────
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
    return JSONResponse(status_code=400, content={"success": False, "message": "Cannot connect to OCI. Please check credentials."})


# ─────────────── Compartments ───────────────
@app.get("/api/compartments")
async def compartments(x_credentials: Optional[str] = Header(None)):
    creds = parse_creds(x_credentials or "{}")
    try:
        result = list_compartments(creds)
        return {"compartments": result}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# ─────────────── VCNs ───────────────
@app.get("/api/vcns")
async def vcns(compartment_id: str, x_credentials: Optional[str] = Header(None)):
    creds = parse_creds(x_credentials or "{}")
    try:
        result = list_vcns(creds, compartment_id)
        return {"vcns": result}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# ─────────────── Subnets ───────────────
@app.get("/api/subnets")
async def subnets(vcn_id: str, compartment_id: str, x_credentials: Optional[str] = Header(None)):
    creds = parse_creds(x_credentials or "{}")
    try:
        result = list_subnets(creds, vcn_id, compartment_id)
        return {"subnets": result}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# ─────────────── Terraform Plan ───────────────
class TerraformPayload(BaseModel):
    credentials: dict
    vcn: dict
    resources: dict


@app.post("/api/terraform/plan")
async def terraform_plan(payload: TerraformPayload):
    output = run_plan(payload.dict())
    return {"plan_output": output}


# ─────────────── WebSocket: Apply ───────────────
@app.websocket("/ws/terraform/logs")
async def ws_terraform(websocket: WebSocket):
    await websocket.accept()
    try:
        data = await websocket.receive_text()
        msg = json.loads(data)

        if msg.get("action") != "apply":
            await websocket.send_text(json.dumps({"type": "error", "message": "Unknown action"}))
            return

        payload = msg.get("payload", {})

        async def send_log(line: str):
            await websocket.send_text(json.dumps({"type": "log", "message": line}))

        result = await run_apply(payload, send_log)
        await websocket.send_text(json.dumps({
            "type": "done",
            "success": result["success"],
            "outputs": result["outputs"],
        }))
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": str(e)}))
        except Exception:
            pass


# ─────────────── Health ───────────────
@app.get("/")
async def root():
    return {"message": "OCI Terraform Manager API is running 🚀"}


@app.get("/health")
async def health():
    return {"status": "ok"}


# ─────────────── Terraform Status ───────────────
@app.get("/api/terraform/status")
async def terraform_status():
    """ดูสถานะ terraform process ล่าสุด"""
    try:
        from terraform_runner import get_last_status
        return get_last_status()
    except Exception:
        return {"status": "idle", "output": ""}
