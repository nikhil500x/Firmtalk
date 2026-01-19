'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Search, Edit2, Trash2, Download, FileText, File, ArrowUpDown, ArrowUp, ArrowDown,Check,X, ChevronsUpDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { API_ENDPOINTS } from '@/lib/api';
import { downloadInvoicePDF } from '@/lib/pdfUtils';
import { downloadInvoiceWord } from '@/lib/wordUtils';
import { createPortal } from 'react-dom';
import Pagination, { usePagination } from '@/components/Pagination';
import { Badge } from '@/components/ui/badge';
import CurrencyBadge from '@/components/ui/currency-badge';
import { formatAmountWithCurrency, type CurrencyCode } from '@/lib/currencyUtils';
import { Info } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { toast } from 'react-toastify';


/**
 * Invoice Interface Definition
 */
interface Invoice {
  id: number;
  invoiceNumber: string;
  clientId: number;
  matterId: number | null;
  invoiceDate: string;
  dueDate: string;
  invoiceAmount: number;
  finalAmount?: number; // ✅ Final amount after discount
  subtotal?: number; // ✅ Subtotal before discount
  amountPaid: number;
  isSplit: boolean;
  status: 'new' | 'draft' | 'finalized' | 'invoice_uploaded' | 'partially_paid' | 'paid' | 'overdue';
  description: string;
  notes: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  matter_currency?: string;
  invoice_currency?: string;
  currency_conversion_rate?: number;
  invoice_amount_in_matter_currency?: number;
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
  isParent?: boolean;
}

interface InvoicesTableProps {
  refreshTrigger: number;
  onEdit?: (invoice: Invoice) => void;
}

export default function InvoicesTable({
  refreshTrigger,
  onEdit,
}: InvoicesTableProps) {
  const router = useRouter();
  const abortControllerRef = useRef<AbortController | null>(null);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [clientFilter, setClientFilter] = useState<string[]>([]);
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const clientDropdownRef = useRef<HTMLDivElement>(null);  
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]); // Changed from statusFilter
  const [statusFilterOpen, setStatusFilterOpen] = useState(false); // New state for filter dropdown  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: 'invoiceDate' | 'dueDate' | 'invoiceAmount' | 'invoiceNumber' | null;
    direction: 'asc' | 'desc' | null;
  }>({ key: null, direction: null });
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null); // ✅ Make sure this line exists


  const {
    currentPage,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    resetToFirstPage,
    getPaginatedData,
  } = usePagination(10); // default 10 per page


  // ============================================================================
  // DROPDOWN HANDLING
  // ============================================================================

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
        setClientDropdownOpen(false);
        setClientSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleDropdown = (invoiceId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (openDropdownId === invoiceId) {
      setOpenDropdownId(null);
    } else {
      setOpenDropdownId(invoiceId);
      
      // Calculate position relative to viewport
      const button = buttonRefs.current.get(invoiceId);
      if (button) {
        const rect = button.getBoundingClientRect();
        const dropdownHeight = 88; // Approximate height of dropdown (2 buttons * ~44px each)
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        
        // Position above if not enough space below
        const shouldPositionAbove = spaceBelow < dropdownHeight && spaceAbove > dropdownHeight;
        
        setDropdownPosition({
          top: shouldPositionAbove ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
          left: rect.right - 176 // 176px = width of dropdown (44 * 4 = w-44)
        });
      }
    }
  };

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchInvoices = useCallback(async () => {
    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(API_ENDPOINTS.invoices.list, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        
        // Try to get error message from response
        let errorMessage = 'Failed to fetch invoices';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          console.error('❌ Error data:', errorData);
        } catch (e) {
          console.error('❌ Could not parse error response',e);
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.success) {
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
      console.error('💥 Error type:', err instanceof Error ? err.constructor.name : typeof err);
      console.error('💥 Error message:', err instanceof Error ? err.message : String(err));
      setError('Failed to load invoices. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchInvoices();

    // Cleanup function to abort request when component unmounts
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchInvoices, refreshTrigger]);

  // ============================================================================
  // FILTERING
  // ============================================================================

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const matchesSearch =
        invoice.invoiceNumber
          .toLowerCase()
          .includes(searchQuery.toLowerCase().trim()) ||
        invoice.client.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase().trim()) ||
        (invoice.matter?.title || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase().trim()) ||
        invoice.description
          .toLowerCase()
          .includes(searchQuery.toLowerCase().trim());

      const matchesClient =
        clientFilter.length === 0 || clientFilter.includes(invoice.client.name);

      // If no statuses selected, show all. Otherwise, match any selected status
      const matchesStatus =
        selectedStatuses.length === 0 || selectedStatuses.includes(invoice.status);

      return matchesSearch && matchesClient && matchesStatus;
    });
  }, [invoices, searchQuery, clientFilter, selectedStatuses]);

  const sortedInvoices = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return filteredInvoices;
    }

    const sorted = [...filteredInvoices].sort((a, b) => {
      if (sortConfig.key === 'invoiceDate' || sortConfig.key === 'dueDate') {
        const aValue = new Date(a[sortConfig.key]);
        const bValue = new Date(b[sortConfig.key]);
        return aValue.getTime() - bValue.getTime();
      } else if (sortConfig.key === 'invoiceAmount') {
        // ✅ Sort by finalAmount (after discount) if available
        const aAmount = a.finalAmount ?? a.invoiceAmount;
        const bAmount = b.finalAmount ?? b.invoiceAmount;
        return aAmount - bAmount;
      } else if (sortConfig.key === 'invoiceNumber') {
        return a.invoiceNumber.localeCompare(b.invoiceNumber);
      }
      return 0;
    });

    return sortConfig.direction === 'desc' ? sorted.reverse() : sorted;
  }, [filteredInvoices, sortConfig]);

  const paginatedInvoices = useMemo(() => {
    return getPaginatedData(sortedInvoices);
  }, [sortedInvoices, currentPage, itemsPerPage, getPaginatedData]);

  useEffect(() => {
    resetToFirstPage();
  }, [searchQuery, selectedStatuses, clientFilter, resetToFirstPage]);


  // Status options for filter (including new invoice revamp statuses)
