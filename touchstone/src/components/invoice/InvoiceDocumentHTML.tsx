/**
 * Generate HTML string for invoice Word document
 * This HTML will be converted to DOCX using html-docx-js
 */

import { getLocation } from '@/lib/location-constants';
import { formatAmountWithCurrency, formatCurrency, CURRENCY_SYMBOLS, type CurrencyCode } from '@/lib/currencyUtils';
import { formatMatterId } from '@/lib/invoiceUtils';

// Match InvoiceData interface from wordUtils.ts
interface LawyerFee {
  lawyerName: string;
  lawyerRole: string;
  hours: number;
  hourlyRate: number;
  fees: number;
}

interface TimesheetEntry {
  timesheetId?: number;
  date: string;
  lawyerName: string;
  lawyerRole: string;
  description?: string | null;
  hours: number;
  hourlyRate: number;
  fees: number;
  currency?: string;
  originalCurrency?: string;
  originalHours?: number;
  originalFees?: number;
  matterTitle?: string | null;
  matterId?: number | null;
  clientCode?: string | null;
  activityType?: string;
}

interface ExpenseEntry {
  category: string;
  subCategory?: string | null;
  description: string;
  originalAmount: number;
  billedAmount: number;
  originalCurrency: string;
  currency: string;
  exchangeRate?: number | null;
}

interface PartnerShare {
  userId: number;
  userName: string;
  userEmail?: string;
  percentage: number;
}

interface Payment {
  id: number;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  transactionRef?: string | null;
  notes?: string | null;
}

interface Matter {
  id: number;
  title: string;
  currency?: string;
}

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  clientName: string;
  clientAddress?: string;
  matterTitle?: string;
  matters?: Matter[];
  periodFrom?: string;
  periodTo?: string;
  amount: number;
  subtotal?: number;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number;
  discountAmount?: number;
  lawyerFees?: LawyerFee[];
  timesheetEntries?: TimesheetEntry[];
  expenseEntries?: ExpenseEntry[];
  partnerShares?: PartnerShare[];
  payments?: Payment[];
  disbursements?: number;
  companyName?: string;
  companyAddress?: string;
  companyEmail?: string;
  companyPhone?: string;
  billingLocation?: string;
  matterCurrency?: string;
  invoiceCurrency?: string;
  userExchangeRate?: number | null;
  amountInINR?: number | null;
  exchangeRates?: Record<string, number>;
  description?: string;
  notes?: string;
  status: string;
  amountPaid: number;
  remainingAmount: number;
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

const formatCurrencyForCode = (amount: number, currencyCode: string = 'INR'): string => {
  try {
    return formatAmountWithCurrency(amount, currencyCode as CurrencyCode);
  } catch (error) {
    // Fallback to simple formatting
    const symbols: Record<string, string> = {
      INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', JPY: '¥',
    };
    const symbol = symbols[currencyCode] || currencyCode;
    return `${symbol} ${amount.toFixed(2)}`;
  }
};

const escapeHtml = (text: string | null | undefined): string => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Generate complete HTML document for invoice
 */
