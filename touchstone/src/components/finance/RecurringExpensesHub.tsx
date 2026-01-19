'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, Plus, ArrowUp, ArrowDown, ArrowUpDown, ChevronsUpDown, Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import SalaryDialog from './SalaryDialog';
import OfficeExpenseDialog from './OfficeExpenseDialog';
import SubscriptionDialog from './SubscriptionDialog';
import Pagination, { usePagination } from '@/components/Pagination';
import { formatRoleDisplay } from '@/utils/roleDisplay';
import { Badge } from '@/components/ui/badge';
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

interface RecurringExpense {
  expense_id: number;
  recurring_type: string;
  recurrence_type: string;
  amount: number;
  start_date: string;
  end_date: string | null;
  cycle_day: number;
  status: string;
  notes: string | null;
  // Salary fields
  user_id: number | null;
  gross_salary: number | null;
  deductions: number | null;
  net_salary: number | null;
  lawyer: {
    user_id: number;
    name: string;
    email: string;
    role: {
      name: string;
    };
  } | null;
  // Office expense fields
  sub_category: string | null;
  vendor: {
    vendor_id: number;
    vendor_name: string;
  } | null;
  // Subscription fields
  software_name: string | null;
  description: string | null;
  seats_licenses: number | null;
  _count: {
    payments: number;
  };
}

interface RecurringExpensesHubProps {
  refreshTrigger: number;
}

