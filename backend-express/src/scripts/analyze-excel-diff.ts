import * as XLSX from 'xlsx';
import * as fs from 'fs';

const excelPath = process.argv[2];

if (!excelPath) {
  console.error('Usage: tsx src/scripts/analyze-excel-diff.ts <path-to-excel-file>');
  process.exit(1);
}

try {
  const buffer = fs.readFileSync(excelPath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON with header row
  const rows = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1,
    defval: null,
    blankrows: false
  }) as any[][];

  if (rows.length === 0) {
    console.error('Excel file is empty');
    process.exit(1);
  }

  const headers = rows[0].map((h: any) => String(h || '').trim());
  
  console.log('\n=== CURRENT TEMPLATE FORMAT (from code) ===\n');
  const currentHeaders = [
    'Group Name',
    'Client Name',
    'Client Industry',
    'Client Website',
    'Client Address',
    'Client Code',
    'Client Notes',
    'TSP Contact',
    'Contact Name',
    'Contact Email',
    'Contact Phone',
    'Contact Designation',
    'Is Primary',
    'Contact Notes'
  ];
  currentHeaders.forEach((h, i) => console.log(`${i + 1}. ${h}`));
  
  console.log('\n=== NEW EXCEL FILE HEADERS ===\n');
  headers.forEach((h, i) => console.log(`${i + 1}. ${h}`));
  
  console.log('\n=== COMPARISON ===\n');
  const differences: string[] = [];
  
  if (headers.length !== currentHeaders.length) {
    differences.push(`Column count differs: Current=${currentHeaders.length}, New=${headers.length}`);
  }
  
  headers.forEach((h, i) => {
    if (i < currentHeaders.length) {
      if (h !== currentHeaders[i]) {
        differences.push(`Column ${i + 1}: Current="${currentHeaders[i]}" vs New="${h}"`);
      }
    } else {
      differences.push(`Column ${i + 1}: Extra column "${h}" in new file`);
    }
  });
  
  if (currentHeaders.length > headers.length) {
    for (let i = headers.length; i < currentHeaders.length; i++) {
      differences.push(`Column ${i + 1}: Missing column "${currentHeaders[i]}" in new file`);
    }
  }
  
  if (differences.length === 0) {
    console.log('✅ Headers are IDENTICAL!\n');
  } else {
    console.log('❌ Differences found:\n');
    differences.forEach(d => console.log(`  - ${d}`));
  }
  
  // Show sample data rows
  console.log('\n=== SAMPLE DATA ROWS (first 3) ===\n');
  for (let rowIdx = 1; rowIdx < Math.min(4, rows.length); rowIdx++) {
    console.log(`\nRow ${rowIdx}:`);
    const row = rows[rowIdx];
    headers.forEach((header, colIdx) => {
      const value = row[colIdx] ? String(row[colIdx]).trim().substring(0, 50) : '(empty)';
      console.log(`  ${header}: ${value}`);
    });
  }
  
} catch (error: any) {
  console.error('Error parsing Excel file:', error.message);
  process.exit(1);
}

