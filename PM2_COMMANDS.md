# PM2 Individual Service Commands

This guide shows how to run each service individually with PM2, without using the deploy.sh script.

## Prerequisites

Make sure you have:
- Node.js installed
- PM2 installed globally: `npm install -g pm2`
- Dependencies installed in both backend and frontend
- Environment files configured (`.env` for backend, `.env.local` for frontend)

## Directory Structure

Assuming your project structure is:
```
/your/project/path/
├── backend-express/
└── touchstone/
```

## Backend Service

### Start Backend (Dev Mode)

```bash
cd /your/project/path/backend-express
pm2 start npm \
  --name "touchstone-backend" \
  --cwd "/your/project/path/backend-express" \
  --log "/your/project/path/logs/backend.log" \
  --error "/your/project/path/logs/backend-error.log" \
  --time \
  -- run dev
```

### Start Backend (Production Mode - if you build it)

```bash
cd /your/project/path/backend-express
npm run build  # Build first
pm2 start npm \
  --name "touchstone-backend" \
  --cwd "/your/project/path/backend-express" \
  --log "/your/project/path/logs/backend.log" \
  --error "/your/project/path/logs/backend-error.log" \
  --time \
  -- start
```

## Frontend Service

### Build Frontend First (Required for Standalone Mode)

```bash
cd /your/project/path/touchstone
npm run build

# Copy required files for standalone mode
mkdir -p .next/standalone/.next/static
cp -r .next/static/* .next/standalone/.next/static/
if [ -d "public" ]; then
  cp -r public .next/standalone/
fi
```

### Start Frontend (Standalone Production Server)

**Important:** Run from the standalone directory so static files are found correctly.

```bash
cd /your/project/path/touchstone/.next/standalone
pm2 start node \
  --name "touchstone-frontend" \
  --cwd "/your/project/path/touchstone/.next/standalone" \
  --log "/your/project/path/logs/frontend.log" \
  --error "/your/project/path/logs/frontend-error.log" \
  --time \
  -- server.js
```

### Start Frontend (Dev Mode - Alternative)

```bash
cd /your/project/path/touchstone
pm2 start node \
  --name "touchstone-frontend" \
  --cwd "/your/project/path/touchstone" \
  --log "/your/project/path/logs/frontend.log" \
  --error "/your/project/path/logs/frontend-error.log" \
  --time \
  -- ./node_modules/.bin/next dev
```

## Managing Individual Services

### Stop a Service

```bash
# Stop backend
pm2 stop touchstone-backend

# Stop frontend
pm2 stop touchstone-frontend
```

### Restart a Service

```bash
# Restart backend
pm2 restart touchstone-backend

# Restart frontend
pm2 restart touchstone-frontend
```

### Delete a Service (Remove from PM2)

```bash
# Delete backend
pm2 delete touchstone-backend

# Delete frontend
pm2 delete touchstone-frontend
```

### View Logs

```bash
# View backend logs
pm2 logs touchstone-backend

# View frontend logs
pm2 logs touchstone-frontend

# View all logs
pm2 logs

# View last 100 lines
pm2 logs --lines 100
```

### View Service Status

```bash
# View specific service
pm2 show touchstone-backend
pm2 show touchstone-frontend

# View all services
pm2 status
pm2 list
```

### Monitor Services

```bash
# Real-time monitoring
pm2 monit

# Or monitor specific service
pm2 monit touchstone-backend
```

## Quick Reference Commands

### Start Both Services

```bash
# Backend
cd /your/project/path/backend-express
pm2 start npm --name "touchstone-backend" --cwd "/your/project/path/backend-express" --log "/your/project/path/logs/backend.log" --error "/your/project/path/logs/backend-error.log" --time -- run dev

# Frontend (after building)
cd /your/project/path/touchstone
npm run build
mkdir -p .next/standalone/.next/static && cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public
pm2 start node --name "touchstone-frontend" --cwd "/your/project/path/touchstone" --log "/your/project/path/logs/frontend.log" --error "/your/project/path/logs/frontend-error.log" --time -- .next/standalone/server.js
```

### Stop Both Services

```bash
pm2 stop touchstone-backend touchstone-frontend
```

### Restart Both Services

```bash
pm2 restart touchstone-backend touchstone-frontend
```

### Delete Both Services

```bash
pm2 delete touchstone-backend touchstone-frontend
```

## Save PM2 Configuration

After starting services, save the PM2 configuration so they auto-start on server reboot:

```bash
pm2 save
pm2 startup  # Follow the instructions to enable auto-start
```

## Environment-Specific Paths

Replace `/your/project/path` with your actual project path. Common examples:

- Local: `/Users/nikhil/Downloads/Touchstone`
- Server: `/home/ubuntu/x/Touchstone`
- Custom: `/var/www/touchstone`

## Troubleshooting

### Service won't start
- Check if port is already in use: `lsof -i :3000` or `lsof -i :3001`
- Check logs: `pm2 logs touchstone-backend` or `pm2 logs touchstone-frontend`
- Verify environment files exist and are configured

### Frontend build fails
- Make sure all dependencies are installed: `npm install`
- Check for build errors: `npm run build`
- Verify `.next/standalone` directory exists after build

### Backend won't start
- Check if database is accessible
- Verify `.env` file exists with correct DATABASE_URL
- Run Prisma generate: `cd backend-express && npx prisma generate`

