'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Pencil, Trash2, Scale, Loader2, UserCog, ChevronsUpDown, ArrowUpDown, ArrowUp, Eye, EyeOff, RotateCcw, ArrowDown } from 'lucide-react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import MoreActionsMenu from '@/components/MoreActionsMenu';
import { API_ENDPOINTS } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Pagination, { usePagination } from '@/components/Pagination';
import ReassignLeadDialog from '@/components/matter/ReassignLeadDialog';
import CloseMatterDialog from '@/components/matter/CloseMatterDialog';
import ReopenMatterDialog from '@/components/matter/ReopenMatterDialog';
import { canCloseMatter } from '@/lib/permissions';
import CurrencyBadge from '@/components/ui/currency-badge';
import { formatAmountWithCurrency, type CurrencyCode } from '@/lib/currencyUtils';
import { toast } from 'react-toastify';


interface Matter {
  id: string;
  matterId: string;
  matterCode?: string;
  matterTitle: string;
  clientName: string;
  clientId: number;
  matterType: string;
  assignedLawyer: string;
  assignedLeads?: Array<{
    userId: number;
    name: string;
    email: string;
    serviceType: string;
    hourlyRate?: number;
    isLead: boolean;
  }>;
  billingRateType?: string;
  assignedLawyerId: number | null;
  createdBy: string;
  status: 'In Progress' | 'Awaiting Decision' | 'Completed' | 'On Hold' | 'Closed';
  rawStatus?: string;
  deadline: string;
  startDate: string;
  createdAt: Date;
  conflictDetected?: boolean;
  conflictstatus?: string;
  currency?: string;
  estimatedValue?: number;
  [key: string]: unknown;
}

interface MatterMasterTableProps {
  refreshTrigger?: number;
  onEdit?: (matter: Matter) => void;
  onRefresh?: () => void;
  userIdFilter?: number;
  statusFilter?: string;
}