export function generateInvoiceHTML(data: InvoiceData): string {
  const location = getLocation(data.billingLocation);
  const invoiceCurrency = data.invoiceCurrency || data.matterCurrency || 'INR';
  
  const formatCurrencyAmount = (amount: number): string => {
    return formatCurrencyForCode(amount, invoiceCurrency);
  };

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4;
      margin: 2cm;
    }

    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #000;
      margin: 0;
      padding: 2cm;
    }

    .page-break {
      page-break-after: always;
      break-after: page;
    }

    .header {
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid #000;
    }

    .header-logo {
      font-size: 24pt;
      font-weight: bold;
      margin-bottom: 1rem;
    }

    .header-contact {
      text-align: right;
      font-size: 10pt;
    }

    .header-contact p {
      margin: 0.25rem 0;
    }

    .section {
      margin-bottom: 2rem;
    }

    .section-title {
      font-size: 10pt;
      font-weight: 600;
      text-transform: uppercase;
      margin-bottom: 0.75rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #000;
    }

    .two-column {
      width: 100%;
      margin-bottom: 2rem;
    }

    .two-column table {
      width: 100%;
      border: 0;
    }

    .two-column td {
      width: 50%;
      vertical-align: top;
      padding-right: 2rem;
      border: 0;
    }

    .amount-summary {
      background-color: #f5f5f5;
      border: 2px solid #000;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }

    .amount-row {
      width: 100%;
      margin-bottom: 1rem;
    }

    .amount-row table {
      width: 100%;
      border: 0;
    }

    .amount-row td {
      border: 0;
      padding: 0.25rem 0;
    }

    .amount-row.total {
      border-top: 2px solid #000;
      padding-top: 1rem;
      margin-top: 1rem;
    }

    .amount-row.total .label {
      font-size: 14pt;
      font-weight: bold;
    }

    .amount-row.total .value {
      font-size: 18pt;
      font-weight: bold;
    }

    .amount-row.discount {
      color: #cc0000;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 2rem;
      font-size: 10pt;
    }
    
    table th,
    table td {
      padding: 0.5rem;
      text-align: left;
      border: 1px solid #ddd;
    }
    
    table th {
      background-color: #e5e7eb;
      font-weight: bold;
    }
    
    table td.text-right {
      text-align: right;
    }
    
    table td.text-center {
      text-align: center;
    }
    
    .description {
      white-space: pre-wrap;
      line-height: 1.8;
      margin-bottom: 2rem;
    }
    
    .notes {
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 1rem;
      white-space: pre-wrap;
      font-size: 10pt;
      margin-bottom: 2rem;
    }
  </style>
</head>
<body>
  ${generateLetterPage(data, location, formatCurrencyAmount)}
  <div class="page-break"></div>
  ${generateInvoiceDetailsPage(data, location, formatCurrencyAmount)}
  ${data.timesheetEntries && data.timesheetEntries.length > 0 ? `
  <div class="page-break"></div>
  ${generateItemizedTimesheetEntriesPage(data, formatCurrencyAmount)}
  ` : ''}
  ${data.lawyerFees && data.lawyerFees.length > 0 ? `
  <div class="page-break"></div>
  ${generateTimesheetsSummaryPage(data, formatCurrencyAmount)}
  ` : ''}
  ${data.expenseEntries && data.expenseEntries.length > 0 ? `
  <div class="page-break"></div>
  ${generateExpensesPage(data, formatCurrencyAmount)}
  ` : ''}
  ${data.partnerShares && data.partnerShares.length > 0 ? `
  <div class="page-break"></div>
  ${generatePartnersSplitPage(data, formatCurrencyAmount)}
  ` : ''}
  <div class="page-break"></div>
  ${generateSummaryPage(data, location, formatCurrencyAmount)}
</body>
</html>`;

  return html;
}

/**
 * Page 1: Letter to client
 */
function generateLetterPage(data: InvoiceData, location: ReturnType<typeof getLocation>, formatCurrency: (amount: number) => string): string {
  const matterNames = data.matters && data.matters.length > 0
    ? data.matters.map(m => m.title).join(', ')
    : (data.matterTitle || 'Matter Name');
  
  const periodText = data.periodFrom && data.periodTo
    ? `Period from: ${formatDate(data.periodFrom)} to ${formatDate(data.periodTo)}`
    : '';

  return `
    <div class="header">
      <table style="width: 100%; border: 0;">
        <tr>
          <td style="border: 0; width: 50%; vertical-align: top;">
            <div class="header-logo">Firmtalk</div>
          </td>
          <td style="border: 0; width: 50%; text-align: right; vertical-align: top;">
            <div class="header-contact">
              ${location.addressLines.map(line => `<p>${escapeHtml(line)}</p>`).join('')}
              <p>Tel: ${escapeHtml(location.phone)}</p>
              ${location.fax ? `<p>F: ${escapeHtml(location.fax)}</p>` : ''}
              <p>E: ${escapeHtml(location.email)}</p>
              <p>W: ${escapeHtml(location.website)}</p>
            </div>
          </td>
        </tr>
      </table>
    </div>
    
    <div class="section">
      <p><strong>${escapeHtml(data.clientName)}</strong></p>
      ${data.clientAddress ? `<p>${escapeHtml(data.clientAddress)}</p>` : ''}
    </div>
    
    ${data.matterTitle ? `
    <div class="section">
      <p><strong>Matter name:</strong> ${escapeHtml(data.matterTitle)}</p>
    </div>
    ` : ''}
    
    ${data.matters && data.matters.length > 0 && !data.matterTitle ? `
    <div class="section">
      <p><strong>Matter(s):</strong> ${escapeHtml(matterNames)}</p>
    </div>
    ` : ''}
    
    ${periodText ? `
    <div class="section">
      <p><strong>${escapeHtml(periodText)}</strong></p>
    </div>
    ` : ''}
    
    <div class="section">
      <p>Dear</p>
      <p>Please find enclosed our draft invoice for legal services rendered.</p>
      <p>I should be grateful if you would arrange to have the amount remitted to our account with Standard Chartered Bank, Malcha Marg, Chanakyapuri, New Delhi, India (IFSC Code: SCBL0036031). The account name is Touchstone Partners and the account number is 524-0-509555-0. Our PAN no. is AASFP3948G.</p>
      <p>In the alternative, you could also have a cheque in the appropriate amount and in the name of "Touchstone Partners", to be dispatched to the above address.</p>
      <p>Please pay GST on the invoice value directly to government under Reverse Charge Mechanism in terms of Sr.No.2 of Notification No.13/2017-Central Tax (Rate) dt. 28 June 2017 read with section 20 of the IGST Act, 2017.</p>
      <p>I trust you find this to be in order.</p>
      <p>Yours faithfully</p>
      <p><strong>Accounts Team, Firmtalk</strong></p>
    </div>
  `;
}

/**
 * Page 2: Invoice Details/Preview
 */
function generateInvoiceDetailsPage(data: InvoiceData, location: ReturnType<typeof getLocation>, formatCurrency: (amount: number) => string): string {
  const subtotal = data.subtotal ?? data.amount;
  const discountAmount = data.discountAmount ?? 0;
  const totalAmount = data.amount;

  return `
    <div class="header">
      <table style="width: 100%; border: 0;">
        <tr>
          <td style="border: 0; width: 50%; vertical-align: top;">
            <div class="header-logo">Firmtalk</div>
          </td>
          <td style="border: 0; width: 50%; text-align: right; vertical-align: top;">
            <div class="header-contact">
              ${location.addressLines.map(line => `<p>${escapeHtml(line)}</p>`).join('')}
              <p>Tel: ${escapeHtml(location.phone)}</p>
              ${location.fax ? `<p>F: ${escapeHtml(location.fax)}</p>` : ''}
              <p>E: ${escapeHtml(location.email)}</p>
              <p>W: ${escapeHtml(location.website)}</p>
            </div>
          </td>
        </tr>
      </table>
    </div>
    
    <div class="two-column">
      <table style="width: 100%; border: 0;">
        <tr>
          <td style="border: 0; width: 50%; vertical-align: top; padding-right: 2rem;">
            <div class="section">
              <div class="section-title">Bill To</div>
              <p><strong>${escapeHtml(data.clientName)}</strong></p>
              ${data.clientAddress ? `<p style="color: #666; font-size: 10pt;">${escapeHtml(data.clientAddress)}</p>` : ''}
              ${data.matterTitle ? `<p style="color: #666; font-size: 10pt; margin-top: 0.5rem;"><strong>Matter:</strong> ${escapeHtml(data.matterTitle)}</p>` : ''}
            </div>
          </td>
          <td style="border: 0; width: 50%; vertical-align: top;">
            <div class="section">
              <div class="section-title">Invoice Details</div>
              <table style="width: 100%; border: 0; font-size: 10pt;">
                <tr>
                  <td style="border: 0; color: #666; padding: 0.25rem 0;">Invoice Date:</td>
                  <td style="border: 0; text-align: right; font-weight: 500; padding: 0.25rem 0;">${formatDate(data.invoiceDate)}</td>
                </tr>
                <tr>
                  <td style="border: 0; color: #666; padding: 0.25rem 0;">Due Date:</td>
                  <td style="border: 0; text-align: right; font-weight: 500; padding: 0.25rem 0;">${formatDate(data.dueDate)}</td>
                </tr>
                <tr>
                  <td style="border: 0; color: #666; padding: 0.25rem 0;">Invoice Number:</td>
                  <td style="border: 0; text-align: right; font-weight: 600; padding: 0.25rem 0;">#${escapeHtml(data.invoiceNumber)}</td>
                </tr>
              </table>
            </div>
          </td>
        </tr>
      </table>
    </div>
    
    <div class="section">
      <div class="section-title">Description of Services</div>
      <div class="description">
        ${data.description ? escapeHtml(data.description) : '<em style="color: #999;">Service description will appear here...</em>'}
      </div>
    </div>
    
    <div class="amount-summary">
      <table style="width: 100%; border: 0;">
        <tr>
          <td style="border: 0; font-weight: 500; padding: 0.5rem 0;">Subtotal:</td>
          <td style="border: 0; text-align: right; font-weight: 600; font-size: 12pt; padding: 0.5rem 0;">${formatCurrency(subtotal)}</td>
        </tr>
        ${discountAmount > 0 ? `
        <tr style="color: #cc0000;">
          <td style="border: 0; font-weight: 500; padding: 0.5rem 0;">
            Discount ${data.discountType === 'percentage' ? `(${data.discountValue}%)` : ''}:
          </td>
          <td style="border: 0; text-align: right; font-weight: 600; font-size: 12pt; color: #cc0000; padding: 0.5rem 0;">
            -${formatCurrency(discountAmount)}
          </td>
        </tr>
        ` : ''}
        <tr style="border-top: 2px solid #000;">
          <td style="border: 0; font-size: 14pt; font-weight: bold; padding-top: 1rem;">Total Amount Due:</td>
          <td style="border: 0; text-align: right; font-size: 18pt; font-weight: bold; padding-top: 1rem;">${formatCurrency(totalAmount)}</td>
        </tr>
        ${data.invoiceCurrency && data.invoiceCurrency !== 'INR' && data.amountInINR ? `
        <tr style="font-size: 9pt; color: #666;">
          <td style="border: 0; padding: 0.5rem 0;">Equivalent in INR:</td>
          <td style="border: 0; text-align: right; font-weight: 600; padding: 0.5rem 0;">${formatCurrencyForCode(data.amountInINR, 'INR')}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    
    ${data.notes ? `
    <div class="section">
      <div class="section-title">Notes</div>
      <div class="notes">${escapeHtml(data.notes)}</div>
    </div>
    ` : ''}
  `;
}

/**
 * Page 3: Itemized Timesheet Entries
 */
function generateItemizedTimesheetEntriesPage(data: InvoiceData, formatCurrency: (amount: number) => string): string {
  if (!data.timesheetEntries || data.timesheetEntries.length === 0) {
    return `
      <div class="section">
        <h2 style="font-size: 14pt; font-weight: bold; margin-bottom: 1rem;">Itemized Timesheet Entries</h2>
        <p>No timesheet entries available.</p>
      </div>
    `;
  }

  // Group entries by date
  const groupedByDate: Record<string, TimesheetEntry[]> = {};
  for (const entry of data.timesheetEntries) {
    const date = entry.date || 'Unknown';
    if (!groupedByDate[date]) {
      groupedByDate[date] = [];
    }
    groupedByDate[date].push(entry);
  }

  const sortedDates = Object.keys(groupedByDate).sort();
  const invoiceCurrency = data.invoiceCurrency || data.matterCurrency || 'INR';

  let html = `
    <div class="section">
      <h2 style="font-size: 14pt; font-weight: bold; margin-bottom: 1.5rem;">Itemized Timesheet Entries</h2>
  `;

  for (const date of sortedDates) {
    const entries = groupedByDate[date];
    let dayTotalFees = 0;

    html += `
      <table style="margin-bottom: 1rem;">
        <thead>
          <tr>
            <th style="background-color: #f3f4f6;" colspan="9">
              ${formatDate(date)}
            </th>
          </tr>
          <tr>
            <th>Matter</th>
            <th>Lawyer</th>
            <th>Role</th>
            <th class="text-right">Hours</th>
            <th class="text-right">Rate</th>
            <th class="text-right">Fees</th>
            <th class="text-center">Currency</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (const entry of entries) {
      const matterDisplay = entry.matterTitle
        ? `${formatMatterId(entry.clientCode, entry.matterId)} - ${escapeHtml(entry.matterTitle)}`
        : (entry.matterId ? formatMatterId(entry.clientCode, entry.matterId) : 'N/A');

      dayTotalFees += entry.fees;

      html += `
        <tr>
          <td>${escapeHtml(matterDisplay)}</td>
          <td>${escapeHtml(entry.lawyerName)}</td>
          <td>${escapeHtml(entry.lawyerRole)}</td>
          <td class="text-right">${entry.hours.toFixed(2)}</td>
          <td class="text-right">${formatCurrencyForCode(entry.hourlyRate, entry.currency || invoiceCurrency)}</td>
          <td class="text-right">${formatCurrencyForCode(entry.fees, entry.currency || invoiceCurrency)}</td>
          <td class="text-center">${entry.currency || invoiceCurrency}</td>
          <td>${escapeHtml(entry.description || '')}</td>
        </tr>
      `;
    }

    html += `
          <tr style="background-color: #f9fafb; font-weight: bold;">
            <td colspan="5" class="text-right">Day Total:</td>
            <td class="text-right">${formatCurrencyForCode(dayTotalFees, invoiceCurrency)}</td>
            <td colspan="2"></td>
          </tr>
        </tbody>
      </table>
    `;
  }

  html += `</div>`;
  return html;
}

/**
 * Page 4: Timesheets - Fees Summary
 */
function generateTimesheetsSummaryPage(data: InvoiceData, formatCurrency: (amount: number) => string): string {
  if (!data.lawyerFees || data.lawyerFees.length === 0) {
    return `
      <div class="section">
        <h2 style="font-size: 14pt; font-weight: bold; margin-bottom: 1rem;">Timesheets - Fees Summary</h2>
        <p>No timesheet data available.</p>
      </div>
    `;
  }

  const totalHours = data.lawyerFees.reduce((sum, l) => sum + l.hours, 0);
  const totalFees = data.lawyerFees.reduce((sum, l) => sum + l.fees, 0);
  const invoiceCurrency = data.invoiceCurrency || data.matterCurrency || 'INR';

  let html = `
    <div class="section">
      <h2 style="font-size: 14pt; font-weight: bold; margin-bottom: 1.5rem;">Timesheets - Fees Summary</h2>
      <table>
        <thead>
          <tr>
            <th>Lawyer</th>
            <th>Role</th>
            <th class="text-right">Hours</th>
            <th class="text-right">Hourly Rate</th>
            <th class="text-right">Fees</th>
            <th class="text-center">Currency</th>
          </tr>
        </thead>
        <tbody>
  `;

  for (const fee of data.lawyerFees) {
    html += `
      <tr>
        <td>${escapeHtml(fee.lawyerName)}</td>
        <td>${escapeHtml(fee.lawyerRole)}</td>
        <td class="text-right">${fee.hours.toFixed(2)}</td>
        <td class="text-right">${formatCurrencyForCode(fee.hourlyRate, invoiceCurrency)}</td>
        <td class="text-right">${formatCurrencyForCode(fee.fees, invoiceCurrency)}</td>
        <td class="text-center">${invoiceCurrency}</td>
      </tr>
    `;
  }

  html += `
          <tr style="background-color: #e5e7eb; font-weight: bold;">
            <td colspan="2">Sub-Total</td>
            <td class="text-right">${totalHours.toFixed(2)}</td>
            <td></td>
            <td class="text-right">${formatCurrencyForCode(totalFees, invoiceCurrency)}</td>
            <td class="text-center">${invoiceCurrency}</td>
          </tr>
          <tr style="background-color: #f3f4f6; font-weight: bold;">
            <td colspan="2">Total Fees</td>
            <td class="text-right">${totalHours.toFixed(2)}</td>
            <td></td>
            <td class="text-right">${formatCurrencyForCode(totalFees, invoiceCurrency)}</td>
            <td class="text-center">${invoiceCurrency}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  return html;
}

/**
 * Page 5: Expenses
 */
function generateExpensesPage(data: InvoiceData, formatCurrency: (amount: number) => string): string {
  if (!data.expenseEntries || data.expenseEntries.length === 0) {
    return `
      <div class="section">
        <h2 style="font-size: 14pt; font-weight: bold; margin-bottom: 1rem;">Expenses</h2>
        <p>No expenses available.</p>
      </div>
    `;
  }

  const totalBilled = data.expenseEntries.reduce((sum, e) => sum + (e.billedAmount || 0), 0);
  const invoiceCurrency = data.invoiceCurrency || data.matterCurrency || 'INR';

  let html = `
    <div class="section">
      <h2 style="font-size: 14pt; font-weight: bold; margin-bottom: 1.5rem;">Expenses</h2>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Sub-Category</th>
            <th>Description</th>
            <th class="text-right">Original Amount</th>
            <th class="text-center">Original Currency</th>
            <th class="text-right">Billed Amount</th>
            <th class="text-center">Invoice Currency</th>
            <th class="text-right">Exchange Rate</th>
          </tr>
        </thead>
        <tbody>
  `;

  for (const expense of data.expenseEntries) {
    html += `
      <tr>
        <td>${escapeHtml(expense.category)}</td>
        <td>${escapeHtml(expense.subCategory || '')}</td>
        <td>${escapeHtml(expense.description)}</td>
        <td class="text-right">${formatCurrencyForCode(expense.originalAmount, expense.originalCurrency)}</td>
        <td class="text-center">${expense.originalCurrency}</td>
        <td class="text-right">${formatCurrencyForCode(expense.billedAmount || 0, expense.currency || invoiceCurrency)}</td>
        <td class="text-center">${expense.currency || invoiceCurrency}</td>
        <td class="text-right">${expense.exchangeRate ? expense.exchangeRate.toFixed(4) : '-'}</td>
      </tr>
    `;
  }

  html += `
          <tr style="background-color: #e5e7eb; font-weight: bold;">
            <td colspan="5">Total</td>
            <td class="text-right">${formatCurrencyForCode(totalBilled, invoiceCurrency)}</td>
            <td colspan="2"></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  return html;
}

/**
 * Page 6: Partners & Split
 */
function generatePartnersSplitPage(data: InvoiceData, formatCurrency: (amount: number) => string): string {
  if (!data.partnerShares || data.partnerShares.length === 0) {
    return '';
  }

  const totalAmount = data.amount;
  const invoiceCurrency = data.invoiceCurrency || data.matterCurrency || 'INR';

  let html = `
    <div class="section">
      <h2 style="font-size: 14pt; font-weight: bold; margin-bottom: 1.5rem;">Partners & Split</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th class="text-right">Share %</th>
            <th class="text-right">Share Amount</th>
            <th class="text-center">Currency</th>
          </tr>
        </thead>
        <tbody>
  `;

  for (const share of data.partnerShares) {
    const shareAmount = (totalAmount * share.percentage) / 100;
    html += `
      <tr>
        <td>${escapeHtml(share.userName)}</td>
        <td>${escapeHtml(share.userEmail || '')}</td>
        <td class="text-right">${share.percentage.toFixed(2)}%</td>
        <td class="text-right">${formatCurrencyForCode(shareAmount, invoiceCurrency)}</td>
        <td class="text-center">${invoiceCurrency}</td>
      </tr>
    `;
  }

  const totalPercentage = data.partnerShares.reduce((sum, s) => sum + s.percentage, 0);
  html += `
          <tr style="background-color: #e5e7eb; font-weight: bold;">
            <td colspan="2">Total</td>
            <td class="text-right">${totalPercentage.toFixed(2)}%</td>
            <td class="text-right">${formatCurrencyForCode(totalAmount, invoiceCurrency)}</td>
            <td class="text-center">${invoiceCurrency}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  return html;
}

/**
 * Page 7: Summary
 */
function generateSummaryPage(data: InvoiceData, location: ReturnType<typeof getLocation>, formatCurrency: (amount: number) => string): string {
  const invoiceCurrency = data.invoiceCurrency || data.matterCurrency || 'INR';
  const matterNames = data.matters && data.matters.length > 0
    ? data.matters.map(m => m.title).join(', ')
    : (data.matterTitle || 'Matter Name');

  let html = `
    <div class="section">
      <h2 style="font-size: 14pt; font-weight: bold; margin-bottom: 1.5rem;">Summary</h2>
      
      <h3 style="font-size: 12pt; font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem;">Invoice Information</h3>
      <table style="margin-bottom: 1.5rem;">
        <tr>
          <td style="font-weight: bold; width: 30%;">Invoice Number:</td>
          <td>${escapeHtml(data.invoiceNumber)}</td>
        </tr>
        <tr>
          <td style="font-weight: bold;">Invoice Date:</td>
          <td>${formatDate(data.invoiceDate)}</td>
        </tr>
        <tr>
          <td style="font-weight: bold;">Due Date:</td>
          <td>${formatDate(data.dueDate)}</td>
        </tr>
        <tr>
          <td style="font-weight: bold;">Status:</td>
          <td>${escapeHtml(data.status)}</td>
        </tr>
        <tr>
          <td style="font-weight: bold;">Billing Location:</td>
          <td>${escapeHtml(location.displayName)}</td>
        </tr>
      </table>
      
      <h3 style="font-size: 12pt; font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem;">Client & Matter(s)</h3>
      <table style="margin-bottom: 1.5rem;">
        <tr>
          <td style="font-weight: bold; width: 30%;">Client Name:</td>
          <td>${escapeHtml(data.clientName)}</td>
        </tr>
        ${data.clientAddress ? `
        <tr>
          <td style="font-weight: bold;">Client Address:</td>
          <td>${escapeHtml(data.clientAddress)}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="font-weight: bold;">Matter(s):</td>
          <td>${escapeHtml(matterNames)}</td>
        </tr>
        ${data.periodFrom && data.periodTo ? `
        <tr>
          <td style="font-weight: bold;">Period:</td>
          <td>${formatDate(data.periodFrom)} to ${formatDate(data.periodTo)}</td>
        </tr>
        ` : ''}
      </table>
      
      <h3 style="font-size: 12pt; font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem;">Financial Summary</h3>
      <table style="margin-bottom: 1.5rem;">
        <tr>
          <td style="font-weight: bold; width: 30%;">Subtotal:</td>
          <td class="text-right">${formatCurrency(data.subtotal ?? data.amount)}</td>
        </tr>
        ${data.discountAmount && data.discountAmount > 0 ? `
        <tr>
          <td style="font-weight: bold;">Discount:</td>
          <td class="text-right">-${formatCurrency(data.discountAmount)}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="font-weight: bold;">Total Amount:</td>
          <td class="text-right" style="font-weight: bold;">${formatCurrency(data.amount)}</td>
        </tr>
        <tr>
          <td style="font-weight: bold;">Amount Paid:</td>
          <td class="text-right">${formatCurrency(data.amountPaid)}</td>
        </tr>
        <tr>
          <td style="font-weight: bold;">Remaining Amount:</td>
          <td class="text-right">${formatCurrency(data.remainingAmount)}</td>
        </tr>
        <tr>
          <td style="font-weight: bold;">Currency:</td>
          <td>${invoiceCurrency}</td>
        </tr>
        ${data.invoiceCurrency && data.invoiceCurrency !== 'INR' && data.amountInINR ? `
        <tr>
          <td style="font-weight: bold;">Equivalent in INR:</td>
          <td class="text-right">${formatCurrencyForCode(data.amountInINR, 'INR')}</td>
        </tr>
        ` : ''}
      </table>
  `;

  if (data.timesheetEntries && data.timesheetEntries.length > 0) {
    const totalEntries = data.timesheetEntries.length;
    const totalHours = data.timesheetEntries.reduce((sum, e) => sum + e.hours, 0);
    html += `
      <h3 style="font-size: 12pt; font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem;">Timesheet Summary</h3>
      <table style="margin-bottom: 1.5rem;">
        <tr>
          <td style="font-weight: bold; width: 30%;">Number of Entries:</td>
          <td>${totalEntries}</td>
        </tr>
        <tr>
          <td style="font-weight: bold;">Total Hours:</td>
          <td class="text-right">${totalHours.toFixed(2)}</td>
        </tr>
      </table>
    `;
  }

  if (data.partnerShares && data.partnerShares.length > 0) {
    html += `
      <h3 style="font-size: 12pt; font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem;">Partner Attribution</h3>
      <table style="margin-bottom: 1.5rem;">
        <thead>
          <tr>
            <th>Partner</th>
            <th class="text-right">Percentage</th>
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
    `;
    for (const share of data.partnerShares) {
      const shareAmount = (data.amount * share.percentage) / 100;
      html += `
        <tr>
          <td>${escapeHtml(share.userName)}</td>
          <td class="text-right">${share.percentage.toFixed(2)}%</td>
          <td class="text-right">${formatCurrencyForCode(shareAmount, invoiceCurrency)}</td>
        </tr>
      `;
    }
    html += `
        </tbody>
      </table>
    `;
  }

  if (data.payments && data.payments.length > 0) {
    html += `
      <h3 style="font-size: 12pt; font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem;">Payment History</h3>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th class="text-right">Amount</th>
            <th class="text-center">Method</th>
            <th>Transaction Ref</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
    `;
    for (const payment of data.payments) {
      html += `
        <tr>
          <td>${formatDate(payment.paymentDate)}</td>
          <td class="text-right">${formatCurrencyForCode(payment.amount, invoiceCurrency)}</td>
          <td class="text-center">${escapeHtml(payment.paymentMethod)}</td>
          <td>${escapeHtml(payment.transactionRef || '-')}</td>
          <td>${escapeHtml(payment.notes || '-')}</td>
        </tr>
      `;
    }
    html += `
        </tbody>
      </table>
    `;
  }

  html += `</div>`;
  return html;
}

