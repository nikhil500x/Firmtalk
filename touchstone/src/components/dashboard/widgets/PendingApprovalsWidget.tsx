'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, ChevronRight, AlertCircle, Clock } from 'lucide-react';
import WidgetContainer from './WidgetContainer';

interface PendingApprovalsData {
  leaves: {
    count: number;
    canApprove: boolean;
  };
  total: number;
}

interface PendingApprovalsWidgetProps {
  data: PendingApprovalsData | null;
  isLoading: boolean;
  error: string | null;
}

export default function PendingApprovalsWidget({
  data,
  isLoading,
  error,
}: PendingApprovalsWidgetProps) {
  const router = useRouter();

  const handleLeavesClick = () => {
    router.push('/leave?status=pending');
  };

  // Empty state - no pending approvals or no permissions
  const emptyState = !data || (data.total === 0 && !data.leaves.canApprove);
  const noPendingItems = data && data.total === 0 && data.leaves.canApprove;

  // Format the count for display (99+ for 100 or more)
  const displayCount = data && data.total > 0 
    ? data.total > 99 ? '99+' : data.total.toString()
    : '0';

  // Custom icon with badge
  const iconWithBadge = (
    <div className="relative">
      <Calendar className="w-5 h-5 text-amber-600" />
      {data && data.total > 0 && (
        <span className="absolute -top-2 -right-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-amber-500 rounded-full border-2 border-white">
          {displayCount}
        </span>
      )}
    </div>
  );

  return (
    <WidgetContainer
      title="Pending Approvals"
      icon={iconWithBadge}
      loading={isLoading}
      error={error}
    >
      {emptyState ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-sm text-gray-600 mb-2">No approval permissions</p>
          <p className="text-xs text-gray-500">Contact admin for access</p>
        </div>
      ) : noPendingItems ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
            <Calendar className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-sm text-gray-600 mb-2">All caught up!</p>
          <p className="text-xs text-gray-500">No pending leave requests</p>
        </div>
      ) : data ? (
        <div className="space-y-3">
          {/* Pending Leaves */}
          {data.leaves.canApprove && (
            <button
              onClick={handleLeavesClick}
              className="w-full flex items-center justify-between p-4 rounded-lg border-2 border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  data.leaves.count > 0 
                    ? 'bg-amber-100 text-amber-600' 
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  <Calendar className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="text-base font-semibold text-gray-900">Leave Requests</p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {data.leaves.count > 0 
                      ? `${data.leaves.count} pending approval${data.leaves.count !== 1 ? 's' : ''}`
                      : 'No pending leaves'
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {data.leaves.count > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full text-sm font-bold bg-amber-500 text-white">
                    {data.leaves.count}
                  </span>
                )}
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-amber-600 transition-colors" />
              </div>
            </button>
          )}

          {/* Action hint */}
          {data.total > 0 && (
            <div className="pt-2 mt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 text-center">
                Click to view and approve leave requests
              </p>
            </div>
          )}
        </div>
      ) : null}
    </WidgetContainer>
  );
}