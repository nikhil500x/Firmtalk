#!/bin/bash

# =============================================================================
# Touchstone Complete Deployment Script
# =============================================================================
# This script handles:
# - Building backend and frontend
# - Setting up nginx configuration
# - Starting services with PM2
# Usage: ./deploy-complete.sh [--project-path /path/to/project] [--domain your-domain.com]
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - UPDATE THESE FOR YOUR SERVER
PROJECT_ROOT="${PROJECT_ROOT:-/home/ubuntu/x/Touchstone}"
DOMAIN="${DOMAIN:-staging.touchstonepartners.com}"
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
NGINX_CONFIG_NAME="touchstone"

BACKEND_DIR="$PROJECT_ROOT/backend-express"
FRONTEND_DIR="$PROJECT_ROOT/touchstone"
LOGS_DIR="$PROJECT_ROOT/logs"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --project-path)
      PROJECT_ROOT="$2"
      BACKEND_DIR="$PROJECT_ROOT/backend-express"
      FRONTEND_DIR="$PROJECT_ROOT/touchstone"
      LOGS_DIR="$PROJECT_ROOT/logs"
      shift 2
      ;;
    --domain)
      DOMAIN="$2"
      shift 2
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Usage: ./deploy-complete.sh [--project-path /path] [--domain domain.com]"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Touchstone Complete Deployment${NC}"
echo -e "${GREEN}Project: $PROJECT_ROOT${NC}"
echo -e "${GREEN}Domain: $DOMAIN${NC}"
echo -e "${GREEN}========================================${NC}"

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
  echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# =============================================================================
# Prerequisites Check
# =============================================================================

log_step "Checking prerequisites..."

# Check Node.js
if ! command_exists node; then
  log_error "Node.js is not installed"
  exit 1
fi
log_info "Node.js: $(node --version) ✓"

# Check npm
if ! command_exists npm; then
  log_error "npm is not installed"
  exit 1
fi
log_info "npm: $(npm --version) ✓"

# Check PM2
if ! command_exists pm2; then
  log_warn "PM2 not found. Installing..."
  sudo npm install -g pm2 || {
    log_error "Failed to install PM2"
    exit 1
  }
fi
log_info "PM2: $(pm2 --version) ✓"

# Check nginx
if ! command_exists nginx; then
  log_error "nginx is not installed. Please install nginx first."
  exit 1
fi
log_info "nginx: $(nginx -v 2>&1) ✓"

# Check memory and swap
log_info "Checking system memory..."
TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')
AVAIL_MEM=$(free -m | awk '/^Mem:/{print $7}')
SWAP_SIZE=$(free -m | awk '/^Swap:/{print $2}')

log_info "Total Memory: ${TOTAL_MEM}MB, Available: ${AVAIL_MEM}MB, Swap: ${SWAP_SIZE}MB"

# Warn if memory is low and no swap
if [ "$TOTAL_MEM" -lt 2048 ] && [ "$SWAP_SIZE" -eq 0 ]; then
  log_warn "Low memory detected (${TOTAL_MEM}MB) and no swap space. Build may fail."
  log_warn "Consider adding swap space: sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile"
fi

# =============================================================================
# Step 1: Navigate to project
# =============================================================================

log_step "Step 1: Navigating to project root..."
cd "$PROJECT_ROOT" || {
  log_error "Failed to navigate to project root: $PROJECT_ROOT"
  exit 1
}

# =============================================================================
# Step 2: Pull latest code (if git repo)
# =============================================================================

log_step "Step 2: Pulling latest code..."
if [ -d ".git" ]; then
  git pull origin main || git pull origin master || log_warn "Git pull failed"
else
  log_warn "Not a git repository. Skipping git pull."
fi

# =============================================================================
# Step 3: Create logs directory
# =============================================================================

log_step "Step 3: Creating logs directory..."
mkdir -p "$LOGS_DIR"

# =============================================================================
# Step 4: Install backend dependencies
# =============================================================================

log_step "Step 4: Installing backend dependencies..."
cd "$BACKEND_DIR"
npm install

# =============================================================================
# Step 5: Generate Prisma client
# =============================================================================

log_step "Step 5: Generating Prisma client..."
cd "$BACKEND_DIR"
if ! npx prisma generate; then
  log_error "Failed to generate Prisma client"
  exit 1
fi

# =============================================================================
# Step 6: Run database migrations
# =============================================================================

log_step "Step 6: Running database migrations..."
cd "$BACKEND_DIR"
if [ -f ".env" ]; then
  npx prisma migrate deploy || log_warn "Migrations may have failed or already applied"
else
  log_warn "Backend .env file not found. Skipping migrations."
