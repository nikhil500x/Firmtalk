#!/bin/bash

# =============================================================================
# Touchstone IP-Based Deployment Script
# =============================================================================
# This script handles:
# - Getting server IP from ip.me
# - Building backend and frontend
# - Setting up nginx configuration for IP-based access
# - Configuring all environment variables with IP
# - Starting services with PM2
# Usage: ./deploy-ip.sh [--project-path /path/to/project] [--port 80]
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - UPDATE THESE FOR YOUR SERVER
PROJECT_ROOT="${PROJECT_ROOT:-/home/ubuntu/Touchstone}"
HTTP_PORT="${HTTP_PORT:-80}"
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
NGINX_CONFIG_NAME="touchstone-ip"

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
    --port)
      HTTP_PORT="$2"
      shift 2
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Usage: ./deploy-ip.sh [--project-path /path] [--port 80]"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Touchstone IP-Based Deployment${NC}"
echo -e "${GREEN}Project: $PROJECT_ROOT${NC}"
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
# Step 1: Get Server IP
# =============================================================================

log_step "Step 1: Getting server IP address..."

# Try to get IP from ip.me
log_info "Fetching public IP from ip.me..."
SERVER_IP=$(curl -s https://ip.me 2>/dev/null || curl -s https://api.ipify.org 2>/dev/null || curl -s https://ifconfig.me/ip 2>/dev/null)

# Fallback: try other methods if ip.me fails
if [ -z "$SERVER_IP" ]; then
  log_warn "Failed to get IP from ip.me, trying alternative methods..."
  SERVER_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || ip addr show | grep 'inet ' | grep -v '127.0.0.1' | head -1 | awk '{print $2}' | cut -d/ -f1)
fi

# Final fallback: ask user
if [ -z "$SERVER_IP" ]; then
  log_error "Could not automatically detect server IP"
  read -p "Please enter your server IP address: " SERVER_IP
  if [ -z "$SERVER_IP" ]; then
    log_error "IP address is required"
    exit 1
  fi
fi

log_info "Server IP detected: $SERVER_IP"

# Set URLs based on IP and port
if [ "$HTTP_PORT" = "80" ]; then
  BASE_URL="http://$SERVER_IP"
else
  BASE_URL="http://$SERVER_IP:$HTTP_PORT"
fi

BACKEND_URL="http://localhost:3001"
FRONTEND_URL="$BASE_URL"

log_info "Base URL: $FRONTEND_URL"
log_info "Backend URL (internal): $BACKEND_URL"

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
# Step 2: Navigate to project
# =============================================================================

log_step "Step 2: Navigating to project root..."
cd "$PROJECT_ROOT" || {
  log_error "Failed to navigate to project root: $PROJECT_ROOT"
  exit 1
}

# =============================================================================
# Step 3: Pull latest code (if git repo)
# =============================================================================

log_step "Step 3: Pulling latest code..."
if [ -d ".git" ]; then
  git pull origin main || git pull origin master || log_warn "Git pull failed"
else
  log_warn "Not a git repository. Skipping git pull."
fi

# =============================================================================
# Step 4: Create logs directory
# =============================================================================

log_step "Step 4: Creating logs directory..."
mkdir -p "$LOGS_DIR"

# =============================================================================
# Step 5: Configure Backend Environment Variables
# =============================================================================

log_step "Step 5: Configuring backend environment variables..."

BACKEND_ENV_FILE="$BACKEND_DIR/.env"

# Create backend .env if it doesn't exist
if [ ! -f "$BACKEND_ENV_FILE" ]; then
  log_info "Creating backend .env file..."
  touch "$BACKEND_ENV_FILE"
fi

# Backup existing .env
if [ -f "$BACKEND_ENV_FILE" ]; then
  cp "$BACKEND_ENV_FILE" "$BACKEND_ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
  log_info "Backed up existing backend .env file"
fi

# Function to update or add env variable
update_env_var() {
  local file="$1"
  local key="$2"
  local value="$3"
  
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    # Update existing variable
    if [[ "$OSTYPE" == "darwin"* ]]; then
      # macOS
      sed -i '' "s|^${key}=.*|${key}=${value}|" "$file"
    else
      # Linux
      sed -i "s|^${key}=.*|${key}=${value}|" "$file"
    fi
  else
    # Add new variable
    echo "${key}=${value}" >> "$file"
  fi
}

# Update/Create backend environment variables
log_info "Setting FRONTEND_URL=$FRONTEND_URL"
update_env_var "$BACKEND_ENV_FILE" "FRONTEND_URL" "$FRONTEND_URL"

log_info "Setting AZURE_REDIRECT_URI=$BACKEND_URL/api/azure/callback"
update_env_var "$BACKEND_ENV_FILE" "AZURE_REDIRECT_URI" "$BACKEND_URL/api/azure/callback"

