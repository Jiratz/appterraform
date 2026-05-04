"""
Tenancy Store — เก็บ OCI credentials หลาย tenancy ใน JSON file
"""
import json
import os
import uuid
from datetime import datetime
from typing import Optional

STORE_PATH = os.path.join(os.path.dirname(__file__), "data", "tenancies.json")


def _load() -> dict:
    os.makedirs(os.path.dirname(STORE_PATH), exist_ok=True)
    if not os.path.exists(STORE_PATH):
        return {}
    with open(STORE_PATH, "r") as f:
        return json.load(f)


def _save(data: dict):
    os.makedirs(os.path.dirname(STORE_PATH), exist_ok=True)
    with open(STORE_PATH, "w") as f:
        json.dump(data, f, indent=2)


def list_tenancies() -> list:
    data = _load()
    result = []
    for tid, t in data.items():
        result.append({
            "id": tid,
            "name": t["name"],
            "tenancy_ocid": t["tenancy_ocid"],
            "region": t["region"],
            "user_ocid": t["user_ocid"],
            "fingerprint": t["fingerprint"],
            "created_at": t.get("created_at", ""),
        })
    return sorted(result, key=lambda x: x["created_at"])


def get_tenancy(tid: str) -> Optional[dict]:
    data = _load()
    t = data.get(tid)
    if not t:
        return None
    return {**t, "id": tid}


def get_tenancy_creds(tid: str) -> Optional[dict]:
    """Return creds dict ที่ใช้กับ oci_client ได้เลย"""
    data = _load()
    t = data.get(tid)
    if not t:
        return None
    return {
        "tenancy_ocid": t["tenancy_ocid"],
        "user_ocid":    t["user_ocid"],
        "fingerprint":  t["fingerprint"],
        "region":       t["region"],
        "private_key":  t["private_key"],
    }


def create_tenancy(name: str, tenancy_ocid: str, user_ocid: str,
                   fingerprint: str, region: str, private_key: str) -> str:
    data = _load()
    tid = str(uuid.uuid4())[:8]
    data[tid] = {
        "name": name,
        "tenancy_ocid": tenancy_ocid,
        "user_ocid": user_ocid,
        "fingerprint": fingerprint,
        "region": region,
        "private_key": private_key,
        "created_at": datetime.utcnow().isoformat(),
    }
    _save(data)
    return tid


def update_tenancy(tid: str, **fields) -> bool:
    data = _load()
    if tid not in data:
        return False
    data[tid].update(fields)
    _save(data)
    return True


def delete_tenancy(tid: str) -> bool:
    data = _load()
    if tid not in data:
        return False
    del data[tid]
    _save(data)
    return True