fi

# =============================================================================
# Step 7: Install frontend dependencies
# =============================================================================

log_step "Step 7: Installing frontend dependencies..."
cd "$FRONTEND_DIR"

# Clean previous build artifacts to avoid conflicts
log_info "Cleaning previous build artifacts..."
rm -rf .next node_modules/.cache 2>/dev/null || true

# Clear npm cache
log_info "Clearing npm cache..."
npm cache clean --force 2>/dev/null || true

npm install

# =============================================================================
# Step 8: Build frontend
# =============================================================================

log_step "Step 8: Building frontend with standalone output..."
cd "$FRONTEND_DIR"

# Check available memory
log_info "Checking system memory..."
free -h || true

# Build with increased memory limit and error handling
log_info "Building with NODE_OPTIONS='--max-old-space-size=4096'..."
if ! NODE_OPTIONS="--max-old-space-size=4096" npm run build; then
  log_error "Failed to build frontend"
  log_error "Try increasing memory limit or check for build errors above"
  exit 1
fi

# Copy required files for standalone mode
log_info "Copying required files for standalone mode..."
rm -rf .next/standalone/.next/static 2>/dev/null || true
mkdir -p .next/standalone/.next
if [ -d ".next/static" ]; then
  cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
fi
if [ -d "public" ]; then
  rm -rf .next/standalone/public 2>/dev/null || true
  cp -r public .next/standalone/ 2>/dev/null || true
fi

# Verify structure
if [ ! -d ".next/standalone/.next/static" ]; then
  log_warn "Warning: .next/static directory not found - static assets may not load"
fi

# =============================================================================
# Step 9: Setup nginx configuration
# =============================================================================

log_step "Step 9: Setting up nginx configuration..."

NGINX_CONFIG="$NGINX_SITES_AVAILABLE/$NGINX_CONFIG_NAME"

# Check if SSL certificates exist
SSL_CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
SSL_KEY="/etc/letsencrypt/live/$DOMAIN/privkey.pem"
SSL_CONFIG="/etc/letsencrypt/options-ssl-nginx.conf"
SSL_DHPARAM="/etc/letsencrypt/ssl-dhparams.pem"

HAS_SSL=false
if [ -f "$SSL_CERT" ] && [ -f "$SSL_KEY" ] && [ -f "$SSL_CONFIG" ]; then
  HAS_SSL=true
  log_info "SSL certificates found, configuring HTTPS..."
else
  log_warn "SSL certificates not found, configuring HTTP only..."
  log_info "After deployment, run: sudo certbot --nginx -d $DOMAIN"
fi

# Create nginx config
if [ "$HAS_SSL" = true ]; then
  # HTTPS configuration
sudo tee "$NGINX_CONFIG" > /dev/null <<EOF
# Upstream configuration for Next.js frontend
upstream nextjs_frontend {
    server 127.0.0.1:3000;
    keepalive 64;
}

# Upstream configuration for Express backend
upstream express_backend {
    server 127.0.0.1:3001;
    keepalive 64;
}

