'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { API_ENDPOINTS } from '@/lib/api';

interface LeaveStats {
  totalLeaves: number;
  pendingLeaves: number;
  approvedLeaves: number;
  rejectedLeaves: number;
  totalDaysUsed: number;
  leavesByType: {
    sick: number;
    casual: number;
    earned: number;
    maternity: number;
    paternity: number;
    unpaid: number;
  };
}

export default function LeaveOverview() {
  const [stats, setStats] = useState<LeaveStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);

  // Get current user ID from session
  useEffect(() => {
    const fetchUserSession = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/profile`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setUserId(data.data.user.user_id);
          }
        }
      } catch (err) {
        console.error('Error fetching user session:', err);
      }
    };

    fetchUserSession();
  }, []);

  // Fetch leave statistics
  useEffect(() => {
    if (!userId) return;

    const fetchStats = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(API_ENDPOINTS.leaves.stats(userId), {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch leave statistics');
        }

        const data = await response.json();

        if (data.success) {
          setStats(data.data);
        } else {
          setError(data.message || 'Failed to load leave statistics');
        }
      } catch (err) {
        console.error('Fetch leave stats error:', err);
        setError('Failed to load leave statistics. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [userId]);

  if (isLoading) {
    return (
      <div className="px-6 py-12 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-500">Loading leave overview...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="px-6 py-12 text-center">
        <div className="flex flex-col items-center gap-2">
          <AlertCircle size={48} className="text-red-500" />
          <p className="text-red-600">{error || 'Failed to load leave overview'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Leaves */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-600 rounded-lg">
              <Calendar size={24} className="text-white" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-blue-600 mb-1">Total Leaves</p>
            <p className="text-3xl font-bold text-blue-900">{stats.totalLeaves}</p>
            <p className="text-xs text-blue-600 mt-1">This year</p>
          </div>
        </div>

        {/* Pending Leaves */}
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 border border-yellow-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-600 rounded-lg">
              <Clock size={24} className="text-white" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-yellow-600 mb-1">Pending</p>
            <p className="text-3xl font-bold text-yellow-900">{stats.pendingLeaves}</p>
            <p className="text-xs text-yellow-600 mt-1">Awaiting approval</p>
          </div>
        </div>

        {/* Approved Leaves */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-600 rounded-lg">
              <CheckCircle size={24} className="text-white" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-green-600 mb-1">Approved</p>
            <p className="text-3xl font-bold text-green-900">{stats.approvedLeaves}</p>
            <p className="text-xs text-green-600 mt-1">{stats.totalDaysUsed} days used</p>
          </div>
        </div>

        {/* Rejected Leaves */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-600 rounded-lg">
              <XCircle size={24} className="text-white" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-red-600 mb-1">Rejected</p>
            <p className="text-3xl font-bold text-red-900">{stats.rejectedLeaves}</p>
            <p className="text-xs text-red-600 mt-1">Not approved</p>
          </div>
        </div>
      </div>

      {/* LEAVE BREAKDOWN BY TYPE */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Leave Balance by Type</h3>
        
        <div className="space-y-4">
          {/* Sick Leave */}
          <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              <span className="text-sm font-medium text-gray-900">Sick Leave</span>
            </div>
            <span className="text-sm font-bold text-gray-900">{stats.leavesByType.sick} days</span>
          </div>

          {/* Casual Leave */}
          <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-sm font-medium text-gray-900">Casual Leave</span>
            </div>
            <span className="text-sm font-bold text-gray-900">{stats.leavesByType.casual} days</span>
          </div>

          {/* Earned Leave */}
          <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm font-medium text-gray-900">Earned Leave</span>
            </div>
            <span className="text-sm font-bold text-gray-900">{stats.leavesByType.earned} days</span>
          </div>

          {/* Maternity Leave */}
          <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-pink-500"></div>
              <span className="text-sm font-medium text-gray-900">Maternity Leave</span>
            </div>
            <span className="text-sm font-bold text-gray-900">{stats.leavesByType.maternity} days</span>
          </div>

          {/* Paternity Leave */}
          <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
              <span className="text-sm font-medium text-gray-900">Paternity Leave</span>
            </div>
            <span className="text-sm font-bold text-gray-900">{stats.leavesByType.paternity} days</span>
          </div>

          {/* Unpaid Leave */}
          <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-gray-500"></div>
              <span className="text-sm font-medium text-gray-900">Unpaid Leave</span>
            </div>
            <span className="text-sm font-bold text-gray-900">{stats.leavesByType.unpaid} days</span>
          </div>
        </div>
      </div>
    </div>
  );
}