const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'finalized', label: 'Finalized' },
  { value: 'invoice_uploaded', label: 'Invoice Uploaded' },
  { value: 'new', label: 'New' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' }
];

// ============================================================================
// MULTI-SELECT STATUS FILTER HANDLERS
// ============================================================================

const toggleStatusSelection = (status: string) => {
  setSelectedStatuses(prev => {
    if (prev.includes(status)) {
      return prev.filter(s => s !== status);
    } else {
      return [...prev, status];
    }
  });
};

const clearStatusFilters = () => {
  setSelectedStatuses([]);
};

const clearAllFilters = () => {
  setSelectedStatuses([]);
  setClientFilter([]);
  setSearchQuery('');
};

// Count active filters
const activeFilterCount = clientFilter.length + selectedStatuses.length;



  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const toggleClientSelection = (clientName: string) => {
    setClientFilter(prev => {
      if (prev.includes(clientName)) {
        return prev.filter(c => c !== clientName);
      } else {
        return [...prev, clientName];
      }
    });
  };

  const clearClientFilters = () => {
    setClientFilter([]);
  };

  // const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
  //   setStatusFilter(e.target.value);
  // };

  // Get unique clients for filter (must be before filteredClients)
  const clients = useMemo(() => {
    const clientSet = new Set(invoices.map((inv) => inv.client.name));
    return Array.from(clientSet);
  }, [invoices]);


  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) return clients;
    return clients.filter(client =>
      client.toLowerCase().includes(clientSearchQuery.toLowerCase().trim())
    );
  }, [clients, clientSearchQuery]);

  

  const handleSort = (key: 'invoiceDate' | 'dueDate' | 'invoiceAmount' | 'invoiceNumber') => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        if (prev.direction === 'asc') {
          return { key, direction: 'desc' };
        } else if (prev.direction === 'desc') {
          return { key: null, direction: null };
        }
      }
      return { key, direction: 'asc' };
    });
  };

  const getSortIcon = (key: typeof sortConfig.key) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ArrowUp className="h-4 w-4 text-blue-600" />;
    }
    return <ArrowDown className="h-4 w-4 text-blue-600" />;
  };

  const getSortLabel = (key: typeof sortConfig.key) => {
    if (sortConfig.key !== key) {
      return 'Click to sort';
    }
    
    if (key === 'invoiceDate' || key === 'dueDate') {
      return sortConfig.direction === 'asc' 
        ? 'Sorted: Earliest to Latest' 
        : 'Sorted: Latest to Earliest';
    }
    
    if (key === 'invoiceAmount') {
      return sortConfig.direction === 'asc' 
        ? 'Sorted: Least to Most' 
        : 'Sorted: Most to Least';
    }
    
    if (key === 'invoiceNumber') {
      return sortConfig.direction === 'asc' 
        ? 'Sorted: Earliest to Latest Created' 
        : 'Sorted: Latest to Earliest Created';
    }
    
    return 'Click to sort';
  };

  const handleView = (invoiceId: number) => {
    router.push(`/invoice/invoices/${invoiceId}`);
  };

  const handleEdit = (invoice: Invoice) => {
    if (onEdit) {
      onEdit(invoice);
    }
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

      // Refresh invoices
      fetchInvoices();
      // alert('Invoice deleted successfully');
      toast.success('Invoice deleted successfully');
    } catch (err) {
      console.error('Error deleting invoice:', err);
      // alert(err instanceof Error ? err.message : 'Failed to delete invoice');
      toast.error(err instanceof Error ? err.message : 'Failed to delete invoice');
    }
  };

