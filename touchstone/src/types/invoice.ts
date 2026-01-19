/**
 * Invoice Type Definitions
 */

export interface Invoice {
  id: number;
  invoice_id: number;
  parent_invoice_id?: number | null;
  client_id: number;
  matter_id: number | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  invoice_amount: number; // Amount in invoice currency
  amount_paid: number;
  isSplit: boolean;
  status: 'new' | 'partially_paid' | 'paid' | 'overdue';
  description: string;
  notes?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  billing_location: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  
  // Currency fields
  matter_currency?: string; // Original matter currency
  invoice_currency?: string; // Invoice billing currency
  currency_conversion_rate?: number | null; // Rate if currencies differ
  invoice_amount_in_matter_currency?: number | null; // Original amount before conversion
  
  // Relations
  client: {
    id: number;
    name: string;
    address: string;
  };
  matter?: {
    id: number;
    title: string;
    currency?: string;
  } | null;
  creator: {
    id: number;
    name: string;
  };
  parent_invoice?: Invoice | null;
  split_invoices?: Invoice[];
}

export interface InvoiceFormData {
  clientId?: string;
  matterId?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  amount?: string;
  description?: string;
  notes?: string;
  matterDateFrom?: string;
  matterDateTo?: string;
  billingLocation?: string;
  invoiceCurrency?: string; // Currency selection for invoice
  [key: string]: unknown;
}

export interface InvoicePayment {
  payment_id: number;
  invoice_id: number;
  payment_date: string;
  amount: number;
  payment_method: string;
  transaction_ref?: string | null;
  notes?: string | null;
  recorded_by: number;
  created_at: string;
  
  recorder: {
    name: string;
  };
}

export interface CurrencyBreakdown {
  invoice_id: number;
  invoice_number: string;
  matter_currency: string;
  invoice_currency: string;
  original_amount: number; // Amount in matter currency
  converted_amount: number; // Amount in invoice currency
  conversion_rate: number;
  is_converted: boolean;
}

