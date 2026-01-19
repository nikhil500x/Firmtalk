#!/bin/bash

# Stop Backend Service
# Usage: ./stop-backend.sh

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Stopping Backend Service...${NC}"
pm2 stop touchstone-backend
pm2 save
echo -e "${GREEN}Backend stopped!${NC}"

