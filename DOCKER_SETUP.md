# Docker Setup Guide

This guide explains how to run the Touchstone application using Docker and Docker Compose.

## Prerequisites

- Docker Engine 20.10+ installed
- Docker Compose 2.0+ installed
- Git (to clone the repository)

## Quick Start

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone <repository-url>
   cd Touchstone
   ```

2. **Create environment file**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Build and start all services**:
   ```bash
   docker-compose up -d
   ```

4. **View logs**:
   ```bash
   # All services
   docker-compose logs -f
   
   # Specific service
   docker-compose logs -f backend
   docker-compose logs -f frontend
   ```

5. **Stop services**:
   ```bash
   docker-compose down
   ```

## Environment Variables

Create a `.env` file in the project root with the following variables:

### Backend (.env)
```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Redis (optional, defaults to redis service in docker-compose)
REDIS_URL=redis://redis:6379

# Session
SESSION_SECRET=your-secret-key-here

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Email (SendGrid)
SENDGRID_API_KEY=your-sendgrid-api-key

# AWS S3 (if using file uploads)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name

# Azure AD
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_TENANT_ID=your-tenant-id
AZURE_REDIRECT_URI=http://localhost:3001/api/azure/callback
```

### Frontend (.env)
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Services

### Backend (Express API)
- **Port**: 3001
- **Health Check**: http://localhost:3001/health
- **Dockerfile**: `backend-express/Dockerfile`

### Frontend (Next.js)
- **Port**: 3000
- **Health Check**: http://localhost:3000
- **Dockerfile**: `touchstone/Dockerfile`

### Redis (Session Store)
- **Port**: 6379
- Used for session storage

## Building

### Build all services:
```bash
docker-compose build
```

### Build specific service:
```bash
docker-compose build backend
docker-compose build frontend
```

### Build without cache:
```bash
docker-compose build --no-cache
```

## Running

### Start in detached mode (background):
```bash
docker-compose up -d
```

### Start with logs visible:
```bash
docker-compose up
```

### Restart a specific service:
```bash
docker-compose restart backend
docker-compose restart frontend
```

### Stop services:
```bash
docker-compose stop
```

### Stop and remove containers:
```bash
docker-compose down
```

### Stop and remove containers, volumes, and images:
```bash
docker-compose down -v --rmi all
```

## Development vs Production

### Development

For development, you may want to mount volumes for hot-reloading:

```yaml
# Add to docker-compose.yml under backend service:
volumes:
  - ./backend-express:/app
  - /app/node_modules

# Add to docker-compose.yml under frontend service:
volumes:
  - ./touchstone:/app
  - /app/node_modules
  - /app/.next
```

**Note**: For production, the current setup uses built images without volume mounts for better performance and security.

## Troubleshooting

### Check service status:
```bash
docker-compose ps
```

### View logs:
```bash
docker-compose logs backend
docker-compose logs frontend
```

### Execute commands in container:
```bash
# Backend
docker-compose exec backend sh

# Frontend
docker-compose exec frontend sh
```

### Rebuild after code changes:
```bash
docker-compose up -d --build
```

### Database migrations (if using local postgres):
```bash
docker-compose exec backend npx prisma migrate deploy
```

## Production Deployment

For production deployment:

1. **Update environment variables** in `.env` with production values
2. **Build images**:
   ```bash
   docker-compose build --no-cache
   ```
3. **Tag and push to registry** (if using a registry):
   ```bash
   docker tag touchstone-backend:latest your-registry/touchstone-backend:latest
   docker tag touchstone-frontend:latest your-registry/touchstone-frontend:latest
   docker push your-registry/touchstone-backend:latest
   docker push your-registry/touchstone-frontend:latest
   ```

4. **Use a reverse proxy** (nginx/traefik) in front of the containers

## Using with External Database

If you're using an external PostgreSQL database (like Supabase, AWS RDS, etc.):

1. Remove the `postgres` service from `docker-compose.yml`
2. Set `DATABASE_URL` in `.env` to point to your external database
3. Run migrations manually:
   ```bash
   docker-compose exec backend npx prisma migrate deploy
   ```

## Benefits of Docker

1. **Consistency**: Same environment across development, staging, and production
2. **Isolation**: No conflicts with system dependencies
3. **Portability**: Run anywhere Docker is installed
4. **Easy scaling**: Scale services independently
5. **Simplified deployment**: One command to deploy entire stack

