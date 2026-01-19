#!/bin/bash

# Restart Backend Service
# Usage: ./restart-backend.sh

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Restarting Backend Service...${NC}"
pm2 restart touchstone-backend
echo -e "${GREEN}Backend restarted!${NC}"

