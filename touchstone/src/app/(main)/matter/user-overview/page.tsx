'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Clock, CheckCircle, FileText } from 'lucide-react';
import { formatRoleDisplay } from '@/utils/roleDisplay';

interface UserStat {
  userId: number;
  name: string;
  email: string;
  role: string;
  openMatters: number;
  closedMatters: number;
  totalMatters: number;
}

export default function UserMatterOverviewPage() {
  const router = useRouter();
  const [userStats, setUserStats] = useState<UserStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserStats();
  }, []);

  const fetchUserStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/matters/user-statistics`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUserStats(data.data);
        } else {
          setError('Failed to fetch user statistics');
        }
      } else {
        setError('Failed to fetch user statistics');
      }
    } catch (err) {
      console.error('Error fetching user stats:', err);
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleViewMatters = (userId: number, status: 'active' | 'closed') => {
    // Map status to what the backend expects
    const statusMap: Record<string, string> = {
      'active': 'active',
      'closed': 'closed'
    };
    router.push(`/matter?user=${userId}&status=${statusMap[status]}`);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-[22px] shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-[22px] shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
              <button
                onClick={fetchUserStats}
                className="mt-2 text-sm text-red-600 hover:text-red-800 hover:underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="bg-white rounded-[22px] shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">User Matter Overview</h1>
              <p className="text-sm text-gray-500 mt-1">Track open and closed matters by user</p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Open Matters
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Closed Matters
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Matters
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {userStats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="w-12 h-12 text-gray-300" />
                      <p>No users found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                userStats.map((user) => (
                  <tr key={user.userId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {formatRoleDisplay(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => handleViewMatters(user.userId, 'active')}
                        disabled={user.openMatters === 0}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                          user.openMatters === 0
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-orange-600 hover:bg-orange-50'
                        }`}
                      >
                        <Clock className="w-4 h-4" />
                        {user.openMatters}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => handleViewMatters(user.userId, 'closed')}
                        disabled={user.closedMatters === 0}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                          user.closedMatters === 0
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                      >
                        <CheckCircle className="w-4 h-4" />
                        {user.closedMatters}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-medium text-gray-900">{user.totalMatters}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleViewMatters(user.userId, 'active')}
                          disabled={user.openMatters === 0}
                          className={`text-xs hover:underline ${
                            user.openMatters === 0
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-blue-600 hover:text-blue-800'
                          }`}
                        >
                          View Open
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={() => handleViewMatters(user.userId, 'closed')}
                          disabled={user.closedMatters === 0}
                          className={`text-xs hover:underline ${
                            user.closedMatters === 0
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-green-600 hover:text-green-800'
                          }`}
                        >
                          View Closed
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

