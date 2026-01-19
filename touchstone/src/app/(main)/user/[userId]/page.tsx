"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Search, ChevronRight, UserCog } from "lucide-react";
import { API_ENDPOINTS } from "@/lib/api";
import LeavesTable from "@/components/leave/LeavesTable";
import { formatRoleDisplay } from "@/utils/roleDisplay";
import { Label } from "@/components/ui/label";

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
  practiceArea: string | null;
  lastLogin: Date | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  reportingManager: {
    id: number;
    name: string;
  } | null;
}

/**
 * Matter Interface Definition
 */
interface Matter {
  id: number;
  matterTitle: string;
  clientName: string;
  matterRole: string | null;
  assignedAt: string;
  status: "active" | "completed" | "on_hold" | "cancelled";
  practiceArea: string | null;
  startDate: string;
}

/**
 * Tab type definition
 */
type TabType = "overview" | "matters" | "activity" | "leave";

interface MatterResponse {
  id: number;
  matterTitle: string;
  clientName: string;
  assignedLawyer?: {
    id: number;
  };
  teamMembers?: Array<{
    userId: number;
    matterRole?: string;
    assignedAt?: string;
  }>;
  status: string;
  practiceArea?: string;
  startDate: string;
  [key: string]: unknown;
}

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.userId as string;

  // State management
  const [user, setUser] = useState<User | null>(null);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMattersLoading, setIsMattersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("matters");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  useEffect(() => {
    const fetchUserData = async () => {
      if (!userId) return;

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          API_ENDPOINTS.users.byId(parseInt(userId)),
          {
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          if (response.status === 401) {
            router.push("/login");
            return;
          }
          throw new Error("Failed to fetch user details");
        }

        const data = await response.json();

        if (data.success) {
          setUser(data.data);
        } else {
          setError(data.message || "Failed to load user details");
        }
      } catch (err) {
        console.error("Fetch user error:", err);
        setError("Failed to load user details. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [userId, router]);

  // Fetch matters for this user
  useEffect(() => {
    const fetchUserMatters = async () => {
      if (!userId) return;

      try {
        setIsMattersLoading(true);

        // Fetch all matters and filter by user
        const response = await fetch(API_ENDPOINTS.matters.list, {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch matters");
        }

        const data = await response.json();

        if (data.success) {
          // Filter matters where user is either assigned lawyer or team member
          const userMatters = data.data
            .filter((matter: MatterResponse) => {
              const isAssignedLawyer =
                matter.assignedLawyer?.id === parseInt(userId);
              const isTeamMember = matter.teamMembers?.some(
                (member) => member.userId === parseInt(userId)
              );
              return isAssignedLawyer || isTeamMember;
            })
            .map((matter: MatterResponse) => {
              // Find user's role in this matter
              const teamMember = matter.teamMembers?.find(
                (member) => member.userId === parseInt(userId)
              );
              const isAssignedLawyer =
                matter.assignedLawyer?.id === parseInt(userId);

              return {
                id: matter.id,
                matterTitle: matter.matterTitle,
                clientName: matter.clientName,
                matterRole: isAssignedLawyer
                  ? "Lead Attorney"
                  : teamMember?.matterRole || "Team Member",
                assignedAt: isAssignedLawyer
                  ? new Date(matter.startDate).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : teamMember?.assignedAt
                  ? new Date(teamMember.assignedAt).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      }
                    )
                  : "N/A",
                status: matter.status,
                practiceArea: matter.practiceArea,
                startDate: matter.startDate,
              };
            });

          setMatters(userMatters);
        }
      } catch (err) {
        console.error("Fetch matters error:", err);
        // Don't show error for matters, just show empty state
      } finally {
        setIsMattersLoading(false);
      }
    };

    if (activeTab === "matters") {
      fetchUserMatters();
    }
  }, [userId, activeTab]);

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const formatLastLogin = (lastLogin: Date | null): string => {
    if (!lastLogin) return "Never";

    const date = new Date(lastLogin);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "1 Day ago";
    if (diffDays < 30) return `${diffDays} Days ago`;

    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths} Month${diffMonths !== 1 ? "s" : ""} ago`;
  };

  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status.toLowerCase()) {
      case "active":
        return "text-green-600 bg-green-50";
      case "completed":
        return "text-blue-600 bg-blue-50";
      case "on_hold":
        return "text-yellow-600 bg-yellow-50";
      case "cancelled":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const formatStatus = (status: string): string => {
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Filtered matters based on search and status
  const filteredMatters = matters.filter((matter) => {
    const matchesSearch = matter.matterTitle
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "All" ||
      matter.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  // Handle navigation to matter detail
  const handleMatterClick = (matterId: number) => {
    router.push(`/matter/matter-master/${matterId}`);
  };

  // ============================================================================
  // RENDER LOADING & ERROR STATES
  // ============================================================================

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-lg font-medium text-gray-700">
            Loading user details...
          </p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <p className="text-lg font-medium text-red-600">
            {error || "User not found"}
          </p>
          <button
            onClick={() => router.push("/user")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to User Management
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="p-6 space-y-4">
      {/* TOP BAR - Breadcrumbs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <UserCog className="w-5 h-5 text-gray-500" />
          <button
            onClick={() => router.push("/user")}
            className="text-gray-500 hover:text-blue-600 font-medium transition-colors"
          >
            User Management
          </button>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <span className="text-gray-900 font-medium">{user.name}</span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <span className="text-gray-900 font-medium">Assigned Cases</span>
        </div>
      </div>

      {/* MAIN CONTENT CARD */}
      <div className="bg-white rounded-[22px] shadow-sm border border-gray-100 overflow-hidden">
        {/* Page Title */}
        <div className="px-6 pt-6">
          <h1
            className="text-2xl font-medium text-gray-900"
            style={{ fontFamily: "PF Square Sans Pro, sans-serif" }}
          >
            {user.name}
          </h1>
        </div>

        {/* USER PROFILE SECTION */}
        <div className="bg-gray-50 rounded-xl p-6 mb-6 mx-6 mt-6">
          {/* Profile Header */}
          <div className="flex items-start justify-between pb-4 mb-4 border-b border-gray-200">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-semibold">
                {getInitials(user.name)}
              </div>

              {/* Name and Last Login */}
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  {user.name}
                </h2>
                <p className="text-sm text-gray-600">
                  Last Login: {formatLastLogin(user.lastLogin)}
                </p>
              </div>
            </div>
          </div>

          {/* Profile Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* BASIC INFORMATION */}
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium text-gray-500">
                  BASIC INFORMATION
                </Label>
              </div>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-medium text-gray-500">
                    Email
                  </Label>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {user.email}
                  </p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-500">
                    Phone
                  </Label>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {user.phone}
                  </p>
                </div>
              </div>
            </div>

            {/* ABOUT ROLE */}
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium text-gray-500">
                  ABOUT ROLE
                </Label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-gray-500">
                    Role
                  </Label>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {formatRoleDisplay(user.role)}
                  </p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-500">
                    Practice Area
                  </Label>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {user.practiceArea || "N/A"}
                  </p>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <Label className="text-xs font-medium text-gray-500">
                  Reporting Manager
                </Label>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {user.reportingManager?.name || "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* TABS NAVIGATION */}
        <div className="flex items-center gap-0 px-6 mt-6 border-b border-gray-200">
          {/* <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-3 text-base font-semibold transition-colors ${
              activeTab === 'overview'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Overview
          </button> */}
          <button
            onClick={() => setActiveTab("matters")}
            className={`px-4 py-3 text-base font-semibold transition-colors ${
              activeTab === "matters"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Matters Involved ({matters.length})
          </button>
          {/* <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-3 text-base font-semibold transition-colors ${
              activeTab === 'activity'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Activity Logs
          </button> */}
          <button
            onClick={() => setActiveTab("leave")}
            className={`px-4 py-3 text-base font-semibold transition-colors ${
              activeTab === "leave"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Leaves
          </button>
        </div>

        {/* TAB CONTENT - Matters Involved */}
        {activeTab === "matters" && (
          <div className="p-6 space-y-6">
            {/* Search and Action Bar */}
            <div className="flex items-center justify-between gap-4">
              {/* Search Input */}
              <div className="flex-1 max-w-md relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="Search by matter name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 bg-white border border-gray-300 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="status-filter"
                  className="text-sm font-medium text-gray-600"
                >
                  Status:
                </label>
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 text-sm text-gray-800 bg-white border border-gray-300 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                >
                  <option value="All">All</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Matters Table */}
            {isMattersLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="text-sm text-gray-600">Loading matters...</p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                        Matter Name
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                        Client
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                        Role in Matter
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                        Date Joined
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredMatters.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <p className="text-gray-500 font-medium">
                              {searchQuery || statusFilter !== "All"
                                ? "No matters found matching your criteria"
                                : "No matters assigned yet"}
                            </p>
                            <p className="text-sm text-gray-400">
                              {searchQuery || statusFilter !== "All"
                                ? "Try adjusting your search or filters"
                                : "This user has not been assigned to any matters"}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredMatters.map((matter) => (
                        <tr
                          key={matter.id}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => handleMatterClick(matter.id)}
                        >
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {matter.matterTitle}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {matter.clientName}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {matter.matterRole || "Team Member"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {matter.assignedAt}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(
                                matter.status
                              )}`}
                            >
                              {formatStatus(matter.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMatterClick(matter.id);
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Other Tab Content Placeholders */}
        {/* {activeTab === 'overview' && (
          <div className="p-6">
            <p className="text-gray-500">Overview content coming soon...</p>
          </div>
        )} */}
        {/* {activeTab === 'activity' && (
          <div className="p-6">
            <p className="text-gray-500">Activity logs coming soon...</p>
          </div>
        )} */}
        {activeTab === "leave" && (
          <div className="p-6">
            <LeavesTable userId={parseInt(userId)} />
          </div>
        )}
      </div>
    </div>
  );
}
