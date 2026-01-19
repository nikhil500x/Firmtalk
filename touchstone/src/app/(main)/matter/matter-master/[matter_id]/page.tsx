'use client'; 

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import MatterDetailOverview from '@/components/matter/matter-detail/MatterDetailOverview';
import MatterTeam from '@/components/matter/matter-detail/MatterTeam';
import MatterBillingAndInvoices from '@/components/matter/matter-detail/MatterBillingAndInvoices';
// import MatterDocuments from '@/components/matter/matter-detail/MatterDocuments';
// import MatterActivityLog from '@/components/matter/matter-detail/MatterActivityLog';
import MatterTaskList from '@/components/matter/matter-detail/MatterTaskList';
import MatterTimesheets from '@/components/matter/matter-detail/MatterTimesheets';
import { API_ENDPOINTS } from '@/lib/api';
import { Briefcase } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { canCloseMatter } from '@/lib/permissions';
import CloseMatterDialog from '@/components/matter/CloseMatterDialog';
import ReopenMatterDialog from '@/components/matter/ReopenMatterDialog';

interface MatterData {
  id: number;
  matterCode?: string;
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
      number: string;
      email: string;
      designation: string;
      isPrimary: boolean;
    }>;
  };
  status: string;
  practiceArea?: string;
  matterType?: string;
  description?: string;
  startDate?: string;
  estimatedDeadline?: string;
  estimatedValue?: number;
  billingRateType?: string;
  opposingPartyName?: string;
  assignedLawyer?: {
    id: number;
    name: string;
    email: string;
    phone?: string;
    practiceArea?: string | null;
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
    email: string;
    phone?: string;
    practiceArea?: string;
    hourlyRate?: number;
    role: string;
    assignedAt: string;
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

export default function MatterDetailPage() {
  const router = useRouter();
  const params = useParams();
  const matter_id = params?.matter_id as string | undefined;
  
  const [activeTab, setActiveTab] = useState('overview');
  const [matterData, setMatterData] = useState<MatterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, role, hasPermission } = useAuth();
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);

  const fetchMatterData = useCallback(async () => {
    if (!matter_id) {
      setError('Matter ID is missing');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(API_ENDPOINTS.matters.byId(Number(matter_id)), {
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
      
      if (!result.success || !result.data) {
        throw new Error('Invalid response format from API');
      }

      setMatterData(result.data);
    } catch (error) {
      console.error('Error fetching matter data:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch matter details');
    } finally {
      setLoading(false);
    }
  }, [matter_id]);

  useEffect(() => {
    fetchMatterData();
  }, [fetchMatterData]);

  // Check if user has permission to view team and billing tabs
  const canViewRestrictedTabs = hasPermission('mm:edit') ||
    role?.name === 'partner' ||
    role?.name === 'admin' ||
    role?.name === 'superadmin';

  const tabs = [
    { id: 'overview', label: 'Overview', component: MatterDetailOverview },
    ...(canViewRestrictedTabs ? [
      { id: 'team', label: 'Team', component: MatterTeam },
      { id: 'billing', label: 'Billing & Invoices', component: MatterBillingAndInvoices },
    ] : []),
    { id: 'timesheets', label: 'Timesheets', component: MatterTimesheets },
    { id: 'tasks', label: 'Tasks List', component: MatterTaskList },
  ];

  const activeTabData = tabs.find(tab => tab.id === activeTab);
  const ActiveComponent = activeTabData?.component;

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      'in-progress': 'bg-green-100 text-green-700',
      open: 'bg-green-100 text-green-700',
      closed: 'bg-gray-200 text-gray-700',
      completed: 'bg-blue-100 text-blue-700',
      on_hold: 'bg-yellow-100 text-yellow-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return statusColors[status.toLowerCase()] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading matter details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Matter</h3>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={fetchMatterData}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => router.push('/matter/matter-master')}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                Back to Matters
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!matterData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Matter not found</p>
          <button
            onClick={() => router.push('/matter/matter-master')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Back to Matters
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <button
                onClick={() => router.push('/matter')}
                className="text-gray-800 hover:text-blue-600 transition-all duration-200 hover:scale-[1.03] font-semibold"
            >
                Matter Management
            </button>
            <span className="text-gray-400 font-bold">›</span>
            <button
                onClick={() => router.push('/matter')}
                className="text-gray-800 hover:text-blue-600 transition-all duration-200 hover:scale-[1.03] font-semibold"
            >
                {matterData.matterTitle}
            </button>
            <span className="text-gray-400 font-bold">›</span>
            <span className="text-blue-700 font-bold capitalize">
                {activeTabData?.label || 'Overview'}
            </span>
        </div>
        
      </header>

      {/* Matter Header */}
      <div className="bg-gradient-to-br from-white to-gray-50/30 border-b border-gray-200 px-6 py-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-5">
            <div className="p-3.5 bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-xl border border-indigo-100 shadow-sm">
              <div className="p-3 bg-indigo-100 rounded">
                  <Briefcase className="w-6 h-6 text-indigo-700" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{matterData.matterTitle}</h1>
              <div className="flex items-center gap-3 mt-2.5">
                <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-md border border-gray-200">
                  {matterData.matterCode || `#${matterData.id}`}
                </span>
                {matterData.practiceArea && (
                  <>
                    <span className="text-gray-300">•</span>
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <p className="text-sm font-medium text-gray-700">{matterData.practiceArea}</p>
                    </div>
                  </>
                )}
                {matterData.matterType && (
                  <>
                    <span className="text-gray-300">•</span>
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <p className="text-sm font-medium text-gray-700">{matterData.matterType}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Close/Reopen Matter Buttons */}
            {matterData && canCloseMatter(
              { assignedLawyerId: matterData.assignedLawyer?.id },
              user,
              role
            ) && (
              <>
                {matterData.status?.toLowerCase() !== 'closed' && (
                  <button
                    onClick={() => setCloseDialogOpen(true)}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Close Matter
                  </button>
                )}
                {matterData.status?.toLowerCase() === 'closed' && (
                  <button
                    onClick={() => setReopenDialogOpen(true)}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Reopen Matter
                  </button>
                )}
              </>
            )}
            <div className="px-4 py-3 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow transition-shadow">
              <p className="text-xs font-medium text-gray-500 mb-1.5">Client</p>
              <div className="flex items-center gap-2">
                <div className="p-1 bg-blue-50 rounded">
                  <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                {matterData.client.id ? (
                  <button
                    onClick={() => router.push(`/clients/${matterData.client.id}`)}
                    className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                  >
                    {matterData.client.name}
                  </button>
                ) : (
                  <span className="text-sm font-semibold text-gray-900">{matterData.client.name}</span>
                )}
              </div>
            </div>
            <div className="px-4 py-3 bg-white rounded-xl border border-gray-200 shadow-sm">
              <p className="text-xs font-medium text-gray-500 mb-1.5">Status</p>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg capitalize ${getStatusColor(matterData.status)}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                {matterData.status.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-5 py-4 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'text-indigo-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full"></span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="p-6">
        {ActiveComponent && matter_id && (
          <ActiveComponent 
            matterId={Number(matter_id)}
            matterData={matterData}
          />
        )}
      </main>

      {/* Close/Reopen Matter Dialogs */}
      {matterData && (
        <>
          <CloseMatterDialog
            open={closeDialogOpen}
            onOpenChange={setCloseDialogOpen}
            matterId={matterData.id}
            matterTitle={matterData.matterTitle}
            onSuccess={fetchMatterData}
          />
          <ReopenMatterDialog
            open={reopenDialogOpen}
            onOpenChange={setReopenDialogOpen}
            matterId={matterData.id}
            matterTitle={matterData.matterTitle}
            onSuccess={fetchMatterData}
          />
        </>
      )}
    </div>
  );
}