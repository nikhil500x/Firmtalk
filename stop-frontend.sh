#!/bin/bash

# Stop Frontend Service
# Usage: ./stop-frontend.sh

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Stopping Frontend Service...${NC}"
pm2 stop touchstone-frontend
pm2 save
echo -e "${GREEN}Frontend stopped!${NC}"

