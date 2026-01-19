'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, CheckCircle, Filter } from 'lucide-react';

interface UserStat {
  userId: number;
  name: string;
  email: string;
  role: string;
  location: string;
  openMatters: number;
  closedMatters: number;
}

export default function UserMatterStats() {
  const router = useRouter();
  const [userStats, setUserStats] = useState<UserStat[]>([]);
  const [allUserStats, setAllUserStats] = useState<UserStat[]>([]); // Store all users for filter options
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [officeFilter, setOfficeFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Fetch all users once on mount
  useEffect(() => {
    fetchUserStats();
  }, []);

  const fetchUserStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (officeFilter !== 'all') params.append('office', officeFilter);
      if (roleFilter !== 'all') params.append('role', roleFilter);
      
      const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/matters/user-statistics${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const stats = data.data;
          // Store all users on first load (when no filters applied)
          if (officeFilter === 'all' && roleFilter === 'all') {
            setAllUserStats(stats);
          }
          setUserStats(stats);
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

  // Fetch filtered users when filters change
  useEffect(() => {
    if (allUserStats.length > 0 || officeFilter !== 'all' || roleFilter !== 'all') {
      fetchUserStats();
    }
  }, [officeFilter, roleFilter]);

  // Get unique offices and roles for filters (from all users, not just filtered)
  const { offices, roles } = useMemo(() => {
    const uniqueOffices = Array.from(new Set(allUserStats.map(u => u.location).filter(Boolean))) as string[];
    const uniqueRoles = Array.from(new Set(allUserStats.map(u => u.role).filter(Boolean))) as string[];
    return {
      offices: uniqueOffices.sort(),
      roles: uniqueRoles.sort()
    };
  }, [allUserStats]);

  // Group users by office (backend already filters)
  const groupedByOffice = useMemo(() => {
    const grouped = userStats.reduce((acc, user) => {
      const office = user.location || 'Unknown';
      if (!acc[office]) {
        acc[office] = [];
      }
      acc[office].push(user);
      return acc;
    }, {} as Record<string, UserStat[]>);

    // Sort offices alphabetically
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [userStats]);

  const handleViewMatters = (userId: number, status: 'open' | 'closed') => {
    const statusMap: Record<string, string> = {
      'open': 'active',
      'closed': 'closed'
    };
    router.push(`/matter?user=${userId}&status=${statusMap[status]}`);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-800 text-sm">{error}</p>
            <button
              onClick={fetchUserStats}
              className="mt-2 text-xs text-red-600 hover:text-red-800 hover:underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden max-h-[80vh] flex flex-col">
      {/* Filters */}
      <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-xs font-medium text-gray-700">Filters:</span>
          </div>
          
          {/* Office Filter */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-600">Office:</label>
            <select
              value={officeFilter}
              onChange={(e) => setOfficeFilter(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All</option>
              {offices.map((office) => (
                <option key={office} value={office}>
                  {office}
                </option>
              ))}
            </select>
          </div>

          {/* Role Filter */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-600">Role:</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All</option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table - Grouped by Office */}
      <div className="overflow-y-auto flex-1">
        {groupedByOffice.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            No users found
          </div>
        ) : (
          groupedByOffice.map(([office, users]) => (
            <div key={office} className="border-b border-gray-200 last:border-b-0">
              {/* Office Header */}
              <div className="px-4 py-1.5 bg-blue-50 border-b border-gray-200 sticky top-0 z-10">
                <h3 className="text-xs font-semibold text-gray-900">
                  {office} ({users.length} {users.length === 1 ? 'user' : 'users'})
                </h3>
              </div>
              
              {/* Users Table */}
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-[41px] z-10">
                  <tr>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-3 py-1.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-3 py-1.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Open
                    </th>
                    <th className="px-3 py-1.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Closed
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.userId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div>
                          <div className="text-xs font-medium text-gray-900">{user.name || 'N/A'}</div>
                          <div className="text-[10px] text-gray-500 truncate max-w-[200px]">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-center">
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
                          {user.role}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleViewMatters(user.userId, 'open')}
                          disabled={user.openMatters === 0}
                          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
                            user.openMatters === 0
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-orange-600 hover:bg-orange-50'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          {user.openMatters}
                        </button>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleViewMatters(user.userId, 'closed')}
                          disabled={user.closedMatters === 0}
                          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
                            user.closedMatters === 0
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                        >
                          <CheckCircle className="w-3 h-3" />
                          {user.closedMatters}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

