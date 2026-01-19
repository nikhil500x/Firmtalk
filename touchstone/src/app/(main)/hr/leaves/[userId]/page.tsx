'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Mail,
  Briefcase
} from 'lucide-react';
import { API_ENDPOINTS } from '@/lib/api';
import ViewLeaveDialog from '@/components/leave/ViewLeaveDialog';

interface LeaveBalance {
  leaveType: string;
  year: number;
  totalAllocated: number;
  balance: number;
  pending: number;
  applied: number;
}

interface Leave {
  id: number;
  userId: number;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: string;
  reviewedBy: number | null;
  reviewerComments: string | null;
  createdAt: string;
  updatedAt: string;
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

interface UserInfo {
  user_id: number;
  name: string;
  email: string;
  role: {
    name: string;
  };
}

export default function UserLeavePage() {
  const params = useParams();
  const router = useRouter();
  const userId = parseInt(params.userId as string);

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // === View Leave Dialog State (copied from LeavePageContent) ===
  const [isViewLeaveDialogOpen, setIsViewLeaveDialogOpen] = useState(false);
  const [selectedLeaveId, setSelectedLeaveId] = useState<number | undefined>(undefined);
  const [leaveRefreshTrigger, setLeaveRefreshTrigger] = useState(0);

  // Fetch user info, balances, and leaves
  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const year = new Date().getFullYear();

      // Fetch user info
      const userResponse = await fetch(API_ENDPOINTS.users.byId(userId), {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!userResponse.ok) throw new Error('Failed to fetch user information');
      const userData = await userResponse.json();
      if (userData.success) setUserInfo(userData.data);

      // Fetch leave balances
      const balanceResponse = await fetch(API_ENDPOINTS.leaves.balance(userId, year), {
        credentials: 'include',
      });
      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        if (balanceData.success) setLeaveBalances(balanceData.data);
      }

      // Fetch all leaves for this user
      const leavesResponse = await fetch(API_ENDPOINTS.leaves.byUser(userId), {
        credentials: 'include',
      });
      if (leavesResponse.ok) {
        const leavesData = await leavesResponse.json();
        if (leavesData.success) setLeaves(leavesData.data);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load user leave information. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) fetchData();
  }, [userId, leaveRefreshTrigger]); // Re-fetch when refreshTrigger changes

  // ============================================================================
  // VIEW LEAVE HANDLERS (exact pattern from original LeavePageContent)
  // ============================================================================

  const handleViewLeave = (leaveId: number) => {
    setSelectedLeaveId(leaveId);
    setIsViewLeaveDialogOpen(true);
  };

  const handleViewDialogClose = () => {
    setIsViewLeaveDialogOpen(false);
    setSelectedLeaveId(undefined);
  };

  const handleLeaveActionSuccess = () => {
    setLeaveRefreshTrigger((prev) => prev + 1); // Triggers refetch
  };

  const handleBack = () => {
    router.push('/hr?tab=leaves');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getLeaveTypeColor = (type: string) => {
    switch (type) {
      case 'regular': return 'bg-blue-500';
      case 'maternity': return 'bg-pink-500';
      case 'paternity': return 'bg-indigo-500';
      default: return 'bg-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-500">Loading user leave information...</p>
        </div>
      </div>
    );
  }

  if (error || !userInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-2">
          <AlertCircle size={48} className="text-red-500" />
          <p className="text-red-600">{error || 'Failed to load user information'}</p>
          <button
            onClick={handleBack}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Calculate statistics
  const stats = {
    totalLeaves: leaves.length,
    pendingLeaves: leaves.filter(l => l.status === 'pending').length,
    approvedLeaves: leaves.filter(l => l.status === 'approved').length,
    rejectedLeaves: leaves.filter(l => l.status === 'rejected').length,
  };

  return (
    <>
      {/* VIEW LEAVE DIALOG (exact pattern from original) */}
      <ViewLeaveDialog
        open={isViewLeaveDialogOpen}
        onOpenChange={handleViewDialogClose}
        leaveId={selectedLeaveId}
        onSuccess={handleLeaveActionSuccess}
      />

      <div className="px-6 py-6">
        {/* BACK BUTTON */}
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back to Leave Balances</span>
        </button>

        {/* USER INFO CARD */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <User size={32} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{userInfo.name}</h1>
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Mail size={16} />
                  <span>{userInfo.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Briefcase size={16} />
                  <span className="capitalize">{userInfo.role.name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LEAVE BALANCE CARDS */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Leave Balances ({new Date().getFullYear()})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {leaveBalances.map((balance) => (
              <div key={balance.leaveType} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-3 h-3 rounded-full ${getLeaveTypeColor(balance.leaveType)}`}></div>
                  <h3 className="text-sm font-medium text-gray-900 capitalize">{balance.leaveType} Leave</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-600">Available:</span><span className="font-bold text-green-600">{balance.balance} days</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600">Total:</span><span className="font-medium text-gray-900">{balance.totalAllocated} days</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600">Pending:</span><span className="font-medium text-yellow-600">{balance.pending} days</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600">Applied:</span><span className="font-medium text-blue-600">{balance.applied} days</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* STATISTICS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* ... stats cards unchanged ... */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-600 rounded-lg"><Calendar size={20} className="text-white" /></div>
              <div><p className="text-xs font-medium text-blue-600">Total Leaves</p><p className="text-2xl font-bold text-blue-900">{stats.totalLeaves}</p></div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4 border border-yellow-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-yellow-600 rounded-lg"><Clock size={20} className="text-white" /></div>
              <div><p className="text-xs font-medium text-yellow-600">Pending</p><p className="text-2xl font-bold text-yellow-900">{stats.pendingLeaves}</p></div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-600 rounded-lg"><CheckCircle size={20} className="text-white" /></div>
              <div><p className="text-xs font-medium text-green-600">Approved</p><p className="text-2xl font-bold text-green-900">{stats.approvedLeaves}</p></div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border border-red-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-red-600 rounded-lg"><XCircle size={20} className="text-white" /></div>
              <div><p className="text-xs font-medium text-red-600">Rejected</p><p className="text-2xl font-bold text-red-900">{stats.rejectedLeaves}</p></div>
            </div>
          </div>
        </div>

        {/* LEAVE HISTORY TABLE */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Leave History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leave Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Date</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leaves.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No leave records found</td></tr>
                ) : (
                  leaves.map((leave) => (
                    <tr
                      key={leave.id}
                      onClick={() => handleViewLeave(leave.id)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                          {leave.leaveType}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(leave.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(leave.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">{leave.totalDays}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(leave.status)}`}>
                          {leave.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900"><div className="max-w-xs truncate">{leave.reason}</div></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}