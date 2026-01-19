#!/bin/bash

# Fix Standalone Build Structure
# This script ensures all required files are properly copied for standalone mode
# Usage: ./fix-standalone-build.sh

set -e

# Configuration
PROJECT_ROOT="/Users/nikhil/Downloads/Touchstone"
FRONTEND_DIR="$PROJECT_ROOT/touchstone"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Fixing standalone build structure...${NC}"

cd "$FRONTEND_DIR"

# Check if build exists
if [ ! -d ".next/standalone" ]; then
  echo -e "${RED}Standalone build not found. Please run 'npm run build' first.${NC}"
  exit 1
fi

# Stop frontend if running
pm2 stop touchstone-frontend 2>/dev/null || true

echo -e "${YELLOW}Copying static files...${NC}"

# Ensure directories exist
mkdir -p .next/standalone/.next/static

# Copy static files - use rsync if available for better handling, otherwise cp
if command -v rsync &> /dev/null; then
  rsync -av .next/static/ .next/standalone/.next/static/ 2>/dev/null || true
else
  cp -r .next/static/* .next/standalone/.next/static/ 2>/dev/null || true
fi

# Copy public folder
if [ -d "public" ]; then
  echo -e "${YELLOW}Copying public files...${NC}"
  if command -v rsync &> /dev/null; then
    rsync -av public/ .next/standalone/public/ 2>/dev/null || true
  else
    cp -r public .next/standalone/ 2>/dev/null || true
  fi
fi

# Verify structure
cd .next/standalone

echo -e "${YELLOW}Verifying structure...${NC}"

if [ ! -f "server.js" ]; then
  echo -e "${RED}Error: server.js not found in standalone directory${NC}"
  exit 1
fi

if [ ! -d ".next/static" ]; then
  echo -e "${RED}Error: .next/static directory not found${NC}"
  exit 1
fi

if [ ! -d "public" ]; then
  echo -e "${YELLOW}Warning: public directory not found (may be okay if no public assets)${NC}"
fi

echo -e "${GREEN}Standalone build structure verified!${NC}"
echo -e "${GREEN}You can now start the frontend with:${NC}"
echo -e "${YELLOW}cd $FRONTEND_DIR/.next/standalone${NC}"
echo -e "${YELLOW}pm2 start node --name touchstone-frontend --cwd \"$FRONTEND_DIR/.next/standalone\" -- server.js${NC}"

