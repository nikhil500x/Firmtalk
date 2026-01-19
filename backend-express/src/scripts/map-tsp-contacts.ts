#!/usr/bin/env tsx

/**
 * TSP Contact ID Mapping Script
 * 
 * This script maps old user IDs to new user IDs and updates the TSP Contact column (H)
 * in an Excel/Numbers file after a database reset.
 * 
 * Usage:
 *   tsx src/scripts/map-tsp-contacts.ts <old-users.csv> <new-users.csv> <excel-file> [--output <output-file>]
 * 
 * Example:
 *   tsx src/scripts/map-tsp-contacts.ts old_users.csv new_users.csv Main_sheet.numbers --output Main_sheet_new.xlsx
 */

import * as fs from 'fs';
import * as path from 'path';
import XLSX from 'xlsx';

interface User {
  user_id: number;
  email: string;
  name?: string;
  user_code?: string;
}

interface IDMapping {
  oldId: number;
  newId: number;
  email: string;
  name?: string;
}

// Simple CSV parser that handles quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  result.push(current.trim());
  return result;
}

// Parse CSV file and extract users
function parseUsersCSV(filePath: string): User[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r\n|\n|\r/).filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error(`CSV file must have at least a header and one data row: ${filePath}`);
  }
  
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const userIdIndex = headers.indexOf('user_id');
  const emailIndex = headers.indexOf('email');
  const nameIndex = headers.indexOf('name');
  const userCodeIndex = headers.indexOf('user_code');
  
  if (userIdIndex === -1 || emailIndex === -1) {
    throw new Error(`CSV file must have 'user_id' and 'email' columns: ${filePath}`);
  }
  
  const users: User[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, ''));
    if (values.length < Math.max(userIdIndex, emailIndex) + 1) continue;
    
    const userId = parseInt(values[userIdIndex]);
    const email = values[emailIndex];
    
    if (isNaN(userId) || !email) continue;
    
    users.push({
      user_id: userId,
      email: email,
      name: nameIndex !== -1 ? values[nameIndex] : undefined,
      user_code: userCodeIndex !== -1 ? values[userCodeIndex] : undefined,
    });
  }
  
  return users;
}

// Create mapping from old IDs to new IDs based on email
function createIDMapping(oldUsers: User[], newUsers: User[]): Map<number, number> {
  const mapping = new Map<number, number>();
  const newUsersByEmail = new Map<string, User>();
  
  // Index new users by email
  for (const user of newUsers) {
    const emailKey = user.email.toLowerCase().trim();
    if (!newUsersByEmail.has(emailKey)) {
      newUsersByEmail.set(emailKey, user);
    }
  }
  
  // Map old IDs to new IDs
  const unmapped: IDMapping[] = [];
  for (const oldUser of oldUsers) {
    const emailKey = oldUser.email.toLowerCase().trim();
    const newUser = newUsersByEmail.get(emailKey);
    
    if (newUser) {
      mapping.set(oldUser.user_id, newUser.user_id);
    } else {
      unmapped.push({
        oldId: oldUser.user_id,
        newId: -1,
        email: oldUser.email,
        name: oldUser.name,
      });
    }
  }
  
  if (unmapped.length > 0) {
    console.warn(`\n⚠️  Warning: ${unmapped.length} users could not be mapped:`);
    unmapped.forEach(u => {
      console.warn(`  - Old ID ${u.oldId} (${u.email}${u.name ? ` - ${u.name}` : ''})`);
    });
    console.warn('');
  }
  
  return mapping;
}

// Parse TSP Contact value (handles formats like "18", "18/20", "18/20/25")
function parseTSPContact(value: string | number | undefined): number[] {
  if (!value) return [];
  const str = String(value).trim();
  if (!str || str === '') return [];
  
  return str
    .split('/')
    .map(id => parseInt(id.trim()))
    .filter(id => !isNaN(id) && id > 0);
}

// Convert array of IDs back to TSP Contact format
function formatTSPContact(ids: number[]): string {
  if (ids.length === 0) return '';
  return ids.join('/');
}

