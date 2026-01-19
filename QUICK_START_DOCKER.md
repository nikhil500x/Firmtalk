# Quick Start Guide - Docker on Ubuntu

## TL;DR - Quick Installation and Run

### 1. Install Docker (one command)
```bash
bash install-docker.sh
```

After installation, **log out and log back in** (or run `newgrp docker`)

### 2. Verify Installation
```bash
docker --version
docker compose version
```

### 3. Set Up Environment
```bash
cd /home/ubuntu/Touchstone
cp .env.example .env  # or create .env manually
nano .env  # Edit with your configuration
```

Minimum required in `.env`:
```env
DATABASE_URL=postgresql://user:password@host:5432/database
SESSION_SECRET=your-random-secret-key-min-32-chars
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 4. Build and Run
```bash
docker-compose up -d --build
```

### 5. Check Status
```bash
docker-compose ps
docker-compose logs -f
```

### 6. Access Application
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

---

## Detailed Steps

### Full Installation Process

1. **Run installation script**:
   ```bash
   bash install-docker.sh
   ```

2. **Log out and log back in** (or run `newgrp docker`)

3. **Navigate to project**:
   ```bash
   cd /home/ubuntu/Touchstone
   ```

4. **Create .env file**:
   ```bash
   nano .env
   ```
   
   Add your configuration (see environment variables above)

5. **Build images**:
   ```bash
   docker-compose build
   ```

6. **Start services**:
   ```bash
   docker-compose up -d
   ```

7. **Run migrations** (if needed):
   ```bash
   docker-compose exec backend npx prisma migrate deploy
   ```

8. **View logs**:
   ```bash
   docker-compose logs -f
   ```

---

## Common Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose stop

# Restart services
docker-compose restart

# View logs
docker-compose logs -f

# Rebuild after code changes
docker-compose up -d --build

# Stop and remove everything
docker-compose down

# View running containers
docker-compose ps
```

---

## Troubleshooting

### Permission denied?
```bash
# Make sure you're in docker group
groups | grep docker

# If not, add yourself (then log out/in)
sudo usermod -aG docker $USER
newgrp docker
```

### Port already in use?
```bash
# Check what's using the port
sudo lsof -i :3000
sudo lsof -i :3001

# Stop the service or change port in docker-compose.yml
```

### Services not starting?
```bash
# Check logs
docker-compose logs backend
docker-compose logs frontend

# Check status
docker-compose ps
```

### Clean rebuild?
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

---

For more details, see:
- `DOCKER_INSTALL_UBUNTU.md` - Detailed installation guide
- `DOCKER_SETUP.md` - Docker configuration details

