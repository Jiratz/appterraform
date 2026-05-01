# 🚀 OCI Terraform Manager — CONTEXT & RESUME GUIDE
**Last Updated: April 19, 2026**

---

## ✅ สถานะปัจจุบัน: **DEPLOYED & RUNNING บน VM**

| Component | Local (Mac) | VM (134.185.162.105) |
|-----------|-------------|----------------------|
| Frontend (Next.js) | http://localhost:3000 | ✅ http://134.185.162.105:3000 |
| Backend (FastAPI) | http://localhost:8000 | ✅ http://134.185.162.105:8000 |
| API Docs (Swagger) | http://localhost:8000/docs | ✅ http://134.185.162.105:8000/docs |

---

## 📖 สรุปสิ่งที่ทำทั้งหมด (ตั้งแต่ต้น)

### Phase 1 — สร้าง OCI Infrastructure (`~/Desktop/claude/`)
- เขียน Terraform สร้าง VCN, OKE Cluster, Bastion, VM1
- Bastion: `134.185.173.50` (ssh bastion-pad)
- VM1: `134.185.162.230` (ssh vm1-pad)
- Region: `ap-pathumthani-1`

### Phase 2 — สร้าง Web App (`~/Desktop/appterraform/`)
**Frontend (Next.js 15)**
- `app/page.tsx` — Home page + hero section
- `app/credentials/page.tsx` — Step 1: ใส่ OCI credentials
- `app/vcn/page.tsx` — Step 2: เลือก/สร้าง VCN
- `app/resources/page.tsx` — Step 3: เลือก VM/OKE/DB/Bastion
- `app/deploy/page.tsx` — Step 4: Terraform plan/apply + realtime logs
- `lib/config.ts` — export `API_URL`, `WS_URL` จาก env var (ไม่ hardcode)

**Backend (FastAPI + oci-python-sdk)**
- `main.py` — FastAPI routes ทั้งหมด + WebSocket
- `oci_client.py` — validate credentials, list compartments/VCNs/subnets
- `terraform_runner.py` — generate .tf files, run plan/apply, stream logs
- `terraform_templates/main.tf.j2` — Jinja2 template สร้าง VM/OKE/ADB

### Phase 3 — Deploy ไป VM `134.185.162.105`
1. สร้าง `frontend/Dockerfile` (multi-stage, Next.js standalone)
2. เพิ่ม `output: "standalone"` ใน `next.config.ts`
3. แก้ `docker-compose.yml` ให้ส่ง `NEXT_PUBLIC_API_URL` build arg
4. สร้าง `deploy.sh` — rsync + remote build script
5. Rsync โค้ดไปที่ `/home/opc/appterraform/` บน VM
6. ติดตั้ง Node.js, Python 3.9 บน VM
7. Build frontend (`npm run build`) และ backend (pip install)
8. Start services ด้วย `nohup`
9. Copy static files: `.next/static` → `.next/standalone/.next/static` (แก้ปัญหา CSS ไม่โหลด)
10. เปิด firewall: `firewall-cmd --add-port=3000/tcp` และ `8000/tcp`
11. เปิด OCI Security List: เพิ่ม Ingress rule port 3000 และ 8000

---

## 🗂 โครงสร้างโปรเจค

```
~/Desktop/appterraform/
├── CONTEXT.md          ← ไฟล์นี้
├── DEPLOY.md
├── docker-compose.yml
├── frontend/           ← Next.js 15 + TypeScript + Tailwind
│   └── app/
│       ├── page.tsx          (Home - hero section)
│       ├── credentials/      (Step 1 - OCI creds form)
│       ├── vcn/              (Step 2 - VCN select/create)
│       ├── resources/        (Step 3 - VM/OKE/DB/Bastion)
│       └── deploy/           (Step 4 - Terraform plan/apply)
└── backend/            ← FastAPI + oci-python-sdk
    ├── main.py               (FastAPI routes)
    ├── oci_client.py         (OCI SDK: validate, list)
    ├── terraform_runner.py   (plan, apply, streaming)
    ├── requirements.txt
    ├── venv/                 (Python virtualenv — deps installed)
    └── terraform_templates/
        ├── main.tf.j2        (main template — VM/OKE/ADB)
        ├── provider.tf.j2
        ├── vcn.tf.j2
        ├── instance.tf.j2
        ├── oke.tf.j2
        ├── database.tf.j2
        ├── bastion.tf.j2
        └── loadbalancer.tf.j2
```

