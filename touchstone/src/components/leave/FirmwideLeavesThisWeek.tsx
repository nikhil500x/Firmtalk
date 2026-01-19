'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Mail, RefreshCw, X, Plus, Calendar, Users, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

interface LeaveData {
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
    location: string | null;
    role: string;
  };
  reviewer: {
    id: number;
    name: string;
  } | null;
}

interface FirmwideLeaveResponse {
  leaves: LeaveData[];
  weekStart: string;
  weekEnd: string;
  totalCount: number;
}

export default function FirmwideLeavesThisWeek() {
  const [leaves, setLeaves] = useState<LeaveData[]>([]);
  const [weekStart, setWeekStart] = useState<string>('');
  const [weekEnd, setWeekEnd] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Email state
  const [emailInputs, setEmailInputs] = useState<string[]>(['']);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const fetchFirmwideLeaves = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/leaves/firmwide-this-week`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('You do not have permission to view firmwide leaves');
        }
        throw new Error('Failed to fetch firmwide leaves');
      }

      const data = await response.json();
      if (data.success) {
        const result: FirmwideLeaveResponse = data.data;
        setLeaves(result.leaves);
        setWeekStart(result.weekStart);
        setWeekEnd(result.weekEnd);
      } else {
        throw new Error(data.message || 'Failed to fetch leaves');
      }
    } catch (err) {
      console.error('Error fetching firmwide leaves:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFirmwideLeaves();
  }, [fetchFirmwideLeaves]);

  const handleAddEmail = () => {
    setEmailInputs([...emailInputs, '']);
  };

  const handleRemoveEmail = (index: number) => {
    if (emailInputs.length > 1) {
      setEmailInputs(emailInputs.filter((_, i) => i !== index));
    }
  };

  const handleEmailChange = (index: number, value: string) => {
    const newEmails = [...emailInputs];
    newEmails[index] = value;
    setEmailInputs(newEmails);
  };

  const handleSendReport = async () => {
    // Filter out empty emails and validate
    const validEmails = emailInputs.filter(email => email.trim() !== '');
    
    if (validEmails.length === 0) {
      setEmailError('Please enter at least one email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = validEmails.filter(email => !emailRegex.test(email.trim()));
    if (invalidEmails.length > 0) {
      setEmailError(`Invalid email addresses: ${invalidEmails.join(', ')}`);
      return;
    }

    setIsSendingEmail(true);
    setEmailError(null);
    setEmailSuccess(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/leaves/email-report`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emails: validEmails.map(e => e.trim()),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send report');
      }

      if (data.success) {
        setEmailSuccess(`Report sent successfully to ${data.data.recipientCount} recipient(s)`);
        setEmailInputs(['']); // Reset email inputs
      } else {
        throw new Error(data.message || 'Failed to send report');
      }
    } catch (err) {
      console.error('Error sending report:', err);
      setEmailError(err instanceof Error ? err.message : 'Failed to send report');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusStyles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    return statusStyles[status] || 'bg-gray-100 text-gray-800';
  };

  const formatLeaveType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading firmwide leaves...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header with week info and refresh */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Week: {formatDate(weekStart)} - {formatDate(weekEnd)}
            </h3>
            <p className="text-sm text-gray-500">
              {leaves.length} leave{leaves.length !== 1 ? 's' : ''} this week
            </p>
          </div>
        </div>
        <button
          onClick={fetchFirmwideLeaves}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Email Report Section */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="w-5 h-5 text-blue-600" />
          <h4 className="font-medium text-gray-900">Email Report</h4>
        </div>
        
        <div className="space-y-2 mb-3">
          {emailInputs.map((email, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(index, e.target.value)}
                placeholder="Enter email address"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              {emailInputs.length > 1 && (
                <button
                  onClick={() => handleRemoveEmail(index)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleAddEmail}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add another email
          </button>
          
          <button
            onClick={handleSendReport}
            disabled={isSendingEmail}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSendingEmail ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                Send Report
              </>
            )}
          </button>
        </div>

        {emailError && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded">
            {emailError}
          </div>
        )}
        {emailSuccess && (
          <div className="mt-3 text-sm text-green-600 bg-green-50 p-2 rounded">
            {emailSuccess}
          </div>
        )}
      </div>

      {/* Leaves Table */}
      {leaves.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No leaves scheduled for this week</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Leave Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Start Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  End Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Days
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Location
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {leaves.map((leave) => (
                <tr key={leave.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{leave.user.name}</p>
                      <p className="text-sm text-gray-500">{leave.user.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                    {leave.user.role}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {formatLeaveType(leave.leaveType)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(leave.startDate)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(leave.endDate)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                    {leave.totalDays}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full capitalize ${getStatusBadge(leave.status)}`}>
                      {leave.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                    {leave.user.location || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

