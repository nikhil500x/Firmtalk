#!/bin/bash

# Restart Frontend Service
# Usage: ./restart-frontend.sh

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Restarting Frontend Service...${NC}"
pm2 restart touchstone-frontend
echo -e "${GREEN}Frontend restarted!${NC}"