export default function MatterMasterTable({
  refreshTrigger = 0,
  onEdit,
  onRefresh,
  userIdFilter,
  statusFilter: propStatusFilter
}: MatterMasterTableProps) {
  const router = useRouter();
  const { hasPermission, user, role } = useAuth();
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('All Time');
  const [statusFilter, setStatusFilter] = useState('All');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [selectedMatterForReassign, setSelectedMatterForReassign] = useState<Matter | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [selectedMatterForClose, setSelectedMatterForClose] = useState<Matter | null>(null);

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Matter | null;
    direction: 'asc' | 'desc' | null;
  }>({ key: 'createdAt', direction: 'desc' });

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{
    id: string;
    field: "matterTitle" | "clientName" | "assignedLawyer";
  } | null>(null);

  const [editingValue, setEditingValue] = useState("");
  const [editingDropdownOpen, setEditingDropdownOpen] = useState(false);

  // Dropdown data sources
  const [allClients, setAllClients] = useState<{ id: number; name: string }[]>([]);
  const [allLawyers, setAllLawyers] = useState<{ id: number; name: string }[]>([]);

  const {
    currentPage,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    resetToFirstPage,
    getPaginatedData,
  } = usePagination(10);




  // ============================================================================
  // API CALLS
  // ============================================================================

  const fetchMatters = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params = new URLSearchParams();
      if (userIdFilter) {
        params.append('assigned_lawyer', userIdFilter.toString());
      }
      // Use propStatusFilter if provided (from URL), otherwise use local statusFilter
      const effectiveStatusFilter = propStatusFilter || (statusFilter && statusFilter !== 'All' ? statusFilter : null);
      if (effectiveStatusFilter) {
        // Map frontend status to backend status
        const statusMap: Record<string, string> = {
          'active': 'active',
          'closed': 'closed',
          'Active': 'active',
          'Closed': 'closed',
        };
        params.append('status', statusMap[effectiveStatusFilter] || effectiveStatusFilter);
      }

      const url = params.toString() 
        ? `${API_ENDPOINTS.matters.list}?${params.toString()}`
        : API_ENDPOINTS.matters.list;

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch matters: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('API Response:', result);

      if (!result.success || !result.data) {
        throw new Error('Invalid response format from API');
      }

      const data = result.data;

      const transformedData = data.map((matter: any) => {
        // Get assigned leads
        const assignedLeads = matter.assignedLeads || [];
        const leadNames = assignedLeads.map((lead: any) => lead.name).join(', ') || 'Unassigned';
        const primaryLeadId = assignedLeads.length > 0 ? assignedLeads[0].userId : null;
        
        return {
          id: matter.id?.toString(),
          matterId: matter.id?.toString() || `M${matter.id}`,
          matterCode: matter.matterCode || null,
          matterTitle: matter.matterTitle,
          clientName: matter.clientName,
          clientId: matter.clientId,
          matterType: matter.matterType || 'N/A',
          assignedLawyer: leadNames,
          assignedLeads: assignedLeads,
          assignedLawyerId: primaryLeadId,
          billingRateType: matter.billingRateType,
          currency: matter.currency || 'INR',
          status: formatStatus(matter.status || 'active'),
          rawStatus: matter.status || 'active', // Store raw status for checks
          deadline: matter.estimatedDeadline
            ? new Date(matter.estimatedDeadline).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
            : 'No deadline',
          startDate: matter.startDate || new Date().toISOString(),
          createdBy: matter.createdBy || 'Unknown',
          createdAt: matter.createdAt || new Date().toISOString(),
          conflictDetected: matter.conflictDetected || false,
          conflictstatus: matter.conflictstatus || 'no_conflict',
        };
      });

      const sortedData = [...transformedData].sort((a: Matter, b: Matter) => {
        const idA = Number(a.id ?? a.matterId);
        const idB = Number(b.id ?? b.matterId);
        return idA - idB;
      });

      setMatters(sortedData);
    } catch (err) {
      console.error('API fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch matters');
    } finally {
      setLoading(false);
    }
  };

  const deleteMatter = async (matterId: string, matterTitle: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${matterTitle}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeletingId(matterId);
      const numericId = parseInt(matterId, 10);

      if (isNaN(numericId)) {
        throw new Error('Invalid matter ID');
      }

      const response = await fetch(API_ENDPOINTS.matters.delete(numericId), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to delete matter: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to delete matter');
      }

      setMatters((prev) => prev.filter((m) => m.matterId !== matterId));

      if (onRefresh) {
        onRefresh();
      }

      // alert('Matter deleted successfully!');
      toast.success('Matter deleted successfully!');
    } catch (err) {
      console.error('Error deleting matter:', err);
      // alert(err instanceof Error ? err.message : 'Failed to delete matter. Please try again.');
      toast.error(err instanceof Error ? err.message : 'Failed to delete matter. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  async function fetchDropdownData() {
    try {
      const [clientRes, userRes] = await Promise.all([
        fetch(API_ENDPOINTS.clients.list, { credentials: 'include' }),
        fetch(API_ENDPOINTS.users.list, { credentials: 'include' })
      ]);

      const clientJson = await clientRes.json();
      const userJson = await userRes.json();

      if (clientJson.success && clientJson.data) {
        const mappedClients = clientJson.data.map((c: any) => ({
          id: c.id || c.client_id,
          name: c.companyName || c.client_name,
        })).filter((c: any) => c.id && c.name);

        setAllClients(mappedClients);
      }

      if (userJson.success && userJson.data) {
        const mappedLawyers = userJson.data
          .map((u: any) => ({
            id: u.id,
            name: u.name,
          }))
          .filter((l: any) => l.id && l.name);

        setAllLawyers(mappedLawyers);
      }
    } catch (e) {
      console.error("Failed to load dropdown data", e);
    }
  }

  useEffect(() => {
    fetchMatters();
    fetchDropdownData();
  }, [refreshTrigger, userIdFilter, propStatusFilter]);


  // ============================================================================
  // FILTERING AND SORTING
  // ============================================================================

  const filteredMatters = useMemo(() => {
    return matters.filter((matter) => {
      const matchesSearch =
        matter.matterTitle.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        matter.clientName.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        matter.matterId.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (matter.matterCode && matter.matterCode.toLowerCase().includes(searchQuery.toLowerCase().trim()));

      const matchesStatus = statusFilter === 'All' || matter.status === statusFilter;

      // Date filtering logic
      let matchesDate = true;
      if (dateFilter !== 'All Time') {
        const matterDate = new Date(matter.startDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (dateFilter === 'Today') {
          const matterDateOnly = new Date(matterDate);
          matterDateOnly.setHours(0, 0, 0, 0);
          matchesDate = matterDateOnly.getTime() === today.getTime();
        } else if (dateFilter === 'This Week') {
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - today.getDay());
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);
          matchesDate = matterDate >= weekStart && matterDate <= weekEnd;
        } else if (dateFilter === 'This Month') {
          matchesDate =
            matterDate.getMonth() === today.getMonth() &&
            matterDate.getFullYear() === today.getFullYear();
        }
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [matters, searchQuery, statusFilter, dateFilter]);

  const sortedMatters = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return filteredMatters;
    }

    const sorted = [...filteredMatters].sort((a, b) => {
      const aValue = a[sortConfig.key!];
      const bValue = b[sortConfig.key!];

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Matter ID/Code sorting (numeric, oldest to newest = ascending)
      if (sortConfig.key === 'matterId' || sortConfig.key === 'matterCode') {
        // Extract numeric part from matter code (e.g., "0086-0014" -> 14) or use matterId
        const aNum = sortConfig.key === 'matterCode' && typeof aValue === 'string' && aValue.includes('-')
          ? Number(aValue.split('-')[1])
          : Number(aValue);
        const bNum = sortConfig.key === 'matterCode' && typeof bValue === 'string' && bValue.includes('-')
          ? Number(bValue.split('-')[1])
          : Number(bValue);
        return aNum - bNum;
      }

      // Date sorting for deadline
      if (sortConfig.key === 'deadline') {
        const aDate = new Date(String(aValue));
        const bDate = new Date(String(bValue));

        if (String(aValue).includes('No deadline')) return 1;
        if (String(bValue).includes('No deadline')) return -1;

        return aDate.getTime() - bDate.getTime();
      }

      // Alphabetical sorting for text fields
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();

      if (aStr < bStr) return -1;
      if (aStr > bStr) return 1;
      return 0;
    });

    return sortConfig.direction === 'desc' ? sorted.reverse() : sorted;
  }, [filteredMatters, sortConfig]);


  const paginatedMatters = useMemo(
    () => getPaginatedData(sortedMatters),
    [sortedMatters, currentPage, itemsPerPage, getPaginatedData]
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    resetToFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, statusFilter, dateFilter]);


  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleDateFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDateFilter(e.target.value);
  };

  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
  };

  const handleViewMatter = (matter: Matter) => {
    router.push(`/matter/matter-master/${matter.matterId}`);
  };

  const handleEditMatter = (matter: Matter) => {
    if (onEdit) {
      onEdit(matter);
    }
  };

  const handleReassignLead = (matter: Matter) => {
    setSelectedMatterForReassign(matter);
    setReassignDialogOpen(true);
  };

  const handleReassignSuccess = () => {
    fetchMatters();
    if (onRefresh) {
      onRefresh();
    }
  };

  const handleSort = (key: keyof Matter) => {
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

  const getSortIcon = (key: keyof Matter) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ArrowUp className="h-4 w-4 text-blue-600" />;
    }
    return <ArrowDown className="h-4 w-4 text-blue-600" />;
  };

  const getSortLabel = (key: keyof Matter) => {
    if (sortConfig.key !== key) {
      return 'Click to sort';
    }

    if (key === 'matterId' || key === 'matterCode') {
      return sortConfig.direction === 'asc'
        ? 'Sorted: Oldest to Newest'
        : 'Sorted: Newest to Oldest';
    }

    if (key === 'deadline') {
      return sortConfig.direction === 'asc'
        ? 'Sorted: Earliest to Latest'
        : 'Sorted: Latest to Earliest';
    }

    return sortConfig.direction === 'asc'
      ? 'Sorted: A to Z'
      : 'Sorted: Z to A';
  };

  const handleSelectionChange = async (matter: Matter, field: string, newValue: string) => {
    try {
      const numericId = parseInt(matter.id, 10);
      if (isNaN(numericId)) {
        // alert("Invalid matter ID");
        toast.error("Invalid matter ID");
        return;
      }

      const updatePayload: Record<string, unknown> = {
        matter_title: matter.matterTitle,
        start_date: matter.startDate || new Date().toISOString(),
      };

      if (field === "matterTitle") {
        updatePayload.matter_title = newValue;
      }

      if (field === "clientName") {
        const client = allClients.find(c => c.name === newValue);
        if (!client) {
          // alert("Please select a valid client from the dropdown");
          toast.error("Please select a valid client from the dropdown");
          return;
        }
        updatePayload.client_id = client.id;
      }

      const response = await fetch(API_ENDPOINTS.matters.update(numericId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Update failed");
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to update matter");
      }

      await fetchMatters();

    } catch (err) {
      console.error("Update error:", err);
      // alert(err instanceof Error ? err.message : "Failed to update");
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }

    setEditingDropdownOpen(false);
    setEditingCell(null);
  };


  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const formatStatus = (status: string): 'In Progress' | 'Awaiting Decision' | 'Completed' | 'On Hold' | 'Closed' => {
    const statusMap: Record<string, 'In Progress' | 'Awaiting Decision' | 'Completed' | 'On Hold' | 'Closed'> = {
      'active': 'In Progress',
      'open': 'In Progress',
      'in-progress': 'In Progress',
      'pending': 'Awaiting Decision',
      'completed': 'Completed',
      'closed': 'Closed',
      'on_hold': 'On Hold',
      'cancelled': 'On Hold',
    };

    return statusMap[status?.toLowerCase()] || 'In Progress';
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'In Progress':
        return 'bg-green-100 text-green-800';
      case 'Awaiting Decision':
        return 'bg-yellow-100 text-yellow-800';
      case 'Completed':
        return 'bg-gray-100 text-gray-800';
      case 'Closed':
        return 'bg-gray-300 text-gray-700';
      case 'On Hold':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };


  // ============================================================================
  // EDITABLE CELL COMPONENT
  // ============================================================================

  const EditableCell = ({
    matter,
    field,
    children,
  }: {
    matter: Matter;
    field: "matterTitle" | "clientName";
    children: React.ReactNode;
  }) => {
    const isEditing = editingCell?.id === matter.id && editingCell.field === field;

    const start = () => {
      setEditingCell({ id: matter.id, field });

      if (field === "matterTitle") {
        setEditingValue(matter.matterTitle);
      } else if (field === "clientName") {
        setEditingValue(matter.clientName);
        setEditingDropdownOpen(true);
      }
    };

    if (!isEditing) {
      return (
        <td
          className="px-6 py-4 whitespace-nowrap cursor-pointer hover:bg-blue-50 transition-colors"
          onDoubleClick={start}
          title="Double-click to edit"
        >
          {children}
        </td>
      );
    }

    if (field === "matterTitle") {
      return (
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              className="border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSelectionChange(matter, field, editingValue);
                } else if (e.key === "Escape") {
                  setEditingCell(null);
                }
              }}
            />
            <button
              onClick={() => handleSelectionChange(matter, field, editingValue)}
              className="p-1 text-green-600 hover:bg-green-50 rounded"
              title="Save (Enter)"
            >
              ✓
            </button>
            <button
              onClick={() => setEditingCell(null)}
              className="p-1 text-red-600 hover:bg-red-50 rounded"
              title="Cancel (Esc)"
            >
              ✕
            </button>
          </div>
        </td>
      );
    }

    const options = field === "clientName" ? allClients : allLawyers;

    return (
      <td className="px-6 py-4 whitespace-nowrap relative cursor-pointer hover:bg-blue-50 transition-colors">
        <Popover open={editingDropdownOpen} onOpenChange={setEditingDropdownOpen}>
          <PopoverTrigger asChild>
            <div className="border px-3 py-2 rounded bg-white cursor-pointer flex justify-between items-center">
              <span className="truncate">{editingValue}</span>
              <ChevronsUpDown className="h-4 w-4 opacity-50 ml-2" />
            </div>
          </PopoverTrigger>

          <PopoverContent className="w-[260px] p-0" align="start">
            <Command>
              <CommandInput placeholder={`Search ${field === "clientName" ? "client" : "lawyer"}...`} />

              <CommandList>
                <CommandEmpty>No match found.</CommandEmpty>

                <CommandGroup>
                  {options.map((opt) => (
                    <CommandItem
                      key={opt.id}
                      value={opt.name}
                      onSelect={() => handleSelectionChange(matter, field, opt.name)}
                    >
                      {opt.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </td>
    );
  };


  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={48} className="text-blue-600 animate-spin" />
          <p className="text-gray-600">Loading matters...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3 text-center max-w-md">
          <Scale size={48} className="text-red-400" />
          <p className="text-lg font-medium text-gray-900">Error Loading Matters</p>
          <p className="text-sm text-gray-600">{error}</p>
          <button
            onClick={fetchMatters}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="px-6 py-4 flex items-center gap-4">
        <div className="flex-1 max-w-md relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search by Client name or Matter Code"
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 bg-white border border-gray-300 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
            suppressHydrationWarning
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="date-filter" className="text-sm font-medium text-gray-600">
            Filter by Date
          </label>
          <div className="relative">
            <select
              id="date-filter"
              value={dateFilter}
              onChange={handleDateFilterChange}
              className="appearance-none w-32 px-3 py-2 text-sm text-gray-800 bg-white border border-gray-300 rounded-md cursor-pointer focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
              suppressHydrationWarning
            >
              <option value="Today">Today</option>
              <option value="This Week">This Week</option>
              <option value="This Month">This Month</option>
              <option value="All Time">All Time</option>
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-xs">
              ▼
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-white border-t border-b border-gray-200">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 select-none"
                scope="col"
                onClick={() => handleSort('matterCode')}
                title={getSortLabel('matterCode')}
              >
                <div className="flex items-center gap-2">
                  Matter Code
                  {getSortIcon('matterCode')}
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 select-none"
                scope="col"
                onClick={() => handleSort('matterTitle')}
                title={getSortLabel('matterTitle')}
              >
                <div className="flex items-center gap-2">
                  Matter Title
                  {getSortIcon('matterTitle')}
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 select-none"
                scope="col"
                onClick={() => handleSort('clientName')}
                title={getSortLabel('clientName')}
              >
                <div className="flex items-center gap-2">
                  Client Name
                  {getSortIcon('clientName')}
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 select-none"
                scope="col"
                onClick={() => handleSort('createdBy')}
                title={getSortLabel('createdBy')}
              >
                <div className="flex items-center gap-2">
                  Created By
                  {getSortIcon('createdBy')}
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 select-none"
                scope="col"
                onClick={() => handleSort('assignedLawyer')}
                title={getSortLabel('assignedLawyer')}
              >
                <div className="flex items-center gap-2">
                  Assigned Lead(s)
                  {getSortIcon('assignedLawyer')}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" scope="col">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" scope="col">
                Currency
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 select-none"
                scope="col"
                onClick={() => handleSort('deadline')}
                title={getSortLabel('deadline')}
              >
                <div className="flex items-center gap-2">
                  Deadline
                  {getSortIcon('deadline')}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" scope="col">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {filteredMatters.length === 0 ? (  // ✅ CORRECT - Check filtered data!
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Scale size={48} className="text-gray-300" />
                    <p className="text-lg font-medium">No matters found</p>
                    <p className="text-sm">Try adjusting your search or filters</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedMatters.map((matter) => {
                const isClosed = (matter.rawStatus?.toLowerCase() === 'closed') || (matter.status?.toLowerCase() === 'closed');
                return (
                <tr 
                  key={matter.id} 
                  className={`transition-colors ${
                    deletingId === matter.matterId ? 'opacity-50 pointer-events-none' : ''
                  } ${
                    isClosed ? 'bg-gray-50 opacity-75' : ''
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-gray-900">{matter.matterCode || matter.matterId}</div>
                      {matter.conflictDetected && matter.conflictstatus !== "resolved" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                          Conflict Detected
                        </span>
                      )}
                      {matter.conflictDetected && matter.conflictstatus === "resolved" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                          Conflict Resolved
                        </span>
                      )}
                    </div>
                  </td>

                  <EditableCell matter={matter} field="matterTitle">
                    <div className={`text-sm font-medium ${isClosed ? 'text-gray-500' : 'text-gray-900'}`}>{matter.matterTitle}</div>
                  </EditableCell>

                  <EditableCell matter={matter} field="clientName">
                    <div className={`text-sm ${isClosed ? 'text-gray-400' : 'text-gray-600'}`}>{matter.clientName}</div>
                  </EditableCell>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm ${isClosed ? 'text-gray-400' : 'text-gray-600'}`}>{matter.createdBy}</div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm ${isClosed ? 'text-gray-400' : 'text-gray-600'}`}>{matter.assignedLawyer}</div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(matter.status)}`}>
                      {matter.status}
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <CurrencyBadge currency={(matter.currency || 'INR') as CurrencyCode} />
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">{matter.deadline}</div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewMatter(matter)}
                        className="text-blue-600 hover:text-blue-800 font-medium transition-colors disabled:opacity-50"
                        disabled={deletingId === matter.matterId}
                        suppressHydrationWarning
                        aria-label="View Matter"
                        title="View Matter"
                      >
                        <Eye className="w-6 h-6" />
                      </button>
                      <MoreActionsMenu
                        items={[
                          {
                            icon: Pencil,
                            label: 'Edit Matter',
                            onClick: () => handleEditMatter(matter),
                          },
                          {
                            icon: UserCog,
                            label: 'Reassign Lead',
                            onClick: () => handleReassignLead(matter),
                          },
                          // Close/Reopen Matter actions
                          ...(canCloseMatter(
                            { assignedLawyerId: matter.assignedLawyerId },
                            user,
                            role
                          ) && (() => {
                            const rawStatus = matter.rawStatus?.toLowerCase();
                            const formattedStatus = matter.status?.toLowerCase();
                            const isClosed = rawStatus === 'closed' || formattedStatus === 'closed';
                            const isCompleted = rawStatus === 'completed' || formattedStatus === 'completed';
                            return !isClosed && !isCompleted;
                          })() ? [{
                            icon: EyeOff,
                            label: 'Close Matter',
                            onClick: () => {
                              setSelectedMatterForClose(matter);
                              setCloseDialogOpen(true);
                            },
                            danger: true,
                          }] : []),
                          ...(canCloseMatter(
                            { assignedLawyerId: matter.assignedLawyerId },
                            user,
                            role
                          ) && (() => {
                            const rawStatus = matter.rawStatus?.toLowerCase();
                            const formattedStatus = matter.status?.toLowerCase();
                            return rawStatus === 'closed' || formattedStatus === 'closed';
                          })() ? [{
                            icon: RotateCcw,
                            label: 'Reopen Matter',
                            onClick: () => {
                              setSelectedMatterForClose(matter);
                              setReopenDialogOpen(true);
                            },
                          }] : []),
                          ...(hasPermission('mm:delete') ? [{
                            icon: Trash2,
                            label: deletingId === matter.matterId ? 'Deleting...' : 'Delete Matter',
                            onClick: () => deleteMatter(matter.matterId, matter.matterTitle),
                            danger: true,
                          }] : []),
                        ]}
                        label={`More actions for ${matter.matterTitle}`}
                      />
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
      {!loading && !error && sortedMatters.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={sortedMatters.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          showItemsPerPage={true}
          itemsPerPageOptions={[10, 25, 50, 100]}
          maxVisiblePages={5}
        />
      )}

      {selectedMatterForReassign && (
        <ReassignLeadDialog
          open={reassignDialogOpen}
          onOpenChange={setReassignDialogOpen}
          matterId={selectedMatterForReassign.matterId}
          matterTitle={selectedMatterForReassign.matterTitle}
          currentLeadId={
            selectedMatterForReassign.assignedLawyerId != null
              ? String(selectedMatterForReassign.assignedLawyerId)
              : undefined
          }
          billingRateType={selectedMatterForReassign.billingRateType}
          onSuccess={handleReassignSuccess}
        />
      )}

      {/* Close/Reopen Matter Dialogs */}
      {closeDialogOpen && selectedMatterForClose && (
        <CloseMatterDialog
          open={closeDialogOpen}
          onOpenChange={setCloseDialogOpen}
          matterId={parseInt(selectedMatterForClose.matterId)}
          matterTitle={selectedMatterForClose.matterTitle}
          onSuccess={() => {
            setCloseDialogOpen(false);
            setSelectedMatterForClose(null);
            fetchMatters();
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {reopenDialogOpen && selectedMatterForClose && (
        <ReopenMatterDialog
          open={reopenDialogOpen}
          onOpenChange={setReopenDialogOpen}
          matterId={parseInt(selectedMatterForClose.matterId)}
          matterTitle={selectedMatterForClose.matterTitle}
          onSuccess={() => {
            setReopenDialogOpen(false);
            setSelectedMatterForClose(null);
            fetchMatters();
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </>
  );
}