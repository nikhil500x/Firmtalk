#!/bin/bash

# Docker and Docker Compose Installation Script for Ubuntu
# Run with: bash install-docker.sh

set -e

echo "=========================================="
echo "Docker & Docker Compose Installation"
echo "=========================================="

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo "⚠️  Please do not run as root. The script will use sudo when needed."
   exit 1
fi

# Update package index
echo ""
echo "📦 Updating package index..."
sudo apt-get update

# Install prerequisites
echo ""
echo "📦 Installing prerequisites..."
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's official GPG key
echo ""
echo "🔑 Adding Docker's GPG key..."
sudo install -m 0755 -d /etc/apt/keyrings
if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
fi

# Set up Docker repository
echo ""
echo "📋 Setting up Docker repository..."
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
echo ""
echo "📦 Installing Docker Engine..."
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add user to docker group
echo ""
echo "👤 Adding $USER to docker group..."
sudo usermod -aG docker $USER

# Verify Docker installation
echo ""
echo "✅ Verifying Docker installation..."
sudo docker --version
sudo docker run hello-world

echo ""
echo "=========================================="
echo "✅ Docker installed successfully!"
echo "=========================================="
echo ""
echo "⚠️  IMPORTANT: You need to log out and log back in"
echo "   (or run 'newgrp docker') for group changes to take effect."
echo ""
echo "After logging back in, verify with:"
echo "  docker --version"
echo "  docker compose version"
echo "  docker ps"
echo ""
echo "Then you can run the Touchstone application with:"
echo "  cd /path/to/Touchstone"
echo "  ./docker-start.sh"
echo "  # or"
echo "  docker-compose up -d --build"
echo ""
echo "=========================================="

