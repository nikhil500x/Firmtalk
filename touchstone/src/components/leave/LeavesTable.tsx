"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Search, ChevronsUpDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { API_ENDPOINTS } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
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

/**
 * Leave Interface Definition
 */
interface Leave {
  id: number;
  userId: number;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewedBy: number | null;
  reviewerComments: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  reviewer: {
    id: number;
    name: string;
  } | null;
}

interface LeaveType {
  value: string;
  label: string;
}

interface LeavesTableProps {
  refreshTrigger?: number;
  onViewLeave?: (leaveId: number) => void;
  userId?: number;
  statusFromUrl?: 'pending' | 'approved' | 'rejected' | null;
}

export default function LeavesTable({ 
  refreshTrigger, 
  onViewLeave, 
  userId,
  statusFromUrl
}: LeavesTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role, user } = useAuth();

  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Multi-select filter states
  const [availableLeaveTypes, setAvailableLeaveTypes] = useState<LeaveType[]>([]);
  const [selectedLeaveTypes, setSelectedLeaveTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [leaveTypeFilterOpen, setLeaveTypeFilterOpen] = useState(false);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);

  useEffect(() => {
  if (statusFromUrl) {
    setSelectedStatuses([statusFromUrl]);
  }
}, [statusFromUrl]);

  // Status options
  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ];

  // Authorization check: only certain roles can see all leaves
  const canSeeAllLeaves = ['superadmin','partner', 'admin', 'support', 'it', 'hr'].includes(role?.name || '');

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchLeaves = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let endpoint: string;
      
      // If userId is provided explicitly, use that
      if (userId) {
        endpoint = API_ENDPOINTS.leaves.byUser(userId);
      } 
      // If user is not authorized to see all leaves, fetch only their own
      else if (!canSeeAllLeaves && user) {
        endpoint = API_ENDPOINTS.leaves.byUser(user.id);
      } 
      // Authorized users can see all leaves
      else {
        endpoint = API_ENDPOINTS.leaves.list;
      }

      const response = await fetch(endpoint, {
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
        throw new Error("Failed to fetch leaves");
      }

      const data = await response.json();

      if (data.success) {
        setLeaves(data.data);
      } else {
        setError(data.message || "Failed to load leaves");
      }
    } catch (err) {
      console.error("Fetch leaves error:", err);
      setError("Failed to load leaves. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [router, userId, canSeeAllLeaves, user]);

  const fetchAvailableLeaveTypes = useCallback(async () => {
    try {
      const response = await fetch(API_ENDPOINTS.leaves.availableTypes, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAvailableLeaveTypes(data.data);
        }
      }
    } catch (err) {
      console.error('Error fetching available leave types:', err);
    }
  }, []);

  useEffect(() => {
    fetchLeaves();
    fetchAvailableLeaveTypes();
  }, [fetchLeaves, fetchAvailableLeaveTypes, refreshTrigger]);

  // ============================================================================
  // FILTERING
  // ============================================================================

  const filteredLeaves = useMemo(() => {
    return leaves.filter((leave) => {
      // Search filter
      const matchesSearch =
        leave.user.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase().trim()) ||
        leave.leaveType
          .toLowerCase()
          .includes(searchQuery.toLowerCase().trim()) ||
        leave.reason.toLowerCase().includes(searchQuery.toLowerCase().trim());

      // Multi-select leave type filter
      const matchesLeaveType =
        selectedLeaveTypes.length === 0 || selectedLeaveTypes.includes(leave.leaveType);

      // Multi-select status filter
      const matchesStatus =
        selectedStatuses.length === 0 || selectedStatuses.includes(leave.status);

      return matchesSearch && matchesLeaveType && matchesStatus;
    });
  }, [leaves, searchQuery, selectedLeaveTypes, selectedStatuses]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleLeaveTypeToggle = (leaveType: string) => {
    setSelectedLeaveTypes((prev) => {
      if (prev.includes(leaveType)) {
        return prev.filter((t) => t !== leaveType);
      } else {
        return [...prev, leaveType];
      }
    });
  };

  const handleStatusToggle = (status: string) => {
    setSelectedStatuses((prev) => {
      if (prev.includes(status)) {
        return prev.filter((s) => s !== status);
      } else {
        return [...prev, status];
      }
    });
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case "approved":
        return "text-green-600";
      case "pending":
        return "text-yellow-600";
      case "rejected":
        return "text-red-600";
      case "cancelled":
        return "text-gray-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusText = (status: string): string => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getLeaveTypeLabel = (type: string): string => {
    const labels: { [key: string]: string } = {
      regular: "Privilege Leave",
      sick: "Sick Leave",
      casual: "Casual Leave",
      earned: "Earned Leave",
      maternity: "Maternity Leave",
      paternity: "Paternity Leave",
      unpaid: "Unpaid Leave",
    };
    return labels[type] || type.charAt(0).toUpperCase() + type.slice(1) + " Leave";
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      {/* FILTERS BAR */}
      <div className="px-6 py-4 flex items-center gap-4 border-b border-gray-200">
        {/* SEARCH INPUT */}
        <div className="flex-1 max-w-md relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search by Lawyer Name, Leave Type, or Reason"
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 bg-white border border-gray-300 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
            suppressHydrationWarning
          />
        </div>

        {/* LEAVE TYPE FILTER */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">
            Leave Type:
          </label>
          <Popover open={leaveTypeFilterOpen} onOpenChange={setLeaveTypeFilterOpen}>
            <PopoverTrigger asChild>
              <button
                className="w-52 px-3 py-2 text-sm text-left bg-white border border-gray-300 rounded-md cursor-pointer hover:border-blue-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none flex justify-between items-center"
              >
                <span className="truncate text-gray-800">
                  {selectedLeaveTypes.length === 0
                    ? 'All'
                    : selectedLeaveTypes.length === 1
                    ? availableLeaveTypes.find(t => t.value === selectedLeaveTypes[0])?.label
                    : `${selectedLeaveTypes.length} selected`}
                </span>
                <ChevronsUpDown className="h-4 w-4 opacity-50 ml-2 flex-shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[260px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search leave types..." />
                <CommandList>
                  <CommandEmpty>No leave type found.</CommandEmpty>
                  <CommandGroup>
                    {availableLeaveTypes.map((leaveType) => (
                      <CommandItem
                        key={leaveType.value}
                        value={leaveType.value}
                        onSelect={() => handleLeaveTypeToggle(leaveType.value)}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                            selectedLeaveTypes.includes(leaveType.value)
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-gray-300'
                          }`}>
                            {selectedLeaveTypes.includes(leaveType.value) && (
                              <span className="text-white text-xs">✓</span>
                            )}
                          </div>
                          <span>{leaveType.label}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
                {selectedLeaveTypes.length > 0 && (
                  <div className="p-2 border-t">
                    <button
                      onClick={() => setSelectedLeaveTypes([])}
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
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">
            Status:
          </label>
          <Popover open={statusFilterOpen} onOpenChange={setStatusFilterOpen}>
            <PopoverTrigger asChild>
              <button
                className="w-52 px-3 py-2 text-sm text-left bg-white border border-gray-300 rounded-md cursor-pointer hover:border-blue-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none flex justify-between items-center"
              >
                <span className="truncate text-gray-800">
                  {selectedStatuses.length === 0
                    ? 'All'
                    : selectedStatuses.length === 1
                    ? statusOptions.find(s => s.value === selectedStatuses[0])?.label
                    : `${selectedStatuses.length} selected`}
                </span>
                <ChevronsUpDown className="h-4 w-4 opacity-50 ml-2 flex-shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[260px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search statuses..." />
                <CommandList>
                  <CommandEmpty>No status found.</CommandEmpty>
                  <CommandGroup>
                    {statusOptions.map((status) => (
                      <CommandItem
                        key={status.value}
                        value={status.value}
                        onSelect={() => handleStatusToggle(status.value)}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                            selectedStatuses.includes(status.value)
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-gray-300'
                          }`}>
                            {selectedStatuses.includes(status.value) && (
                              <span className="text-white text-xs">✓</span>
                            )}
                          </div>
                          <span>{status.label}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
                {selectedStatuses.length > 0 && (
                  <div className="p-2 border-t">
                    <button
                      onClick={() => setSelectedStatuses([])}
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
      </div>

      {/* LEAVES TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* TABLE HEADER */}
          <thead className="bg-white border-t border-b border-gray-200">
            <tr>
              <th
                className="px-6 py-3 text-left text-base font-medium text-gray-500"
                scope="col"
              >
                Lawyer
              </th>
              <th
                className="px-6 py-3 text-left text-base font-medium text-gray-500"
                scope="col"
              >
                Leave Type
              </th>
              <th
                className="px-6 py-3 text-left text-base font-medium text-gray-500"
                scope="col"
              >
                Start Date
              </th>
              <th
                className="px-6 py-3 text-left text-base font-medium text-gray-500"
                scope="col"
              >
                End Date
              </th>
              <th
                className="px-6 py-3 text-center text-base font-medium text-gray-500"
                scope="col"
              >
                Total Days
              </th>
              <th
                className="px-6 py-3 text-left text-base font-medium text-gray-500"
                scope="col"
              >
                Reason
              </th>
              <th
                className="px-6 py-3 text-center text-base font-medium text-gray-500"
                scope="col"
              >
                Status
              </th>
              <th
                className="px-6 py-3 text-left text-base font-medium text-gray-500"
                scope="col"
              >
                Reviewer
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
                  colSpan={9}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="text-lg font-medium">Loading leaves...</p>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-red-500">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-lg font-medium">Error loading leaves</p>
                    <p className="text-sm">{error}</p>
                    <button
                      onClick={fetchLeaves}
                      className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Retry
                    </button>
                  </div>
                </td>
              </tr>
            ) : filteredLeaves.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-lg font-medium">No leaves found</p>
                    <p className="text-sm">
                      Try adjusting your search or filters
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredLeaves.map((leave) => (
                <tr
                  key={leave.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-base font-medium text-gray-900">
                      {leave.user.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {leave.user.role}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-base text-gray-900">
                      {getLeaveTypeLabel(leave.leaveType)}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-base text-gray-900">
                      {formatDate(leave.startDate)}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-base text-gray-900">
                      {formatDate(leave.endDate)}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="text-base font-medium text-gray-900">
                      {leave.totalDays}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-base text-gray-900 max-w-xs truncate">
                      {leave.reason}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span
                      className={`text-base font-medium ${getStatusBadgeClass(
                        leave.status
                      )}`}
                    >
                      {getStatusText(leave.status)}
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {leave.reviewer ? leave.reviewer.name : "-"}
                    </div>
                    {leave.reviewerComments && (
                      <div className="text-xs text-gray-500 max-w-xs truncate">
                        {leave.reviewerComments}
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => onViewLeave && onViewLeave(leave.id)}
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}