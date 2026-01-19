import { pdf } from '@react-pdf/renderer';
import React from 'react';
import InvoicePDFDocument from '@/components/invoice/InvoicePDFDocument';

interface LawyerFee {
  lawyerName: string;
  lawyerRole: string;
  hours: number;
  hourlyRate: number;
  fees: number;
}

interface TimesheetEntry {
  timesheetId: number;
  date: string;
  lawyerName: string;
  lawyerRole: string;
  description: string;
  hours: number;
  hourlyRate: number;
  fees: number;
}

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  clientName: string;
  clientAddress?: string;
  matterTitle?: string;
  periodFrom?: string;
  periodTo?: string;
  amount: number;
  lawyerFees?: LawyerFee[];
  timesheetEntries?: TimesheetEntry[];
  disbursements?: number;
  companyName?: string;
  companyAddress?: string;
  companyEmail?: string;
  companyPhone?: string;
  billingLocation?: string;
  // ✅ Currency fields
  matterCurrency?: string;
  invoiceCurrency?: string;
  userExchangeRate?: number | null;
  amountInINR?: number | null;
}

/**
 * Generate and download invoice PDF
 * @param invoiceData - Invoice data to include in PDF
 * @param filename - Optional custom filename (defaults to invoice number)
 */
export async function downloadInvoicePDF(
  invoiceData: InvoiceData,
  filename?: string
): Promise<void> {
  try {
    // Generate PDF blob
    const docElement = React.createElement(InvoicePDFDocument, { data: invoiceData });
    // @ts-expect-error - pdf() accepts Document component but type definition is strict
    const blob = await pdf(docElement).toBlob();

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `Invoice-${invoiceData.invoiceNumber}.pdf`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF. Please try again.');
  }
}