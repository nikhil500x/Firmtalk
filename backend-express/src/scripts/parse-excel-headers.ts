import * as XLSX from 'xlsx';
import * as fs from 'fs';

const excelPath = process.argv[2];

if (!excelPath) {
  console.error('Usage: tsx src/scripts/parse-excel-headers.ts <path-to-excel-file>');
  process.exit(1);
}

if (!fs.existsSync(excelPath)) {
  console.error(`File not found: ${excelPath}`);
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

  // Get header row
  const headers = rows[0].map((h: any) => String(h || '').trim());
  
  console.log('\n=== EXCEL FILE HEADERS ===\n');
  headers.forEach((header, index) => {
    console.log(`${index + 1}. "${header || '(empty)'}"`);
  });
  
  console.log(`\nTotal columns: ${headers.length}`);
  
  if (rows.length > 1) {
    console.log('\n=== FIRST DATA ROW (for reference) ===\n');
    const firstRow = rows[1];
    headers.forEach((header, index) => {
      const value = firstRow[index] ? String(firstRow[index]).trim() : '';
      console.log(`${header}: "${value || '(empty)'}"`);
    });
  }
  
  // Also print a JSON representation for easy comparison
  console.log('\n=== HEADERS AS JSON ARRAY ===\n');
  console.log(JSON.stringify(headers, null, 2));
  
} catch (error: any) {
  console.error('Error parsing Excel file:', error.message);
  process.exit(1);
}

