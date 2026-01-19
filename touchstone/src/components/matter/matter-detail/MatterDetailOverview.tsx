'use client';

import { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '@/lib/api';
import { formatRoleDisplay } from '@/utils/roleDisplay';
import ResolveConflictSection from './ResolveConflictDialog';
import CurrencyBadge from '@/components/ui/currency-badge';
import { formatAmountWithCurrency, type CurrencyCode } from '@/lib/currencyUtils';

interface ConflictData {
  conflictId: number;
  raisedBy: number;
  raiserName: string;
  conflictType: string;
  conflictDescription: string;
  conflictDetails?: string;
  severity: string;
  status: string;
  resolvedBy?: number;
  resolverName?: string | null;
  resolutionNotes?: string | null;
  raisedAt: string;
  resolvedAt?: string | null;
}

interface MatterData {
  id: number;
  matterTitle: string;
  client: {
    id?: number;
    name: string;
    industry?: string;
    website?: string | null;
    address?: string;
    group?: {
      group_id: number;
      name: string;
      description?: string | null;
      active_status: boolean;
    };
    contacts?: Array<{
      id: number;
      name: string;
      number?: string;
      email: string;
      phone?: string;
      designation?: string;
      isPrimary?: boolean;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
  status: string;
  practiceArea?: string;
  matterType?: string;
  description?: string;
  startDate?: string;
  estimatedDeadline?: string;
  estimatedValue?: number;
  currency?: string;
  billingRateType?: string;
  opposingPartyName?: string;
  assignedLawyer?: {
    id: number;
    name: string;
    email: string;
    phone?: string;
    practiceArea?: string | null;
    role?: string;
    serviceType?: string;
    hourlyRate?: number | string;
    [key: string]: unknown;
  };
  assignedLeads?: Array<{
    userId: number;
    name: string;
    email: string;
    phone?: string;
    practiceArea?: string | null;
    serviceType: string;
    hourlyRate?: number;
    isLead: boolean;
  }>;
  teamMembers?: Array<{
    userId: number;
    name: string;
    email?: string;
    phone?: string;
    practiceArea?: string;
    hourlyRate?: number;
    role?: string;
    userRole?: string;
    matterRole?: string;
    serviceType?: string;
    assignedAt?: string;
    [key: string]: unknown;
  }>;
  hasConflict?: boolean;
  conflictStatus?: string | null;
  conflicts?: Array<{
    conflictId: number;
    conflictDescription: string;
    conflictType: string;
    severity: string;
    raisedAt: string;
    raiserName: string;
    resolutionNotes?: string;
    resolverName?: string;
    resolvedAt?: string;
  }>;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
  matterCreationRequestedBy?: {
    id: number;
    name: string;
    email: string;
  } | null;
  [key: string]: unknown;
}

interface MatterOverviewProps {
  matterId: number;
  matterData?: MatterData;
}

export default function MatterDetailOverview({ matterId, matterData }: MatterOverviewProps) {
  const [matterDetails, setMatterDetails] = useState<MatterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const fetchMatterDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching matter data for ID:', matterId);
      const response = await fetch(API_ENDPOINTS.matters.byId(matterId), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch matter: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('API Response:', result);

      if (result.success && result.data) {
        setMatterDetails(result.data);
      } else {
        throw new Error('Invalid response format from API');
      }
    } catch (err) {
      console.error('Error loading matter data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load matter details');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (matterId) {
      fetchMatterDetails();
    }
  }, [matterId, matterData]);

  const handleResolveConflict = async (conflictId: number, resolutionNotes?: string) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.conflicts.resolve(conflictId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ resolution_notes: resolutionNotes }),
      });

      const data = await response.json();

      if (data.success) {
        console.log('Conflict resolved successfully');
        // Refresh matter details to get updated conflict status
        fetchMatterDetails();
      } else {
        console.error(data.message || 'Failed to resolve conflict');
      }
    } catch (error) {
      console.error('Error resolving conflict:', error);

    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Not set';
    try {
      const date = new Date(dateString);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    } catch {
      return 'Invalid date';
    }
  };

  const getMonthYear = (date: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const isToday = (day: number, month: number, year: number) => {
    const today = new Date();
    return day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear();
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentMonth);
    if (direction === 'next') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentMonth(newDate);
  };

  const isDateInMonth = (dateString: string | null | undefined, month: number, year: number) => {
    if (!dateString) return false;
    try {
      const date = new Date(dateString);
      return date.getMonth() === month && date.getFullYear() === year;
    } catch {
      return false;
    }
  };

  const getDateDay = (dateString: string | null | undefined) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.getDate();
    } catch {
      return null;
    }
  };

  const renderCalendar = () => {
    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
    const days = [];

    const startDay = isDateInMonth(matterDetails?.startDate, month, year) ? getDateDay(matterDetails?.startDate) : null;
    const deadlineDay = isDateInMonth(matterDetails?.estimatedDeadline, month, year) ? getDateDay(matterDetails?.estimatedDeadline) : null;

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="aspect-square" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isTodayDate = isToday(day, month, year);
      const isStartDate = day === startDay;
      const isDeadlineDate = day === deadlineDay;

      let className = 'aspect-square flex items-center justify-center text-sm rounded-lg transition-all relative ';

      if (isTodayDate) {
        className += 'bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-sm';
      } else if (isStartDate) {
        className += 'bg-green-100 text-green-700 font-semibold border-2 border-green-500 hover:bg-green-200';
      } else if (isDeadlineDate) {
        className += 'bg-red-100 text-red-700 font-semibold border-2 border-red-500 hover:bg-red-200';
      } else {
        className += 'text-gray-700 hover:bg-gray-100';
      }

      days.push(
        <button
          key={day}
          className={className}
          title={
            isStartDate ? 'Start Date' :
              isDeadlineDate ? 'Deadline' :
                isTodayDate ? 'Today' :
                  ''
          }
        >
          {day}
        </button>
      );
    }

    return days;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-3 text-sm text-gray-600">Loading matter details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Details</h3>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!matterDetails) {
    return (
      <div className="p-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <p className="text-gray-600">No matter details available</p>
        </div>
      </div>
    );
  }

  const primaryContact = matterDetails.client?.contacts?.find((c) => c.isPrimary) || matterDetails.client?.contacts?.[0];
  // Filter out all leads from team members list
  const leadUserIds = matterDetails.assignedLeads?.map(lead => lead.userId) || [];
  if (matterDetails.assignedLawyer?.id && !leadUserIds.includes(matterDetails.assignedLawyer.id)) {
    leadUserIds.push(matterDetails.assignedLawyer.id);
  }
  const filteredTeamMembers = matterDetails.teamMembers?.filter(member =>
    !leadUserIds.includes(member.userId)
  );


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column - Matter Details */}
      <div className="lg:col-span-2 space-y-6">

        {/* Conflict Warning Box - Only show if matter has conflicts */}
        {matterDetails.hasConflict && (
          <div className={`border-2 rounded-xl shadow-sm overflow-hidden ${matterDetails.conflictStatus === 'resolved'
            ? 'bg-green-50 border-green-300'
            : 'bg-red-50 border-red-300'
            }`}>
            <div className={`px-6 py-3 ${matterDetails.conflictStatus === 'resolved'
              ? 'bg-green-600'
              : 'bg-red-600'
              }`}>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>{matterDetails.conflictStatus === 'resolved' ? '✓' : '⚠️'}</span>
                {matterDetails.conflictStatus === 'resolved' ? 'CONFLICT RESOLVED' : 'CONFLICT DETECTED'}
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <p className={`font-medium ${matterDetails.conflictStatus === 'resolved'
                  ? 'text-green-800'
                  : 'text-red-800'
                  }`}>
                  {matterDetails.conflictStatus === 'resolved'
                    ? 'This conflict has been resolved.'
                    : 'This matter has been flagged for potential conflicts of interest.'}
                </p>

                {matterDetails.conflicts && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className={`text-sm ${matterDetails.conflictStatus === 'resolved'
                          ? 'text-green-700'
                          : 'text-red-700'
                          }`}>
                          <span className="font-semibold">Status:</span>{' '}
                          <span className="capitalize">{matterDetails.conflictStatus || 'Pending'}</span>
                        </p>
                      </div>
                    </div>

                    {matterDetails.conflicts && (
                      <div className={`bg-white rounded-lg border p-4 ${matterDetails.conflictStatus === 'resolved'
                        ? 'border-green-200'
                        : 'border-red-200'
                        }`}>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {matterDetails.conflicts[0].raiserName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(matterDetails.conflicts[0].raisedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${matterDetails.conflicts[0].severity === 'critical'
                              ? 'bg-red-100 text-red-800'
                              : matterDetails.conflicts[0].severity === 'high'
                                ? 'bg-orange-100 text-orange-800'
                                : matterDetails.conflicts[0].severity === 'medium'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                          >
                            {matterDetails.conflicts[0].severity.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-1">
                          <span className="font-medium">Type:</span>{' '}
                          {matterDetails.conflicts[0].conflictType.replace(/_/g, ' ')}
                        </p>
                        <p className="text-sm text-gray-700">
                          {matterDetails.conflicts[0].conflictDescription}
                        </p>

                        {/* Resolution Notes - Only show if resolved */}
                        {matterDetails.conflictStatus === 'resolved' && matterDetails.conflicts[0].resolutionNotes && (
                          <div className="mt-4 pt-4 border-t border-green-200">
                            <p className="text-sm font-semibold text-green-900 mb-1">Resolution Notes:</p>
                            <p className="text-sm text-gray-700">{matterDetails.conflicts[0].resolutionNotes}</p>
                            {matterDetails.conflicts[0].resolverName && (
                              <p className="text-xs text-gray-500 mt-2">
                                Resolved by {matterDetails.conflicts[0].resolverName} on{' '}
                                {matterDetails.conflicts[0].resolvedAt
                                  ? new Date(matterDetails.conflicts[0].resolvedAt).toLocaleDateString()
                                  : 'N/A'}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Resolve Conflict Section - Only show if not resolved */}
                    {matterDetails.conflictStatus !== 'resolved' && (
                      <ResolveConflictSection
                        conflictId={matterDetails.conflicts[0].conflictId}
                        onResolve={handleResolveConflict}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Matter Information Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg text-base font-semibold text-gray-900">Matter Information</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500 uppercase tracking-wide">Start Date</label>
                <p className="text-medium font-medium text-gray-900">
                  {formatDate(matterDetails.startDate)}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500 uppercase tracking-wide">Estimated Deadline</label>
                <p className="text-medium font-medium text-gray-900">
                  {formatDate(matterDetails.estimatedDeadline)}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500 uppercase tracking-wide">Practice Area</label>
                <p className="text-medium font-medium text-gray-900">{matterDetails.practiceArea || 'Not specified'}</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-500 uppercase tracking-wide">Matter Type</label>
                <p className="text-medium font-medium text-gray-900">{matterDetails.matterType || 'Not specified'}</p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100">
              <label className="text-sm font-medium text-gray-500 uppercase tracking-wide block mb-2">Description</label>
              <p className="text-medium text-gray-700 leading-relaxed">
                {matterDetails.description || 'No description provided'}
              </p>
            </div>
          </div>
        </div>

        {/* Client Details Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Client Details</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div className="flex flex-col items-start">
                <span className="text-medium text-gray-600">Client</span>
                <span className="text-medium font-semibold text-gray-900">{matterDetails.client?.name || 'Not assigned'}</span>
              </div>
              {primaryContact && (
                <>
                  <div className="flex flex-col items-start">
                    <span className="text-medium text-gray-600">Client Name</span>
                    <span className="text-medium font-medium text-gray-900">{primaryContact.name}</span>
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-medium text-gray-600">Phone number</span>
                    <span className="text-medium font-medium text-gray-900">{primaryContact.number}</span>
                  </div>
                  {primaryContact.email && (
                    <div className="flex flex-col items-start">
                      <span className="text-medium text-gray-600">Email</span>
                      <span className="text-medium font-medium text-gray-900">{primaryContact.email}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Opposing Party Card */}
        {matterDetails.opposingPartyName && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Opposing Party</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <span className="text-medium text-gray-600">Party Name</span>
                  <span className="text-medium font-semibold text-gray-900">{matterDetails.opposingPartyName}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Billings & Payments Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Billings & Payments</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div className="flex flex-col items-start">
                <span className="text-medium text-gray-600">Estimated Value</span>
                <span className="text-medium font-semibold text-gray-900 flex items-center gap-2">
                  {matterDetails.estimatedValue && matterDetails.currency
                    ? formatAmountWithCurrency(matterDetails.estimatedValue, matterDetails.currency as CurrencyCode)
                    : `₹${matterDetails.estimatedValue?.toLocaleString('en-IN') || '0'}`
                  }
                  {matterDetails.currency && (
                    <CurrencyBadge currency={matterDetails.currency as CurrencyCode} />
                  )}
                </span>
              </div>
              <div className="flex flex-col items-start">
                <span className="text-medium text-gray-600">Billing Rate Type</span>
                <span className="text-medium font-medium text-gray-900 capitalize">
                  {matterDetails.billingRateType?.replace('_', ' ') || 'Not specified'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Creation Details Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Creation Details</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div className="flex flex-col items-start">
                <span className="text-medium text-gray-600">Created On</span>
                <span className="text-medium font-medium text-gray-900">
                  {matterDetails.createdAt ? formatDate(matterDetails.createdAt) : 'Not available'}
                </span>
              </div>
              <div className="flex flex-col items-start">
                <span className="text-medium text-gray-600">Matter Creation Requested By</span>
                <span className="text-medium font-medium text-gray-900">
                  {matterDetails.matterCreationRequestedBy?.name || '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Team Members Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Team</h3>
          </div>
          <div className="p-6">
            {/* Assigned Leads Section - Support both single and multiple leads */}
            {(matterDetails.assignedLeads && matterDetails.assignedLeads.length > 0) || matterDetails.assignedLawyer ? (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  {(matterDetails.assignedLeads && matterDetails.assignedLeads.length > 1) ? 'Assigned Leads' : 'Assigned Lead'}
                </h3>
                <div className="space-y-3">
                  {/* Show assignedLeads if available (new format) */}
                  {matterDetails.assignedLeads && matterDetails.assignedLeads.length > 0 ? (
                    matterDetails.assignedLeads.map((lead, index) => (
                      <div key={lead.userId || index} className="relative group border-2 border-blue-200 bg-blue-50 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                            {lead.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-gray-900 truncate">
                                {lead.name}
                              </h4>
                              <span className="px-2 py-0.5 text-xs font-bold text-blue-700 bg-blue-200 rounded-full">
                                LEAD
                              </span>
                            </div>
                            {lead.serviceType && (
                              <p className="text-xs text-gray-500 mt-1">
                                Service: {lead.serviceType}
                              </p>
                            )}
                            {lead.hourlyRate !== undefined && lead.hourlyRate !== null && (
                              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                                {matterDetails.currency
                                  ? formatAmountWithCurrency(Number(lead.hourlyRate), matterDetails.currency as CurrencyCode)
                                  : `₹${typeof lead.hourlyRate === 'number' ? lead.hourlyRate.toLocaleString('en-IN') : String(lead.hourlyRate)}`
                                }/hr
                                {matterDetails.currency && (
                                  <CurrencyBadge currency={matterDetails.currency as CurrencyCode} />
                                )}
                              </p>
                            )}
                            <div className="flex items-center gap-1.5 mt-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-xs text-gray-500">Active</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    /* Fallback to single assignedLawyer (legacy format) */
                    matterDetails.assignedLawyer && (
                      <div className="relative group border-2 border-blue-200 bg-blue-50 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                            {matterDetails.assignedLawyer.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-gray-900 truncate">
                                {matterDetails.assignedLawyer.name}
                              </h4>
                              <span className="px-2 py-0.5 text-xs font-bold text-blue-700 bg-blue-200 rounded-full">
                                LEAD
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 mt-0.5">
                              {formatRoleDisplay(typeof matterDetails.assignedLawyer.role === 'string' ? matterDetails.assignedLawyer.role : 'partner')}
                            </p>
                            {matterDetails.assignedLawyer.serviceType && (
                              <p className="text-xs text-gray-500 mt-1">
                                Service: {matterDetails.assignedLawyer.serviceType}
                              </p>
                            )}
                            {matterDetails.assignedLawyer.hourlyRate !== undefined && matterDetails.assignedLawyer.hourlyRate !== null && (
                              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                                {matterDetails.currency
                                  ? formatAmountWithCurrency(Number(matterDetails.assignedLawyer.hourlyRate), matterDetails.currency as CurrencyCode)
                                  : `₹${typeof matterDetails.assignedLawyer.hourlyRate === 'number' ? matterDetails.assignedLawyer.hourlyRate.toLocaleString('en-IN') : String(matterDetails.assignedLawyer.hourlyRate)}`
                                }/hr
                                {matterDetails.currency && (
                                  <CurrencyBadge currency={matterDetails.currency as CurrencyCode} />
                                )}
                              </p>
                            )}
                            <div className="flex items-center gap-1.5 mt-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-xs text-gray-500">Active</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : null}

            {/* Team Members */}
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Team Members</h3>

            {filteredTeamMembers && filteredTeamMembers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTeamMembers.map((member, index) => {
                  const colors = [
                    'bg-blue-500',
                    'bg-indigo-500',
                    'bg-purple-500',
                    'bg-pink-500',
                    'bg-green-500',
                    'bg-yellow-500',
                    'bg-red-500',
                    'bg-cyan-500',
                  ];
                  const avatarColor = colors[index % colors.length];

                  // Using centralized formatRoleDisplay from utils

                  return (
                    <div
                      key={member.userId || index}
                      className="relative group border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 ${avatarColor} rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}>
                          {member.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-gray-900 truncate">
                            {member.name}
                          </h4>

                          <p className="text-xs text-gray-600 mt-0.5">
                            {formatRoleDisplay(
                              (typeof member.userRole === 'string' ? member.userRole : '') ||
                              (typeof member.matterRole === 'string' ? member.matterRole : '') ||
                              (typeof member.role === 'string' ? member.role : '') ||
                              'Associate'
                            )}
                          </p>

                          {member.serviceType && (
                            <p className="text-xs text-gray-500 mt-1">
                              Service: {member.serviceType}
                            </p>
                          )}

                          {member.hourlyRate !== undefined && member.hourlyRate !== null && (
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                              {matterDetails.currency
                                ? formatAmountWithCurrency(member.hourlyRate, matterDetails.currency as CurrencyCode)
                                : `₹${typeof member.hourlyRate === 'number' ? member.hourlyRate.toLocaleString('en-IN') : String(member.hourlyRate)}`
                              }/hr
                              {matterDetails.currency && (
                                <CurrencyBadge currency={matterDetails.currency as CurrencyCode} />
                              )}
                            </p>
                          )}

                          <div className="flex items-center gap-1.5 mt-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-xs text-gray-500">Active</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <p className="text-sm text-gray-500 font-medium">No team members found</p>
                <p className="text-xs text-gray-400 mt-1">Add lawyers to this matter</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column - Deadlines & Calendar */}
      <div className="space-y-6">
        {/* Upcoming Deadlines Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Upcoming Deadlines</h3>
            <button className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white hover:bg-blue-700 transition-colors shadow-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <select className="text-xs font-medium border border-gray-200 rounded-lg px-3 py-2 bg-white hover:border-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>This Week</option>
                <option>This Month</option>
                <option>All</option>
              </select>
              <button className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
                View case summary
              </button>
            </div>

            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-gray-500 font-medium">No upcoming deadlines</p>
              <p className="text-xs text-gray-400 mt-1">Add deadlines to track important dates</p>
            </div>
          </div>
        </div>

        {/* Calendar Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h3 className="text-sm font-semibold text-gray-900">
                {getMonthYear(currentMonth)}
              </h3>
              <button
                onClick={() => navigateMonth('next')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                <div key={day} className="text-xs font-semibold text-gray-500 text-center py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {renderCalendar()}
            </div>

            {/* Legend */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-blue-600"></div>
                <span className="text-gray-600">Today</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded border-2 border-green-500 bg-green-100"></div>
                <span className="text-gray-600">Start</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded border-2 border-red-500 bg-red-100"></div>
                <span className="text-gray-600">Deadline</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}