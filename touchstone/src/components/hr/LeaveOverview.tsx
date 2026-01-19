'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AlertCircle, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { API_ENDPOINTS } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Pagination, { usePagination } from '@/components/Pagination';

interface UserLeaveBalance {
  userId: number;
  name: string;
  email: string;
  role: string;
  sickTaken: number;
  totalAllocated: number;
  balance: number;
  pending: number;
  applied: number;
  balancesByType: Array<{
    leaveType: string;
    totalAllocated: number;
    balance: number;
    pending: number;
    applied: number;
  }>;
}

type SortDirection = 'asc' | 'desc' | null;
type SortKey = 'name' | 'balance' | 'totalAllocated' | 'pending' | 'applied' | 'sickTaken';

export default function LeaveOverview() {
  const router = useRouter();
  const [userBalances, setUserBalances] = useState<UserLeaveBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey | null; direction: SortDirection }>({
    key: null,
    direction: null,
  });
  const currentYear = new Date().getFullYear();
const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const {
    currentPage,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    resetToFirstPage,
    getPaginatedData,
  } = usePagination(10);

  // Fetch all users' leave balances
  useEffect(() => {
    const fetchAllBalances = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          API_ENDPOINTS.leaves.balancesAll(selectedYear),
          {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch leave balances');
        }

        const data = await response.json();

        if (data.success) {
          setUserBalances(data.data);
          console.log(data.data);
        } else {
          setError(data.message || 'Failed to load leave balances');
        }
      } catch (err) {
        console.error('Fetch leave balances error:', err);
        setError('Failed to load leave balances. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllBalances();
  }, [selectedYear]);

  // Filter and sort balances
  const filteredBalances = useMemo(() => {
    return userBalances.filter((user) => {
      if (!searchQuery.trim()) return true;
      
      const query = searchQuery.toLowerCase();
      return (
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query)
      );
    });
  }, [userBalances, searchQuery]);

  const paginatedBalances = useMemo(() => {
    const sortedBalances = (() => {
      if (!sortConfig.key || !sortConfig.direction) return filteredBalances;

      const sorted = [...filteredBalances].sort((a, b) => {
        const aValue = a[sortConfig.key as SortKey];
        const bValue = b[sortConfig.key as SortKey];

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return aValue.localeCompare(bValue);
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return aValue - bValue;
        }

        return 0;
      });

      return sortConfig.direction === 'desc' ? sorted.reverse() : sorted;
    })();

    return getPaginatedData(sortedBalances);
  }, [filteredBalances, sortConfig, getPaginatedData]);

  useEffect(() => {
    resetToFirstPage();
  }, [searchQuery, sortConfig, resetToFirstPage]);

  const handleRowClick = (userId: number) => {
    router.push(`/hr/leaves/${userId}`);
  };

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        if (prev.direction === 'desc') return { key: null, direction: null };
        return { key, direction: 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const getSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key || !sortConfig.direction) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" aria-hidden="true" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ArrowUp className="h-4 w-4 text-blue-600" aria-hidden="true" />;
    }
    return <ArrowDown className="h-4 w-4 text-blue-600" aria-hidden="true" />;
  };

  if (isLoading) {
    return (
      <div className="px-6 py-12 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-500">Loading leave balances...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 py-12 text-center">
        <div className="flex flex-col items-center gap-2">
          <AlertCircle size={48} className="text-red-500" />
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      {/* HEADER */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Leave Balances Overview</h2>
        <p className="text-gray-600">View leave balances for all team members</p>
      </div>

      {/* SEARCH BAR */}
      <div className="flex w-full items-center justify-between gap-4 mb-6">
        <div className="w-full relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {Array.from({ length: 5 }).map((_, i) => {
            const year = currentYear - i;
            return (
              <option key={year} value={year}>
                {year}
              </option>
            );
          })}
        </select>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                  onClick={() => handleSort('name')}
                  title="Sort by Name"
                >
                  <div className="flex items-center gap-2">
                    Lawyer Name
                    {getSortIcon('name')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th 
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                  onClick={() => handleSort('balance')}
                  title="Sort by Available Balance"
                >
                  <div className="flex items-center justify-center gap-2">
                    Available Balance
                    {getSortIcon('balance')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                  onClick={() => handleSort('totalAllocated')}
                  title="Sort by Total Allocated"
                >
                  <div className="flex items-center justify-center gap-2">
                    Total 
                    {getSortIcon('totalAllocated')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                  onClick={() => handleSort('pending')}
                  title="Sort by Pending"
                >
                  <div className="flex items-center justify-center gap-2">
                    Pending
                    {getSortIcon('pending')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                  onClick={() => handleSort('applied')}
                  title="Sort by Applied"
                >
                  <div className="flex items-center justify-center gap-2">
                    Approved
                    {getSortIcon('applied')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                  onClick={() => handleSort('sickTaken')}
                  title="Sort by Applied"
                >
                  <div className="flex items-center justify-center gap-2">
                    Sick
                    {getSortIcon('sickTaken')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                      <p className="text-lg font-medium">Loading leave balances...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredBalances.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    {searchQuery ? 'No users found matching your search' : 'No leave balances found'}
                  </td>
                </tr>
              ) : (
                paginatedBalances.map((user) => (
                  <tr
                    key={user.userId}
                    onClick={() => handleRowClick(user.userId)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-lg font-bold text-green-600">{user.balance}</span>
                      <span className="text-sm text-gray-500 ml-1">days</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-medium text-gray-900">{user.totalAllocated}</span>
                      <span className="text-sm text-gray-500 ml-1">days</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-medium text-yellow-600">{user.pending}</span>
                      <span className="text-sm text-gray-500 ml-1">days</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-medium text-blue-600">{user.applied}</span>
                      <span className="text-sm text-gray-500 ml-1">days</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-medium text-blue-600">{user.sickTaken}</span>
                      <span className="text-sm text-gray-500 ml-1">days</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {!isLoading && filteredBalances.length > 0 && (
            <div className="px-6 py-4">
              <Pagination
                currentPage={currentPage}
                totalItems={filteredBalances.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                itemsPerPageOptions={[10, 25, 50, 100]}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}