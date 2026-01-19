import * as XLSX from 'xlsx';
import * as fs from 'fs';

const excelPath = process.argv[2];

try {
  const buffer = fs.readFileSync(excelPath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const rows = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1,
    defval: null,
    blankrows: false
  }) as any[][];

  const headers = rows[0].map((h: any) => String(h || '').trim());
  
  console.log('\n=== ANALYZING ROW STRUCTURE ===\n');
  
  let rowsWithContacts = 0;
  let rowsWithoutContacts = 0;
  let rowsWithClientOnly = 0;
  
  for (let i = 1; i < Math.min(20, rows.length); i++) {
    const row = rows[i];
    const groupName = row[0] ? String(row[0]).trim() : '';
    const clientName = row[1] ? String(row[1]).trim() : '';
    const contactName = row[8] ? String(row[8]).trim() : '';
    const contactEmail = row[9] ? String(row[9]).trim() : '';
    const contactPhone = row[10] ? String(row[10]).trim() : '';
    
    const hasContact = contactName || contactEmail || contactPhone;
    const hasClient = groupName && clientName;
    
    if (hasClient && hasContact) {
      rowsWithContacts++;
    } else if (hasClient && !hasContact) {
      rowsWithoutContacts++;
      rowsWithClientOnly++;
      console.log(`Row ${i + 1}: CLIENT ONLY (no contact)`);
      console.log(`  Group: ${groupName}`);
      console.log(`  Client: ${clientName}`);
      console.log('');
    }
  }
  
  console.log(`\n=== SUMMARY (first 20 rows) ===`);
  console.log(`Rows with contacts: ${rowsWithContacts}`);
  console.log(`Rows with client only (no contacts): ${rowsWithClientOnly}`);
  console.log(`Total data rows analyzed: ${Math.min(19, rows.length - 1)}`);
  
  console.log('\n=== KEY FINDING ===');
  console.log('The new format allows rows with CLIENT information but NO CONTACT information.');
  console.log('Current parsing logic SKIPS these rows (lines 169-171 in bulkUpload.service.ts).');
  console.log('This means clients without contacts won\'t be created with current logic.\n');
  
} catch (error: any) {
  console.error('Error:', error.message);
  process.exit(1);
}

