#!/bin/bash
# deploy.sh — Deploy appterraform ไป VM 134.185.162.105 แบบ run ตรงๆ (ไม่ใช้ container)
# หมายเหตุ: VM มี Oracle DB (1521) และ Oracle Applied AI (8080) อยู่แล้ว
#           app นี้ใช้ port 3000 (frontend) และ 8000 (backend) ซึ่งไม่ชนกัน

VM_IP="134.185.162.105"
VM_SSH="opc@$VM_IP"
APP_DIR="/home/opc/appterraform"

set -e
echo "🚀 Deploying OCI Terraform Manager to $VM_IP..."

# ── 1. rsync source ──────────────────────────────────────────
echo "📦 Syncing files..."
rsync -avz --progress \
  --exclude='node_modules' \
  --exclude='venv' \
  --exclude='.next' \
  --exclude='__pycache__' \
  --exclude='terraform_workspace/*' \
  --exclude='.git' \
  -e "ssh -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no" \
  /Users/jiratz-mac/Desktop/appterraform/ \
  $VM_SSH:$APP_DIR/

# ── 2. Setup และ start บน VM ─────────────────────────────────
echo "🔧 Setting up and starting services on VM..."
ssh -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no -t $VM_SSH << 'REMOTE'
set -e
APP_DIR="/home/opc/appterraform"

echo "=== Setup Backend ==="
cd $APP_DIR/backend

# ใช้ Python 3.9 (VM มี 3.6 เป็น default แต่ FastAPI ต้องการ 3.8+)
python3.9 -m venv venv
source venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet fastapi uvicorn oci jinja2 websockets python-multipart pydantic

# ติดตั้ง terraform ถ้ายังไม่มี
if ! command -v terraform &>/dev/null; then
  echo "Installing terraform..."
  cd /tmp
  curl -fsSL https://releases.hashicorp.com/terraform/1.9.0/terraform_1.9.0_linux_amd64.zip -o tf.zip
  unzip -o tf.zip
  sudo mv terraform /usr/local/bin/
  rm tf.zip
  cd $APP_DIR/backend
fi
echo "terraform: $(terraform version | head -1)"

echo "=== Setup Frontend ==="
cd $APP_DIR/frontend

# ติดตั้ง Node.js ถ้ายังไม่มี
if ! command -v node &>/dev/null; then
  echo "Installing Node.js..."
  curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
  sudo dnf install -y nodejs
fi
echo "node: $(node --version)"

npm ci --silent
npm run build

echo "=== Stop old processes ==="
pkill -f "uvicorn main:app" 2>/dev/null || true
pkill -f "node server.js" 2>/dev/null || true
sleep 1

echo "=== Start Backend (port 8000) ==="
cd $APP_DIR/backend
source venv/bin/activate
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > /tmp/backend.log 2>&1 &
echo "Backend PID: $!"

echo "=== Start Frontend (port 3000) ==="
cd $APP_DIR/frontend
nohup node .next/standalone/server.js > /tmp/frontend.log 2>&1 &
echo "Frontend PID: $!"

sleep 3
echo "=== Status ==="
curl -s http://localhost:8000/health && echo " ← Backend OK" || echo "Backend not ready yet"
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 && echo " ← Frontend OK" || echo "Frontend not ready yet"

REMOTE

# ── 3. เปิด firewall ───────────────────────────────────────
echo "🔓 Opening firewall ports..."
ssh -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no $VM_SSH \
  "sudo firewall-cmd --permanent --add-port=3000/tcp --add-port=8000/tcp && sudo firewall-cmd --reload" 2>/dev/null || echo "firewall skip"

echo ""
echo "✅ Deploy complete!"
echo "   Frontend: http://$VM_IP:3000"
echo "   Backend:  http://$VM_IP:8000/docs"