// Update TSP Contact values in Excel file (Column H, index 7)
async function updateExcelFile(
  excelPath: string,
  idMapping: Map<number, number>,
  outputPath: string
): Promise<void> {
  console.log(`\n📖 Reading file: ${excelPath}`);
  
  // Read the file
  const buffer = fs.readFileSync(excelPath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  if (!worksheet) {
    throw new Error(`Worksheet "${sheetName}" not found`);
  }
  
  // Get the range of the worksheet
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  const maxRow = range.e.r;
  const maxCol = range.e.c;
  
  console.log(`✓ Found worksheet "${sheetName}" with ${maxRow + 1} rows and ${maxCol + 1} columns`);
  
  // Column H is index 7 (A=0, B=1, ..., H=7)
  const TSP_CONTACT_COLUMN = 7;
  
  // Check if column H exists
  if (TSP_CONTACT_COLUMN > maxCol) {
    throw new Error(`Column H (index ${TSP_CONTACT_COLUMN}) does not exist in the file`);
  }
  
  // Read header row to verify column name
  const headerCell = XLSX.utils.encode_cell({ r: 0, c: TSP_CONTACT_COLUMN });
  const headerValue = worksheet[headerCell] ? String(worksheet[headerCell].v || '').trim() : '';
  
  console.log(`✓ Column H header: "${headerValue}"`);
  
  // Update TSP Contact values in column H (skip header row, start from row 1)
  let updatedCount = 0;
  let totalRows = 0;
  const unmappedIds: Set<number> = new Set();
  
  for (let row = 1; row <= maxRow; row++) {
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: TSP_CONTACT_COLUMN });
    const cell = worksheet[cellAddress];
    
    if (!cell || !cell.v) continue;
    
    totalRows++;
    const tspContactValue = String(cell.v).trim();
    if (!tspContactValue) continue;
    
    // Parse old IDs (handles formats like "18", "18/20", "18/20/25")
    const oldIds = parseTSPContact(tspContactValue);
    if (oldIds.length === 0) continue;
    
    // Map old IDs to new IDs
    const newIds: number[] = [];
    let hasChanges = false;
    
    for (const oldId of oldIds) {
      const newId = idMapping.get(oldId);
      if (newId) {
        newIds.push(newId);
        if (newId !== oldId) {
          hasChanges = true;
        }
      } else {
        // Keep old ID if mapping not found (with warning)
        newIds.push(oldId);
        unmappedIds.add(oldId);
      }
    }
    
    // Update the cell if there were changes
    if (hasChanges || newIds.length !== oldIds.length) {
      const newValue = formatTSPContact(newIds);
      worksheet[cellAddress] = { t: 's', v: newValue };
      updatedCount++;
    }
  }
  
  // Show warnings for unmapped IDs
  if (unmappedIds.size > 0) {
    console.warn(`\n⚠️  Warning: Found ${unmappedIds.size} unmapped old IDs in TSP Contact column:`);
    Array.from(unmappedIds).sort((a, b) => a - b).forEach(id => {
      console.warn(`  - Old ID ${id} (kept as-is in output)`);
    });
  }
  
  console.log(`\n📊 Update Summary:`);
  console.log(`   Total rows with TSP Contact values: ${totalRows}`);
  console.log(`   Rows updated: ${updatedCount}`);
  
  // Write updated file
  console.log(`\n💾 Writing new file: ${outputPath}`);
  
  // Determine output format based on extension
  const ext = path.extname(outputPath).toLowerCase();
  let writeOptions: XLSX.WritingOptions = {};
  
  if (ext === '.xlsx') {
    writeOptions = { bookType: 'xlsx', type: 'buffer' };
  } else if (ext === '.xls') {
    writeOptions = { bookType: 'xls', type: 'buffer' };
  } else if (ext === '.csv') {
    writeOptions = { bookType: 'csv', type: 'buffer' };
  } else {
    // Default to xlsx
    writeOptions = { bookType: 'xlsx', type: 'buffer' };
  }
  
  XLSX.writeFile(workbook, outputPath, writeOptions);
  console.log(`✅ Successfully created new file with updated TSP Contact values!`);
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 3 || args.includes('--help') || args.includes('-h')) {
    console.log(`
TSP Contact ID Mapping Script

Usage:
  tsx src/scripts/map-tsp-contacts.ts <old-users.csv> <new-users.csv> <excel-file> [--output <output-file>]

Arguments:
  old-users.csv    Path to CSV file with old user data (must have user_id and email columns)
  new-users.csv    Path to CSV file with new user data (must have user_id and email columns)
  excel-file       Path to Excel/Numbers file to read (must have "TSP Contact" in column H)
  --output, -o     Output file path (default: adds "_new" before extension, saves as .xlsx)

Example:
  tsx src/scripts/map-tsp-contacts.ts old_users.csv new_users.csv Main_sheet.numbers --output Main_sheet_new.xlsx

The script will:
1. Match users between old and new CSVs by email address
2. Create a mapping from old user_id to new user_id
3. Update all "TSP Contact" values in column H (handles formats like "18" or "18/20")
4. Create a new file with updated values
`);
    process.exit(0);
  }
  
  const oldUsersPath = args[0];
  const newUsersPath = args[1];
  const excelPath = args[2];
  
  let outputPath: string | undefined;
  const outputIndex = args.indexOf('--output');
  if (outputIndex !== -1 && args[outputIndex + 1]) {
    outputPath = args[outputIndex + 1];
  } else {
    const outputIndexShort = args.indexOf('-o');
    if (outputIndexShort !== -1 && args[outputIndexShort + 1]) {
      outputPath = args[outputIndexShort + 1];
    }
  }
  
  // Default output path if not provided
  if (!outputPath) {
    const ext = path.extname(excelPath);
    const baseName = path.basename(excelPath, ext);
    const dir = path.dirname(excelPath);
    outputPath = path.join(dir, `${baseName}_new.xlsx`);
  }
  
  // Validate files exist
  if (!fs.existsSync(oldUsersPath)) {
    console.error(`❌ Error: Old users file not found: ${oldUsersPath}`);
    process.exit(1);
  }
  
  if (!fs.existsSync(newUsersPath)) {
    console.error(`❌ Error: New users file not found: ${newUsersPath}`);
    process.exit(1);
  }
  
  if (!fs.existsSync(excelPath)) {
    console.error(`❌ Error: Excel file not found: ${excelPath}`);
    process.exit(1);
  }
  
  try {
    console.log('🔄 TSP Contact ID Mapping Script\n');
    console.log('='.repeat(50));
    
    // Parse user files
    console.log(`\n📖 Reading old users: ${oldUsersPath}`);
    const oldUsers = parseUsersCSV(oldUsersPath);
    console.log(`✓ Found ${oldUsers.length} old users`);
    
    console.log(`\n📖 Reading new users: ${newUsersPath}`);
    const newUsers = parseUsersCSV(newUsersPath);
    console.log(`✓ Found ${newUsers.length} new users`);
    
    // Create mapping
    console.log(`\n🔗 Creating ID mapping (matching by email)...`);
    const idMapping = createIDMapping(oldUsers, newUsers);
    console.log(`✓ Mapped ${idMapping.size} user IDs`);
    
    // Show mapping details
    console.log(`\n📋 Sample mappings (first 5):`);
    let count = 0;
    for (const [oldId, newId] of idMapping.entries()) {
      if (count < 5) {
        const oldUser = oldUsers.find(u => u.user_id === oldId);
        const newUser = newUsers.find(u => u.user_id === newId);
        console.log(`  Old ID ${oldId} → New ID ${newId} (${oldUser?.email})`);
        count++;
      }
    }
    if (idMapping.size > 5) {
      console.log(`  ... and ${idMapping.size - 5} more`);
    }
    
    // Update Excel file
    await updateExcelFile(excelPath, idMapping, outputPath);
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ All done!');
    console.log(`📁 New file created: ${outputPath}`);
    
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.stack) {
      console.error(`\nStack trace:\n${error.stack}`);
    }
    process.exit(1);
  }
}

// Run script
main().catch(console.error);
