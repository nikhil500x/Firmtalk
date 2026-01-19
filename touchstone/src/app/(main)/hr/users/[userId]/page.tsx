'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Search, ChevronRight, UserCog, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { API_ENDPOINTS } from '@/lib/api';
import MyTaskPage from '@/components/task/MyTask';
import { formatRoleDisplay } from '@/utils/roleDisplay';

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
    status: 'active' | 'completed' | 'on_hold' | 'cancelled';
    practiceArea: string | null;
    startDate: string;
}

/**
 * Timesheet Entry for Table
 */
interface TimesheetEntry {
    id: number;
    date: string;
    matterTitle: string;
    clientName: string;
    activityType: string;
    totalHours: number;
    billableHours: number;
    isBillable: boolean;
    status: 'pending' | 'approved' | 'rejected' | 'draft' | 'partially approved';
    remarks: string;
    notes: string;
}

/**
 * Tab type definition
 */
type TabType = 'matters' | 'timesheetEntries' | 'tasks';
type SortDirection = 'asc' | 'desc' | null;

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

export default function HRUserDetailPage() {
    const params = useParams();
    const router = useRouter();
    const userId = params?.userId as string;

    // State management
    const [user, setUser] = useState<User | null>(null);
    const [matters, setMatters] = useState<Matter[]>([]);
    const [userTimesheetEntries, setUserTimesheetEntries] = useState<TimesheetEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMattersLoading, setIsMattersLoading] = useState(true);
    const [isTimesheetEntriesLoading, setIsTimesheetEntriesLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [timesheetEntriesError, setTimesheetEntriesError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('matters');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [matterSort, setMatterSort] = useState<{ key: 'assignedAt'; direction: SortDirection }>({
        key: 'assignedAt',
        direction: null,
    });
    const [timesheetSort, setTimesheetSort] = useState<{ key: 'totalHours'; direction: SortDirection }>(
        {
            key: 'totalHours',
            direction: null,
        }
    );

    const [userTasks, setUserTasks] = useState<number>(0); // To store task count

    // ============================================================================
    // DATA FETCHING
    // ============================================================================

    useEffect(() => {
        const fetchUserData = async () => {
            if (!userId) return;

            try {
                setIsLoading(true);
                setError(null);

                const response = await fetch(API_ENDPOINTS.users.byId(parseInt(userId)), {
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
                    throw new Error('Failed to fetch user details');
                }

                const data = await response.json();

                if (data.success) {
                    setUser(data.data);
                } else {
                    setError(data.message || 'Failed to load user details');
                }
            } catch (err) {
                console.error('Fetch user error:', err);
                setError('Failed to load user details. Please try again.');
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

                const response = await fetch(API_ENDPOINTS.matters.list, {
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch matters');
                }

                const data = await response.json();

                if (data.success) {
                    const userMatters = data.data
                        .filter((matter: MatterResponse) => {
                            const isAssignedLawyer = matter.assignedLawyer?.id === parseInt(userId);
                            const isTeamMember = matter.teamMembers?.some(
                                (member) => member.userId === parseInt(userId)
                            );
                            return isAssignedLawyer || isTeamMember;
                        })
                        .map((matter: MatterResponse) => {
                            const teamMember = matter.teamMembers?.find(
                                (member) => member.userId === parseInt(userId)
                            );
                            const isAssignedLawyer = matter.assignedLawyer?.id === parseInt(userId);

                            return {
                                id: matter.id,
                                matterTitle: matter.matterTitle,
                                clientName: matter.clientName,
                                matterRole: isAssignedLawyer
                                    ? 'Lead Attorney'
                                    : teamMember?.matterRole || 'Team Member',
                                assignedAt: isAssignedLawyer
                                    ? new Date(matter.startDate).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                    })
                                    : teamMember?.assignedAt
                                        ? new Date(teamMember.assignedAt).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                        })
                                        : 'N/A',
                                status: matter.status as Matter['status'],
                                practiceArea: matter.practiceArea || null,
                                startDate: matter.startDate,
                            };
                        });

                    setMatters(userMatters);
                }
            } catch (err) {
                console.error('Fetch matters error:', err);
            } finally {
                setIsMattersLoading(false);
            }
        };

        if (activeTab === 'matters') {
            fetchUserMatters();
        }
    }, [userId, activeTab]);

    // Fetch timesheet entries for this user
    useEffect(() => {
        const fetchTimesheetEntries = async () => {
            if (!userId) return;

            try {
                setIsTimesheetEntriesLoading(true);
                setTimesheetEntriesError(null);

                const response = await fetch(API_ENDPOINTS.timesheets.byUser(parseInt(userId)), {
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch user timesheet entries');
                }

                const data = await response.json();
                console.log(data)

                if (data.success) {
                    interface TimesheetEntryApiResponse {
                        id: number;
                        date: string;
                        matterTitle: string;
                        clientName: string;
                        activityType: string;
                        totalHours: number;
                        billableHours: number;
                        nonBillableHours?: number;
                        status: TimesheetEntry['status'];
                        description?: string;
                        notes?: string;
                    }

                    const formattedEntries = (data.data as TimesheetEntryApiResponse[]).map((entry) => {
                        // API returns hours as numbers, not "HH:MM" strings
                        const billable = entry.billableHours || 0;
                        const nonBillable = entry.nonBillableHours || 0;
                        const total = entry.totalHours || 0;

                        return {
                            id: entry.id,
                            date: entry.date,
                            matterTitle: entry.matterTitle,
                            clientName: entry.clientName,
                            activityType: entry.activityType,

                            // ✅ FIXED
                            billableHours: billable,
                            totalHours: total || billable + nonBillable, // fallback safety
                            isBillable: billable > 0,

                            status: entry.status ?? 'draft',
                            remarks: entry.description || 'N/A',
                            notes: entry.notes || 'N/A',
                        };
                    });


                    setUserTimesheetEntries(formattedEntries);
                } else {
                    setTimesheetEntriesError(data.message || 'Failed to load timesheet entries');
                    setUserTimesheetEntries([]);
                }
            } catch (err) {
                console.error('Fetch user timesheet entries error:', err);
                setTimesheetEntriesError('Failed to load timesheet entries. Please try again.');
                setUserTimesheetEntries([]);
            } finally {
                setIsTimesheetEntriesLoading(false);
            }
        };

        if (activeTab === 'timesheetEntries') {
            fetchTimesheetEntries();
        }
    }, [userId, activeTab]);


    // Fetch task count for this user
    useEffect(() => {
        const fetchUserTaskCount = async () => {
            if (!userId) return;

            try {
                const response = await fetch(`${API_ENDPOINTS.tasks.byUser(parseInt(userId))}?active_status=true`, {
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch user tasks');
                }

                const data = await response.json();

                if (data.success && data.data) {
                    setUserTasks(data.data.length);
                }
            } catch (err) {
                console.error('Fetch user tasks error:', err);
            }
        };

        fetchUserTaskCount();
    }, [userId]);

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================

    const formatLastLogin = (lastLogin: Date | null): string => {
        if (!lastLogin) return 'Never';

        const date = new Date(lastLogin);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return '1 Day ago';
        if (diffDays < 30) return `${diffDays} Days ago`;

        const diffMonths = Math.floor(diffDays / 30);
        return `${diffMonths} Month${diffMonths !== 1 ? 's' : ''} ago`;
    };

    const getInitials = (name: string): string => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const getMatterStatusBadgeClass = (status: string): string => {
        switch (status.toLowerCase()) {
            case 'active':
                return 'text-green-600 bg-green-50';
            case 'completed':
                return 'text-blue-600 bg-blue-50';
            case 'on_hold':
                return 'text-yellow-600 bg-yellow-50';
            case 'cancelled':
                return 'text-red-600 bg-red-50';
            default:
                return 'text-gray-600 bg-gray-100';
        }
    };

    const formatMatterStatus = (status: string): string => {
        return status
            .split('_')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const getTimesheetStatusBadgeClass = (status: string): string => {
        const normalized = status.toLowerCase();
        switch (normalized) {
            case 'approved':
                return 'bg-green-100 text-green-600';
            case 'partially approved':
                return 'bg-blue-100 text-blue-600';
            case 'pending':
                return 'bg-yellow-100 text-yellow-600';
            case 'rejected':
                return 'bg-red-100 text-red-600';
            case 'draft':
            default:
                return 'bg-gray-100 text-gray-600';
        }
    };

    const getTimesheetStatusText = (status: string): string => {
        if (status.toLowerCase() === 'partially approved') {
            return 'Partially Approved';
        }
        return status.charAt(0).toUpperCase() + status.slice(1);
    };

    // Filtered matters based on search and status
    const filteredMatters = matters.filter((matter) => {
        const matchesSearch = matter.matterTitle.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus =
            statusFilter === 'All' || matter.status.toLowerCase() === statusFilter.toLowerCase();
        return matchesSearch && matchesStatus;
    });

    const sortedMatters = useMemo(() => {
        if (!matterSort.direction) return filteredMatters;
        const sorted = [...filteredMatters].sort((a, b) => {
            const aDate = new Date(a.startDate).getTime();
            const bDate = new Date(b.startDate).getTime();
            if (isNaN(aDate) && isNaN(bDate)) return 0;
            if (isNaN(aDate)) return 1;
            if (isNaN(bDate)) return -1;
            return aDate - bDate;
        });
        return matterSort.direction === 'desc' ? sorted.reverse() : sorted;
    }, [filteredMatters, matterSort]);

    // Handle navigation to matter detail
    const handleMatterClick = (matterId: number) => {
        router.push(`/matter/matter-master/${matterId}`);
    };

    const handleMatterSort = () => {
        setMatterSort((prev) => {
            if (prev.direction === null) return { ...prev, direction: 'asc' };
            if (prev.direction === 'asc') return { ...prev, direction: 'desc' };
            return { ...prev, direction: null };
        });
    };

    const getSortIcon = (direction: SortDirection) => {
        if (!direction) return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
        if (direction === 'asc') return <ArrowUp className="h-4 w-4 text-blue-600" />;
        return <ArrowDown className="h-4 w-4 text-blue-600" />;
    };

    const sortedTimesheetEntries = useMemo(() => {
        if (!timesheetSort.direction) return userTimesheetEntries;
        const sorted = [...userTimesheetEntries].sort((a, b) => a.totalHours - b.totalHours);
        return timesheetSort.direction === 'desc' ? sorted.reverse() : sorted;
    }, [userTimesheetEntries, timesheetSort]);

    const handleTimesheetSort = () => {
        setTimesheetSort((prev) => {
            if (prev.direction === null) return { ...prev, direction: 'asc' };
            if (prev.direction === 'asc') return { ...prev, direction: 'desc' };
            return { ...prev, direction: null };
        });
    };

    const parseTimeToHours = (time?: string | null): number => {
    if (!time) return 0;

    // Expecting "HH:MM"
    const [hours, minutes] = time.split(':').map(Number);

    if (isNaN(hours) || isNaN(minutes)) return 0;

    return hours + minutes / 60;
};

    // ============================================================================
    // RENDER LOADING & ERROR STATES
    // ============================================================================

    if (isLoading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-screen">
                <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="text-lg font-medium text-gray-700">Loading user details...</p>
                </div>
            </div>
        );
    }

    if (error || !user) {
        return (
            <div className="p-6 flex items-center justify-center min-h-screen">
                <div className="flex flex-col items-center gap-3">
                    <p className="text-lg font-medium text-red-600">{error || 'User not found'}</p>
                    <button
                        onClick={() => router.push('/hr')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Back to HR
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
                        onClick={() => router.push('/hr')}
                        className="text-gray-500 hover:text-blue-600 font-medium transition-colors"
                    >
                        HR
                    </button>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-900 font-medium">{user.name}</span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-900 font-medium">Profile</span>
                </div>
            </div>

            {/* MAIN CONTENT CARD */}
            <div className="bg-white rounded-[22px] shadow-sm border border-gray-100 overflow-hidden">
                {/* Page Title */}
                <div className="px-6 pt-6">
                    <h1
                        className="text-2xl font-medium text-gray-900"
                        style={{ fontFamily: 'PF Square Sans Pro, sans-serif' }}
                    >
                        {user.name}
                    </h1>
                </div>

                {/* USER PROFILE SECTION */}
                <div className="bg-[#F9FAFB] rounded-xl mx-6 mt-6 p-4">
                    {/* Profile Header */}
                    <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-4">
                            {/* Avatar */}
                            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-semibold">
                                {getInitials(user.name)}
                            </div>

                            {/* Name and Last Login */}
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">{user.name}</h2>
                                <p className="text-sm text-gray-600">Last Login: {formatLastLogin(user.lastLogin)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Profile Details Grid */}
                    <div className="flex gap-8">
                        {/* BASIC INFORMATION */}
                        <div className="flex-1 space-y-3">
                            <h3 className="text-xs font-normal text-gray-500 uppercase tracking-wider">
                                BASIC INFORMATION
                            </h3>
                            <div className="space-y-4">
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-gray-500 mb-2">Email</span>
                                    <span className="text-sm text-gray-800">{user.email}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-gray-500 mb-2">Phone</span>
                                    <span className="text-sm text-gray-800">{user.phone}</span>
                                </div>
                            </div>
                        </div>

                        {/* ABOUT ROLE */}
                        <div className="flex-1 space-y-3">
                            <h3 className="text-xs font-normal text-gray-500 uppercase tracking-wider">
                                ABOUT ROLE
                            </h3>
                            <div className="flex gap-12">
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-gray-500 mb-2">Role</span>
                                    <span className="text-sm text-gray-800">{formatRoleDisplay(user.role)}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-gray-500 mb-2">Practice Area</span>
                                    <span className="text-sm text-gray-800">{user.practiceArea || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* TABS NAVIGATION */}
                <div className="flex items-center gap-0 px-6 mt-6 border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('matters')}
                        className={`px-4 py-3 text-base font-semibold transition-colors ${
                            activeTab === 'matters'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        Matters Involved ({matters.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('timesheetEntries')}
                        className={`px-4 py-3 text-base font-semibold transition-colors ${
                            activeTab === 'timesheetEntries'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        User Timesheet Entries
                    </button>
                    {/* ADD THIS NEW TAB BUTTON */}
                    <button
                        onClick={() => setActiveTab('tasks')}
                        className={`px-4 py-3 text-base font-semibold transition-colors ${
                            activeTab === 'tasks'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        My Tasks ({userTasks})
                    </button>
                </div>

                {/* TAB CONTENT - Matters Involved */}
                {activeTab === 'matters' && (
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
                                <label htmlFor="status-filter" className="text-sm font-medium text-gray-600">
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
                                            <th
                                                className="px-4 py-3 text-left text-sm font-medium text-gray-600 cursor-pointer select-none"
                                                onClick={handleMatterSort}
                                                title="Sort by Date Joined"
                                            >
                                                <div className="flex items-center gap-2">
                                                    Date Joined
                                                    {getSortIcon(matterSort.direction)}
                                                </div>
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
                                        {sortedMatters.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-12 text-center">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <p className="text-gray-500 font-medium">
                                                            {searchQuery || statusFilter !== 'All'
                                                                ? 'No matters found matching your criteria'
                                                                : 'No matters assigned yet'}
                                                        </p>
                                                        <p className="text-sm text-gray-400">
                                                            {searchQuery || statusFilter !== 'All'
                                                                ? 'Try adjusting your search or filters'
                                                                : 'This user has not been assigned to any matters'}
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            sortedMatters.map((matter) => (
                                                <tr
                                                    key={matter.id}
                                                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                                                    onClick={() => handleMatterClick(matter.id)}
                                                >
                                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                                        {matter.matterTitle}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-700">{matter.clientName}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-700">
                                                        {matter.matterRole || 'Team Member'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-700">{matter.assignedAt}</td>
                                                    <td className="px-4 py-3">
                                                        <span
                                                            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getMatterStatusBadgeClass(
                                                                matter.status
                                                            )}`}
                                                        >
                                                            {formatMatterStatus(matter.status)}
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

                {/* USER TIMESHEET ENTRIES TAB */}
                {activeTab === 'timesheetEntries' && (
                    <div className="p-6 space-y-4">
                        {isTimesheetEntriesLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                    <p className="text-sm text-gray-600">Loading timesheet entries...</p>
                                </div>
                            </div>
                        ) : timesheetEntriesError ? (
                            <div className="text-center text-red-600 py-6">{timesheetEntriesError}</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-white border-t border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-3 text-center text-base font-medium text-gray-500" scope="col">
                                                Date
                                            </th>
                                            <th className="px-6 py-3 text-left text-base font-medium text-gray-500" scope="col">
                                                Matter Title
                                            </th>
                                            <th className="px-6 py-3 text-left text-base font-medium text-gray-500" scope="col">
                                                Client Name
                                            </th>
                                            <th className="px-6 py-3 text-left text-base font-medium text-gray-500" scope="col">
                                                Activity Type
                                            </th>
                                            <th
                                                className="px-6 py-3 text-center text-base font-medium text-gray-500 cursor-pointer select-none"
                                                scope="col"
                                                onClick={handleTimesheetSort}
                                                title="Sort by Total Hours"
                                            >
                                                <div className="flex items-center justify-center gap-2">
                                                    Total Hours
                                                    {getSortIcon(timesheetSort.direction)}
                                                </div>
                                            </th>
                                            <th className="px-6 py-3 text-center text-base font-medium text-gray-500" scope="col">
                                                Status
                                            </th>
                                            <th className="px-6 py-3 text-center text-base font-medium text-gray-500" scope="col">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {sortedTimesheetEntries.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <p className="text-lg font-medium">No timesheet entries found</p>
                                                        <p className="text-sm">This user has no timesheet entries yet</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            sortedTimesheetEntries.map((entry) => (
                                                <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        <div className="text-base text-gray-900">{entry.date}</div>
                                                    </td>

                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-base text-gray-900">{entry.matterTitle}</div>
                                                    </td>

                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-base text-gray-900">{entry.clientName}</div>
                                                    </td>

                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-base text-gray-900">{entry.activityType}</div>
                                                    </td>

                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        <div className="text-base text-gray-900">{entry.totalHours.toFixed(1)}</div>
                                                    </td>

                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        <span
                                                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getTimesheetStatusBadgeClass(
                                                                entry.status
                                                            )}`}
                                                        >
                                                            {getTimesheetStatusText(entry.status)}
                                                        </span>
                                                    </td>

                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        <button
                                                            onClick={() => router.push(`/timesheet/timesheets/${entry.id}`)}
                                                            className="text-base text-blue-600 hover:text-blue-800 hover:underline font-medium"
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
                        )}
                    </div>
                )}
                {/* USER TASKS TAB */}
                {/* {activeTab === 'tasks' && (
                    <div className="p-6">
                        <MyTaskPage key={userId} />
                    </div>
                )} */}
                {activeTab === 'tasks' && <MyTaskPage userId={Number(params.userId)} />}
            </div>
        </div>
    );
}

