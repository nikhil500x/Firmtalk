import { saveAs } from 'file-saver';
import { generateInvoiceHTML } from '@/components/invoice/InvoiceDocumentHTML';

interface LawyerFee {
  lawyerName: string;
  lawyerRole: string;
  hours: number;
  hourlyRate: number;
  fees: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  clientName: string;
  clientAddress?: string;
  matterTitle?: string;
  matters?: Array<{ id: number; title: string; currency?: string }>;
  periodFrom?: string;
  periodTo?: string;
  amount: number;
  subtotal?: number;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number;
  discountAmount?: number;
  lawyerFees?: LawyerFee[];
  timesheetEntries?: Array<{
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
  }>;
  expenseEntries?: Array<{
    category: string;
    subCategory?: string | null;
    description: string;
    originalAmount: number;
    billedAmount: number;
    originalCurrency: string;
    currency: string;
    exchangeRate?: number | null;
  }>;
  partnerShares?: Array<{
    userId: number;
    userName: string;
    userEmail?: string;
    percentage: number;
  }>;
  payments?: Array<{
    id: number;
    paymentDate: string;
    amount: number;
    paymentMethod: string;
    transactionRef?: string | null;
    notes?: string | null;
  }>;
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

/**
 * Generate and download invoice Word document
 * @param invoiceData - Invoice data to include in Word document
 * @param filename - Optional custom filename (defaults to invoice number)
 */
export async function downloadInvoiceWord(
  invoiceData: InvoiceData,
  filename?: string
): Promise<void> {
  try {
    // Use the SAME HTML that's used in the preview (which looks perfect!)
    const html = generateInvoiceHTML(invoiceData);

    // Create a complete HTML document that Word can open
    const wordHTML = `
<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<title>Invoice ${invoiceData.invoiceNumber}</title>
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>90</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<![endif]-->
</head>
<body>
${html}
</body>
</html>`;

    // Create a blob from the HTML
    const blob = new Blob([wordHTML], { type: 'application/msword' });

    // Download as .doc file (Word can open HTML files with this extension)
    saveAs(blob, filename || `Invoice-${invoiceData.invoiceNumber}.doc`);
  } catch (error) {
    console.error('Error generating Word document:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to generate Word document. Please try again.');
  }
}

function generateSimpleInvoiceHTML(data: InvoiceData): string {
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const currency = data.invoiceCurrency || data.matterCurrency || 'INR';
  const symbols: Record<string, string> = {
    INR: 'Rs.', USD: '$', EUR: 'EUR', GBP: 'GBP', AED: 'AED', JPY: 'JPY',
  };
  const symbol = symbols[currency] || currency;

  const formatAmount = (amount: number): string => {
    return `${symbol} ${amount.toFixed(2)}`;
  };

  return `
<html>
<body style="font-family: Arial; font-size: 12pt; margin: 2cm;">

<p style="font-size: 24pt; font-weight: bold;">Firmtalk</p>
<p>One BKC, 808 B, Tower C, Bandra Kurla Complex</p>
<p>Mumbai - 400 051</p>
<p>Tel: +91 22 6913 4305</p>
<p>E: accounts@touchstonepartners.com</p>
<p>W: touchstonepartners.com</p>

<hr/>

<p style="font-weight: bold; font-size: 14pt; margin-top: 20pt;">BILL TO</p>
<p style="font-weight: bold;">${data.clientName}</p>
${data.clientAddress ? `<p>${data.clientAddress}</p>` : ''}
${data.matterTitle ? `<p>Matter: ${data.matterTitle}</p>` : ''}

<p style="font-weight: bold; font-size: 14pt; margin-top: 20pt;">INVOICE DETAILS</p>
<p>Invoice Date: ${formatDate(data.invoiceDate)}</p>
<p>Due Date: ${formatDate(data.dueDate)}</p>
<p>Invoice Number: #${data.invoiceNumber}</p>

<p style="font-weight: bold; font-size: 14pt; margin-top: 20pt;">DESCRIPTION OF SERVICES</p>
<p>${data.description || 'Service description'}</p>

<p style="font-weight: bold; font-size: 14pt; margin-top: 20pt;">AMOUNT SUMMARY</p>
<table border="1" cellpadding="10" style="width: 60%; border-collapse: collapse;">
  <tr>
    <td style="font-weight: bold;">Subtotal:</td>
    <td style="text-align: right; font-weight: bold;">${formatAmount(data.subtotal || data.amount)}</td>
  </tr>
  ${data.discountAmount && data.discountAmount > 0 ? `
  <tr>
    <td style="font-weight: bold;">Discount ${data.discountType === 'percentage' ? `(${data.discountValue}%)` : ''}:</td>
    <td style="text-align: right; font-weight: bold; color: red;">-${formatAmount(data.discountAmount)}</td>
  </tr>
  ` : ''}
  <tr style="background-color: #f0f0f0;">
    <td style="font-weight: bold; font-size: 14pt;">Total Amount Due:</td>
    <td style="text-align: right; font-weight: bold; font-size: 16pt;">${formatAmount(data.amount)}</td>
  </tr>
</table>

${data.notes ? `
<p style="font-weight: bold; font-size: 14pt; margin-top: 20pt;">NOTES</p>
<p>${data.notes}</p>
` : ''}

</body>
</html>
`;
}