'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, Plus, Pencil, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import MoreActionsMenu, { MenuItem } from '@/components/MoreActionsMenu';
import VendorDialog from './VendorDialog';
import Pagination, { usePagination } from '@/components/Pagination';
import { toast } from 'react-toastify';


interface Vendor {
  vendor_id: number;
  vendor_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  gstin: string | null;
  pan: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  payment_terms: string | null;
  active_status: boolean;
  notes: string | null;
  created_at: string;
}

interface VendorsHubProps {
  refreshTrigger: number;
}

export default function VendorsHub({ refreshTrigger }: VendorsHubProps) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState<{
    key: 'vendor_name' | 'pan' | 'bank_name' | 'notes' | null;
    direction: 'asc' | 'desc' | null;
  }>({ key: null, direction: null });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  const {
    currentPage,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    resetToFirstPage,
    getPaginatedData,
  } = usePagination(10); // default 10 per page


  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchVendors = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/vendors`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch vendors');
      }

      const data = await response.json();
      setVendors(data.data || []);
    } catch (err) {
      console.error('Fetch vendors error:', err);
      setError('Failed to load vendors. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors, refreshTrigger]);

  // ============================================================================
  // FILTERING
  // ============================================================================

  const filteredVendors = useMemo(() => {
    return vendors.filter((vendor) => {
      const matchesSearch =
        vendor.vendor_name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (vendor.contact_name?.toLowerCase().includes(searchQuery.toLowerCase().trim()) || false) ||
        (vendor.email?.toLowerCase().includes(searchQuery.toLowerCase().trim()) || false);

      const matchesStatus = 
        statusFilter === 'All' ||
        (statusFilter === 'Active' && vendor.active_status) ||
        (statusFilter === 'Inactive' && !vendor.active_status);

      return matchesSearch && matchesStatus;
    });
  }, [vendors, searchQuery, statusFilter]);

  // ============================================================================
  // SORTING
  // ============================================================================
  const sortedVendors = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return filteredVendors;
    }

    const sorted = [...filteredVendors].sort((a, b) => {
      if (sortConfig.key === 'vendor_name') {
        return a.vendor_name.localeCompare(b.vendor_name);
      } else if (sortConfig.key === 'pan') {
        const aPan = a.pan || '';
        const bPan = b.pan || '';
        return aPan.localeCompare(bPan);
      } else if (sortConfig.key === 'bank_name') {
        const aBank = a.bank_name || '';
        const bBank = b.bank_name || '';
        return aBank.localeCompare(bBank);
      } else if (sortConfig.key === 'notes') {
        const aNotes = a.notes || '';
        const bNotes = b.notes || '';
        return aNotes.localeCompare(bNotes);
      }
      return 0;
    });

    return sortConfig.direction === 'desc' ? sorted.reverse() : sorted;
  }, [filteredVendors, sortConfig]);

  const paginatedVendors = useMemo(() => {
    return getPaginatedData(sortedVendors);
  }, [sortedVendors, currentPage, itemsPerPage, getPaginatedData]);

  useEffect(() => {
    resetToFirstPage();
  }, [searchQuery, statusFilter, resetToFirstPage]);

  // ============================================================================
  // SORTING HANDLERS
  // ============================================================================
  const handleSort = (key: 'vendor_name' | 'pan' | 'bank_name' | 'notes') => {
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
    
    return sortConfig.direction === 'asc' 
      ? 'Sorted: A to Z' 
      : 'Sorted: Z to A';
  };

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleAddNew = () => {
    setEditingVendor(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setIsDialogOpen(true);
  };

  const handleDelete = useCallback(async (vendorId: number) => {
    if (!confirm('Are you sure you want to delete this vendor?')) {
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/vendors/${vendorId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete vendor');
      }

      fetchVendors();
    } catch (error) {
      console.error('Delete vendor error:', error);
      // alert('Failed to delete vendor');
      toast.error('Failed to delete vendor');
    }
  }, [fetchVendors]);

  const getVendorActions = (vendor: Vendor): MenuItem[] => [
    {
      icon: Pencil,
      label: 'Edit Vendor',
      onClick: () => handleEdit(vendor),
      active: false,
    },
    {
      icon: Trash2,
      label: 'Delete Vendor',
      onClick: () => handleDelete(vendor.vendor_id),
      danger: true,
    },
  ];

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      {/* DIALOG */}
      <VendorDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={fetchVendors}
        mode={editingVendor ? 'edit' : 'create'}
        vendorId={editingVendor?.vendor_id}
        initialData={editingVendor}
      />

      <div>
        {/* HEADER WITH ADD BUTTON */}
        <div className="px-6 pt-4 flex items-center justify-between">
          <h2 className="text-xl font-medium text-gray-900">Vendors</h2>
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600  text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-colors rounded-lg"
          >
            <Plus size={20} />
            <span className="text-sm font-medium">Add Vendor</span>
          </button>
        </div>

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
              placeholder="Search by name, contact, or email"
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 bg-white border border-gray-300 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
              suppressHydrationWarning
            />
          </div>

          {/* STATUS FILTER */}
          <div className="flex items-center gap-2">
            <label htmlFor="status-filter" className="text-sm font-medium text-gray-600">
              Status:
            </label>
            <div className="relative">
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none w-32 px-3 py-2 text-sm text-gray-800 bg-white border border-gray-300 rounded-md cursor-pointer focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                suppressHydrationWarning
              >
                <option value="All">All</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                ▼
              </span>
            </div>
          </div>
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
                  onClick={() => handleSort('vendor_name')}
                  title={getSortLabel('vendor_name')}
                >
                  <div className="flex items-center gap-2">
                    Vendor Name
                    {getSortIcon('vendor_name')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-base font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none" 
                  scope="col"
                  onClick={() => handleSort('pan')}
                  title={getSortLabel('pan')}
                >
                  <div className="flex items-center gap-2">
                    Pan Number
                    {getSortIcon('pan')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-base font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none" 
                  scope="col"
                  onClick={() => handleSort('bank_name')}
                  title={getSortLabel('bank_name')}
                >
                  <div className="flex items-center gap-2">
                    Bank Details
                    {getSortIcon('bank_name')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-base font-medium text-gray-500" scope="col">Payment Terms</th>
                <th 
                  className="px-6 py-3 text-left text-base font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none" 
                  scope="col"
                  onClick={() => handleSort('notes')}
                  title={getSortLabel('notes')}
                >
                  <div className="flex items-center gap-2">
                    Notes
                    {getSortIcon('notes')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-base font-medium text-gray-500" scope="col">Status</th>
                <th className="px-6 py-3 text-left text-base font-medium text-gray-500" scope="col">Actions</th>
              </tr>
            </thead>

            {/* TABLE BODY */}
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                      <p className="text-lg font-medium">Loading vendors...</p>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-red-500">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-lg font-medium">Error loading vendors</p>
                      <p className="text-sm">{error}</p>
                      <button
                        onClick={fetchVendors}
                        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : sortedVendors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-lg font-medium">No vendors found</p>
                      <p className="text-sm">Try adjusting your search or filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedVendors.map((vendor) => (
                  <tr key={vendor.vendor_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-base font-medium text-gray-900">{vendor.vendor_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base text-gray-600">
                      {vendor.pan || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base text-gray-600">
                      {vendor.bank_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base text-gray-600">
                      {vendor.payment_terms || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base text-gray-600">
                      {vendor.notes || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                        vendor.active_status 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {vendor.active_status ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(vendor)}
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
                        >
                          View Details
                        </button>
                        <MoreActionsMenu items={getVendorActions(vendor)} label={`More actions for ${vendor.vendor_name}`} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {!isLoading && !error && sortedVendors.length > 0 && (
            <div className="px-6 py-4">
              <Pagination
                currentPage={currentPage}
                totalItems={sortedVendors.length}
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