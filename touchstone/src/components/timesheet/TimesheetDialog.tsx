import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';
import { API_ENDPOINTS } from '@/lib/api';
import { Plus, X, Trash2, Check, ChevronsUpDown, Upload, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import CurrencyBadge from '@/components/ui/currency-badge';
import { formatAmountWithCurrency, type CurrencyCode } from '@/lib/currencyUtils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';

interface Matter {
  id: number;
  title: string;
  billingRateType: string;
  startDate: string; // Added to track matter start date
  currency?: string;
  client: {
    id: number;
    name: string;
  };
  userServiceTypes: Array<{
    serviceType: string;
    hourlyRate: number | null;
  }>;
}

interface User {
  id: number;
  name: string;
  email: string;
}

interface Vendor {
  vendor_id: number;
  vendor_name: string;
}

interface ExpenseData {
  id?: string;
  expense_id?: number; // Backend ID after creation
  category: string;
  sub_category: string;
  description: string;
  vendor_id: string;
  amount: string;
  due_date: string;
  receipt_url: string;
  notes: string;
  receiptFile?: File | null; // For tracking uploaded file
  receiptPreview?: string | null; // For image preview
}

interface BackendExpense {
  expense_id: number;
  category: string;
  sub_category: string | null;
  description: string | null;
  vendor_id: number | null;
  amount: number;
  due_date: string | null;
  receipt_url: string | null;
  notes: string | null;
}

interface TimesheetData {
  matterId?: number;
  date?: string;
  hoursWorked?: number;
  billableHours?: number;
  nonBillableHours?: number;
  activityType?: string;
  description?: string;
  hourlyRate?: number;
  expenseId?: number;
  notes?: string;
}

interface TimesheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  mode: 'create' | 'edit';
  timesheetId?: number;
  initialData?: TimesheetData;
}

const initialFormData = {
  matter_id: '',
  date: new Date().toISOString().split('T')[0],
  billable_hours: '00:00', // Changed to time string
  non_billable_hours: '00:00', // Changed to time string
  hours_worked: '00:00', // Changed to time string
  activity_type: '',
  description: '',
  service_type: '',
  hourly_rate: '',
  notes: '',
};

const createEmptyExpense = (): ExpenseData => ({
  id: `temp-${Date.now()}-${Math.random()}`,
  category: '',
  sub_category: '',
  description: '',
  vendor_id: '',
  amount: '',
  due_date: '',
  receipt_url: '',
  notes: '',
  receiptFile: null,
  receiptPreview: null,
});

const activityTypes = [
  'Client Meeting',
  'Strategy Discussion',
  'Document Review',
  'Research',
  'Drafting',
  'Court Appearance',
  'Phone Call',
  'Email Communication',
  'Other',
];
// Helper functions for time conversion
const timeStringToMinutes = (timeString: string): number => {
  if (!timeString) return 0;
  const [hours, minutes] = timeString.split(':').map(Number);
  return (hours * 60) + minutes;
};

const minutesToTimeString = (minutes: unknown): string => {
  const safeMinutes = Number(minutes);

  if (!Number.isFinite(safeMinutes) || safeMinutes < 0) {
    return '00:00';
  }

  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;

  return `${hours.toString().padStart(2, '0')}:${mins
    .toString()
    .padStart(2, '0')}`;
};

