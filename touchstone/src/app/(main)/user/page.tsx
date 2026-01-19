'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, Plus, Pencil, Shield, UserX, Mail, ChevronsUpDown, ArrowUpDown, ArrowUp, ArrowDown, X, Check } from 'lucide-react';
import MoreActionsMenu, { MenuItem } from '@/components/MoreActionsMenu';
import UserDialog from '@/components/user/UserDialog';
import InviteUserDialog from '@/components/user/InviteUserDialog';
import PendingInvitations from '@/components/user/PendingInvitations';
import UserPermissionsDialog from '@/components/user/UserPermissionsDialog';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useRouter } from 'next/navigation';
import { API_ENDPOINTS } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Pagination, { usePagination } from '@/components/Pagination';
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { formatRoleDisplay } from '@/utils/roleDisplay';
import { toast } from 'react-toastify';

/**
 * User Interface Definition
 */
interface User {
  id: number;
  name: string;
  role: string;
  roleId: number;
  email: string;
  phone: string;
  practiceArea?: string;
  reportingManager?: {
    user_id: number;
    name: string;
  };
  lastLogin: Date | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  gender?: string;
  location?: string;
  userType?: string;
  userCode?: string;
  dateOfJoining?: string;
}

interface Invitation {
  invitation_id: number;
  email: string;
  roleName: string;
  inviterName: string;
  status: string;
  expires_at: string;
  created_at: string;
  [key: string]: unknown;
}

interface Role {
  id: number;
  name: string;
}

