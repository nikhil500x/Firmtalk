'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Search, ChevronRight, Building2, UserCheck, UserX } from 'lucide-react';
import { API_ENDPOINTS } from '@/lib/api';
import { Label } from "@/components/ui/label";
import ReferredBy from '@/components/crm/ReferredBy';

/**
 * Contact Interface Definition
 */
interface Contact {
  id: number;
  name: string;
  email: string;
  number: string;
  designation?: string;
}

/**
 * Client Interface Definition
 */
interface Client {
  id: number;
  companyName: string;
  industry: string;
  clientGroup: string;
  website: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  primaryContact: Contact | null;
  contacts: Array<{
    id: number;
    name: string;
    email: string;
    number: string;
    designation?: string;
    isPrimary: boolean;
  }>;
  status: 'Active' | 'Inactive' | 'Prospect';
  internalReference?: {
    id: number;
    name: string;
    email: string;
    phone?: string;
  } | null;
  externalReferenceName?: string | null;
  externalReferenceEmail?: string | null;
  externalReferencePhone?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  clientCreationRequestedBy?: {
    id: number;
    name: string;
    email: string;
  } | null;
  createdAt?: string;
}

/**
 * Matter Interface Definition - UPDATED to match backend
 */
interface Matter {
  id: number;
  matterTitle: string;
  matterType: string | null;
  practiceArea: string | null;
  description: string | null;
  assignedLawyer: {
    id: number;
    name: string;
    email: string;
    phone: string;
  } | null;
  teamMembers: Array<{
    userId: number;
    name: string;
    email: string;
    matterRole: string | null;
  }>;
  startDate: string;
  estimatedDeadline: string | null;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  estimatedValue: number | null;
  billingRateType: string | null;
  opposingPartyName: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Tab type definition
 */
type TabType = 'contacts' | 'activity' | 'matters' | 'dates';

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params?.clientId as string;

  // State management
  const [client, setClient] = useState<Client | null>(null);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMattersLoading, setIsMattersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('matters');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // ============================================================================
  // DATA FETCHING - CLIENT
  // ============================================================================

