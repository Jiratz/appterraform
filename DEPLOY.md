# 🚀 Deploy Guide — OCI Terraform Manager

## วิธีที่ 1: Docker Compose (แนะนำ)

### ต้องติดตั้ง
- Docker + Docker Compose

### คำสั่ง
```bash
# Clone/copy โปรเจกต์ไป server
scp -r ./appterraform user@YOUR_SERVER_IP:~/appterraform

# SSH เข้า server
ssh user@YOUR_SERVER_IP

# Run
cd ~/appterraform
docker compose up -d --build

# เช็คสถานะ
docker compose ps
docker compose logs -f
```

### เข้าใช้งาน
- Frontend: http://YOUR_SERVER_IP
- Backend API: http://YOUR_SERVER_IP:8000
- Swagger Docs: http://YOUR_SERVER_IP:8000/docs

---

## วิธีที่ 2: รันตรงๆ บน Server (ไม่ใช้ Docker)

### ต้องติดตั้ง
- Python 3.11+
- Terraform CLI
- nginx (สำหรับ frontend)

### Backend
```bash
cd appterraform/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend
```bash
# Copy index.html ไปยัง nginx web root
sudo cp appterraform/frontend/index.html /var/www/html/index.html
sudo systemctl start nginx
```

---

## วิธีที่ 3: Deploy บน OCI VM ที่มีอยู่แล้ว

```bash
# SSH เข้า VM ที่มีอยู่ (134.185.162.230)
ssh vm1-pad

# Install Docker
sudo dnf install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# Copy โปรเจกต์แล้ว run
scp -r ./appterraform vm1-pad:~/
ssh vm1-pad "cd ~/appterraform && docker compose up -d --build"
```

### เปิด Security List บน OCI
ต้องเปิด port 80 และ 8000 ใน OCI Security List หรือ Security Group

---

## Firewall (ถ้าใช้ Oracle Linux)
```bash
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=8000/tcp
sudo firewall-cmd --reload
```
