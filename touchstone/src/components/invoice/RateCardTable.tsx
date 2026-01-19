'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Search, Edit2, ToggleLeft, ToggleRight, ChevronsUpDown, Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { API_ENDPOINTS } from '@/lib/api';
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

interface User {
  user_id: number;
  id?: number;
  name: string;
  email?: string;
  practice_area?: string;
}

/**
 * Rate Card Interface Definition (matching backend snake_case)
 */
interface RateCard {
  ratecard_id: number;
  user_id: number;
  service_type: string;
  min_hourly_rate: number;
  max_hourly_rate: number;
  effective_date: string;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user: {
    user_id: number;
    name: string;
    email: string;
    practice_area?: string;
  };
}

interface RateCardTableProps {
  refreshTrigger: number;
  onEdit?: (rateCard: RateCard) => void;
}

export default function RateCardTable({
  refreshTrigger,
  onEdit,
}: RateCardTableProps) {
  const router = useRouter();

  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>([]);
  const [serviceTypeFilterOpen, setServiceTypeFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');

  const {
    currentPage,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    resetToFirstPage,
    getPaginatedData,
  } = usePagination(10);

  // ================== INLINE EDITING STATE ===================
  const [editingCell, setEditingCell] = useState<{
    id: number;
    field: "min_hourly_rate" | "max_hourly_rate" | "effective_date" | "end_date";
  } | null>(null);

  const [editingValue, setEditingValue] = useState("");

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const autoDeactivateIfExpired = async (rateCard: RateCard) => {
    if (!rateCard.end_date) return;

    // Get today's date at midnight for proper comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const endDate = new Date(rateCard.end_date + 'T00:00:00');

    if (endDate < today && rateCard.is_active) {
      try {
        await fetch(API_ENDPOINTS.rateCards.update(rateCard.ratecard_id), {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            is_active: false,
          }),
        });

        console.log(`Rate card ${rateCard.ratecard_id} auto-deactivated`);
      } catch (error) {
        console.error("Auto-deactivate failed:", error);
      }
    }
  };

  const fetchRateCards = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(API_ENDPOINTS.rateCards.list, {
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
        throw new Error('Failed to fetch rate cards');
      }

      const data = await response.json();

      if (data.success) {
        setRateCards(data.data || []);
        // Auto-deactivate expired rate cards
        for (const rc of data.data || []) {
          autoDeactivateIfExpired(rc);
        }
      } else {
        setError(data.message || 'Failed to load rate cards');
      }
    } catch (err) {
      console.error('Fetch rate cards error:', err);
      setError('Failed to load rate cards. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchRateCards();
  }, [fetchRateCards, refreshTrigger]);

  // ============================================================================
  // MULTI-SELECT SERVICE TYPE FILTER HANDLERS
  // ============================================================================

  const toggleServiceTypeSelection = (serviceType: string) => {
    setSelectedServiceTypes(prev => {
      if (prev.includes(serviceType)) {
        return prev.filter(s => s !== serviceType);
      } else {
        return [...prev, serviceType];
      }
    });
  };

  const clearServiceTypeFilters = () => {
    setSelectedServiceTypes([]);
  };

  const clearAllFilters = () => {
    setSelectedServiceTypes([]);
    setStatusFilter('All');
    setSearchQuery('');
  };

  // Count active filters
  const activeFilterCount = selectedServiceTypes.length;

  // ============================================================================
  // FILTERING
  // ============================================================================

  const filteredRateCards = useMemo(() => {
    return rateCards.filter((rateCard) => {
      const matchesSearch =
        rateCard.user.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase().trim()) ||
        rateCard.service_type
          .toLowerCase()
          .includes(searchQuery.toLowerCase().trim()) ||
        (rateCard.user.practice_area?.toLowerCase() || '')
          .includes(searchQuery.toLowerCase().trim());

      // If no service types selected, show all. Otherwise, match any selected service type
      const matchesServiceType =
        selectedServiceTypes.length === 0 ||
        selectedServiceTypes.includes(rateCard.service_type);

      const matchesStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Active' && rateCard.is_active) ||
        (statusFilter === 'Inactive' && !rateCard.is_active);

      return matchesSearch && matchesServiceType && matchesStatus;
    });
  }, [rateCards, searchQuery, selectedServiceTypes, statusFilter]);

  const paginatedRateCards = useMemo(() => {
    return getPaginatedData(filteredRateCards);
  }, [filteredRateCards, currentPage, itemsPerPage, getPaginatedData]);

  useEffect(() => {
    resetToFirstPage();
  }, [searchQuery, statusFilter, selectedServiceTypes, resetToFirstPage]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleStatusFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setStatusFilter(e.target.value);
  };

  const handleEdit = (rateCard: RateCard) => {
    if (onEdit) {
      onEdit(rateCard);
    }
  };

  const handleToggleStatus = async (rateCard: RateCard) => {
    const action = rateCard.is_active ? 'deactivate' : 'activate';
    const confirmed = confirm(
      `Are you sure you want to ${action} this rate card?`
    );
    if (!confirmed) return;

    try {
      const payload: { is_active: boolean; end_date?: null } = {
        is_active: !rateCard.is_active,
      };

      // If activating (currently inactive), clear the end_date
      if (!rateCard.is_active) {
        payload.end_date = null;
      }

      const response = await fetch(
        API_ENDPOINTS.rateCards.update(rateCard.ratecard_id),
        {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || `Failed to ${action} rate card`);
      }

      fetchRateCards();
      // alert(`Rate card ${action}d successfully`);
      toast.success(`Rate card ${action}d successfully`);
    } catch (err) {
      console.error(`Error ${action}ing rate card:`, err);
      // alert(err instanceof Error ? err.message : `Failed to ${action} rate card`);
      toast.error(err instanceof Error ? err.message : `Failed to ${action} rate card`);
    }
  };

  const handleInlineUpdate = async (
    rateCard: RateCard,
    field: "min_hourly_rate" | "max_hourly_rate" | "effective_date" | "end_date",
    value: string
  ) => {
    try {
      const updatedPayload: Record<string, unknown> = {};

      if (field === "min_hourly_rate" || field === "max_hourly_rate") {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue <= 0) {
          // alert("Please enter a valid hourly rate");
          toast.error("Please enter a valid hourly rate");
          return;
        }
        
        // Validate min/max relationship
        if (field === "min_hourly_rate" && numValue > rateCard.max_hourly_rate) {
          // alert("Minimum rate cannot be greater than maximum rate");
          toast.error("Minimum rate cannot be greater than maximum rate");
          return;
        }
        if (field === "max_hourly_rate" && numValue < rateCard.min_hourly_rate) {
          // alert("Maximum rate cannot be less than minimum rate");
          toast.error("Maximum rate cannot be less than minimum rate");
          return;
        }
        
        updatedPayload[field] = numValue;
      }

      if (field === "effective_date") {
        updatedPayload.effective_date = value;
      }

      if (field === "end_date") {
        // Get today's date at midnight for proper comparison
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const newEndDate = value ? new Date(value + 'T00:00:00') : null;

        updatedPayload.end_date = value || null;

        // CASE A: End date cleared → active = true
        if (!newEndDate) {
          updatedPayload.is_active = true;
        }
        // CASE B: End date is BEFORE today → deactivate
        else if (newEndDate < today) {
          updatedPayload.is_active = false;
        }
        // CASE C: End date is today or AFTER today → activate
        else {
          updatedPayload.is_active = true;
        }
      }

      const response = await fetch(
        API_ENDPOINTS.rateCards.update(rateCard.ratecard_id),
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedPayload),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Update failed");
      }

      await fetchRateCards();
    } catch (err) {
      console.error("Update error:", err);
      // alert(err instanceof Error ? err.message : "Update failed");
      toast.error(err instanceof Error ? err.message : "Update failed");
    }

    setEditingCell(null);
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

  const formatDateForInput = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  const formatCurrency = (amount: number): string => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const getServiceTypeDisplay = (serviceType: string): string => {
    return serviceType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Get unique service types for filter
  const serviceTypes = useMemo(() => {
    const types = new Set(rateCards.map((rc) => rc.service_type));
    return Array.from(types);
  }, [rateCards]);

  // ============================================================================
  // EDITABLE CELL COMPONENT
  // ============================================================================

  const EditableCell = ({
    rateCard,
    field,
    children,
  }: {
    rateCard: RateCard;
    field: "min_hourly_rate" | "max_hourly_rate" | "effective_date" | "end_date";
    children: React.ReactNode;
  }) => {
    const isEditing =
      editingCell?.id === rateCard.ratecard_id && editingCell.field === field;

    const start = () => {
      setEditingCell({ id: rateCard.ratecard_id, field });

      if (field === "min_hourly_rate") {
        setEditingValue(rateCard.min_hourly_rate.toString());
      } else if (field === "max_hourly_rate") {
        setEditingValue(rateCard.max_hourly_rate.toString());
      } else if (field === "effective_date") {
        setEditingValue(formatDateForInput(rateCard.effective_date));
      } else if (field === "end_date") {
        setEditingValue(rateCard.end_date ? formatDateForInput(rateCard.end_date) : '');
      }
    };

    if (!isEditing) {
      return (
        <td
          className="px-6 py-4 cursor-pointer hover:bg-blue-50 transition-colors"
          onDoubleClick={start}
          title="Double-click to edit"
        >
          {children}
        </td>
      );
    }

    // Render date input for date fields
    if (field === "effective_date" || field === "end_date") {
      return (
        <td className="px-6 py-4">
          <div className="flex items-center justify-center gap-2">
            <input
              autoFocus
              type="date"
              className="border border-gray-300 rounded px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleInlineUpdate(rateCard, field, editingValue);
                } else if (e.key === "Escape") {
                  setEditingCell(null);
                }
              }}
            />
            <button
              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
              onClick={() => handleInlineUpdate(rateCard, field, editingValue)}
              title="Save (Enter)"
            >
              ✓
            </button>
            <button
              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
              onClick={() => setEditingCell(null)}
              title="Cancel (Esc)"
            >
              ✕
            </button>
            {field === "end_date" && (
              <button
                className="p-1.5 text-gray-600 hover:bg-gray-50 rounded text-xs"
                onClick={() => {
                  setEditingValue('');
                  handleInlineUpdate(rateCard, field, '');
                }}
                title="Clear end date"
              >
                Clear
              </button>
            )}
          </div>
        </td>
      );
    }

    // This should never be reached for date fields
    return <td className="px-6 py-4">{children}</td>;
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
              placeholder="Search by User Name, Service Type, or Practice Area"
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 bg-white border border-gray-300 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
              suppressHydrationWarning
            />
          </div>

          {/* MULTI-SELECT SERVICE TYPE FILTER */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">
              Service Type:
            </label>
            <Popover open={serviceTypeFilterOpen} onOpenChange={setServiceTypeFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-[220px] justify-between font-normal"
                >
                  {selectedServiceTypes.length === 0 
                    ? "All" 
                    : `${selectedServiceTypes.length} selected`}
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search service types..." />
                  <CommandList>
                    <CommandEmpty>No service types found.</CommandEmpty>
                    <CommandGroup>
                      {serviceTypes.map((serviceType) => (
                        <CommandItem
                          key={serviceType}
                          value={serviceType}
                          onSelect={() => toggleServiceTypeSelection(serviceType)}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <div className={`h-4 w-4 border rounded flex items-center justify-center ${
                              selectedServiceTypes.includes(serviceType) 
                                ? 'bg-blue-600 border-blue-600' 
                                : 'border-gray-300'
                            }`}>
                              {selectedServiceTypes.includes(serviceType) && (
                                <Check className="h-3 w-3 text-white" />
                              )}
                            </div>
                            <span className="flex-1">{getServiceTypeDisplay(serviceType)}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    {selectedServiceTypes.length > 0 && (
                      <>
                        <div className="border-t my-1" />
                        <div className="p-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearServiceTypeFilters}
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

          {/* STATUS FILTER */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="status-filter"
              className="text-sm font-medium text-gray-600"
            >
              Status:
            </label>
            <div className="relative">
              <select
                id="status-filter"
                value={statusFilter}
                onChange={handleStatusFilterChange}
                className="appearance-none w-32 px-3 py-2 text-sm text-gray-800 bg-white border border-gray-300 rounded-md cursor-pointer focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                suppressHydrationWarning
              >
                <option value="All">All</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-xs">
                ▼
              </span>
            </div>
          </div>
        </div>

        {/* Active Filters Display */}
        {/* {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
            <span className="text-sm text-gray-600 font-medium">Active Filters:</span>
            
            {selectedServiceTypes.map((serviceType) => (
              <Badge 
                key={serviceType} 
                variant="secondary" 
                className="gap-1 pl-2 pr-1"
              >
                {getServiceTypeDisplay(serviceType)}
                <button
                  onClick={() => toggleServiceTypeSelection(serviceType)}
                  className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            
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

      {/* RATE CARDS TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* TABLE HEADER */}
          <thead className="bg-white border-t border-b border-gray-200">
            <tr>
              <th
                className="px-6 py-3 text-left text-base font-medium text-gray-500"
                scope="col"
              >
                User
              </th>
              <th
                className="px-6 py-3 text-left text-base font-medium text-gray-500"
                scope="col"
              >
                Service Type
              </th>
              <th
                className="px-6 py-3 text-right text-base font-medium text-gray-500"
                scope="col"
              >
                Rate Range
              </th>
              <th
                className="px-6 py-3 text-center text-base font-medium text-gray-500"
                scope="col"
              >
                Effective Date
              </th>
              <th
                className="px-6 py-3 text-center text-base font-medium text-gray-500"
                scope="col"
              >
                End Date
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
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="text-lg font-medium">Loading rate cards...</p>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-red-500">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-lg font-medium">Error loading rate cards</p>
                    <p className="text-sm">{error}</p>
                    <button
                      onClick={fetchRateCards}
                      className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Retry
                    </button>
                  </div>
                </td>
              </tr>
            ) : filteredRateCards.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-lg font-medium">No rate cards found</p>
                    <p className="text-sm">
                      {rateCards.length === 0
                        ? 'Add your first rate card to get started'
                        : 'Try adjusting your search or filters'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedRateCards.map((rateCard) => (
                <tr
                  key={rateCard.ratecard_id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="text-base font-medium">{rateCard.user.name}</div>
                    {rateCard.user.practice_area && (
                      <div className="text-sm text-gray-500">{rateCard.user.practice_area}</div>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-base">
                      {getServiceTypeDisplay(rateCard.service_type)}
                    </div>
                  </td>

                  {/* Rate Range Column with Inline Editing */}
                  <td className="px-6 py-4">
                    <div className="text-right space-y-2">
                      <div className="text-base font-semibold text-gray-900">
                        {formatCurrency(rateCard.min_hourly_rate)} - {formatCurrency(rateCard.max_hourly_rate)}/hr
                      </div>
                      <div className="text-xs text-gray-500 flex items-center justify-end gap-3">
                        {/* Min Rate - Editable */}
                        {editingCell?.id === rateCard.ratecard_id && editingCell.field === "min_hourly_rate" ? (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">Min:</span>
                            <input
                              autoFocus
                              type="number"
                              className="border border-gray-300 rounded px-2 py-1 w-24 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleInlineUpdate(rateCard, "min_hourly_rate", editingValue);
                                } else if (e.key === "Escape") {
                                  setEditingCell(null);
                                }
                              }}
                              min="0"
                              step="0.01"
                            />
                            <button
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              onClick={() => handleInlineUpdate(rateCard, "min_hourly_rate", editingValue)}
                              title="Save (Enter)"
                            >
                              ✓
                            </button>
                            <button
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              onClick={() => setEditingCell(null)}
                              title="Cancel (Esc)"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <span
                            className="cursor-pointer hover:text-blue-600 transition-colors"
                            onDoubleClick={() => {
                              setEditingCell({ id: rateCard.ratecard_id, field: "min_hourly_rate" });
                              setEditingValue(rateCard.min_hourly_rate.toString());
                            }}
                            title="Double-click to edit min rate"
                          >
                            Min: {formatCurrency(rateCard.min_hourly_rate)}
                          </span>
                        )}

                        {/* Max Rate - Editable */}
                        {editingCell?.id === rateCard.ratecard_id && editingCell.field === "max_hourly_rate" ? (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">Max:</span>
                            <input
                              autoFocus
                              type="number"
                              className="border border-gray-300 rounded px-2 py-1 w-24 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleInlineUpdate(rateCard, "max_hourly_rate", editingValue);
                                } else if (e.key === "Escape") {
                                  setEditingCell(null);
                                }
                              }}
                              min="0"
                              step="0.01"
                            />
                            <button
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              onClick={() => handleInlineUpdate(rateCard, "max_hourly_rate", editingValue)}
                              title="Save (Enter)"
                            >
                              ✓
                            </button>
                            <button
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              onClick={() => setEditingCell(null)}
                              title="Cancel (Esc)"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <span
                            className="cursor-pointer hover:text-blue-600 transition-colors"
                            onDoubleClick={() => {
                              setEditingCell({ id: rateCard.ratecard_id, field: "max_hourly_rate" });
                              setEditingValue(rateCard.max_hourly_rate.toString());
                            }}
                            title="Double-click to edit max rate"
                          >
                            Max: {formatCurrency(rateCard.max_hourly_rate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  <EditableCell rateCard={rateCard} field="effective_date">
                    <div className="text-base text-gray-900 text-center">
                      {formatDate(rateCard.effective_date)}
                    </div>
                  </EditableCell>

                  <EditableCell rateCard={rateCard} field="end_date">
                    <div className="text-base text-gray-900 text-center">
                      {rateCard.end_date ? formatDate(rateCard.end_date) : '-'}
                    </div>
                  </EditableCell>

                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        rateCard.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {rateCard.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => handleEdit(rateCard)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(rateCard)}
                        className={`p-1.5 rounded-md transition-colors ${
                          rateCard.is_active
                            ? 'text-green-600 hover:bg-green-50'
                            : 'text-orange-600 hover:bg-orange-50'
                        }`}
                        title={rateCard.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {rateCard.is_active ? (
                          <ToggleLeft size={18} />
                        ) : (
                          <ToggleRight size={18} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!isLoading && !error && filteredRateCards.length > 0 && (
          <div className="px-6 py-4">
            <Pagination
              currentPage={currentPage}
              totalItems={filteredRateCards.length}
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