# Ensure PORT is set
if ! grep -q "^PORT=" "$BACKEND_ENV_FILE" 2>/dev/null; then
  echo "PORT=3001" >> "$BACKEND_ENV_FILE"
fi

# Ensure NODE_ENV is set
if ! grep -q "^NODE_ENV=" "$BACKEND_ENV_FILE" 2>/dev/null; then
  echo "NODE_ENV=production" >> "$BACKEND_ENV_FILE"
fi

log_info "Backend environment variables configured ✓"

# =============================================================================
# Step 6: Configure Frontend Environment Variables
# =============================================================================

log_step "Step 6: Configuring frontend environment variables..."

FRONTEND_ENV_FILE="$FRONTEND_DIR/.env.local"
FRONTEND_ENV_FILE_ALT="$FRONTEND_DIR/.env"

# Use .env.local if it exists, otherwise use .env
if [ -f "$FRONTEND_ENV_FILE" ]; then
  ENV_FILE_TO_USE="$FRONTEND_ENV_FILE"
elif [ -f "$FRONTEND_ENV_FILE_ALT" ]; then
  ENV_FILE_TO_USE="$FRONTEND_ENV_FILE_ALT"
else
  ENV_FILE_TO_USE="$FRONTEND_ENV_FILE"
  touch "$ENV_FILE_TO_USE"
  log_info "Creating frontend .env.local file..."
fi

# Backup existing frontend .env
if [ -f "$ENV_FILE_TO_USE" ]; then
  cp "$ENV_FILE_TO_USE" "$ENV_FILE_TO_USE.backup.$(date +%Y%m%d_%H%M%S)"
  log_info "Backed up existing frontend .env file"
fi

# Update/Create frontend environment variables
# Note: NEXT_PUBLIC_BACKEND_URL is kept for reference but NEXT_PUBLIC_API_URL should be empty
# to use relative paths with Next.js rewrites (which proxy to backend via nginx)
log_info "Setting NEXT_PUBLIC_BACKEND_URL=$BACKEND_URL (for reference only)"
update_env_var "$ENV_FILE_TO_USE" "NEXT_PUBLIC_BACKEND_URL" "$BACKEND_URL"

log_info "Setting NEXT_PUBLIC_API_URL to empty string (using relative paths with Next.js rewrites)"
# Remove NEXT_PUBLIC_API_URL if it exists, or set it to empty string
if grep -q "^NEXT_PUBLIC_API_URL=" "$ENV_FILE_TO_USE" 2>/dev/null; then
  # Update existing variable to empty string
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=|" "$ENV_FILE_TO_USE"
  else
    sed -i "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=|" "$ENV_FILE_TO_USE"
  fi
else
  # Add new variable with empty value
  echo "NEXT_PUBLIC_API_URL=" >> "$ENV_FILE_TO_USE"
fi

log_info "Setting NEXT_PUBLIC_FRONTEND_URL=$FRONTEND_URL"
update_env_var "$ENV_FILE_TO_USE" "NEXT_PUBLIC_FRONTEND_URL" "$FRONTEND_URL"

log_info "Frontend environment variables configured ✓"

# =============================================================================
# Step 7: Install backend dependencies
# =============================================================================

log_step "Step 7: Installing backend dependencies..."
cd "$BACKEND_DIR"
npm install

# =============================================================================
# Step 8: Generate Prisma client
# =============================================================================

log_step "Step 8: Generating Prisma client..."
cd "$BACKEND_DIR"
if ! npx prisma generate; then
  log_error "Failed to generate Prisma client"
  exit 1
fi

# =============================================================================
# Step 9: Run database migrations
# =============================================================================

log_step "Step 9: Running database migrations..."
cd "$BACKEND_DIR"
if [ -f ".env" ]; then
  npx prisma migrate deploy || log_warn "Migrations may have failed or already applied"
else
  log_warn "Backend .env file not found. Skipping migrations."
fi

# =============================================================================
# Step 10: Install frontend dependencies
# =============================================================================

log_step "Step 10: Installing frontend dependencies..."
cd "$FRONTEND_DIR"

# Clean previous build artifacts to avoid conflicts
log_info "Cleaning previous build artifacts..."
rm -rf .next node_modules/.cache 2>/dev/null || true

# Clear npm cache
log_info "Clearing npm cache..."
npm cache clean --force 2>/dev/null || true

npm install

# =============================================================================
# Step 11: Build frontend
# =============================================================================

log_step "Step 11: Building frontend with standalone output..."
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

# Set proper permissions for nginx to serve static files
log_info "Setting permissions for static files..."
sudo chmod -R o+rX "$FRONTEND_DIR/.next/standalone/.next/static" 2>/dev/null || true
sudo chmod o+x "$FRONTEND_DIR/.next/standalone/.next" 2>/dev/null || true
sudo chmod o+x "$FRONTEND_DIR/.next/standalone" 2>/dev/null || true
sudo chmod o+x "$FRONTEND_DIR/.next" 2>/dev/null || true

