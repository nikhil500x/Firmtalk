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
  
  const contactNameIdx = headers.indexOf('Contact Name');
  const contactEmailIdx = headers.indexOf('Contact Email');
  const contactPhoneIdx = headers.indexOf('Contact Phone');
  const contactDesignationIdx = headers.indexOf('Contact Designation');
  
  console.log('\n=== DETAILED ANALYSIS OF COMMA-SEPARATED ROWS ===\n');
  
  // Find all rows with comma-separated values
  const commaRows: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const contactName = row[contactNameIdx] ? String(row[contactNameIdx]).trim() : '';
    const contactEmail = row[contactEmailIdx] ? String(row[contactEmailIdx]).trim() : '';
    const contactPhone = row[contactPhoneIdx] ? String(row[contactPhoneIdx]).trim() : '';
    
    if (contactName.includes(',') || contactEmail.includes(',') || contactPhone.includes(',')) {
      commaRows.push(i);
    }
  }
  
  console.log(`Found ${commaRows.length} rows with comma-separated values\n`);
  
  // Show detailed examples
  for (const rowIdx of commaRows.slice(0, 10)) { // Show first 10
    const row = rows[rowIdx];
    const groupName = row[0] ? String(row[0]).trim() : '';
    const clientName = row[1] ? String(row[1]).trim() : '';
    const contactName = row[contactNameIdx] ? String(row[contactNameIdx]).trim() : '';
    const contactEmail = row[contactEmailIdx] ? String(row[contactEmailIdx]).trim() : '';
    const contactPhone = row[contactPhoneIdx] ? String(row[contactPhoneIdx]).trim() : '';
    const contactDesignation = row[contactDesignationIdx] ? String(row[contactDesignationIdx]).trim() : '';
    const isPrimary = row[headers.indexOf('Is Primary')] ? String(row[headers.indexOf('Is Primary')]).trim() : '';
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Row ${rowIdx + 1}: ${groupName} / ${clientName}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Contact Name: "${contactName}"`);
    console.log(`Contact Email: "${contactEmail}"`);
    console.log(`Contact Phone: "${contactPhone}"`);
    console.log(`Contact Designation: "${contactDesignation}"`);
    console.log(`Is Primary: "${isPrimary}"`);
    
    // Try to understand the pattern
    const nameParts = contactName ? contactName.split(',').map(n => n.trim()).filter(n => n) : [];
    const emailParts = contactEmail ? contactEmail.split(',').map(e => e.trim()).filter(e => e) : [];
    const phoneParts = contactPhone ? contactPhone.split(',').map(p => p.trim()).filter(p => p) : [];
    
    console.log(`\nParsed:`);
    console.log(`  Names: ${nameParts.length} -> ${JSON.stringify(nameParts)}`);
    console.log(`  Emails: ${emailParts.length} -> ${JSON.stringify(emailParts)}`);
    console.log(`  Phones: ${phoneParts.length} -> ${JSON.stringify(phoneParts)}`);
    
    // Check if this looks like multiple contacts
    const maxCount = Math.max(nameParts.length, emailParts.length, phoneParts.length);
    if (maxCount > 1) {
      console.log(`\n  🤔 This row appears to contain ${maxCount} contacts`);
      console.log(`  Current logic would treat this as ONE contact with invalid data`);
      console.log(`  Should this be split into ${maxCount} separate contact records?`);
    } else if (nameParts.length === 2 && emailParts.length === 1) {
      console.log(`\n  ℹ️  Name format: "Last, First" (common format, not multiple contacts)`);
    }
  }
  
  console.log(`\n\n=== INTERPRETATION ===`);
  console.log(`Total rows with commas: ${commaRows.length}`);
  console.log(`\nQuestions:`);
  console.log(`1. Are comma-separated emails/phones meant to be multiple contacts?`);
  console.log(`2. Should one row be split into multiple contact records?`);
  console.log(`3. Or are commas just part of the data (like "Last, First" names)?`);
  
} catch (error: any) {
  console.error('Error:', error.message);
  process.exit(1);
}

