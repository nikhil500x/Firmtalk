import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { API_ENDPOINTS, API_BASE_URL } from '@/lib/api';
import { Check, ChevronsUpDown, MapPin, ArrowRightLeft } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getLocationOptions, getLocation, DEFAULT_LOCATION_ID } from '@/lib/location-constants';
import { cn } from '@/lib/utils';
import { formatAmountWithCurrency, getCurrencySymbol, type CurrencyCode } from '@/lib/currencyUtils';
import CurrencyBadge from '@/components/ui/currency-badge';
import { toast } from 'react-toastify';
// import InvoicePreview from './InvoicePreview';


interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  invoiceId?: number;
  onSuccess: () => void;
}

interface Client {
  id: number;
  companyName: string;
  address?: string;
}

interface Matter {
  id: number;
  title: string;
  clientId: number;
  currency: string;
}

interface Timesheet {
  id: number;
  matterId: number;
  calculatedAmount: number | null;
  calculatedAmountCurrency?: string | null; // ✅ Add currency field
  status: 'pending' | 'approved' | 'rejected';
  date: string;
  isInvoiced: boolean;
  invoiceNumber?: string | null;
  invoiceId?: number | null;
  user?: {
    id: number;
    name: string;
    email?: string;
    role?: string;
  };
  billableHours?: string;
  activityType?: string;
  description?: string | null;
  hourlyRate?: number | null;
  matter?: {
    id: number;
    title: string;
    currency?: string | null; // ✅ Add matter currency as fallback
  } | null;
}

interface Expense {
  id: number;
  matterId: number | null;
  amount: number;
  amountCurrency: string; // Always INR
  category: string;
  subCategory?: string | null;
  description: string;
  status: string;
  expenseIncluded?: boolean;
}

const initialFormData = {
  clientId: '',
  matterId: '', // Deprecated: kept for backward compatibility
  matterIds: [] as number[], // NEW: array for multi-matter support
  invoiceNumber: '',
  invoiceDate: '',
  dueDate: '',
  amount: '',
  description: '',
  notes: '',
  matterDateFrom: '',
  matterDateTo: '',
  billingLocation: DEFAULT_LOCATION_ID,
  invoiceCurrency: '',
};

