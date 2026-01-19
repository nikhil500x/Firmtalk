# Docker Installation and Setup Guide for Ubuntu

This guide will help you install Docker and Docker Compose on Ubuntu, then run the Touchstone application.

## Prerequisites

- Ubuntu 20.04, 22.04, or 24.04 (LTS recommended)
- sudo/root access
- Internet connection

## Step 1: Install Docker

### Remove old versions (if any)
```bash
sudo apt-get remove docker docker-engine docker.io containerd runc
```

### Update package index
```bash
sudo apt-get update
```

### Install prerequisites
```bash
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release
```

### Add Docker's official GPG key
```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
```

### Set up Docker repository
```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

### Install Docker Engine
```bash
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### Verify Docker installation
```bash
sudo docker --version
sudo docker run hello-world
```

### Add your user to docker group (to run docker without sudo)
```bash
sudo usermod -aG docker $USER
```

**Important**: You need to log out and log back in (or run `newgrp docker`) for the group changes to take effect.

## Step 2: Install Docker Compose (Standalone - if needed)

Docker Compose is already included with Docker Desktop, but if you need the standalone version:

```bash
# Download latest version (check for latest version at https://github.com/docker/compose/releases)
DOCKER_COMPOSE_VERSION="v2.24.5"
sudo curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make it executable
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker-compose --version
```

**Note**: Modern Docker installations include `docker compose` (as a plugin, without hyphen) which works the same way. You can use either:
- `docker-compose` (standalone version)
- `docker compose` (plugin version)

Both work with the `docker-compose.yml` file.

## Step 3: Verify Installation

After logging back in (or running `newgrp docker`), verify everything works:

```bash
# Check Docker
docker --version

# Check Docker Compose (plugin version)
docker compose version

# Or check standalone version
docker-compose --version

# Test Docker without sudo
docker ps
```

## Step 4: Set Up Touchstone Application

### Navigate to project directory
```bash
cd /home/ubuntu/Touchstone
# or wherever your project is located
```

### Create environment file
```bash
# Copy example if exists, or create new
cp .env.example .env 2>/dev/null || touch .env

# Edit with your configuration
nano .env
```

### Required environment variables (minimum):
```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Session
SESSION_SECRET=your-random-secret-key-here-min-32-chars

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Backend URL for frontend
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001

# Redis (optional, uses docker service if not set)
REDIS_URL=redis://redis:6379
```

## Step 5: Build and Run the Application

### Option A: Using the quick start script
```bash
./docker-start.sh
```

### Option B: Manual steps

#### Build the Docker images
```bash
docker-compose build
```

#### Start all services
```bash
docker-compose up -d
```

#### Check service status
```bash
docker-compose ps
```

#### View logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

## Step 6: Run Database Migrations

If you need to run Prisma migrations:

```bash
# Run migrations
docker-compose exec backend npx prisma migrate deploy

# Or generate Prisma client if needed
docker-compose exec backend npx prisma generate
```

## Step 7: Access the Application

Once all services are running:

- **Frontend**: http://localhost:3000 (or your server IP:3000)
- **Backend API**: http://localhost:3001 (or your server IP:3001)
- **Health Check**: http://localhost:3001/health

## Useful Commands

### View running containers
```bash
docker-compose ps
# or
docker ps
```

### Stop services
```bash
docker-compose stop
```

### Start stopped services
```bash
docker-compose start
```

### Restart services
```bash
docker-compose restart
```

### Stop and remove containers
```bash
docker-compose down
```

### Stop and remove containers, volumes, and images
```bash
docker-compose down -v --rmi all
```

### Rebuild after code changes
```bash
docker-compose up -d --build
```

### Execute commands in containers
```bash
# Backend shell
docker-compose exec backend sh

# Frontend shell
docker-compose exec frontend sh
```

### View resource usage
```bash
docker stats
```

## Troubleshooting

### Permission denied errors
If you get permission errors, make sure you've:
1. Added your user to the docker group: `sudo usermod -aG docker $USER`
2. Logged out and logged back in
3. Or run: `newgrp docker`

### Port already in use
If ports 3000 or 3001 are already in use:
```bash
# Find what's using the port
sudo lsof -i :3000
sudo lsof -i :3001

# Stop the process or change ports in docker-compose.yml
```

### Services not starting
Check logs for errors:
```bash
docker-compose logs backend
docker-compose logs frontend
```

### Clean up Docker resources
```bash
# Remove unused containers, networks, images
docker system prune

# Remove everything (including volumes - BE CAREFUL!)
docker system prune -a --volumes
```

### Rebuild from scratch
```bash
# Stop everything
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Rebuild
docker-compose build --no-cache

# Start
docker-compose up -d
```

## Production Deployment

For production deployment on a server:

1. **Update environment variables** in `.env` with production values
2. **Use a reverse proxy** (nginx/traefik) in front of Docker containers
3. **Set up SSL certificates** (Let's Encrypt)
4. **Configure firewall** rules
5. **Set up monitoring** and logging
6. **Use Docker secrets** for sensitive data (instead of .env files)

### Example nginx configuration
```nginx
upstream frontend {
    server localhost:3000;
}

upstream backend {
    server localhost:3001;
}

server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Next Steps

- Read `DOCKER_SETUP.md` for more detailed Docker configuration
- Set up CI/CD pipelines
- Configure logging and monitoring
- Set up backup strategies for databases
- Configure auto-restart policies

