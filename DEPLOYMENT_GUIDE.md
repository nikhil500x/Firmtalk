# Touchstone Deployment Guide

## Quick Deployment (EC2 Server)

### Option 1: Complete Deployment (Recommended)
This deploys both backend and frontend with all configurations:

```bash
cd ~/Touchstone
./deploy-complete.sh --project-path /home/ubuntu/Touchstone --domain staging.touchstonepartners.com
```

### Option 2: Manual Step-by-Step Deployment

#### 1. SSH into your EC2 instance
```bash
ssh ubuntu@your-ec2-ip
```

#### 2. Navigate to project directory
```bash
cd ~/Touchstone
```

#### 3. Pull latest code (if using git)
```bash
git pull origin main
```

#### 4. Deploy Backend
```bash
cd backend-express

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations (if needed)
npx prisma migrate deploy

# Build backend (if needed)
npm run build

# Start with PM2
pm2 stop touchstone-backend 2>/dev/null || true
pm2 delete touchstone-backend 2>/dev/null || true
pm2 start npm --name "touchstone-backend" --cwd "$(pwd)" --log "../logs/backend.log" --error "../logs/backend-error.log" --time -- run dev
```

#### 5. Deploy Frontend
```bash
cd ../touchstone

# Clean previous build
rm -rf .next node_modules/.cache

# Install dependencies
npm install

# Build with memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Copy required files for standalone mode
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
cp -r public .next/standalone/ 2>/dev/null || true

# Start with PM2
pm2 stop touchstone-frontend 2>/dev/null || true
pm2 delete touchstone-frontend 2>/dev/null || true
cd .next/standalone
pm2 start node --name "touchstone-frontend" --cwd "$(pwd)" --log "../../logs/frontend.log" --error "../../logs/frontend-error.log" --time -- server.js
```

#### 6. Save PM2 configuration
```bash
pm2 save
pm2 status
```

## Troubleshooting

### If build fails with "Bus error":
1. Add swap space:
```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

2. Check memory:
```bash
free -h
```

### View logs:
```bash
# All logs
pm2 logs

# Backend only
pm2 logs touchstone-backend

# Frontend only
pm2 logs touchstone-frontend

# Or check log files
tail -f ~/Touchstone/logs/backend.log
tail -f ~/Touchstone/logs/frontend.log
```

### Restart services:
```bash
pm2 restart all
# or individually
pm2 restart touchstone-backend
pm2 restart touchstone-frontend
```

### Stop services:
```bash
pm2 stop all
```

### Check service status:
```bash
pm2 status
pm2 info touchstone-backend
pm2 info touchstone-frontend
```

## Environment Variables

Make sure these are set in `backend-express/.env`:
- `DATABASE_URL`
- `SESSION_SECRET`
- `FRONTEND_URL`
- `AWS_REGION` (for S3)
- `AWS_S3_BUCKET_NAME` (for S3)
- `AWS_ACCESS_KEY_ID` (if not using IAM role)
- `AWS_SECRET_ACCESS_KEY` (if not using IAM role)

## Ports

- Backend: `http://localhost:3001`
- Frontend: `http://localhost:3000`
- Public: `https://staging.touchstonepartners.com`

## Nginx Configuration

The deployment script automatically configures nginx. To manually reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

