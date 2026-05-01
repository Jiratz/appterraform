# 🗺️ Server Map — 134.185.162.105 (app-vm)
> อัพเดท: April 19, 2026

---

## ⚠️ IMPORTANT: App ทั้งหมดบน Server

| Port | App | Process | Status | เจ้าของ |
|------|-----|---------|--------|---------|
| **1521** | Oracle Database | Podman container `oracle-database` | ✅ Up | งานอื่น — **ห้ามแตะ** |
| **8080** | Oracle Applied AI Label | Podman container `oracle-applied-ai-label` | ❌ Exited | งานอื่น — **ห้ามแตะ** |
| **3005** | MCPODB API | `node /home/opc/MCPODB/api-server.js` | ✅ Up | งานอื่น — **ห้ามแตะ** |
| **8888** | Python HTTP Server | `python3 -m http.server 8888` | ✅ Up | งานอื่น |
| **5901** | VNC Server | `Xvnc` | ✅ Up | ระบบ — **ห้ามแตะ** |
| **3000** | 🆕 OCI Terraform Frontend | `next-server` | ✅ Up | **appterraform** |
| **8000** | 🆕 OCI Terraform Backend | `uvicorn main:app` | ✅ Up | **appterraform** |

---

## 🚨 กฎที่ต้องจำ

### ❌ ห้ามทำ
```bash
pkill python          # จะ kill ทุก python process รวมถึงงานอื่น
pkill node            # จะ kill MCPODB ด้วย
pkill -f uvicorn      # อาจ kill process อื่น
podman stop --all     # จะหยุด Oracle DB
podman rm --all       # อันตรายมาก
```

### ✅ ทำได้ (เฉพาะ appterraform)
```bash
# Restart Backend
pkill -f "appterraform/backend.*uvicorn"
cd /home/opc/appterraform/backend && source venv/bin/activate
nohup uvicorn main:app --host 0.0.0.0 --port 8000 >> /tmp/backend.log 2>&1 &

# Restart Frontend
pkill -f "appterraform.*next"
cd /home/opc/appterraform/frontend
nohup node .next/standalone/server.js >> /tmp/frontend.log 2>&1 &

# ดู log
tail -f /tmp/backend.log
tail -f /tmp/frontend.log

# เช็คสถานะ
curl -s http://localhost:8000/
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

---

## 🌐 URL เข้าใช้งาน

| | URL |
|--|--|
| Frontend | http://134.185.162.105:3000 |
| Backend API | http://134.185.162.105:8000 |
| Swagger Docs | http://134.185.162.105:8000/docs |

---

## 📁 Path บน Server

```
/home/opc/appterraform/
├── backend/          ← FastAPI (port 8000)
│   ├── main.py
│   ├── oci_client.py
│   ├── terraform_runner.py
│   ├── venv/         ← Python virtualenv (Python 3.9)
│   └── terraform_templates/
├── frontend/         ← Next.js (port 3000)
└── deploy.sh         ← script สำหรับ sync + restart จาก Mac
```

---

## 🔄 Deploy ใหม่จาก Mac (ถ้าแก้ code)

```bash
# Sync + restart อัตโนมัติ
cd /Users/jiratz-mac/Desktop/appterraform
bash deploy.sh
```
