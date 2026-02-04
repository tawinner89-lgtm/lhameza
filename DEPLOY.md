# 🚀 L'HAMZA F SEL'A - Deployment Guide

## Table of Contents
- [Quick Start](#quick-start)
- [Local Docker](#local-docker)
- [Railway Deployment](#railway-deployment)
- [Render Deployment](#render-deployment)
- [VPS Deployment](#vps-deployment)
- [DigitalOcean App Platform](#digitalocean-app-platform)
- [Environment Variables](#environment-variables)
- [Monitoring & Logs](#monitoring--logs)

---

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose (optional)
- Telegram Bot Token (for alerts)

### Local Development
```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your Telegram credentials

# Start API server
npm run api

# In another terminal, run scraper
npm run universal
```

Visit: http://localhost:3000/api/deals

---

## Local Docker

### Build & Run
```bash
# Build the image
docker build -t lhamza-api .

# Run API server
docker run -d \
  --name lhamza-api \
  -p 3000:3000 \
  -e TELEGRAM_BOT_TOKEN=your_token \
  -e TELEGRAM_CHAT_ID=your_chat_id \
  -v $(pwd)/data:/app/data \
  lhamza-api

# Check logs
docker logs -f lhamza-api
```

### Using Docker Compose
```bash
# Copy env file
cp .env.example .env

# Start API
docker-compose up -d

# Run scraper manually
docker-compose --profile scraper up scraper

# Start scheduler (runs every 4 hours)
docker-compose --profile scheduler up -d scheduler

# View logs
docker-compose logs -f api

# Stop all
docker-compose down
```

---

## Railway Deployment

Railway is the easiest option - automatic builds from GitHub.

### Step 1: Prepare Repository
```bash
# Initialize git (if not already)
git init
git add .
git commit -m "Initial commit"

# Push to GitHub
gh repo create lhamza-f-sela --public
git push -u origin main
```

### Step 2: Deploy on Railway
1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway auto-detects Dockerfile

### Step 3: Configure Environment
In Railway dashboard → Variables:
```
NODE_ENV=production
API_PORT=3000
TELEGRAM_BOT_TOKEN=your_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
API_KEY=optional_secret_key
```

### Step 4: Domain
Railway provides a free domain: `your-app.up.railway.app`

### Step 5: Scheduled Scraper (Cron)
Railway supports cron jobs:
1. Add new service → "Cron Job"
2. Command: `node scripts/run-universal.js`
3. Schedule: `0 */4 * * *` (every 4 hours)

---

## Render Deployment

### Step 1: Create render.yaml
```yaml
# render.yaml
services:
  - type: web
    name: lhamza-api
    env: docker
    dockerfilePath: ./Dockerfile
    envVars:
      - key: NODE_ENV
        value: production
      - key: TELEGRAM_BOT_TOKEN
        sync: false
      - key: TELEGRAM_CHAT_ID
        sync: false

  - type: cron
    name: lhamza-scraper
    env: docker
    dockerfilePath: ./Dockerfile
    dockerCommand: node scripts/run-universal.js
    schedule: "0 */4 * * *"
    envVars:
      - key: TELEGRAM_BOT_TOKEN
        sync: false
      - key: TELEGRAM_CHAT_ID
        sync: false
```

### Step 2: Deploy
1. Go to [render.com](https://render.com)
2. New → "Blueprint"
3. Connect GitHub repo
4. Render reads `render.yaml` automatically

---

## VPS Deployment

For Ubuntu/Debian VPS (DigitalOcean, Hetzner, OVH, etc.)

### Step 1: Server Setup
```bash
# SSH into your server
ssh root@your_server_ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
apt install docker-compose-plugin -y

# Create app directory
mkdir -p /opt/lhamza
cd /opt/lhamza
```

### Step 2: Clone & Configure
```bash
# Clone your repo
git clone https://github.com/yourusername/lhamza-f-sela.git .

# Create .env file
cat > .env << 'EOF'
NODE_ENV=production
API_PORT=3000
TELEGRAM_BOT_TOKEN=your_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
API_KEY=your_secret_key
CORS_ORIGIN=*
RATE_LIMIT=100
CRON_SCHEDULE=0 */4 * * *
EOF
```

### Step 3: Run with Docker Compose
```bash
# Build and start
docker compose up -d

# Start scheduler too
docker compose --profile scheduler up -d scheduler

# Check status
docker compose ps

# View logs
docker compose logs -f api
```

### Step 4: Nginx Reverse Proxy (Optional)
```bash
# Install Nginx
apt install nginx -y

# Create config
cat > /etc/nginx/sites-available/lhamza << 'EOF'
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/lhamza /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### Step 5: SSL with Certbot
```bash
# Install Certbot
apt install certbot python3-certbot-nginx -y

# Get SSL certificate
certbot --nginx -d yourdomain.com

# Auto-renewal
certbot renew --dry-run
```

### Step 6: Auto-updates (Optional)
```bash
# Create update script
cat > /opt/lhamza/update.sh << 'EOF'
#!/bin/bash
cd /opt/lhamza
git pull
docker compose build
docker compose up -d
docker compose --profile scheduler up -d scheduler
EOF

chmod +x /opt/lhamza/update.sh

# Add to crontab for daily updates
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/lhamza/update.sh") | crontab -
```

---

## DigitalOcean App Platform

### Step 1: Create app.yaml
```yaml
# .do/app.yaml
name: lhamza-f-sela
services:
  - name: api
    dockerfile_path: Dockerfile
    github:
      repo: yourusername/lhamza-f-sela
      branch: main
    http_port: 3000
    instance_size_slug: basic-xxs
    instance_count: 1
    routes:
      - path: /
    envs:
      - key: NODE_ENV
        value: production
      - key: TELEGRAM_BOT_TOKEN
        type: SECRET
      - key: TELEGRAM_CHAT_ID
        type: SECRET

workers:
  - name: scraper
    dockerfile_path: Dockerfile
    github:
      repo: yourusername/lhamza-f-sela
      branch: main
    instance_size_slug: basic-xxs
    instance_count: 1
    run_command: node scripts/price-monitor-cron.js
    envs:
      - key: TELEGRAM_BOT_TOKEN
        type: SECRET
      - key: TELEGRAM_CHAT_ID
        type: SECRET
```

### Step 2: Deploy
```bash
# Install doctl CLI
# https://docs.digitalocean.com/reference/doctl/how-to/install/

# Authenticate
doctl auth init

# Create app
doctl apps create --spec .do/app.yaml
```

---

## Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NODE_ENV` | No | Environment | `production` |
| `API_PORT` | No | API port | `3000` |
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from @BotFather | `123456:ABC-DEF...` |
| `TELEGRAM_CHAT_ID` | Yes | Your chat ID | `123456789` |
| `API_KEY` | No | API authentication | `secret123` |
| `CORS_ORIGIN` | No | CORS allowed origins | `*` or `https://yourdomain.com` |
| `RATE_LIMIT` | No | Requests per 15 min | `100` |
| `CRON_SCHEDULE` | No | Scraper schedule | `0 */4 * * *` |
| `SCAN_CATEGORY` | No | Category to scan | `all`, `tech`, `fashion` |
| `MIN_HAMZA_SCORE` | No | Alert threshold | `5` |

---

## Monitoring & Logs

### Docker Logs
```bash
# API logs
docker compose logs -f api

# Scraper logs
docker compose logs -f scheduler

# All logs
docker compose logs -f
```

### Health Check
```bash
# Check API health
curl http://localhost:3000/health

# Check stats
curl http://localhost:3000/api/stats
```

### Log Files
Logs are stored in `./logs/` directory:
- `combined.log` - All logs
- `error.log` - Errors only

### Uptime Monitoring
Use free services like:
- [UptimeRobot](https://uptimerobot.com) - Free 5-min checks
- [Healthchecks.io](https://healthchecks.io) - Cron monitoring
- [BetterStack](https://betterstack.com) - Advanced monitoring

---

## API Endpoints

Once deployed, your API is available at:

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /api` | API documentation |
| `GET /api/deals` | All deals |
| `GET /api/deals/tech` | Tech deals |
| `GET /api/deals/fashion` | Fashion deals |
| `GET /api/deals/super-hamza` | Best deals (score > 8.5) |
| `GET /api/search?q=iphone` | Search deals |
| `GET /api/stats` | Statistics |
| `GET /api/categories` | Available categories |

### Example Requests
```bash
# Get all fashion deals
curl https://your-api.com/api/deals/fashion

# Search for iPhone
curl https://your-api.com/api/search?q=iphone

# Get deals with 50%+ discount
curl https://your-api.com/api/deals?minDiscount=50

# Get super hamza deals
curl https://your-api.com/api/deals/super-hamza
```

---

## Troubleshooting

### Container won't start
```bash
# Check logs
docker compose logs api

# Rebuild
docker compose build --no-cache
docker compose up -d
```

### Scraper fails
- Check if Telegram credentials are correct
- Ensure data volume is writable
- Check browser dependencies in Docker

### High memory usage
- Use `basic-s` instance instead of `basic-xxs`
- Limit concurrent scrapes

### Rate limited by sites
- Increase delays in scraper
- Rotate user agents
- Use proxies (advanced)

---

## Support

- 📧 Issues: GitHub Issues
- 📚 Docs: This file
- 💬 Community: Coming soon

---

**Made with ❤️ in Morocco 🇲🇦**
