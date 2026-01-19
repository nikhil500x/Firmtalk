"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Search, Pencil, Eye, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { API_ENDPOINTS } from "@/lib/api";
import Pagination, { usePagination } from "@/components//Pagination";
import { formatRoleDisplay } from "@/utils/roleDisplay";
import CurrencyBadge from '@/components/ui/currency-badge';
import { convertCurrency, formatAmountWithCurrency, type CurrencyCode } from '@/lib/currencyUtils';
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import TimesheetDialog from '@/components/timesheet/TimesheetDialog';
import { useRef } from "react"; //to handle row clicks
import { toast } from "react-toastify";

/**
 * Expense Interface
 */
interface Expense {
  id: number;
  category: string;
  subCategory: string | null;
  description: string;
  amount: number;
  vendor: {
    id: number;
    name: string;
  } | null;
  dueDate: string | null;
  receiptUrl: string | null;
  notes: string | null;
  status: string;
  expenseIncluded: boolean;
}

/**
 * Timesheet Interface Definition
 */
interface Timesheet {
  id: number;
  userId: number;
  matterId: number;
  date: string;
  hoursWorked: number;
  billableHours: number;
  nonBillableHours: number;
  activityType: string;
  description: string;
  hourlyRate: number | null;
  hourlyRateCurrency?: string;
  hourlyRateConversionRate?: number;
  calculatedAmount: number | null;
  calculatedAmountCurrency?: string;
  expenses: Expense[];
  notes: string | null;
  lastUpdate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  matter: {
    id: number;
    title: string;
    currency?: string;
    client: {
      id: number;
      name: string;
    };
  } | null;
}

interface TimesheetsTableProps {
  refreshTrigger?: number;
}

