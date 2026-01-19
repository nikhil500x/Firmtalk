#!/bin/bash

# =============================================================================
# Touchstone Application Deployment Script
# =============================================================================
# This script handles deployment of both backend and frontend applications
# Usage: ./deploy.sh [--mode dev|production]
# Default mode: dev
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="/Users/nikhil/Downloads/Touchstone"
BACKEND_DIR="$PROJECT_ROOT/backend-express"
FRONTEND_DIR="$PROJECT_ROOT/touchstone"
LOGS_DIR="$PROJECT_ROOT/logs"
MODE="dev"  # Default mode

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --mode)
      MODE="$2"
      shift 2
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Usage: ./deploy.sh [--mode dev|production]"
      exit 1
      ;;
  esac
done

# Validate mode
if [[ "$MODE" != "dev" && "$MODE" != "production" ]]; then
  echo -e "${RED}Invalid mode: $MODE${NC}"
  echo "Mode must be 'dev' or 'production'"
  exit 1
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Touchstone Deployment Script${NC}"
echo -e "${GREEN}Mode: $MODE${NC}"
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

# Check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# =============================================================================
# Prerequisites Check
# =============================================================================

# Check Node.js version
log_info "Checking Node.js version..."
if ! command_exists node; then
  log_error "Node.js is not installed. Please install Node.js 20 LTS or higher."
  log_error "Run: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
  exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  log_error "Node.js version is too old. Current: $(node --version), Required: 18.x or higher (20.x recommended)"
  log_error "Please upgrade Node.js:"
  log_error "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
  exit 1
fi

log_info "Node.js version: $(node --version) ✓"

# Check npm version
if ! command_exists npm; then
  log_error "npm is not installed. Please install npm."
  exit 1
fi

log_info "npm version: $(npm --version) ✓"

# Check PM2
if ! command_exists pm2; then
  log_warn "PM2 is not installed. Installing PM2..."
  sudo npm install -g pm2 || {
    log_error "Failed to install PM2. Please install manually: sudo npm install -g pm2"
    exit 1
  }
fi

log_info "PM2 version: $(pm2 --version) ✓"

# Check if .env file exists
env_file_exists() {
  [ -f "$1" ]
}

# Check if database is initialized (migrations table exists)
check_database_initialized() {
  log_info "Checking if database is initialized..."
  
  if ! env_file_exists "$BACKEND_DIR/.env"; then
    log_warn "Backend .env file not found. Database check skipped."
    return 1
  fi
  
  # Read DATABASE_URL from .env file
  DATABASE_URL=$(grep -v '^#' "$BACKEND_DIR/.env" | grep DATABASE_URL | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs)
  
  # Check if DATABASE_URL is set
  if [ -z "$DATABASE_URL" ]; then
    log_warn "DATABASE_URL not set. Database check skipped."
    return 1
  fi
  
  # Export for Prisma commands
  export DATABASE_URL
  
  # Try to check migration status using Prisma
  cd "$BACKEND_DIR"
  
  # Check if we can connect to the database and if migrations table exists
  # Using prisma migrate status which is safer and more reliable
  if npx prisma migrate status 2>/dev/null | grep -q "Database schema is up to date"; then
    log_info "Database is initialized and migrations are up to date"
    return 0
  elif npx prisma migrate status 2>/dev/null | grep -q "Following migrations have not yet been applied"; then
    log_info "Database exists but has pending migrations"
    return 0  # Database is initialized, just needs migrations
  else
    # If migrate status fails, database might not be initialized
    log_info "Database appears to be not initialized (first setup)"
    return 1
  fi
}

# Create .env file from template if it doesn't exist
create_env_file() {
  local env_file=$1
  local template_file=$2
  local service_name=$3
  
  if env_file_exists "$env_file"; then
    log_info "$service_name .env file already exists"
    return 0
  fi
  
  if ! env_file_exists "$template_file"; then
    log_error "Template file not found: $template_file"
    return 1
  fi
  
  log_warn "$service_name .env file not found. Creating from template..."
  cp "$template_file" "$env_file"
  log_warn "Please update $env_file with your configuration values"
  log_warn "Required environment variables must be set before continuing"
  
  # Prompt user if running interactively
  if [ -t 0 ]; then
    read -p "Press Enter after updating $env_file to continue..."
  fi
}

# =============================================================================
# Deployment Steps
# =============================================================================

# Step 1: Navigate to project root
log_info "Step 1: Navigating to project root..."
cd "$PROJECT_ROOT" || {
  log_error "Failed to navigate to project root: $PROJECT_ROOT"
  exit 1
}

# Step 2: Pull latest code (if git repo)
log_info "Step 2: Pulling latest code..."
if [ -d ".git" ]; then
  git pull origin main || git pull origin master || log_warn "Git pull failed or not a git repository"
