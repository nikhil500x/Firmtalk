#!/bin/bash

# =============================================================================
# Database Backup Script
# =============================================================================
# This script creates a full backup of the PostgreSQL database
# Usage: ./backup-db.sh [--output /path/to/backup.sql]
# Default: Creates backup in backend-express/backups/ directory
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUPS_DIR="$BACKEND_DIR/backups"

# Default output file (timestamped)
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DEFAULT_OUTPUT="$BACKUPS_DIR/backup_$TIMESTAMP.sql"
OUTPUT_FILE="$DEFAULT_OUTPUT"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --output|-o)
      OUTPUT_FILE="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [--output /path/to/backup.sql]"
      echo ""
      echo "Options:"
      echo "  --output, -o    Specify output file path"
      echo "  --help, -h      Show this help message"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# =============================================================================
# Prerequisites Check
# =============================================================================

log_info "Checking prerequisites..."

# Check if pg_dump is installed
if ! command_exists pg_dump; then
  log_error "pg_dump is not installed. Please install PostgreSQL client tools."
  log_error "On Ubuntu/Debian: sudo apt-get install postgresql-client"
  log_error "On macOS: brew install postgresql"
  exit 1
fi

log_info "pg_dump found ✓"

# Check if .env file exists
ENV_FILE="$BACKEND_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  log_error ".env file not found at $ENV_FILE"
  log_error "Please create .env file with DATABASE_URL"
  exit 1
fi

log_info ".env file found ✓"

# Load DATABASE_URL from .env
set -a
source "$ENV_FILE"
set +a

if [ -z "$DATABASE_URL" ]; then
  log_error "DATABASE_URL is not set in .env file"
  exit 1
fi

log_info "DATABASE_URL loaded ✓"

# Create backups directory if it doesn't exist
mkdir -p "$BACKUPS_DIR"

# Get absolute path for output file
OUTPUT_FILE=$(cd "$(dirname "$OUTPUT_FILE")" && pwd)/$(basename "$OUTPUT_FILE")

# =============================================================================
# Backup Database
# =============================================================================

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Database Backup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
log_info "Database: $(echo $DATABASE_URL | sed -E 's|postgresql://([^:]+):([^@]+)@([^/]+)/(.+)|Database: \4 on \3|')"
log_info "Output file: $OUTPUT_FILE"
echo ""

# Confirm if file exists
if [ -f "$OUTPUT_FILE" ]; then
  log_warn "Output file already exists: $OUTPUT_FILE"
  read -p "Overwrite? (yes/no): " -r
  if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    log_info "Backup cancelled."
    exit 0
  fi
fi

# Perform backup
log_info "Creating backup..."
log_info "This may take a while depending on database size..."

if pg_dump "$DATABASE_URL" \
  --verbose \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --format=plain \
  --file="$OUTPUT_FILE" 2>&1 | while IFS= read -r line; do
    if [[ $line =~ ^pg_dump: ]]; then
      echo "  $line"
    fi
  done; then
  log_info "Backup created successfully!"
  
  # Get file size
  FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
  log_info "Backup size: $FILE_SIZE"
  log_info "Backup location: $OUTPUT_FILE"
  
  echo ""
  echo -e "${GREEN}✅ Backup completed successfully!${NC}"
  echo ""
else
  log_error "Backup failed!"
  exit 1
fi


