'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Edit2, Download, DollarSign, X, FileText, File, Upload, CheckCircle, Info, Eye } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS, API_BASE_URL } from '@/lib/api';
import InvoicePreview from '@/components/invoice/InvoicePreview';
import InvoiceDialog from '@/components/invoice/InvoiceDialog';
import FinalizeInvoiceDialog from '@/components/invoice/FinalizeInvoiceDialog';
import UploadInvoiceDialog from '@/components/invoice/UploadInvoiceDialog';
import DraftInvoiceEditor from '@/components/invoice/DraftInvoiceEditor';
import { downloadInvoicePDF } from '@/lib/pdfUtils';
import { downloadInvoiceWord, type InvoiceData as WordInvoiceData } from '@/lib/wordUtils';
import InvoicePreviewModal from '@/components/invoice/InvoicePreviewModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'react-toastify';
import { formatAmountWithCurrency, type CurrencyCode } from '@/lib/currencyUtils';
import {
  formatTimesheetsAsCSV,
  formatTimesheetsAsTSV,
  formatTimesheetsAsPlainText,
  formatExpensesAsCSV,
  formatExpensesAsTSV,
  calculatePartnerShareAmount,
  formatMatterId,
  type TimesheetEntry,
  type ExpenseEntry,
} from '@/lib/invoiceUtils';
import { Copy, ChevronDown } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Invoice {
  id: number;
  invoiceNumber: string;
  clientId: number;
  matterId: number | null;
  matterIds?: number[]; // NEW: Multi-matter support
  invoiceDate: string;
  dueDate: string;
  invoiceAmount: number;
  // Currency support
  matterCurrency?: CurrencyCode;
  invoiceCurrency?: CurrencyCode;
  currencyConversionRate?: number | null;
  invoiceAmountInMatterCurrency?: number | null;
  exchangeRates?: Record<string, number> | null; // ✅ Saved exchange rates
  amountPaid: number;
  status: 'draft' | 'finalized' | 'invoice_uploaded' | 'partially_paid' | 'paid' | 'overdue' | 'new'; // Updated statuses
  description: string;
  notes: string | null;
  billingLocation: string;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  isMultiMatter?: boolean;
  subtotal?: number;
  finalAmount?: number;
  discountType?: string | null;
  discountValue?: number;
  discountAmount?: number;
  userExchangeRate?: number | null;
  amountInINR?: number | null;
  uploadedInvoiceUrl?: string | null;
  uploadedAt?: string | null;
  timesheets?: Array<{
    timesheetId: number;
    billedHours: number | null;
    billedAmount: number | null;
    hourlyRate: number | null;
    originalHours: number | null;
    originalAmount: number | null;
    user: { id: number; name: string };
    date: string;
    description: string | null;
    currency?: string; // ✅ Currency for this timesheet
  }>;
  expenses?: Array<{
    expenseId: number;
    category: string;
    subCategory?: string;
    description?: string;
    originalAmount: number;
    amount: number;
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
  splitPercentage?: number | null;
  client: {
    id: number;
    name: string;
    address?: string;
  };
  matter: {
    id: number;
    title: string;
    currency?: string;
  } | null;
  matters?: Array<{
    id: number;
    title: string;
    currency?: string;
  }>;
  creator: {
    id: number;
    name: string;
  };
  splitInvoices?: Invoice[];
  parentInvoiceId?: number | null;
  isParent?: boolean;
  isSplit?: boolean;
  splitCount?: number;
  splitPaymentSummary?: {
    totalPaid: number;
    splits: Array<{
      invoiceNumber: string;
      invoiceId: number;
      amountPaid: number;
      finalAmount: number;
      amountDue: number;
      currency?: string;
      status: string;
    }>;
  } | null;
}

interface Payment {
  id: number;
  invoiceId: number;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  transactionRef: string | null;
  notes: string | null;
  recordedBy: number;
  createdAt: string;
  isSplitPayment?: boolean;
  splitInvoiceNumber?: string | null;
  splitInvoiceId?: number | null;
  recorder: {
    id: number;
    name: string;
  };
}

// Timesheet summary row shaped like your "Fees" table
interface TimesheetSummaryRow {
  lawyerName: string;
  lawyerRole: string;
  hours: number;
  hourlyRate: number;
  fees: number;
  // ✅ NEW: For draft editing
  timesheetId?: number;
  invoiceTimesheetId?: number;
  originalHours?: number;
  originalFees?: number;
  billedHours?: number; // in minutes
  billedAmount?: number;
  date?: string;
  currency?: string; // ✅ Currency for this timesheet
  originalFeesTotal?: number; // ✅ NEW: Original fees in original currency (for finalized invoices)
  description?: string | null;
  activityType?: string;
}

// ========================================================================
// TAB COMPONENTS
// ========================================================================

// Itemized Entries Tab Component
function ItemizedEntriesTab({ invoice }: { invoice: Invoice }) {
  const [detailedEntries, setDetailedEntries] = useState<TimesheetEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch detailed timesheet entries
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        // ✅ For split invoices, fetch timesheets from parent invoice (they're the same)
        const targetInvoiceId = invoice.isSplit && invoice.parentInvoiceId 
          ? invoice.parentInvoiceId 
          : invoice.id;
        const response = await fetch(`${API_BASE_URL}/api/invoices/${targetInvoiceId}/timesheet-summary`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            // Map API response to TimesheetEntry format
            const entries = (data.data.timesheetEntries || []).map((entry: any) => ({
              date: entry.date || '',
              lawyerName: entry.lawyerName || '',
              lawyerRole: entry.lawyerRole || '',
              hours: entry.hours || 0,
              hourlyRate: entry.hourlyRate || 0,
              fees: entry.fees || 0,
              currency: entry.currency || invoice.invoiceCurrency || 'INR',
              originalCurrency: entry.originalCurrency || entry.currency || invoice.matterCurrency || 'INR',
              description: entry.description || null,
              activityType: entry.activityType || '',
              originalHours: entry.originalHours,
              originalFees: entry.originalFees,
              matterTitle: entry.matterTitle || null,
              matterId: entry.matterId || null,
              clientCode: entry.clientCode || null,
            }));
            setDetailedEntries(entries);
          }
        }
      } catch (error) {
        console.error('Error fetching timesheet data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [invoice.id, invoice.isSplit, invoice.parentInvoiceId, invoice.invoiceCurrency, invoice.matterCurrency]);

  // Group detailed entries by date
  const groupedByDate = detailedEntries.reduce((acc, entry) => {
    const date = entry.date || 'Unknown';
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(entry);
    return acc;
  }, {} as Record<string, TimesheetEntry[]>);

  const sortedDates = Object.keys(groupedByDate).sort();

  // Use detailed entries for export
  const allEntries: TimesheetEntry[] = detailedEntries;

  const handleCopy = async (format: 'csv' | 'tsv' | 'plain') => {
    let text = '';
    if (format === 'csv') {
      text = formatTimesheetsAsCSV(allEntries);
    } else if (format === 'tsv') {
      text = formatTimesheetsAsTSV(allEntries);
    } else {
      text = formatTimesheetsAsPlainText(allEntries);
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied to clipboard as ${format.toUpperCase()}`);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount: number, currency: CurrencyCode = 'INR') => {
    return formatAmountWithCurrency(amount, currency);
  };

  if (isLoading) {
    return (
      <div className="px-6 py-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Itemized Timesheet Entries</h2>
        {allEntries.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <Copy size={16} />
              Copy
              <ChevronDown size={16} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1">
            <button
              onClick={() => { handleCopy('csv'); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md"
            >
              Copy as CSV
            </button>
            <button
              onClick={() => { handleCopy('tsv'); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md"
            >
              Copy as TSV (Excel)
            </button>
            <button
              onClick={() => { handleCopy('plain'); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md"
            >
              Copy as Plain Text
            </button>
            </PopoverContent>
        </Popover>
        )}
      </div>

      {allEntries.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No timesheet entries found for this invoice.</p>
        </div>
      ) : (
      <div className="space-y-6">
        {sortedDates.map(date => (
          <div key={date} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">{formatDate(date)}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-700 font-semibold">Matter</th>
                    <th className="px-4 py-2 text-left text-gray-700 font-semibold">Lawyer</th>
                    <th className="px-4 py-2 text-left text-gray-700 font-semibold">Role</th>
                    <th className="px-4 py-2 text-right text-gray-700 font-semibold">Hours</th>
                    <th className="px-4 py-2 text-right text-gray-700 font-semibold">Rate</th>
                    <th className="px-4 py-2 text-right text-gray-700 font-semibold">Fees</th>
                    <th className="px-4 py-2 text-center text-gray-700 font-semibold">Currency</th>
                    <th className="px-4 py-2 text-left text-gray-700 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedByDate[date].map((entry, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-900 font-medium">
                        {(() => {
                          const formattedId = formatMatterId(entry.clientCode, entry.matterId);
                          return entry.matterTitle 
                            ? `${formattedId} - ${entry.matterTitle}` 
                            : formattedId;
                        })()}
                      </td>
                      <td className="px-4 py-2 text-gray-900">{entry.lawyerName}</td>
                      <td className="px-4 py-2 text-gray-600">{entry.lawyerRole}</td>
                      <td className="px-4 py-2 text-right text-gray-900">{entry.hours.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(entry.hourlyRate, entry.currency as CurrencyCode)}</td>
                      <td className="px-4 py-2 text-right text-gray-900 font-medium">
                        {formatCurrency(
                          entry.originalFees ?? entry.fees, 
                          entry.currency as CurrencyCode
                        )}
                      </td>
                      <td className="px-4 py-2 text-center text-gray-600 text-xs">
                        {entry.currency || invoice.invoiceCurrency || 'INR'}
                      </td>
                      <td className="px-4 py-2 text-gray-600">{entry.description || '-'}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan={4} className="px-4 py-2 text-right text-gray-900">Day Total:</td>
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2 text-right text-gray-900">
                      {(() => {
                        const dayEntries = groupedByDate[date];
                        // Group by currency to show totals per currency
                        const totalsByCurrency = dayEntries.reduce((acc, e) => {
                          const currency = e.currency || 'INR';
                          const amount = e.originalFees ?? e.fees ?? 0;
                          if (!acc[currency]) {
                            acc[currency] = 0;
                          }
                          acc[currency] += amount;
                          return acc;
                        }, {} as Record<string, number>);
                        
                        // If all entries are in the same currency, show single total
                        const currencies = Object.keys(totalsByCurrency);
                        if (currencies.length === 1) {
                          return formatCurrency(
                            totalsByCurrency[currencies[0]],
                            currencies[0] as CurrencyCode
                          );
                        }
                        
                        // If multiple currencies, show all totals
                        return Object.entries(totalsByCurrency)
                          .map(([currency, amount]) => formatCurrency(amount, currency as CurrencyCode))
                          .join(' + ');
                      })()}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}

// Partners & Split Tab Component
function PartnersSplitTab({ invoice }: { invoice: Invoice }) {
  const [partnerShares, setPartnerShares] = useState<Array<{
    userId: number;
    userName: string;
    userEmail?: string;
    percentage: number;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  const finalAmount = invoice.finalAmount ?? invoice.invoiceAmount ?? 0;
  const invoiceCurrency = invoice.invoiceCurrency || 'INR';

  const formatCurrency = (amount: number, currency: CurrencyCode = 'INR') => {
    return formatAmountWithCurrency(amount, currency);
  };

  // ✅ For parent invoices, fetch partner shares from all split invoices
  useEffect(() => {
    const fetchPartnerShares = async () => {
      setIsLoading(true);
      try {
        // If parent invoice, fetch from split invoices
        if (invoice.isParent && invoice.id) {
          const response = await fetch(`${API_BASE_URL}/api/invoices/${invoice.id}/splits`, {
            credentials: 'include',
          });
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              // Aggregate partner shares from all split invoices
              const allPartnerShares: Record<number, {
                userId: number;
                userName: string;
                userEmail?: string;
                percentage: number;
              }> = {};

              data.data.forEach((split: Invoice) => {
                if (split.partnerShares && split.partnerShares.length > 0) {
                  split.partnerShares.forEach((ps: any) => {
                    if (allPartnerShares[ps.userId]) {
                      // If partner appears in multiple splits, sum their percentages
                      allPartnerShares[ps.userId].percentage += ps.percentage;
                    } else {
                      allPartnerShares[ps.userId] = {
                        userId: ps.userId,
                        userName: ps.userName,
                        userEmail: ps.userEmail,
                        percentage: ps.percentage,
                      };
                    }
                  });
                }
              });

              setPartnerShares(Object.values(allPartnerShares));
            } else {
              setPartnerShares([]);
            }
          } else {
            setPartnerShares([]);
          }
        } else {
          // For split invoices or non-split invoices, use invoice.partnerShares
          setPartnerShares(invoice.partnerShares || []);
        }
      } catch (error) {
        console.error('Error fetching partner shares:', error);
        setPartnerShares(invoice.partnerShares || []);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPartnerShares();
  }, [invoice.id, invoice.isParent, invoice.partnerShares]);

  if (isLoading) {
    return (
      <div className="px-6 py-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Partners & Split</h2>
        <div className="text-center py-8 text-gray-500">
          <p>Loading partner shares...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Partners & Split</h2>

      {partnerShares && partnerShares.length > 0 ? (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-700 font-semibold">Partner Name</th>
                  <th className="px-4 py-3 text-left text-gray-700 font-semibold">Email</th>
                  <th className="px-4 py-3 text-right text-gray-700 font-semibold">Share %</th>
                  <th className="px-4 py-3 text-right text-gray-700 font-semibold">Share Amount</th>
                  <th className="px-4 py-3 text-center text-gray-700 font-semibold">Currency</th>
                </tr>
              </thead>
              <tbody>
                {partnerShares.map((partner, idx) => {
                  const shareAmount = calculatePartnerShareAmount(finalAmount, partner.percentage, invoiceCurrency);
                  return (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{partner.userName}</td>
                      <td className="px-4 py-3 text-gray-600">{partner.userEmail || '-'}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{partner.percentage.toFixed(2)}%</td>
                      <td className="px-4 py-3 text-right text-gray-900 font-medium">
                        {formatCurrency(shareAmount.amount, shareAmount.currency as CurrencyCode)}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600 text-xs">{invoiceCurrency}</td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 font-semibold">
                  <td colSpan={2} className="px-4 py-3 text-right text-gray-900">Total:</td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {partnerShares.reduce((sum, p) => sum + p.percentage, 0).toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {formatCurrency(finalAmount, invoiceCurrency as CurrencyCode)}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 text-xs">{invoiceCurrency}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {invoice.isSplit && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> This invoice is part of a split. Check parent/child invoice relationships for complete split details.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>No partner shares assigned to this invoice.</p>
        </div>
      )}
    </div>
  );
}

// Split Invoices Tab Component
function SplitInvoicesTab({ invoice }: { invoice: Invoice }) {
  const [splitInvoices, setSplitInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchSplits = async () => {
      if (!invoice.id) return;
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/invoices/${invoice.id}/splits`, {
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to fetch split invoices');
        const data = await response.json();
        if (data.success) {
          setSplitInvoices(data.data || []);
        }
      } catch (error) {
        console.error('Error fetching split invoices:', error);
        toast.error('Failed to load split invoices');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSplits();
  }, [invoice.id]);

  const formatCurrency = (amount: number, currency?: string) => {
    return formatAmountWithCurrency(amount, (currency || invoice.invoiceCurrency || 'INR') as CurrencyCode);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'partially_paid':
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'finalized':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Paid';
      case 'partially_paid':
        return 'Partially Paid';
      case 'overdue':
        return 'Overdue';
      case 'finalized':
        return 'Finalized';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  if (isLoading) {
    return (
      <div className="px-6 py-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading split invoices...</span>
        </div>
      </div>
    );
  }

  if (splitInvoices.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-gray-500">
        <p className="text-lg font-medium">No split invoices found</p>
        <p className="text-sm mt-2">This invoice has not been split.</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Split Invoices</h2>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-200 rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-gray-700 font-semibold">Invoice #</th>
              <th className="px-4 py-3 text-left text-gray-700 font-semibold">Client</th>
              <th className="px-4 py-3 text-right text-gray-700 font-semibold">Amount</th>
              <th className="px-4 py-3 text-right text-gray-700 font-semibold">Paid</th>
              <th className="px-4 py-3 text-right text-gray-700 font-semibold">Due</th>
              <th className="px-4 py-3 text-right text-gray-700 font-semibold">Split %</th>
              <th className="px-4 py-3 text-center text-gray-700 font-semibold">Status</th>
              <th className="px-4 py-3 text-center text-gray-700 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {splitInvoices.map((split) => {
              const amountDue = (split.finalAmount ?? split.invoiceAmount ?? 0) - (split.amountPaid || 0);
              return (
                <tr key={split.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-blue-600 font-medium cursor-pointer hover:underline" onClick={() => router.push(`/invoice/invoices/${split.id}`)}>
                    {split.invoiceNumber}
                  </td>
                  <td className="px-4 py-3 text-gray-900">{split.client?.name || 'N/A'}</td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {formatCurrency(split.finalAmount ?? split.invoiceAmount ?? 0, split.invoiceCurrency)}
                  </td>
                  <td className="px-4 py-3 text-right text-green-600 font-medium">
                    {formatCurrency(split.amountPaid || 0, split.invoiceCurrency)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {formatCurrency(amountDue, split.invoiceCurrency)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {split.splitPercentage?.toFixed(2) || '0.00'}%
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(split.status)}`}>
                      {getStatusText(split.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/invoice/invoices/${split.id}`);
                        }}
                      >
                        View
                      </Button>
                      {(split.status === 'finalized' || split.status === 'partially_paid' || split.status === 'invoice_uploaded') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/invoice/invoices/${split.id}`);
                          }}
                          className="text-green-600 border-green-600 hover:bg-green-50"
                        >
                          Record Payment
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Expenses Tab Component
function ExpensesTab({ invoice }: { invoice: Invoice }) {
  const [expenseEntries, setExpenseEntries] = useState<ExpenseEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/invoices/${invoice.id}/timesheet-summary`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            // Map API response to ExpenseEntry format
            const expenses = (data.data.expenseEntries || []).map((exp: any) => ({
              category: exp.category,
              subCategory: exp.subCategory || exp.sub_category || null,
              description: exp.description,
              originalAmount: exp.originalAmount || exp.original_amount || 0,
              billedAmount: exp.amount || exp.billedAmount || 0,
              originalCurrency: exp.originalCurrency || exp.original_currency || 'INR',
              currency: exp.currency || invoice.invoiceCurrency || 'INR',
              exchangeRate: exp.exchangeRate || exp.exchange_rate || null,
            }));
            setExpenseEntries(expenses);
          }
        }
      } catch (error) {
        console.error('Error fetching expenses:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchExpenses();
  }, [invoice.id, invoice.invoiceCurrency]);

  const handleCopy = async (format: 'csv' | 'tsv') => {
    let text = '';
    if (format === 'csv') {
      text = formatExpensesAsCSV(expenseEntries);
    } else {
      text = formatExpensesAsTSV(expenseEntries);
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied to clipboard as ${format.toUpperCase()}`);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const formatCurrency = (amount: number, currency: CurrencyCode = 'INR') => {
    return formatAmountWithCurrency(amount, currency);
  };

  if (isLoading) {
    return (
      <div className="px-6 py-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Expenses</h2>
        {expenseEntries.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Copy size={16} />
                Copy
                <ChevronDown size={16} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1">
              <button
                onClick={() => { handleCopy('csv'); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md"
              >
                Copy as CSV
              </button>
              <button
                onClick={() => { handleCopy('tsv'); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md"
              >
                Copy as TSV (Excel)
              </button>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {expenseEntries.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-gray-700 font-semibold">Category</th>
                <th className="px-4 py-3 text-left text-gray-700 font-semibold">Sub-Category</th>
                <th className="px-4 py-3 text-left text-gray-700 font-semibold">Description</th>
                <th className="px-4 py-3 text-right text-gray-700 font-semibold">Original Amount</th>
                <th className="px-4 py-3 text-center text-gray-700 font-semibold">Original Currency</th>
                <th className="px-4 py-3 text-right text-gray-700 font-semibold">Billed Amount</th>
                <th className="px-4 py-3 text-center text-gray-700 font-semibold">Invoice Currency</th>
                <th className="px-4 py-3 text-right text-gray-700 font-semibold">Exchange Rate</th>
              </tr>
            </thead>
            <tbody>
              {expenseEntries.map((expense, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{expense.category}</td>
                  <td className="px-4 py-3 text-gray-600">{expense.subCategory || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{expense.description}</td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {formatCurrency(expense.originalAmount, expense.originalCurrency as CurrencyCode)}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 text-xs">{expense.originalCurrency}</td>
                  <td className="px-4 py-3 text-right text-gray-900 font-medium">
                    {formatCurrency(expense.billedAmount, expense.currency as CurrencyCode)}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 text-xs">{expense.currency}</td>
                  <td className="px-4 py-3 text-right text-gray-600 text-xs">
                    {expense.exchangeRate ? expense.exchangeRate.toFixed(4) : '1.0000'}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold">
                <td colSpan={3} className="px-4 py-3 text-right text-gray-900">Total:</td>
                <td className="px-4 py-3 text-right text-gray-900">
                  {formatCurrency(
                    expenseEntries.reduce((sum, e) => sum + e.originalAmount, 0),
                    'INR' as CurrencyCode
                  )}
                </td>
                <td className="px-4 py-3 text-center text-gray-600 text-xs">INR</td>
                <td className="px-4 py-3 text-right text-gray-900">
                  {formatCurrency(
                    expenseEntries.reduce((sum, e) => sum + e.billedAmount, 0),
                    invoice.invoiceCurrency as CurrencyCode
                  )}
                </td>
                <td className="px-4 py-3 text-center text-gray-600 text-xs">{invoice.invoiceCurrency || 'INR'}</td>
                <td className="px-4 py-3"></td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>No expenses included in this invoice.</p>
        </div>
      )}
    </div>
  );
}

// Summary Tab Component
function SummaryTab({ 
  invoice, 
  payments, 
  timesheetRows 
}: { 
  invoice: Invoice; 
  payments: Payment[]; 
  timesheetRows: TimesheetSummaryRow[];
}) {
  const [detailedEntries, setDetailedEntries] = useState<TimesheetEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);

  // Fetch detailed timesheet entries to get accurate count
  useEffect(() => {
    const fetchDetailedEntries = async () => {
      try {
        setIsLoadingEntries(true);
        // ✅ For split invoices, fetch timesheets from parent invoice (they're the same)
        const targetInvoiceId = invoice.isSplit && invoice.parentInvoiceId 
          ? invoice.parentInvoiceId 
          : invoice.id;
        const response = await fetch(`${API_BASE_URL}/api/invoices/${targetInvoiceId}/timesheet-summary`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            // Map API response to TimesheetEntry format
            const entries = (data.data.timesheetEntries || []).map((entry: any) => ({
              date: entry.date || '',
              lawyerName: entry.lawyerName || '',
              lawyerRole: entry.lawyerRole || '',
              hours: entry.hours || 0,
              hourlyRate: entry.hourlyRate || 0,
              fees: entry.fees || 0,
              currency: entry.currency || invoice.invoiceCurrency || 'INR',
              originalCurrency: entry.originalCurrency || entry.currency || invoice.matterCurrency || 'INR',
              description: entry.description || null,
              activityType: entry.activityType || '',
              originalHours: entry.originalHours,
              originalFees: entry.originalFees,
              matterTitle: entry.matterTitle || null,
              matterId: entry.matterId || null,
              clientCode: entry.clientCode || null,
            }));
            setDetailedEntries(entries);
          }
        }
      } catch (error) {
        console.error('Error fetching detailed timesheet entries:', error);
      } finally {
        setIsLoadingEntries(false);
      }
    };
    fetchDetailedEntries();
  }, [invoice.id, invoice.isSplit, invoice.parentInvoiceId, invoice.invoiceCurrency, invoice.matterCurrency]);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount: number, currency?: CurrencyCode | string | null) => {
    // Use invoice currency as default, fallback to matter currency, then INR
    const currencyToUse = (currency || invoice.invoiceCurrency || invoice.matterCurrency || 'INR') as CurrencyCode;
    return formatAmountWithCurrency(amount, currencyToUse);
  };

  const finalAmount = invoice.finalAmount ?? invoice.invoiceAmount ?? 0;
  const remainingAmount = finalAmount - invoice.amountPaid;
  
  // Use detailed entries for accurate calculations
  const totalHours = detailedEntries.length > 0 
    ? detailedEntries.reduce((sum, e) => sum + e.hours, 0)
    : timesheetRows.reduce((sum, r) => sum + r.hours, 0);
  
  const numberOfEntries = detailedEntries.length > 0 ? detailedEntries.length : timesheetRows.length;
  
  const dateRange = detailedEntries.length > 0
    ? (() => {
        const validTimestamps = detailedEntries
          .map(e => {
            if (!e.date) return null;
            const timestamp = new Date(e.date).getTime();
            return isNaN(timestamp) ? null : timestamp;
          })
          .filter((ts): ts is number => ts !== null);
        
        if (validTimestamps.length === 0) return null;
        
        return {
          min: Math.min(...validTimestamps),
          max: Math.max(...validTimestamps),
        };
      })()
    : timesheetRows.length > 0 
    ? (() => {
        const validTimestamps = timesheetRows
          .map(r => {
            if (!r.date) return null;
            const timestamp = new Date(r.date).getTime();
            return isNaN(timestamp) ? null : timestamp;
          })
          .filter((ts): ts is number => ts !== null);
        
        if (validTimestamps.length === 0) return null;
        
        return {
          min: Math.min(...validTimestamps),
          max: Math.max(...validTimestamps),
        };
      })()
    : null;

  return (
    <div className="px-6 py-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Invoice Summary</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Invoice Metadata */}
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-3">Invoice Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Invoice Number:</span>
                <span className="text-gray-900 font-medium">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Invoice Date:</span>
                <span className="text-gray-900">{formatDate(invoice.invoiceDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Due Date:</span>
                <span className="text-gray-900">{formatDate(invoice.dueDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className="text-gray-900 font-medium">{invoice.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Billing Location:</span>
                <span className="text-gray-900">{invoice.billingLocation || '-'}</span>
              </div>
            </div>
          </div>

          {/* Client & Matter */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-3">Client & Matter(s)</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600">Client: </span>
                <span className="text-gray-900 font-medium">{invoice.client.name}</span>
              </div>
              {invoice.matters && invoice.matters.length > 0 ? (
                <div>
                  <span className="text-gray-600">Matters: </span>
                  <div className="mt-1 space-y-1">
                    {invoice.matters.map((matter, idx) => (
                      <div key={idx} className="text-gray-900">
                        • {matter.title} {matter.currency && `(${matter.currency})`}
                      </div>
                    ))}
                  </div>
                </div>
              ) : invoice.matter ? (
                <div>
                  <span className="text-gray-600">Matter: </span>
                  <span className="text-gray-900">{invoice.matter.title}</span>
                  {invoice.matter.currency && (
                    <span className="text-gray-600 ml-2">({invoice.matter.currency})</span>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-3">Financial Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span className="text-gray-900 font-medium">
                  {formatCurrency(invoice.subtotal || invoice.invoiceAmount || 0, invoice.invoiceCurrency as CurrencyCode)}
                </span>
              </div>
              {invoice.discountAmount && invoice.discountAmount > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Discount ({invoice.discountType === 'percentage' ? `${invoice.discountValue}%` : 'Fixed'}):</span>
                    <span className="text-red-600">-{formatCurrency(invoice.discountAmount, invoice.invoiceCurrency as CurrencyCode)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between border-t border-gray-300 pt-2">
                <span className="text-gray-900 font-semibold">Final Amount:</span>
                <span className="text-gray-900 font-bold">
                  {formatCurrency(finalAmount, invoice.invoiceCurrency as CurrencyCode)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Amount Paid:</span>
                <span className="text-green-600 font-medium">
                  {formatCurrency(invoice.amountPaid, invoice.invoiceCurrency as CurrencyCode)}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-300 pt-2">
                <span className="text-gray-900 font-semibold">Remaining:</span>
                <span className="text-gray-900 font-bold">
                  {formatCurrency(remainingAmount, invoice.invoiceCurrency as CurrencyCode)}
                </span>
              </div>
            </div>
          </div>

          {/* Currency Breakdown */}
          {invoice.exchangeRates && Object.keys(invoice.exchangeRates).length > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-3">Currency Breakdown</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700">Invoice Currency:</span>
                  <span className="text-blue-900 font-medium">{invoice.invoiceCurrency || 'INR'}</span>
                </div>
                {invoice.matterCurrency && invoice.matterCurrency !== invoice.invoiceCurrency && (
                  <div className="flex justify-between">
                    <span className="text-blue-700">Matter Currency:</span>
                    <span className="text-blue-900">{invoice.matterCurrency}</span>
                  </div>
                )}
                {invoice.amountInINR && (
                  <div className="flex justify-between">
                    <span className="text-blue-700">Amount in INR:</span>
                    <span className="text-blue-900 font-medium">{formatCurrency(invoice.amountInINR, 'INR')}</span>
                  </div>
                )}
                {invoice.exchangeRates && (
                  <div className="mt-2 pt-2 border-t border-blue-200">
                    <span className="text-blue-700 text-xs">Exchange Rates:</span>
                    <div className="mt-1 space-y-1">
                      {Object.entries(invoice.exchangeRates).map(([currency, rate]) => (
                        <div key={currency} className="flex justify-between text-xs">
                          <span className="text-blue-600">{currency} → {invoice.invoiceCurrency}:</span>
                          <span className="text-blue-900">{Number(rate).toFixed(4)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Timesheet & Expense Summary */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-3">Timesheet Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Hours:</span>
              <span className="text-gray-900 font-medium">{totalHours.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Number of Entries:</span>
              <span className="text-gray-900">
                {isLoadingEntries ? 'Loading...' : numberOfEntries}
              </span>
            </div>
            {dateRange && (
              <div className="flex justify-between">
                <span className="text-gray-600">Date Range:</span>
                <span className="text-gray-900">
                  {(() => {
                    const minDate = new Date(dateRange.min);
                    const maxDate = new Date(dateRange.max);
                    if (isNaN(minDate.getTime()) || isNaN(maxDate.getTime())) {
                      return 'Invalid date range';
                    }
                    return `${formatDate(minDate.toISOString())} - ${formatDate(maxDate.toISOString())}`;
                  })()}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-3">Partner Attribution</h3>
          {invoice.partnerShares && invoice.partnerShares.length > 0 ? (
            <div className="space-y-2 text-sm">
              {invoice.partnerShares.map((partner, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="text-gray-600">{partner.userName}:</span>
                  <span className="text-gray-900">{partner.percentage.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No partner shares assigned</p>
          )}
        </div>
      </div>

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="mt-6 bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-3">Payment History</h3>
          <div className="space-y-2 text-sm">
            {payments.map((payment) => (
              <div key={payment.id} className="flex justify-between items-center border-b border-gray-200 pb-2">
                <div>
                  <span className="text-gray-900 font-medium">{formatCurrency(payment.amount, invoice.invoiceCurrency as CurrencyCode)}</span>
                  <span className="text-gray-600 ml-2">on {formatDate(payment.paymentDate)}</span>
                </div>
                <div className="text-gray-600 text-xs">
                  {payment.paymentMethod} {payment.transactionRef && `• ${payment.transactionRef}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = parseInt(params.invoice_id as string, 10);

    // ========================================================================
  // STATE
  // ========================================================================
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewInvoiceData, setPreviewInvoiceData] = useState<any>(null);

  // Tabs: "details" (current page layout) | "timesheets" (new table) | new tabs for finalized invoices
  const [activeTab, setActiveTab] = useState<'details' | 'timesheets' | 'itemized' | 'partners' | 'splits' | 'expenses' | 'summary'>('details');

  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    amount: '',
    paymentMethod: '',
    transactionRef: '',
    notes: '',
  });

  // Timesheet summary state (for the Timesheets tab)
  const [timesheetRows, setTimesheetRows] = useState<TimesheetSummaryRow[]>([]);
  const [timesheetPeriodFrom, setTimesheetPeriodFrom] = useState<string | undefined>(undefined);
  const [timesheetPeriodTo, setTimesheetPeriodTo] = useState<string | undefined>(undefined);
  const [isSingleDate, setIsSingleDate] = useState(false); // ✅ NEW: Track if single date
  const [isLoadingTimesheets, setIsLoadingTimesheets] = useState(false);
  const [timesheetError, setTimesheetError] = useState<string | null>(null);

  // ✅ NEW: Draft editing state
  const [editingBilledHours, setEditingBilledHours] = useState<Record<string, string>>({}); // timesheetId or temp key -> billedHours (as string for input)
  const [editingHourlyRates, setEditingHourlyRates] = useState<Record<string, string>>({}); // key -> hourlyRate (as string for input)
  const [updatingTimesheetIds, setUpdatingTimesheetIds] = useState<Set<number>>(new Set());

  // ========================================================================
  // DATA FETCHING
  // ========================================================================

  const fetchInvoice = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(API_ENDPOINTS.invoices.byId(invoiceId), {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch invoice');
      }

      const data = await response.json();

      if (data.success) {
        setInvoice(data.data);
      } else {
        setError(data.message || 'Failed to load invoice');
      }
    } catch (err) {
      console.error('Fetch invoice error:', err);
      setError('Failed to load invoice. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [invoiceId, router]);

  const fetchPayments = useCallback(async () => {
    try {
      const response = await fetch(
        API_ENDPOINTS.invoices.payments.list(invoiceId),
        {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch payments');
      }

      const data = await response.json();

      if (data.success) {
        setPayments(data.data || []);
      }
    } catch (err) {
      console.error('Fetch payments error:', err);
    }
  }, [invoiceId]);

  // ✅ Get converted amount using exchange rates
  const getConvertedAmount = useCallback((amount: number, fromCurrency: string, toCurrency?: string, exchangeRates?: Record<string, number> | null): number => {
    if (!amount || amount === 0) return 0;
    const targetCurrency = toCurrency || invoice?.invoiceCurrency || 'INR';
    
    // If same currency, no conversion needed
    if (fromCurrency === targetCurrency) return amount;
    
    // ✅ Use exchangeRates parameter if provided, otherwise fall back to invoice.exchangeRates
    // This ensures we can use exchange rates even when invoice is not in closure
    const ratesToUse = exchangeRates ?? invoice?.exchangeRates;
    
    if (!ratesToUse || !ratesToUse[fromCurrency]) {
      console.error(`❌ CRITICAL: Missing exchange rate for ${fromCurrency} to ${targetCurrency}`, {
        fromCurrency,
        targetCurrency,
        exchangeRates: ratesToUse,
        amount,
        invoiceId: invoice?.id,
        invoiceStatus: invoice?.status,
        usingParameter: exchangeRates !== undefined,
      });
      // For finalized invoices, exchange rates MUST exist - return 0 to make it obvious
      if (invoice?.status !== 'draft') {
        console.error(`⚠️ Returning 0 for missing exchange rate - this will show incorrect totals!`);
        return 0;
      }
      // For draft invoices, return original amount (user can still edit exchange rates)
      return amount;
    }
    
    // Convert using exchange rate
    // exchangeRates[fromCurrency] is the rate FROM fromCurrency TO invoiceCurrency
    const rate = ratesToUse[fromCurrency];
    if (!rate || rate <= 0) {
      console.error(`❌ Invalid exchange rate for ${fromCurrency}: ${rate}`);
      return 0;
    }
    const converted = amount * rate;
    console.log(`✅ Converting ${amount} ${fromCurrency} to ${targetCurrency}: ${amount} * ${rate} = ${converted}`);
    return converted;
  }, [invoice]);

  // Fetch timesheet summary for Timesheets tab (group on frontend)
  // NOTE: Do not close over `invoice` here; this callback was memoized and could see stale invoice=null,
  // which caused draft invoices to be grouped (no timesheetId) => billed hours could not be edited/saved.
  const fetchTimesheetSummary = useCallback(async (isDraftInvoice: boolean, exchangeRates?: Record<string, number> | null, invoiceData?: any) => {
    if (!invoiceId) return;

    try {
      setIsLoadingTimesheets(true);
      setTimesheetError(null);

      // ✅ For split invoices, fetch timesheets from parent invoice (they're the same)
      const targetInvoiceId = invoiceData?.isSplit && invoiceData?.parentInvoiceId 
        ? invoiceData.parentInvoiceId 
        : invoiceId;

      const response = await fetch(
        API_ENDPOINTS.invoices.timesheetSummary(targetInvoiceId),
        {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch timesheet summary");
      }

      const json = await response.json();

      if (json.success) {
        const summary = json.data;
        const entries = summary.timesheetEntries || [];

        // ✅ Use exchange rates from API response (preferred) or fallback to parameter
        const apiExchangeRates = summary.exchangeRates || null;
        const ratesToUse = apiExchangeRates || exchangeRates || invoiceData?.exchangeRates || null;
        const invoiceCurrencyFromAPI = summary.invoiceCurrency || invoiceData?.invoiceCurrency || invoiceData?.matterCurrency || 'INR';

        // ✅ DEBUG: Log raw API response to diagnose missing timesheetId
        console.log('🔍 API Response - entries:', entries);
        console.log('🔍 API Response - exchangeRates:', apiExchangeRates);
        console.log('🔍 Using exchange rates:', ratesToUse);
        entries.forEach((entry: any, idx: number) => {
          if (!entry.timesheetId && !entry.timesheet_id) {
            console.error(`❌ Entry ${idx} missing timesheetId:`, entry);
          }
        });

        // ✅ For draft invoices, show individual entries (editable)
        // For finalized/invoiced, group by lawyerName + lawyerRole (read-only)
        if (isDraftInvoice) {
          // Store individual entries for editing
          const mappedEntries = entries.map((entry: any, idx: number) => {
            // ✅ Recalculate fees: hours * hourlyRate (ensures 12 * 200 = 2400, not 261.05)
            const recalculatedFees = entry.hourlyRate > 0 && entry.hours > 0
              ? entry.hours * entry.hourlyRate
              : entry.fees;
            
            // ✅ Try multiple field names for timesheetId (snake_case vs camelCase)
            const timesheetId = entry.timesheetId || entry.timesheet_id || entry.id || null;
            
            if (!timesheetId) {
              console.error('❌ CRITICAL: Missing timesheetId in entry:', {
                entry,
                allKeys: Object.keys(entry),
                timesheetId: entry.timesheetId,
                timesheet_id: entry.timesheet_id,
                id: entry.id,
              });
            } else {
              console.log(`✅ Entry ${idx} has timesheetId:`, timesheetId, 'Lawyer:', entry.lawyerName);
            }
            
            // ✅ Get currency for this timesheet entry
            const tsCurrency = entry.currency || invoiceData?.matterCurrency || invoiceData?.invoiceCurrency || 'INR';
            
            return {
              lawyerName: entry.lawyerName,
              lawyerRole: entry.lawyerRole,
              hours: entry.hours,
              hourlyRate: entry.hourlyRate,
              fees: recalculatedFees, // ✅ Use recalculated fees (in original currency)
              timesheetId: timesheetId, // ✅ CRITICAL: Must be set for editing
              invoiceTimesheetId: entry.invoiceTimesheetId,
              originalHours: entry.originalHours,
              originalFees: entry.originalFees,
              billedHours: entry.billedHours, // in minutes
              billedAmount: recalculatedFees, // ✅ Use recalculated fees (in original currency)
              date: entry.date,
              currency: tsCurrency, // ✅ Include currency from timesheet
            };
          });
          
          // ✅ Debug: Log if timesheetId is missing
          const missingIds = mappedEntries.filter((e: any) => !e.timesheetId);
          if (missingIds.length > 0) {
            console.error('⚠️ Missing timesheetId in entries:', missingIds);
          }
          
          setTimesheetRows(mappedEntries);
        } else {
          // GROUP BY lawyerName + lawyerRole for read-only view
          // ✅ For finalized invoices, convert fees to invoice currency using exchange rates
          // Use invoiceCurrency from API response (preferred) or fallback
          const invoiceCurrency = invoiceCurrencyFromAPI;
          // ✅ Track totals per currency to handle mixed currencies correctly
          const grouped: Record<string, TimesheetSummaryRow & { currencyTotals?: Record<string, { originalFees: number; hours: number }> }> = {};

        for (const entry of entries) {
          const key = `${entry.lawyerName}-${entry.lawyerRole}`;

            // ✅ Get currency for this entry
            const entryCurrency = entry.originalCurrency || entry.currency || invoiceData?.matterCurrency || invoiceCurrency;
            
            // ✅ IMPORTANT: Use originalFees if available, otherwise entry.fees (but entry.fees might be converted)
            const originalFees = entry.originalFees ?? entry.fees;

          if (!grouped[key]) {
            grouped[key] = {
              lawyerName: entry.lawyerName,
              lawyerRole: entry.lawyerRole,
              hours: 0,
                hourlyRate: 0, // ✅ Will calculate weighted average after processing all entries
                fees: 0, // ✅ Will store converted fees in invoice currency
                currency: invoiceCurrency, // ✅ Always show in invoice currency
                originalFeesTotal: 0, // ✅ Will be sum of all converted fees (for display consistency)
                currencyTotals: {}, // ✅ Track totals per currency
            };
          }

          grouped[key].hours += entry.hours;
            
            // ✅ Track totals per currency separately (can't sum different currencies directly)
            if (!grouped[key].currencyTotals) {
              grouped[key].currencyTotals = {};
            }
            if (!grouped[key].currencyTotals![entryCurrency]) {
              grouped[key].currencyTotals![entryCurrency] = { originalFees: 0, hours: 0 };
            }
            grouped[key].currencyTotals![entryCurrency].originalFees += originalFees;
            grouped[key].currencyTotals![entryCurrency].hours += entry.hours;
            
            // ✅ Convert each currency's fees to invoice currency and sum
            if (entryCurrency === invoiceCurrency) {
              // Same currency - use fees directly
              grouped[key].fees += originalFees;
            } else {
              // Convert using exchange rates from API response
              const convertedFees = getConvertedAmount(originalFees, entryCurrency, invoiceCurrency, ratesToUse);
              
              console.log(`💰 Conversion: ${originalFees} ${entryCurrency} → ${convertedFees} ${invoiceCurrency}`, {
                exchangeRates: ratesToUse,
                rate: ratesToUse?.[entryCurrency],
                entryFees: entry.fees,
                originalFees,
              });
              
              grouped[key].fees += convertedFees;
            }
          }

          // ✅ Calculate weighted average hourly rate in invoice currency
          // Hourly rate = total fees (in invoice currency) / total hours
          for (const key in grouped) {
            const row = grouped[key];
            
            if (row.hours > 0) {
              // Calculate weighted average hourly rate: total fees / total hours (all in invoice currency)
              row.hourlyRate = row.fees / row.hours;
              
              // ✅ Set originalFeesTotal to the converted total (for display consistency)
              // This represents the total in invoice currency after all conversions
              row.originalFeesTotal = row.fees;
            }
            
            // Remove currencyTotals (internal use only, not needed in final row)
            delete row.currencyTotals;
        }

        setTimesheetRows(Object.values(grouped));
        }

        setTimesheetPeriodFrom(summary.periodFrom);
        setTimesheetPeriodTo(summary.periodTo);
        setIsSingleDate(summary.isSingleDate || false); // ✅ NEW: Set single date flag
        
        // ✅ Clear editing state when timesheet rows are refreshed
        if (isDraftInvoice) {
          setEditingBilledHours({});
        }
      }
    } catch (err) {
      console.error("Fetch timesheet summary error:", err);
      setTimesheetError("Failed to load timesheet summary.");
    } finally {
      setIsLoadingTimesheets(false);
    }
  }, [invoiceId, getConvertedAmount]);


  useEffect(() => {
    fetchInvoice();
    fetchPayments();
  }, [fetchInvoice, fetchPayments]);

  useEffect(() => {
    if (invoice) {
      // ✅ For finalized invoices, wait for exchangeRates to be available
      // For draft invoices, exchangeRates might be null (user can set them later)
      const isDraft = invoice.status === 'draft';
      
      // ✅ Pass exchangeRates and invoice explicitly to avoid stale closure issues
      // For finalized invoices, we need exchange rates for correct conversion
      // For draft invoices, we can fetch without exchange rates (user will set them)
      fetchTimesheetSummary(isDraft, invoice.exchangeRates || null, invoice);
    }
  }, [invoice, invoice?.exchangeRates, fetchTimesheetSummary]);

  // ========================================================================
  // PREPARE INVOICE DATA (for PDF/Word download)
  // ========================================================================

  const prepareInvoiceData = async (): Promise<WordInvoiceData | null> => {
    if (!invoice) return null;

    console.log('🔍 Invoice billing location:', invoice.billingLocation);

    // Fetch timesheet summary which includes both timesheetEntries and expenseEntries
    let lawyerFees = undefined;
    let timesheetEntries = undefined;
    let expenseEntries = undefined;
    let periodFrom = undefined;
    let periodTo = undefined;

      try {
        const response = await fetch(
          API_ENDPOINTS.invoices.timesheetSummary(invoiceId),
          {
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          }
        );

        if (response.ok) {
          const json = await response.json();
          if (json.success) {
          const { timesheetEntries: apiTimesheetEntries, expenseEntries: apiExpenseEntries, periodFrom: pf, periodTo: pt } = json.data;

          // Group timesheet entries for lawyerFees
            const grouped: Record<string, { lawyerName: string; lawyerRole: string; hours: number; hourlyRate: number; fees: number }> = {};
          for (const entry of apiTimesheetEntries || []) {
              const key = `${entry.lawyerName}-${entry.lawyerRole}`;
              if (!grouped[key]) {
                grouped[key] = {
                  lawyerName: entry.lawyerName,
                  lawyerRole: entry.lawyerRole,
                  hours: 0,
                  hourlyRate: entry.hourlyRate,
                  fees: 0,
                };
              }
              grouped[key].hours += entry.hours;
              grouped[key].fees += entry.fees;
            }
            lawyerFees = Object.values(grouped);
          timesheetEntries = apiTimesheetEntries;
          // Map expense entries to ensure proper property names
          expenseEntries = (apiExpenseEntries || []).map((exp: any) => ({
            category: exp.category,
            subCategory: exp.subCategory || exp.sub_category || null,
            description: exp.description || '',
            originalAmount: exp.originalAmount || exp.original_amount || 0,
            billedAmount: exp.amount || exp.billedAmount || 0,
            originalCurrency: exp.originalCurrency || exp.original_currency || 'INR',
            currency: exp.currency || invoice.invoiceCurrency || 'INR',
            exchangeRate: exp.exchangeRate || exp.exchange_rate || null,
          }));
            periodFrom = pf;
            periodTo = pt;
          }
        }
      } catch (err) {
      console.error("Error fetching timesheet/expense summary:", err);
    }

    // Fetch payments
    let payments = undefined;
    try {
      const paymentsResponse = await fetch(
        API_ENDPOINTS.invoices.payments.list(invoiceId),
        {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }
      );
      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json();
        if (paymentsData.success) {
          payments = (paymentsData.data || []).map((p: any) => ({
            id: p.id,
            paymentDate: p.paymentDate || p.payment_date,
            amount: p.amount,
            paymentMethod: p.paymentMethod || p.payment_method || '',
            transactionRef: p.transactionRef || p.transaction_ref || null,
            notes: p.notes || null,
          }));
        }
      }
    } catch (err) {
      console.error("Error fetching payments:", err);
    }

    // Extract partner shares (handle parent invoices with split children)
    let partnerShares = invoice.partnerShares;
    if (invoice.isParent && invoice.id) {
      try {
        const splitsResponse = await fetch(
          `${API_BASE_URL}/api/invoices/${invoice.id}/splits`,
          {
            credentials: "include",
          }
        );
        if (splitsResponse.ok) {
          const splitsData = await splitsResponse.json();
          if (splitsData.success && splitsData.data) {
            const allPartnerShares: Record<number, {
              userId: number;
              userName: string;
              userEmail?: string;
              percentage: number;
            }> = {};

            splitsData.data.forEach((split: Invoice) => {
              if (split.partnerShares && split.partnerShares.length > 0) {
                split.partnerShares.forEach((ps: any) => {
                  if (allPartnerShares[ps.userId]) {
                    allPartnerShares[ps.userId].percentage += ps.percentage;
                  } else {
                    allPartnerShares[ps.userId] = {
                      userId: ps.userId,
                      userName: ps.userName,
                      userEmail: ps.userEmail,
                      percentage: ps.percentage,
                    };
                  }
                });
              }
            });
            partnerShares = Object.values(allPartnerShares);
          }
        }
      } catch (err) {
        console.error("Error fetching split invoices for partner shares:", err);
      }
    }

    const finalAmount = invoice.finalAmount ?? invoice.subtotal ?? invoice.invoiceAmount ?? 0;
    const amountPaid = invoice.amountPaid || 0;
    const remainingAmount = finalAmount - amountPaid;

    return {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      clientName: invoice.client.name,
      clientAddress: invoice.client.address,
      matterTitle: invoice.matter?.title,
      matters: invoice.matters?.map(m => ({ id: m.id, title: m.title, currency: m.currency })) || 
               (invoice.matter ? [{ id: invoice.matter.id, title: invoice.matter.title, currency: invoice.matter.currency }] : undefined),
      periodFrom,
      periodTo,
      amount: finalAmount,
      subtotal: invoice.subtotal,
      discountType: (invoice.discountType === 'percentage' || invoice.discountType === 'fixed') ? (invoice.discountType as 'percentage' | 'fixed') : null,
      discountValue: invoice.discountValue,
      discountAmount: invoice.discountAmount,
      lawyerFees,
      timesheetEntries,
      expenseEntries,
      partnerShares,
      payments,
      billingLocation: invoice.billingLocation,
      status: invoice.status,
      amountPaid,
      remainingAmount,
      // Currency fields
      matterCurrency: invoice.matterCurrency,
      invoiceCurrency: invoice.invoiceCurrency,
      userExchangeRate: invoice.userExchangeRate,
      amountInINR: invoice.amountInINR,
      exchangeRates: invoice.exchangeRates || undefined, // Ensure it's undefined if null
      description: invoice.description,
      notes: invoice.notes || undefined, // Ensure it's undefined if null
    };
  };

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  const handleDownloadPDF = async () => {
    try {
      const invoiceData = await prepareInvoiceData();
      if (!invoiceData) {
        throw new Error('Invoice data not available');
      }

      await downloadInvoicePDF(invoiceData as any);
      // alert('Invoice PDF downloaded successfully!');
      toast.success('Invoice PDF downloaded successfully!');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      // alert(error instanceof Error ? error.message : 'Failed to download PDF');
      toast.error(error instanceof Error ? error.message : 'Failed to download PDF');
    }
  };

  const handlePreviewWord = async () => {
    try {
      const invoiceData = await prepareInvoiceData();
      if (!invoiceData) {
        throw new Error('Invoice data not available');
      }
      setPreviewInvoiceData(invoiceData);
      setShowPreviewModal(true);
    } catch (error) {
      console.error('Error preparing invoice data for preview:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load invoice preview');
    }
  };

  const handleDownloadWord = async () => {
    try {
      // If preview data exists, use it; otherwise fetch fresh
      const invoiceData = previewInvoiceData || await prepareInvoiceData();
      if (!invoiceData) {
        throw new Error('Invoice data not available');
      }

      await downloadInvoiceWord(invoiceData);
      toast.success('Invoice Word document downloaded successfully!');
      
      // Close preview modal if open
      if (showPreviewModal) {
        setShowPreviewModal(false);
      }
    } catch (error) {
      console.error('Error downloading Word document:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to download Word document');
    }
  };

  const handleEdit = () => {
    setShowEditDialog(true);
  };

  const handleEditSuccess = () => {
    setShowEditDialog(false);
    fetchInvoice();
    fetchPayments();
    fetchTimesheetSummary(invoice?.status === 'draft');
  };

  const handleRecordPaymentClick = () => {
    // If parent invoice, redirect to splits tab instead of showing payment form
    if (invoice && (invoice.isParent || (invoice.splitCount && invoice.splitCount > 0))) {
      setActiveTab('splits');
      // Scroll to splits tab content
      setTimeout(() => {
        const splitsTab = document.getElementById('splits-tab-content');
        if (splitsTab) {
          splitsTab.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      return;
    }
    // For non-parent invoices, show payment form
    setShowPaymentForm(!showPaymentForm);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!paymentForm.amount || !paymentForm.paymentMethod) {
      // alert('Please fill in all required fields');
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmittingPayment(true);

    try {
      const response = await fetch(
        API_ENDPOINTS.invoices.payments.record(invoiceId),
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentDate: paymentForm.paymentDate,
            amount: parseFloat(paymentForm.amount),
            paymentMethod: paymentForm.paymentMethod,
            transactionRef: paymentForm.transactionRef || null,
            notes: paymentForm.notes || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to record payment');
      }

      // alert('Payment recorded successfully!');
      toast.success('Payment recorded successfully!');
      setShowPaymentForm(false);
      setPaymentForm({
        paymentDate: new Date().toISOString().split('T')[0],
        amount: '',
        paymentMethod: '',
        transactionRef: '',
        notes: '',
      });

      fetchInvoice();
      fetchPayments();
    } catch (error) {
      console.error('Error recording payment:', error);
      // alert(error instanceof Error ? error.message : 'Failed to record payment');
      toast.error(error instanceof Error ? error.message : 'Failed to record payment');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // ========================================================================
  // UTILITY FUNCTIONS
  // ========================================================================

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number, currencyOverride?: string): string => {
    const currency: CurrencyCode = (currencyOverride || invoice?.invoiceCurrency || invoice?.matterCurrency || 'INR') as CurrencyCode;
    return formatAmountWithCurrency(amount, currency);
  };

  // ✅ NEW: Handle updating billed hours for a timesheet
  const handleUpdateBilledHours = async (timesheetId: number, billedHoursInHours: number, editingKey: string | number) => {
    setUpdatingTimesheetIds((prev) => new Set(prev).add(timesheetId));
    try {
      const billedHoursInMinutes = Math.round(billedHoursInHours * 60);
      const response = await fetch(
        `${API_BASE_URL}/api/invoices/${invoiceId}/timesheets/${timesheetId}`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            billedHours: billedHoursInMinutes,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to update billed hours');
      }

      // Clear editing state for this timesheet
      setEditingBilledHours((prev) => {
        const next = { ...prev };
        delete next[editingKey];
        return next;
      });

      // Refresh invoice and timesheet data
      await fetchInvoice();
      await fetchTimesheetSummary(true, invoice?.exchangeRates || null, invoice);
      toast.success('Billed hours updated successfully');
    } catch (error: any) {
      console.error('Error updating billed hours:', error);
      toast.error(error.message || 'Failed to update billed hours');
    } finally {
      setUpdatingTimesheetIds((prev) => {
        const next = new Set(prev);
        next.delete(timesheetId);
        return next;
      });
    }
  };

  // ✅ NEW: Handle updating hourly rate for a timesheet
  const handleUpdateHourlyRate = async (timesheetId: number, hourlyRate: number, editingKey: string | number) => {
    setUpdatingTimesheetIds((prev) => new Set(prev).add(timesheetId));
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/invoices/${invoiceId}/timesheets/${timesheetId}`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            hourlyRate: hourlyRate,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to update hourly rate');
      }

      // Clear editing state for this timesheet
      setEditingHourlyRates((prev) => {
        const next = { ...prev };
        delete next[editingKey];
        return next;
      });

      // Refresh invoice and timesheet data
      await fetchInvoice();
      await fetchTimesheetSummary(true, invoice?.exchangeRates || null, invoice);
      toast.success('Hourly rate updated successfully');
    } catch (error: any) {
      console.error('Error updating hourly rate:', error);
      toast.error(error.message || 'Failed to update hourly rate');
    } finally {
      setUpdatingTimesheetIds((prev) => {
        const next = new Set(prev);
        next.delete(timesheetId);
        return next;
      });
    }
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'finalized':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'invoice_uploaded':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'paid':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'partially_paid':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'overdue':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'new':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'draft':
        return 'Draft';
      case 'finalized':
        return 'Finalized';
      case 'invoice_uploaded':
        return 'Invoice Uploaded';
      case 'partially_paid':
        return 'Partially Paid';
      case 'new':
        return 'New';
      case 'paid':
        return 'Paid';
      case 'overdue':
        return 'Overdue';
      default:
        return status;
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/invoices/${invoiceId}/download-template`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to download template');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${invoice?.invoiceNumber || invoiceId}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Template downloaded successfully');
    } catch (error: any) {
      console.error('Error downloading template:', error);
      toast.error(error.message || 'Failed to download template');
    }
  };

  const getPaymentProgress = (): number => {
    const totalAmount = invoice?.finalAmount ?? invoice?.invoiceAmount ?? 0;
    if (!invoice || totalAmount === 0) return 0;
    
    // For parent invoices, use split payment total
    if (invoice.isParent && invoice.splitPaymentSummary) {
      return (invoice.splitPaymentSummary.totalPaid / totalAmount) * 100;
    }
    
    return (invoice.amountPaid / totalAmount) * 100;
  };

  const remainingAmount = invoice 
    ? (() => {
        // For parent invoices, calculate remaining from split payments
        if (invoice.isParent && invoice.splitPaymentSummary) {
          return (invoice.finalAmount ?? invoice.invoiceAmount) - invoice.splitPaymentSummary.totalPaid;
        }
        return (invoice.finalAmount ?? invoice.invoiceAmount) - invoice.amountPaid;
      })()
    : 0;

    // ========================================================================
  // RENDER
  // ========================================================================

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-[22px] shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex flex-col items-center justify-center py-24">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-lg font-medium text-gray-600">Loading invoice...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-[22px] shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex flex-col items-center justify-center py-24">
            <p className="text-lg font-medium text-red-600 mb-4">
              {error || 'Invoice not found'}
            </p>
            <Button onClick={() => router.push('/invoice?tab=invoices')}>
              Back to Invoices
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="bg-white rounded-[22px] shadow-sm border border-gray-200 overflow-hidden">
        {/* HEADER */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/invoice?tab=invoices')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} className="text-gray-600" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-gray-900">
                  Invoice #{invoice.invoiceNumber}
                </h1>
                  {invoice.isParent && invoice.splitCount && invoice.splitCount > 0 && (
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                      {invoice.splitCount} Split{invoice.splitCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Created {formatDate(invoice.createdAt)} by {invoice.creator.name}
                </p>
              </div>
            </div>

            {/* STATUS BADGE */}
            <span
              className={`px-4 py-2 rounded-full text-sm font-semibold border ${getStatusBadgeClass(
                invoice.status
              )}`}
            >
              {getStatusText(invoice.status)}
            </span>
          </div>

          {/* SPLIT INVOICE BANNER */}
          {invoice.isSplit && invoice.parentInvoiceId && (
            <div className="mb-4 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="text-blue-600" size={20} />
                  <span className="text-blue-900 font-medium">
                    This is a split invoice.{' '}
                  </span>
                  <Button
                    variant="link"
                    onClick={() => router.push(`/invoice/invoices/${invoice.parentInvoiceId}`)}
                    className="text-blue-600 p-0 h-auto font-medium"
                  >
                    View parent invoice
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ACTION BUTTONS - Status-based */}
          <div className="flex items-center gap-3 flex-wrap">
            {invoice.status === 'draft' && (
              <>
            <Button
              variant="outline"
              onClick={handleEdit}
              className="flex items-center gap-2"
            >
              <Edit2 size={16} />
              Edit Invoice
            </Button>
                <Button
                  variant="outline"
                  onClick={handlePreviewWord}
                  className="flex items-center gap-2"
                >
                  <Eye size={16} />
                  Preview Word
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadWord}
                  className="flex items-center gap-2"
                >
                  <File size={16} />
                  Download Word
                </Button>
                <Button
                  onClick={() => setShowFinalizeDialog(true)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <CheckCircle size={16} />
                  Finalize Invoice
                </Button>
              </>
            )}
            {invoice.status === 'finalized' && (
              <>
                <Button
                  variant="outline"
                  onClick={handlePreviewWord}
                  className="flex items-center gap-2"
                >
                  <Eye size={16} />
                  Preview Word
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadWord}
                  className="flex items-center gap-2"
                >
                  <File size={16} />
                  Download Word
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2"
                >
                  <Download size={16} />
                  Download Template
                </Button>
                <Button
                  onClick={() => setShowUploadDialog(true)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <Upload size={16} />
                  Upload Signed Invoice
                </Button>
              </>
            )}
            {invoice.status === 'invoice_uploaded' && (
              <>
                <Button
                  variant="outline"
                  onClick={handlePreviewWord}
                  className="flex items-center gap-2"
                >
                  <Eye size={16} />
                  Preview Invoice
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadWord}
                  className="flex items-center gap-2"
                >
                  <File size={16} />
                  Download Invoice
                </Button>
                <Button
                  onClick={handleRecordPaymentClick}
                  className="flex items-center gap-2 ml-auto bg-green-600 hover:bg-green-700"
                >
                  <DollarSign size={16} />
                  {invoice && (invoice.isParent || (invoice.splitCount && invoice.splitCount > 0)) ? 'Record Payment on Splits' : 'Record Payment'}
                </Button>
              </>
            )}
            {(invoice.status === 'paid' || invoice.status === 'partially_paid') && (
              <>
            <Button
              variant="outline"
              onClick={handlePreviewWord}
              className="flex items-center gap-2"
            >
              <Eye size={16} />
              Preview Word
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadPDF}
              className="flex items-center gap-2"
            >
              <FileText size={16} />
              Download PDF
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadWord}
              className="flex items-center gap-2"
            >
              <File size={16} />
              Download Word
            </Button>
                {invoice.status === 'partially_paid' && (
                  <Button
                    onClick={handleRecordPaymentClick}
                    className="flex items-center gap-2 ml-auto"
                  >
                    <DollarSign size={16} />
                    {invoice && (invoice.isParent || (invoice.splitCount && invoice.splitCount > 0)) ? 'Record Payment on Splits' : 'Record Payment'}
                  </Button>
                )}
              </>
            )}
            {/* Legacy status handling */}
            {invoice.status === 'new' && (
              <>
                <Button
              variant="outline"
                  onClick={handleEdit}
              className="flex items-center gap-2"
                >
                  <Edit2 size={16} />
                  Edit Invoice
                </Button>
                {!['paid', 'draft', 'new'].includes(invoice.status) && (
              <Button
                    onClick={handleRecordPaymentClick}
                className="flex items-center gap-2 ml-auto"
              >
                <DollarSign size={16} />
                    {invoice && (invoice.isParent || (invoice.splitCount && invoice.splitCount > 0)) ? 'Record Payment on Splits' : 'Record Payment'}
              </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* TABS HEADER */}
        <div className="px-6 mt-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-0">

            {/* DETAILS TAB */}
            <button
              onClick={() => setActiveTab('details')}
              className={`px-3 py-2.5 text-base font-semibold transition-colors ${
                activeTab === 'details'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Details
            </button>

            {/* TIMESHEETS TAB */}
            <button
              onClick={() => setActiveTab('timesheets')}
              className={`px-3 py-2.5 text-base font-semibold transition-colors ${
                activeTab === 'timesheets'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Timesheets
            </button>

            {/* NEW TABS - Only show for finalized invoices */}
            {invoice && ['finalized', 'invoice_uploaded', 'partially_paid', 'paid'].includes(invoice.status) && (
              <>
                {/* ITEMIZED ENTRIES TAB */}
                <button
                  onClick={() => setActiveTab('itemized')}
                  className={`px-3 py-2.5 text-base font-semibold transition-colors ${
                    activeTab === 'itemized'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Itemized Entries
                </button>

                {/* PARTNERS & SPLIT TAB */}
                <button
                  onClick={() => setActiveTab('partners')}
                  className={`px-3 py-2.5 text-base font-semibold transition-colors ${
                    activeTab === 'partners'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Partners & Split
                </button>

                {/* SPLIT INVOICES TAB - Only show for parent invoices */}
                {invoice && invoice.isParent && invoice.splitCount && invoice.splitCount > 0 && (
                  <button
                    onClick={() => setActiveTab('splits')}
                    className={`px-3 py-2.5 text-base font-semibold transition-colors ${
                      activeTab === 'splits'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    Split Invoices
                    <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                      {invoice.splitCount}
                    </span>
                  </button>
                )}

                {/* EXPENSES TAB */}
                <button
                  onClick={() => setActiveTab('expenses')}
                  className={`px-3 py-2.5 text-base font-semibold transition-colors ${
                    activeTab === 'expenses'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Expenses
                </button>

                {/* SUMMARY TAB */}
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`px-3 py-2.5 text-base font-semibold transition-colors ${
                    activeTab === 'summary'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Summary
                </button>
              </>
            )}

          </div>
        </div>


        
        {/* TAB CONTENT */}
        {activeTab === 'details' && (
          <>
            {/* PAYMENT FORM (Collapsible) - Hide for parent invoices */}
            {showPaymentForm && invoice && !invoice.isParent && (!invoice.splitCount || invoice.splitCount === 0) && (
              <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Record Payment
                  </h3>
                  <button
                    onClick={() => setShowPaymentForm(false)}
                    className="p-1 hover:bg-blue-100 rounded"
                  >
                    <X size={20} className="text-gray-600" />
                  </button>
                </div>
                <form onSubmit={handleRecordPayment} className="grid grid-cols-5 gap-4">
                  <div>
                    <Label htmlFor="paymentDate">Payment Date</Label>
                    <Input
                      id="paymentDate"
                      type="date"
                      value={paymentForm.paymentDate}
                      onChange={(e) =>
                        setPaymentForm({ ...paymentForm, paymentDate: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="amount">Amount (₹)</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="Enter amount"
                      value={paymentForm.amount}
                      onChange={(e) =>
                        setPaymentForm({ ...paymentForm, amount: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="paymentMethod">Payment Method</Label>
                    <Select
                      value={paymentForm.paymentMethod}
                      onValueChange={(value) =>
                        setPaymentForm({ ...paymentForm, paymentMethod: value })
                      }
                      required
                    >
                      <SelectTrigger id="paymentMethod">
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="check">Check</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank charges/bank fees">Bank Charges/Bank fees</SelectItem>
                        <SelectItem value="tds">TDS (Tax deducted at Source)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="transactionRef">Transaction Ref (Optional)</Label>
                    <Input
                      id="transactionRef"
                      type="text"
                      placeholder="Reference #"
                      value={paymentForm.transactionRef}
                      onChange={(e) =>
                        setPaymentForm({
                          ...paymentForm,
                          transactionRef: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="submit"
                      disabled={isSubmittingPayment}
                      className="w-full"
                    >
                      {isSubmittingPayment ? 'Recording...' : 'Record Payment'}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* CONTENT GRID */}
            <div className="grid grid-cols-3 gap-6 p-6">
              {/* LEFT COLUMN - INVOICE PREVIEW (2/3) */}
              <div className="col-span-2">
                <InvoicePreview
                  data={{
                    invoiceNumber: invoice.invoiceNumber,
                    invoiceDate: invoice.invoiceDate,
                    dueDate: invoice.dueDate,
                    clientName: invoice.client.name,
                    clientAddress: invoice.client.address,
                    matterTitle: invoice.matter?.title,
                    description: invoice.description,
                    // ✅ Calculate converted subtotal for draft invoices with exchange rates (including expenses)
                    subtotal: (() => {
                      if (invoice.status === 'draft' && invoice.exchangeRates && invoice.timesheets) {
                        const invoiceCurrency = invoice.invoiceCurrency || invoice.matterCurrency || 'INR';
                        
                        // Calculate timesheet subtotal
                        const timesheetSubtotal = invoice.timesheets.reduce((sum, ts) => {
                          const amount = ts.billedAmount ?? 0;
                          if (amount === 0) return sum;
                          const tsCurrency = (ts as any).currency || invoice.matterCurrency || invoice.invoiceCurrency || 'INR';
                          if (tsCurrency === invoiceCurrency) return sum + amount;
                          const rate = invoice.exchangeRates?.[tsCurrency];
                          if (rate && rate > 0) return sum + (amount * rate);
                          return sum + amount;
                        }, 0);
                        
                        // ✅ ADD EXPENSES to subtotal
                        let expenseSubtotal = 0;
                        if (invoice.expenses && Array.isArray(invoice.expenses) && invoice.expenses.length > 0) {
                          expenseSubtotal = invoice.expenses.reduce((sum: number, exp: { originalAmount?: number; amount?: number }) => {
                            const originalAmount = exp.originalAmount || exp.amount || 0;
                            if (originalAmount === 0) return sum;
                            
                            // Expenses are always in INR
                            if (invoiceCurrency === 'INR') {
                              return sum + originalAmount;
                            } else {
                              // Convert INR expenses to invoice currency
                              const inrRate = invoice.exchangeRates && invoice.exchangeRates['INR'];
                              if (inrRate && inrRate > 0) {
                                return sum + (originalAmount * inrRate);
                              }
                              return sum + originalAmount; // Fallback if no rate
                            }
                          }, 0);
                        }
                        
                        return timesheetSubtotal + expenseSubtotal;
                      }
                      return invoice.subtotal ?? invoice.invoiceAmount ?? 0;
                    })(),
                    // ✅ Calculate discount amount (on subtotal including expenses)
                    discountAmount: (() => {
                      if (invoice.status === 'draft' && invoice.discountType && invoice.discountValue) {
                        const subtotal = (() => {
                          if (invoice.exchangeRates && invoice.timesheets) {
                            const invoiceCurrency = invoice.invoiceCurrency || invoice.matterCurrency || 'INR';
                            
                            // Calculate timesheet subtotal
                            const timesheetSubtotal = invoice.timesheets.reduce((sum, ts) => {
                              const amount = ts.billedAmount ?? 0;
                              if (amount === 0) return sum;
                              const tsCurrency = (ts as any).currency || invoice.matterCurrency || invoice.invoiceCurrency || 'INR';
                              if (tsCurrency === invoiceCurrency) return sum + amount;
                              const rate = invoice.exchangeRates?.[tsCurrency];
                              if (rate && rate > 0) return sum + (amount * rate);
                              return sum + amount;
                            }, 0);
                            
                            // ✅ ADD EXPENSES to subtotal
                            let expenseSubtotal = 0;
                            if (invoice.expenses && Array.isArray(invoice.expenses) && invoice.expenses.length > 0) {
                              expenseSubtotal = invoice.expenses.reduce((sum: number, exp: { originalAmount?: number; amount?: number }) => {
                                const originalAmount = exp.originalAmount || exp.amount || 0;
                                if (originalAmount === 0) return sum;
                                
                                if (invoiceCurrency === 'INR') {
                                  return sum + originalAmount;
                                } else {
                                  const inrRate = invoice.exchangeRates && invoice.exchangeRates['INR'];
                                  if (inrRate && inrRate > 0) {
                                    return sum + (originalAmount * inrRate);
                                  }
                                  return sum + originalAmount;
                                }
                              }, 0);
                            }
                            
                            return timesheetSubtotal + expenseSubtotal;
                          }
                          return invoice.subtotal ?? invoice.invoiceAmount ?? 0;
                        })();
                        if (invoice.discountType === 'percentage') {
                          return subtotal * invoice.discountValue / 100;
                        } else {
                          return invoice.discountValue;
                        }
                      }
                      return invoice.discountAmount ?? 0;
                    })(),
                    // ✅ Calculate final amount (subtotal including expenses - discount)
                    amount: (() => {
                      if (invoice.status === 'draft' && invoice.exchangeRates && invoice.timesheets) {
                        const invoiceCurrency = invoice.invoiceCurrency || invoice.matterCurrency || 'INR';
                        
                        // Calculate timesheet subtotal
                        const timesheetSubtotal = invoice.timesheets.reduce((sum, ts) => {
                          const amount = ts.billedAmount ?? 0;
                          if (amount === 0) return sum;
                          const tsCurrency = (ts as any).currency || invoice.matterCurrency || invoice.invoiceCurrency || 'INR';
                          if (tsCurrency === invoiceCurrency) return sum + amount;
                          const rate = invoice.exchangeRates?.[tsCurrency];
                          if (rate && rate > 0) return sum + (amount * rate);
                          return sum + amount;
                        }, 0);
                        
                        // ✅ ADD EXPENSES to subtotal
                        let expenseSubtotal = 0;
                        if (invoice.expenses && Array.isArray(invoice.expenses) && invoice.expenses.length > 0) {
                          expenseSubtotal = invoice.expenses.reduce((sum: number, exp: { originalAmount?: number; amount?: number }) => {
                            const originalAmount = exp.originalAmount || exp.amount || 0;
                            if (originalAmount === 0) return sum;
                            
                            if (invoiceCurrency === 'INR') {
                              return sum + originalAmount;
                            } else {
                              const inrRate = invoice.exchangeRates && invoice.exchangeRates['INR'];
                              if (inrRate && inrRate > 0) {
                                return sum + (originalAmount * inrRate);
                              }
                              return sum + originalAmount;
                            }
                          }, 0);
                        }
                        
                        const totalSubtotal = timesheetSubtotal + expenseSubtotal;
                        
                        let discountAmount = 0;
                        if (invoice.discountType === 'percentage' && invoice.discountValue) {
                          discountAmount = totalSubtotal * invoice.discountValue / 100;
                        } else if (invoice.discountType === 'fixed' && invoice.discountValue) {
                          discountAmount = invoice.discountValue;
                        }
                        return totalSubtotal - discountAmount;
                      }
                      return invoice.finalAmount ?? invoice.subtotal ?? invoice.invoiceAmount ?? 0;
                    })(),
                    discountType: (invoice.discountType === 'percentage' || invoice.discountType === 'fixed') ? (invoice.discountType as 'percentage' | 'fixed') : null,
                    discountValue: invoice.discountValue,
                    currency: (invoice.invoiceCurrency || invoice.matterCurrency || 'INR') as any,
                    amountInINR: invoice.amountInINR ?? null,
                    notes: invoice.notes || undefined,
                    billingLocation: invoice.billingLocation,
                  }}
                />
              </div>

              {/* RIGHT COLUMN - DRAFT EDITOR OR PAYMENT INFO (1/3) */}
              <div className="space-y-6">
                {/* DRAFT STATE: Show discount/exchange rate editors instead of payment summary */}
                {invoice.status === 'draft' ? (
                  <DraftInvoiceEditor 
                    invoice={{
                      ...invoice,
                      exchangeRates: invoice.exchangeRates || null, // ✅ Pass saved exchange rates
                    }} 
                    onUpdate={fetchInvoice} 
                  />
                ) : (
                  <>
                {/* PAYMENT SUMMARY */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase mb-4">
                    Payment Summary
                  </h3>
                  {invoice.isParent && invoice.splitPaymentSummary && (
                    <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900">
                      <strong>Note:</strong> Total from Split Invoices: {formatCurrency(invoice.splitPaymentSummary.totalPaid, invoice.invoiceCurrency as CurrencyCode)}
                    </div>
                  )}
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Amount:</span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(
                          invoice.finalAmount ?? invoice.invoiceAmount,
                          invoice.invoiceCurrency as CurrencyCode
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Amount Paid:</span>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(
                          invoice.isParent && invoice.splitPaymentSummary 
                            ? invoice.splitPaymentSummary.totalPaid 
                            : invoice.amountPaid, 
                          invoice.invoiceCurrency as CurrencyCode
                        )}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-gray-300">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">Remaining:</span>
                        <span
                          className={`font-bold ${
                            remainingAmount > 0 ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {formatCurrency(remainingAmount, invoice.invoiceCurrency as CurrencyCode)}
                        </span>
                      </div>
                      {(invoice.finalAmount ?? invoice.invoiceAmount) > 0 && (
                        <div>
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Payment Progress</span>
                            <span>{getPaymentProgress().toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                invoice.status === 'paid'
                                  ? 'bg-green-500'
                                  : invoice.status === 'overdue'
                                  ? 'bg-red-500'
                                  : 'bg-blue-500'
                              }`}
                              style={{ width: `${getPaymentProgress()}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* PAYMENT HISTORY */}
                <div className="bg-white rounded-lg border border-gray-200">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase">
                      Payment History ({payments.length})
                    </h3>
                    {invoice.isParent && (
                      <p className="text-xs text-gray-500 mt-1">
                        Includes payments from all split invoices
                      </p>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {payments.length === 0 ? (
                      <div className="p-6 text-center text-gray-500 text-sm">
                        No payments recorded yet
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-200">
                        {payments.map((payment) => (
                          <div key={payment.id} className="p-4 hover:bg-gray-50">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-900">
                                {formatCurrency(payment.amount)}
                              </span>
                                  {payment.isSplitPayment && payment.splitInvoiceNumber && (
                                    <button
                                      onClick={() => router.push(`/invoice/invoices/${payment.splitInvoiceId}`)}
                                      className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                      title={`View split invoice ${payment.splitInvoiceNumber}`}
                                    >
                                      Split: {payment.splitInvoiceNumber}
                                    </button>
                                  )}
                                </div>
                              </div>
                              <span className="text-xs text-gray-500">
                                {formatDate(payment.paymentDate)}
                              </span>
                            </div>
                            <div className="space-y-1 text-xs text-gray-600">
                              <div className="flex justify-between">
                                <span>Method:</span>
                                <span className="font-medium">
                                  {payment.paymentMethod
                                    .replace('_', ' ')
                                    .toUpperCase()}
                                </span>
                              </div>
                              {payment.transactionRef && (
                                <div className="flex justify-between">
                                  <span>Ref:</span>
                                  <span className="font-mono">
                                    {payment.transactionRef}
                                  </span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span>Recorded by:</span>
                                <span>{payment.recorder.name}</span>
                              </div>
                              {payment.notes && (
                                <p className="mt-2 text-gray-500 italic">
                                  &quot;{payment.notes}&quot;
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'timesheets' && (
          <div className="p-6">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
              <div className="px-4 py-3 border-b border-gray-200 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Timesheets – Fees Summary
                </h3>
                <p className="text-xs text-gray-500">
                  {invoice.client.name}
                  {invoice.matter?.title ? ` – ${invoice.matter.title}` : ''}
                </p>
                  </div>
                  {invoice.status === 'draft' && (
                    <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2">
                      <p className="text-xs text-blue-700 font-medium">
                        💡 Edit billed hours to adjust invoice total. Original timesheet data remains unchanged.
                      </p>
                    </div>
                  )}
                </div>
                
                {/* ✅ UPDATED: Conditional rendering based on single date or date range */}
                {(timesheetPeriodFrom || timesheetPeriodTo) && (
                  <p className="text-xs text-gray-500">
                    {isSingleDate ? (
                      // Single date case
                      <>
                        Work performed on{' '}
                        <span className="font-semibold">
                          {timesheetPeriodFrom ? formatDate(timesheetPeriodFrom) : '—'}
                        </span>
                      </>
                    ) : (
                      // Date range case
                      <>
                        Period from{' '}
                        <span className="font-semibold">
                          {timesheetPeriodFrom ? formatDate(timesheetPeriodFrom) : '—'}
                        </span>
                        {' '}to{' '}
                        <span className="font-semibold">
                          {timesheetPeriodTo ? formatDate(timesheetPeriodTo) : '—'}
                        </span>
                      </>
                    )}
                  </p>
                )}
              </div>

              <div className="p-4">
                {isLoadingTimesheets ? (
                  <div className="flex items-center justify-center py-10 text-sm text-gray-500">
                    Loading timesheets...
                  </div>
                ) : timesheetError ? (
                  <div className="flex flex-col items-center justify-center py-10 text-sm text-red-500">
                    <p>{timesheetError}</p>
                  </div>
                ) : !timesheetRows.length ? (
                  <div className="flex flex-col items-center justify-center py-10 text-sm text-gray-500">
                    <p>No timesheet data available for this invoice.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                            Lawyer(s)
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wide">
                            {invoice.status === 'draft' ? 'Original Hours' : 'Hours'}
                          </th>
                          {invoice.status === 'draft' && (
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wide">
                              Billed Hours
                            </th>
                          )}
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wide">
                            Hourly Rate
                          </th>
                          {invoice.status === 'draft' && (
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wide">
                              Original Fees
                            </th>
                          )}
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wide">
                            {invoice.status === 'draft' ? 'Billed Fees' : 'Fees'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {timesheetRows.map((row, index) => {
                          const isDraft = invoice.status === 'draft';
                          const originalHours = isDraft ? (row.originalHours ?? row.hours) : row.hours;
                          const billedHoursInHours = isDraft ? (row.billedHours ? row.billedHours / 60 : row.hours) : row.hours;
                          const originalFees = isDraft ? (row.originalFees ?? row.fees) : row.fees;
                          
                          // Get current editing value or use billed hours
                          const timesheetId = row.timesheetId;
                          // ✅ Always initialize from billedHours if not in editing state
                          const defaultBilledHours = billedHoursInHours > 0 ? billedHoursInHours.toFixed(2) : '0.00';
                          // ✅ Always initialize from hourlyRate if not in editing state
                          const defaultHourlyRate = row.hourlyRate || 0;
                          // Use fallback key for editing state if timesheetId is missing
                          const editingKey = timesheetId ? String(timesheetId) : `temp-${row.lawyerName}-${index}`;
                          const localBilledHours = editingBilledHours[editingKey] !== undefined
                            ? editingBilledHours[editingKey]
                            : defaultBilledHours;
                          const localHourlyRate = editingHourlyRates[editingKey] !== undefined
                            ? parseFloat(editingHourlyRates[editingKey]) || defaultHourlyRate
                            : defaultHourlyRate;
                          const isUpdating = timesheetId ? updatingTimesheetIds.has(timesheetId) : false;

                          // ✅ Get currency for this timesheet
                          // For finalized invoices, row.currency is set to invoiceCurrency in grouping
                          // For draft invoices, use row.currency (original currency)
                          const timesheetCurrency = isDraft 
                            ? (row.currency || invoice?.matterCurrency || invoice?.invoiceCurrency || 'INR')
                            : invoice?.invoiceCurrency || 'INR'; // For finalized, always use invoice currency
                          const invoiceCurrency = invoice?.invoiceCurrency || 'INR';
                          
                          // ✅ For finalized invoices, row.fees is already converted (from grouping logic)
                          // For draft invoices, calculate fees based on edited hours
                          let billedFeesOriginal = 0;
                          let billedFees = 0;
                          
                          if (isDraft) {
                            // ✅ LIVE totals: calculate using what the user typed (even before blur/save)
                            const parsedLocalHours = Number.parseFloat(localBilledHours);
                            const effectiveBilledHours = Number.isFinite(parsedLocalHours) ? parsedLocalHours : billedHoursInHours;
                            // ✅ Use edited hourly rate if available, otherwise use row.hourlyRate
                            const effectiveHourlyRate = localHourlyRate > 0 ? localHourlyRate : (row.hourlyRate || 0);
                            billedFeesOriginal = effectiveHourlyRate > 0 ? effectiveBilledHours * effectiveHourlyRate : (row.billedAmount ?? row.fees);
                            // Convert to invoice currency - pass exchangeRates explicitly
                            billedFees = getConvertedAmount(billedFeesOriginal, timesheetCurrency, invoiceCurrency, invoice?.exchangeRates);
                          } else {
                            // For finalized invoices, row.fees is already in invoice currency (from grouping)
                            // row.hourlyRate is also already calculated as weighted average in invoice currency
                            // row.originalFeesTotal is set to row.fees (converted total) for consistency
                            billedFees = row.fees; // Already in invoice currency
                            // For finalized invoices, we show everything in invoice currency (no need to show original)
                            billedFeesOriginal = row.fees; // Same as billedFees for finalized (all in invoice currency)
                          }

                          // ✅ Debug: Log if timesheetId is missing
                          if (isDraft && !timesheetId) {
                            console.warn('Missing timesheetId for row:', row);
                          }

                          const handleHoursBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
                            if (!timesheetId) return;
                            const hours = parseFloat(e.target.value) || 0;
                            if (hours < 0) {
                              // Reset to original value
                              setEditingBilledHours((prev) => {
                                const next = { ...prev };
                                delete next[timesheetId];
                                return next;
                              });
                              return;
                            }
                            await handleUpdateBilledHours(timesheetId, hours, editingKey);
                          };

                          return (
                            <tr key={row.timesheetId || index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {row.lawyerName
                                ? `${row.lawyerName} (${row.lawyerRole})`
                                : row.lawyerRole}
                                {row.date && isDraft && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {formatDate(row.date)}
                                  </div>
                                )}
                            </td>
                              {/* Original Hours (readonly, grey) */}
                              <td className="px-4 py-3 text-sm text-right">
                                {isDraft ? (
                                  <span className="text-gray-400">{originalHours.toFixed(2)}</span>
                                ) : (
                                  <span className="text-gray-700">{row.hours.toFixed(2)}</span>
                                )}
                            </td>
                              {/* Billed Hours (editable) */}
                              {isDraft && (
                                <td className="px-4 py-3 text-sm text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={localBilledHours}
                                      onChange={(e) => {
                                        const newValue = e.target.value;
                                        // ✅ Use the same editingKey as defined above
                                        const key = timesheetId || `temp-${row.lawyerName}-${index}`;
                                        setEditingBilledHours((prev) => ({
                                          ...prev,
                                          [key]: newValue,
                                        }));
                                      }}
                                      onBlur={async (e) => {
                                        if (!timesheetId) {
                                          console.error('❌ Cannot save: Missing timesheetId for row:', row);
                                          return;
                                        }
                                        const hours = parseFloat(e.target.value) || 0;
                                        if (hours < 0) {
                                          // Reset to original value
                                          setEditingBilledHours((prev) => {
                                            const next = { ...prev };
                                            delete next[timesheetId];
                                            return next;
                                          });
                                          return;
                                        }
                                        await handleUpdateBilledHours(timesheetId, hours, editingKey);
                                      }}
                                      onKeyDown={(e) => {
                                        // Allow Enter key to trigger blur/save
                                        if (e.key === 'Enter') {
                                          e.currentTarget.blur();
                                        }
                                      }}
                                      className={`w-24 h-9 text-right text-sm border-2 focus:ring-2 bg-white ${
                                        timesheetId 
                                          ? 'border-blue-400 focus:ring-blue-500' 
                                          : 'border-red-400 focus:ring-red-500'
                                      }`}
                                      disabled={isUpdating}
                                      title={timesheetId ? 'Edit billed hours (Press Enter or blur to save)' : '⚠️ Missing ID - You can edit but cannot save. Check console for details.'}
                                    />
                                    {isUpdating && (
                                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                    )}
                                    {!timesheetId && (
                                      <span className="text-xs text-red-500" title="Missing timesheetId - cannot save changes">⚠️</span>
                                    )}
                                  </div>
                                </td>
                              )}
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {isDraft ? (
                                <div className="flex flex-col items-end gap-1">
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={(() => {
                                        const defaultRate = row.hourlyRate || 0;
                                        const defaultRateStr = defaultRate > 0 ? defaultRate.toFixed(2) : '0.00';
                                        return editingHourlyRates[editingKey] !== undefined
                                          ? editingHourlyRates[editingKey]
                                          : defaultRateStr;
                                      })()}
                                      onChange={(e) => {
                                        const newValue = e.target.value;
                                        setEditingHourlyRates((prev) => ({
                                          ...prev,
                                          [editingKey]: newValue,
                                        }));
                                      }}
                                      onBlur={async (e) => {
                                        if (!timesheetId) {
                                          console.error('❌ Cannot save: Missing timesheetId for row:', row);
                                          return;
                                        }
                                        const rate = parseFloat(e.target.value) || 0;
                                        if (rate < 0) {
                                          // Reset to original value
                                          setEditingHourlyRates((prev) => {
                                            const next = { ...prev };
                                            delete next[editingKey];
                                            return next;
                                          });
                                          return;
                                        }
                                        await handleUpdateHourlyRate(timesheetId, rate, editingKey);
                                      }}
                                      onKeyDown={(e) => {
                                        // Allow Enter key to trigger blur/save
                                        if (e.key === 'Enter') {
                                          e.currentTarget.blur();
                                        }
                                      }}
                                      className={`w-24 h-9 text-right text-sm border-2 focus:ring-2 bg-white ${
                                        timesheetId 
                                          ? 'border-blue-400 focus:ring-blue-500' 
                                          : 'border-red-400 focus:ring-red-500'
                                      }`}
                                      disabled={isUpdating}
                                      title={timesheetId ? 'Edit hourly rate (Press Enter or blur to save)' : '⚠️ Missing ID - You can edit but cannot save. Check console for details.'}
                                    />
                                    {isUpdating && (
                                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                    )}
                                    {!timesheetId && (
                                      <span className="text-xs text-red-500" title="Missing timesheetId - cannot save changes">⚠️</span>
                                    )}
                                  </div>
                                  {timesheetCurrency !== invoiceCurrency && (
                                    <span className="text-xs text-gray-500">
                                      {timesheetCurrency}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                // ✅ For finalized invoices, hourlyRate is already in invoice currency (weighted average)
                                <div className="flex flex-col items-end">
                                  <span>{formatCurrency(row.hourlyRate, invoiceCurrency)}</span>
                                  <span className="text-xs text-gray-500 mt-0.5">
                                    {invoiceCurrency}
                                  </span>
                                </div>
                              )}
                            </td>
                              {/* Original Fees (readonly, grey) */}
                              {isDraft && (
                                <td className="px-4 py-3 text-sm text-right">
                                  <div className="flex flex-col items-end">
                                    <span className="text-gray-400">{formatCurrency(originalFees, timesheetCurrency)}</span>
                                    {timesheetCurrency !== invoiceCurrency && invoice?.exchangeRates?.[timesheetCurrency] && (
                                      <span className="text-xs text-gray-400 mt-0.5">
                                        ≈ {formatCurrency(getConvertedAmount(originalFees, timesheetCurrency, invoiceCurrency, invoice?.exchangeRates), invoiceCurrency)}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              )}
                              {/* Billed Fees */}
                            <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                                <div className="flex flex-col items-end">
                                  <span>{formatCurrency(billedFees, invoiceCurrency)}</span>
                                  {/* Only show original currency for draft invoices with different currency */}
                                  {isDraft && timesheetCurrency !== invoiceCurrency && (
                                    <span className="text-xs text-gray-500 mt-0.5 font-normal">
                                      ({formatCurrency(billedFeesOriginal, timesheetCurrency)})
                                    </span>
                                  )}
                                </div>
                            </td>
                          </tr>
                          );
                        })}

                        {/* Sub-total row */}
                        <tr className="bg-gray-50 font-semibold">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            Sub-Total
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {invoice.status === 'draft'
                              ? timesheetRows
                                  .reduce((sum, r) => sum + (r.originalHours ?? r.hours), 0)
                                  .toFixed(2)
                              : timesheetRows
                              .reduce((sum, r) => sum + r.hours, 0)
                              .toFixed(2)}
                          </td>
                          {invoice.status === 'draft' && (
                            <td className="px-4 py-3 text-sm text-right text-gray-900">
                              {timesheetRows
                                .reduce((sum, r, idx) => {
                                  const key = r.timesheetId || `temp-${r.lawyerName}-${idx}`;
                                  const local = editingBilledHours[key];
                                  const localHours = local !== undefined ? Number.parseFloat(local) : NaN;
                                  const hours = Number.isFinite(localHours)
                                    ? localHours
                                    : (r.billedHours ? r.billedHours / 60 : r.hours);
                                  return sum + (Number.isFinite(hours) ? hours : 0);
                                }, 0)
                                .toFixed(2)}
                            </td>
                          )}
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {/* Empty to match Word layout */}
                          </td>
                          {invoice.status === 'draft' && (
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                              {/* Original Fees Total - in original currencies */}
                            {formatCurrency(
                                timesheetRows.reduce((sum, r, idx) => {
                                  const key = r.timesheetId ? String(r.timesheetId) : `temp-${r.lawyerName}-${idx}`;
                                  const local = editingBilledHours[key];
                                  const localHours = local !== undefined ? Number.parseFloat(local) : NaN;
                                  const hours = Number.isFinite(localHours)
                                    ? localHours
                                    : (r.billedHours ? r.billedHours / 60 : r.hours);
                                  // ✅ Use edited hourly rate if available
                                  const localRate = editingHourlyRates[key];
                                  const effectiveRate = localRate !== undefined ? (Number.parseFloat(localRate) || r.hourlyRate || 0) : (r.hourlyRate || 0);
                                  const fees = effectiveRate > 0 ? hours * effectiveRate : (r.billedAmount ?? r.fees);
                                  return sum + (Number.isFinite(fees) ? fees : 0);
                                }, 0)
                              )}
                            </td>
                          )}
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {/* ✅ Billed Fees Total - Converted to invoice currency */}
                            {(() => {
                              const invoiceCurrency = invoice?.invoiceCurrency || 'INR';
                              const total = invoice.status === 'draft'
                                ? timesheetRows.reduce((sum, r, idx) => {
                                    const key = r.timesheetId ? String(r.timesheetId) : `temp-${r.lawyerName}-${idx}`;
                                    const local = editingBilledHours[key];
                                    const localHours = local !== undefined ? Number.parseFloat(local) : NaN;
                                    const hours = Number.isFinite(localHours)
                                      ? localHours
                                      : (r.billedHours ? r.billedHours / 60 : r.hours);
                                    // ✅ Use edited hourly rate if available
                                    const localRate = editingHourlyRates[key];
                                    const effectiveRate = localRate !== undefined ? (Number.parseFloat(localRate) || r.hourlyRate || 0) : (r.hourlyRate || 0);
                                    const feesOriginal = effectiveRate > 0 ? hours * effectiveRate : (r.billedAmount ?? r.fees);
                                    const tsCurrency = r.currency || invoice?.matterCurrency || invoiceCurrency;
                                    const feesConverted = getConvertedAmount(feesOriginal, tsCurrency, invoiceCurrency, invoice?.exchangeRates);
                                    return sum + (Number.isFinite(feesConverted) ? feesConverted : 0);
                                  }, 0)
                                : timesheetRows.reduce((sum, r) => {
                                    // ✅ For finalized invoices, r.fees is already converted to invoice currency (from grouping)
                                    // No need to convert again, just sum directly
                                    return sum + (Number.isFinite(r.fees) ? r.fees : 0);
                                  }, 0);
                              return formatCurrency(total, invoiceCurrency);
                            })()}
                          </td>
                        </tr>

                        {/* Total Fees row */}
                        <tr className="bg-gray-100 font-bold border-t border-gray-300">
                          {/* <td className="px-4 py-3 text-sm text-gray-900"></td> */}
                          <td className="px-4 py-3 text-sm text-right text-gray-900"></td>
                          {invoice.status === 'draft' && (
                            <td className="px-4 py-3 text-sm text-right text-gray-900"></td>
                          )}
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {invoice.status === 'draft' && (
                              <span className="text-gray-400 mr-4">Sub-Total:</span>
                            )}
                          </td>
                          {invoice.status === 'draft' && (
                            <td className="px-4 py-3 text-sm text-right text-gray-900"></td>
                          )}
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            Total Fees
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {(() => {
                              if (invoice.status === 'draft') {
                                // ✅ Calculate total using converted amounts (same logic as Billed Fees Sub-Total)
                                const invoiceCurrency = invoice?.invoiceCurrency || 'INR';
                                const total = timesheetRows.reduce((sum, r, idx) => {
                                  const key = r.timesheetId ? String(r.timesheetId) : `temp-${r.lawyerName}-${idx}`;
                                  const local = editingBilledHours[key];
                                  const localHours = local !== undefined ? Number.parseFloat(local) : NaN;
                                  const hours = Number.isFinite(localHours)
                                    ? localHours
                                    : (r.billedHours ? r.billedHours / 60 : r.hours);
                                  // ✅ Use edited hourly rate if available
                                  const localRate = editingHourlyRates[key];
                                  const effectiveRate = localRate !== undefined ? (Number.parseFloat(localRate) || r.hourlyRate || 0) : (r.hourlyRate || 0);
                                  const feesOriginal = effectiveRate > 0 ? hours * effectiveRate : (r.billedAmount ?? r.fees);
                                  const tsCurrency = r.currency || invoice?.matterCurrency || invoiceCurrency;
                                  const feesConverted = getConvertedAmount(feesOriginal, tsCurrency, invoiceCurrency, invoice?.exchangeRates);
                                  return sum + (Number.isFinite(feesConverted) ? feesConverted : 0);
                                }, 0);
                                return formatCurrency(total, invoiceCurrency);
                              } else {
                                // ✅ For finalized invoices, sum the timesheet rows (same as Sub-Total)
                                // Don't use invoice.finalAmount which includes discount - use actual timesheet totals
                                const invoiceCurrency = invoice?.invoiceCurrency || 'INR';
                                const total = timesheetRows.reduce((sum, r) => {
                                  // ✅ For finalized invoices, r.fees is already converted to invoice currency (from grouping)
                                  return sum + (Number.isFinite(r.fees) ? r.fees : 0);
                                }, 0);
                                return formatCurrency(total, invoiceCurrency);
                              }
                            })()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ITEMIZED ENTRIES TAB */}
        {activeTab === 'itemized' && invoice && ['finalized', 'invoice_uploaded', 'partially_paid', 'paid'].includes(invoice.status) && (
          <ItemizedEntriesTab invoice={invoice} />
        )}

        {/* PARTNERS & SPLIT TAB */}
        {activeTab === 'partners' && invoice && ['finalized', 'invoice_uploaded', 'partially_paid', 'paid'].includes(invoice.status) && (
          <PartnersSplitTab invoice={invoice} />
        )}

        {/* SPLIT INVOICES TAB */}
        {activeTab === 'splits' && invoice && invoice.isParent && (
          <SplitInvoicesTab invoice={invoice} />
        )}

        {/* EXPENSES TAB */}
        {activeTab === 'expenses' && invoice && ['finalized', 'invoice_uploaded', 'partially_paid', 'paid'].includes(invoice.status) && (
          <ExpensesTab invoice={invoice} />
        )}

        {/* SUMMARY TAB */}
        {activeTab === 'summary' && invoice && ['finalized', 'invoice_uploaded', 'partially_paid', 'paid'].includes(invoice.status) && (
          <SummaryTab invoice={invoice} payments={payments} timesheetRows={timesheetRows} />
        )}
      </div>

      {/* EDIT DIALOG */}
      <InvoiceDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        mode="edit"
        invoiceId={invoiceId}
        onSuccess={handleEditSuccess}
      />

      {showFinalizeDialog && invoice && (
        <FinalizeInvoiceDialog
          open={showFinalizeDialog}
          onOpenChange={setShowFinalizeDialog}
          invoiceId={invoiceId}
          invoiceAmount={invoice.finalAmount || invoice.invoiceAmount}
          onSuccess={() => {
            fetchInvoice();
            setShowFinalizeDialog(false);
          }}
        />
      )}

      {showUploadDialog && (
        <UploadInvoiceDialog
          open={showUploadDialog}
          onOpenChange={setShowUploadDialog}
          invoiceId={invoiceId}
          onSuccess={() => {
            fetchInvoice();
            setShowUploadDialog(false);
          }}
        />
      )}

      {/* PREVIEW MODAL */}
      <InvoicePreviewModal
        open={showPreviewModal}
        onOpenChange={setShowPreviewModal}
        invoiceData={previewInvoiceData}
        onDownload={handleDownloadWord}
      />
    </div>
  );
}