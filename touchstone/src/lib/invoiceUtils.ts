/**
 * Utility functions for invoice data formatting and export
 */

// ✅ Format matter ID as XXXX-XXXX (client_code-matter_id)
export function formatMatterId(clientCode: string | null | undefined, matterId: number | null | undefined): string {
  if (!clientCode && !matterId) return 'N/A';
  const formattedClientCode = clientCode ? String(clientCode).padStart(4, '0') : '0000';
  const formattedMatterId = matterId ? String(matterId).padStart(4, '0') : '0000';
  return `${formattedClientCode}-${formattedMatterId}`;
}

export interface TimesheetEntry {
  date: string;
  lawyerName: string;
  lawyerRole: string;
  hours: number;
  hourlyRate: number;
  fees: number;
  currency?: string;
  originalCurrency?: string;
  description?: string | null;
  activityType?: string;
  originalHours?: number;
  originalFees?: number;
  matterTitle?: string | null;
  matterId?: number | null;
  clientCode?: string | null;
}

export interface ExpenseEntry {
  category: string;
  subCategory?: string | null;
  description: string;
  originalAmount: number;
  billedAmount: number;
  originalCurrency: string;
  currency: string;
  exchangeRate?: number | null;
}

/**
 * Format timesheet entries as CSV
 */
export function formatTimesheetsAsCSV(entries: TimesheetEntry[]): string {
  const headers = [
    'Date',
    'Matter',
    'Lawyer Name',
    'Role',
    'Hours',
    'Hourly Rate',
    'Fees (Invoice Currency)',
    'Original Currency',
    'Original Hours',
    'Original Fees',
    'Description',
    'Activity Type',
  ];

  const rows = entries.map(entry => {
    const formattedId = formatMatterId(entry.clientCode, entry.matterId);
    return [
      entry.date,
      entry.matterTitle 
        ? `${formattedId} - ${entry.matterTitle}` 
        : formattedId,
      entry.lawyerName,
      entry.lawyerRole,
      entry.hours.toFixed(2),
      entry.hourlyRate.toFixed(2),
      entry.fees.toFixed(2),
      entry.currency || entry.originalCurrency || 'INR',
      entry.originalHours?.toFixed(2) || entry.hours.toFixed(2),
      entry.originalFees?.toFixed(2) || entry.fees.toFixed(2),
      entry.description || '',
      entry.activityType || '',
    ];
  });

  return [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

/**
 * Format timesheet entries as TSV (Tab-Separated Values)
 */
export function formatTimesheetsAsTSV(entries: TimesheetEntry[]): string {
  const headers = [
    'Date',
    'Matter',
    'Lawyer Name',
    'Role',
    'Hours',
    'Hourly Rate',
    'Fees (Invoice Currency)',
    'Original Currency',
    'Original Hours',
    'Original Fees',
    'Description',
    'Activity Type',
  ];

  const rows = entries.map(entry => {
    const formattedId = formatMatterId(entry.clientCode, entry.matterId);
    return [
      entry.date,
      entry.matterTitle 
        ? `${formattedId} - ${entry.matterTitle}` 
        : formattedId,
      entry.lawyerName,
      entry.lawyerRole,
      entry.hours.toFixed(2),
      entry.hourlyRate.toFixed(2),
      entry.fees.toFixed(2),
      entry.currency || entry.originalCurrency || 'INR',
      entry.originalHours?.toFixed(2) || entry.hours.toFixed(2),
      entry.originalFees?.toFixed(2) || entry.fees.toFixed(2),
      entry.description || '',
      entry.activityType || '',
    ];
  });

  return [headers, ...rows].map(row => row.join('\t')).join('\n');
}

/**
 * Format timesheet entries as plain text table
 */
export function formatTimesheetsAsPlainText(entries: TimesheetEntry[]): string {
  const headers = [
    'Date',
    'Matter',
    'Lawyer Name',
    'Role',
    'Hours',
    'Hourly Rate',
    'Fees',
    'Currency',
    'Description',
  ];

  // Calculate column widths
  const colWidths = headers.map((_, idx) => {
    const headerWidth = headers[idx].length;
    const dataWidth = Math.max(
      ...entries.map(entry => {
        const formattedId = formatMatterId(entry.clientCode, entry.matterId);
        const values = [
          entry.date,
          entry.matterTitle 
            ? `${formattedId} - ${entry.matterTitle}` 
            : formattedId,
          entry.lawyerName,
          entry.lawyerRole,
          entry.hours.toFixed(2),
          entry.hourlyRate.toFixed(2),
          entry.fees.toFixed(2),
          entry.currency || entry.originalCurrency || 'INR',
          entry.description || '',
        ];
        return String(values[idx] || '').length;
      })
    );
    return Math.max(headerWidth, dataWidth, 8) + 2; // Add padding
  });

  // Format row
  const formatRow = (cells: string[]) => {
    return cells.map((cell, idx) => String(cell || '').padEnd(colWidths[idx])).join(' | ');
  };

  // Build table
  const lines: string[] = [];
  lines.push(formatRow(headers));
  lines.push(colWidths.map(w => '-'.repeat(w)).join('-+-'));
  
  entries.forEach(entry => {
    const formattedId = formatMatterId(entry.clientCode, entry.matterId);
    lines.push(formatRow([
      entry.date,
      entry.matterTitle 
        ? `${formattedId} - ${entry.matterTitle}` 
        : formattedId,
      entry.lawyerName,
      entry.lawyerRole,
      entry.hours.toFixed(2),
      entry.hourlyRate.toFixed(2),
      entry.fees.toFixed(2),
      entry.currency || entry.originalCurrency || 'INR',
      entry.description || '',
    ]));
  });

  return lines.join('\n');
}

/**
 * Format expenses as CSV
 */
export function formatExpensesAsCSV(expenses: ExpenseEntry[]): string {
  const headers = [
    'Category',
    'Sub-Category',
    'Description',
    'Original Amount',
    'Original Currency',
    'Billed Amount',
    'Invoice Currency',
    'Exchange Rate',
  ];

  const rows = expenses.map(expense => [
    expense.category,
    expense.subCategory || '',
    expense.description,
    expense.originalAmount.toFixed(2),
    expense.originalCurrency,
    expense.billedAmount.toFixed(2),
    expense.currency,
    expense.exchangeRate?.toFixed(4) || '1.0000',
  ]);

  return [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

/**
 * Format expenses as TSV
 */
export function formatExpensesAsTSV(expenses: ExpenseEntry[]): string {
  const headers = [
    'Category',
    'Sub-Category',
    'Description',
    'Original Amount',
    'Original Currency',
    'Billed Amount',
    'Invoice Currency',
    'Exchange Rate',
  ];

  const rows = expenses.map(expense => [
    expense.category,
    expense.subCategory || '',
    expense.description,
    expense.originalAmount.toFixed(2),
    expense.originalCurrency,
    expense.billedAmount.toFixed(2),
    expense.currency,
    expense.exchangeRate?.toFixed(4) || '1.0000',
  ]);

  return [headers, ...rows].map(row => row.join('\t')).join('\n');
}

/**
 * Calculate partner share amount
 */
export function calculatePartnerShareAmount(
  finalAmount: number,
  percentage: number,
  invoiceCurrency: string
): { amount: number; currency: string } {
  return {
    amount: (finalAmount * percentage) / 100,
    currency: invoiceCurrency,
  };
}

