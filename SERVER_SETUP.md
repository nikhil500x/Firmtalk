# Firmtalk Server Setup Guide

## Server Details
- **IP**: 3.110.145.31
- **User**: ubuntu
- **Domain**: firmtalk.ai
- **Project Root**: /home/ubuntu/Touchstone

---

## First-Time Server Setup Checklist

### 1. Update System & Install Prerequisites

```bash
# Update system packages
apt update && apt upgrade -y

# Install essential tools
apt install -y curl wget git build-essential
```

### 2. Install Node.js (Latest LTS via nvm)

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Load nvm (or restart terminal)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install Node.js LTS
nvm install --lts
nvm use --lts
nvm alias default node

# Verify installation
node -v
npm -v
```

### 3. Install PM2 Globally

```bash
npm install -g pm2

# Setup PM2 to start on boot
pm2 startup systemd
# Run the command it outputs

# Verify
pm2 -v
```

### 4. Install Nginx

```bash
# Install nginx
apt install -y nginx

# Enable and start nginx
systemctl enable nginx
systemctl start nginx

# Verify
systemctl status nginx
```

### 5. Setup SSL with Certbot (if not already done)

```bash
# Install certbot
apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
certbot --nginx -d firmtalk.ai -d www.firmtalk.ai

# Test auto-renewal
certbot renew --dry-run
```

### 6. Create Project Directory Structure

```bash
# Create project directories
mkdir -p /home/ubuntu/Touchstone/touchstone/.next/standalone
mkdir -p /home/ubuntu/Touchstone/backend-express

# Set permissions
chmod -R 755 /home/ubuntu/Touchstone
```

### 7. Configure Nginx

```bash
# Copy the nginx config (upload nginx-firmtalk.conf to server first)
# Or create it manually:
nano /etc/nginx/sites-available/firmtalk

# Enable the site
ln -sf /etc/nginx/sites-available/firmtalk /etc/nginx/sites-enabled/

# Remove default site (optional)
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

# Reload nginx
systemctl reload nginx
```

### 8. Setup Environment Files

```bash
# Create backend .env file
nano /home/ubuntu/Touchstone/backend-express/.env
```

Add your environment variables:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/firmtalk"
SESSION_SECRET="your-super-secret-key"
REDIS_URL="redis://localhost:6379"
# Add other required env vars
```

```bash
# Create frontend .env.local (if needed)
nano /home/ubuntu/Touchstone/touchstone/.next/standalone/.env.local
```

### 9. Setup PostgreSQL (if not using external DB)

```bash
# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
systemctl enable postgresql
systemctl start postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE USER firmtalk WITH PASSWORD 'your-secure-password';
CREATE DATABASE firmtalk OWNER firmtalk;
GRANT ALL PRIVILEGES ON DATABASE firmtalk TO firmtalk;
EOF
```

### 10. Setup Redis (if using sessions/caching)

```bash
# Install Redis
apt install -y redis-server

# Enable and start Redis
systemctl enable redis-server
systemctl start redis-server

# Verify
redis-cli ping
```

### 11. Initial PM2 Services Setup (After First Deploy)

```bash
# Navigate to project
cd /home/ubuntu/Touchstone

# Start backend
pm2 start backend-express/dist/server.js --name firmtalk-backend

# Start frontend (standalone)
pm2 start touchstone/.next/standalone/server.js --name firmtalk-frontend

# Save PM2 process list
pm2 save

# View logs
pm2 logs
```

### 12. Configure Firewall (UFW)

```bash
# Enable UFW
ufw enable

# Allow SSH
ufw allow 22

# Allow HTTP and HTTPS
ufw allow 80
ufw allow 443

# Check status
ufw status
```

---

## GitHub Actions Setup

### Required Secrets

Add these secrets to your GitHub repository (Settings > Secrets and variables > Actions):

| Secret Name | Description |
|-------------|-------------|
| `SSH_PRIVATE_KEY` | Your SSH private key for server access |

### Generate SSH Key (if needed)

```bash
# On your local machine
ssh-keygen -t ed25519 -C "github-actions-deploy"

# Copy public key to server
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@3.110.145.31

# Copy private key content to GitHub secret
cat ~/.ssh/id_ed25519
```

---

## Pre-Deployment Checklist

Before first deployment, ensure:

- [ ] Server is accessible via SSH
- [ ] Node.js installed
- [ ] PM2 installed globally
- [ ] Nginx installed and running
- [ ] SSL certificate obtained
- [ ] Nginx config in place
- [ ] Project directories created
- [ ] Environment files configured
- [ ] PostgreSQL running with database created
- [ ] Redis running (if needed)
- [ ] Firewall configured
- [ ] GitHub secrets configured

---

## Useful Commands

### PM2 Commands
```bash
pm2 list                    # List all processes
pm2 logs                    # View all logs
pm2 logs firmtalk-backend   # View backend logs
pm2 restart all             # Restart all services
pm2 reload all              # Zero-downtime reload
pm2 monit                   # Monitor processes
```

### Nginx Commands
```bash
nginx -t                    # Test configuration
systemctl reload nginx      # Reload config
systemctl restart nginx     # Restart nginx
tail -f /var/log/nginx/firmtalk-error.log  # View error logs
```

### Database Commands
```bash
# Run migrations manually
cd /home/ubuntu/Touchstone/backend-express
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Open Prisma Studio
npx prisma studio
```

---

## Troubleshooting

### Check Service Status
```bash
pm2 status
systemctl status nginx
systemctl status postgresql
systemctl status redis-server
```

### View Logs
```bash
pm2 logs firmtalk-backend --lines 100
pm2 logs firmtalk-frontend --lines 100
tail -f /var/log/nginx/firmtalk-error.log
```

### Restart Everything
```bash
pm2 restart all
systemctl reload nginx
```