  useEffect(() => {
    const fetchClientData = async () => {
      if (!clientId) return;

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(API_ENDPOINTS.clients.byId(parseInt(clientId)), {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            router.push('/login');
            return;
          }
          if (response.status === 404) {
            setError('Client not found');
            return;
          }
          throw new Error('Failed to fetch client');
        }

        const data = await response.json();

        if (data.success && data.data) {
          setClient(data.data);
          // Debug: Log reference data
          console.log('Client reference data:', {
            internalReference: data.data.internalReference,
            externalReferenceName: data.data.externalReferenceName,
            notes: data.data.notes
          });
        } else {
          setError(data.message || 'Failed to load client details');
        }
      } catch (err) {
        console.error('Fetch client error:', err);
        setError('Failed to load client details. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchClientData();
  }, [clientId, router]);

  // ============================================================================
  // DATA FETCHING - MATTERS
  // ============================================================================

  useEffect(() => {
    const fetchClientMatters = async () => {
      if (!clientId) return;

      try {
        setIsMattersLoading(true);

        const response = await fetch(API_ENDPOINTS.clients.matters(parseInt(clientId)), {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error('Failed to fetch matters');
          return;
        }

        const data = await response.json();

        if (data.success && data.data) {
          setMatters(data.data.matters);
        }
      } catch (err) {
        console.error('Fetch matters error:', err);
      } finally {
        setIsMattersLoading(false);
      }
    };

    if (activeTab === 'matters') {
      fetchClientMatters();
    }
  }, [clientId, activeTab]);

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const formatStatus = (status: string): string => {
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Filtered matters based on search and status
  const filteredMatters = matters.filter((matter) => {
    const matchesSearch = matter.matterTitle.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = 
      statusFilter === 'All' || 
      matter.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  // Handle matter click
  const handleMatterClick = (matterId: number) => {
    router.push(`/matter/${matterId}`);
  };

  // Extract TSP Contact info from notes if present
  const extractTSPContacts = (notes: string | null | undefined): string[] | null => {
    if (!notes) return null;
    const tspMatch = notes.match(/TSP Contacts?:\s*([\d,\s\/]+)/i);
    if (tspMatch) {
      // Handle both comma and slash separated IDs
      return tspMatch[1].split(/[,\/]/).map(id => id.trim()).filter(Boolean);
    }
    return null;
  };

  const tspContacts = client?.notes ? extractTSPContacts(client.notes) : null;
  
  // If internalReference exists but no TSP Contacts in notes, add it to the list for display
  const allTspContactIds: string[] = [];
  if (client?.internalReference) {
    allTspContactIds.push(client.internalReference.id.toString());
  }
  if (tspContacts) {
    tspContacts.forEach(id => {
      if (!allTspContactIds.includes(id)) {
        allTspContactIds.push(id);
      }
    });
  }
  const hasMultipleTspContacts = allTspContactIds.length > 1;

  // Check if client has any reference
  const hasReference = client && (
    client.internalReference || 
    client.externalReferenceName ||
    (tspContacts && tspContacts.length > 0) ||
    allTspContactIds.length > 0
  );

  // ============================================================================
  // RENDER LOADING & ERROR STATES
  // ============================================================================

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-lg font-medium text-gray-700">Loading client details...</p>
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <p className="text-lg font-medium text-red-600">{error || 'Client not found'}</p>
          <button
            onClick={() => router.push('/crm')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to CRM
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="p-6 space-y-4">
      {/* TOP BAR - Breadcrumbs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => router.push('/crm?tab=clients')}
            className="text-gray-500 hover:text-blue-600 font-medium transition-colors"
          >
            Clients Hub
          </button>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <span className="text-gray-900 font-semibold">{client.companyName}</span>
        </div>
      </div>

      {/* MAIN CONTENT CARD */}
      <div className="bg-white rounded-[22px] shadow-sm border border-gray-100 overflow-hidden">
        {/* CLIENT PROFILE SECTION */}
        <div className="bg-[#F9FAFB] rounded-xl mx-6 mt-6 p-4">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center">
                <Building2 size={32} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{client.companyName}</h2>
                {client.website && (
                  <a
                    href={`https://${client.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {client.website}
                  </a>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  client.status === 'Active'
                    ? 'bg-green-100 text-green-800'
                    : client.status === 'Inactive'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {client.status}
              </span>
            </div>
          </div>

          {/* CLIENT INFO CARD */}
          <div className="bg-gray-50 rounded-xl p-2">
            {/* Row 1 – Company Info */}
            <div className="grid grid-cols-6 gap-4 mb-4 items-start">
              <div className="flex items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Company Info
                </span>
              </div>

              <div className="col-span-5 grid grid-cols-5 gap-4">
                <div>
                  <Label className="text-xs font-medium text-gray-500">Industry</Label>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {client.industry || "—"}
                  </p>
                </div>

                <div>
                  <Label className="text-xs font-medium text-gray-500">Client Group</Label>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {client.clientGroup || "—"}
                  </p>
                </div>

                <div className="col-span-3">
                  <Label className="text-xs font-medium text-gray-500">Address</Label>
                  <p className="mt-1 text-sm font-medium text-gray-900 whitespace-pre-line">
                    {client.address || "—"}
                    {client.city && `, ${client.city}, ${client.state}, ${client.postalCode}`}
                    {client.country && `, ${client.country}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Row 2 – Primary Contact */}
            <div className="grid grid-cols-6 gap-4 pt-4 border-t border-gray-200 items-start mb-4">
              <div className="flex items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Primary Contact
                </span>
              </div>

              <div className="col-span-5 grid grid-cols-5 gap-4">
                {client.primaryContact ? (
                  <>
                    <div>
                      <Label className="text-xs font-medium text-gray-500">
                        Contact Name
                      </Label>
                      <p className="mt-1 text-sm font-medium text-gray-900">
                        {client.primaryContact.name || "—"}
                      </p>
                    </div>

                    <div>
                      <Label className="text-xs font-medium text-gray-500">Email</Label>
                      <a
                        href={`mailto:${client.primaryContact.email}`}
                        className="mt-1 block text-sm font-medium text-blue-600 hover:underline"
                      >
                        {client.primaryContact.email || "—"}
                      </a>
                    </div>

                    <div>
                      <Label className="text-xs font-medium text-gray-500">Phone</Label>
                      <a
                        href={`tel:${client.primaryContact.number}`}
                        className="mt-1 block text-sm font-medium text-gray-900 hover:text-blue-600"
                      >
                        {client.primaryContact.number || "—"}
                      </a>
                    </div>

                    <div>
                      <Label className="text-xs font-medium text-gray-500">
                        Designation
                      </Label>
                      <p className="mt-1 text-sm font-medium text-gray-900">
                        {client.primaryContact.designation || "—"}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="col-span-5 text-sm text-gray-500 italic">
                    No primary contact set
                  </div>
                )}
              </div>
            </div>

            {/* Row 3 – Reference Details */}
            <div className="pt-4 border-t border-gray-200 mb-4">
              <div className="grid grid-cols-6 gap-4 items-start mb-3">
              <div className="flex items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Referred By
                </span>
              </div>

                <div className="col-span-5">
                {hasReference ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="min-w-0">
                      <Label className="text-xs font-medium text-gray-500">Type</Label>
                      <div className="mt-1 flex items-center gap-2">
                          {(client.internalReference || tspContacts || allTspContactIds.length > 0) ? (
                          <>
                              <UserCheck size={14} className="text-blue-600 flex-shrink-0" />
                              <span className="text-sm font-medium text-gray-900 break-words">
                                Internal {hasMultipleTspContacts && `(${allTspContactIds.length} partners)`}
                              </span>
                          </>
                        ) : (
                          <>
                              <UserX size={14} className="text-purple-600 flex-shrink-0" />
                            <span className="text-sm font-medium text-gray-900">External</span>
                          </>
                        )}
                      </div>
                    </div>

                      <div className="min-w-0">
                      <Label className="text-xs font-medium text-gray-500">Name</Label>
                        <div className="mt-1">
                          {client.internalReference ? (
                            <>
                              <p className="text-sm font-medium text-gray-900 break-words">
                                {client.internalReference.name}
                              </p>
                              {hasMultipleTspContacts && (
                                <p className="mt-1 text-xs text-gray-500 break-words">
                                  All TSP Contacts: {allTspContactIds.join(', ')}
                                </p>
                              )}
                            </>
                          ) : client.externalReferenceName ? (
                            <p className="text-sm font-medium text-gray-900 break-words">
                              {client.externalReferenceName}
                      </p>
                          ) : (tspContacts && tspContacts.length > 0) || allTspContactIds.length > 0 ? (
                            <p className="text-sm font-medium text-gray-900 break-words">
                              Partners: {(tspContacts || allTspContactIds).join(', ')}
                            </p>
                          ) : (
                            <p className="text-sm font-medium text-gray-900">—</p>
                          )}
                        </div>
                    </div>

                      <div className="min-w-0">
                      <Label className="text-xs font-medium text-gray-500">Email</Label>
                        <div className="mt-1">
                      {(client.internalReference?.email || client.externalReferenceEmail) ? (
                        <a
                          href={`mailto:${client.internalReference?.email || client.externalReferenceEmail}`}
                              className="block text-sm font-medium text-blue-600 hover:underline break-all"
                        >
                          {client.internalReference?.email || client.externalReferenceEmail}
                        </a>
                      ) : (
                            <p className="text-sm font-medium text-gray-900">—</p>
                      )}
                        </div>
                    </div>

                      <div className="min-w-0">
                      <Label className="text-xs font-medium text-gray-500">Phone</Label>
                        <div className="mt-1">
                      {(client.internalReference?.phone || client.externalReferencePhone) ? (
                        <a
                          href={`tel:${client.internalReference?.phone || client.externalReferencePhone}`}
                              className="block text-sm font-medium text-gray-900 hover:text-blue-600 break-words"
                        >
                          {client.internalReference?.phone || client.externalReferencePhone}
                        </a>
                      ) : (
                            <p className="text-sm font-medium text-gray-900">—</p>
                      )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 italic">
                      No reference information available
                    </div>
                  )}
                </div>
                    </div>

              {hasReference && client.notes && (
                <div className="grid grid-cols-6 gap-4 mt-3">
                  <div></div>
                      <div className="col-span-5">
                        <Label className="text-xs font-medium text-gray-500">Notes</Label>
                    <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap break-words">
                          {client.notes}
                        </p>
                      </div>
                  </div>
                )}
            </div>

            {/* Row 4 – Creation Details */}
            <div className="grid grid-cols-6 gap-4 pt-4 border-t border-gray-200 items-start">
              <div className="flex items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Creation Details
                </span>
              </div>

              <div className="col-span-5 grid grid-cols-5 gap-4">
                <div>
                  <Label className="text-xs font-medium text-gray-500">Referred By</Label>
                  <div className="mt-1">
                    <ReferredBy
                      internalReference={client.internalReference}
                      externalReferenceName={client.externalReferenceName}
                      className="text-sm font-medium text-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-gray-500">Creation Requested By</Label>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {client.clientCreationRequestedBy?.name || "—"}
                  </p>
                </div>

                <div>
                  <Label className="text-xs font-medium text-gray-500">Created On</Label>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {client.createdAt ? formatDate(client.createdAt) : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TABS NAVIGATION */}
        <div className="px-6 mt-6 border-b border-gray-200">
          <div className="flex items-center gap-8">
            <button
              onClick={() => setActiveTab('contacts')}
              className={`pb-3 text-sm font-medium transition-colors ${
                activeTab === 'contacts'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Key Contacts
            </button>
            <button
              onClick={() => setActiveTab('matters')}
              className={`pb-3 text-sm font-medium transition-colors ${
                activeTab === 'matters'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Matters & Cases
            </button>
          </div>
        </div>

        {/* TAB CONTENT - Matters */}
        {activeTab === 'matters' && (
          <div className="p-6 space-y-6">
            {/* Search and Filter Bar */}
            <div className="flex items-center gap-4">
              <div className="flex-1 max-w-sm relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="Search by Matter ID or Matter Title"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm text-gray-700 placeholder-gray-400 bg-white border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="status-filter" className="text-sm text-gray-600">
                  Status:
                </label>
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="All">All</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Active Matters Section */}
            {isMattersLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="text-sm text-gray-600">Loading matters...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Active Matters */}
                {filteredMatters.filter(m => m.status === 'active').length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-green-700">Active Matters</h3>
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Matter ID
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Matter Title
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Start Date
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Assigned Lawyer
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredMatters
                            .filter(m => m.status === 'active')
                            .map((matter) => (
                              <tr
                                key={matter.id}
                                className="hover:bg-gray-50 cursor-pointer transition-colors"
                              >
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {matter.id}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {matter.matterTitle}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700">
                                  {formatDate(matter.startDate)}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex px-2.5 py-0.5 rounded text-xs font-medium text-green-700 bg-green-50">
                                    Active
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700">
                                  {matter.assignedLawyer?.name || 'Unassigned'}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Past Matters */}
                {filteredMatters.filter(m => m.status !== 'active').length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700">Past Matters</h3>
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Matter ID
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Matter Title
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Start Date
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              End Date
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Outcome
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Assigned Lawyer
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Notes
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredMatters
                            .filter(m => m.status !== 'active')
                            .map((matter) => (
                              <tr
                                key={matter.id}
                                className="hover:bg-gray-50 cursor-pointer transition-colors"
                                onClick={() => handleMatterClick(matter.id)}
                              >
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  C{matter.id}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {matter.matterTitle}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700">
                                  {formatDate(matter.startDate)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700">
                                  {matter.estimatedDeadline ? formatDate(matter.estimatedDeadline) : '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700">
                                  {formatStatus(matter.status)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700">
                                  {matter.assignedLawyer?.name || 'Unassigned'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {matter.description || '-'}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {filteredMatters.length === 0 && (
                  <div className="flex items-center justify-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-center">
                      <p className="text-gray-500 font-medium">
                        {searchQuery || statusFilter !== 'All'
                          ? 'No matters found matching your criteria'
                          : 'No matters for this client yet'}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        {searchQuery || statusFilter !== 'All'
                          ? 'Try adjusting your search or filters'
                          : 'Create a new matter to get started'}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB CONTENT - Contacts */}
        {activeTab === 'contacts' && (
          <div className="p-6 space-y-6">
            {/* Search and Action Bar */}
            <div className="flex items-center justify-between">
              <div className="flex-1 max-w-sm relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="Search by Contact name or Organisation"
                  className="w-full pl-9 pr-4 py-2 text-sm text-gray-700 placeholder-gray-400 bg-white border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Contacts Table */}
            {client.contacts && client.contacts.length > 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact No.
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Job Profile
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {client.contacts.map((contact) => (
                      <tr key={contact.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                              <span className="text-white text-sm font-medium">
                                {contact.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-900">{contact.name}</span>
                              {contact.isPrimary && (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                  Primary
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {contact.number}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {contact.designation || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={`mailto:${contact.email}`}
                            className="text-sm text-gray-700 hover:text-blue-600"
                          >
                            {contact.email}
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2.5 py-0.5 rounded text-xs font-medium text-green-700 bg-green-50">
                            Current
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-center">
                  <p className="text-gray-500 font-medium">No contacts found</p>
                  <p className="text-sm text-gray-400 mt-1">Add contacts to this client</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}