# HTTPS server
server {
    server_name $DOMAIN;

    # Logging
    access_log /var/log/nginx/touchstone-access.log;
    error_log /var/log/nginx/touchstone-error.log;

    # Maximum upload size
    client_max_body_size 50M;

    # Proxy settings
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_cache_bypass \$http_upgrade;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # Serve static files directly from filesystem (more efficient)
    location /_next/static {
        alias $FRONTEND_DIR/.next/standalone/.next/static;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Next.js Image Optimization API - MUST be before other routes
    location /_next/image {
        proxy_pass http://nextjs_frontend;
        proxy_redirect off;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Serve public files directly
    location ~ ^/(images|favicon.ico|robots.txt|sitemap.xml) {
        alias $FRONTEND_DIR/.next/standalone/public\$request_uri;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Azure callback route - MUST be before the general /api block
    location /api/azure/callback {
        proxy_pass http://nextjs_frontend;
        proxy_redirect off;
    }

    # Backend API routes - proxy to Express on port 3001
    location /api {
        proxy_pass http://express_backend;
        proxy_redirect off;
    }

    # Frontend - proxy everything else to Next.js on port 3000
    location / {
        proxy_pass http://nextjs_frontend;
        proxy_redirect off;
    }

    listen [::]:443 ssl ipv6only=on; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if (\$host = $DOMAIN) {
        return 301 https://\$host\$request_uri;
    } # managed by Certbot

    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    return 404; # managed by Certbot
}
EOF
else
  # HTTP-only configuration (for initial setup)
  sudo tee "$NGINX_CONFIG" > /dev/null <<EOF
# Upstream configuration for Next.js frontend
upstream nextjs_frontend {
    server 127.0.0.1:3000;
    keepalive 64;
}

# Upstream configuration for Express backend
upstream express_backend {
    server 127.0.0.1:3001;
    keepalive 64;
}

# HTTP server
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    # Logging
    access_log /var/log/nginx/touchstone-access.log;
    error_log /var/log/nginx/touchstone-error.log;

    # Maximum upload size
    client_max_body_size 50M;

    # Proxy settings
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_cache_bypass \$http_upgrade;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # Serve static files directly from filesystem (more efficient)
    location /_next/static {
        alias $FRONTEND_DIR/.next/standalone/.next/static;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Next.js Image Optimization API - MUST be before other routes
    location /_next/image {
        proxy_pass http://nextjs_frontend;
        proxy_redirect off;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Serve public files directly
    location ~ ^/(images|favicon.ico|robots.txt|sitemap.xml) {
        alias $FRONTEND_DIR/.next/standalone/public\$request_uri;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Azure callback route - MUST be before the general /api block
    location /api/azure/callback {
        proxy_pass http://nextjs_frontend;
        proxy_redirect off;
    }

    # Backend API routes - proxy to Express on port 3001
    location /api {
        proxy_pass http://express_backend;
        proxy_redirect off;
    }

    # Frontend - proxy everything else to Next.js on port 3000
    location / {
        proxy_pass http://nextjs_frontend;
        proxy_redirect off;
    }
}
EOF
fi

# Enable site
sudo ln -sf "$NGINX_CONFIG" "$NGINX_SITES_ENABLED/$NGINX_CONFIG_NAME"

# Test nginx configuration
log_info "Testing nginx configuration..."
if sudo nginx -t; then
  log_info "Nginx configuration is valid ✓"
else
  log_error "Nginx configuration test failed"
  exit 1
fi

# =============================================================================
# Step 10: Stop existing PM2 processes
# =============================================================================

log_step "Step 10: Stopping existing PM2 processes..."
pm2 stop touchstone-backend touchstone-frontend 2>/dev/null || true
pm2 delete touchstone-backend touchstone-frontend 2>/dev/null || true

# =============================================================================
# Step 11: Start backend with PM2
# =============================================================================

log_step "Step 11: Starting backend with PM2 (dev mode)..."
cd "$BACKEND_DIR"
pm2 start npm \
  --name "touchstone-backend" \
  --cwd "$BACKEND_DIR" \
  --log "$LOGS_DIR/backend.log" \
  --error "$LOGS_DIR/backend-error.log" \
  --time \
  -- run dev

# =============================================================================
# Step 12: Start frontend with PM2
# =============================================================================

log_step "Step 12: Starting frontend with PM2 (standalone production server)..."
cd "$FRONTEND_DIR/.next/standalone"
pm2 start node \
  --name "touchstone-frontend" \
  --cwd "$FRONTEND_DIR/.next/standalone" \
  --log "$LOGS_DIR/frontend.log" \
  --error "$LOGS_DIR/frontend-error.log" \
  --time \
  -- server.js

# =============================================================================
# Step 13: Save PM2 configuration
# =============================================================================

log_step "Step 13: Saving PM2 configuration..."
pm2 save || log_warn "Failed to save PM2 configuration"

# Setup PM2 startup (if not already done)
if ! pm2 startup | grep -q "already setup"; then
  log_info "Setting up PM2 startup script..."
  pm2 startup | tail -1 | sudo bash || log_warn "PM2 startup setup may have failed"
fi

# =============================================================================
# Step 14: Reload nginx
# =============================================================================

log_step "Step 14: Reloading nginx..."
sudo systemctl reload nginx || {
  log_error "Failed to reload nginx"
  exit 1
}

# =============================================================================
# Step 15: Show status
# =============================================================================

log_step "Step 15: Service Status"
echo ""
pm2 status
echo ""

# =============================================================================
# Deployment Complete
# =============================================================================

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${GREEN}Services are running:${NC}"
echo "  - Backend: http://localhost:3001"
echo "  - Frontend: http://localhost:3000"
echo "  - Public URL: https://$DOMAIN"
echo ""
echo -e "${GREEN}Useful commands:${NC}"
echo "  pm2 status              - View process status"
echo "  pm2 logs                - View logs"
echo "  pm2 restart all         - Restart all processes"
echo "  pm2 stop all            - Stop all processes"
echo "  sudo nginx -t           - Test nginx config"
echo "  sudo systemctl reload nginx - Reload nginx"
echo ""
echo -e "${YELLOW}Note: Make sure SSL certificates are set up for $DOMAIN${NC}"
echo ""