export default function TimesheetDialog({
  open,
  onOpenChange,
  onSuccess,
  mode,
  timesheetId,
  initialData,
}: TimesheetDialogProps) {
  const { role } = useAuth();
  const [formData, setFormData] = useState(initialFormData);
  const [savedExpenses, setSavedExpenses] = useState<ExpenseData[]>([]); // Expenses that have been confirmed
  const [currentExpense, setCurrentExpense] = useState<ExpenseData | null>(null); // Expense being edited
  const [matters, setMatters] = useState<Matter[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMatters, setIsLoadingMatters] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [selectedMatter, setSelectedMatter] = useState<Matter | null>(null);
  const [availableServiceTypes, setAvailableServiceTypes] = useState<Array<{serviceType: string, hourlyRate: number | null}>>([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [matterComboboxOpen, setMatterComboboxOpen] = useState(false);
  const [userComboboxOpen, setUserComboboxOpen] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [matterStartDate, setMatterStartDate] = useState<string | null>(null);
  const [vendorComboboxOpen, setVendorComboboxOpen] = useState(false);
  const [editTimesheet, setEditTimesheet] = useState<TimesheetData | null>(null);

  // Check if current user can create timesheets for others
  const canCreateForOthers = role?.name === 'admin' || role?.name === 'accountant';

  // Get current date for max date validation
  const currentDate = new Date().toISOString().split('T')[0];

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

useEffect(() => {
  if (!open) return;

  fetchMatters();
  fetchVendors();

  if (canCreateForOthers && mode === 'create') {
    fetchUsers();
  }

  if (mode === 'edit' && timesheetId) {
    fetchTimesheetDetails(timesheetId);
  }

  if (mode === 'create') {
    setFormData(initialFormData);
    setSavedExpenses([]);
    setCurrentExpense(null);
    setShowExpenseForm(false);
    setSelectedMatter(null);
    setSelectedUserId(null);
    setAvailableServiceTypes([]);
    setMatterStartDate(null);
  }
}, [open, mode, timesheetId, canCreateForOthers]);


  // Re-fetch matters when selected user changes
  useEffect(() => {
    if (open && mode === 'create' && canCreateForOthers) {
      fetchMatters();
      // Reset matter selection when user changes
      setFormData((prev) => ({ ...prev, matter_id: '' }));
      setSelectedMatter(null);
      setAvailableServiceTypes([]);
    }
  }, [selectedUserId]);

  const fetchMatters = async () => {
    try {
      setIsLoadingMatters(true);
      
      // Build URL with optional userId query parameter
      let url = API_ENDPOINTS.timesheets.assignedMatters;
      if (selectedUserId && canCreateForOthers && mode === 'create') {
        url += `?userId=${selectedUserId}`;
      }
      
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch assigned matters');
      }

      const data = await response.json();
      if (data.success) {
        setMatters(prev => {
  const map = new Map<number, Matter>();

  [...prev, ...data.data].forEach(m => {
    map.set(m.id, m);
  });

  return Array.from(map.values());
});
      }
    } catch (err) {
      console.error('Error fetching assigned matters:', err);
    } finally {
      setIsLoadingMatters(false);
    }
  };


  const fetchVendors = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/vendors?active_status=true`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch vendors');
      }

      const data = await response.json();
      if (data.success || data.data) {
        setVendors(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching vendors:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const response = await fetch(API_ENDPOINTS.users.list, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      if (data.success && data.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setUsers(data.data.map((user: any) => ({
          id: user.id,
          name: user.name,
          email: user.email,
        })));
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

//   useEffect(() => {
//   if (
//     mode !== 'edit' ||
//     !editTimesheet ||
//     !matters.length ||
//     !formData.matter_id
//   ) {
//     return;
//   }

//   const matter = matters.find(
//     m => m.id.toString() === formData.matter_id
//   );

//   if (!matter) return;

//   setSelectedMatter(matter);
//   setMatterStartDate(
//     matter.startDate
//       ? new Date(matter.startDate).toISOString().split('T')[0]
//       : null
//   );

//   setAvailableServiceTypes(matter.userServiceTypes || []);
// }, [mode, editTimesheet, matters, formData.matter_id]);

const normalizeTimeValue = (value: unknown): string => {
  if (typeof value === 'string' && value.includes(':')) {
    return value;
  }
  return minutesToTimeString(value);
};

  const fetchTimesheetDetails = async (id: number) => {
    try {
      setIsLoading(true);
      const response = await fetch(API_ENDPOINTS.timesheets.getById(id), {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch timesheet details');
      }

      const data = await response.json();
      if (data.success && data.data) {
        const timesheet = data.data;
        setEditTimesheet(timesheet);

        
        // Populate form data
        setFormData({
          matter_id: timesheet.matterId?.toString() || '',
          date: timesheet.date
            ? new Date(timesheet.date).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],

          billable_hours: normalizeTimeValue(timesheet.billableHours),
          non_billable_hours: normalizeTimeValue(timesheet.nonBillableHours),

          hours_worked: '00:00',

          activity_type: timesheet.activityType || '',
          description: timesheet.description || '',
          service_type: timesheet.serviceType || '',
          hourly_rate: timesheet.hourlyRate?.toString() || '',
          notes: timesheet.notes || '',
        });

        // Set selected matter if available
        // Need to wait a bit for matters to load if they're not loaded yet
        const matterId = timesheet.matterId;
        if (matterId) {
          const matter = data.data.matter; // backend already sends matter object
          if (matter) {
            setSelectedMatter(matter);
            setAvailableServiceTypes(matter.userServiceTypes || []);
            setMatterStartDate(
              matter.startDate
                ? new Date(matter.startDate).toISOString().split('T')[0]
                : null
            );
          }
          setMatters(prev => {
            const exists = prev.some(m => m.id === matter.id);
            return exists ? prev : [matter, ...prev];
          });
        }

        // Populate expenses if available
        if (timesheet.expenses && Array.isArray(timesheet.expenses) && timesheet.expenses.length > 0) {
          const mappedExpenses: ExpenseData[] = timesheet.expenses.map((exp: BackendExpense) => ({
            id: `expense-${exp.expense_id}`,
            expense_id: exp.expense_id,
            category: exp.category || '',
            sub_category: exp.sub_category || '',
            description: exp.description || '',
            vendor_id: exp.vendor_id?.toString() || '',
            amount: exp.amount?.toString() || '',
            due_date: exp.due_date ? new Date(exp.due_date).toISOString().split('T')[0] : '',
            receipt_url: exp.receipt_url || '',
            notes: exp.notes || '',
          }));
          setSavedExpenses(mappedExpenses);
        }
      }
    } catch (err) {
      console.error('Error fetching timesheet details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load timesheet details');
    } finally {
      setIsLoading(false);
    }
  };

  // useEffect(() => {
  //   if (mode !== 'edit') return;

  //   const billable = timeStringToMinutes(formData.billable_hours);
  //   const nonBillable = timeStringToMinutes(formData.non_billable_hours);

  //   if (billable || nonBillable) {
  //     setFormData(prev => ({
  //       ...prev,
  //       hours_worked: minutesToTimeString(billable + nonBillable),
  //     }));
  //   }
  // }, [
  //   mode,
  //   formData.billable_hours,
  //   formData.non_billable_hours,
  // ]);


//   useEffect(() => {
//   if (
//     mode !== 'edit' ||
//     !editTimesheet ||
//     matters.length === 0
//   ) {
//     return;
//   }

//   const matterId = editTimesheet.matter_id || editTimesheet.matterId;
//   if (!matterId) return;

//   const matter = matters.find(m => m.id === matterId);
//   if (!matter) return;

//   setSelectedMatter(matter);

//   // Matter start date
//   if (matter.startDate) {
//     setMatterStartDate(
//       new Date(matter.startDate).toISOString().split('T')[0]
//     );
//   }

//   // Service types
//   const serviceTypes = matter.userServiceTypes || [];
//   setAvailableServiceTypes(serviceTypes);

//   // Restore service type + hourly rate
//   if (editTimesheet.service_type) {
//     const selectedService = serviceTypes.find(
//       st => st.serviceType === editTimesheet.service_type
//     );

//     setFormData(prev => ({
//       ...prev,
//       service_type: editTimesheet.service_type,
//       hourly_rate:
//         matter.billingRateType !== 'fixed'
//           ? selectedService?.hourlyRate?.toString() || ''
//           : '',
//     }));
//   }
// }, [mode, editTimesheet, matters]);


  const populateFormData = (data: TimesheetData) => {
    // This function is kept for backwards compatibility but is no longer the primary method
    setFormData({
      matter_id: data.matterId?.toString() || '',
      date: data.date || new Date().toISOString().split('T')[0],
      hours_worked: data.hoursWorked?.toString() || '',
      billable_hours: data.billableHours?.toString() || '',
      non_billable_hours: data.nonBillableHours?.toString() || '',
      activity_type: data.activityType || '',
      description: data.description || '',
      service_type: '',
      hourly_rate: data.hourlyRate?.toString() || '',
      notes: data.notes || '',
    });

    // Set selected matter if available
    if (data.matterId) {
      const matter = matters.find(m => m.id === data.matterId);
      if (matter) {
        setSelectedMatter(matter);
        if (matter.startDate) {
          setMatterStartDate(new Date(matter.startDate).toISOString().split('T')[0]);
        }
      }
    }
  };

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      if (prev[name as keyof typeof prev] === value) return prev;
      return { ...prev, [name]: value };
    })
  };

  const handleCurrentExpenseChange = (field: keyof ExpenseData, value: string) => {
    if (currentExpense) {
      setCurrentExpense((prev) => prev ? { ...prev, [field]: value } : null);
    }
  };

  const handleReceiptFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentExpense) return;

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File size must be less than 5MB');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only images and PDFs are allowed');
      return;
    }

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCurrentExpense((prev) => prev ? { 
          ...prev, 
          receiptFile: file,
          receiptPreview: reader.result as string 
        } : null);
      };
      reader.readAsDataURL(file);
    } else {
      setCurrentExpense((prev) => prev ? { 
        ...prev, 
        receiptFile: file,
        receiptPreview: null 
      } : null);
    }

    setError(null);
  };

  const uploadReceiptToS3 = async (file: File): Promise<string> => {
    try {
      // Step 1: Get pre-signed URL from backend
      const presignedResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/uploads/receipt/presigned-url`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
          }),
        }
      );

      if (!presignedResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { data } = await presignedResponse.json();
      const { uploadUrl, publicUrl } = data;

      // Step 2: Upload file directly to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to S3');
      }

      return publicUrl;
    } catch (error) {
      console.error('Error uploading receipt:', error);
      throw error;
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    if (name === 'matter_id') {
      const matter = matters.find(m => m.id.toString() === value);
      if (!matter) return;

      setSelectedMatter(matter);
      setMatterStartDate(
        matter.startDate
          ? new Date(matter.startDate).toISOString().split('T')[0]
          : null
      );

      setAvailableServiceTypes(matter.userServiceTypes || []);

      if (mode !== 'edit') {
        setFormData(prev => ({
          ...prev,
          service_type: '',
          hourly_rate: '',
        }));
      }
    }


    if (name === 'service_type') {
      // Find the hourly rate from the selected matter's service types
      const selectedService = availableServiceTypes.find(st => st.serviceType === value);
      if (selectedService && selectedMatter?.billingRateType !== 'fixed') {
        setFormData((prev) => ({
          ...prev,
          hourly_rate: selectedService.hourlyRate?.toString() || '',
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          hourly_rate: '',
        }));
      }
    }
  };

  // ============================================================================
  // EXPENSE MANAGEMENT
  // ============================================================================

  const handleAddExpenseClick = () => {
    setCurrentExpense(createEmptyExpense());
    setShowExpenseForm(true);
  };

  const handleSaveCurrentExpense = () => {
    if (!currentExpense) return;

    // Validate current expense
    if (!currentExpense.category || !currentExpense.amount) {
      setError('Please fill in category and amount for the expense');
      return;
    }

    // Add to saved expenses (receipt will be uploaded on final submit)
    setSavedExpenses((prev) => [...prev, currentExpense]);
    
    // Reset current expense
    setCurrentExpense(null);
    setShowExpenseForm(false);
    setError(null);
  };

  const handleCancelCurrentExpense = () => {
    setCurrentExpense(null);
    setShowExpenseForm(false);
    setError(null);
  };

  const handleRemoveSavedExpense = (expenseId: string) => {
    setSavedExpenses((prev) => prev.filter((expense) => expense.id !== expenseId));
  };

  const createExpense = async (expenseData: ExpenseData): Promise<number | null> => {
    if (!expenseData.amount || parseFloat(expenseData.amount) <= 0) {
      return null;
    }

    try {
      const payload = {
        category: expenseData.category,
        sub_category: expenseData.sub_category || null,
        description: expenseData.description || `Expense for ${formData.activity_type} - ${formData.description}`,
        vendor_id: expenseData.vendor_id ? parseInt(expenseData.vendor_id) : null,
        matter_id: formData.matter_id ? parseInt(formData.matter_id) : null,
        amount: parseFloat(expenseData.amount),
        due_date: expenseData.due_date || null,
        receipt_url: expenseData.receipt_url || null,
        notes: expenseData.notes || `Created from timesheet on ${formData.date}`,
        status: 'pending',
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/expenses/onetime`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to create expense');
      }

      return data.data.expense_id;
    } catch (err) {
      console.error('Error creating expense:', err);
      throw err;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.matter_id || !formData.date || !formData.hours_worked || !formData.activity_type) {
      setError('Please fill in all required fields');
      return;
    }

    // Validate service type is selected when matter has service types
    if (availableServiceTypes.length > 0 && !formData.service_type) {
      setError('Please select a service type');
      return;
    }

    // Validate date is within matter start date and current date
    if (matterStartDate && formData.date < matterStartDate) {
      setError(`Date cannot be before matter start date (${new Date(matterStartDate).toLocaleDateString()})`);
      return;
    }

    if (formData.date > currentDate) {
      setError('Date cannot be in the future');
      return;
    }

    // Check if there's an unsaved expense being edited
    if (showExpenseForm && currentExpense) {
      setError('Please save or cancel the current expense before submitting');
      return;
    }

    setIsLoading(true);

    try {
      // Upload all receipts first
      const expensesWithReceipts = await Promise.all(
        savedExpenses.map(async (expense) => {
          let receiptUrl = expense.receipt_url;

          // Upload receipt if a new file was selected
          if (expense.receiptFile) {
            try {
              setUploadingReceipt(true);
              receiptUrl = await uploadReceiptToS3(expense.receiptFile);
            } catch (err) {
              console.error('Error uploading receipt for expense:', err);
              throw new Error(`Failed to upload receipt for ${expense.category} expense`);
            }
          }

          return {
            ...expense,
            receipt_url: receiptUrl,
          };
        })
      );

      setUploadingReceipt(false);

      // Create all expenses and collect their IDs
      const expenseIds: number[] = [];

      for (const expense of expensesWithReceipts) {
        // If expense already has an expense_id (from backend), use it directly
        if (expense.expense_id) {
          expenseIds.push(expense.expense_id);
        } else {
          // Create new expense
          const expenseId = await createExpense(expense);
          if (expenseId) {
            expenseIds.push(expenseId);
          }
        }
      }

      // Create ONE timesheet with all expense IDs
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {
        matterId: parseInt(formData.matter_id),
        date: formData.date,
        billableHours: timeStringToMinutes(formData.billable_hours), // Convert to minutes
        nonBillableHours: timeStringToMinutes(formData.non_billable_hours), // Convert to minutes
        activityType: formData.activity_type,
        description: formData.description || null,
        serviceType: formData.service_type || null,
        hourlyRate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
        expenseIds: expenseIds.length > 0 ? expenseIds : null,
        notes: formData.notes || null,
      };

      // Add targetUserId if creating for another user
      if (canCreateForOthers && selectedUserId) {
        payload.targetUserId = selectedUserId;
      }

      const url = mode === 'edit' && timesheetId
        ? API_ENDPOINTS.timesheets.update(timesheetId)
        : API_ENDPOINTS.timesheets.create;

      const method = mode === 'edit' ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to save timesheet');
      }

      // Success
      setFormData(initialFormData);
      setSavedExpenses([]);
      setCurrentExpense(null);
      setShowExpenseForm(false);
      setMatterStartDate(null);
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error('Error saving timesheet:', err);
      setError(err instanceof Error ? err.message : 'Failed to save timesheet');
    } finally {
      setIsLoading(false);
      setUploadingReceipt(false);
    }
  };

  const handleCancel = () => {
    setFormData(initialFormData);
    setSavedExpenses([]);
    setCurrentExpense(null);
    setShowExpenseForm(false);
    setSelectedUserId(null);
    setError(null);
    setMatterStartDate(null);
    onOpenChange(false);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add Time Entry' : 'Edit Time Entry'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Record your time spent on a matter'
              : 'Update your time entry details'}
          </DialogDescription>
        </DialogHeader>

        {isLoading && mode === 'edit' && !formData.matter_id ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Loading timesheet details...</p>
            </div>
          </div>
        ) : (
          <>
        <div className="space-y-4 py-4">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          {/* User Selection - Only visible for admin/accountant in create mode */}
          {canCreateForOthers && mode === 'create' && (
            <div className="grid gap-2">
              <Label htmlFor="user_selection">
                Create Timesheet For
              </Label>
              <Popover open={userComboboxOpen} onOpenChange={setUserComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={userComboboxOpen}
                    className="w-full justify-between"
                    disabled={isLoadingUsers}
                  >
                    {isLoadingUsers ? (
                      "Loading users..."
                    ) : selectedUserId ? (
                      (() => {
                        const selectedUser = users.find(
                          (user) => user.id === selectedUserId
                        );
                        return selectedUser ? (
                          `${selectedUser.name} (${selectedUser.email})`
                        ) : (
                          "Select a user"
                        );
                      })()
                    ) : (
                      "Select a user (optional)"
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search users..." />
                    <CommandList>
                      <CommandEmpty>No users found.</CommandEmpty>
                      <CommandGroup>
                        {users.map((user) => (
                          <CommandItem
                            key={user.id}
                            value={`${user.name} ${user.email}`}
                            onSelect={() => {
                              setSelectedUserId(user.id);
                              setUserComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedUserId === user.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{user.name}</span>
                              <span className="text-gray-500 text-xs">
                                {user.email}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-gray-500">
                Leave empty to create timesheet for yourself
              </p>
            </div>
          )}

          {/* Matter Selection */}
          <div className="grid gap-2">
            <Label htmlFor="matter_id">
              Matter
            </Label>
            <Popover open={matterComboboxOpen} onOpenChange={setMatterComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={matterComboboxOpen}
                  className="w-full justify-between"
                  disabled={isLoadingMatters}
                >
                  {isLoadingMatters ? (
                    "Loading..."
                  ) : formData.matter_id ? (
                    (() => {
                      const selectedMatter = matters.find(
                        (matter) => matter.id.toString() === formData.matter_id
                      );
                      return selectedMatter ? (
                        `${selectedMatter.title} - ${selectedMatter.client.name}`
                      ) : (
                        "Select a matter"
                      );
                    })()
                  ) : (
                    "Select a matter"
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search matters..." />
                  <CommandList>
                    <CommandEmpty>No matters found.</CommandEmpty>
                    <CommandGroup>
                      {matters.map((matter) => (
                        <CommandItem
                          key={matter.id}
                          value={`${matter.title} ${matter.client.name}`}
                          onSelect={() => {
                            handleSelectChange('matter_id', matter.id.toString());
                            setMatterComboboxOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.matter_id === matter.id.toString() ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{matter.title}</span>
                            <span className="text-gray-500 text-xs">
                              {matter.client.name}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Service Type Selection - Show after matter is selected */}
          {formData.matter_id && availableServiceTypes.length > 0 && (
            <div className="grid gap-2">
              <Label htmlFor="service_type">
                Service Type <span className="text-red-500 -ml-1.5">*</span>
              </Label>
              <Select
                value={formData.service_type}
                onValueChange={(value) => handleSelectChange('service_type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select service type" />
                </SelectTrigger>
                <SelectContent>
                  {availableServiceTypes.map((st) => (
                    <SelectItem key={st.serviceType} value={st.serviceType}>
                      {st.serviceType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Select the service type for this timesheet entry
              </p>
            </div>
          )}

          {/* Hourly Rate Display - Show after service type is selected */}
          {formData.matter_id && formData.service_type && (
            <div className="grid gap-2">
              <Label htmlFor="hourly_rate">
                Hourly Rate
                {selectedMatter?.currency && (
                  <span className="ml-2">
                    <CurrencyBadge currency={selectedMatter.currency as CurrencyCode} />
                  </span>
                )}
                {selectedMatter?.billingRateType === 'fixed' && (
                  <span className="text-xs text-gray-500 ml-2">(Fixed billing - N/A)</span>
                )}
              </Label>
              <div className="relative">
                <Input
                  id="hourly_rate"
                  name="hourly_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.hourly_rate}
                  readOnly
                  className="bg-gray-100 cursor-not-allowed"
                  placeholder="0.00"
                  disabled={selectedMatter?.billingRateType === 'fixed'}
                />
                {selectedMatter?.currency && selectedMatter.currency !== 'INR' && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="absolute right-3 top-3 h-4 w-4 text-blue-500 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Rate converted from INR to {selectedMatter.currency}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              {/* ✅ Empty Rate Card Warning */}
              {!formData.hourly_rate && selectedMatter?.billingRateType !== 'fixed' && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-sm text-blue-800">
                    ℹ️ No hourly rate assigned - calculated amount will be empty. Contact your matter lead or partner to set rates.
                  </p>
                </div>
              )}
              {formData.service_type && formData.hourly_rate && selectedMatter?.billingRateType !== 'fixed' && (
                <p className="text-xs text-gray-500">
                  Rate from matter assignment for {formData.service_type} in {selectedMatter?.currency || 'INR'}
                </p>
              )}
            </div>
          )}

          {/* Date and Activity Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="date">
                Date <span className="text-red-500 -ml-1.5">*</span>
              </Label>
              <Input
                id="date"
                name="date"
                type="date"
                value={formData.date}
                onChange={handleInputChange}
                min={matterStartDate || undefined}
                max={currentDate}
                required
              />
              {/* {matterStartDate && (
                <p className="text-xs text-gray-500">
                  Date must be between {new Date(matterStartDate).toLocaleDateString()} and today
                </p>
              )} */}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="activity_type">
                Activity Type <span className="text-red-500 -ml-1.5">*</span>
              </Label>
              <Select
                value={formData.activity_type}
                onValueChange={(value) =>
                  setFormData(prev => ({ ...prev, activity_type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select activity type" />
                </SelectTrigger>
                <SelectContent>
                  {activityTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

                {/* Hours */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-1">
                    <Label htmlFor="billable_hours">Billable Hours</Label>
                    <span className="text-xs text-gray-400">(hh:mm)</span>
                    <Input
                      id="billable_hours"
                      name="billable_hours"
                      type='time'
                      value={formData.billable_hours}
                      onChange={handleInputChange}
                      className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden without_ampm"
                    />
                  </div>

                  <div className="grid gap-1">
                    <Label htmlFor="non_billable_hours">Non-Billable Hours</Label>
                    <span className="text-xs text-gray-400">(hh:mm)</span>
                    <Input
                      id="non_billable_hours"
                      name="non_billable_hours"
                      type="time"
                      value={formData.non_billable_hours}
                      onChange={handleInputChange}
                      className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden without_ampm"
                    />
                  </div>

                  <div className="grid gap-6">
                    <Label htmlFor="hours_worked">Total Hours</Label>
                    <Input
                      id="hours_worked"
                      name="hours_worked"
                      type="time"
                      value={minutesToTimeString(
                        timeStringToMinutes(formData.billable_hours) +
                        timeStringToMinutes(formData.non_billable_hours)
                      )}
                      readOnly
                      className="bg-gray-50 appearance-none [&::-webkit-calendar-picker-indicator]:hidden without_ampm"
                    />
                  </div>
                </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe the work performed..."
              rows={3}
            />
          </div>

          {/* Notes */}
          <div className="grid gap-2">
            <Label htmlFor="notes">Internal Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="Add any internal notes..."
              rows={2}
            />
          </div>

          {/* Expenses Section */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                Expenses {savedExpenses.length > 0 && `(${savedExpenses.length})`}
              </h3>
            </div>

            {/* Saved/Confirmed Expenses */}
            {savedExpenses.map((expense, index) => (
              <div
                key={expense.id}
                className="border border-green-200 rounded-lg p-4 bg-green-50 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Check size={16} className="text-green-600" />
                      <h4 className="text-sm font-medium text-gray-900">
                        Expense #{index + 1} - {expense.category.replace('_', ' ').toUpperCase()}
                      </h4>
                    </div>
                    <div className="text-sm text-gray-600 ml-6">
                      <p>
                        <strong>Amount:</strong> ₹{expense.amount}
                        {selectedMatter?.currency && selectedMatter.currency !== 'INR' && (
                          <span className="text-xs text-gray-500 ml-2">
                            (Expense in INR, will be shown in {selectedMatter.currency} on invoice)
                          </span>
                        )}
                      </p>
                      {expense.description && <p><strong>Description:</strong> {expense.description}</p>}
                      {expense.sub_category && <p><strong>Sub-category:</strong> {expense.sub_category}</p>}
                      {expense.receiptFile && (
                        <p className="text-green-600">
                          <strong>Receipt:</strong> {expense.receiptFile.name} (will be uploaded)
                        </p>
                      )}
                      {expense.receipt_url && !expense.receiptFile && (
                        <p>
                          <strong>Receipt:</strong>{' '}
                          <a 
                            href={expense.receipt_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            View
                          </a>
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveSavedExpense(expense.id!)}
                    className="text-red-600 hover:text-red-800 hover:bg-red-100"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            ))}

            {/* Current Expense Form (if being added) */}
            {showExpenseForm && currentExpense && (
              <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-900">
                    New Expense
                  </h4>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>
                      Category <span className="text-red-500 -ml-1.5">*</span>
                    </Label>
                    <Select
                      value={currentExpense.category}
                      onValueChange={(value) => handleCurrentExpenseChange('category', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="legal_services">Legal Services</SelectItem>
                        <SelectItem value="office_supplies">Office Supplies</SelectItem>
                        <SelectItem value="equipment">Equipment</SelectItem>
                        <SelectItem value="travel">Travel</SelectItem>
                        <SelectItem value="consulting">Consulting</SelectItem>
                        <SelectItem value="misc">Miscellaneous</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Sub Category</Label>
                    <Input
                      value={currentExpense.sub_category}
                      onChange={(e) => handleCurrentExpenseChange('sub_category', e.target.value)}
                      placeholder="e.g., court fees"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Expense Description</Label>
                  <Input
                    value={currentExpense.description}
                    onChange={(e) => handleCurrentExpenseChange('description', e.target.value)}
                    placeholder="Auto-generated if left empty"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Vendor</Label>

                    <Popover open={vendorComboboxOpen} onOpenChange={setVendorComboboxOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={vendorComboboxOpen}
                          className="w-full justify-between bg-transparent"
                        >
                          {currentExpense.vendor_id
                            ? vendors.find(v => v.vendor_id.toString() === currentExpense.vendor_id)?.vendor_name
                            : "Select vendor (optional)"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>

                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Search vendor..." />
                          <CommandList>
                            <CommandEmpty>No vendor found.</CommandEmpty>

                            <CommandGroup>
                              {vendors.map((vendor) => (
                                <CommandItem
                                  key={vendor.vendor_id}
                                  value={vendor.vendor_name}
                                  onSelect={() => {
                                    handleCurrentExpenseChange(
                                      'vendor_id',
                                      vendor.vendor_id.toString()
                                    );
                                    setVendorComboboxOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      currentExpense.vendor_id === vendor.vendor_id.toString()
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  {vendor.vendor_name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>


                  <div className="grid gap-2">
                    <Label>
                      Amount (₹) <span className="text-red-500 -ml-1.5">*</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={currentExpense.amount}
                      onChange={(e) => handleCurrentExpenseChange('amount', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={currentExpense.due_date}
                    onChange={(e) => handleCurrentExpenseChange('due_date', e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="receipt">Receipt Upload</Label>
                  
                  {/* Show existing receipt URL if available */}
                  {currentExpense.receipt_url && !currentExpense.receiptFile && (
                    <div className="mb-2 p-2 bg-gray-50 rounded border border-gray-200">
                      <p className="text-xs text-gray-600">Current receipt:</p>
                      <a 
                        href={currentExpense.receipt_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline break-all"
                      >
                        View Receipt
                      </a>
                    </div>
                  )}

                  {/* File input */}
                  <Input
                    id="receipt"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleReceiptFileSelect}
                  />
                  
                  <p className="text-xs text-gray-500">
                    Supported formats: JPG, PNG, GIF, WebP, PDF (max 5MB)
                  </p>

                  {/* Preview for images */}
                  {currentExpense.receiptPreview && (
                    <div className="mt-2">
                      <Image 
                        src={currentExpense.receiptPreview} 
                        alt="Receipt preview" 
                        width={200} 
                        height={200}
                        className="rounded border border-gray-200 object-contain"
                      />
                    </div>
                  )}

                  {/* Show selected file name */}
                  {currentExpense.receiptFile && (
                    <p className="text-sm text-green-600 flex items-center gap-2">
                      <Upload size={14} />
                      Selected: {currentExpense.receiptFile.name}
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label>Expense Notes</Label>
                  <Textarea
                    value={currentExpense.notes}
                    onChange={(e) => handleCurrentExpenseChange('notes', e.target.value)}
                    placeholder="Additional notes..."
                    rows={2}
                  />
                </div>

                {/* Save/Cancel Buttons for Current Expense */}
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveCurrentExpense}
                    className="flex items-center gap-2"
                  >
                    <Check size={16} />
                    Save Expense
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCancelCurrentExpense}
                    className="flex items-center gap-2"
                  >
                    <X size={16} />
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Add Expense Button (only show when not editing an expense) */}
            {!showExpenseForm && (
              <Button
                type="button"
                variant="outline"
                onClick={handleAddExpenseClick}
                className="w-full flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                Add Expense
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading || uploadingReceipt}
          >
            Cancel
          </Button>
          <Button 
            type="button" 
            onClick={handleSubmit} 
            disabled={isLoading || uploadingReceipt || (showExpenseForm && currentExpense !== null)}
          >
            {uploadingReceipt 
              ? 'Uploading receipts...' 
              : isLoading 
                ? 'Saving...' 
                : mode === 'create' 
                  ? 'Add Time Entry' 
                  : 'Update Entry'}
          </Button>
        </DialogFooter>
        </>
      )}
      </DialogContent>
    </Dialog>
  );
}