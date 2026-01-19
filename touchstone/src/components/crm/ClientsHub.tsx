'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, Pencil, Trash2, Building2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { ChevronsUpDown,Eye } from "lucide-react";
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

import MoreActionsMenu, { MenuItem } from '@/components/MoreActionsMenu';
import { useRouter } from 'next/navigation';
import { API_ENDPOINTS } from '@/lib/api';
import ClientDialog from '@/components/crm/ClientDialog';
import Pagination, { usePagination } from '@/components/Pagination';
import ReferredBy from '@/components/crm/ReferredBy';
import { toast } from 'react-toastify';


/**
 * Client Interface Definition
 */
interface Contact {
  id: number;
  name: string;
  email: string;
  number: string;
  designation?: string;
  isPrimary: boolean;
}

interface Client {
  id: number;
  clientCode: string;  // ADD THIS LINE
  companyName: string;
  industry: string;
  clientGroup: string;
  website: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  contactsCount: number;
  contacts: Contact[];
  status: 'Active' | 'Inactive' | 'Prospect';
  lastInteraction: string;
  createdAt: Date;
  createdBy: string;
  internalReference?: {
    id: number;
    name: string;
    email: string;
    phone?: string;
  } | null;
  externalReferenceName?: string | null;
  [key: string]: unknown;
}


interface ClientsHubProps {
  refreshTrigger?: number;
}