else
  log_warn "Not a git repository. Skipping git pull."
fi

# Step 3: Create logs directory
log_info "Step 3: Creating logs directory..."
mkdir -p "$LOGS_DIR" || {
  log_error "Failed to create logs directory: $LOGS_DIR"
  exit 1
}

# Step 4: Setup backend environment
log_info "Step 4: Setting up backend environment..."
create_env_file "$BACKEND_DIR/.env" "$BACKEND_DIR/.env.example" "Backend"

# Step 5: Setup frontend environment
log_info "Step 5: Setting up frontend environment..."
create_env_file "$FRONTEND_DIR/.env.local" "$FRONTEND_DIR/.env.local.example" "Frontend"

# Step 6: Install backend dependencies
log_info "Step 6: Installing backend dependencies..."
cd "$BACKEND_DIR"
if [ "$MODE" == "production" ]; then
  npm ci --production || npm install --production
else
  npm install
fi

# Step 7: Install frontend dependencies (always install all dependencies for build)
log_info "Step 7: Installing frontend dependencies..."
cd "$FRONTEND_DIR"
npm install

# Step 8: Generate Prisma client
log_info "Step 8: Generating Prisma client..."
cd "$BACKEND_DIR"
if ! npx prisma generate; then
  log_error "Failed to generate Prisma client"
  exit 1
fi

# Step 9: Check database initialization and run migrations if needed
log_info "Step 9: Checking database initialization..."
if ! check_database_initialized; then
  log_info "Database not initialized. Running migrations (first setup)..."
  cd "$BACKEND_DIR"
  if ! npx prisma migrate deploy; then
    log_error "Failed to run database migrations"
    log_error "Please check your DATABASE_URL in .env file and ensure database is accessible"
    exit 1
  fi
  log_info "Database migrations completed successfully"
else
  log_info "Database is already initialized. Skipping migrations."
  log_warn "Note: If you need to apply new migrations, run 'npx prisma migrate deploy' manually"
fi

# Step 10: Skip backend build - always run in dev mode
log_info "Step 10: Skipping backend build (always using dev mode)"

# Step 11: Build frontend (always build for production with standalone output)
log_info "Step 11: Building frontend with standalone output..."
cd "$FRONTEND_DIR"
if ! npm run build; then
  log_error "Failed to build frontend"
  exit 1
fi

# Copy required files for standalone mode
log_info "Copying required files for standalone mode..."
# Remove existing static directory to avoid nested structure
rm -rf .next/standalone/.next/static 2>/dev/null || true
# Copy static files - must preserve the .next/static structure
mkdir -p .next/standalone/.next
if [ -d ".next/static" ]; then
  cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
fi
# Copy public folder
if [ -d "public" ]; then
  rm -rf .next/standalone/public 2>/dev/null || true
  cp -r public .next/standalone/ 2>/dev/null || true
fi
# Verify structure
if [ ! -d ".next/standalone/.next/static" ]; then
  log_warn "Warning: .next/static directory not found - static assets may not load"
fi

# Step 12: Stop existing PM2 processes
log_info "Step 12: Stopping existing PM2 processes..."
pm2 stop touchstone-backend touchstone-frontend 2>/dev/null || true
pm2 delete touchstone-backend touchstone-frontend 2>/dev/null || true

# Step 13: Start backend with PM2 (always dev mode)
log_info "Step 13: Starting backend with PM2 (dev mode)..."
pm2 start npm \
  --name "touchstone-backend" \
  --cwd "$BACKEND_DIR" \
  --log "$LOGS_DIR/backend.log" \
  --error "$LOGS_DIR/backend-error.log" \
  --time \
  -- run dev

# Step 14: Start frontend with PM2 (standalone production server)
log_info "Step 14: Starting frontend with PM2 (standalone production server)..."
# Run from the standalone directory so static files are found correctly
cd "$FRONTEND_DIR/.next/standalone"
pm2 start node \
  --name "touchstone-frontend" \
  --cwd "$FRONTEND_DIR/.next/standalone" \
  --log "$LOGS_DIR/frontend.log" \
  --error "$LOGS_DIR/frontend-error.log" \
  --time \
  -- server.js
cd "$PROJECT_ROOT"

# Step 15: Save PM2 configuration
log_info "Step 15: Saving PM2 configuration..."
pm2 save || log_warn "Failed to save PM2 configuration"

# Step 16: Show status
log_info "Step 16: PM2 Status:"
pm2 status

# =============================================================================
# Deployment Complete
# =============================================================================

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}Mode: $MODE${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Useful commands:"
echo "  pm2 status              - View process status"
echo "  pm2 logs                - View logs"
echo "  pm2 restart all         - Restart all processes"
echo "  pm2 stop all            - Stop all processes"
echo ""

