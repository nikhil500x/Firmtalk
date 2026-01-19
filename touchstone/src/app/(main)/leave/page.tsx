'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Plus } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import LeavesTable from '@/components/leave/LeavesTable';
import LeaveDialog from '@/components/leave/LeaveDialog';
import ViewLeaveDialog from '@/components/leave/ViewLeaveDialog';
import HolidaysList from '@/components/hr/HolidaysList';
import FirmwideLeavesThisWeek from '@/components/leave/FirmwideLeavesThisWeek';
import { API_ENDPOINTS } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export const dynamic = 'force-dynamic';

interface LeaveBalance {
  leaveType: string;
  year: number;
  totalAllocated: number;
  balance: number;
  pending: number;
  applied: number;
}

function LeavePageContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const statusParam = searchParams.get('status') as
  | 'pending'
  | 'approved'
  | 'rejected'
  | null;
  const { user, role } = useAuth();
  const [activeTab, setActiveTab] = useState<'leaves' | 'holidays' | 'firmwide'>('leaves');
  
  // Check if user can see firmwide tab (HR, Admin, Superadmin)
  const roleName = role?.name?.toLowerCase().replace(/\s+/g, '') || '';
  const canViewFirmwide = ['superadmin', 'admin', 'hr'].includes(roleName);
  const [leaveRefreshTrigger, setLeaveRefreshTrigger] = useState(0);
  const [isAddLeaveDialogOpen, setIsAddLeaveDialogOpen] = useState(false);
  const [isViewLeaveDialogOpen, setIsViewLeaveDialogOpen] = useState(false);
  const [selectedLeaveId, setSelectedLeaveId] = useState<number | undefined>(undefined);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);

  // Set active tab based on URL parameter
  useEffect(() => {
    if (tabParam === 'leaves') {
      setActiveTab('leaves');
    } else if (tabParam === 'holidays') {
      setActiveTab('holidays');
    } else if (tabParam === 'firmwide' && canViewFirmwide) {
      setActiveTab('firmwide');
    }
  }, [tabParam, canViewFirmwide]);

  useEffect(() => {
    if (user?.id) {
      fetchLeaveBalances();
    }
  }, [user?.id]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const fetchLeaveBalances = async () => {
    if (!user?.id) return;

    try {
      const year = new Date().getFullYear();
      const response = await fetch(API_ENDPOINTS.leaves.balance(user.id, year), {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLeaveBalances(data.data);
        }
      }
    } catch (err) {
      console.error('Error fetching leave balances:', err);
    }
  };
  const handleAddLeave = () => {
    setIsAddLeaveDialogOpen(true);
  };

  const handleLeaveAdded = () => {
    setLeaveRefreshTrigger((prev) => prev + 1);
    fetchLeaveBalances(); // ADD THIS LINE - Refresh balances
    setIsAddLeaveDialogOpen(false);
  };

  const handleViewLeave = (leaveId: number) => {
    setSelectedLeaveId(leaveId);
    setIsViewLeaveDialogOpen(true);
  };

  const handleViewDialogClose = () => {
    setIsViewLeaveDialogOpen(false);
    setSelectedLeaveId(undefined);
  };

  const handleLeaveActionSuccess = () => {
    setLeaveRefreshTrigger((prev) => prev + 1);
    fetchLeaveBalances(); // ADD THIS LINE - Refresh balances
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  // Get current balance for selected leave type
  const getCurrentBalance = (leaveType?: string) => {
    const type = leaveType;
    if (!type) return null;
    return leaveBalances.find(b => b.leaveType === type);
  };


  const currentBalance = getCurrentBalance('regular');
  return (
    <>
      {/* ADD LEAVE DIALOG */}
      <LeaveDialog
        open={isAddLeaveDialogOpen}
        onOpenChange={setIsAddLeaveDialogOpen}
        mode="create"
        onSuccess={handleLeaveAdded}
      />

      {/* VIEW LEAVE DIALOG */}
      <ViewLeaveDialog
        open={isViewLeaveDialogOpen}
        onOpenChange={handleViewDialogClose}
        leaveId={selectedLeaveId}
        onSuccess={handleLeaveActionSuccess}
      />

      <div className="p-6">
        {/* MAIN CONTENT AREA */}
        <div className="bg-white rounded-[22px] shadow-sm border border-gray-200 overflow-hidden">
          {/* LEAVE BALANCE INFO */}
          {currentBalance && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
              <table className="w-full text-center text-sm">
                <thead>
                  <tr className="border-b border-blue-200">
                    <th className="py-2 text-blue-700 font-medium">Available</th>
                    <th className="py-2 text-blue-700 font-medium">Total</th>
                    <th className="py-2 text-blue-700 font-medium">Pending</th>
                    <th className="py-2 text-blue-700 font-medium">Approved</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-2 text-blue-900 font-semibold">{currentBalance.balance}</td>
                    <td className="py-2 text-blue-900 font-semibold">{currentBalance.totalAllocated}</td>
                    <td className="py-2 text-blue-900 font-semibold">{currentBalance.pending}</td>
                    <td className="py-2 text-blue-900 font-semibold">{currentBalance.applied}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* TABS AND ACTION BUTTON */}
          <div className="flex items-center justify-between px-6 mt-6 border-b border-gray-200">
            {/* TABS NAVIGATION */}
            <div className="flex items-center gap-0">
              <button
                onClick={() => setActiveTab('leaves')}
                className={`px-3 py-2.5 text-base font-semibold transition-colors ${activeTab === 'leaves'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
                  }`}
              >
                Leave Requests
              </button>
              <button
                onClick={() => setActiveTab('holidays')}
                className={`px-3 py-2.5 text-base font-semibold transition-colors ${activeTab === 'holidays'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
                  }`}
              >
                Holiday List
              </button>
              {canViewFirmwide && (
                <button
                  onClick={() => setActiveTab('firmwide')}
                  className={`px-3 py-2.5 text-base font-semibold transition-colors ${activeTab === 'firmwide'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                  Firmwide Leaves This Week
                </button>
              )}
            </div>

            {/* APPLY FOR LEAVE BUTTON - Only show on leaves tab */}
            {activeTab === 'leaves' && (
              <button
                onClick={handleAddLeave}
                className="mb-2 flex items-center justify-center gap-2 px-4 py-2.5 
                        bg-gradient-to-b from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-colors duration-200 shadow-md py-3"
              >
                <Plus size={20} className="stroke-[2.5]" />
                <span className="text-base font-medium">
                  Apply for Leave
                </span>
              </button>
            )}
          </div>

          {/* TAB CONTENT */}
          {activeTab === 'leaves' && (
            <LeavesTable
              refreshTrigger={leaveRefreshTrigger}
              onViewLeave={handleViewLeave}
              statusFromUrl={statusParam} 
            />
          )}

          {activeTab === 'holidays' && (
            <HolidaysList />
          )}

          {activeTab === 'firmwide' && canViewFirmwide && (
            <FirmwideLeavesThisWeek />
          )}
        </div>
      </div>
    </>
  );
}

export default function LeavePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <LeavePageContent />
    </Suspense>
  );
}