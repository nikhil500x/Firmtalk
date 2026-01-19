'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, Eye, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { API_ENDPOINTS } from '@/lib/api';
import Pagination, { usePagination } from '@/components/Pagination';
import { formatRoleDisplay } from '@/utils/roleDisplay';
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from '@/components/ui/hover-card';
import { formatAmountWithCurrency, type CurrencyCode } from '@/lib/currencyUtils';
import CurrencyBadge from '@/components/ui/currency-badge';
import { formatCurrencyWithConversion } from '@/lib/currencyUtils';
import { convertCurrency } from '@/lib/currencyUtils';

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
  _displayTotal: string;
  _convertedTotal?: number;
  _convertedExpenses?: number;
  id: number;
  userId: number;
  matterId: number;
  date: string;
  hoursWorked: number;
  billableHours: number;
  nonBillableHours: number;
  totalHours: number;
  activityType: string;
  description: string;
  hourlyRate: number | null;
  calculatedAmount: number | null;
  calculatedAmountCurrency?: string;
  expenses: Expense[];
  notes: string | null;
  lastUpdate: Date | null;
  approvedBy: number | null;
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
    currency?: string; // ✅ Added currency field
    client: {
      id: number;
      name: string;
    };
  };
  approver: {
    id: number;
    name: string;
  } | null;
}

interface MatterTimesheetsProps {
  matterId: number;
}

// Helper to convert time string (HH:MM) to minutes
const timeStringToMinutes = (timeString: string | number): number => {
  if (typeof timeString === 'number') return timeString;
  if (!timeString) return 0;
  const [hours, minutes] = timeString.split(':').map(Number);
  return (hours * 60) + minutes;
};