export default function RecurringExpensesHub({ refreshTrigger }: RecurringExpensesHubProps) {
  const router = useRouter();
  const [activeSubTab, setActiveSubTab] = useState<'salaries' | 'office' | 'subscriptions'>('salaries');
  const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [recurrenceFilter, setRecurrenceFilter] = useState('All');
  
  // Sorting state - different keys for each tab
  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: 'asc' | 'desc' | null;
  }>({ key: null, direction: null });

  // Dialog states
  const [isSalaryDialogOpen, setIsSalaryDialogOpen] = useState(false);
  const [isOfficeExpenseDialogOpen, setIsOfficeExpenseDialogOpen] = useState(false);
  const [isSubscriptionDialogOpen, setIsSubscriptionDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(null);

  // Pagination hook
  const {
    currentPage,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    resetToFirstPage,
    getPaginatedData,
  } = usePagination(10);

  // Status options for filter
  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'completed', label: 'Completed' }
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
    setRecurrenceFilter('All');
    setSearchQuery('');
  };

  // Count active filters
  const activeFilterCount = selectedStatuses.length;

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchExpenses = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const typeMap = {
        salaries: 'salary',
        office: 'office_expense',
        subscriptions: 'subscription',
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/expenses/recurring?type=${typeMap[activeSubTab]}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch expenses');
      }

      const data = await response.json();
      setExpenses(data.data || []);
    } catch (err) {
      console.error('Fetch expenses error:', err);
      setError('Failed to load expenses. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [activeSubTab]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses, refreshTrigger]);

  // Reset sorting when tab changes
  useEffect(() => {
    setSortConfig({ key: null, direction: null });
  }, [activeSubTab]);

  // ============================================================================
  // FILTERING
  // ============================================================================

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      let matchesSearch = false;

      if (activeSubTab === 'salaries') {
        matchesSearch = expense.lawyer?.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) || false;
      } else if (activeSubTab === 'office') {
        matchesSearch = 
          (expense.sub_category?.toLowerCase().includes(searchQuery.toLowerCase().trim()) || false) ||
          (expense.vendor?.vendor_name.toLowerCase().includes(searchQuery.toLowerCase().trim()) || false);
      } else if (activeSubTab === 'subscriptions') {
        matchesSearch = expense.software_name?.toLowerCase().includes(searchQuery.toLowerCase().trim()) || false;
      }

      // If no statuses selected, show all. Otherwise, match any selected status
      const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(expense.status);

      return (searchQuery === '' || matchesSearch) && matchesStatus;
    });
  }, [expenses, searchQuery, selectedStatuses, activeSubTab]);

  // ============================================================================
  // SORTING
  // ============================================================================
  const sortedExpenses = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return filteredExpenses;
    }

    const sorted = [...filteredExpenses].sort((a, b) => {
      // Salaries tab sorting
      if (activeSubTab === 'salaries') {
        if (sortConfig.key === 'lawyer_name') {
          const aName = a.lawyer?.name || '';
          const bName = b.lawyer?.name || '';
          return aName.localeCompare(bName);
        } else if (sortConfig.key === 'role') {
          const aRole = a.lawyer?.role.name || '';
          const bRole = b.lawyer?.role.name || '';
          return aRole.localeCompare(bRole);
        } else if (sortConfig.key === 'start_date') {
          const aDate = new Date(a.start_date);
          const bDate = new Date(b.start_date);
          return aDate.getTime() - bDate.getTime();
        } else if (sortConfig.key === 'net_salary') {
          const aSalary = a.net_salary || a.amount;
          const bSalary = b.net_salary || b.amount;
          return aSalary - bSalary;
        }
      }
      
      // Office expenses tab sorting
      if (activeSubTab === 'office') {
        if (sortConfig.key === 'category') {
          const aCat = a.sub_category || '';
          const bCat = b.sub_category || '';
          return aCat.localeCompare(bCat);
        } else if (sortConfig.key === 'vendor') {
          const aVendor = a.vendor?.vendor_name || '';
          const bVendor = b.vendor?.vendor_name || '';
          return aVendor.localeCompare(bVendor);
        } else if (sortConfig.key === 'amount') {
          return a.amount - b.amount;
        } else if (sortConfig.key === 'cycle_day') {
          return a.cycle_day - b.cycle_day;
        }
      }
      
      // Subscriptions tab sorting
      if (activeSubTab === 'subscriptions') {
        if (sortConfig.key === 'software_name') {
          const aName = a.software_name || '';
          const bName = b.software_name || '';
          return aName.localeCompare(bName);
        } else if (sortConfig.key === 'amount') {
          return a.amount - b.amount;
        } else if (sortConfig.key === 'seats_licenses') {
          const aSeats = a.seats_licenses || 0;
          const bSeats = b.seats_licenses || 0;
          return aSeats - bSeats;
        } else if (sortConfig.key === 'end_date') {
          // Handle null end dates - put them at the end
          if (!a.end_date && !b.end_date) return 0;
          if (!a.end_date) return 1;
          if (!b.end_date) return -1;
          const aDate = new Date(a.end_date);
          const bDate = new Date(b.end_date);
          return aDate.getTime() - bDate.getTime();
        } else if (sortConfig.key === 'cycle_day') {
          return a.cycle_day - b.cycle_day;
        }
      }
      
      return 0;
    });

    return sortConfig.direction === 'desc' ? sorted.reverse() : sorted;
  }, [filteredExpenses, sortConfig, activeSubTab]);

  const paginatedExpenses = useMemo(() => {
    return getPaginatedData(sortedExpenses);
  }, [sortedExpenses, currentPage, itemsPerPage, getPaginatedData]);

  // Reset to first page when filters change or tab changes
  useEffect(() => {
    resetToFirstPage();
  }, [searchQuery, selectedStatuses, activeSubTab, resetToFirstPage]);

  // ============================================================================
  // SORTING HANDLERS
  // ============================================================================
  const handleSort = (key: string) => {
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

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ArrowUp className="h-4 w-4 text-blue-600" />;
    }
    return <ArrowDown className="h-4 w-4 text-blue-600" />;
  };

  const getSortLabel = (key: string) => {
    if (sortConfig.key !== key) {
      return 'Click to sort';
    }
    
    // Text/name fields
    if (['lawyer_name', 'role', 'category', 'vendor', 'software_name'].includes(key)) {
      return sortConfig.direction === 'asc' 
        ? 'Sorted: A to Z' 
        : 'Sorted: Z to A';
    }
    
    // Date fields
    if (['start_date', 'end_date'].includes(key)) {
      return sortConfig.direction === 'asc' 
        ? 'Sorted: Earliest to Latest' 
        : 'Sorted: Latest to Earliest';
    }
    
    // Numeric fields
    if (['net_salary', 'amount', 'cycle_day', 'seats_licenses'].includes(key)) {
      return sortConfig.direction === 'asc' 
        ? 'Sorted: Lowest to Highest' 
        : 'Sorted: Highest to Lowest';
    }
    
    return 'Click to sort';
  };

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleAddNew = () => {
    setEditingExpense(null);
    if (activeSubTab === 'salaries') {
      setIsSalaryDialogOpen(true);
    } else if (activeSubTab === 'office') {
      setIsOfficeExpenseDialogOpen(true);
    } else if (activeSubTab === 'subscriptions') {
      setIsSubscriptionDialogOpen(true);
    }
  };

  const handleViewDetails = (expenseId: number) => {
    router.push(`/finance/recurring/${expenseId}`);
  };

  const handleEdit = (expense: RecurringExpense) => {
    setEditingExpense(expense);
    if (activeSubTab === 'salaries') {
      setIsSalaryDialogOpen(true);
    } else if (activeSubTab === 'office') {
      setIsOfficeExpenseDialogOpen(true);
    } else if (activeSubTab === 'subscriptions') {
      setIsSubscriptionDialogOpen(true);
    }
  };

  const handleDelete = async (expenseId: number) => {
    if (!confirm('Are you sure you want to delete this expense?')) {
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/expenses/recurring/${expenseId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete expense');
      }

      fetchExpenses();
    } catch (error) {
      console.error('Delete expense error:', error);
      // alert('Failed to delete expense');
      toast.error('Failed to delete expense');
    }
  };

  const handleSuccess = () => {
    fetchExpenses();
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getButtonText = () => {
    if (activeSubTab === 'salaries') return 'Add Salary Recurring Entry';
    if (activeSubTab === 'office') return 'Add Office Expense';
    return 'Add Subscription';
  };

  const getSearchPlaceholder = () => {
    if (activeSubTab === 'salaries') return 'Search by Lawyer Name';
    if (activeSubTab === 'office') return 'Search by Category or Vendor';
    return 'Search by Software Name';
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      {/* DIALOGS */}
      <SalaryDialog
        open={isSalaryDialogOpen}
        onOpenChange={setIsSalaryDialogOpen}
        onSuccess={handleSuccess}
        mode={editingExpense ? 'edit' : 'create'}
        expenseId={editingExpense?.expense_id}
        initialData={editingExpense}
      />
      <OfficeExpenseDialog
        open={isOfficeExpenseDialogOpen}
        onOpenChange={setIsOfficeExpenseDialogOpen}
        onSuccess={handleSuccess}
        mode={editingExpense ? 'edit' : 'create'}
        expenseId={editingExpense?.expense_id}
        initialData={editingExpense}
      />
      <SubscriptionDialog
        open={isSubscriptionDialogOpen}
        onOpenChange={setIsSubscriptionDialogOpen}
        onSuccess={handleSuccess}
        mode={editingExpense ? 'edit' : 'create'}
        expenseId={editingExpense?.expense_id}
        initialData={editingExpense}
      />

      <div>
        {/* SUB-TABS AND ACTION BUTTON */}
        <div className="flex items-center justify-between px-6 pt-4">
          {/* SUB-TABS NAVIGATION */}
          <div className="flex items-center gap-0 border-b border-gray-200">
            <button
              onClick={() => setActiveSubTab('salaries')}
              className={`px-3 py-2 text-base font-semibold transition-colors ${
                activeSubTab === 'salaries'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Salaries
            </button>
            <button
              onClick={() => setActiveSubTab('office')}
              className={`px-3 py-2 text-base font-semibold transition-colors ${
                activeSubTab === 'office'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Office Expenses
            </button>
            <button
              onClick={() => setActiveSubTab('subscriptions')}
              className={`px-3 py-2 text-base font-semibold transition-colors ${
                activeSubTab === 'subscriptions'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Software & Subscriptions
            </button>
          </div>

          {/* ADD BUTTON */}
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600  text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-colors rounded-lg"
          >
            <Plus size={20} />
            <span className="text-sm font-medium">{getButtonText()}</span>
          </button>
        </div>

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
                placeholder={getSearchPlaceholder()}
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 bg-white border border-gray-300 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                suppressHydrationWarning
              />
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

            {/* RECURRENCE FILTER */}
            <div className="flex items-center gap-2">
              <label htmlFor="recurrence-filter" className="text-sm font-medium text-gray-600 whitespace-nowrap">
                Recurring Time:
              </label>
              <div className="relative">
                <select
                  id="recurrence-filter"
                  value={recurrenceFilter}
                  onChange={(e) => setRecurrenceFilter(e.target.value)}
                  className="appearance-none w-32 px-3 py-2 text-sm text-gray-800 bg-white border border-gray-300 rounded-md cursor-pointer focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                  suppressHydrationWarning
                >
                  <option value="All">All</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Yearly">Yearly</option>
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                  ▼
                </span>
              </div>
            </div>
          </div>

          {/* Active Filters Display */}
          {/* {activeFilterCount > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
              <span className="text-sm text-gray-600 font-medium">Active Filters:</span>
              
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

        {/* TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* TABLE HEADER */}
            <thead className="bg-white border-t border-b border-gray-200">
              <tr>
                {activeSubTab === 'salaries' && (
                  <>
                    <th 
                      className="px-6 py-3 text-left text-base font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none" 
                      scope="col"
                      onClick={() => handleSort('lawyer_name')}
                      title={getSortLabel('lawyer_name')}
                    >
                      <div className="flex items-center gap-2">
                        Lawyer Name
                        {getSortIcon('lawyer_name')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-base font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none" 
                      scope="col"
                      onClick={() => handleSort('role')}
                      title={getSortLabel('role')}
                    >
                      <div className="flex items-center gap-2">
                        Role
                        {getSortIcon('role')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-base font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none" 
                      scope="col"
                      onClick={() => handleSort('start_date')}
                      title={getSortLabel('start_date')}
                    >
                      <div className="flex items-center gap-2">
                        Start Month
                        {getSortIcon('start_date')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-base font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none" 
                      scope="col"
                      onClick={() => handleSort('net_salary')}
                      title={getSortLabel('net_salary')}
                    >
                      <div className="flex items-center gap-2">
                        Net Salary
                        {getSortIcon('net_salary')}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-base font-medium text-gray-500" scope="col">Next Due</th>
                    <th className="px-6 py-3 text-left text-base font-medium text-gray-500" scope="col">Active Status</th>
                    <th className="px-6 py-3 text-left text-base font-medium text-gray-500" scope="col">Action</th>
                  </>
                )}
                {activeSubTab === 'office' && (
                  <>
                    <th 
                      className="px-6 py-3 text-left text-base font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none" 
                      scope="col"
                      onClick={() => handleSort('category')}
                      title={getSortLabel('category')}
                    >
                      <div className="flex items-center gap-2">
                        Category
                        {getSortIcon('category')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-base font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none" 
                      scope="col"
                      onClick={() => handleSort('vendor')}
                      title={getSortLabel('vendor')}
                    >
                      <div className="flex items-center gap-2">
                        Vendor
                        {getSortIcon('vendor')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-base font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none" 
                      scope="col"
                      onClick={() => handleSort('amount')}
                      title={getSortLabel('amount')}
                    >
                      <div className="flex items-center gap-2">
                        Amount
                        {getSortIcon('amount')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-base font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none" 
                      scope="col"
                      onClick={() => handleSort('cycle_day')}
                      title={getSortLabel('cycle_day')}
                    >
                      <div className="flex items-center gap-2">
                        Cycle Day
                        {getSortIcon('cycle_day')}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-base font-medium text-gray-500" scope="col">Status</th>
                    <th className="px-6 py-3 text-left text-base font-medium text-gray-500" scope="col">Payments</th>
                    <th className="px-6 py-3 text-left text-base font-medium text-gray-500" scope="col">Action</th>
                  </>
                )}
                {activeSubTab === 'subscriptions' && (
                  <>
                    <th 
                      className="px-6 py-3 text-left text-base font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none" 
                      scope="col"
                      onClick={() => handleSort('software_name')}
                      title={getSortLabel('software_name')}
                    >
                      <div className="flex items-center gap-2">
                        Software Name
                        {getSortIcon('software_name')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-base font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none" 
                      scope="col"
                      onClick={() => handleSort('amount')}
                      title={getSortLabel('amount')}
                    >
                      <div className="flex items-center gap-2">
                        Amount
                        {getSortIcon('amount')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-base font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none" 
                      scope="col"
                      onClick={() => handleSort('seats_licenses')}
                      title={getSortLabel('seats_licenses')}
                    >
                      <div className="flex items-center gap-2">
                        Seats/Licenses
                        {getSortIcon('seats_licenses')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-base font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none" 
                      scope="col"
                      onClick={() => handleSort('end_date')}
                      title={getSortLabel('end_date')}
                    >
                      <div className="flex items-center gap-2">
                        End Date
                        {getSortIcon('end_date')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-base font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none" 
                      scope="col"
                      onClick={() => handleSort('cycle_day')}
                      title={getSortLabel('cycle_day')}
                    >
                      <div className="flex items-center gap-2">
                        Cycle Day
                        {getSortIcon('cycle_day')}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-base font-medium text-gray-500" scope="col">Status</th>
                    <th className="px-6 py-3 text-left text-base font-medium text-gray-500" scope="col">Action</th>
                  </>
                )}
              </tr>
            </thead>

            {/* TABLE BODY */}
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                      <p className="text-lg font-medium">Loading expenses...</p>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-red-500">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-lg font-medium">Error loading expenses</p>
                      <p className="text-sm">{error}</p>
                      <button
                        onClick={fetchExpenses}
                        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : sortedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-lg font-medium">No expenses found</p>
                      <p className="text-sm">Try adjusting your search or filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map((expense) => (
                  <tr key={expense.expense_id} className="hover:bg-gray-50 transition-colors">
                    {activeSubTab === 'salaries' && (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-base font-medium text-gray-900">{expense.lawyer?.name}</div>
                          <div className="text-sm text-gray-500">{expense.lawyer?.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base text-gray-600">
                          {formatRoleDisplay(expense.lawyer?.role.name)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base text-gray-900">
                          {formatDate(expense.start_date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base font-medium text-gray-900">
                          {formatCurrency(expense.net_salary || expense.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base text-gray-900">
                          Day {expense.cycle_day}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(expense.status)}`}>
                            {expense.status.charAt(0).toUpperCase() + expense.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleViewDetails(expense.expense_id)}
                            className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
                          >
                            View Details
                          </button>
                        </td>
                      </>
                    )}
                    {activeSubTab === 'office' && (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-base font-medium text-gray-900 capitalize">
                          {expense.sub_category?.replace('_', ' ') || 'Office Expense'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base text-gray-600">
                          {expense.vendor?.vendor_name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base font-medium text-gray-900">
                          {formatCurrency(expense.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base text-gray-600">
                          Day {expense.cycle_day}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(expense.status)}`}>
                            {expense.status.charAt(0).toUpperCase() + expense.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base text-gray-600">
                          {expense._count.payments} payments
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleViewDetails(expense.expense_id)}
                            className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
                          >
                            View Details
                          </button>
                        </td>
                      </>
                    )}
                    {activeSubTab === 'subscriptions' && (
                      <>
                        <td className="px-6 py-4">
                          <div className="text-base font-medium text-gray-900">{expense.software_name}</div>
                          {expense.description && (
                            <div className="text-sm text-gray-500">{expense.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base font-medium text-gray-900">
                          {formatCurrency(expense.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base text-gray-600">
                          {expense.seats_licenses || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base text-gray-600">
                          {expense.end_date ? formatDate(expense.end_date) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base text-gray-600">
                          Day {expense.cycle_day}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(expense.status)}`}>
                            {expense.status.charAt(0).toUpperCase() + expense.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleViewDetails(expense.expense_id)}
                            className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
                          >
                            View Details
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {!isLoading && !error && sortedExpenses.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={sortedExpenses.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
            itemsPerPageOptions={[10, 25, 50, 100]}
          />
        )}
      </div>
    </>
  );
}