const prepareInvoiceData = async (invoice: Invoice) => {
    // Fetch timesheet summary if invoice has a matter
    let timesheetEntries = undefined;
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
          console.log('📊 Timesheet data received:', timesheetData);
          
          if (timesheetData.success && timesheetData.data) {
            // Use timesheetEntries from the API response
            timesheetEntries = timesheetData.data.timesheetEntries;
            periodFrom = timesheetData.data.periodFrom;
            periodTo = timesheetData.data.periodTo;
            
            console.log('✅ Timesheet entries:', timesheetEntries);
            console.log('📅 Period:', periodFrom, 'to', periodTo);
          }
        }
      } catch (err) {
        console.error('❌ Error fetching timesheet summary:', err);
        // Continue with generation even if timesheet fetch fails
      }
    }

    const invoiceData = {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      clientName: invoice.client.name,
      clientAddress: invoice.client.address,
      matterTitle: invoice.matter?.title,
      periodFrom,
      periodTo,
      amount: invoice.invoiceAmount,
      timesheetEntries,
      status: invoice.status || 'draft',
      amountPaid: invoice.amountPaid || 0,
      remainingAmount: (invoice.invoiceAmount || 0) - (invoice.amountPaid || 0),
    };

    console.log('📄 Final invoice data for document:', invoiceData);
    
    return invoiceData;
  };

  const handleDownloadPDF = async (invoice: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenDropdownId(null);
    
    try {
      const invoiceData = await prepareInvoiceData(invoice);
      await downloadInvoicePDF(invoiceData);
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
      await downloadInvoiceWord(invoiceData);
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
      case 'draft':
        return 'bg-gray-100 text-gray-700';
      case 'finalized':
        return 'bg-indigo-100 text-indigo-700';
      case 'invoice_uploaded':
        return 'bg-orange-100 text-orange-700';
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
      case 'draft':
        return 'Draft';
      case 'finalized':
        return 'Finalized';
      case 'invoice_uploaded':
        return 'Invoice Uploaded';
      default:
        return status;
    }
  };

  const getPaymentProgress = (invoice: Invoice): number => {
    // ✅ Use finalAmount (after discount) instead of invoiceAmount
    const totalAmount = invoice.finalAmount ?? invoice.invoiceAmount;
    if (totalAmount === 0) return 0;
    
    // For parent invoices, use split payment total
    if (invoice.isParent && invoice.splitPaymentSummary) {
      return (invoice.splitPaymentSummary.totalPaid / totalAmount) * 100;
    }
    
    return (invoice.amountPaid / totalAmount) * 100;
  };



  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      {/* FILTERS BAR */}
      <div className="px-6 py-4 flex flex-col gap-4">
        {/* Filter Controls Row */}
        <div className="flex items-center gap-4">
          {/* SEARCH INPUT */}
          <div className="flex-1 max-w-md relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search by Invoice #, Client, Matter"
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 bg-white border border-gray-300 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
            />
          </div>

          {/* CLIENT FILTER */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">
              Client:
            </label>
            <div className="relative" ref={clientDropdownRef}>
              <button
                onClick={() => setClientDropdownOpen(!clientDropdownOpen)}
                className="w-60 px-3 py-2 text-sm text-left bg-white border border-gray-300 rounded-md hover:border-blue-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none flex items-center justify-between"
              >
                <span className="truncate">
                  {clientFilter.length === 0
                    ? 'All Clients'
                    : clientFilter.length === 1
                    ? clientFilter[0]
                    : `${clientFilter.length} clients selected`}
                </span>
                <span className="text-gray-500 text-xs ml-2">▼</span>
              </button>

              {clientDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-hidden flex flex-col">
                  {/* Search Input */}
                  <div className="p-2 border-b border-gray-200">
                    <input
                      type="text"
                      placeholder="Search clients..."
                      value={clientSearchQuery}
                      onChange={(e) => setClientSearchQuery(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {/* Clear All Button */}
                  {clientFilter.length > 0 && (
                    <div className="p-2 border-b border-gray-200">
                      <button
                        onClick={clearClientFilters}
                        className="w-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        Clear All ({clientFilter.length})
                      </button>
                    </div>
                  )}

                  {/* Client List */}
                  <div className="overflow-y-auto max-h-60">
                    {filteredClients.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500 text-center">
                        No clients found
                      </div>
                    ) : (
                      filteredClients.map((client) => (
                        <label
                          key={client}
                          className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={clientFilter.includes(client)}
                            onChange={() => toggleClientSelection(client)}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-800">{client}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* MULTI-SELECT STATUS FILTER */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">
              Status:
            </label>
            <Popover open={statusFilterOpen} onOpenChange={setStatusFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-[200px] justify-between font-normal"
                >
                  {selectedStatuses.length === 0 
                    ? "All" 
                    : `${selectedStatuses.length} selected`}
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[220px] p-0" align="start">
                <Command>
                  <CommandList>
                    <CommandEmpty>No statuses found.</CommandEmpty>
                    <CommandGroup>
                      {statusOptions.map((status) => (
                        <CommandItem
                          key={status.value}
                          value={status.value}
                          onSelect={() => toggleStatusSelection(status.value)}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <div className={`h-4 w-4 border rounded flex items-center justify-center ${
                              selectedStatuses.includes(status.value) 
                                ? 'bg-blue-600 border-blue-600' 
                                : 'border-gray-300'
                            }`}>
                              {selectedStatuses.includes(status.value) && (
                                <Check className="h-3 w-3 text-white" />
                              )}
                            </div>
                            <span className="flex-1">{status.label}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    {selectedStatuses.length > 0 && (
                      <>
                        <div className="border-t my-1" />
                        <div className="p-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearStatusFilters}
                            className="w-full text-xs"
                          >
                            Clear Selection
                          </Button>
                        </div>
                      </>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Active Filters Display */}
        {/* {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
            <span className="text-sm text-gray-600 font-medium">Active Filters:</span>
            
            {clientFilter.map((client) => (
              <Badge 
                key={client} 
                variant="secondary" 
                className="gap-1 pl-2 pr-1"
              >
                Client: {client}
                <button
                  onClick={() => toggleClientSelection(client)}
                  className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            
            {selectedStatuses.map((status) => {
              const statusOption = statusOptions.find(s => s.value === status);
              return statusOption ? (
                <Badge 
                  key={status} 
                  variant="secondary" 
                  className="gap-1 pl-2 pr-1"
                >
                  {statusOption.label}
                  <button
                    onClick={() => toggleStatusSelection(status)}
                    className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ) : null;
            })}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-xs ml-2"
            >
              Clear All
            </Button>
          </div>
        )} */}
      </div>

      {/* INVOICES TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* TABLE HEADER */}
          <thead className="bg-white border-t border-b border-gray-200">
            <tr>
              <th
                className="px-6 py-3 text-left text-base font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none"
                scope="col"
                onClick={() => handleSort('invoiceNumber')}
                title={getSortLabel('invoiceNumber')}
              >
                <div className="flex items-center gap-2">
                  Invoice #
                  {getSortIcon('invoiceNumber')}
                </div>
              </th>

              <th
                className="px-6 py-3 text-left text-base font-medium text-gray-500"
                scope="col"
              >
                Client / Matter
              </th>
              <th 
                className="px-6 py-3 text-center text-base font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none"
                scope="col"
                onClick={() => handleSort('invoiceDate')}
                title={getSortLabel('invoiceDate')}
              >
                <div className="flex items-center justify-center gap-2">
                  Invoice Date
                  {getSortIcon('invoiceDate')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-center text-base font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none"
                scope="col"
                onClick={() => handleSort('dueDate')}
                title={getSortLabel('dueDate')}
              >
                <div className="flex items-center justify-center gap-2">
                  Due Date
                  {getSortIcon('dueDate')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-right text-base font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none"
                scope="col"
                onClick={() => handleSort('invoiceAmount')}
                title={getSortLabel('invoiceAmount')}
              >
                <div className="flex items-center justify-end gap-2">
                  Amount
                  {getSortIcon('invoiceAmount')}
                </div>
              </th>
              <th
                className="px-6 py-3 text-center text-base font-medium text-gray-500"
                scope="col"
              >
                Currency
              </th>
              <th
                className="px-6 py-3 text-center text-base font-medium text-gray-500"
                scope="col"
              >
                Payment
              </th>
              <th
                className="px-6 py-3 text-center text-base font-medium text-gray-500"
                scope="col"
              >
                Status
              </th>
              <th
                className="px-6 py-3 text-center text-base font-medium text-gray-500"
                scope="col"
              >
                Actions
              </th>
            </tr>
          </thead>

          {/* TABLE BODY */}
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="text-lg font-medium">Loading invoices...</p>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-red-500">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-lg font-medium">Error loading invoices</p>
                    <p className="text-sm">{error}</p>
                    <button
                      onClick={fetchInvoices}
                      className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Retry
                    </button>
                  </div>
                </td>
              </tr>
            ) : filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-lg font-medium">No invoices found</p>
                    <p className="text-sm">
                      {invoices.length === 0
                        ? 'Create your first invoice to get started'
                        : 'Try adjusting your search or filters'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedInvoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => handleView(invoice.id)}
                >
                  <td className="px-6 py-4">
                    <div className="text-base font-semibold text-blue-600">
                      {invoice.invoiceNumber}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-base font-medium text-gray-900">
                      {invoice.client.name}
                    </div>
                    {invoice.matter && (
                      <div className="text-sm text-gray-500">
                        {invoice.matter.title}
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-4 text-center">
                    <div className="text-base text-gray-900">
                      {formatDate(invoice.invoiceDate)}
                    </div>
                  </td>

                  <td className="px-6 py-4 text-center">
                    <div className="text-base text-gray-900">
                      {formatDate(invoice.dueDate)}
                    </div>
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="text-base font-semibold text-gray-900">
                      {invoice.invoice_currency 
                        ? formatAmountWithCurrency(invoice.finalAmount ?? invoice.invoiceAmount, invoice.invoice_currency as CurrencyCode)
                        : formatCurrency(invoice.finalAmount ?? invoice.invoiceAmount)
                      }
                    </div>
                  </td>

                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <CurrencyBadge 
                        currency={(invoice.invoice_currency || 'INR') as CurrencyCode}
                        convertedFrom={invoice.invoice_currency !== invoice.matter_currency && invoice.matter_currency ? invoice.matter_currency as CurrencyCode : undefined}
                        conversionRate={invoice.currency_conversion_rate}
                      />
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {invoice.isParent && invoice.splitPaymentSummary ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <div className="flex items-center justify-center gap-2 text-sm cursor-pointer hover:opacity-80">
                              <span className="text-gray-900 font-medium">
                                {formatCurrency(invoice.splitPaymentSummary.totalPaid)}
                              </span>
                              <Info size={14} className="text-gray-400" />
                              <span className="text-gray-400">/</span>
                              <span className="text-gray-500">
                                {formatCurrency(invoice.finalAmount ?? invoice.invoiceAmount)}
                              </span>
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-96">
                            <h4 className="font-semibold mb-3">Split Invoice Payments</h4>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left py-2">Invoice</th>
                                  <th className="text-right py-2">Paid</th>
                                  <th className="text-right py-2">Due</th>
                                  <th className="text-center py-2">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {invoice.splitPaymentSummary.splits.map((split) => (
                                  <tr key={split.invoiceId} className="border-b">
                                    <td className="py-2">{split.invoiceNumber}</td>
                                    <td className="text-right py-2 text-green-600">
                                      {formatAmountWithCurrency(split.amountPaid, (split.currency || 'INR') as CurrencyCode)}
                                    </td>
                                    <td className="text-right py-2">
                                      {formatAmountWithCurrency(split.amountDue, (split.currency || 'INR') as CurrencyCode)}
                                    </td>
                                    <td className="text-center py-2">
                                      <span className={`px-2 py-1 rounded text-xs ${getStatusBadgeClass(split.status)}`}>
                                        {getStatusText(split.status)}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="font-semibold">
                                  <td className="py-2">Total</td>
                                  <td className="text-right py-2">
                                    {formatCurrency(invoice.splitPaymentSummary.totalPaid)}
                                  </td>
                                  <td className="text-right py-2"></td>
                                  <td></td>
                                </tr>
                              </tfoot>
                            </table>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <div className="flex items-center justify-center gap-2 text-sm">
                          <span className="text-gray-900 font-medium">
                            {formatCurrency(invoice.amountPaid)}
                          </span>
                          <span className="text-gray-400">/</span>
                          <span className="text-gray-500">
                            {formatCurrency(invoice.finalAmount ?? invoice.invoiceAmount)}
                          </span>
                        </div>
                      )}
                      {(invoice.finalAmount ?? invoice.invoiceAmount) > 0 && (
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
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass(
                        invoice.status
                      )}`}
                    >
                      {getStatusText(invoice.status)}
                    </span>
                  </td>

                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-2">
                      {/* <button
                        onClick={() => handleView(invoice.id)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="View Details"
                      >
                        <Eye size={18} />
                      </button> */}
                      <button
                        onClick={() => handleEdit(invoice)}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      
                      {/* Download Dropdown */}
                      <div className="relative" ref={openDropdownId === invoice.id ? dropdownRef : null}>
                        <button
                          ref={(el) => {
                            if (el) buttonRefs.current.set(invoice.id, el);
                            else buttonRefs.current.delete(invoice.id);
                          }}
                          onClick={(e) => toggleDropdown(invoice.id, e)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                          title="Download"
                        >
                          <Download size={18} />
                        </button>
                        
                        {openDropdownId === invoice.id && createPortal(
                          <div 
                            ref={dropdownRef}
                            className="fixed w-44 bg-white rounded-lg shadow-lg border border-gray-200 z-[9999]"
                            style={{
                              top: `${dropdownPosition.top}px`,
                              left: `${dropdownPosition.left}px`
                            }}
                          >
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
                          </div>,
                          document.body
                        )}
                      </div>
                      
                      <button
                        onClick={() => handleDelete(invoice.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!isLoading && !error && filteredInvoices.length > 0 && (
          <div className="px-6 py-4">
            <Pagination
              currentPage={currentPage}
              totalItems={filteredInvoices.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
              itemsPerPageOptions={[10, 25, 50, 100]}
            />
          </div>
        )}

      </div>
    </>
  );
}