// Helper functions for time conversion
const minutesToTimeString = (minutes: number): string => {
  if (!minutes) return '00:00';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

const timeStringToMinutes = (timeString: string): number => {
  if (!timeString) return 0;
  const [hours, minutes] = timeString.split(':').map(Number);
  return (hours * 60) + minutes;
};

export default function TimesheetsTable({
  refreshTrigger,
}: TimesheetsTableProps) {
  const router = useRouter();


  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("All Time");

  const [editingTimesheetId, setEditingTimesheetId] = useState<number | null>(null);
  const [editingHours, setEditingHours] = useState<{
    billableHours: string;
    nonBillableHours: string;
  } | null>(null);
  const [savingHours, setSavingHours] = useState(false);
  const [editingDateTimesheetId, setEditingDateTimesheetId] = useState<number | null>(null);
  const [editingDate, setEditingDate] = useState<string>('');
  const [savingDate, setSavingDate] = useState(false);

  const [editingActivityTimesheetId, setEditingActivityTimesheetId] = useState<number | null>(null);
  const [editingActivity, setEditingActivity] = useState<string>('');
  const [savingActivity, setSavingActivity] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTimesheetData, setEditingTimesheetData] = useState<number | null>(null);
  const [acceptedExpenseINR, setAcceptedExpenseINR] = useState<Record<number, number>>({});
  const [acceptedExpenseConverted, setAcceptedExpenseConverted] =
  useState<Record<number, number>>({});
  const [sortConfig, setSortConfig] = useState<{
    key: 'user.name' | 'matter.title' | 'matter.client.name' | 'hoursWorked' | 'calculatedAmount' | 'date' | null;
    direction: 'asc' | 'desc' | null;
  }>({ key: null, direction: null });

  // Define activity types
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

  // ============================================================================
  // USE PAGINATION HOOK
  // ============================================================================
  const {
    currentPage,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    getPaginatedData,
  } = usePagination(10);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchTimesheets = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(API_ENDPOINTS.timesheets.list, {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to fetch timesheets");
      }

      const data = await response.json();

      if (data.success) {
        // Data already includes expenses array from API
        setTimesheets(data.data);
       console.log(data.data);
      } else {
        setError(data.message || "Failed to load timesheets");
      }
    } catch (err) {
      console.error("Fetch timesheets error:", err);
      setError("Failed to load timesheets. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchTimesheets();
  }, [fetchTimesheets, refreshTrigger]);

// useEffect(() => {
//   const map: Record<number, number> = {};

//   for (const ts of timesheets) {
//     map[ts.id] = getAcceptedExpenseAmount(ts); // ALWAYS INR
//   }

//   setAcceptedExpenseINR(map);
// }, [timesheets]);

useEffect(() => {
  const convertExpenses = async () => {
    const map: Record<number, number> = {};

    for (const ts of timesheets) {
      try {
        const acceptedINR = getAcceptedExpenseAmount(ts);
        const rowCurrency =
          (ts.calculatedAmountCurrency ||
            ts.matter?.currency ||
            'INR') as CurrencyCode;

        if (rowCurrency === 'INR') {
          map[ts.id] = acceptedINR;
        } else if (acceptedINR > 0) {
          map[ts.id] = await convertCurrency(
            acceptedINR,
            'INR',
            rowCurrency
          );
        } else {
          map[ts.id] = 0;
        }
      } catch (err) {
        console.error(`Expense conversion failed for timesheet ${ts.id}`, err);
        map[ts.id] = 0;
      }
    }

    setAcceptedExpenseConverted(map);
  };

  if (timesheets.length) convertExpenses();
}, [timesheets]);




  // ============================================================================
  // FILTERING
  // ============================================================================

  const filteredTimesheets = useMemo(() => {
    return timesheets.filter((timesheet) => {
      const matchesSearch =
        timesheet.user.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase().trim()) ||
        timesheet.matter?.client.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase().trim()) ||
        timesheet.matter?.title
          .toLowerCase()
          .includes(searchQuery.toLowerCase().trim()) ||
        timesheet.activityType
          .toLowerCase()
          .includes(searchQuery.toLowerCase().trim());

      // Date filtering logic
      let matchesDate = true;
      if (dateFilter !== 'All Time') {
        const timesheetDate = new Date(timesheet.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (dateFilter === 'Today') {
          const timesheetDateOnly = new Date(timesheetDate);
          timesheetDateOnly.setHours(0, 0, 0, 0);
          matchesDate = timesheetDateOnly.getTime() === today.getTime();
        } else if (dateFilter === 'This Week') {
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - today.getDay());
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);
          matchesDate = timesheetDate >= weekStart && timesheetDate <= weekEnd;
        } else if (dateFilter === 'Last Week') {
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - today.getDay() - 7);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);
          matchesDate = timesheetDate >= weekStart && timesheetDate <= weekEnd;
        } else if (dateFilter === 'This Month') {
          matchesDate =
            timesheetDate.getMonth() === today.getMonth() &&
            timesheetDate.getFullYear() === today.getFullYear();
        } else if (dateFilter === 'Last Month') {
          const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1);
          matchesDate =
            timesheetDate.getMonth() === lastMonth.getMonth() &&
            timesheetDate.getFullYear() === lastMonth.getFullYear();
        }
      }

      return matchesSearch && matchesDate;
    });
  }, [timesheets, searchQuery, dateFilter]);

  // ✅ Get timesheet amount only (no expenses - different currencies)
  const getTimesheetAmount = (timesheet: Timesheet): number => {
    return timesheet.calculatedAmount || 0;
  };

  // ✅ Get expense amount only (always in INR)
  const getExpenseAmount = (timesheet: Timesheet): number => {
    if (!timesheet.expenses || timesheet.expenses.length === 0) return 0;
    return timesheet.expenses.reduce((sum, expense) => {
      return expense.expenseIncluded ? sum + expense.amount : sum;
    }, 0);
  };

  // ✅ DEPRECATED: Do not use this function - it incorrectly mixes currencies
  // Use getTimesheetAmount() and getExpenseAmount() separately instead
  const calculateTotalAmount = (timesheet: Timesheet): number => {
    // ⚠️ WARNING: This function incorrectly mixes currencies (USD + INR)
    // Only kept for backward compatibility in sorting/comparison
    // Display should show timesheet and expense amounts separately
    const timesheetAmount = getTimesheetAmount(timesheet);
    const expenseAmount = getExpenseAmount(timesheet);
    
    // If same currency, can add (but expenses are always INR)
    const timesheetCurrency = timesheet.calculatedAmountCurrency || timesheet.matter?.currency || 'INR';
    if (timesheetCurrency === 'INR') {
      return timesheetAmount + expenseAmount;
    }
    
    // Different currencies - cannot add directly
    // Return timesheet amount only (expenses shown separately)
    return timesheetAmount;
  };

  const sortedTimesheets = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return filteredTimesheets;
    }

    const sorted = [...filteredTimesheets].sort((a, b) => {
      // Get values based on sort key
      if (sortConfig.key === 'user.name') {
        const aValue = a.user.name;
        const bValue = b.user.name;
        const aStr = aValue.toLowerCase();
        const bStr = bValue.toLowerCase();
        if (aStr < bStr) return -1;
        if (aStr > bStr) return 1;
        return 0;
      } else if (sortConfig.key === 'matter.title') {
        const aValue = a.matter?.title || '';
        const bValue = b.matter?.title || '';
        const aStr = aValue.toLowerCase();
        const bStr = bValue.toLowerCase();
        if (aStr < bStr) return -1;
        if (aStr > bStr) return 1;
        return 0;
      } else if (sortConfig.key === 'matter.client.name') {
        const aValue = a.matter?.client.name || '';
        const bValue = b.matter?.client.name || '';
        const aStr = aValue.toLowerCase();
        const bStr = bValue.toLowerCase();
        if (aStr < bStr) return -1;
        if (aStr > bStr) return 1;
        return 0;
      } else if (sortConfig.key === 'hoursWorked') {
        return a.hoursWorked - b.hoursWorked;
      } else if (sortConfig.key === 'calculatedAmount') {
        // ✅ Sort by timesheet amount only (expenses shown separately)
        // This prevents incorrect sorting due to currency mixing
        const aValue = getTimesheetAmount(a);
        const bValue = getTimesheetAmount(b);
        return aValue - bValue;
      } else if (sortConfig.key === 'date') {
        const aValue = new Date(a.date);
        const bValue = new Date(b.date);
        return aValue.getTime() - bValue.getTime();
      }

      return 0;
    });

    return sortConfig.direction === 'desc' ? sorted.reverse() : sorted;
  }, [filteredTimesheets, sortConfig]);

  const paginatedTimesheets = useMemo(
    () => getPaginatedData(sortedTimesheets),
    [sortedTimesheets, getPaginatedData]
  );

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };
  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleDateFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDateFilter(e.target.value);
  };

  const clickTimer = useRef<NodeJS.Timeout | null>(null);

  const handleViewDetails = (timesheetId: number) => {
    clickTimer.current = setTimeout(() => {
      router.push(`/timesheet/timesheets/${timesheetId}`);
    }, 200);
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };



  const getAcceptedExpenseAmount = (timesheet: Timesheet): number => {
    if (!timesheet.expenses || timesheet.expenses.length === 0) return 0;
    return timesheet.expenses.reduce((sum, expense) => {
      return expense.expenseIncluded ? sum + expense.amount : sum;
    }, 0);
  };

