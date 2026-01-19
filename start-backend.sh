#!/bin/bash

# Start Backend Service with PM2
# Usage: ./start-backend.sh

set -e

# Configuration - UPDATE THESE PATHS
PROJECT_ROOT="/Users/nikhil/Downloads/Touchstone"
BACKEND_DIR="$PROJECT_ROOT/backend-express"
LOGS_DIR="$PROJECT_ROOT/logs"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Backend Service...${NC}"

# Create logs directory if it doesn't exist
mkdir -p "$LOGS_DIR"

# Stop existing backend if running
pm2 stop touchstone-backend 2>/dev/null || true
pm2 delete touchstone-backend 2>/dev/null || true

# Start backend
cd "$BACKEND_DIR"
pm2 start npm \
  --name "touchstone-backend" \
  --cwd "$BACKEND_DIR" \
  --log "$LOGS_DIR/backend.log" \
  --error "$LOGS_DIR/backend-error.log" \
  --time \
  -- run dev

# Save PM2 configuration
pm2 save

echo -e "${GREEN}Backend started successfully!${NC}"
echo -e "${YELLOW}View logs: pm2 logs touchstone-backend${NC}"
echo -e "${YELLOW}View status: pm2 status${NC}"

