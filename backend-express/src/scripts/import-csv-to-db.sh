#!/bin/bash

# =============================================================================
# Database Tables CSV Import Script
# =============================================================================
# This script imports CSV files from a directory back into the database
# Usage: ./import-csv-to-db.sh [--input /path/to/csv] [--truncate]
# Default: Imports from backend-express/csv/ directory
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

# Default input directory
DEFAULT_INPUT="$BACKEND_DIR/csv"
INPUT_DIR="$DEFAULT_INPUT"
TRUNCATE_TABLES=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --input|-i)
      INPUT_DIR="$2"
      shift 2
      ;;
    --truncate|-t)
      TRUNCATE_TABLES=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--input /path/to/csv] [--truncate]"
      echo ""
      echo "Options:"
      echo "  --input, -i     Specify input CSV directory (default: backend-express/csv)"
      echo "  --truncate, -t  Truncate tables before importing (clears existing data)"
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

# Check if psql is installed
if ! command_exists psql; then
  log_error "psql is not installed. Please install PostgreSQL client tools."
  log_error "On Ubuntu/Debian: sudo apt-get install postgresql-client"
  log_error "On macOS: brew install postgresql"
  exit 1
fi

log_info "psql found ✓"

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

# Check if input directory exists
if [ ! -d "$INPUT_DIR" ]; then
  log_error "Input directory not found: $INPUT_DIR"
  exit 1
fi

log_info "Input directory found ✓"

# Get absolute path for input directory
INPUT_DIR=$(cd "$INPUT_DIR" && pwd)

# =============================================================================
# Import CSV Files
# =============================================================================

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Database Tables CSV Import${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
log_info "Database: $(echo $DATABASE_URL | sed -E 's|postgresql://([^:]+):([^@]+)@([^/]+)/(.+)|Database: \4 on \3|')"
log_info "Input directory: $INPUT_DIR"
if [ "$TRUNCATE_TABLES" = true ]; then
  log_warn "TRUNCATE mode: Existing data will be deleted before import"
fi
echo ""

# Parse DATABASE_URL to extract connection details
# Handle query parameters by removing them first
DB_URL_CLEAN=$(echo "$DATABASE_URL" | sed 's/?.*$//')
DB_URL_REGEX="postgresql://([^:]+):([^@]+)@([^/:]+):?([0-9]*)/(.+)"
if [[ $DB_URL_CLEAN =~ $DB_URL_REGEX ]]; then
  DB_USER="${BASH_REMATCH[1]}"
  DB_PASS="${BASH_REMATCH[2]}"
  DB_HOST="${BASH_REMATCH[3]}"
  DB_PORT="${BASH_REMATCH[4]:-5432}"
  DB_NAME="${BASH_REMATCH[5]}"
else
  log_error "Failed to parse DATABASE_URL"
  log_error "URL format: $DATABASE_URL"
  exit 1
fi

# Set PGPASSWORD environment variable for psql
export PGPASSWORD="$DB_PASS"

# Find all CSV files in the input directory
CSV_FILES=$(find "$INPUT_DIR" -maxdepth 1 -name "*.csv" -type f | sort)

if [ -z "$CSV_FILES" ]; then
  log_warn "No CSV files found in $INPUT_DIR"
  exit 0
fi

# Count CSV files
CSV_COUNT=$(echo "$CSV_FILES" | grep -v '^$' | wc -l | tr -d ' ')
log_info "Found $CSV_COUNT CSV files to import"
echo ""

# Confirmation prompt
if [ "$TRUNCATE_TABLES" = true ]; then
  log_warn "WARNING: This will DELETE all existing data in the tables before importing!"
  read -p "Are you sure you want to continue? (yes/no): " -r
  if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    log_info "Import cancelled."
    unset PGPASSWORD
    exit 0
  fi
  echo ""
fi

# Import each CSV file
IMPORTED=0
FAILED=0
SKIPPED=0

while IFS= read -r CSV_FILE; do
  # Skip empty lines
  [ -z "$CSV_FILE" ] && continue
  
  # Get table name from filename (remove path and .csv extension)
  TABLE_NAME=$(basename "$CSV_FILE" .csv)
  
  # Skip _prisma_migrations table (system table)
  if [ "$TABLE_NAME" = "_prisma_migrations" ]; then
    log_warn "Skipping system table: $TABLE_NAME"
    ((SKIPPED++))
    continue
  fi
  
  log_info "Importing table: $TABLE_NAME"
  
  # Check if table exists
  TABLE_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = '$TABLE_NAME'
    );
  " | xargs)
  
  if [ "$TABLE_EXISTS" != "t" ]; then
    log_error "  ✗ Table '$TABLE_NAME' does not exist in database"
    ((FAILED++))
    continue
  fi
  
  # Truncate table if requested
  if [ "$TRUNCATE_TABLES" = true ]; then
    log_info "  Truncating table..."
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "TRUNCATE TABLE \"$TABLE_NAME\" CASCADE;" >/dev/null 2>&1; then
      log_error "  ✗ Failed to truncate table $TABLE_NAME"
      ((FAILED++))
      continue
    fi
  fi
  
  # Get row count before import
  ROW_COUNT_BEFORE=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM \"$TABLE_NAME\";" | xargs)
  
  # Import CSV file using COPY command
  if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\COPY \"$TABLE_NAME\" FROM '$CSV_FILE' WITH (FORMAT CSV, HEADER true, DELIMITER ',', ENCODING 'UTF8');" >/dev/null 2>&1; then
    # Get row count after import
    ROW_COUNT_AFTER=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM \"$TABLE_NAME\";" | xargs)
    ROWS_IMPORTED=$((ROW_COUNT_AFTER - ROW_COUNT_BEFORE))
    log_info "  ✓ Imported $ROWS_IMPORTED rows (Total: $ROW_COUNT_AFTER)"
    ((IMPORTED++))
  else
    log_error "  ✗ Failed to import $TABLE_NAME"
    ((FAILED++))
  fi
done <<< "$CSV_FILES"

# Unset PGPASSWORD
unset PGPASSWORD

# =============================================================================
# Summary
# =============================================================================

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Import Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
log_info "Tables imported: $IMPORTED"
if [ $SKIPPED -gt 0 ]; then
  log_warn "Tables skipped: $SKIPPED"
fi
if [ $FAILED -gt 0 ]; then
  log_error "Tables failed: $FAILED"
fi

echo ""
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ CSV import completed successfully!${NC}"
else
  echo -e "${YELLOW}⚠️  CSV import completed with $FAILED error(s)${NC}"
fi
echo ""

