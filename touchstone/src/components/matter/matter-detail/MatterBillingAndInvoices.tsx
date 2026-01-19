'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Search, Edit2, Trash2, Download, Eye, FileText, File } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { API_ENDPOINTS } from '@/lib/api';
import { downloadInvoicePDF } from '@/lib/pdfUtils';
import { downloadInvoiceWord } from '@/lib/wordUtils';
import { toast } from 'react-toastify';

interface Invoice {
  id: number;
  invoiceNumber: string;
  clientId: number;
  matterId: number | null;
  invoiceDate: string;
  dueDate: string;
  invoiceAmount: number;
  amountPaid: number;
  isSplit: boolean;
  status: 'new' | 'partially_paid' | 'paid' | 'overdue';
  description: string;
  notes: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  client: {
    id: number;
    name: string;
    address: string;
  };
  matter: {
    id: number;
    title: string;
  } | null;
  creator: {
    id: number;
    name: string;
  };
}

interface MatterBillingAndInvoicesProps {
  matterId: number;
  matterTitle?: string;
  clientName?: string;
}

export default function MatterBillingAndInvoices({ 
  matterId, 
  matterTitle, 
  clientName 
}: MatterBillingAndInvoicesProps) {
  const router = useRouter();
  const abortControllerRef = useRef<AbortController | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);

  // ============================================================================
  // DROPDOWN HANDLING
  // ============================================================================

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleDropdown = (invoiceId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenDropdownId(openDropdownId === invoiceId ? null : invoiceId);
  };

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchMatterInvoices = useCallback(async () => {
    if (!matterId) {
      console.error('❌ Matter ID is missing');
      setError('Matter ID is required');
      setIsLoading(false);
      return;
    }

    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      setIsLoading(true);
      setError(null);

      const invoiceUrl = API_ENDPOINTS.invoices.byMatter(matterId);
      console.log('🔍 Fetching invoices from:', invoiceUrl);

      const response = await fetch(invoiceUrl, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortControllerRef.current.signal,
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        
        let errorMessage = 'Failed to fetch invoices';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          console.error('❌ Error data:', errorData);
        } catch (e) {
          console.error('❌ Could not parse error response', e);
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('📦 Invoice data:', data);

      if (data.success) {
        console.log('✅ Number of invoices:', data.data?.length || 0);
        
        // Auto-detect overdue invoices
        const invoicesWithStatus = data.data.map((invoice: Invoice) => {
          if (invoice.status !== 'paid') {
            const dueDate = new Date(invoice.dueDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (dueDate < today) {
              return { ...invoice, status: 'overdue' as const };
            }
          }
          return invoice;
        });
        
        setInvoices(invoicesWithStatus);
      } else {
        console.error('❌ API returned success: false', data.message);
        setError(data.message || 'Failed to load invoices');
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      console.error('💥 Fetch invoices error:', err);
      setError('Failed to load invoices. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [matterId, router]);

  useEffect(() => {
    console.log('🚀 Component mounted, matterId:', matterId);
    fetchMatterInvoices();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchMatterInvoices]);

  // ============================================================================
  // FILTERING
  // ============================================================================

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const matchesSearch =
        invoice.invoiceNumber
          .toLowerCase()
          .includes(searchQuery.toLowerCase().trim()) ||
        invoice.description
          .toLowerCase()
          .includes(searchQuery.toLowerCase().trim());

      const matchesStatus =
        statusFilter === 'All' || invoice.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchQuery, statusFilter]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
  };

  const handleView = (invoiceId: number) => {
    router.push(`/invoice/invoices/${invoiceId}`);
  };



  const handleDelete = async (invoiceId: number) => {
    const confirmed = confirm(
      'Are you sure you want to delete this invoice? This action cannot be undone.'
    );
    if (!confirmed) return;

    try {
      const response = await fetch(API_ENDPOINTS.invoices.delete(invoiceId), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete invoice');
      }

      fetchMatterInvoices();
      // alert('Invoice deleted successfully');
      toast.success('Invoice deleted successfully');
    } catch (err) {
      console.error('Error deleting invoice:', err);
      // alert(err instanceof Error ? err.message : 'Failed to delete invoice');
      toast.error(err instanceof Error ? err.message : 'Failed to delete invoice');
    }
  };

  const prepareInvoiceData = async (invoice: Invoice) => {
    let lawyerFees = undefined;
    let periodFrom = undefined;
    let periodTo = undefined;

    if (invoice.matterId) {
      try {
        const timesheetResponse = await fetch(
          API_ENDPOINTS.invoices.timesheetSummary(invoice.id),
          {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        if (timesheetResponse.ok) {
          const timesheetData = await timesheetResponse.json();
          if (timesheetData.success) {
            // Transform lawyerFees to ensure lawyerRole is a string
            lawyerFees = timesheetData.data.lawyerFees?.map((fee: {
              lawyerName: string;
              lawyerRole: string | { name?: string } | undefined;
              hours: number;
              hourlyRate: number;
              fees: number;
            }) => ({
              lawyerName: fee.lawyerName,
              lawyerRole: typeof fee.lawyerRole === 'object' && fee.lawyerRole?.name 
                ? fee.lawyerRole.name 
                : fee.lawyerRole || 'Unknown',
              hours: fee.hours,
              hourlyRate: fee.hourlyRate,
              fees: fee.fees
            }));
            periodFrom = timesheetData.data.periodFrom;
            periodTo = timesheetData.data.periodTo;
          }
        }
      } catch (err) {
        console.error('Error fetching timesheet summary:', err);
      }
    }

    return {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      clientName: invoice.client.name,
      clientAddress: invoice.client.address,
      matterTitle: invoice.matter?.title,
      periodFrom,
      periodTo,
      amount: invoice.invoiceAmount,
      lawyerFees,
      status: invoice.status || 'draft',
      amountPaid: invoice.amountPaid || 0,
      remainingAmount: (invoice.invoiceAmount || 0) - (invoice.amountPaid || 0),
    };
  };

  const handleDownloadPDF = async (invoice: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenDropdownId(null);
    
    try {
      const invoiceData = await prepareInvoiceData(invoice);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await downloadInvoicePDF(invoiceData as any);
      // alert('Invoice PDF downloaded successfully!');
      toast.success('Invoice PDF downloaded successfully!');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      // alert(error instanceof Error ? error.message : 'Failed to download PDF');
      toast.error(error instanceof Error ? error.message : 'Failed to download PDF');
    }
  };

  const handleDownloadWord = async (invoice: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenDropdownId(null);
    
    try {
      const invoiceData = await prepareInvoiceData(invoice);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await downloadInvoiceWord(invoiceData as any);
      // alert('Invoice Word document downloaded successfully!');
      toast.success('Invoice Word document downloaded successfully!');
    } catch (error) {
      console.error('Error downloading Word document:', error);
      // alert(error instanceof Error ? error.message : 'Failed to download Word document');
      toast.error(error instanceof Error ? error.message : 'Failed to download Word document');
    }
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number): string => {
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-700';
      case 'partially_paid':
        return 'bg-blue-100 text-blue-700';
      case 'overdue':
        return 'bg-red-100 text-red-700';
      case 'new':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
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

  const getPaymentProgress = (invoice: Invoice): number => {
    if (invoice.invoiceAmount === 0) return 0;
    return (invoice.amountPaid / invoice.invoiceAmount) * 100;
  };

  const summary = useMemo(() => {
    const totalInvoices = invoices.length;
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.invoiceAmount, 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
    const totalPending = totalAmount - totalPaid;
    
    return {
      totalInvoices,
      totalAmount,
      totalPaid,
      totalPending,
    };
  }, [invoices]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-visible">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Invoices</h2>
          {(matterTitle || clientName) && (
            <div className="mt-1">
              {matterTitle && (
                <p className="text-sm text-gray-600">
                  Matter: <span className="font-medium text-gray-900">{matterTitle}</span>
                </p>
              )}
              {clientName && (
                <p className="text-sm text-gray-600">
                  Client: <span className="font-medium text-gray-900">{clientName}</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* SUMMARY CARDS */}
        {!isLoading && !error && (
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-xs text-gray-600 font-medium uppercase">Total Invoices</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{summary.totalInvoices}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-xs text-gray-600 font-medium uppercase">Total Amount</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary.totalAmount)}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-xs text-gray-600 font-medium uppercase">Total Paid</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(summary.totalPaid)}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-xs text-gray-600 font-medium uppercase">Total Pending</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{formatCurrency(summary.totalPending)}</p>
              </div>
            </div>
          </div>
        )}

        {/* FILTERS */}
        <div className="px-6 py-4 flex items-center gap-4 border-b border-gray-200">
          <div className="flex-1 max-w-md relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search by Invoice # or Description"
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 text-sm text-gray-800 placeholder-gray-400 bg-white border border-gray-300 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="status-filter" className="text-sm font-medium text-gray-600">
              Status:
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={handleStatusFilterChange}
              className="px-3 py-2 text-sm text-gray-800 bg-white border border-gray-300 rounded-md cursor-pointer focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
            >
              <option value="All">All</option>
              <option value="new">New</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto overflow-visible">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice Date
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                      <p className="text-sm font-medium">Loading invoices...</p>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-red-500">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-sm font-medium">Error loading invoices</p>
                      <p className="text-xs">{error}</p>
                      <button
                        onClick={fetchMatterInvoices}
                        className="mt-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-sm font-medium">No invoices found</p>
                      <p className="text-xs">
                        {invoices.length === 0
                          ? 'No invoices have been created for this matter yet'
                          : 'Try adjusting your search or filters'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => handleView(invoice.id)}
                  >
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-blue-600">
                        {invoice.invoiceNumber}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {invoice.description}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm text-gray-900">
                        {formatDate(invoice.invoiceDate)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm text-gray-900">
                        {formatDate(invoice.dueDate)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-sm font-semibold text-gray-900">
                        {formatCurrency(invoice.invoiceAmount)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center justify-center gap-2 text-xs">
                          <span className="text-gray-900 font-medium">
                            {formatCurrency(invoice.amountPaid)}
                          </span>
                          <span className="text-gray-400">/</span>
                          <span className="text-gray-500">
                            {formatCurrency(invoice.invoiceAmount)}
                          </span>
                        </div>
                        {invoice.invoiceAmount > 0 && (
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${
                                invoice.status === 'paid'
                                  ? 'bg-green-500'
                                  : invoice.status === 'overdue'
                                  ? 'bg-red-500'
                                  : 'bg-blue-500'
                              }`}
                              style={{ width: `${getPaymentProgress(invoice)}%` }}
                            ></div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(
                          invoice.status
                        )}`}
                      >
                        {getStatusText(invoice.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1" data-invoice-id={invoice.id}>
                        <button
                          onClick={() => handleView(invoice.id)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        
                        
                        {/* Download Dropdown */}
                        <div className="relative" ref={openDropdownId === invoice.id ? dropdownRef : null}>
                          <button
                            onClick={(e) => toggleDropdown(invoice.id, e)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                            title="Download"
                          >
                            <Download size={16} />
                          </button>
                          
                          {openDropdownId === invoice.id && (
                            <div className="fixed bg-white rounded-lg shadow-xl border border-gray-200 z-[9999] w-44"
                                 style={{
                                   top: `${(document.querySelector(`[data-invoice-id="${invoice.id}"]`) as HTMLElement)?.getBoundingClientRect().top - 90 || 0}px`,
                                   left: `${(document.querySelector(`[data-invoice-id="${invoice.id}"]`) as HTMLElement)?.getBoundingClientRect().right - 176 || 0}px`
                                 }}>
                              <div className="py-1">
                                <button
                                  onClick={(e) => handleDownloadPDF(invoice, e)}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors rounded-t-lg"
                                >
                                  <FileText size={16} className="text-red-500" />
                                  Download as PDF
                                </button>
                                <button
                                  onClick={(e) => handleDownloadWord(invoice, e)}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors rounded-b-lg"
                                >
                                  <File size={16} className="text-blue-500" />
                                  Download as Word
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => handleDelete(invoice.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}