export default function UserManagementPage() {
  const router = useRouter();
  const { role } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [activeTab, setActiveTab] = useState<'users' | 'invitations'>('users');
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isInviteUserDialogOpen, setIsInviteUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [permissionsUser, setPermissionsUser] = useState<User | null>(null);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState("");
  const [editingCell, setEditingCell] = useState<{
    userId: number;
    field: 'name' | 'email' | 'role';
  } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [sortConfig, setSortConfig] = useState<{
    key: 'id'| 'name' | 'email' | 'location' | 'dateOfJoining' | null;
    direction: 'asc' | 'desc' | null;
  }>({ key: null, direction: null });
  
  // Multi-select popover states
  const [roleFilterOpen, setRoleFilterOpen] = useState(false);

  const statusOptions = [
    { value: 'All', label: 'All' },
    { value: 'Active', label: 'Active' },
    { value: 'Inactive', label: 'Inactive' }
  ];

  const fetchRoles = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.users.roles, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const normalized = data.data.map((role: any) => ({
            id: role.role_id,
            name: role.name,
          }));
          setRoles(normalized);
        }
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    }
  };

  const {
    currentPage,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    resetToFirstPage,
    getPaginatedData,
  } = usePagination(10);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(API_ENDPOINTS.users.list, {
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
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      
      if (data.success) {
        setUsers(data.data);
      } else {
        setError(data.message || 'Failed to load users');
      }
    } catch (err) {
      console.error('Fetch users error:', err);
      setError('Failed to load users. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const fetchInvitations = useCallback(async () => {
    try {
      const response = await fetch(API_ENDPOINTS.invitations.list, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setInvitations(data.data);
        }
      }
    } catch (err) {
      console.error('Fetch invitations error:', err);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchInvitations();
    fetchRoles();
  }, [fetchUsers, fetchInvitations]);

  // ============================================================================
  // SORTING
  // ============================================================================

  const handleSort = (key: 'id' | 'name' | 'email' | 'location' | 'dateOfJoining') => {
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
    
    if (key === 'dateOfJoining') {
      return sortConfig.direction === 'asc' 
        ? 'Sorted: Earliest to Latest' 
        : 'Sorted: Latest to Earliest';
    }
    
    if (key === 'name' || key === 'email' || key === 'location') {
      return sortConfig.direction === 'asc' 
        ? 'Sorted: A to Z' 
        : 'Sorted: Z to A';
    }
    
    return 'Click to sort';
  };

  // ============================================================================
  // MULTI-SELECT FILTER HANDLERS
  // ============================================================================

  const toggleRole = (roleName: string) => {
    setSelectedRoles(prev => 
      prev.includes(roleName)
        ? prev.filter(r => r !== roleName)
        : [...prev, roleName]
    );
  };

  const clearRoleFilters = () => {
    setSelectedRoles([]);
  };

  const clearAllFilters = () => {
    setSelectedRoles([]);
    setStatusFilter('All');
    setSearchQuery('');
  };

  // ============================================================================
  // FILTERING
  // ============================================================================

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch = user.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase().trim());
      
      // If no roles selected, show all. Otherwise, match any selected role
      const matchesRole = selectedRoles.length === 0 || 
        selectedRoles.some(selectedRole => 
          user.role?.toLowerCase() === selectedRole.toLowerCase()
        );
      
      // Single status filter logic
      const matchesStatus = 
        statusFilter === 'All' || 
        (statusFilter === 'Active' && user.active) ||
        (statusFilter === 'Inactive' && !user.active);
      
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, selectedRoles, statusFilter]);

  const sortedUsers = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return filteredUsers;
    }

    const sorted = [...filteredUsers].sort((a, b) => {
      if (sortConfig.key === 'id') {
        return a.id - b.id;
      }

      if (sortConfig.key === 'name' || sortConfig.key === 'email' || sortConfig.key === 'location') {
        const aValue = (a[sortConfig.key] || '').toLowerCase();
        const bValue = (b[sortConfig.key] || '').toLowerCase();
        return aValue.localeCompare(bValue);
      } else if (sortConfig.key === 'dateOfJoining') {
        const aDate = a.dateOfJoining ? new Date(a.dateOfJoining).getTime() : 0;
        const bDate = b.dateOfJoining ? new Date(b.dateOfJoining).getTime() : 0;
        return aDate - bDate;
      }
      return 0;
    });

    return sortConfig.direction === 'desc' ? sorted.reverse() : sorted;
  }, [filteredUsers, sortConfig]);

  const paginatedUsers = useMemo(() => {
    return getPaginatedData(sortedUsers);
  }, [sortedUsers, currentPage, itemsPerPage, getPaginatedData]);

  useEffect(() => {
    resetToFirstPage();
  }, [searchQuery, statusFilter, selectedRoles, resetToFirstPage]);

  // Count active filters (only role filters count)
  const activeFilterCount = selectedRoles.length;

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
  };

  const handleAddNewUser = () => {
    setIsAddUserDialogOpen(true);
  };

  const handleInviteUser = () => {
    setIsInviteUserDialogOpen(true);
  };

  const handleUserAdded = () => {
    fetchUsers();
  };

  const handleInvitationSent = () => {
    fetchInvitations();
  };

  const handleRefreshInvitations = () => {
    fetchInvitations();
  };

  const handleViewProfile = (user: User) => {
    router.push(`/user/${user.id}`);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    fetchUsers();
  };

  const handleEditPermissions = (user: User) => {
    setPermissionsUser(user);
    setIsPermissionsDialogOpen(true);
  };

  const handlePermissionsSuccess = () => {
    fetchUsers();
  };

  const handleToggleUserStatus = useCallback(async (user: User) => {
    const newStatus = !user.active;
    const action = newStatus ? 'activate' : 'deactivate';
    
    const confirmed = confirm(`Are you sure you want to ${action} ${user.name}?`);
    if (!confirmed) return;

    try {
      const response = await fetch(API_ENDPOINTS.users.update(user.id), {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: user.name,
          email: user.email,
          phone: user.phone,
          role_id: user.roleId,
          practice_area: user.practiceArea,
          reporting_manager_id: user.reportingManager?.user_id,
          active_status: newStatus,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // alert(`User ${action}d successfully!`);
        toast.success(`User ${action}d successfully!`);
        fetchUsers();
      } else {
        // alert(data.message || `Failed to ${action} user`);
        toast.error(data.message || `Failed to ${action} user`);
      }
    } catch (error) {
      console.error(`${action} user error:`, error);
      // alert(`Failed to ${action} user. Please try again.`);
      toast.error(`Failed to ${action} user. Please try again.`);
    }
  }, [fetchUsers]);

  const startEditing = (user: User, field: 'name' | 'email' | 'role') => {
    setEditingCell({ userId: user.id, field });
    
    if (field === "role") {
      setEditingRoleId(user.roleId?.toString() || "");
      setRoleDropdownOpen(true);
    } else if (field === 'name') {
      setEditValue(user.name);
    } else if (field === 'email') {
      setEditValue(user.email);
    }
  };

  const handleCellSave = async (user: User) => {
    if (!editingCell) return;
    
    setIsSaving(true);
    try {
      const updateData: any = {
        name: user.name,
        email: user.email,
        phone: user.phone,
        role_id: user.roleId,
        practice_area: user.practiceArea,
        reporting_manager_id: user.reportingManager?.user_id,
        active_status: user.active,
      };

      if (editingCell.field === 'name') {
        updateData.name = editValue.trim();
      } else if (editingCell.field === 'email') {
        updateData.email = editValue.trim();
      }

      const response = await fetch(API_ENDPOINTS.users.update(user.id), {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (data.success) {
        setEditingCell(null);
        setEditValue('');
        fetchUsers();
      } else {
        // alert(data.message || 'Failed to update user');
        toast.error(data.message || 'Failed to update user');
      }
    } catch (error) {
      console.error('Update user error:', error);
      // alert('Failed to update user. Please try again.');
      toast.error('Failed to update user. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleRoleSelection = async (user: User, newRoleId: string) => {
    try {
      const response = await fetch(API_ENDPOINTS.users.update(user.id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: user.name,
          email: user.email,
          phone: user.phone,
          role_id: parseInt(newRoleId),
          practice_area: user.practiceArea,
          reporting_manager_id: user.reportingManager?.user_id,
          active_status: user.active,
        }),
      });

      if (!response.ok) throw new Error("Update failed");

      fetchUsers();
    } catch (err) {
      // alert("Failed to update role");
      toast.error("Failed to update role");
    }

    setTimeout(() => {
      setRoleDropdownOpen(false);
      setEditingCell(null);
    }, 150);
  };

  // ============================================================================
  // MORE ACTIONS MENU CONFIGURATION
  // ============================================================================
  
  const getUserActions = (user: User): MenuItem[] => {
    const actions: MenuItem[] = [
      {
        icon: Pencil,
        label: 'Edit Profile',
        onClick: () => handleEditUser(user),
        active: false,
      },
    ];

    if (role?.name === 'superadmin') {
      actions.push({
        icon: Shield,
        label: 'Edit Permissions',
        onClick: () => handleEditPermissions(user),
        active: false,
      });
    }

    actions.push({
      icon: UserX,
      label: user.active ? 'Deactivate User' : 'Activate User',
      onClick: () => handleToggleUserStatus(user),
      danger: true,
    });

    return actions;
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  
  const formatLastLogin = (lastLogin: Date | null): string => {
    if (!lastLogin) return 'Never';
    
    const date = new Date(lastLogin);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
  };

  const isStaleLogin = (lastLogin: Date | null): boolean => {
    if (!lastLogin) return true;
    
    const date = new Date(lastLogin);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
    
    return diffDays > 30;
  };

  const formatLocation = (location: string | undefined): string => {
    if (!location) return '-';
    
    if (location.toLowerCase() === 'delhi (lt)') {
      return 'Delhi (Lt)';
    }
    
    // Capitalize first letter for other locations
    return location.charAt(0).toUpperCase() + location.slice(1);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  const InlineEditInput = ({ 
    value, 
    onChange, 
    onSave, 
    onCancel,
    type = 'text' 
  }: { 
    value: string; 
    onChange: (value: string) => void;
    onSave: () => void;
    onCancel: () => void;
    type?: string;
  }) => (
    <div className="flex items-center gap-1">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-200"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <button
        onClick={onSave}
        disabled={isSaving}
        className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
        title="Save"
      >
        ✓
      </button>
      <button
        onClick={onCancel}
        disabled={isSaving}
        className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
        title="Cancel"
      >
        ✕
      </button>
    </div>
  );

  return (
    <ProtectedRoute requiredRoute="/user">
      <UserDialog
        open={isAddUserDialogOpen}
        onOpenChange={setIsAddUserDialogOpen}
        onSuccess={handleUserAdded}
        mode="create"
      />

      <InviteUserDialog
        open={isInviteUserDialogOpen}
        onOpenChange={setIsInviteUserDialogOpen}
        onSuccess={handleInvitationSent}
      />

      {editingUser && (
        <UserDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSuccess={handleEditSuccess}
          mode="edit"
          userData={editingUser}
        />
      )}

      <UserPermissionsDialog
        open={isPermissionsDialogOpen}
        onOpenChange={setIsPermissionsDialogOpen}
        user={permissionsUser}
        onSuccess={handlePermissionsSuccess}
      />
      
      <div className="p-6">
        
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('users')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'users'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Active Users ({users.length})
              </button>
              <button
                onClick={() => setActiveTab('invitations')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'invitations'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Pending Invitations ({invitations.filter(i => i.status === 'pending').length})
              </button>
            </nav>
          </div>
        </div>

        {activeTab === 'users' && (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                
                {/* Search Input */}
                <div className="flex-1 max-w-md relative">
                  <Search
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    placeholder="Search by name"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-800 placeholder-gray-600 bg-white border border-gray-300 rounded-lg shadow-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-200 hover:border-blue-400 focus:outline-none"
                    aria-label="Search users by name"
                    suppressHydrationWarning
                  />
                </div>

                {/* Multi-select Role Filter */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700 font-medium">
                    Roles:
                  </label>
                  <Popover open={roleFilterOpen} onOpenChange={setRoleFilterOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-[200px] justify-between"
                      >
                        {selectedRoles.length === 0 
                          ? "All Roles" 
                          : `${selectedRoles.length} selected`}
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[250px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search roles..." />
                        <CommandList>
                          <CommandEmpty>No roles found.</CommandEmpty>
                          <CommandGroup>
                            {roles.map((role) => (
                              <CommandItem
                                key={role.id}
                                value={role.name}
                                onSelect={() => toggleRole(role.name)}
                              >
                                <div className="flex items-center gap-2 w-full">
                                  <div className={`h-4 w-4 border rounded flex items-center justify-center ${
                                    selectedRoles.includes(role.name) 
                                      ? 'bg-blue-600 border-blue-600' 
                                      : 'border-gray-300'
                                  }`}>
                                    {selectedRoles.includes(role.name) && (
                                      <Check className="h-3 w-3 text-white" />
                                    )}
                                  </div>
                                  <span className="flex-1">{formatRoleDisplay(role.name)}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                          {selectedRoles.length > 0 && (
                            <>
                              <div className="border-t my-1" />
                              <div className="p-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={clearRoleFilters}
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

                {/* Single Status Filter */}
                <div className="flex items-center gap-2">
                  <label htmlFor="status-filter" className="text-sm text-gray-700 font-medium">
                    Status:
                  </label>
                  <div className="relative">
                    <select
                      id="status-filter"
                      value={statusFilter}
                      onChange={handleStatusFilterChange}
                      className="appearance-none w-32 px-3 py-2 text-sm text-gray-800 bg-white border border-gray-300 rounded-lg shadow-sm cursor-pointer transition-all hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                      aria-label="Filter by status"
                      suppressHydrationWarning
                    >
                      {statusOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                      ▼
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button 
                    onClick={handleInviteUser}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm hover:shadow-md"
                    aria-label="Invite new user"
                    suppressHydrationWarning
                  >
                    <Mail size={18} aria-hidden="true" />
                    <span className="text-sm font-medium">Invite User</span>
                  </button>
                  <button 
                    onClick={handleAddNewUser}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600  text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-colors shadow-sm hover:shadow-md"
                    aria-label="Add new user"
                    suppressHydrationWarning
                  >
                    <Plus size={18} aria-hidden="true" />
                    <span className="text-sm font-medium">Add User</span>
                  </button>
                </div>
              </div>

              {/* Active Filters Display */}
              {activeFilterCount > 0 && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                  <span className="text-sm text-gray-600 font-medium">Active Filters:</span>
                  
                  {selectedRoles.map((role) => (
                    <Badge 
                      key={role} 
                      variant="secondary" 
                      className="gap-1 pl-2 pr-1"
                    >
                      {formatRoleDisplay(role)}
                      <button
                        onClick={() => toggleRole(role)}
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
              )}
            </div>
          </>
        )}

        {activeTab === 'users' && (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
              
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none" 
                    scope="col"
                    onClick={() => handleSort('name')}
                    title={getSortLabel('name')}
                  >
                    <div className="flex items-center gap-2">
                      Name
                      {getSortIcon('name')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    scope="col"
                    onClick={() => handleSort('id')}
                    title="Click to sort"
                  >
                    <div className="flex items-center gap-2">
                      User ID
                      {getSortIcon('id')}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" scope="col">
                    Role
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none" 
                    scope="col"
                    onClick={() => handleSort('email')}
                    title={getSortLabel('email')}
                  >
                    <div className="flex items-center gap-2">
                      Email Address
                      {getSortIcon('email')}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" scope="col">
                    User Code
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none" 
                    scope="col"
                    onClick={() => handleSort('location')}
                    title={getSortLabel('location')}
                  >
                    <div className="flex items-center gap-2">
                      Location
                      {getSortIcon('location')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none" 
                    scope="col"
                    onClick={() => handleSort('dateOfJoining')}
                    title={getSortLabel('dateOfJoining')}
                  >
                    <div className="flex items-center gap-2">
                      Date of Joining
                      {getSortIcon('dateOfJoining')}
                    </div>
                  </th>
                  <th className="px-5 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide" scope="col">
                    Last Login
                  </th>
                  <th className="px-5 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide" scope="col">
                    Status
                  </th>
                  <th className="px-5 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide" scope="col">
                    Actions
                  </th>
                </tr>
              </thead>
              
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        <p className="text-lg font-medium">Loading users...</p>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-red-500">
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-lg font-medium">Error loading users</p>
                        <p className="text-sm">{error}</p>
                        <button
                          onClick={fetchUsers}
                          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Search size={48} className="text-gray-300" aria-hidden="true" />
                        <p className="text-lg font-medium">No users found</p>
                        <p className="text-sm">Try adjusting your search or filters</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td 
                        className="px-6 py-4 whitespace-nowrap cursor-pointer hover:bg-blue-50"
                        onDoubleClick={() => startEditing(user, 'name')}                        
                        title="Double-click to edit"
                      >
                        {editingCell?.userId === user.id && editingCell.field === 'name' ? (
                          <InlineEditInput
                            value={editValue}
                            onChange={setEditValue}
                            onSave={() => handleCellSave(user)}
                            onCancel={handleCellCancel}
                          />
                        ) : (
                          <div className="text-sm font-medium text-gray-900">
                            {user.name}
                          </div>
                        )}
                      </td>
                      
                      <td className="px-5 py-2.5 whitespace-nowrap text-sm">
                        <div className="text-sm text-gray-900 font-mono">{user.id}</div>
                      </td>
                      
                      <td 
                        className="px-6 py-4 whitespace-nowrap cursor-pointer hover:bg-blue-50"
                        onDoubleClick={() => startEditing(user, 'role')}
                        title="Double-click to edit"
                      >
                        {editingCell?.userId === user.id && editingCell.field === 'role' ? (
                          <div className="flex items-center gap-2 w-full relative">
                            <Popover open={roleDropdownOpen} onOpenChange={setRoleDropdownOpen}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  onClick={(e) => e.stopPropagation()}
                                  onDoubleClick={(e) => e.stopPropagation()}
                                  className="w-full justify-between bg-white border border-gray-300"
                                >
                                  {roles.find(r => r.id.toString() === editingRoleId)?.name || "Select role"}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                                </Button>
                              </PopoverTrigger>

                              <PopoverContent className="w-[300px] p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Search roles..." />
                                  <CommandList>
                                    <CommandEmpty>No roles found.</CommandEmpty>

                                    <CommandGroup>
                                      {roles.map(role => (
                                        <CommandItem
                                          key={role.id}
                                          value={role.name}
                                          onSelect={() => {
                                            setEditingRoleId(role.id.toString());
                                            handleRoleSelection(user, role.id.toString());
                                          }}
                                        >
                                          <div className="flex flex-col">
                                            <span>{formatRoleDisplay(role.name)}</span>
                                          </div>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-600">
                            {formatRoleDisplay(user.role)}
                          </div>
                        )}
                      </td>
                      
                      <td 
                        className="px-6 py-4 whitespace-nowrap cursor-pointer hover:bg-blue-50"
                        onDoubleClick={() => startEditing(user, 'email')}                        
                        title="Double-click to edit"
                      >
                        {editingCell?.userId === user.id && editingCell.field === 'email' ? (
                          <InlineEditInput
                            value={editValue}
                            onChange={setEditValue}
                            onSave={() => handleCellSave(user)}
                            onCancel={handleCellCancel}
                            type="email"
                          />
                        ) : (
                          <a 
                            href={`mailto:${user.email}`}
                            className="text-sm text-gray-600 hover:text-blue-600 transition-colors"
                          >
                            {user.email}
                          </a>
                        )}
                      </td>

                      <td className="px-5 py-2.5 whitespace-nowrap text-sm">
                        <div className="text-sm font-medium text-gray-900">
                          {user.userCode || '-'}
                        </div>
                      </td>

                      <td className="px-5 py-2.5 whitespace-nowrap text-sm">
                        <div className="text-sm text-gray-600">
                          {formatLocation(user.location)}
                        </div>
                      </td>

                      <td className="px-5 py-2.5 whitespace-nowrap text-sm">
                        <div className="text-sm text-gray-600">
                          {user.dateOfJoining 
                            ? new Date(user.dateOfJoining).toLocaleDateString('en-IN', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: '2-digit' 
                              })
                            : '-'
                          }
                        </div>
                      </td>
                      
                      <td className="px-5 py-2.5 whitespace-nowrap text-sm">
                        <div 
                          className={`text-sm font-medium ${
                            isStaleLogin(user.lastLogin) ? 'text-red-500' : 'text-gray-600'
                          }`}
                          title={isStaleLogin(user.lastLogin) ? 'User has not logged in recently' : ''}
                        >
                          {formatLastLogin(user.lastLogin)}
                        </div>
                      </td>
                      
                      <td className="px-5 py-2.5 whitespace-nowrap text-sm">
                        <span 
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                            user.active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {user.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      
                      <td className="px-5 py-2.5 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <MoreActionsMenu 
                            items={getUserActions(user)}
                            label={`More actions for ${user.name}`}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {!isLoading && !error && filteredUsers.length > 0 && (
              <div className="px-6 py-4">
                <Pagination
                  currentPage={currentPage}
                  totalItems={filteredUsers.length}
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
        )}

        {activeTab === 'invitations' && (
          <PendingInvitations 
            invitations={invitations}
            onRefresh={handleRefreshInvitations}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}