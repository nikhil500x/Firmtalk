#!/bin/bash
# Build script for Firmtalk deployment
# Run this locally before committing to trigger deployment

set -e

echo "==================================="
echo "Building Firmtalk for Deployment"
echo "==================================="

# Navigate to frontend directory
cd "$(dirname "$0")/touchstone"

echo ""
echo "[1/4] Installing dependencies..."
npm ci

echo ""
echo "[2/4] Building Next.js standalone..."
npm run build

echo ""
echo "[3/4] Verifying build output..."
if [ -d ".next/standalone" ]; then
    echo "✓ Standalone build created successfully"
else
    echo "✗ Error: Standalone build not found!"
    exit 1
fi

if [ -d ".next/static" ]; then
    echo "✓ Static files generated"
else
    echo "✗ Error: Static files not found!"
    exit 1
fi

echo ""
echo "[4/4] Build complete!"
echo ""
echo "==================================="
echo "Next Steps:"
echo "==================================="
echo "1. Review changes: git status"
echo "2. Add build files: git add touchstone/.next/standalone touchstone/.next/static"
echo "3. Commit: git commit -m 'Build: Update frontend for deployment'"
echo "4. Push to main: git push origin main"
echo ""
echo "GitHub Actions will automatically deploy to production."
echo "==================================="