---

## 🔌 API Endpoints (Backend port 8000)

| Method | Path | ทำอะไร |
|--------|------|--------|
| POST | `/api/credentials/validate` | ตรวจสอบ OCI credentials |
| GET | `/api/compartments` | list compartments (header: X-Credentials) |
| GET | `/api/vcns?compartment_id=xxx` | list VCNs |
| GET | `/api/subnets?vcn_id=xxx&compartment_id=xxx` | list Subnets |
| POST | `/api/terraform/plan` | run terraform plan |
| POST | `/api/terraform/apply` | run terraform apply |
| WS | `/ws/terraform/logs` | streaming apply logs |
| GET | `/health` | health check |

Swagger UI: http://localhost:8000/docs

---

## ▶️ วิธี Start Services

### Backend
```bash
cd ~/Desktop/appterraform/backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd ~/Desktop/appterraform/frontend
npm run dev
# → http://localhost:3000
```

### Docker (ทั้งคู่พร้อมกัน)
```bash
cd ~/Desktop/appterraform
docker-compose up --build
```

---

## 🖥 User Flow (4 Steps)

1. **`/credentials`** → ใส่ tenancy_ocid, user_ocid, fingerprint, region, private_key → validate กับ OCI API → เก็บใน sessionStorage
2. **`/vcn`** → เลือก compartment → เลือก VCN เดิม หรือ สร้างใหม่ → เก็บ config ใน sessionStorage
3. **`/resources`** → toggle เลือก VM / OKE / Database / Bastion พร้อม config แต่ละตัว → เก็บ config ใน sessionStorage
4. **`/deploy`** → show terraform plan → กด Apply → WebSocket streaming logs → แสดง outputs

---

## 🌐 OCI Infrastructure ที่มีอยู่แล้ว (`~/Desktop/claude/`)

| Resource | Detail |
|----------|--------|
| Region | ap-pathumthani-1 |
| Bastion | 134.185.173.50 (ssh bastion-pad) |
| VM1 | 134.185.162.230 (ssh vm1-pad) |
| VCN | สร้างแล้ว |
| OKE Cluster | สร้างแล้ว |
| Credentials | `~/.secure/claude/terraform.tfvars` |

---

## � งานค้าง — ต้องทำต่อพรุ่งนี้

### 1. แก้ systemd backend (ด่วน)

**ปัญหา:** `oci-backend.service` fail ด้วย `status=203/EXEC`
- Frontend (port 3000) ✅ systemd `active (running)` แล้ว
- Backend (port 8000) ⚠️ รันอยู่แต่เป็น **nohup เดิม** (ถ้า VM reboot จะหาย!)
- สาเหตุน่าจะเป็น **SELinux** บล็อก systemd ไม่ให้รัน binary ใน `/home/opc/`

**วิธีแก้ (เลือกทำอันใดอันหนึ่ง):**

```bash
ssh app-vm   # ← เข้า VM ก่อน
```

**ตัวเลือก A — แก้ SELinux context (แนะนำ):**
```bash
sudo getenforce   # ดูว่า Enforcing ไหม
sudo chcon -R -t bin_t /home/opc/appterraform/backend/venv/bin/
sudo systemctl restart oci-backend
sudo systemctl status oci-backend
```

**ตัวเลือก B — ย้าย app ไป /opt/ (หลีกเลี่ยง SELinux home policy):**
```bash
sudo cp -r /home/opc/appterraform /opt/
sudo chown -R opc:opc /opt/appterraform
sudo sed -i 's|/home/opc/appterraform|/opt/appterraform|g' \
  /etc/systemd/system/oci-backend.service \
  /etc/systemd/system/oci-frontend.service
sudo systemctl daemon-reload
sudo systemctl restart oci-backend oci-frontend
```

**ตัวเลือก C — ใช้ crontab @reboot (ง่ายสุด ไม่ต้องแก้ SELinux):**
```bash
(crontab -l 2>/dev/null; echo '@reboot cd /home/opc/appterraform/backend && source venv/bin/activate && nohup uvicorn main:app --host 0.0.0.0 --port 8000 > /tmp/backend.log 2>&1 &') | crontab -
```

---

