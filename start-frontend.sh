#!/bin/bash

# Start Frontend Service with PM2 (Standalone Production Server)
# Usage: ./start-frontend.sh

set -e

# Configuration - UPDATE THESE PATHS
PROJECT_ROOT="/Users/nikhil/Downloads/Touchstone"
FRONTEND_DIR="$PROJECT_ROOT/touchstone"
LOGS_DIR="$PROJECT_ROOT/logs"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Frontend Service...${NC}"

# Create logs directory if it doesn't exist
mkdir -p "$LOGS_DIR"

# Check if build exists
if [ ! -f "$FRONTEND_DIR/.next/standalone/server.js" ]; then
  echo -e "${YELLOW}Build not found. Building frontend...${NC}"
  cd "$FRONTEND_DIR"
  npm run build
  
  # Copy required files for standalone mode
  echo -e "${YELLOW}Copying required files for standalone mode...${NC}"
  # Copy static files - must preserve the .next/static structure
  mkdir -p .next/standalone/.next/static
  cp -r .next/static/* .next/standalone/.next/static/ 2>/dev/null || true
  # Copy public folder
  if [ -d "public" ]; then
    cp -r public .next/standalone/ 2>/dev/null || true
  fi
  # Verify structure
  cd .next/standalone
  if [ ! -d ".next/static" ] || [ ! -d "public" ]; then
    echo -e "${RED}Failed to copy required files for standalone mode${NC}"
    exit 1
  fi
  cd "$FRONTEND_DIR"
fi

# Stop existing frontend if running
pm2 stop touchstone-frontend 2>/dev/null || true
pm2 delete touchstone-frontend 2>/dev/null || true

# Start frontend - run from standalone directory
cd "$FRONTEND_DIR/.next/standalone"
pm2 start node \
  --name "touchstone-frontend" \
  --cwd "$FRONTEND_DIR/.next/standalone" \
  --log "$LOGS_DIR/frontend.log" \
  --error "$LOGS_DIR/frontend-error.log" \
  --time \
  -- server.js

# Save PM2 configuration
pm2 save

echo -e "${GREEN}Frontend started successfully!${NC}"
echo -e "${YELLOW}View logs: pm2 logs touchstone-frontend${NC}"
echo -e "${YELLOW}View status: pm2 status${NC}"