export default function ClientsHub({ refreshTrigger }: ClientsHubProps) {
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [industryFilter, setIndustryFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDropdownOpen, setEditingDropdownOpen] = useState(false);
  const [industryFilterOpen, setIndustryFilterOpen] = useState(false);
  const [availableIndustries, setAvailableIndustries] = useState<string[]>([]);

  


  // Sorting state
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Client | null;
    direction: 'asc' | 'desc' | null;
  }>({ key: 'createdAt', direction: 'desc' });

  const {
    currentPage,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    resetToFirstPage,
    getPaginatedData,
  } = usePagination(10);

  const [editingCell, setEditingCell] = useState<{
    clientId: number;
    field: "companyName" | "industry" | "clientGroup";
  } | null>(null);

  const [editingValue, setEditingValue] = useState("");

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchClients = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(API_ENDPOINTS.clients.list, {
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
        throw new Error('Failed to fetch clients');
      }

      const data = await response.json();

      if (data.success) {
        setClients(data.data);
        // ✅ ADD THESE 3 LINES
        if (data.industries && Array.isArray(data.industries)) {
          setAvailableIndustries(data.industries);
        }
      } else {
        setError(data.message || 'Failed to load clients');
      }
    } catch (err) {
      console.error('Fetch clients error:', err);
      setError('Failed to load clients. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients, refreshTrigger]);

  // ============================================================================
  // FILTERING AND SORTING
  // ============================================================================

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const contactNames = client.contacts?.map(c => c.name.toLowerCase()).join(' ') || '';
      const matchesSearch =
        client.companyName.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        contactNames.includes(searchQuery.toLowerCase().trim()) ||
        client.clientGroup.toLowerCase().includes(searchQuery.toLowerCase().trim());

      const matchesIndustry = industryFilter.length === 0 || industryFilter.includes(client.industry);

      const matchesStatus = statusFilter === 'All' || client.status === statusFilter;

      return matchesSearch && matchesIndustry && matchesStatus;
    });
  }, [clients, searchQuery, industryFilter, statusFilter]);

  const sortedClients = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return filteredClients;
    }

    const sorted = [...filteredClients].sort((a, b) => {
      const aValue = a[sortConfig.key!];
      const bValue = b[sortConfig.key!];

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Date sorting for lastInteraction
      if (sortConfig.key === 'lastInteraction') {
        const aDate = new Date(String(aValue));
        const bDate = new Date(String(bValue));
        
        return aDate.getTime() - bDate.getTime();
      }

      // Numeric sorting for clientCode
      if (sortConfig.key === 'clientCode') {
        const aNum = parseInt(String(aValue));
        const bNum = parseInt(String(bValue));
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return aNum - bNum;
        }
      }

      // Alphabetical sorting for text fields (companyName, industry, clientGroup, createdBy)
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();

      if (aStr < bStr) return -1;
      if (aStr > bStr) return 1;
      return 0;
    });

    return sortConfig.direction === 'desc' ? sorted.reverse() : sorted;
  }, [filteredClients, sortConfig]);

  const paginatedClients = useMemo(() => {
    return getPaginatedData(sortedClients);
  }, [sortedClients, getPaginatedData]);

  useEffect(() => {
    resetToFirstPage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, industryFilter, statusFilter]);



  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleIndustryFilterToggle = (industry: string) => {
    setIndustryFilter((prev) => {
      if (prev.includes(industry)) {
        return prev.filter((i) => i !== industry);
      } else {
        return [...prev, industry];
      }
    });
  };

  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
  };

  const handleViewClient = (client: Client) => {
    router.push(`/crm/clients/${client.id}`);
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    fetchClients();
  };

  const handleDeleteClient = useCallback(async (clientId: number) => {
    try {
      const response = await fetch(API_ENDPOINTS.clients.delete(clientId), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete client');
      }

      const data = await response.json();

      if (data.success) {
        setClients((prev) => prev.filter((c) => c.id !== clientId));
        // alert('Client deleted successfully');
        toast.success('Client deleted successfully');
      } else {
        throw new Error(data.message || 'Failed to delete client');
      }
    } catch (error) {
      console.error('Delete client error:', error);
      // alert(error instanceof Error ? error.message : 'Failed to delete client. Please try again.');
      toast.error(error instanceof Error ? error.message : 'Failed to delete client. Please try again.');
    }
  }, []);

  const handleSort = (key: keyof Client) => {
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

  const getSortIcon = (key: keyof Client) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ArrowUp className="h-4 w-4 text-blue-600" />;
    }
    return <ArrowDown className="h-4 w-4 text-blue-600" />;
  };

  const getSortLabel = (key: keyof Client) => {
    if (sortConfig.key !== key) {
      return 'Click to sort';
    }
    
    if (key === 'lastInteraction') {
      return sortConfig.direction === 'asc' 
        ? 'Sorted: Earliest to Latest' 
        : 'Sorted: Latest to Earliest';
    }
    
    return sortConfig.direction === 'asc' 
      ? 'Sorted: A to Z' 
      : 'Sorted: Z to A';
  };

  const handleSelectionChange = async (clientId: number, field: string, newValue: string) => {
    try {
      // Find the current client to get all existing data
      const currentClient = clients.find(c => c.id === clientId);
      if (!currentClient) {
        // alert("Client not found");
        toast.error("Client not found");
        return;
      }

      // Parse address from the full address string
      const addressParts = currentClient.address?.split(', ') || [];

      // Prepare the full update payload with all required fields
      const updatePayload = {
        companyName: field === 'companyName' ? newValue : currentClient.companyName,
        industry: field === 'industry' ? newValue : currentClient.industry,
        clientGroup: field === 'clientGroup' ? newValue : currentClient.clientGroup,
        website: currentClient.website || '',
        address: addressParts[0] || '',
        city: addressParts[1] || '',
        state: addressParts[2] || '',
        postalCode: addressParts[3] || '',
        country: addressParts[4] || '',
        status: currentClient.status,
      };

      const response = await fetch(API_ENDPOINTS.clients.update(clientId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Update failed");
      }

      // Update local state with the new value
      setClients(prev =>
        prev.map(c =>
          c.id === clientId ? { ...c, [field]: newValue } : c
        )
      );
    } catch (err) {
      console.error("Update error:", err);
      // alert(err instanceof Error ? err.message : "Failed to update");
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }

    setEditingDropdownOpen(false);
    setEditingCell(null);
  };

  const getClientActions = (client: Client): MenuItem[] => [
    {
      icon: Pencil,
      label: 'Edit Client',
      onClick: () => handleEditClient(client),
      active: false,
    },
    {
      icon: Trash2,
      label: 'Remove Client',
      onClick: () => {
        const confirmed = confirm(
          `Are you sure you want to remove ${client.companyName}? This will also remove all associated contacts and matters.`
        );
        if (confirmed) {
          handleDeleteClient(client.id);
        }
      },
      danger: true,
    },
  ];

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800';
      case 'Inactive':
        return 'bg-red-100 text-red-800';
      case 'Prospect':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // ============================================================================
  // EDITABLE CELL COMPONENT
  // ============================================================================

  const EditableCell = ({
    client,
    field,
    children,
  }: {
    client: Client;
    field: "companyName" | "industry" | "clientGroup";
    children: React.ReactNode;
  }) => {
    const isEditing = editingCell?.clientId === client.id && editingCell.field === field;

    const start = () => {
      setEditingCell({ clientId: client.id, field });

      if (field === "companyName") {
        setEditingValue(client.companyName);
      } else {
        setEditingValue(client[field]);
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

    if (field === "companyName") {
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
                  handleSelectionChange(client.id, field, editingValue);
                } else if (e.key === "Escape") {
                  setEditingCell(null);
                }
              }}
            />
            <button
              onClick={() => handleSelectionChange(client.id, field, editingValue)}
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

    const options =
      field === "industry"
        ? availableIndustries
        : ["Group A", "Group B", "Group C", "VIP", "SMB", "Enterprise"];

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
              <CommandInput placeholder={`Search ${field}...`} />

              <CommandList>
                <CommandEmpty>No match found.</CommandEmpty>

                <CommandGroup>
                  {options.map((opt) => (
                    <CommandItem
                      key={opt}
                      value={opt}
                      onSelect={() => handleSelectionChange(client.id, field, opt)}
                    >
                      {opt}
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

  return (
    <>
      {/* FILTERS BAR */}
      <div className="px-6 py-4 flex items-center gap-4">
        {/* SEARCH INPUT */}
        <div className="flex-1 max-w-md relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search by company name, contact, or group"
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 bg-white border border-gray-300 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
            suppressHydrationWarning
          />
        </div>

        {/* INDUSTRY FILTER */}
        <div className="flex items-center gap-2">
          <label htmlFor="industry-filter" className="text-sm font-medium text-gray-600">
            Industry:
          </label>
          <Popover open={industryFilterOpen} onOpenChange={setIndustryFilterOpen}>
            <PopoverTrigger asChild>
              <button
                id="industry-filter"
                className="w-52 px-3 py-2 text-sm text-left bg-white border border-gray-300 rounded-md cursor-pointer hover:border-blue-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none flex justify-between items-center"
              >
                <span className="truncate text-gray-800">
                  {industryFilter.length === 0
                    ? 'All'
                    : industryFilter.length === 1
                    ? industryFilter[0]
                    : `${industryFilter.length} selected`}
                </span>
                <ChevronsUpDown className="h-4 w-4 opacity-50 ml-2 flex-shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[260px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search industries..." />
                <CommandList>
                  <CommandEmpty>No industry found.</CommandEmpty>
                  <CommandGroup>
                    {availableIndustries.map((industry) => (
                      <CommandItem
                        key={industry}
                        value={industry}
                        onSelect={() => handleIndustryFilterToggle(industry)}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                            industryFilter.includes(industry)
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-gray-300'
                          }`}>
                            {industryFilter.includes(industry) && (
                              <span className="text-white text-xs">✓</span>
                            )}
                          </div>
                          <span>{industry}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
                {industryFilter.length > 0 && (
                  <div className="p-2 border-t">
                    <button
                      onClick={() => setIndustryFilter([])}
                      className="w-full px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* STATUS FILTER */}
        {/* <div className="flex items-center gap-2">
          <label htmlFor="status-filter" className="text-sm font-medium text-gray-600">
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
              <option value="Prospect">Prospect</option>
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
              ▼
            </span>
          </div>
        </div> */}
      </div>

      {/* CLIENTS TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* TABLE HEADER */}
          <thead className="bg-white border-t border-b border-gray-200">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 select-none" 
                scope="col"
                onClick={() => handleSort('companyName')}
                title={getSortLabel('companyName')}
              >
                <div className="flex items-center gap-2">
                  Company Name
                  {getSortIcon('companyName')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 select-none" 
                scope="col"
                onClick={() => handleSort('clientCode')}
                title={getSortLabel('clientCode')}
              >
                <div className="flex items-center gap-2">
                  Client Code
                  {getSortIcon('clientCode')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 select-none" 
                scope="col"
                onClick={() => handleSort('industry')}
                title={getSortLabel('industry')}
              >
                <div className="flex items-center gap-2">
                  Industry
                  {getSortIcon('industry')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 select-none" 
                scope="col"
                onClick={() => handleSort('clientGroup')}
                title={getSortLabel('clientGroup')}
              >
                <div className="flex items-center gap-2">
                  Client Group
                  {getSortIcon('clientGroup')}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" scope="col">
                Contacts
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 select-none" 
                scope="col"
                onClick={() => handleSort('createdBy')}
                title={getSortLabel('createdBy')}
              >
                <div className="flex items-center gap-2">
                  Referred By
                  {getSortIcon('createdBy')}
                </div>
              </th>
              {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" scope="col">
                Status
              </th> */}
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 select-none" 
                scope="col"
                onClick={() => handleSort('lastInteraction')}
                title={getSortLabel('lastInteraction')}
              >
                <div className="flex items-center gap-2">
                  Last Interaction
                  {getSortIcon('lastInteraction')}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" scope="col">
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
                    <p className="text-lg font-medium">Loading clients...</p>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-red-500">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-lg font-medium">Error loading clients</p>
                    <p className="text-sm">{error}</p>
                    <button
                      onClick={fetchClients}
                      className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Retry
                    </button>
                  </div>
                </td>
              </tr>
            ) : sortedClients.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Building2 size={48} className="text-gray-300" />
                    <p className="text-lg font-medium">No clients found</p>
                    <p className="text-sm">Try adjusting your search or filters</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedClients.map((client) => (
                <tr key={client.id} className="transition-colors">
                  <EditableCell client={client} field="companyName">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Building2 size={20} className="text-blue-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{client.companyName}</div>
                        <div className="text-xs text-gray-500">{client.website}</div>
                      </div>
                    </div>
                  </EditableCell>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{client.clientCode}</div>
                  </td>

                  <EditableCell client={client} field="industry">
                    <div className="text-sm text-gray-600">{client.industry}</div>
                  </EditableCell>

                  <EditableCell client={client} field="clientGroup">
                    <div className="text-sm text-gray-600">{client.clientGroup}</div>
                  </EditableCell>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {client.contactsCount} {client.contactsCount === 1 ? 'Contact' : 'Contacts'}
                    </div>
                    {client.contacts.find(c => c.isPrimary) && (
                      <div className="text-xs text-gray-500">
                        Primary: {client.contacts.find(c => c.isPrimary)?.name}
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <ReferredBy
                      internalReference={client.internalReference}
                      externalReferenceName={client.externalReferenceName}
                    />
                  </td>

                  {/* <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(client.status)}`}>
                      {client.status}
                    </span>
                  </td> */}

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">{client.lastInteraction}</div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewClient(client)}
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
                        suppressHydrationWarning
                      >
                        <Eye className="w-6 h-6" />
                      </button>
                      <MoreActionsMenu items={getClientActions(client)} label={`More actions for ${client.companyName}`} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {!isLoading && !error && sortedClients.length > 0 && (
          <div className="px-6 py-4">
            <Pagination
              currentPage={currentPage}
              totalItems={sortedClients.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
              itemsPerPageOptions={[10, 25, 50, 100]}
            />
          </div>
        )}
      </div>

      {/* EDIT CLIENT DIALOG */}
      {editingClient && (
        <ClientDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSuccess={handleEditSuccess}
          mode="edit"
          clientData={{
            ...editingClient,
            internalReference: editingClient.internalReference ?? undefined
          } as Parameters<typeof ClientDialog>[0]['clientData']}
          industries={availableIndustries}
        />
      )}
    </>
  );
}