### 2. Test end-to-end (หลังแก้ข้อ 1)
- เปิด http://134.185.162.105:3000
- ใส่ OCI credentials จริง (`~/.secure/claude/terraform.tfvars` และ `~/.oci/oci_api_key.pem`)
- ทดสอบ validate → list VCN → deploy

### 3. ติดตั้ง terraform binary บน VM (ต้องมีก่อน Apply จริง)
```bash
ssh app-vm
sudo dnf install -y yum-utils
sudo yum-config-manager --add-repo https://rpm.releases.hashicorp.com/RHEL/hashicorp.repo
sudo dnf install -y terraform
terraform --version
```

---

## ▶️ วิธี Start Services

### บน Mac (local dev)
```bash
# Backend
cd ~/Desktop/appterraform/backend
source venv/bin/activate
uvicorn main:app --reload --port 8000

# Frontend (terminal ใหม่)
cd ~/Desktop/appterraform/frontend
npm run dev
```

### บน VM 134.185.162.105
```bash
ssh app-vm

# Backend
cd /home/opc/appterraform/backend
source venv/bin/activate
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > /tmp/backend.log 2>&1 &

# Frontend
cd /home/opc/appterraform/frontend/.next/standalone
nohup node server.js > /tmp/frontend.log 2>&1 &

# ดู logs
tail -f /tmp/backend.log
tail -f /tmp/frontend.log
```

### Deploy โค้ดใหม่จาก Mac ไป VM
```bash
cd ~/Desktop/appterraform
./deploy.sh
```

---

## 🖥 User Flow (4 Steps)

1. **`/credentials`** → ใส่ tenancy_ocid, user_ocid, fingerprint, region, private_key → validate กับ OCI API → เก็บใน sessionStorage
2. **`/vcn`** → เลือก compartment → เลือก VCN เดิม หรือ สร้างใหม่ → เก็บ config ใน sessionStorage
3. **`/resources`** → toggle เลือก VM / OKE / Database / Bastion พร้อม config แต่ละตัว → เก็บ config ใน sessionStorage
4. **`/deploy`** → show terraform plan → กด Apply → WebSocket streaming logs → แสดง outputs

---

## 🌐 Infrastructure ทั้งหมด

| Resource | IP / Detail | SSH |
|----------|-------------|-----|
| Bastion | 134.185.173.50 | `ssh bastion-pad` |
| VM1 (เดิม) | 134.185.162.230 | `ssh vm1-pad` |
| **App VM (ใหม่)** | **134.185.162.105** | **`ssh app-vm`** |
| Region | ap-pathumthani-1 | - |
| OCI Credentials | `~/.secure/claude/terraform.tfvars` | - |
| OCI API Key | `~/.oci/oci_api_key.pem` | - |

บน App VM มี services อื่นรันอยู่แล้ว (อย่า conflict):
- Port **1521** — Oracle Database 23c (container: `oracle-database`)
- Port **8080** — Oracle Applied AI Label (container: `oracle-applied-ai-label`)

---

## 📦 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS v4, lucide-react, axios |
| Backend | FastAPI, uvicorn, pydantic v2 |
| OCI SDK | oci-python-sdk |
| Terraform | Jinja2 templates → subprocess terraform CLI |
| Realtime | WebSocket (FastAPI native) |
| State | Browser sessionStorage (no DB needed) |

---

## 🐛 Known Issues / Tips

1. **Next.js standalone static files**: ต้อง copy ก่อน start server
   ```bash
   cp -r .next/static .next/standalone/.next/static
   cp -r public .next/standalone/public
   ```
2. **Frontend bind IP**: ต้อง start ด้วย `HOST=0.0.0.0` หรือ `node server.js` จาก standalone dir
3. **terraform binary บน VM**: ยังไม่ได้ติดตั้ง — ต้องติดตั้งก่อน apply จริง
   ```bash
   # บน VM (Oracle Linux)
   sudo dnf install -y yum-utils
   sudo yum-config-manager --add-repo https://rpm.releases.hashicorp.com/RHEL/hashicorp.repo
   sudo dnf install -y terraform
   ```
4. **Private key format**: frontend ส่ง raw PEM text → backend เขียนลงไฟล์ชั่วคราว `oci_key.pem`
5. **Workspace cleanup**: terraform workspace สร้างใน `backend/terraform_workspace/tf_XXXXX/` ต้อง cleanup เองถ้า disk เต็ม
