"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Search, ChevronsUpDown, ArrowUpDown, ArrowUp, ArrowDown,Check, X  } from "lucide-react";
import { API_ENDPOINTS } from "@/lib/api";
import { useRouter } from "next/navigation";
import Pagination, { usePagination } from "@/components/Pagination";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { formatRoleDisplay } from "@/utils/roleDisplay";

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
  createdAt: Date | string;
  updatedAt: Date;
}

type RoleApiItem = {
  role_id: number;
  name: string;
};

type RoleApiResponse = {
  success: boolean;
  data: RoleApiItem[];
};

type UpdateUserPayload = {
  name: string;
  email: string;
  phone: string;
  role_id: number;
  practice_area?: string;
  reporting_manager_id?: number;
  active_status: boolean;
};

type UserBillableHoursResponse = {
  success: boolean;
  data: Array<{
    userId: number;
    userName: string;
    totalHours: number;
  }>;
};

type SortDirection = "asc" | "desc" | null;
type SortKey =
  | "createdAt"
  | "timesheetHours"
  | "name"
  | "email"
  | "reportingManager";

export default function Users() {
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]); // Changed from roleFilter
  const [statusFilter, setStatusFilter] = useState("All");
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [roleFilterOpen, setRoleFilterOpen] = useState(false); // New state for filter dropdown
  const [editingRoleId, setEditingRoleId] = useState("");
  const [editingCell, setEditingCell] = useState<{
    userId: number;
    field: "name" | "email" | "role";
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [roles, setRoles] = useState<Array<{ id: number; name: string }>>([]);
  const [userHours, setUserHours] = useState<Record<number, number>>({});
  const [sortConfig, setSortConfig] = useState<{ key: SortKey | null; direction: SortDirection }>({
    key: null,
    direction: null,
  });

  const fetchRoles = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.users.roles, {
        credentials: "include",
      });

      if (response.ok) {
        const data: RoleApiResponse = await response.json();
        if (data.success) {
          // Normalize backend response
          const normalized = data.data.map((role) => ({
            id: role.role_id,
            name: role.name,
          }));
          setRoles(normalized);
        }
      }
    } catch (error) {
      console.error("Failed to fetch roles:", error);
    }
  };

  const {
    currentPage,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    resetToFirstPage,
    getPaginatedData,
  } = usePagination(10); // default 10 per page

  const fetchUserHours = useCallback(async () => {
    try {
      const response = await fetch(API_ENDPOINTS.timesheets.billedhours.userBillableHours, {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch user hours");
      }

      const data: UserBillableHoursResponse = await response.json();
      if (data.success && Array.isArray(data.data)) {
        const hoursMap: Record<number, number> = {};
        data.data.forEach((entry) => {
          hoursMap[entry.userId] = entry.totalHours || 0;
        });
        setUserHours(hoursMap);
      }
    } catch (err) {
      console.error("Fetch user hours error:", err);
    }
  }, []);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(API_ENDPOINTS.users.list, {
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
        throw new Error("Failed to fetch users");
      }

      const data = await response.json();

      if (data.success) {
        setUsers(data.data);
      } else {
        setError(data.message || "Failed to load users");
      }
    } catch (err) {
      console.error("Fetch users error:", err);
      setError("Failed to load users. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchUsers();
    fetchRoles(); // Add this line
    fetchUserHours();
  }, [fetchUsers, fetchUserHours]);

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
        selectedRoles.some(selectedRoleId => 
          user.roleId !== undefined &&
          user.roleId !== null &&
          user.roleId.toString() === selectedRoleId
        );

      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Active" && user.active) ||
        (statusFilter === "Inactive" && !user.active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, selectedRoles, statusFilter]);

  const paginatedUsers = useMemo(() => {
    const sortedUsers = (() => {
      if (!sortConfig.key || !sortConfig.direction) return filteredUsers;

      const sorted = [...filteredUsers].sort((a, b) => {
        if (sortConfig.key === "name") {
          return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        }

        if (sortConfig.key === "email") {
          return a.email.toLowerCase().localeCompare(b.email.toLowerCase());
        }

        if (sortConfig.key === "reportingManager") {
          const aManager = a.reportingManager?.name?.toLowerCase() || "";
          const bManager = b.reportingManager?.name?.toLowerCase() || "";
          return aManager.localeCompare(bManager);
        }

        if (sortConfig.key === "createdAt") {
          const aTime = new Date(a.createdAt).getTime();
          const bTime = new Date(b.createdAt).getTime();
          return aTime - bTime;
        }

        if (sortConfig.key === "timesheetHours") {
          const aHours = userHours[a.id] ?? 0;
          const bHours = userHours[b.id] ?? 0;
          return aHours - bHours;
        }

        return 0;
      });

      return sortConfig.direction === "desc" ? sorted.reverse() : sorted;
    })();

    return getPaginatedData(sortedUsers);
  }, [filteredUsers, sortConfig, userHours, getPaginatedData]);

  useEffect(() => {
    resetToFirstPage();
  }, [searchQuery, statusFilter, selectedRoles, sortConfig, resetToFirstPage]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // const handleRoleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
  //   setRoleFilter(e.target.value);
  // };

  const handleStatusFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setStatusFilter(e.target.value);
  };

  const handleView = (userId: number) => {
    router.push(`/hr/users/${userId}`);
  };

  const startEditing = (user: User, field: "name" | "email" | "role") => {
    setEditingCell({ userId: user.id, field });

    if (field === "role") {
      setEditingRoleId(user.roleId?.toString() || "");
      setRoleDropdownOpen(true);
    } else if (field === "name") {
      setEditValue(user.name);
    } else if (field === "email") {
      setEditValue(user.email);
    }
  };

  const handleCellSave = async (user: User) => {
    if (!editingCell) return;

    setIsSaving(true);
    try {
      const updateData: UpdateUserPayload = {
        name: user.name,
        email: user.email,
        phone: user.phone,
        role_id: user.roleId,
        practice_area: user.practiceArea,
        reporting_manager_id: user.reportingManager?.user_id,
        active_status: user.active,
      };

      // Update the specific field being edited
      if (editingCell.field === "name") {
        updateData.name = editValue.trim();
      } else if (editingCell.field === "email") {
        updateData.email = editValue.trim();
      }

      const response = await fetch(API_ENDPOINTS.users.update(user.id), {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (data.success) {
        setEditingCell(null);
        setEditValue("");
        fetchUsers(); // Refresh the list
      } else {
        alert(data.message || "Failed to update user");
      }
    } catch (error) {
      console.error("Update user error:", error);
      alert("Failed to update user. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const handleRoleSelection = async (user: User, newRoleId: string) => {
    try {
      // Update backend immediately
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

      // Update UI instantly
      fetchUsers(); // Refresh the list
    } catch (err) {
      console.error("Failed to update role:", err);
      alert("Failed to update role");
    }

    // Close dropdown + stop editing mode
    setTimeout(() => {
      setRoleDropdownOpen(false);
      setEditingCell(null);
    }, 150);
  };

  // ============================================================================
  // MULTI-SELECT FILTER HANDLERS
  // ============================================================================

  const toggleRole = (roleId: string) => {
    setSelectedRoles(prev => 
      prev.includes(roleId)
        ? prev.filter(r => r !== roleId)
        : [...prev, roleId]
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

  // Count active filters (only role filters count)
  const activeFilterCount = selectedRoles.length;

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const formatDate = (value: Date | string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        if (prev.direction === "asc") return { key, direction: "desc" };
        if (prev.direction === "desc") return { key: null, direction: null };
        return { key, direction: "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const getSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key || !sortConfig.direction) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" aria-hidden="true" />;
    }
    if (sortConfig.direction === "asc") {
      return <ArrowUp className="h-4 w-4 text-blue-600" aria-hidden="true" />;
    }
    return <ArrowDown className="h-4 w-4 text-blue-600" aria-hidden="true" />;
  };

  const InlineEditInput = ({
    value,
    onChange,
    onSave,
    onCancel,
    type = "text",
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
          if (e.key === "Enter") onSave();
          if (e.key === "Escape") onCancel();
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
    <div className="p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* SEARCH INPUT */}
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

          {/* MULTI-SELECT ROLE FILTER */}
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
                          onSelect={() => toggleRole(role.id.toString())}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <div className={`h-4 w-4 border rounded flex items-center justify-center ${
                              selectedRoles.includes(role.id.toString()) 
                                ? 'bg-blue-600 border-blue-600' 
                                : 'border-gray-300'
                            }`}>
                              {selectedRoles.includes(role.id.toString()) && (
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

          {/* STATUS FILTER DROPDOWN */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="status-filter"
              className="text-sm text-gray-700 font-medium"
            >
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
        {/* Active Filters Display */}
        {/* {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
            <span className="text-sm text-gray-600 font-medium">Active Filters:</span>
            
            {selectedRoles.map((roleId) => {
              const role = roles.find(r => r.id.toString() === roleId);
              return role ? (
                <Badge 
                  key={roleId} 
                  variant="secondary" 
                  className="gap-1 pl-2 pr-1"
                >
                  {formatRoleDisplay(role.name)}
                  <button
                    onClick={() => toggleRole(roleId)}
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
      <>
        {/* USER DATA TABLE */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              {/* TABLE HEADER */}
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center gap-2">
                      Name
                      {getSortIcon("name")}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    scope="col"
                  >
                    Role
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => handleSort("email")}
                  >
                    <div className="flex items-center gap-2">
                      Email
                      {getSortIcon("email")}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => handleSort("reportingManager")}
                  >
                    <div className="flex items-center gap-2">
                      Reporting Manager
                      {getSortIcon("reportingManager")}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                    scope="col"
                    onClick={() => handleSort("createdAt")}
                    title="Sort by Date of Joining"
                  >
                    <div className="flex items-center gap-2">
                      D-O-J
                      {getSortIcon("createdAt")}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                    scope="col"
                    onClick={() => handleSort("timesheetHours")}
                    title="Sort by Timesheet Hours"
                  >
                    <div className="flex items-center gap-2">
                      Timesheet Hours
                      {getSortIcon("timesheetHours")}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    scope="col"
                  >
                    Active Status
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
                        <p className="text-lg font-medium">Loading users...</p>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-red-500"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-lg font-medium">
                          Error loading users
                        </p>
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
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Search
                          size={48}
                          className="text-gray-300"
                          aria-hidden="true"
                        />
                        <p className="text-lg font-medium">No users found</p>
                        <p className="text-sm">
                          Try adjusting your search or filters
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => handleView(user.id)}
                    >
                      <td
                        className="px-6 py-4 whitespace-nowrap cursor-pointer hover:bg-blue-50"
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          startEditing(user, "name");
                        }}
                        title="Double-click to edit"
                      >
                        {editingCell?.userId === user.id &&
                        editingCell.field === "name" ? (
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

                      <td
                        className="px-6 py-4 whitespace-nowrap cursor-pointer hover:bg-blue-50"
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          startEditing(user, "role");
                        }}
                        title="Double-click to edit"
                      >
                        {editingCell?.userId === user.id &&
                        editingCell.field === "role" ? (
                          <div className="flex items-center gap-2 w-full relative">
                            {/* SEARCHABLE ROLE DROPDOWN */}
                            <Popover
                              open={roleDropdownOpen}
                              onOpenChange={setRoleDropdownOpen}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  onClick={(e) => e.stopPropagation()}
                                  onDoubleClick={(e) => e.stopPropagation()}
                                  className="w-full justify-between bg-white border border-gray-300"
                                >
                                  {roles.find(
                                    (r) => r.id.toString() === editingRoleId
                                  )?.name || "Select role"}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                                </Button>
                              </PopoverTrigger>

                              <PopoverContent
                                className="w-[300px] p-0"
                                align="start"
                              >
                                <Command>
                                  <CommandInput placeholder="Search roles..." />
                                  <CommandList>
                                    <CommandEmpty>No roles found.</CommandEmpty>

                                    <CommandGroup>
                                      {roles.map((role) => (
                                        <CommandItem
                                          key={role.id}
                                          value={role.name}
                                          onSelect={() => {
                                            setEditingRoleId(
                                              role.id.toString()
                                            );
                                            handleRoleSelection(
                                              user,
                                              role.id.toString()
                                            );
                                          }}
                                        >
                                          <div className="flex flex-col">
                                            <span>
                                              {formatRoleDisplay(role.name)}
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
                        ) : (
                          <div className="text-sm text-gray-600">
                            {formatRoleDisplay(user.role)}
                          </div>
                        )}
                      </td>

                      <td
                        className="px-6 py-4 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="text-sm text-gray-700">
                          <a
                            href={`mailto:${user.email}`}
                            className="text-blue-600 hover:underline"
                          >
                            {user.email}
                          </a>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700">
                          {user.reportingManager?.name || "-"}
                        </div>
                      </td>

                      <td
                        className="px-6 py-4 whitespace-nowrap"
                      >
                        <div className="text-sm text-gray-600">
                          {formatDate(user.createdAt)}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-center text-gray-700">
                          {(userHours[user.id] ?? 0).toFixed(2)}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                            user.active
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {user.active ? "Active" : "Inactive"}
                        </span>
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
    </div>
  );
}