const getAcceptedExpenseAmountInRowCurrency = async (
  timesheet: Timesheet,
  rowCurrency: CurrencyCode
): Promise<number> => {
  const amountInINR = getAcceptedExpenseAmount(timesheet);

  if (rowCurrency === 'INR') return amountInINR;

  return await convertCurrency(amountInINR, 'INR', rowCurrency);
};





  const getRejectedExpenseAmount = (timesheet: Timesheet): number => {
    if (!timesheet.expenses || timesheet.expenses.length === 0) return 0;
    return timesheet.expenses.reduce((sum, expense) => {
      return !expense.expenseIncluded ? sum + expense.amount : sum;
    }, 0);
  };

  const getAcceptedExpenseCount = (timesheet: Timesheet): number => {
    if (!timesheet.expenses || timesheet.expenses.length === 0) return 0;
    return timesheet.expenses.filter(expense => expense.expenseIncluded).length;
  };

  const getRejectedExpenseCount = (timesheet: Timesheet): number => {
    if (!timesheet.expenses || timesheet.expenses.length === 0) return 0;
    return timesheet.expenses.filter(expense => !expense.expenseIncluded).length;
  };

  const handleSort = (key: 'user.name' | 'matter.title' | 'matter.client.name' | 'hoursWorked' | 'calculatedAmount' | 'date') => {
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

    if (key === 'date') {
      return sortConfig.direction === 'asc'
        ? 'Sorted: Earliest to Latest'
        : 'Sorted: Latest to Earliest';
    }

    if (key === 'hoursWorked' || key === 'calculatedAmount') {
      return sortConfig.direction === 'asc'
        ? 'Sorted: Least to Most'
        : 'Sorted: Most to Least';
    }

    return sortConfig.direction === 'asc'
      ? 'Sorted: A to Z'
      : 'Sorted: Z to A';
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  const handleDoubleClickHours = (timesheet: Timesheet) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
    }
    setEditingTimesheetId(timesheet.id);
    setEditingHours({
      billableHours: minutesToTimeString(timesheet.billableHours),
      nonBillableHours: minutesToTimeString(timesheet.nonBillableHours),
    });
  };

  const handleHoursChange = (field: 'billableHours' | 'nonBillableHours', value: string) => {
    if (!editingHours) return;

    setEditingHours({
      ...editingHours,
      [field]: value,
    });
  };

  const handleSaveHours = async (timesheetId: number) => {
    if (!editingHours) return;

    // Convert time strings to minutes for validation and storage
    const billableMinutes = timeStringToMinutes(editingHours.billableHours);
    const nonBillableMinutes = timeStringToMinutes(editingHours.nonBillableHours);
    const totalMinutes = billableMinutes + nonBillableMinutes;

    // Validation
    if (totalMinutes === 0) {
      // alert('Total hours cannot be zero');
      toast.error('Total hours cannot be zero');
      return;
    }

    setSavingHours(true);
    try {
      const response = await fetch(API_ENDPOINTS.timesheets.update(timesheetId), {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          billableHours: billableMinutes,  // Send as minutes
          nonBillableHours: nonBillableMinutes,  // Send as minutes
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to update hours');
      }

      // Update local state
      setTimesheets(prevTimesheets =>
        prevTimesheets.map(ts =>
          ts.id === timesheetId
            ? {
              ...ts,
              billableHours: billableMinutes,
              nonBillableHours: nonBillableMinutes,
              hoursWorked: totalMinutes,
            }
            : ts
        )
      );

      // Clear editing state
      setEditingTimesheetId(null);
      setEditingHours(null);

      // alert('Hours updated successfully!');
      toast.success('Hours updated successfully!');
    } catch (err) {
      console.error('Error updating hours:', err);
      // alert(err instanceof Error ? err.message : 'Failed to update hours');
      toast.error(err instanceof Error ? err.message : 'Failed to update hours');
    } finally {
      setSavingHours(false);
    }
  };

  const handleDiscardHours = () => {
    setEditingTimesheetId(null);
    setEditingHours(null);
  };

  const handleDoubleClickDate = (timesheet: Timesheet) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
    }
    setEditingDateTimesheetId(timesheet.id);
    setEditingDate(timesheet.date);
  };

  const handleSaveDate = async (timesheetId: number) => {
    if (!editingDate) {
      // alert('Please select a date');
      toast.error('Please select a date');
      return;
    }

    setSavingDate(true);
    try {
      const response = await fetch(API_ENDPOINTS.timesheets.update(timesheetId), {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: editingDate,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to update date');
      }

      // Update local state
      setTimesheets(prevTimesheets =>
        prevTimesheets.map(ts =>
          ts.id === timesheetId
            ? { ...ts, date: editingDate }
            : ts
        )
      );

      // Clear editing state
      setEditingDateTimesheetId(null);
      setEditingDate('');

      // alert('Date updated successfully!');
      toast.success('Date updated successfully!');
    } catch (err) {
      console.error('Error updating date:', err);
      // alert(err instanceof Error ? err.message : 'Failed to update date');
      toast.error(err instanceof Error ? err.message : 'Failed to update date');
    } finally {
      setSavingDate(false);
    }
  };

  const handleDiscardDate = () => {
    setEditingDateTimesheetId(null);
    setEditingDate('');
  };

  const handleDoubleClickActivity = (timesheet: Timesheet) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
    }
    setEditingActivityTimesheetId(timesheet.id);
    setEditingActivity(timesheet.activityType);
  };

  const handleSaveActivity = async (timesheetId: number) => {
    if (!editingActivity) {
      // alert('Please select an activity type');
      toast.error('Please select an activity type');
      return;
    }

    setSavingActivity(true);
    try {
      const response = await fetch(API_ENDPOINTS.timesheets.update(timesheetId), {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activityType: editingActivity,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to update activity type');
      }

      // Update local state
      setTimesheets(prevTimesheets =>
        prevTimesheets.map(ts =>
          ts.id === timesheetId
            ? { ...ts, activityType: editingActivity }
            : ts
        )
      );

      // Clear editing state
      setEditingActivityTimesheetId(null);
      setEditingActivity('');

      // alert('Activity type updated successfully!');
      toast.success('Activity type updated successfully!');
    } catch (err) {
      console.error('Error updating activity type:', err);
      // alert(err instanceof Error ? err.message : 'Failed to update activity type');
      toast.error(err instanceof Error ? err.message : 'Failed to update activity type');
    } finally {
      setSavingActivity(false);
    }
  };

  const handleDiscardActivity = () => {
    setEditingActivityTimesheetId(null);
    setEditingActivity('');
  };

  const handleEditTimesheet = (timesheetId: number) => {
    setEditingTimesheetData(timesheetId);
    setEditDialogOpen(true);
  };

  const handleEditDialogSuccess = () => {
    setEditDialogOpen(false);
    setEditingTimesheetData(null);
    fetchTimesheets(); // Refresh the table
  };

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="max-w-[1920px] mx-auto">
        {/* FILTERS BAR */}
        <div className="px-6 py-4 flex items-center gap-4 bg-white border-b border-gray-200">
          {/* SEARCH INPUT */}
          <div className="flex-1 max-w-md relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search by Lawyer Name, Client Name, Matter , or Activity"
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 bg-white border border-gray-300 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
              suppressHydrationWarning
            />
          </div>

          {/* DATE FILTER */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="date-filter"
              className="text-sm font-medium text-gray-600"
            >
              Filter by Date
            </label>
            <div className="relative">
              <select
                id="date-filter"
                value={dateFilter}
                onChange={handleDateFilterChange}
                className="appearance-none w-36 px-3 py-2 text-sm text-gray-800 bg-white border border-gray-300 rounded-md cursor-pointer focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                suppressHydrationWarning
              >
                <option value="All Time">All Time</option>
                <option value="Today">Today</option>
                <option value="This Week">This Week</option>
                <option value="Last Week">Last Week</option>
                <option value="This Month">This Month</option>
                <option value="Last Month">Last Month</option>
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-xs">
                ▼
              </span>
            </div>
          </div>

          {/* ROLE FILTER */}
          {/* <div className="flex items-center gap-2">
          <label
            htmlFor="role-filter"
            className="text-sm font-medium text-gray-600"
          >
            Role:
          </label>
          <div className="relative">
            <select
              id="role-filter"
              value={roleFilter}
              onChange={handleRoleFilterChange}
              className="appearance-none w-32 px-3 py-2 text-sm text-gray-800 bg-white border border-gray-300 rounded-md cursor-pointer focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
              suppressHydrationWarning
            >
              <option value="All">All</option>
              <option value="Partner">Partner</option>
              <option value="Senior Associate">Senior Associate</option>
              <option value="Associate">Associate</option>
              <option value="Counsel">Counsel</option>
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-xs">
              ▼
            </span>
          </div> */}
          {/* </div> */}
        </div>

        {/* TIMESHEETS TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* TABLE HEADER */}
            <thead className="bg-white border-t border-b border-gray-200">
              <tr>
                <th
                  className="px-6 py-3 text-left text-base font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none"
                  scope="col"
                  onClick={() => handleSort('date')}
                  title={getSortLabel('date')}
                >
                  <div className="flex items-center gap-2">
                    Date
                    {getSortIcon('date')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-base font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none"
                  scope="col"
                  onClick={() => handleSort('user.name')}
                  title={getSortLabel('user.name')}
                >
                  <div className="flex items-center gap-2">
                    Lawyer
                    {getSortIcon('user.name')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-base font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none"
                  scope="col"
                  onClick={() => handleSort('matter.title')}
                  title={getSortLabel('matter.title')}
                >
                  <div className="flex items-center gap-2">
                    Matter / Client
                    {getSortIcon('matter.title')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-base font-medium text-gray-500"
                  scope="col"
                >
                  Activity Type
                </th>
                <th
                  className="px-6 py-3 text-center text-base font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none"
                  scope="col"
                  onClick={() => handleSort('hoursWorked')}
                  title={getSortLabel('hoursWorked')}
                >
                  <div className="flex items-center justify-center gap-2">
                    Hours
                    {getSortIcon('hoursWorked')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-center text-base font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none"
                  scope="col"
                  onClick={() => handleSort('calculatedAmount')}
                  title={getSortLabel('calculatedAmount')}
                >
                  <div className="flex items-center justify-center gap-2">
                    Amount
                    {getSortIcon('calculatedAmount')}
                  </div>
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
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                      <p className="text-lg font-medium">Loading timesheets...</p>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-red-500">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-lg font-medium">
                        Error loading timesheets
                      </p>
                      <p className="text-sm">{error}</p>
                      <button
                        onClick={fetchTimesheets}
                        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredTimesheets.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-lg font-medium">No timesheets found</p>
                      <p className="text-sm">
                        Try adjusting your search or filters
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedTimesheets.map((timesheet) => {
                  const rowCurrency: CurrencyCode =
                    (timesheet.calculatedAmountCurrency ||
                      timesheet.matter?.currency ||
                      'INR') as CurrencyCode;

                  return (
                  
                  <tr
                    key={timesheet.id}
                    // className="hover:bg-gray-50 transition-colors"
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleViewDetails(timesheet.id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}>
                      {editingDateTimesheetId === timesheet.id ? (
                        // EDITING MODE
                        <div className="space-y-2">
                          <input
                            type="date"
                            value={editingDate}
                            onChange={(e) => setEditingDate(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-200"
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSaveDate(timesheet.id)}
                              disabled={savingDate}
                              className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {savingDate ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={handleDiscardDate}
                              disabled={savingDate}
                              className="px-3 py-1 text-xs font-medium text-white bg-gray-600 hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Discard
                            </button>
                          </div>
                        </div>
                      ) : (
                        // VIEW MODE
                        <div
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            handleDoubleClickDate(timesheet);
                          }}
                          className="cursor-pointer hover:bg-blue-50 rounded px-2 py-1 transition-colors"
                          title="Double-click to edit"
                        >
                          <div className="text-base text-gray-900">
                            {formatDate(timesheet.date)}
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-base font-medium text-gray-900">
                        {timesheet.user.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatRoleDisplay(timesheet.user.role)}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-base font-medium text-gray-900">
                        {timesheet.matter?.title || 'No Matter'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {timesheet.matter?.client.name || 'N/A'}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}>
                      {editingActivityTimesheetId === timesheet.id ? (
                        // EDITING MODE
                        <div className="space-y-2">
                          <div className="relative">
                            <select
                              value={editingActivity}
                              onChange={(e) => setEditingActivity(e.target.value)}
                              className="w-full px-2 py-1.5 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-200 appearance-none bg-white pr-8"
                              autoFocus
                            >
                              <option value="">Select Activity</option>
                              {activityTypes.map((activity) => (
                                <option key={activity} value={activity}>
                                  {activity}
                                </option>
                              ))}
                            </select>
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-xs">
                              ▼
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSaveActivity(timesheet.id)}
                              disabled={savingActivity}
                              className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {savingActivity ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={handleDiscardActivity}
                              disabled={savingActivity}
                              className="px-3 py-1 text-xs font-medium text-white bg-gray-600 hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Discard
                            </button>
                          </div>
                        </div>
                      ) : (
                        // VIEW MODE
                        <div
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            handleDoubleClickActivity(timesheet);
                          }}
                          className="cursor-pointer hover:bg-blue-50 rounded px-2 py-1 transition-colors"
                          title="Double-click to edit"
                        >
                          <div className="text-base text-gray-900">
                            {timesheet.activityType}
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-center"
                      onClick={(e) => e.stopPropagation()}>
                      {editingTimesheetId === timesheet.id ? (
                        // EDITING MODE
                        <div className="space-y-2">
                          <div className="flex items-center justify-center gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs text-gray-500">Billable</label>
                              <input
                                type="time"
                                value={editingHours?.billableHours || '00:00'}
                                onChange={(e) => handleHoursChange('billableHours', e.target.value)}
                                className="w-24 px-2 py-1 text-sm text-center border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-200 appearance-none [&::-webkit-calendar-picker-indicator]:hidden"
                                autoFocus
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs text-gray-500">Non-Billable</label>
                              <input
                                type="time"
                                value={editingHours?.nonBillableHours || '00:00'}
                                onChange={(e) => handleHoursChange('nonBillableHours', e.target.value)}
                                className="w-24 px-2 py-1 text-sm text-center border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-200 appearance-none [&::-webkit-calendar-picker-indicator]:hidden"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleSaveHours(timesheet.id)}
                              disabled={savingHours}
                              className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {savingHours ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={handleDiscardHours}
                              disabled={savingHours}
                              className="px-3 py-1 text-xs font-medium text-white bg-gray-600 hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Discard
                            </button>
                          </div>
                          <div className="text-xs text-gray-500">
                            Total: {minutesToTimeString(
                              timeStringToMinutes(editingHours?.billableHours || '00:00') +
                              timeStringToMinutes(editingHours?.nonBillableHours || '00:00')
                            )}
                          </div>
                        </div>
                      ) : (
                        // VIEW MODE
                        <div
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            handleDoubleClickHours(timesheet);
                          }}
                          className="cursor-pointer hover:bg-blue-50 rounded px-2 py-1 transition-colors"
                          title="Double-click to edit"
                        >
                          <div className="text-base text-gray-900">
                            {minutesToTimeString(timesheet.hoursWorked)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {timesheet.billableHours} b / {timesheet.nonBillableHours} nb
                          </div>
                        </div>
                      )}
                    </td>


                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <div className="cursor-pointer">
                            {/* ✅ Show timesheet amount and expense amount separately */}
                            <div className="space-y-1">
                              {/* Timesheet Amount */}
                              <div className="text-base font-medium text-gray-900 flex items-center justify-center gap-2">
                                {timesheet.calculatedAmount && timesheet.calculatedAmountCurrency
                                  ? formatAmountWithCurrency(getTimesheetAmount(timesheet), timesheet.calculatedAmountCurrency as CurrencyCode)
                                  : formatCurrency(getTimesheetAmount(timesheet))
                                }
                                {timesheet.calculatedAmountCurrency && timesheet.calculatedAmountCurrency !== 'INR' && (
                                  <CurrencyBadge currency={timesheet.calculatedAmountCurrency as CurrencyCode} />
                                )}
                              </div>
                              
                              {/* Expense Amount (if exists) */}
                              {timesheet.expenses && timesheet.expenses.length > 0 && getExpenseAmount(timesheet) > 0 && (
                                <div className="text-sm font-medium text-green-600 flex items-center justify-center gap-2">
                                  + {formatAmountWithCurrency(getExpenseAmount(timesheet), 'INR')}
                                  <CurrencyBadge currency="INR" />
                                  <span className="text-xs text-gray-500">
                                    ({getAcceptedExpenseCount(timesheet)} exp)
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80">
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-gray-900">
                              Amount Breakdown
                            </h4>

                            {/* Time-based charges */}
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">
                                  Time-based charges:
                                  {timesheet.calculatedAmountCurrency && timesheet.calculatedAmountCurrency !== 'INR' && (
                                    <span className="ml-2">
                                      <CurrencyBadge currency={timesheet.calculatedAmountCurrency as CurrencyCode} />
                                    </span>
                                  )}
                                </span>
                                <span className="font-medium text-gray-900">
                                  {formatAmountWithCurrency(
                                    timesheet.calculatedAmount || 0,
                                    rowCurrency
                                  )}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 pl-2">
                                {formatAmountWithCurrency(
                                  timesheet.hourlyRate || 0,
                                  rowCurrency
                                )}
                              </div>
                            </div>

                            {/* Accepted Expenses */}
                            {timesheet.expenses && timesheet.expenses.length > 0 && (
                              <>
                                <div className="border-t border-gray-200 pt-2">
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-green-600">
                                      Accepted expenses ({getAcceptedExpenseCount(timesheet)}):
                                      <span className="ml-2">
                                        <CurrencyBadge currency="INR" />
                                      </span>
                                    </span>
                                    <span className="font-medium text-green-600">
                                      {formatAmountWithCurrency(getAcceptedExpenseAmount(timesheet), 'INR')}
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-500 italic mt-1">
                                    Expenses are always recorded in INR
                                    {timesheet.matter?.currency && timesheet.matter.currency !== 'INR' && (
                                      <span className="block text-orange-600 font-medium mt-1">
                                        ⚠️ Cannot add {timesheet.calculatedAmountCurrency} and INR directly
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Rejected Expenses */}
                                {getRejectedExpenseCount(timesheet) > 0 && (
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-red-600">
                                      Rejected expenses ({getRejectedExpenseCount(timesheet)}):
                                      <span className="ml-2">
                                        <CurrencyBadge currency="INR" />
                                      </span>
                                    </span>
                                    <span className="font-medium text-red-600">
                                      {formatAmountWithCurrency(getRejectedExpenseAmount(timesheet), 'INR')}
                                    </span>
                                  </div>
                                )}
                              </>
                            )}

                            {/* Total - Show separate currencies */}
                            <div className="border-t border-gray-200 pt-2">
                              <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-semibold text-gray-900">
                                    Totals by Currency:
                                  </span>
                                </div>
                                {/* Timesheet Total */}
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-gray-600 flex items-center gap-2">
                                    {timesheet.calculatedAmountCurrency || 'INR'}:
                                    {timesheet.calculatedAmountCurrency && (
                                      <CurrencyBadge currency={timesheet.calculatedAmountCurrency as CurrencyCode} />
                                    )}
                                  </span>
                                  <span className="font-medium text-gray-900">
                                    {timesheet.calculatedAmount && timesheet.calculatedAmountCurrency
                                      ? formatAmountWithCurrency(getTimesheetAmount(timesheet), timesheet.calculatedAmountCurrency as CurrencyCode)
                                      : formatAmountWithCurrency(getTimesheetAmount(timesheet), 'INR')
                                    }
                                  </span>
                                </div>
                                {/* Expense Total */}
                                {getExpenseAmount(timesheet) > 0 && (
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600 flex items-center gap-2">
                                      INR (Expenses):
                                      <CurrencyBadge currency="INR" />
                                    </span>
                                    <span className="font-medium text-green-600">
                                      {formatAmountWithCurrency(getExpenseAmount(timesheet), 'INR')}
                                    </span>
                                  </div>
                                )}
                                {/* Warning if different currencies */}
                                {timesheet.calculatedAmountCurrency && 
                                 timesheet.calculatedAmountCurrency !== 'INR' && 
                                 getExpenseAmount(timesheet) > 0 && (
                                  <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded mt-2">
                                    ⚠️ Amounts are in different currencies. Convert to same currency before adding.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-center"
                      onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleViewDetails(timesheet.id)}
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
                        >
                          <Eye className='w-4 h-4' />
                        </button>

                        <button
                          onClick={() => handleEditTimesheet(timesheet.id)}
                          className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded font-medium transition-colors"
                          title="Edit timesheet"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION COMPONENT */}
        {!isLoading && !error && filteredTimesheets.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={sortedTimesheets.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
            showItemsPerPage={true}
            itemsPerPageOptions={[10, 25, 50, 100]}
            maxVisiblePages={5}
          />
        )}
      </div>
      {/* Edit Timesheet Dialog */}
      {editDialogOpen && editingTimesheetData && (
        <TimesheetDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          mode="edit"
          timesheetId={editingTimesheetData}
          onSuccess={handleEditDialogSuccess}
        />
      )}
    </div>
  );
}

// function calculateTotalAmount(a: Timesheet) {
//   throw new Error("Function not implemented.");
// }