// Helper to convert minutes to time string (HH:MM)
const minutesToTimeString = (minutes: number): string => {
  if (!minutes) return '00:00';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

export default function MatterTimesheets({ matterId }: MatterTimesheetsProps) {
  const router = useRouter();

  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: 'user.name' | 'hoursWorked' | 'calculatedAmount' | 'date' | null;
    direction: 'asc' | 'desc' | null;
  }>({ key: null, direction: null });
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode | null>(null);
  const effectiveCurrency: CurrencyCode = selectedCurrency ?? 'INR';

  const {
    currentPage,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    getPaginatedData,
  } = usePagination(10);

  const fetchMatterTimesheets = useCallback(async () => {
    if (!matterId) {
      setError('Matter ID is required');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `${API_ENDPOINTS.timesheets.list}?matterId=${matterId}`,
        {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch timesheets');
      }

      const data = await response.json();

      console.log('Fetched timesheets data:', data.data);

      if (data.success) {
        const backendCurrency =
          (data.data[0]?.calculatedAmountCurrency ||
          data.data[0]?.matter?.currency ||
          'INR') as CurrencyCode;

        setSelectedCurrency(backendCurrency);
        setTimesheets(
          await Promise.all(
            data.data.map(async (ts: Timesheet) => {
              const timeSourceCurrency =
                (ts.calculatedAmountCurrency ||
                  ts.matter.currency ||
                  'INR') as CurrencyCode;

              const expenseSourceCurrency: CurrencyCode = 'INR';

              const timeAmount = ts.calculatedAmount || 0;
              const expenseAmount = getAcceptedExpenseAmount(ts);

              // ✅ Convert time amount safely
              let convertedTimeAmount = timeAmount;
              if (
                timeAmount > 0 &&
                selectedCurrency && timeSourceCurrency !== selectedCurrency
              ) {
                convertedTimeAmount = await convertCurrency(
                  timeAmount,
                  timeSourceCurrency,
                  effectiveCurrency
                );
              }

              // let convertedExpenseAmount = expenseAmount;
              // if (
              //   expenseAmount > 0 &&
              //   selectedCurrency && expenseSourceCurrency !== selectedCurrency
              // ) {
              //   convertedExpenseAmount = await convertCurrency(
              //     expenseAmount,
              //     expenseSourceCurrency,
              //     selectedCurrency
              //   );
              // }

              const convertedTotal = convertedTimeAmount; 

              return {
                ...ts,
                _convertedTotal: convertedTotal,
                _displayTotal: formatAmountWithCurrency(
                  convertedTotal,
                  effectiveCurrency
                ),
              };
            })
          )
        );


      } else {
        setError(data.message || 'Failed to load timesheets');
      }
    } catch (err) {
      console.error('Fetch timesheets error:', err);
      setError('Failed to load timesheets. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [matterId, router, selectedCurrency]);

  useEffect(() => {
    fetchMatterTimesheets();
  }, [fetchMatterTimesheets]);

  const filteredTimesheets = useMemo(() => {
    return timesheets.filter((timesheet) => {
      const matchesSearch =
        timesheet.user.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase().trim()) ||
        timesheet.activityType
          .toLowerCase()
          .includes(searchQuery.toLowerCase().trim()) ||
        (timesheet.description || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase().trim());

      

      return matchesSearch;
    });
  }, [timesheets, searchQuery]);

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

  // ✅ Get timesheet currency (from calculatedAmountCurrency or matter currency, fallback to INR)
  const getTimesheetCurrency = (timesheet: Timesheet): CurrencyCode => {
    return (timesheet.calculatedAmountCurrency || timesheet.matter?.currency || 'INR') as CurrencyCode;
  };

  // ✅ DEPRECATED: Do not use this function - it incorrectly mixes currencies
  // Use getTimesheetAmount() and getExpenseAmount() separately instead
  const calculateTotalAmount = (timesheet: Timesheet): number => {
    // ⚠️ WARNING: This function incorrectly mixes currencies (USD + INR)
    // Only kept for backward compatibility in sorting/comparison
    // Display should show timesheet and expense amounts separately
    const timesheetAmount = getTimesheetAmount(timesheet);
    const expenseAmount = getExpenseAmount(timesheet);
    const timesheetCurrency = getTimesheetCurrency(timesheet);
    
    // If same currency, can add (but expenses are always INR)
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
      if (sortConfig.key === 'user.name') {
        const aValue = a.user.name.toLowerCase();
        const bValue = b.user.name.toLowerCase();
        if (aValue < bValue) return -1;
        if (aValue > bValue) return 1;
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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleViewDetails = (timesheetId: number) => {
    router.push(`/timesheet/timesheets/${timesheetId}`);
  };

  const handleSort = (
    key: 'user.name' | 'hoursWorked' | 'calculatedAmount' | 'date'
  ) => {
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

    return sortConfig.direction === 'asc' ? 'Sorted: A to Z' : 'Sorted: Z to A';
  };

  // const formatCurrency = (amount: number) => {
  //   return new Intl.NumberFormat('en-IN', {
  //     style: 'currency',
  //     currency: 'INR',
  //     maximumFractionDigits: 2,
  //   }).format(amount);
  // };

  const getAcceptedExpenseAmount = (timesheet: Timesheet): number => {
    if (!timesheet.expenses || timesheet.expenses.length === 0) return 0;
    return timesheet.expenses.reduce((sum, expense) => {
      return expense.expenseIncluded ? sum + expense.amount : sum;
    }, 0);
  };

  const getRejectedExpenseAmount = (timesheet: Timesheet): number => {
    if (!timesheet.expenses || timesheet.expenses.length === 0) return 0;
    return timesheet.expenses.reduce((sum, expense) => {
      return !expense.expenseIncluded ? sum + expense.amount : sum;
    }, 0);
  };

  const getAcceptedExpenseCount = (timesheet: Timesheet): number => {
    if (!timesheet.expenses || timesheet.expenses.length === 0) return 0;
    return timesheet.expenses.filter((expense) => expense.expenseIncluded)
      .length;
  };

  const getRejectedExpenseCount = (timesheet: Timesheet): number => {
    if (!timesheet.expenses || timesheet.expenses.length === 0) return 0;
    return timesheet.expenses.filter((expense) => !expense.expenseIncluded)
      .length;
  };

  const statistics = useMemo(() => {
    const totalMinutes = timesheets.reduce(
      (sum, ts) => sum + timeStringToMinutes(ts.hoursWorked),
      0
    );

    const totalBillableMinutes = timesheets.reduce(
      (sum, ts) => sum + timeStringToMinutes(ts.billableHours),
      0
    );

    // ✅ Calculate totals by currency to avoid mixing
    const totalTimesheetAmount = timesheets.reduce(
      (sum, ts) => sum + getTimesheetAmount(ts),
      0
    );

    const totalExpenseAmount = timesheets.reduce(
      (sum, ts) => sum + getExpenseAmount(ts),
      0
    );

    // ✅ Group timesheet amounts by currency
    const amountsByCurrency: Record<string, number> = {};
    timesheets.forEach(ts => {
      const currency = getTimesheetCurrency(ts);
      if (!amountsByCurrency[currency]) {
        amountsByCurrency[currency] = 0;
      }
      amountsByCurrency[currency] += getTimesheetAmount(ts);
    });

    // const approvedCount = timesheets.filter(
    //   (ts) => ts.status === 'approved'
    // ).length;

    // const pendingCount = timesheets.filter(
    //   (ts) => ts.status === 'pending'
    // ).length;


    return {
      totalHours: minutesToTimeString(totalMinutes),  // Return as time string
      totalBillableHours: minutesToTimeString(totalBillableMinutes),  // Return as time string
      totalHoursDecimal: totalMinutes / 60,  // Also provide decimal hours if needed
      totalBillableHoursDecimal: totalBillableMinutes / 60,  // Also provide decimal hours if needed
      totalAmount: totalTimesheetAmount, // ✅ Only timesheet amounts (expenses shown separately)
      totalTimesheetAmount, // ✅ Timesheet amounts only
      totalExpenseAmount, // ✅ Expense amounts (always INR)
      amountsByCurrency, // ✅ Breakdown by currency
      // approvedCount,
      // pendingCount,
      totalCount: timesheets.length,
    };
  }, [timesheets]);

  return (
    <div className="w-full bg-white rounded-lg border border-gray-200">
      {/* Statistics Cards */}
      <div className="p-6 border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-lg p-4 border border-blue-200">
            <p className="text-sm font-medium text-blue-600 mb-1">
              Total Timesheets
            </p>
            <p className="text-2xl font-bold text-blue-900">
              {statistics.totalCount}
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-lg p-4 border border-green-200">
            <p className="text-sm font-medium text-green-600 mb-1">
              Total Hours
            </p>
            <p className="text-2xl font-bold text-green-900">
              {statistics.totalHours}
            </p>
            <p className="text-xs text-green-600 mt-1">
              {statistics.totalBillableHours} billable
            </p>
          </div>

          {/* ✅ Show totals by currency to avoid mixing */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-lg p-4 border border-purple-200">
            <p className="text-sm font-medium text-purple-600 mb-2">
              Total Amount
            </p>
            <div className="space-y-1">
              {/* Show totals by currency */}
              {Object.entries(statistics.amountsByCurrency).map(([currency, amount]) => (
                <div key={currency} className="flex items-center justify-between">
                  <span className="text-xs text-purple-700 flex items-center gap-1">
                    {currency}:
                    <CurrencyBadge currency={currency as CurrencyCode} />
                  </span>
                  <span className="text-lg font-bold text-purple-900">
                    {formatAmountWithCurrency(amount, currency as CurrencyCode)}
                  </span>
                </div>
              ))}
              {/* Show expenses separately if any */}
              {statistics.totalExpenseAmount > 0 && (
                <div className="flex items-center justify-between border-t border-purple-200 pt-1 mt-1">
                  <span className="text-xs text-green-700 flex items-center gap-1">
                    Expenses (INR):
                    <CurrencyBadge currency="INR" />
                  </span>
                  <span className="text-lg font-bold text-green-700">
                    {formatAmountWithCurrency(statistics.totalExpenseAmount, 'INR')}
                  </span>
                </div>
              )}
              {/* Warning if multiple currencies or mixed currencies */}
              {(Object.keys(statistics.amountsByCurrency).length > 1 || 
                (Object.keys(statistics.amountsByCurrency).some(c => c !== 'INR') && statistics.totalExpenseAmount > 0)) && (
                <div className="text-xs text-orange-600 mt-2 pt-2 border-t border-orange-200">
                  ⚠️ Amounts in different currencies shown separately
                </div>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-lg p-4 border border-amber-200">
            <p className="text-sm font-medium text-amber-600 mb-1">
              Avg Hours/Entry
            </p>
            <p className="text-2xl font-bold text-amber-900">
              {statistics.totalCount > 0
                ? (() => {
                  const totalMinutes = statistics.totalHoursDecimal * 60;
                  const avgMinutes = Math.round(totalMinutes / statistics.totalCount);
                  return minutesToTimeString(avgMinutes);
                })()
                : '00:00'}
            </p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="px-6 py-4 flex items-center gap-4 border-b border-gray-200">
        {/* Search Input */}
        <div className="flex-1 max-w-md relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search by lawyer name or activity type..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 bg-white border border-gray-300 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
          />
        </div>
      </div>

      {/* Timesheets Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* Table Header */}
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                className="px-6 py-3 text-left text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none"
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
                className="px-6 py-3 text-left text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none"
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
                className="px-6 py-3 text-left text-sm font-medium text-gray-600"
                scope="col"
              >
                Activity Type
              </th>
              <th
                className="px-6 py-3 text-center text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none"
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
                className="px-6 py-3 text-center text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none"
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
                className="px-6 py-3 text-center text-sm font-medium text-gray-600"
                scope="col"
              >
                Actions
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="text-base font-medium">
                      Loading timesheets...
                    </p>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-red-500">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-base font-medium">
                      Error loading timesheets
                    </p>
                    <p className="text-sm">{error}</p>
                    <button
                      onClick={fetchMatterTimesheets}
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
                  colSpan={6}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-base font-medium">
                      No timesheets found
                    </p>
                    <p className="text-sm">
                      {timesheets.length === 0
                        ? 'No timesheets have been recorded for this matter yet.'
                        : 'Try adjusting your search or filters'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedTimesheets.map((timesheet) => (
                <tr
                  key={timesheet.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatDate(timesheet.date)}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {timesheet.user.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatRoleDisplay(timesheet.user.role)}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {timesheet.activityType}
                    </div>
                    {timesheet.description && (
                      <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                        {timesheet.description}
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="text-sm text-gray-900">
                      {minutesToTimeString(timesheet.hoursWorked)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {timesheet.billableHours}b /{' '}
                      {timesheet.nonBillableHours}nb
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <div className="cursor-pointer">
                          {/* ✅ Show timesheet amount and expense amount separately */}
                          <div className="space-y-1">
                            {/* Timesheet Amount */}
                            <div className="text-sm font-medium text-gray-900 flex items-center justify-center gap-1">
                              {timesheet.calculatedAmount && timesheet.calculatedAmountCurrency
                                ? formatAmountWithCurrency(getTimesheetAmount(timesheet), timesheet.calculatedAmountCurrency as CurrencyCode)
                                : formatAmountWithCurrency(getTimesheetAmount(timesheet), getTimesheetCurrency(timesheet))
                              }
                              {getTimesheetCurrency(timesheet) !== 'INR' && (
                                <CurrencyBadge currency={getTimesheetCurrency(timesheet)} />
                              )}
                            </div>
                            
                            {/* Expense Amount (if exists) */}
                            {timesheet.expenses && timesheet.expenses.length > 0 && getExpenseAmount(timesheet) > 0 && (
                              <div className="text-xs font-medium text-green-600 flex items-center justify-center gap-1">
                                + {formatAmountWithCurrency(getExpenseAmount(timesheet), 'INR')}
                                <CurrencyBadge currency="INR" />
                                <span className="text-gray-500">
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
                              <span className="text-gray-600 flex items-center gap-2">
                                Time-based charges:
                                {getTimesheetCurrency(timesheet) !== 'INR' && (
                                  <CurrencyBadge currency={getTimesheetCurrency(timesheet)} />
                                )}
                              </span>
                              <span className="font-medium text-gray-900">
                                {timesheet.calculatedAmount
                                  ? formatAmountWithCurrency(timesheet.calculatedAmount, getTimesheetCurrency(timesheet))
                                  : formatAmountWithCurrency(0, getTimesheetCurrency(timesheet))
                                }
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 pl-2">
                              {timesheet.billableHours || '00:00'}{' '}
                              hrs ×{' '}
                              {timesheet.hourlyRate
                                ? formatAmountWithCurrency(timesheet.hourlyRate, getTimesheetCurrency(timesheet))
                                : formatAmountWithCurrency(0, getTimesheetCurrency(timesheet))
                              }
                            </div>
                          </div>

                          {/* Accepted Expenses */}
                          {timesheet.expenses &&
                            timesheet.expenses.length > 0 && (
                              <>
                                <div className="border-t border-gray-200 pt-2">
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-green-600 flex items-center gap-2">
                                      Accepted expenses ({getAcceptedExpenseCount(timesheet)}):
                                      <CurrencyBadge currency="INR" />
                                    </span>
                                    <span className="font-medium text-green-600">
                                      {formatAmountWithCurrency(
                                        getAcceptedExpenseAmount(timesheet),
                                        'INR'
                                      )}
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-500 italic mt-1">
                                    Expenses are always recorded in INR
                                    {getTimesheetCurrency(timesheet) !== 'INR' && (
                                      <span className="block text-orange-600 font-medium mt-1">
                                        ⚠️ Cannot add {getTimesheetCurrency(timesheet)} and INR directly
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Rejected Expenses */}
                                {getRejectedExpenseCount(timesheet) > 0 && (
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-red-600 flex items-center gap-2">
                                      Rejected expenses ({getRejectedExpenseCount(timesheet)}):
                                      <CurrencyBadge currency="INR" />
                                    </span>
                                    <span className="font-medium text-red-600">
                                      {formatAmountWithCurrency(
                                        getRejectedExpenseAmount(timesheet),
                                        'INR'
                                      )}
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
                                  {getTimesheetCurrency(timesheet)}:
                                  <CurrencyBadge currency={getTimesheetCurrency(timesheet)} />
                                </span>
                                <span className="font-medium text-gray-900">
                                  {formatAmountWithCurrency(
                                    getTimesheetAmount(timesheet),
                                    getTimesheetCurrency(timesheet)
                                  )}
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
                                    {formatAmountWithCurrency(
                                      getExpenseAmount(timesheet),
                                      'INR'
                                    )}
                                  </span>
                                </div>
                              )}
                              {/* Warning if different currencies */}
                              {getTimesheetCurrency(timesheet) !== 'INR' && getExpenseAmount(timesheet) > 0 && (
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

                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => handleViewDetails(timesheet.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded font-medium transition-colors"
                      title="View timesheet details"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Component */}
      {!isLoading && !error && filteredTimesheets.length > 0 && (
        <div className="border-t border-gray-200">
          <Pagination
            currentPage={currentPage}
            totalItems={sortedTimesheets.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
            showItemsPerPage={true}
            itemsPerPageOptions={[5, 10, 25, 50]}
            maxVisiblePages={5}
          />
        </div>
      )}
    </div>
  );
}