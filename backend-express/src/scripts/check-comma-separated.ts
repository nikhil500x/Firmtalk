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
  
  console.log('\n=== CHECKING FOR COMMA-SEPARATED VALUES ===\n');
  
  const contactNameIdx = headers.indexOf('Contact Name');
  const contactEmailIdx = headers.indexOf('Contact Email');
  const contactPhoneIdx = headers.indexOf('Contact Phone');
  const contactDesignationIdx = headers.indexOf('Contact Designation');
  const tspContactIdx = headers.indexOf('TSP Contact');
  
  let rowsWithCommaSeparatedContacts = 0;
  let rowsWithCommaSeparatedEmails = 0;
  let rowsWithCommaSeparatedPhones = 0;
  let rowsWithCommaSeparatedDesignations = 0;
  
  console.log('Analyzing first 50 rows for comma-separated values...\n');
  
  for (let i = 1; i < Math.min(51, rows.length); i++) {
    const row = rows[i];
    
    const contactName = row[contactNameIdx] ? String(row[contactNameIdx]).trim() : '';
    const contactEmail = row[contactEmailIdx] ? String(row[contactEmailIdx]).trim() : '';
    const contactPhone = row[contactPhoneIdx] ? String(row[contactPhoneIdx]).trim() : '';
    const contactDesignation = row[contactDesignationIdx] ? String(row[contactDesignationIdx]).trim() : '';
    const tspContact = row[tspContactIdx] ? String(row[tspContactIdx]).trim() : '';
    
    const groupName = row[0] ? String(row[0]).trim() : '';
    const clientName = row[1] ? String(row[1]).trim() : '';
    
    // Check for comma-separated values
    const hasCommaInName = contactName.includes(',') && contactName.split(',').length > 1;
    const hasCommaInEmail = contactEmail.includes(',') && contactEmail.split(',').length > 1;
    const hasCommaInPhone = contactPhone.includes(',') && contactPhone.split(',').length > 1;
    const hasCommaInDesignation = contactDesignation.includes(',') && contactDesignation.split(',').length > 1;
    
    if (hasCommaInName || hasCommaInEmail || hasCommaInPhone || hasCommaInDesignation) {
      console.log(`\nRow ${i + 1}: ${groupName} / ${clientName}`);
      
      if (hasCommaInName) {
        rowsWithCommaSeparatedContacts++;
        console.log(`  Contact Names (comma-separated): "${contactName}"`);
        const names = contactName.split(',').map(n => n.trim()).filter(n => n);
        console.log(`    -> ${names.length} contacts: ${JSON.stringify(names)}`);
      }
      
      if (hasCommaInEmail) {
        rowsWithCommaSeparatedEmails++;
        console.log(`  Contact Emails (comma-separated): "${contactEmail}"`);
        const emails = contactEmail.split(',').map(e => e.trim()).filter(e => e);
        console.log(`    -> ${emails.length} emails: ${JSON.stringify(emails)}`);
      }
      
      if (hasCommaInPhone) {
        rowsWithCommaSeparatedPhones++;
        console.log(`  Contact Phones (comma-separated): "${contactPhone}"`);
        const phones = contactPhone.split(',').map(p => p.trim()).filter(p => p);
        console.log(`    -> ${phones.length} phones: ${JSON.stringify(phones)}`);
      }
      
      if (hasCommaInDesignation) {
        rowsWithCommaSeparatedDesignations++;
        console.log(`  Contact Designations (comma-separated): "${contactDesignation}"`);
        const designations = contactDesignation.split(',').map(d => d.trim()).filter(d => d);
        console.log(`    -> ${designations.length} designations: ${JSON.stringify(designations)}`);
      }
    }
  }
  
  console.log('\n=== SUMMARY ===');
  console.log(`Rows with comma-separated Contact Names: ${rowsWithCommaSeparatedContacts}`);
  console.log(`Rows with comma-separated Contact Emails: ${rowsWithCommaSeparatedEmails}`);
  console.log(`Rows with comma-separated Contact Phones: ${rowsWithCommaSeparatedPhones}`);
  console.log(`Rows with comma-separated Contact Designations: ${rowsWithCommaSeparatedDesignations}`);
  
  // Also check if multiple contacts align (same number of items after splitting)
  console.log('\n=== CHECKING ALIGNMENT ===');
  for (let i = 1; i < Math.min(51, rows.length); i++) {
    const row = rows[i];
    const contactName = row[contactNameIdx] ? String(row[contactNameIdx]).trim() : '';
    const contactEmail = row[contactEmailIdx] ? String(row[contactEmailIdx]).trim() : '';
    const contactPhone = row[contactPhoneIdx] ? String(row[contactPhoneIdx]).trim() : '';
    
    if (contactName.includes(',') || contactEmail.includes(',') || contactPhone.includes(',')) {
      const names = contactName ? contactName.split(',').map(n => n.trim()).filter(n => n) : [];
      const emails = contactEmail ? contactEmail.split(',').map(e => e.trim()).filter(e => e) : [];
      const phones = contactPhone ? contactPhone.split(',').map(p => p.trim()).filter(p => p) : [];
      
      if (names.length > 0 && (emails.length > 0 || phones.length > 0)) {
        const groupName = row[0] ? String(row[0]).trim() : '';
        const clientName = row[1] ? String(row[1]).trim() : '';
        
        console.log(`\nRow ${i + 1}: ${groupName} / ${clientName}`);
        console.log(`  Names: ${names.length}, Emails: ${emails.length}, Phones: ${phones.length}`);
        
        if (names.length === emails.length && names.length === phones.length && names.length > 1) {
          console.log(`  ✅ Aligned: ${names.length} contacts (names, emails, phones match)`);
          for (let j = 0; j < names.length; j++) {
            console.log(`    Contact ${j + 1}: ${names[j]} | ${emails[j] || '(no email)'} | ${phones[j] || '(no phone)'}`);
          }
        } else {
          console.log(`  ⚠️  Misaligned: different counts`);
        }
      }
    }
  }
  
} catch (error: any) {
  console.error('Error:', error.message);
  process.exit(1);
}

