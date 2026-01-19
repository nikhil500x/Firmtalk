'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { API_ENDPOINTS } from '@/lib/api';
import { Calendar, Clock, Plus, ExternalLink, AlertCircle } from 'lucide-react';
import WidgetContainer from './WidgetContainer';
import { Button } from '@/components/ui/button';
import LeaveDialog from '@/components/leave/LeaveDialog';

interface Leave {
  id: number;
  status: string;
  leaveType: string;
  startDate: string;
  endDate: string;
}

interface LeavesSummary {
  pending: number;
  privilege: {
    available: number;
    total: number;
    applied: number;  // ✅ ADD THIS
    pending: number;  // ✅ ADD THIS
  };
  maternity?: {
    available: number;
    total: number;
    applied: number;  // ✅ ADD THIS
    pending: number;  // ✅ ADD THIS
  } | null;
  paternity?: {
    available: number;
    total: number;
    applied: number;  // ✅ ADD THIS
    pending: number;  // ✅ ADD THIS
  } | null;
  sickLeavesTaken: number;
  upcoming?: number;
}


export default function LeavesWidget() {
  const { user } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<LeavesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummary = async (isRefresh = false) => {
    if (!user?.id) return;
    
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Fetch leaves for pending and upcoming count
      const leavesResponse = await fetch(API_ENDPOINTS.leaves.byUser(user.id), { 
        credentials: 'include' 
      });

      if (!leavesResponse.ok) {
        throw new Error('Failed to fetch leaves data');
      }

      const leavesData = await leavesResponse.json();

      if (leavesData.success) {
        const leaves: Leave[] = leavesData.data || [];
        const now = new Date();
        const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        const pending = leaves.filter((leave) => leave.status === 'pending').length;

        const upcoming = leaves.filter((leave) => {
          const startDate = new Date(leave.startDate);
          return startDate >= now && startDate <= nextMonth && leave.status === 'approved';
        }).length;

        // Fetch leave balance summary
        const balanceResponse = await fetch(API_ENDPOINTS.leaves.balanceSummary(user.id), {
          credentials: 'include',
        });

        if (!balanceResponse.ok) {
          throw new Error('Failed to fetch leave balance');
        }

        const balanceData = await balanceResponse.json();

        if (balanceData.success && balanceData.data) {
          setSummary({
            pending,
            upcoming,
            privilege: balanceData.data.privilege,
            maternity: balanceData.data.maternity,
            paternity: balanceData.data.paternity,
            sickLeavesTaken: balanceData.data.sickLeavesTaken,
          });
          setLastUpdated(new Date());
        }
      }
    } catch (err) {
      console.error('Error fetching leaves summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to load leave data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchSummary();
    }
  }, [user?.id]);

  const handleWidgetClick = () => {
    router.push('/leave');
  };

  const handleApplyLeave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLeaveDialogOpen(true);
  };

  const handleLeaveSuccess = () => {
    setIsLeaveDialogOpen(false);
    fetchSummary(true);
  };

  const emptyState = !loading && !error && summary && 
    summary.pending === 0 && 
    summary.privilege.available === 0 && 
    (!summary.maternity || summary.maternity.available === 0) &&
    (!summary.paternity || summary.paternity.available === 0) &&
    summary.sickLeavesTaken === 0 &&
    (!summary.upcoming || summary.upcoming === 0);

  return (
    <>
      <WidgetContainer
        title="Leaves"
        icon={<Calendar className="w-5 h-5 text-blue-600" />}
        loading={loading}
        error={error}
        onRefresh={() => fetchSummary(true)}
        onRetry={() => fetchSummary()}
        lastUpdated={lastUpdated}
        onClick={handleWidgetClick}
        aria-label="Leaves Summary - Click to view all leaves"
        footer={
          <div className="flex items-center justify-between w-full">
            <Link
              href="/leave"
              onClick={(e) => e.stopPropagation()}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              View All
              <ExternalLink className="w-3 h-3" />
            </Link>
            <Button
              size="sm"
              onClick={handleApplyLeave}
              className="h-8"
            >
              <Plus className="w-4 h-4 mr-1" />
              Apply Leave
            </Button>
          </div>
        }
      >
        {emptyState ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm text-gray-600 mb-2">No leave data yet</p>
            <p className="text-xs text-gray-500 mb-4">Apply for leave to see your balance and requests</p>
            <Button size="sm" onClick={handleApplyLeave} variant="outline">
              <Plus className="w-4 h-4 mr-1" />
              Apply for Leave
            </Button>
          </div>
        ) : summary ? (
          <div className="space-y-4">
            {/* Pending Alert */}
            {summary.pending > 0 && (
              <div className="flex items-center gap-2 text-yellow-700 text-sm bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">{summary.pending} pending request{summary.pending !== 1 ? 's' : ''}</span>
              </div>
            )}

            

            {/* Leave Balance */}
            <div className="pt-3 border-t">
              <div className="text-xs text-gray-600 font-medium mb-3">Leave Balance</div>
              <div className="space-y-2">
                {/* Privilege Leave */}
                <div className="flex flex-col p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-blue-600 font-medium">Privilege Leave</div>
                    <div className="text-xs text-blue-500">
                      {summary.privilege.available} of {summary.privilege.total} remaining
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <div className="text-xs text-gray-500">Taken</div>
                      <div className="text-lg font-bold text-blue-700">{summary.privilege.applied} days</div>
                    </div>
                    {summary.privilege.pending > 0 && (
                      <div className="flex flex-col items-end">
                        <div className="text-xs text-orange-500">Pending</div>
                        <div className="text-sm font-semibold text-orange-600">{summary.privilege.pending} days</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Maternity Leave (if applicable) */}
                {summary.maternity && (
                  <div className="flex flex-col p-3 rounded-lg bg-pink-50 border border-pink-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-pink-600 font-medium">Maternity Leave</div>
                      <div className="text-xs text-pink-500">
                        {summary.maternity.available} of {summary.maternity.total} remaining
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <div className="text-xs text-gray-500">Taken</div>
                        <div className="text-lg font-bold text-pink-700">{summary.maternity.applied} days</div>
                      </div>
                      {summary.maternity.pending > 0 && (
                        <div className="flex flex-col items-end">
                          <div className="text-xs text-orange-500">Pending</div>
                          <div className="text-sm font-semibold text-orange-600">{summary.maternity.pending} days</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Paternity Leave (if applicable) */}
                {summary.paternity && (
                  <div className="flex flex-col p-3 rounded-lg bg-green-50 border border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-green-600 font-medium">Paternity Leave</div>
                      <div className="text-xs text-green-500">
                        {summary.paternity.available} of {summary.paternity.total} remaining
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <div className="text-xs text-gray-500">Taken</div>
                        <div className="text-lg font-bold text-green-700">{summary.paternity.applied} days</div>
                      </div>
                      {summary.paternity.pending > 0 && (
                        <div className="flex flex-col items-end">
                          <div className="text-xs text-orange-500">Pending</div>
                          <div className="text-sm font-semibold text-orange-600">{summary.paternity.pending} days</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Sick Leaves Taken */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50 border border-orange-200">
                  <div className="flex flex-col">
                    <div className="text-xs text-orange-600 font-medium">Sick Leaves Taken</div>
                    <div className="text-lg font-bold text-orange-700">{summary.sickLeavesTaken} days</div>
                  </div>
                  <div className="text-xs text-orange-500">
                    This year
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </WidgetContainer>

      {/* Leave Dialog */}
      <LeaveDialog
        open={isLeaveDialogOpen}
        onOpenChange={setIsLeaveDialogOpen}
        mode="create"
        onSuccess={handleLeaveSuccess}
      />
    </>
  );
}
