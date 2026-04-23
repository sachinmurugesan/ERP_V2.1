#!/bin/bash
set -e

echo "🚀 HarvestERP Production Deploy"
echo "================================"

# 1. Install Docker if not present
if ! command -v docker &>/dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker && systemctl start docker
fi

# 2. Install Docker Compose plugin
if ! docker compose version &>/dev/null; then
    echo "📦 Installing Docker Compose..."
    apt-get update && apt-get install -y docker-compose-plugin
fi

# 3. Clone or pull repo
APP_DIR=/opt/harvesterp
if [ -d "$APP_DIR" ]; then
    echo "📥 Pulling latest code..."
    cd "$APP_DIR" && git pull origin main
else
    echo "📥 Cloning repo..."
    git clone https://github.com/sachinmurugesan/SAAS-ERP.git "$APP_DIR"
    cd "$APP_DIR"
fi

# 4. Create .env if not exists
if [ ! -f .env ]; then
    echo "🔐 Creating .env..."
    cat > .env << ENV
DB_PASSWORD=$(openssl rand -base64 24)
JWT_SECRET=$(openssl rand -base64 32)
ENV
    echo "⚠️  .env created with random secrets. Save these!"
    cat .env
fi

# 5. Build and start
echo "🏗️  Building containers..."
docker compose -f docker-compose.prod.yml build

echo "🚀 Starting services..."
docker compose -f docker-compose.prod.yml up -d

# 6. Wait for DB health
echo "⏳ Waiting for database..."
sleep 10

# 7. Show status
echo ""
echo "✅ Deploy complete!"
echo "================================"
docker compose -f docker-compose.prod.yml ps
echo ""
echo "🌐 Set DNS A records for 72.62.248.202:"
echo "   admin.absodok.com  → 72.62.248.202"
echo "   client.absodok.com → 72.62.248.202"
echo "   factory.absodok.com→ 72.62.248.202"
echo "   api.absodok.com    → 72.62.248.202"
echo ""
echo "🔒 After DNS propagates, run:"
echo "   certbot certonly --webroot -w /var/www/certbot -d admin.absodok.com -d client.absodok.com -d factory.absodok.com -d api.absodok.com"
