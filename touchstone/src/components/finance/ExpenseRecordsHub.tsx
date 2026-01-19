'use client';

import { useRouter } from 'next/navigation';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, Plus, Pencil, Trash2, ArrowUp, ArrowDown, ArrowUpDown, ChevronsUpDown, Check, X } from 'lucide-react';
import MoreActionsMenu, { MenuItem } from '@/components/MoreActionsMenu';
import ExpenseRecordDialog from './ExpenseRecordDialog';
import Pagination, { usePagination } from '@/components/Pagination';
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

interface OneTimeExpense {
  expense_id: number;
  category: string;
  sub_category: string | null;
  description: string;
  amount: number;
  receipt_url: string | null;
  notes: string | null;
  due_date: string | null;
  status: string;
  vendor: {
    vendor_id: number;
    vendor_name: string;
  } | null;
  matter: {
    matter_id: number;
    matter_title: string;
    client: {
      client_name: string;
    };
  } | null;
  total_paid: number;
  remaining: number;
}

interface ExpenseRecordsHubProps {
  refreshTrigger: number;
}

export default function ExpenseRecordsHub({ refreshTrigger }: ExpenseRecordsHubProps) {
  const router = useRouter();
  const [expenses, setExpenses] = useState<OneTimeExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: 'description' | 'category' | 'vendor' | 'matter' | 'amount' | null;
    direction: 'asc' | 'desc' | null;
  }>({ key: null, direction: null });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<OneTimeExpense | null>(null);

  const {
    currentPage,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    resetToFirstPage,
    getPaginatedData,
  } = usePagination(10);

  // Category options for filter
  const categoryOptions = [
    { value: 'legal_services', label: 'Legal Services' },
    { value: 'office_supplies', label: 'Office Supplies' },
    { value: 'equipment', label: 'Equipment' },
    { value: 'travel', label: 'Travel' },
    { value: 'consulting', label: 'Consulting' },
    { value: 'misc', label: 'Miscellaneous' }
  ];

  // Status options for filter
  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'partially_paid', label: 'Partially Paid' },
    { value: 'paid', label: 'Paid' }
  ];

  // ============================================================================
  // MULTI-SELECT FILTER HANDLERS
  // ============================================================================

  const toggleCategorySelection = (category: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };

  const toggleStatusSelection = (status: string) => {
    setSelectedStatuses(prev => {
      if (prev.includes(status)) {
        return prev.filter(s => s !== status);
      } else {
        return [...prev, status];
      }
    });
  };

  const clearCategoryFilters = () => {
    setSelectedCategories([]);
  };

  const clearStatusFilters = () => {
    setSelectedStatuses([]);
  };

  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedStatuses([]);
    setSearchQuery('');
  };

  // Count active filters
  const activeFilterCount = selectedCategories.length + selectedStatuses.length;

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchExpenses = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/expenses/onetime`, {
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
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses, refreshTrigger]);

  // ============================================================================
  // FILTERING
  // ============================================================================

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const matchesSearch =
        expense.description.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (expense.vendor?.vendor_name.toLowerCase().includes(searchQuery.toLowerCase().trim()) || false) ||
        (expense.matter?.matter_title.toLowerCase().includes(searchQuery.toLowerCase().trim()) || false);

      // If no categories selected, show all. Otherwise, match any selected category
      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(expense.category);
      
      // If no statuses selected, show all. Otherwise, match any selected status
      const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(expense.status);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [expenses, searchQuery, selectedCategories, selectedStatuses]);

  // ============================================================================
  // SORTING
  // ============================================================================
  const sortedExpenses = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return filteredExpenses;
    }

    const sorted = [...filteredExpenses].sort((a, b) => {
      if (sortConfig.key === 'description') {
        return a.description.localeCompare(b.description);
      } else if (sortConfig.key === 'category') {
        return a.category.localeCompare(b.category);
      } else if (sortConfig.key === 'vendor') {
        const aVendor = a.vendor?.vendor_name || '';
        const bVendor = b.vendor?.vendor_name || '';
        return aVendor.localeCompare(bVendor);
      } else if (sortConfig.key === 'matter') {
        const aMatter = a.matter?.matter_title || '';
        const bMatter = b.matter?.matter_title || '';
        return aMatter.localeCompare(bMatter);
      } else if (sortConfig.key === 'amount') {
        return a.amount - b.amount;
      }
      return 0;
    });

    return sortConfig.direction === 'desc' ? sorted.reverse() : sorted;
  }, [filteredExpenses, sortConfig]);

  const paginatedExpenses = useMemo(() => {
    return getPaginatedData(sortedExpenses);
  }, [sortedExpenses, currentPage, itemsPerPage, getPaginatedData]);

  useEffect(() => {
    resetToFirstPage();
  }, [searchQuery, selectedStatuses, selectedCategories, resetToFirstPage]);

  // ============================================================================
  // SORTING HANDLERS
  // ============================================================================
  const handleSort = (key: 'description' | 'category' | 'vendor' | 'matter' | 'amount') => {
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
    
    if (key === 'description' || key === 'category' || key === 'vendor' || key === 'matter') {
      return sortConfig.direction === 'asc' 
        ? 'Sorted: A to Z' 
        : 'Sorted: Z to A';
    }
    
    if (key === 'amount') {
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
    setIsDialogOpen(true);
  };

  const handleEdit = (expense: OneTimeExpense) => {
    setEditingExpense(expense);
    setIsDialogOpen(true);
  };

  const handleView = (expenseId: number) => {
    router.push(`/finance/onetime/${expenseId}`);
  };

  const handleDelete = useCallback(async (expenseId: number) => {
    if (!confirm('Are you sure you want to delete this expense?')) {
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/expenses/onetime/${expenseId}`, {
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
  }, [fetchExpenses]);

  const getExpenseActions = (expense: OneTimeExpense): MenuItem[] => [
    {
      icon: Pencil,
      label: 'Edit Expense',
      onClick: () => handleEdit(expense),
      active: false,
    },
    {
      icon: Trash2,
      label: 'Delete Expense',
      onClick: () => handleDelete(expense.expense_id),
      danger: true,
    },
  ];

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

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'partially_paid':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryDisplay = (category: string): string => {
    return category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getStatusDisplay = (status: string): string => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      {/* DIALOG */}
      <ExpenseRecordDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={fetchExpenses}
        mode={editingExpense ? 'edit' : 'create'}
        expenseId={editingExpense?.expense_id}
        initialData={editingExpense}
      />

      <div>
        {/* HEADER WITH ADD BUTTON */}
        <div className="px-6 pt-4 flex items-center justify-between">
          <h2 className="text-xl font-medium text-gray-900">Expense Records</h2>
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600  text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-colors rounded-lg"
          >
            <Plus size={20} />
            <span className="text-sm font-medium">Add Expense Record</span>
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
                placeholder="Search by description, vendor, or matter"
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 bg-white border border-gray-300 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                suppressHydrationWarning
              />
            </div>

            {/* MULTI-SELECT CATEGORY FILTER */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600 whitespace-nowrap">
                Category:
              </label>
              <Popover open={categoryFilterOpen} onOpenChange={setCategoryFilterOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-[200px] justify-between font-normal"
                  >
                    {selectedCategories.length === 0 
                      ? "All" 
                      : `${selectedCategories.length} selected`}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search categories..." />
                    <CommandList>
                      <CommandEmpty>No categories found.</CommandEmpty>
                      <CommandGroup>
                        {categoryOptions.map((category) => (
                          <CommandItem
                            key={category.value}
                            value={category.value}
                            onSelect={() => toggleCategorySelection(category.value)}
                          >
                            <div className="flex items-center gap-2 w-full">
                              <div className={`h-4 w-4 border rounded flex items-center justify-center ${
                                selectedCategories.includes(category.value) 
                                  ? 'bg-blue-600 border-blue-600' 
                                  : 'border-gray-300'
                              }`}>
                                {selectedCategories.includes(category.value) && (
                                  <Check className="h-3 w-3 text-white" />
                                )}
                              </div>
                              <span className="flex-1">{category.label}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      {selectedCategories.length > 0 && (
                        <>
                          <div className="border-t my-1" />
                          <div className="p-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={clearCategoryFilters}
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
              
              {selectedCategories.map((category) => {
                const categoryOption = categoryOptions.find(c => c.value === category);
                return categoryOption ? (
                  <Badge 
                    key={category} 
                    variant="secondary" 
                    className="gap-1 pl-2 pr-1"
                  >
                    {categoryOption.label}
                    <button
                      onClick={() => toggleCategorySelection(category)}
                      className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ) : null;
              })}
              
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
                <th 
                  className="px-6 py-3 text-left text-base font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none" 
                  scope="col"
                  onClick={() => handleSort('description')}
                  title={getSortLabel('description')}
                >
                  <div className="flex items-center gap-2">
                    Description
                    {getSortIcon('description')}
                  </div>
                </th>
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
                  onClick={() => handleSort('matter')}
                  title={getSortLabel('matter')}
                >
                  <div className="flex items-center gap-2">
                    Matter
                    {getSortIcon('matter')}
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
                <th className="px-6 py-3 text-left text-base font-medium text-gray-500" scope="col">Paid/Remaining</th>
                <th className="px-6 py-3 text-left text-base font-medium text-gray-500" scope="col">Status</th>
                <th className="px-6 py-3 text-left text-base font-medium text-gray-500" scope="col">Actions</th>
              </tr>
            </thead>

            {/* TABLE BODY */}
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                      <p className="text-lg font-medium">Loading expenses...</p>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-red-500">
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
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-lg font-medium">No expenses found</p>
                      <p className="text-sm">Try adjusting your search or filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map((expense) => (
                  <tr
                    key={expense.expense_id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="text-base font-medium text-gray-900">{expense.description}</div>
                      {expense.sub_category && (
                        <div className="text-sm text-gray-500 capitalize">{expense.sub_category.replace('_', ' ')}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base text-gray-600 capitalize">
                      {getCategoryDisplay(expense.category)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base text-gray-600">
                      {expense.vendor?.vendor_name || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {expense.matter ? (
                        <div>
                          <div className="text-base text-gray-900">{expense.matter.matter_title}</div>
                          <div className="text-sm text-gray-500">{expense.matter.client.client_name}</div>
                        </div>
                      ) : (
                        <span className="text-base text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base font-medium text-gray-900">
                      {formatCurrency(expense.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-base text-green-600">{formatCurrency(expense.total_paid)}</div>
                      {expense.remaining > 0 && (
                        <div className="text-sm text-red-600">{formatCurrency(expense.remaining)} remaining</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(expense.status)}`}>
                        {getStatusDisplay(expense.status)}
                      </span>
                    </td>
                    <td
                      className="px-6 py-4 whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleView(expense.expense_id);
                          }}
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
                        >
                          View Details
                        </button>
                        <MoreActionsMenu items={getExpenseActions(expense)} label={`More actions for ${expense.description}`} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {!isLoading && !error && sortedExpenses.length > 0 && (
            <div className="px-6 py-4">
              <Pagination
                currentPage={currentPage}
                totalItems={sortedExpenses.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                itemsPerPageOptions={[10, 25, 50, 100]}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}