export default function InvoiceDialog({
  open,
  onOpenChange,
  mode,
  invoiceId,
  onSuccess,
}: InvoiceDialogProps) {
  // ✅ ADD: Warn if invoiceId is missing in edit mode
  useEffect(() => {
    if (open && mode === 'edit' && !invoiceId) {
      console.error('⚠️ InvoiceDialog: invoiceId is missing in edit mode');
      toast.error('Invoice ID is missing. Please close and reopen the dialog.');
    }
  }, [open, mode, invoiceId]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [selectedMatterIds, setSelectedMatterIds] = useState<number[]>([]); // NEW: Track selected matters
  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [isLoadingTimesheets, setIsLoadingTimesheets] = useState(false);
  const [calculatedAmount, setCalculatedAmount] = useState<number | null>(null);
  const [clientComboboxOpen, setClientComboboxOpen] = useState(false);
  const [matterComboboxOpen, setMatterComboboxOpen] = useState(false);
  const [selectedTimesheetIds, setSelectedTimesheetIds] = useState<number[]>([]);
  const [minInvoiceDate, setMinInvoiceDate] = useState<string>('');
  const [minDueDate, setMinDueDate] = useState<string>('');
  const [locationComboboxOpen, setLocationComboboxOpen] = useState(false);
  const [originalTimesheetIds, setOriginalTimesheetIds] = useState<number[]>([]);
  const [matterCurrency, setMatterCurrency] = useState<string>('INR');
  const [supportedCurrencies, setSupportedCurrencies] = useState<string[]>(['INR', 'USD', 'EUR', 'GBP', 'AED', 'JPY']);
  const [currencyComboboxOpen, setCurrencyComboboxOpen] = useState(false);
  const [conversionRate, setConversionRate] = useState<number | null>(null);
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [filterByUser, setFilterByUser] = useState<number | 'all'>('all'); // Filter by user/person
  
  // ✅ Expense state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
  const [includeExpenses, setIncludeExpenses] = useState(false);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<number[]>([]);
  // ✅ Currency breakdown and exchange rates
  const [currencyBreakdown, setCurrencyBreakdown] = useState<Array<{
    currency: string;
    matters: Array<{ id: number; title: string }>;
    amount: number;
  }>>([]);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [showCurrencyBreakdown, setShowCurrencyBreakdown] = useState(false);

  // Fetch invoice data when editing
  useEffect(() => {
    const fetchInvoice = async () => {
      if (!open || mode !== 'edit' || !invoiceId) return;

      try {
        const response = await fetch(API_ENDPOINTS.invoices.byId(invoiceId), {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch invoice');
        }

        const data = await response.json();

        if (data.success && data.data) {
          const invoice = data.data;
          
          // Handle matterIds array (multi-matter support)
          const invoiceMatterIds = invoice.matterIds || (invoice.matterId ? [invoice.matterId] : []);
          setSelectedMatterIds(invoiceMatterIds);
          
          setFormData({
            clientId: invoice.clientId?.toString() || '',
            matterId: invoiceMatterIds.length === 1 ? invoiceMatterIds[0].toString() : 
                     (invoice.matterId?.toString() || ''),
            matterIds: invoiceMatterIds,
            invoiceNumber: invoice.invoiceNumber || '',
            invoiceDate: invoice.invoiceDate
              ? new Date(invoice.invoiceDate).toISOString().split('T')[0]
              : '',
            dueDate: invoice.dueDate
              ? new Date(invoice.dueDate).toISOString().split('T')[0]
              : '',
            amount: invoice.invoiceAmount?.toString() || '',
            description: invoice.description || '',
            notes: invoice.notes || '',
            matterDateFrom: invoice.dateFrom || '',
            matterDateTo: invoice.dateTo || '',
            billingLocation: invoice.billingLocation || DEFAULT_LOCATION_ID,
            invoiceCurrency: invoice.invoice_currency || invoice.matter_currency || 'INR',
          });
          
          // Set matter currency if available
          if (invoice.matter_currency) {
            setMatterCurrency(invoice.matter_currency);
          }

          // ✅ ADD: Load exchange rates from existing invoice
          if (invoice.exchangeRates) {
            if (typeof invoice.exchangeRates === 'object') {
              setExchangeRates(invoice.exchangeRates);
            } else if (typeof invoice.exchangeRates === 'string') {
              try {
                setExchangeRates(JSON.parse(invoice.exchangeRates));
              } catch (e) {
                console.error('Error parsing exchange rates:', e);
              }
            }
          }

          // ✅ ADD: Build currency breakdown from invoice timesheets
          if (invoice.timesheets && invoice.timesheets.length > 0) {
            const currencyMap = new Map<string, { matters: Set<number>; amount: number }>();
            
            invoice.timesheets.forEach((ts: { currency?: string; matterId?: number; billedAmount?: number | string; originalAmount?: number | string }) => {
              const currency = ts.currency || invoice.invoiceCurrency || invoice.invoice_currency || 'INR';
              if (!currencyMap.has(currency)) {
                currencyMap.set(currency, { matters: new Set(), amount: 0 });
              }
              const entry = currencyMap.get(currency)!;
              // Try to get matterId from timesheet, fallback to invoice matters
              if (ts.matterId) {
                entry.matters.add(ts.matterId);
              } else if (invoiceMatterIds.length > 0) {
                invoiceMatterIds.forEach((id: number) => entry.matters.add(id));
              }
              const amountValue = ts.billedAmount || ts.originalAmount || 0;
              entry.amount += typeof amountValue === 'string' ? parseFloat(amountValue) : amountValue;
            });

            const breakdown = Array.from(currencyMap.entries()).map(([currency, data]) => ({
              currency,
              matters: Array.from(data.matters).map(id => ({ id, title: '' })), // Matter titles not needed for breakdown
              amount: data.amount,
            }));

            if (breakdown.length > 0) {
              setCurrencyBreakdown(breakdown);
              // Show currency breakdown if there are multiple currencies
              setShowCurrencyBreakdown(breakdown.length > 1);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching invoice:', error);
        // alert('Failed to load invoice data');
        toast.error('Failed to load invoice data');
      }
    };

    fetchInvoice();

    // ✅ ADD: Fetch linked timesheets for edit mode
    const fetchLinkedTimesheets = async () => {
      if (!open || mode !== 'edit' || !invoiceId) return;

      try {
        const response = await fetch(
          API_ENDPOINTS.invoices.timesheetSummary(invoiceId),
          {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch linked timesheets');
        }

        const data = await response.json();

        if (data.success && data.data) {
          const linkedTimesheetIds = data.data.timesheetEntries.map(
            (entry: { timesheetId: number }) => entry.timesheetId  // Make sure backend returns this!
          );
          setSelectedTimesheetIds(linkedTimesheetIds);
          setOriginalTimesheetIds(linkedTimesheetIds); // ✅ ADD: Store original IDs
        }
      } catch (error) {
        console.error('Error fetching linked timesheets:', error);
      }
    };

    fetchLinkedTimesheets();
  }, [open, mode, invoiceId]);

  // Fetch clients when dialog opens
  useEffect(() => {
    const fetchClients = async () => {
      if (!open) return;

      try {
        const response = await fetch(API_ENDPOINTS.clients.list, {
          credentials: 'include',
          headers:{
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch clients');
        }

        const data = await response.json();
        console.log(data.data);
        setClients(data.data || []);
      } catch (error) {
        console.error('Error fetching clients:', error);
      }
    };

    fetchClients();
  }, [open]);

  // Fetch matters when client is selected
  useEffect(() => {
    const fetchMatters = async () => {
      if (!formData.clientId) {
        setMatters([]);
        return;
      }

      try {
        const response = await fetch(
          API_ENDPOINTS.matters.byClient(parseInt(formData.clientId)),
          {
            credentials: 'include',
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch matters');
        }

        const data = await response.json();
        console.log(data.data);
        setMatters(data.data || []);
      } catch (error) {
        console.error('Error fetching matters:', error);
        setMatters([]);
      }
    };

    fetchMatters();
  }, [formData.clientId]);

  // Fetch timesheets when matters are selected and calculate invoice amount
  useEffect(() => {
    const fetchTimesheets = async () => {

      // Support both old (single matterId) and new (multiple matterIds) format
      const matterIdsToUse = selectedMatterIds.length > 0 ? selectedMatterIds : 
                            (formData.matterId ? [parseInt(formData.matterId)] : []);

      if (matterIdsToUse.length === 0) {
        setTimesheets([]);
        setCalculatedAmount(null);
        setSelectedTimesheetIds([]);
        setMinInvoiceDate(''); 
        // If no matter selected, allow manual amount entry
        if (mode === 'create') {
          setFormData((prev) => ({ ...prev, amount: '' }));
        }
        return;
      }

      setIsLoadingTimesheets(true);
      try {
        // Fetch timesheets for all selected matters
        const timesheetPromises = matterIdsToUse.map(async (matterId) => {
          let queryParams = `matterId=${matterId}&status=approved`;
        
        if (formData.matterDateFrom) {
          queryParams += `&dateFrom=${formData.matterDateFrom}`;
        }
        
        if (formData.matterDateTo) {
          queryParams += `&dateTo=${formData.matterDateTo}`;
        }

        const response = await fetch(
          `${API_ENDPOINTS.timesheets.list}?${queryParams}`,
            { credentials: 'include' }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch timesheets for matter ${matterId}`);
        }

        const data = await response.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (data.data || []).map((ts: any) => ({ ...ts, matterId }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        });

        const timesheetArrays = await Promise.all(timesheetPromises);
        const allTimesheets = timesheetArrays.flat();

        setTimesheets(allTimesheets);
        const fetchedTimesheets = allTimesheets;

        // ============================================================
        // PUT THE CODE RIGHT HERE ⬇️⬇️⬇️
        // ============================================================
        
        // Filter out already-invoiced timesheets for calculation
        const uninvoicedTimesheets = fetchedTimesheets.filter((ts: Timesheet) => !ts.isInvoiced);
        
        // ✅ DETECT CURRENCIES FROM SELECTED MATTERS AND TIMESHEETS
        try {
          const selectedTimesheetIds = uninvoicedTimesheets.map((ts: Timesheet) => ts.id);
          const currencyResponse = await fetch(`${API_BASE_URL}/api/invoices/detect-currencies`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              matterIds: matterIdsToUse,
              timesheetIds: selectedTimesheetIds.length > 0 ? selectedTimesheetIds : undefined,
              expenseIds: includeExpenses && selectedExpenseIds.length > 0 ? selectedExpenseIds : undefined, // ✅ Include expenses
            }),
          });

          if (currencyResponse.ok) {
            const currencyData = await currencyResponse.json();
            if (currencyData.success && currencyData.data) {
              setCurrencyBreakdown(currencyData.data.breakdown || []);
              setShowCurrencyBreakdown(currencyData.data.requiresExchangeRates || false);
              
              // Auto-set invoice currency to suggested currency if not set
              if (currencyData.data.suggestedInvoiceCurrency && !formData.invoiceCurrency) {
                setFormData((prev) => ({ ...prev, invoiceCurrency: currencyData.data.suggestedInvoiceCurrency }));
              }
            }
          }
        } catch (error) {
          console.error('Error detecting currencies:', error);
        }
        
        // Calculate total from uninvoiced timesheets only (will be recalculated with exchange rates if multi-currency)
        const totalAmount = uninvoicedTimesheets.reduce((sum: number, timesheet: Timesheet) => {
          return sum + (timesheet.calculatedAmount || 0);
        }, 0);
        
        setCalculatedAmount(totalAmount > 0 ? totalAmount : null);
        
        // ✅ Also trigger currency detection when expenses change
        // This will be handled in a separate useEffect below
        
        // Auto-select uninvoiced timesheets
        const uninvoicedIds = uninvoicedTimesheets.map((ts: Timesheet) => ts.id);
        setSelectedTimesheetIds(uninvoicedIds);
        
        
        // Calculate minimum invoice date from SELECTED (uninvoiced) timesheets
        // Use LATEST timesheet date as the minimum allowed invoice date
        if (uninvoicedTimesheets.length > 0) {
          const latestDate = uninvoicedTimesheets.reduce((latest: string, ts: Timesheet) => {
            return !latest || ts.date > latest ? ts.date : latest;
          }, '');
                  
          if (latestDate) {  // was: earliestDate
            const formattedLatestDate = new Date(latestDate).toISOString().split('T')[0];  // was: formattedEarliestDate
            setMinInvoiceDate(formattedLatestDate);  // was: formattedEarliestDate
            
            // Set invoice date to LATEST TIMESHEET DATE (not today)
            if (mode === 'create' && !formData.invoiceDate) {
              setFormData((prev) => ({
                ...prev,
                invoiceDate: formattedLatestDate,  // CHANGE: was checking today vs earliest
              }));
            }
          }
        } else {
          setMinInvoiceDate('');
        }

      
        // Calculate minimum due date from SELECTED (uninvoiced) timesheets
        // This ensures due date is after the LATEST timesheet date
        if (uninvoicedTimesheets.length > 0) {
          const latestDate = uninvoicedTimesheets.reduce((latest: string, ts: Timesheet) => {
            return !latest || ts.date > latest ? ts.date : latest;
          }, '');
          
          if (latestDate) {
            const formattedDate = new Date(latestDate).toISOString().split('T')[0];
            setMinDueDate(formattedDate);
            
            // Calculate and set due date: 60 days after latest timesheet (only in create mode)
            if (mode === 'create' && !formData.dueDate) {
              const latestTimesheetDate = new Date(latestDate);
              const dueDate = new Date(latestTimesheetDate);
              dueDate.setDate(dueDate.getDate() + 60);
              
              const formattedDueDate = dueDate.toISOString().split('T')[0];
              
              setFormData((prev) => ({
                ...prev,
                dueDate: formattedDueDate,
                amount: totalAmount > 0 ? totalAmount.toFixed(2) : '',
              }));
              return; // Exit early since we already updated both fields
            }
          }
        } else {
          setMinDueDate('');
        }

        // Auto-populate amount field with calculated total (only in create mode)
        if (mode === 'create') {
          setFormData((prev) => ({
            ...prev,
            amount: totalAmount > 0 ? totalAmount.toFixed(2) : '',
          }));
        }
        
        // ============================================================
        // END OF THE CODE BLOCK ⬆️⬆️⬆️
        // ============================================================
        
      } catch (error) {
        console.error('Error fetching timesheets:', error);
        setTimesheets([]);
        setCalculatedAmount(null);
        setSelectedTimesheetIds([]);
        setMinInvoiceDate('');
      } finally {
        setIsLoadingTimesheets(false);
      }
    };

    fetchTimesheets();
  }, [selectedMatterIds, formData.matterId, formData.matterDateFrom, formData.matterDateTo, mode]);

  // ✅ Fetch expenses when matters are selected (expenses related to selected timesheets)
  useEffect(() => {
    const fetchExpenses = async () => {
      // Support both old (single matterId) and new (multiple matterIds) format
      const matterIdsToUse = selectedMatterIds.length > 0 ? selectedMatterIds : 
                            (formData.matterId ? [parseInt(formData.matterId)] : []);

      if (matterIdsToUse.length === 0 || !includeExpenses) {
        setExpenses([]);
        setSelectedExpenseIds([]);
        return;
      }

      setIsLoadingExpenses(true);
      try {
        // Fetch expenses for all selected matters (only expenses with matter_id)
        const expensePromises = matterIdsToUse.map(async (matterId) => {
          const response = await fetch(
            `${API_BASE_URL}/api/expenses/onetime?matter_id=${matterId}`,
            { credentials: 'include' }
          );

          if (!response.ok) {
            throw new Error(`Failed to fetch expenses for matter ${matterId}`);
          }

          const data = await response.json();
          // Filter expenses that have matter_id and are not already in an invoice
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          // Map backend response to Expense interface
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (data.data || []).map((exp: any) => ({
            id: exp.expense_id,
            matterId: exp.matter_id,
            amount: exp.amount,
            amountCurrency: exp.amount_currency || 'INR',
            category: exp.category,
            subCategory: exp.sub_category,
            description: exp.description,
            status: exp.status,
            expenseIncluded: exp.expense_included !== false,
          })).filter((exp: Expense) => 
            exp.matterId === matterId && exp.expenseIncluded !== false
          );
        });

        const expenseArrays = await Promise.all(expensePromises);
        const allExpenses = expenseArrays.flat();
        
        setExpenses(allExpenses);
        // Auto-select all expenses by default
        setSelectedExpenseIds(allExpenses.map((e: Expense) => e.id));
      } catch (error) {
        console.error('Error fetching expenses:', error);
        setExpenses([]);
        setSelectedExpenseIds([]);
      } finally {
        setIsLoadingExpenses(false);
      }
    };

    fetchExpenses();
  }, [selectedMatterIds, formData.matterId, includeExpenses]);

  // ✅ Re-calculate currency breakdown when expenses are selected/deselected
  useEffect(() => {
    // Only run if we have matters selected and expenses are included
    const matterIdsToUse = selectedMatterIds.length > 0 ? selectedMatterIds : 
                          (formData.matterId ? [parseInt(formData.matterId)] : []);
    
    if (matterIdsToUse.length === 0 || !includeExpenses || selectedExpenseIds.length === 0) {
      // If expenses are not included or none selected, currency breakdown should already be correct
      return;
    }

    // Re-fetch currency breakdown with expenses
    const updateCurrencyBreakdown = async () => {
      try {
        // Get timesheet IDs from selected timesheets (use state variable)
        const tsIds = timesheets
          .filter((ts: Timesheet) => selectedTimesheetIds.includes(ts.id))
          .map((ts: Timesheet) => ts.id);
        
        const currencyResponse = await fetch(`${API_BASE_URL}/api/invoices/detect-currencies`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matterIds: matterIdsToUse,
            timesheetIds: tsIds.length > 0 ? tsIds : undefined,
            expenseIds: includeExpenses && selectedExpenseIds.length > 0 ? selectedExpenseIds : undefined,
          }),
        });

        if (currencyResponse.ok) {
          const currencyData = await currencyResponse.json();
          if (currencyData.success && currencyData.data) {
            setCurrencyBreakdown(currencyData.data.breakdown || []);
            setShowCurrencyBreakdown(currencyData.data.requiresExchangeRates || false);
          }
        }
      } catch (error) {
        console.error('Error updating currency breakdown with expenses:', error);
      }
    };

    updateCurrencyBreakdown();
  }, [selectedExpenseIds, includeExpenses, selectedMatterIds, formData.matterId, selectedTimesheetIds, timesheets]);

  // State for invoice number validation
  const [invoiceNumberError, setInvoiceNumberError] = useState<string | null>(null);
  const [isGeneratingInvoiceNumber, setIsGeneratingInvoiceNumber] = useState(false);

  // Auto-generate invoice number when date and location are set
  useEffect(() => {
    const generateInvoiceNumber = async () => {
      // Only auto-generate for new invoices when dialog is open, both date and location are set
      // Also skip if invoice number is already set (user may have manually entered it)
      if (!open || mode !== 'create' || !formData.invoiceDate || !formData.billingLocation || formData.invoiceNumber) {
        return;
      }

      // Map frontend location IDs to backend format
      const locationMap: Record<string, string> = {
        'delhi': 'delhi',
        'delhi_litigation': 'delhi (lt)',
        'mumbai': 'mumbai',
        'bangalore': 'bangalore',
      };
      const backendLocation = locationMap[formData.billingLocation] || formData.billingLocation;

      setIsGeneratingInvoiceNumber(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/invoices/generate-number?date=${formData.invoiceDate}&location=${encodeURIComponent(backendLocation)}`,
          { credentials: 'include' }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data.invoiceNumber) {
      setFormData((prev) => ({
        ...prev,
              invoiceNumber: data.data.invoiceNumber,
            }));
            setInvoiceNumberError(null);
          }
        } else {
          const errorData = await response.json().catch(() => ({ message: 'Failed to generate invoice number' }));
          console.error('Error generating invoice number:', errorData.message);
        }
      } catch (error) {
        console.error('Error generating invoice number:', error);
      } finally {
        setIsGeneratingInvoiceNumber(false);
      }
    };

    generateInvoiceNumber();
  }, [open, mode, formData.invoiceDate, formData.billingLocation, formData.invoiceNumber]);

  // Validate invoice number format on change
  const validateInvoiceNumber = (value: string) => {
    if (!value) {
      setInvoiceNumberError(null);
      return;
    }

    // Regex: 8 digits - (D|M|B|LT) with optional -[A-Z]+ suffix
    // Valid: 07012026-M, 07012026-M-A, 07012026-LT-AB
    const regex = /^\d{8}-(D|M|B|LT)(-[A-Z]+)?$/;
    
    if (!regex.test(value)) {
      setInvoiceNumberError('Format: DDMMYYYY-OFFICE or DDMMYYYY-OFFICE-A (e.g., 07012026-M)');
    } else {
      setInvoiceNumberError(null);
    }
  };

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setFormData(initialFormData);
      setErrors({});
      setTimesheets([]);
      setIsLoadingTimesheets(false);
      setCalculatedAmount(null);
      setSelectedTimesheetIds([]);
      setOriginalTimesheetIds([]); // ✅ ADD THIS
      setMinInvoiceDate(''); // ADD THIS LINE
      setMinDueDate(''); // ADD THIS LINE
    }
  }, [open]);

  // Auto-calculate due date (60 days after LATEST selected timesheet)
  // useEffect(() => {
  //   if (minDueDate && mode === 'create') {
  //     const latestTimesheetDate = new Date(minDueDate);
  //     const dueDate = new Date(latestTimesheetDate);
  //     dueDate.setDate(dueDate.getDate() + 60);
      
  //     // Format to YYYY-MM-DD for input[type="date"]
  //     const formattedDueDate = dueDate.toISOString().split('T')[0];
      
  //     setFormData((prev) => ({
  //       ...prev,
  //       dueDate: formattedDueDate,
  //     }));
  //   }
  // }, [minDueDate, mode]);

  const handleChange = async (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    
    // If matter is selected, fetch its currency
    if (field === 'matterId' && value) {
      const selectedMatter = matters.find(m => m.id.toString() === value);
      if (selectedMatter && selectedMatter.currency) {
        setMatterCurrency(selectedMatter.currency);
        setFormData((prev) => ({
          ...prev,
          invoiceCurrency: selectedMatter.currency || 'INR',
        }));
      }
    }
    
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): { isValid: boolean; errors: Record<string, string> } => {
    const newErrors: Record<string, string> = {};

    if (!formData.clientId) {
      newErrors.clientId = 'Please select a client';
    }

    // ✅ ADD: Validate matter selection
    if (selectedMatterIds.length === 0 && !formData.matterId) {
      newErrors.matterId = 'Please select at least one matter';
    }

    // ✅ ADD THIS BLOCK
    if (!formData.billingLocation) {
      newErrors.billingLocation = 'Please select a billing location';
    }

    if (!formData.invoiceNumber) {
      newErrors.invoiceNumber = 'Invoice number is required';
    } else {
      // Validate format: DDMMYYYY-OFFICE or DDMMYYYY-OFFICE-A/B/C
      const regex = /^\d{8}-(D|M|B|LT)(-[A-Z]+)?$/;
      if (!regex.test(formData.invoiceNumber)) {
        newErrors.invoiceNumber = 'Invoice number must follow format: DDMMYYYY-OFFICE (e.g., 07012026-M)';
      }
    }

    if (!formData.invoiceDate) {
      newErrors.invoiceDate = 'Invoice date is required';
    } else if (minInvoiceDate && formData.invoiceDate < minInvoiceDate) {
      newErrors.invoiceDate = `Invoice date cannot be before ${new Date(minInvoiceDate).toLocaleDateString()} (latest timesheet date)`;
    }
    

    if (!formData.dueDate) {
      newErrors.dueDate = 'Due date is required';
    } else if (formData.invoiceDate && formData.dueDate < formData.invoiceDate) {
      newErrors.dueDate = 'Due date must be after invoice date';
    } else if (minDueDate && formData.dueDate < minDueDate) {
      newErrors.dueDate = `Due date cannot be before ${new Date(minDueDate).toLocaleDateString()} (latest timesheet date)`;
    }

    if (!formData.amount) {
      newErrors.amount = 'Amount is required';
    } else if (parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    if (!formData.description) {
      newErrors.description = 'Description is required';
    }

    // ✅ VALIDATE EXCHANGE RATES FOR MULTI-CURRENCY INVOICES
    // Only validate if we're in create mode OR if exchange rates are missing in edit mode
    if (showCurrencyBreakdown && currencyBreakdown.length > 1 && formData.invoiceCurrency) {
      const currenciesNeedingConversion = currencyBreakdown.filter(b => b.currency !== formData.invoiceCurrency);
      const missingRates = currenciesNeedingConversion.filter(b => {
        // In edit mode, if exchange rates exist, don't require them again
        if (mode === 'edit' && exchangeRates && Object.keys(exchangeRates).length > 0) {
          // Check if this specific currency has a rate
          return !exchangeRates[b.currency] || exchangeRates[b.currency] <= 0;
        }
        // In create mode, always require exchange rates
        return !exchangeRates[b.currency] || exchangeRates[b.currency] <= 0;
      });
      
      if (missingRates.length > 0) {
        newErrors.exchangeRates = `Exchange rates required for: ${missingRates.map(b => b.currency).join(', ')}`;
      }
    }

    setErrors(newErrors);
    
    // ✅ ADD: Log validation errors for debugging
    if (Object.keys(newErrors).length > 0) {
      console.warn('❌ Validation errors:', newErrors);
    }
    
    return { isValid: Object.keys(newErrors).length === 0, errors: newErrors };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ✅ ADD: Check if invoiceId is set for edit mode
    if (mode === 'edit' && !invoiceId) {
      toast.error('Invoice ID is missing. Please close and reopen the dialog.');
      console.error('Invoice ID is missing in edit mode');
      return;
    }

    // ✅ IMPROVE: Validate form and capture errors (return both isValid and errors to avoid race condition)
    const validationResult = validateForm();
    if (!validationResult.isValid) {
      const firstErrorKey = Object.keys(validationResult.errors)[0];
      const firstError = validationResult.errors[firstErrorKey];
      if (firstError) {
        toast.error(firstError);
      } else {
        toast.error('Please fill in all required fields correctly');
      }
      return;
    }

    setIsSubmitting(true);

    try {
      // Determine matterIds - use selectedMatterIds if available, otherwise fall back to matterId
      const matterIds = selectedMatterIds.length > 0 ? selectedMatterIds :
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                       (formData.matterId ? [parseInt(formData.matterId)] : []);

      // ✅ ADD: Validate that we have at least one matter for edit mode
      if (mode === 'edit' && matterIds.length === 0 && !formData.matterId) {
        throw new Error('At least one matter must be selected');
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {
        clientId: parseInt(formData.clientId),
        matterIds: matterIds.length > 0 ? matterIds : undefined, // NEW: Send array
        matterId: matterIds.length === 1 ? matterIds[0] : 
                 (formData.matterId ? parseInt(formData.matterId) : null), // Backward compatibility
        invoiceNumber: formData.invoiceNumber,
        invoiceDate: formData.invoiceDate,
        dueDate: formData.dueDate,
        invoiceAmount: parseFloat(formData.amount),
        description: formData.description,
        notes: formData.notes || null,
        timesheetIds: mode === 'edit' && selectedTimesheetIds.length === 0 
          ? originalTimesheetIds  // ✅ Use original IDs if none selected in edit mode
          : selectedTimesheetIds,
        expenseIds: includeExpenses && selectedExpenseIds.length > 0 ? selectedExpenseIds : undefined, // ✅ NEW: Include expenses
        includeExpenses: includeExpenses && selectedExpenseIds.length > 0, // ✅ NEW: Flag to include expenses
        dateFrom: formData.matterDateFrom || null,
        dateTo: formData.matterDateTo || null,
        billingLocation: formData.billingLocation,
        invoiceCurrency: formData.invoiceCurrency || matterCurrency,
        exchangeRates: showCurrencyBreakdown && Object.keys(exchangeRates).length > 0 ? exchangeRates : undefined,
      };

      const url =
        mode === 'create'
          ? API_ENDPOINTS.invoices.create
          : API_ENDPOINTS.invoices.update(invoiceId!);

      const method = mode === 'create' ? 'POST' : 'PUT';

      console.log(`🔄 ${method} ${url}`, { payload, invoiceId, mode }); // ✅ ADD: Debug logging

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log('📥 Response:', { status: response.status, data }); // ✅ ADD: Debug logging

      if (!response.ok || !data.success) {
        const errorMessage = data.message || data.error || `Failed to ${mode} invoice`;
        console.error('❌ API Error:', { status: response.status, error: errorMessage, data });
        throw new Error(errorMessage);
      }

      // alert(`Invoice ${mode === 'create' ? 'created' : 'updated'} successfully!`);
      toast.success(`Invoice ${mode === 'create' ? 'created' : 'updated'} successfully!`);
      onSuccess();
    } catch (error) {
      console.error(`Error ${mode}ing invoice:`, error);
      // alert(
      //   error instanceof Error
      //     ? error.message
      //     : `Failed to ${mode} invoice. Please try again.`
      // );
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${mode} invoice. Please try again.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get selected client and matter for preview
  // const selectedClient = useMemo(() => {
  //   return clients.find((c) => c.id === parseInt(formData.clientId));
  // }, [clients, formData.clientId]);

  // const selectedMatter = useMemo(() => {
  //   return matters.find((m) => m.id === parseInt(formData.matterId));
  // }, [matters, formData.matterId]);

  // Prepare preview data
  // const previewData = {
  //   invoiceNumber: formData.invoiceNumber,
  //   invoiceDate: formData.invoiceDate,
  //   dueDate: formData.dueDate,
  //   clientName: selectedClient?.name,
  //   clientAddress: selectedClient?.address,
  //   matterTitle: selectedMatter?.title,
  //   description: formData.description,
  //   amount: formData.amount ? parseFloat(formData.amount) : undefined,
  //   notes: formData.notes,
  // };

  const locationOptions = useMemo(() => getLocationOptions(), []);
  const selectedLocation = useMemo(() => getLocation(formData.billingLocation), [formData.billingLocation]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!fixed !inset-5 !transform-none !translate-x-0 !translate-y-0 !max-w-none !w-auto !h-auto overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-200 flex-shrink-0">
          <DialogTitle className="text-2xl font-semibold">
            {mode === 'create' ? 'Create Invoice' : 'Edit Invoice'}
          </DialogTitle>
        </DialogHeader>

        

          <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col min-h-0" noValidate>
          {/* FORM CONTENT - Scrollable Area */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-white min-h-0">
              {/* Billing Location Selection */}
              <div className="space-y-2 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin size={18} className="text-blue-600" />
                  <Label className="text-base font-semibold text-blue-900">
                    Billing Location <span className="text-red-500">*</span>
                  </Label>
                </div>
                <Popover open={locationComboboxOpen} onOpenChange={setLocationComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={locationComboboxOpen}
                      className={`w-full justify-between bg-white ${errors.billingLocation ? 'border-red-500' : 'border-blue-300'}`}
                    >
                      <span className="flex items-center gap-2">
                        {selectedLocation.displayName}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search locations..." />
                      <CommandList>
                        <CommandEmpty>No locations found.</CommandEmpty>
                        <CommandGroup>
                          {locationOptions.map((location) => (
                            <CommandItem
                              key={location.id}
                              value={location.displayName}
                              onSelect={() => {
                                handleChange('billingLocation', location.id);
                                setLocationComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.billingLocation === location.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">{location.displayName}</span>
                                <span className="text-xs text-gray-500">{location.addressLines[0]}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {errors.billingLocation && (
                  <p className="text-sm text-red-500">{errors.billingLocation}</p>
                )}
                
                {/* Show selected location details */}
                {/* <div className="mt-3 p-3 bg-white rounded border border-blue-200">
                  <p className="text-xs font-semibold text-gray-700 mb-1">Selected Billing Address:</p>
                  {selectedLocation.addressLines.map((line, idx) => (
                    <p key={idx} className="text-xs text-gray-600">{line}</p>
                  ))}
                  <p className="text-xs text-gray-600 mt-1">T: {selectedLocation.phone}</p>
                  {selectedLocation.fax && (
                    <p className="text-xs text-gray-600">F: {selectedLocation.fax}</p>
                  )}
                  <p className="text-xs text-gray-600">E: {selectedLocation.email}</p>
                  <p className="text-xs text-gray-600">W: {selectedLocation.website}</p>
                </div> */}
              </div>


              {/* Client and Matter in Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Client Selection */}
              <div className="space-y-2">
                <Label htmlFor="clientId">
                  Client <span className="text-red-500 -ml-1.5">*</span>
                </Label>
                <Popover open={clientComboboxOpen} onOpenChange={setClientComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={clientComboboxOpen}
                      className={`w-full justify-between ${errors.clientId ? 'border-red-500' : ''}`}
                    >
                      {formData.clientId ? (
                        (() => {
                          const selectedClient = clients.find(
                            (client) => client.id.toString() === formData.clientId
                          );
                          return selectedClient ? selectedClient.companyName : "Select client";
                        })()
                      ) : (
                        "Select client"
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search clients..." />
                      <CommandList>
                        <CommandEmpty>No clients found.</CommandEmpty>
                        <CommandGroup>
                          {clients.map((client) => (
                            <CommandItem
                              key={client.id}
                              value={client.companyName}
                              onSelect={() => {
                                handleChange('clientId', client.id.toString());
                                handleChange('matterId', '');
                                setClientComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.clientId === client.id.toString() ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {client.companyName}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {errors.clientId && (
                  <p className="text-sm text-red-500">{errors.clientId}</p>
                )}
              </div>

                {/* Matter Selection (Multi-select) */}
              <div className="space-y-2">
                  <Label htmlFor="matterIds">
                    Matter(s) <span className="text-gray-500 text-xs">(Select one or more)</span>
                  </Label>
                  {!formData.clientId ? (
                    <p className="text-xs text-gray-500">Please select a client first</p>
                  ) : matters.length === 0 ? (
                    <p className="text-xs text-gray-500">No matters found for this client</p>
                  ) : (
                    <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                          {matters.map((matter) => (
                        <div key={matter.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`matter-${matter.id}`}
                            checked={selectedMatterIds.includes(matter.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedMatterIds([...selectedMatterIds, matter.id]);
                                // Update formData.matterId for backward compatibility (use first selected)
                                if (selectedMatterIds.length === 0) {
                                handleChange('matterId', matter.id.toString());
                                }
                              } else {
                                const newIds = selectedMatterIds.filter(id => id !== matter.id);
                                setSelectedMatterIds(newIds);
                                // Update formData.matterId
                                if (newIds.length > 0) {
                                  handleChange('matterId', newIds[0].toString());
                                } else {
                                  handleChange('matterId', '');
                                }
                              }
                            }}
                          />
                          <label
                            htmlFor={`matter-${matter.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                          >
                              {matter.title}
                          </label>
                        </div>
                      ))}
                      {selectedMatterIds.length > 1 && (
                        <p className="text-xs text-blue-600 mt-2">
                          ✓ {selectedMatterIds.length} matters selected (Multi-matter invoice)
                  </p>
                )}
                    </div>
                  )}
                </div>
              </div>

              {/* Date Range for Timesheet Filtering */}
              {(selectedMatterIds.length > 0 || formData.matterId) && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="matterDateFrom">Timesheet Period From</Label>
                    <Input
                      id="matterDateFrom"
                      type="date"
                      value={formData.matterDateFrom}
                      onChange={(e) => handleChange('matterDateFrom', e.target.value)}
                    />
                    <p className="text-xs text-gray-500">
                      Optional: Filter timesheets by date
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="matterDateTo">Timesheet Period To</Label>
                    <Input
                      id="matterDateTo"
                      type="date"
                      value={formData.matterDateTo}
                      onChange={(e) => handleChange('matterDateTo', e.target.value)}
                    />
                    <p className="text-xs text-gray-500">
                      Optional: Filter timesheets by date
                    </p>
                  </div>
                </div>
              )}

              {/* Timesheet Selection */}
              {(selectedMatterIds.length > 0 || formData.matterId) && timesheets.length > 0 && (
                <div className="space-y-2 border rounded-md p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-base font-semibold">Timesheets to Include</Label>
                    <span className="text-sm text-gray-600">
                      {selectedTimesheetIds.length} of {timesheets.length} selected
                    </span>
                  </div>

                  {/* Filter and Select All Controls */}
                  <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-300">
                    {/* Filter by User */}
                    <div className="flex-1">
                      <Label className="text-xs text-gray-600 mb-1 block">Filter by Person</Label>
                      <Select
                        value={filterByUser === 'all' ? 'all' : filterByUser.toString()}
                        onValueChange={(value) => setFilterByUser(value === 'all' ? 'all' : parseInt(value))}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All People</SelectItem>
                          {Array.from(new Set(timesheets.map(ts => ts.user?.id).filter(Boolean))).map(userId => {
                            const user = timesheets.find(ts => ts.user?.id === userId)?.user;
                            return (
                              <SelectItem key={userId} value={userId!.toString()}>
                                {user?.name || 'Unknown'}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Select All Button */}
                    <div className="pt-6">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const selectableTimesheets = timesheets.filter(ts => !ts.isInvoiced);
                          const filteredByUser = filterByUser === 'all' 
                            ? selectableTimesheets 
                            : selectableTimesheets.filter(ts => ts.user?.id === filterByUser);
                          
                          const allSelectableIds = filteredByUser.map(ts => ts.id);
                          const allCurrentlySelected = filteredByUser.length > 0 && 
                            filteredByUser.every(ts => selectedTimesheetIds.includes(ts.id));
                          
                          let newSelected: number[];
                          if (allCurrentlySelected) {
                            // Deselect all filtered
                            newSelected = selectedTimesheetIds.filter(id => !allSelectableIds.includes(id));
                          } else {
                            // Select all filtered
                            newSelected = [...new Set([...selectedTimesheetIds, ...allSelectableIds])];
                          }
                          
                          setSelectedTimesheetIds(newSelected);
                          
                          // Recalculate amounts and dates
                          const selectedTimesheets = timesheets.filter(t => newSelected.includes(t.id));
                          const newTotal = selectedTimesheets.reduce((sum, t) => sum + (t.calculatedAmount || 0), 0);
                          
                          // Update minimum dates
                          if (selectedTimesheets.length > 0) {
                            const latestDate = selectedTimesheets.reduce((latest: string, t: Timesheet) => {
                              return !latest || t.date > latest ? t.date : latest;
                            }, '');
                            
                            if (latestDate) {
                              const formattedLatestDate = new Date(latestDate).toISOString().split('T')[0];
                              setMinInvoiceDate(formattedLatestDate);
                              setMinDueDate(formattedLatestDate);
                              
                              if (mode === 'create') {
                                const latestTimesheetDate = new Date(latestDate);
                                const dueDate = new Date(latestTimesheetDate);
                                dueDate.setDate(dueDate.getDate() + 60);
                                const formattedDueDate = dueDate.toISOString().split('T')[0];
                                
                                setFormData(prev => ({
                                  ...prev,
                                  invoiceDate: formattedLatestDate,
                                  dueDate: formattedDueDate,
                                  amount: newTotal > 0 ? newTotal.toFixed(2) : ''
                                }));
                              } else {
                                setFormData(prev => ({
                                  ...prev,
                                  amount: newTotal > 0 ? newTotal.toFixed(2) : ''
                                }));
                              }
                            }
                          } else {
                            setMinInvoiceDate('');
                            setMinDueDate('');
                            setFormData(prev => ({
                              ...prev,
                              amount: ''
                            }));
                          }
                        }}
                        className="text-xs"
                      >
                        {(() => {
                          const selectableTimesheets = timesheets.filter(ts => !ts.isInvoiced);
                          const filteredByUser = filterByUser === 'all' 
                            ? selectableTimesheets 
                            : selectableTimesheets.filter(ts => ts.user?.id === filterByUser);
                          const allSelected = filteredByUser.length > 0 && 
                            filteredByUser.every(ts => selectedTimesheetIds.includes(ts.id));
                          return allSelected ? 'Deselect All' : 'Select All';
                        })()}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {timesheets
                      .filter(ts => filterByUser === 'all' || ts.user?.id === filterByUser)
                      .map((ts) => {
                      const isSelected = selectedTimesheetIds.includes(ts.id);
                      const canSelect = !ts.isInvoiced;
                      
                      return (
                        <div 
                          key={ts.id}
                          className={`flex items-start gap-3 p-3 rounded border ${
                            ts.isInvoiced 
                              ? 'bg-yellow-50 border-yellow-200' 
                              : isSelected 
                                ? 'bg-blue-50 border-blue-200' 
                                : 'bg-white border-gray-200'
                          }`}
                        >
                            <input
                              type="checkbox"
                              checked={isSelected}
                            disabled={!canSelect}
                              onChange={(e) => {
                                // NEW CODE STARTS HERE
                                let newIds: number[];
                                
                                if (e.target.checked) {
                                  // Add this timesheet
                                  newIds = [...selectedTimesheetIds, ts.id];
                                } else {
                                  // Remove this timesheet
                                  newIds = selectedTimesheetIds.filter(id => id !== ts.id);
                                }
                                
                                setSelectedTimesheetIds(newIds);
                                
                                // Get the selected timesheets
                                const newTimesheets = timesheets.filter(t => newIds.includes(t.id));
                                
                                // Recalculate amount
                                const newTotal = newTimesheets.reduce((sum, t) => 
                                  sum + (t.calculatedAmount || 0), 0
                                );
                                
                                // UPDATE MINIMUM INVOICE DATE based on selected timesheets
                                // Use LATEST timesheet as the minimum allowed invoice date
                                if (newTimesheets.length > 0) {
                                  const latestDateForInvoice = newTimesheets.reduce((latest: string, t: Timesheet) => {
                                    return !latest || t.date > latest ? t.date : latest;
                                  }, '');
                                  
                                  if (latestDateForInvoice) {
                                    const formattedLatestDate = new Date(latestDateForInvoice).toISOString().split('T')[0];
                                    setMinInvoiceDate(formattedLatestDate);
                                    
                                    // Set invoice date to latest timesheet date
                                    if (mode === 'create') {
                                      setFormData(prev => ({
                                        ...prev,
                                        invoiceDate: formattedLatestDate,
                                      }));
                                    }
                                  }
                                  
                                  // UPDATE MINIMUM DUE DATE based on selected timesheets (LATEST date)
                                  const latestDateForDue = newTimesheets.reduce((latest: string, t: Timesheet) => {
                                    return !latest || t.date > latest ? t.date : latest;
                                  }, '');
                                  
                                  if (latestDateForDue) {
                                    const formattedLatestDate = new Date(latestDateForDue).toISOString().split('T')[0];
                                    setMinDueDate(formattedLatestDate);
                                    
                                    // Calculate due date: 60 days after latest timesheet
                                    if (mode === 'create') {
                                      const latestTimesheetDate = new Date(latestDateForDue);
                                      const dueDate = new Date(latestTimesheetDate);
                                      dueDate.setDate(dueDate.getDate() + 60);
                                      
                                      const formattedDueDate = dueDate.toISOString().split('T')[0];
                                      
                                      setFormData(prev => ({
                                        ...prev,
                                        dueDate: formattedDueDate,
                                      }));
                                    }
                                  }
                                } else {
                                  // No timesheets selected, clear everything
                                  setMinInvoiceDate('');
                                  setMinDueDate('');
                                  if (mode === 'create') {
                                    setFormData(prev => ({
                                      ...prev,
                                      invoiceDate: '',
                                      dueDate: '',
                                    }));
                                  }
                                }
                                
                                // Update amount
                                setFormData(prev => ({
                                  ...prev,
                                  amount: newTotal > 0 ? newTotal.toFixed(2) : ''
                                }));
                              }}
                            className="h-4 w-4 mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-900">
                                {new Date(ts.date).toLocaleDateString('en-GB', { 
                                  day: '2-digit', 
                                  month: 'short', 
                                  year: 'numeric' 
                                })}
                                </span>
                              {ts.user && (
                                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded font-medium">
                                  {ts.user.name}
                                  {ts.user.role && ` (${ts.user.role})`}
                                </span>
                              )}
                              {ts.activityType && (
                                <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                                  {ts.activityType}
                                </span>
                              )}
                                {ts.isInvoiced && (
                                  <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded">
                                    Already Invoiced
                                  </span>
                                )}
                              </div>
                            {ts.description && (
                              <p className="text-xs text-gray-600 mt-1 line-clamp-1">
                                {ts.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                              {ts.billableHours && (
                                <span>Hours: {ts.billableHours}</span>
                              )}
                              {ts.hourlyRate && (
                                <span>
                                  Rate: {formatAmountWithCurrency(ts.hourlyRate, (ts.calculatedAmountCurrency || ts.matter?.currency || 'INR') as CurrencyCode)}/hr
                                </span>
                              )}
                              {ts.isInvoiced && ts.invoiceNumber && (
                                <span className="text-amber-600">
                                  In {ts.invoiceNumber}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="text-sm font-semibold text-gray-900">
                              {ts.calculatedAmount !== null && ts.calculatedAmount !== undefined
                                ? formatAmountWithCurrency(ts.calculatedAmount, (ts.calculatedAmountCurrency || ts.matter?.currency || 'INR') as CurrencyCode)
                                : formatAmountWithCurrency(0, 'INR')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {timesheets.filter(ts => ts.isInvoiced).length > 0 && (
                    <p className="text-xs text-amber-600 mt-2">
                      ⚠️ Some timesheets are already included in other invoices and cannot be selected.
                    </p>
                  )}
                </div>
              )}

              {(selectedMatterIds.length > 0 || formData.matterId) && !isLoadingTimesheets && timesheets.length === 0 && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
                  <p className="text-sm text-gray-600">
                    No approved timesheets found{selectedMatterIds.length > 1 ? ' for the selected matters' : ' for this matter'}
                    {(formData.matterDateFrom || formData.matterDateTo) && ' in the selected date range'}.
                  </p>
                </div>
              )}

              {/* ✅ Expense Inclusion Section */}
              {(selectedMatterIds.length > 0 || formData.matterId) && (
                <div className="space-y-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="includeExpenses"
                      checked={includeExpenses}
                      onCheckedChange={(checked) => {
                        setIncludeExpenses(checked === true);
                        if (!checked) {
                          setSelectedExpenseIds([]);
                        }
                      }}
                    />
                    <Label htmlFor="includeExpenses" className="text-sm font-semibold text-green-900 cursor-pointer">
                      Include Expenses
                    </Label>
                    <CurrencyBadge currency="INR" />
                    <span className="text-xs text-gray-600">
                      (Expenses are always in INR)
                    </span>
                  </div>

                  {includeExpenses && (
                    <div className="mt-3 space-y-2">
                      {isLoadingExpenses ? (
                        <p className="text-sm text-gray-600">Loading expenses...</p>
                      ) : expenses.length > 0 ? (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-xs text-gray-600">
                              Select Expenses ({selectedExpenseIds.length} of {expenses.length} selected)
                            </Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (selectedExpenseIds.length === expenses.length) {
                                  setSelectedExpenseIds([]);
                                } else {
                                  setSelectedExpenseIds(expenses.map(e => e.id));
                                }
                              }}
                            >
                              {selectedExpenseIds.length === expenses.length ? 'Deselect All' : 'Select All'}
                            </Button>
                          </div>
                          <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-200 rounded p-2 bg-white">
                            {expenses.map((expense) => {
                              const isSelected = selectedExpenseIds.includes(expense.id);
                              return (
                                <div
                                  key={expense.id}
                                  className={`flex items-start gap-3 p-2 rounded border ${
                                    isSelected
                                      ? 'bg-green-50 border-green-200'
                                      : 'bg-white border-gray-200'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedExpenseIds([...selectedExpenseIds, expense.id]);
                                      } else {
                                        setSelectedExpenseIds(selectedExpenseIds.filter(id => id !== expense.id));
                                      }
                                    }}
                                    className="h-4 w-4 mt-0.5"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-medium text-gray-900">
                                        {expense.category}
                                      </span>
                                      {expense.subCategory && (
                                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                                          {expense.subCategory}
                                        </span>
                                      )}
                                      {expense.status && (
                                        <span className={`text-xs px-2 py-0.5 rounded ${
                                          expense.status === 'approved' ? 'bg-green-100 text-green-800' :
                                          expense.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                          'bg-red-100 text-red-800'
                                        }`}>
                                          {expense.status}
                                        </span>
                                      )}
                                    </div>
                                    {expense.description && (
                                      <p className="text-xs text-gray-600 mt-1 line-clamp-1">
                                        {expense.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <span className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                                      {formatAmountWithCurrency(expense.amount, 'INR')}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {formData.invoiceCurrency && formData.invoiceCurrency !== 'INR' && selectedExpenseIds.length > 0 && (
                            <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded mt-2">
                              💡 Expenses will be converted from INR to {formData.invoiceCurrency} using the exchange rate
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-gray-600">
                          No expenses found for the selected matters (expenses must have a matter to be included)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Invoice Number */}
              <div className="space-y-2">
                <Label htmlFor="invoiceNumber">
                  Invoice Number <span className="text-red-500 -ml-1.5">*</span>
                </Label>
                <div className="relative">
                <Input
                  id="invoiceNumber"
                  type="text"
                    placeholder="DDMMYYYY-OFFICE-SEQ"
                  value={formData.invoiceNumber}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase();
                      handleChange('invoiceNumber', value);
                      validateInvoiceNumber(value);
                    }}
                    className={`${errors.invoiceNumber || invoiceNumberError ? 'border-red-500' : ''} ${isGeneratingInvoiceNumber ? 'pr-8' : ''}`}
                  />
                  {isGeneratingInvoiceNumber && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Format: DDMMYYYY-OFFICE (e.g., 07012026-M). Suffix -A, -B added for multiple invoices same day. Office: D=Delhi, M=Mumbai, B=Bangalore, LT=Delhi Litigation
                </p>
                {invoiceNumberError && (
                  <p className="text-sm text-amber-600">{invoiceNumberError}</p>
                )}
                {errors.invoiceNumber && (
                  <p className="text-sm text-red-500">{errors.invoiceNumber}</p>
                )}
              </div>

              {/* Invoice Date, Due Date, and Amount in Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Invoice Date */}
              <div className="space-y-2">
                <Label htmlFor="invoiceDate">
                  Invoice Date <span className="text-red-500 -ml-1.5">*</span>
                </Label>
                <Input
                  id="invoiceDate"
                  type="date"
                  value={formData.invoiceDate}
                  onChange={(e) => handleChange('invoiceDate', e.target.value)}
                  className={errors.invoiceDate ? 'border-red-500' : ''}
                    min={minInvoiceDate}
                />
                {minInvoiceDate && (
                  <p className="text-xs text-gray-500">
                      Min: {new Date(minInvoiceDate).toLocaleDateString()}
                  </p>
                )}
                {errors.invoiceDate && (
                  <p className="text-sm text-red-500">{errors.invoiceDate}</p>
                )}
              </div>

              {/* Due Date */}
              <div className="space-y-2">
                <Label htmlFor="dueDate">
                  Due Date <span className="text-red-500 -ml-1.5">*</span>
                </Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => handleChange('dueDate', e.target.value)}
                  className={errors.dueDate ? 'border-red-500' : ''}
                    min={minDueDate || undefined}
                />
                {minDueDate && (
                  <p className="text-xs text-gray-500">
                      Min: {new Date(minDueDate).toLocaleDateString()}
                  </p>
                )}
                {errors.dueDate && (
                  <p className="text-sm text-red-500">{errors.dueDate}</p>
                )}
              </div>

              {/* Amount */}
              <div hidden className="space-y-2">
                <Label htmlFor="amount">
                  Amount (₹) <span className="text-red-500 -ml-1.5">*</span>
                  {formData.matterId && calculatedAmount !== null && calculatedAmount > 0 && (
                    <span className="ml-2 text-xs text-gray-500 font-normal">
                      (Auto-calculated from {timesheets.length} timesheet{timesheets.length !== 1 ? 's' : ''})
                    </span>
                  )}
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={
                    formData.matterId
                      ? isLoadingTimesheets
                        ? 'Calculating...'
                        : calculatedAmount !== null && calculatedAmount > 0
                        ? 'Auto-calculated amount'
                        : 'Enter invoice amount manually'
                      : 'Enter invoice amount'
                  }
                  value={formData.amount}
                  onChange={(e) => handleChange('amount', e.target.value)}
                  className={errors.amount ? 'border-red-500' : ''}
                  readOnly={!!formData.matterId && calculatedAmount !== null && calculatedAmount > 0}
                  disabled={isLoadingTimesheets || (!!formData.matterId && calculatedAmount !== null && calculatedAmount > 0)}
                  required={false}
                  aria-required="false"
                />
                {isLoadingTimesheets && (
                  <p className="text-xs text-gray-500">Loading timesheets...</p>
                )}
                {(selectedMatterIds.length > 0 || formData.matterId) && !isLoadingTimesheets && calculatedAmount !== null && calculatedAmount > 0 && (
                  <p className="text-xs text-green-600">
                    Amount calculated from {timesheets.length} approved timesheet{timesheets.length !== 1 ? 's' : ''}
                  </p>
                )}
                {(selectedMatterIds.length > 0 || formData.matterId) && !isLoadingTimesheets && timesheets.length > 0 && calculatedAmount === null && (
                  <p className="text-xs text-amber-600">
                    Found {timesheets.length} timesheet{timesheets.length !== 1 ? 's' : ''} but no calculated amounts. Please enter amount manually.
                  </p>
                )}
                {(selectedMatterIds.length > 0 || formData.matterId) && !isLoadingTimesheets && timesheets.length === 0 && (
                  <p className="text-xs text-amber-600">
                    No approved timesheets found{selectedMatterIds.length > 1 ? ' for the selected matters' : ' for this matter'}
                    {(formData.matterDateFrom || formData.matterDateTo) && ' in the selected date range'}. Amount can be entered manually.
                  </p>
                )}
                {errors.amount && (
                  <p className="text-sm text-red-500">{errors.amount}</p>
                )}
                </div>
              </div>

              {/* Invoice Currency */}
              {formData.matterId && (
                <div className="space-y-2">
                  <Label htmlFor="invoiceCurrency">
                    Invoice Currency <span className="text-red-500">*</span>
                    <span className="ml-2 text-xs text-gray-500 font-normal">
                      ({currencyBreakdown.length > 0 && `${currencyBreakdown.length} currency${currencyBreakdown.length > 1 ? 'ies' : ''} detected`})
                    </span>
                  </Label>
                  <Popover open={currencyComboboxOpen} onOpenChange={setCurrencyComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={currencyComboboxOpen}
                        className="w-full justify-between"
                      >
                        {formData.invoiceCurrency
                          ? `${getCurrencySymbol(formData.invoiceCurrency as CurrencyCode)} ${formData.invoiceCurrency}`
                          : 'Select currency...'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search currency..." />
                        <CommandList>
                          <CommandEmpty>No currency found.</CommandEmpty>
                          <CommandGroup>
                            {supportedCurrencies.map((currency) => (
                              <CommandItem
                                key={currency}
                                value={currency}
                                onSelect={() => {
                                  handleChange('invoiceCurrency', currency);
                                  setCurrencyComboboxOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    formData.invoiceCurrency === currency ? 'opacity-100' : 'opacity-0'
                                  )}
                                />
                                {getCurrencySymbol(currency as CurrencyCode)} {currency}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  
                  {/* Currency Breakdown & Exchange Rates */}
                  {showCurrencyBreakdown && currencyBreakdown.length > 1 && formData.invoiceCurrency && (
                    <div className="mt-4 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg space-y-4">
                      <div className="flex items-center gap-2">
                        <ArrowRightLeft className="h-5 w-5 text-yellow-700" />
                        <Label className="text-base font-semibold text-yellow-900">
                          Currency Breakdown & Exchange Rates <span className="text-red-500">*</span>
                        </Label>
                      </div>
                      <p className="text-sm text-yellow-800">
                        Multiple currencies detected. Please provide exchange rates to convert all amounts to <strong>{formData.invoiceCurrency}</strong>.
                      </p>
                      
                      <div className="space-y-3">
                        {currencyBreakdown.map((breakdown) => {
                          if (breakdown.currency === formData.invoiceCurrency) {
                            // No conversion needed for invoice currency
                            return (
                              <div key={breakdown.currency} className="p-3 bg-white rounded border border-yellow-200">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <div className="font-medium flex items-center gap-2">
                                      <CurrencyBadge currency={breakdown.currency as CurrencyCode} />
                                      {breakdown.currency}
                        </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      {breakdown.matters.length} matter{breakdown.matters.length > 1 ? 's' : ''}: {breakdown.matters.map(m => m.title).join(', ')}
                        </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-semibold">{formatAmountWithCurrency(breakdown.amount, breakdown.currency as CurrencyCode)}</div>
                                    <div className="text-xs text-gray-500">No conversion needed</div>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          
                          const rateKey = `${breakdown.currency}_${formData.invoiceCurrency}`;
                          const currentRate = exchangeRates[breakdown.currency] || '';
                          const convertedAmount = currentRate && breakdown.amount > 0 
                            ? breakdown.amount * parseFloat(currentRate.toString()) 
                            : null;
                          
                          return (
                            <div key={breakdown.currency} className="p-3 bg-white rounded border border-yellow-200 space-y-2">
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="font-medium flex items-center gap-2">
                                    <CurrencyBadge currency={breakdown.currency as CurrencyCode} />
                                    {breakdown.currency}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {breakdown.matters.length} matter{breakdown.matters.length > 1 ? 's' : ''}: {breakdown.matters.map(m => m.title).join(', ')}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-semibold">{formatAmountWithCurrency(breakdown.amount, breakdown.currency as CurrencyCode)}</div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                                <div className="flex-1">
                                  <Label htmlFor={`rate-${breakdown.currency}`} className="text-xs text-gray-600">
                                    Exchange Rate ({breakdown.currency} → {formData.invoiceCurrency})
                                  </Label>
                                  <Input
                                    id={`rate-${breakdown.currency}`}
                                    type="number"
                                    step="0.0001"
                                    min="0.0001"
                                    placeholder="e.g., 0.012"
                                    value={currentRate}
                                    onChange={(e) => {
                                      const rate = e.target.value;
                                      setExchangeRates((prev) => {
                                        const newRates = { ...prev };
                                        if (rate && !isNaN(parseFloat(rate))) {
                                          newRates[breakdown.currency] = parseFloat(rate);
                                        } else {
                                          delete newRates[breakdown.currency];
                                        }
                                        return newRates;
                                      });
                                    }}
                                    className="mt-1"
                                  />
                                </div>
                                {convertedAmount !== null && (
                                  <div className="text-right">
                                    <div className="text-xs text-gray-600">Converted:</div>
                                    <div className="font-semibold text-sm">
                                      {formatAmountWithCurrency(convertedAmount, formData.invoiceCurrency as CurrencyCode)}
                      </div>
                    </div>
                  )}
                </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Total in Invoice Currency */}
                      {currencyBreakdown.length > 0 && Object.keys(exchangeRates).length > 0 && 
                       Object.values(exchangeRates).every(rate => rate && rate > 0) && (
                        <div className="mt-4 p-3 bg-green-50 border border-green-300 rounded">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-green-900">Total in {formData.invoiceCurrency}:</span>
                            <span className="text-lg font-bold text-green-900">
                              {formatAmountWithCurrency(
                                (() => {
                                  // Calculate from currency breakdown
                                  let total = currencyBreakdown.reduce((sum, b) => {
                                    if (b.currency === formData.invoiceCurrency) {
                                      return sum + b.amount;
                                    }
                                    const rate = exchangeRates[b.currency];
                                    return sum + (rate ? b.amount * rate : 0);
                                  }, 0);
                                  
                                  // ✅ ADD EXPENSES (always in INR, convert if needed)
                                  if (includeExpenses && selectedExpenseIds.length > 0) {
                                    const expenseTotal = expenses
                                      .filter(e => selectedExpenseIds.includes(e.id))
                                      .reduce((sum, e) => sum + (e.amount || 0), 0);
                                    
                                    if (formData.invoiceCurrency === 'INR') {
                                      total += expenseTotal;
                                    } else {
                                      // Convert INR expenses to invoice currency
                                      const inrRate = exchangeRates['INR'];
                                      if (inrRate && inrRate > 0) {
                                        total += expenseTotal * inrRate;
                                      }
                                    }
                                  }
                                  
                                  return total;
                                })(),
                                formData.invoiceCurrency as CurrencyCode
                              )}
                            </span>
            </div>
                        </div>
                      )}
                      
                      {/* Validation Error */}
                      {errors.exchangeRates && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                          {errors.exchangeRates}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">
                  Description <span className="text-red-500 -ml-1.5">*</span>
                </Label>
                <textarea
                  id="description"
                  rows={6}
                  placeholder="Describe the services provided..."
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.description ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.description && (
                  <p className="text-sm text-red-500">{errors.description}</p>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <textarea
                  id="notes"
                  rows={3}
                  placeholder="Additional notes or payment instructions..."
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

          {/* FOOTER ACTIONS - Fixed at bottom */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-white flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button className="mb-2 flex items-center justify-center gap-2 px-4 py-2.5 
                        bg-gradient-to-r from-red-500 to-red-600  text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-colors duration-200 shadow-md py-3" type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? mode === 'create'
                  ? 'Creating...'
                  : 'Updating...'
                : mode === 'create'
                ? 'Create Invoice'
                : 'Update Invoice'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