# =============================================================================
# Step 12: Setup nginx configuration
# =============================================================================

log_step "Step 12: Setting up nginx configuration for IP-based access..."

NGINX_CONFIG="$NGINX_SITES_AVAILABLE/$NGINX_CONFIG_NAME"

# Create nginx config for IP-based access (HTTP only, no SSL)
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

# HTTP server for IP-based access
server {
    listen ${HTTP_PORT};
    listen [::]:${HTTP_PORT};
    server_name ${SERVER_IP} _;

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

# Enable site
sudo ln -sf "$NGINX_CONFIG" "$NGINX_SITES_ENABLED/$NGINX_CONFIG_NAME"

# Remove default nginx site if it conflicts
if [ -L "$NGINX_SITES_ENABLED/default" ] && [ "$HTTP_PORT" = "80" ]; then
  log_warn "Default nginx site detected. Disabling it..."
  sudo rm -f "$NGINX_SITES_ENABLED/default"
fi

# Test nginx configuration
log_info "Testing nginx configuration..."
if sudo nginx -t; then
  log_info "Nginx configuration is valid ✓"
else
  log_error "Nginx configuration test failed"
  exit 1
fi

# =============================================================================
# Step 13: Stop existing PM2 processes
# =============================================================================

log_step "Step 13: Stopping existing PM2 processes..."
pm2 stop touchstone-backend touchstone-frontend 2>/dev/null || true
pm2 delete touchstone-backend touchstone-frontend 2>/dev/null || true

# =============================================================================
# Step 14: Start backend with PM2
# =============================================================================

log_step "Step 14: Starting backend with PM2 (dev mode)..."
cd "$BACKEND_DIR"
pm2 start npm \
  --name "touchstone-backend" \
  --cwd "$BACKEND_DIR" \
  --log "$LOGS_DIR/backend.log" \
  --error "$LOGS_DIR/backend-error.log" \
  --time \
  -- run dev

# =============================================================================
# Step 15: Start frontend with PM2
# =============================================================================

log_step "Step 15: Starting frontend with PM2 (standalone production server)..."
cd "$FRONTEND_DIR/.next/standalone"
pm2 start node \
  --name "touchstone-frontend" \
  --cwd "$FRONTEND_DIR/.next/standalone" \
  --log "$LOGS_DIR/frontend.log" \
  --error "$LOGS_DIR/frontend-error.log" \
  --time \
  -- server.js

# =============================================================================
# Step 16: Save PM2 configuration
# =============================================================================

log_step "Step 16: Saving PM2 configuration..."
pm2 save || log_warn "Failed to save PM2 configuration"

# Setup PM2 startup (if not already done)
if ! pm2 startup | grep -q "already setup"; then
  log_info "Setting up PM2 startup script..."
  pm2 startup | tail -1 | sudo bash || log_warn "PM2 startup setup may have failed"
fi

# =============================================================================
# Step 17: Reload nginx
# =============================================================================

log_step "Step 17: Reloading nginx..."
sudo systemctl reload nginx || {
  log_error "Failed to reload nginx"
  exit 1
}

# =============================================================================
# Step 18: Show status
# =============================================================================

log_step "Step 18: Service Status"
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
echo -e "${GREEN}Server IP: $SERVER_IP${NC}"
echo -e "${GREEN}Services are running:${NC}"
echo "  - Backend (internal): http://localhost:3001"
echo "  - Frontend (internal): http://localhost:3000"
if [ "$HTTP_PORT" = "80" ]; then
  echo -e "  - ${GREEN}Public URL: http://$SERVER_IP${NC}"
else
  echo -e "  - ${GREEN}Public URL: http://$SERVER_IP:$HTTP_PORT${NC}"
fi
echo ""
echo -e "${GREEN}Environment Variables Configured:${NC}"
echo "  - Backend FRONTEND_URL: $FRONTEND_URL"
echo "  - Backend AZURE_REDIRECT_URI: $BACKEND_URL/api/azure/callback"
echo "  - Frontend NEXT_PUBLIC_BACKEND_URL: $BACKEND_URL (for reference only)"
echo "  - Frontend NEXT_PUBLIC_API_URL: (empty - using relative paths)"
echo "  - Frontend NEXT_PUBLIC_FRONTEND_URL: $FRONTEND_URL"
echo ""
echo -e "${GREEN}Useful commands:${NC}"
echo "  pm2 status              - View process status"
echo "  pm2 logs                - View logs"
echo "  pm2 restart all         - Restart all processes"
echo "  pm2 stop all            - Stop all processes"
echo "  sudo nginx -t           - Test nginx config"
echo "  sudo systemctl reload nginx - Reload nginx"
echo ""
echo -e "${YELLOW}Note: This is an IP-based deployment without SSL.${NC}"
echo -e "${YELLOW}For production use, consider setting up a domain with SSL.${NC}"
echo ""


