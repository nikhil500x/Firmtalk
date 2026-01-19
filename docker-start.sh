#!/bin/bash

# Touchstone Docker Quick Start Script

set -e

echo "=========================================="
echo "Touchstone Docker Setup"
echo "=========================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Creating .env from example (if exists)..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Created .env file from .env.example"
        echo "⚠️  Please edit .env with your configuration before continuing"
    else
        echo "❌ No .env.example found. Please create .env file manually."
        exit 1
    fi
fi

# Build and start services
echo ""
echo "Building Docker images..."
docker-compose build

echo ""
echo "Starting services..."
docker-compose up -d

echo ""
echo "Waiting for services to be healthy..."
sleep 10

# Check service status
echo ""
echo "Service status:"
docker-compose ps

echo ""
echo "=========================================="
echo "✅ Services started!"
echo "=========================================="
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:3001"
echo ""
echo "View logs: docker-compose logs -f"
echo "Stop services: docker-compose down"
echo "=========================================="

