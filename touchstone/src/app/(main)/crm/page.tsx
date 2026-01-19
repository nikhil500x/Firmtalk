'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Plus, ChevronDown, Upload } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import ContactsHub from '@/components/crm/ContactsHub';
import ClientsHub from '@/components/crm/ClientsHub';
import ClientDialog from '@/components/crm/ClientDialog';
import AddContactDialog from '@/components/crm/AddContactDialog';
import MindmapView from '@/components/crm/MindmapView';
import OrgChartView from '@/components/crm/OrgChartView';
import OpportunityPipeline from '@/components/crm/OpportunityPipeline';
import LeadsHub from '@/components/crm/LeadsHub';
import BulkUploadDialog from '@/components/crm/BulkUploadDialog';
import BulkUploadPreview from '@/components/crm/BulkUploadPreview';
import BulkUploadReport from '@/components/crm/BulkUploadReport';
import { API_ENDPOINTS } from '@/lib/api';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { toast } from 'react-toastify';

export const dynamic = 'force-dynamic';

function CRMPageContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'opportunities' | 'leads' | 'contacts' | 'clients' | 'organizations' | 'orgchart'>('contacts');
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [isAddClientDialogOpen, setIsAddClientDialogOpen] = useState(false);
  const [clientsRefreshTrigger, setClientsRefreshTrigger] = useState(0);

  // Set active tab based on URL parameter
  useEffect(() => {
    if (tabParam === 'dashboard') {
      setActiveTab('dashboard');
    } else if (tabParam === 'opportunities') {
      setActiveTab('opportunities');
    } else if (tabParam === 'leads') {
      setActiveTab('leads');
    } else if (tabParam === 'clients') {
      setActiveTab('clients');
    } else if (tabParam === 'contacts') {
      setActiveTab('contacts');
    } else if (tabParam === 'organizations') {
      setActiveTab('organizations');
    } else if (tabParam === 'orgchart') {
      setActiveTab('orgchart');
    }
  }, [tabParam]);

  const handleMoreMenuSelect = (tab: 'opportunities' | 'leads') => {
    setActiveTab(tab);
    setMoreMenuOpen(false);
  };
  const [isAddContactDialogOpen, setIsAddContactDialogOpen] = useState(false);
  const [refreshContacts, setRefreshContacts] = useState(0);
  
  // Bulk upload state
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{
    groups: Array<{ name: string; description?: string; exists: boolean; existingId?: number }>;
    clients: Array<{ name: string; industry?: string; website?: string; address?: string; code?: string; notes?: string; tspContact?: string; groupName: string; exists: boolean; existingId?: number }>;
    contacts: Array<{ name: string; email: string; phone: string; designation?: string; isPrimary: boolean; notes?: string; clientName: string; groupName: string; rowNumber: number }>;
    errors: Array<{ row: number; field: string; message: string }>;
    warnings: Array<{ row: number; message: string }>;
  } | null>(null);
  const [uploadResult, setUploadResult] = useState<{
    groupsCreated: number;
    groupsExisting: number;
    clientsCreated: number;
    clientsExisting: number;
    contactsCreated: number;
    errors: Array<{ row: number; message: string }>;
    warnings: Array<{ row: number; message: string }>;
    createdGroups: Array<{ id: number; name: string }>;
    createdClients: Array<{ id: number; name: string; groupName: string }>;
    createdContacts: Array<{ id: number; name: string; email: string; clientName: string }>;
    resultsFile?: string;
  } | null>(null);


  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleAddNew = () => {
    if (activeTab === 'contacts') {
      setIsAddContactDialogOpen(true);
    } else if (activeTab === 'clients') {
      setIsAddClientDialogOpen(true);
    }
    // Opportunities and Leads have their own add buttons
  };

  const handleClientClick = (clientId: number) => {
    setSelectedClientId(clientId);
    setActiveTab('orgchart');
  };

  const handleBackFromOrgChart = () => {
    setSelectedClientId(null);
    setActiveTab('organizations');
  };

  // const handleUploadCSV = () => {
  //   console.log('Upload CSV for', activeTab);
  //   // TODO: Open CSV upload dialog
  // };

  const handleClientAdded = () => {
    // Trigger refresh of clients list
    setClientsRefreshTrigger((prev) => prev + 1);
  };

  const handleContactAdded = () => {
    console.log('Contact added successfully');
    setRefreshContacts((prev) => prev + 1); // 🔁 triggers ContactsHub to reload
  };

  // Bulk upload handlers
  const handleBulkUploadPreview = (data: {
    groups: Array<{ name: string; description?: string; exists: boolean; existingId?: number }>;
    clients: Array<{ name: string; industry?: string; website?: string; address?: string; code?: string; notes?: string; tspContact?: string; groupName: string; exists: boolean; existingId?: number }>;
    contacts: Array<{ name: string; email: string; phone: string; designation?: string; isPrimary: boolean; notes?: string; clientName: string; groupName: string; rowNumber: number }>;
    errors: Array<{ row: number; field: string; message: string }>;
    warnings: Array<{ row: number; message: string }>;
  }) => {
    setPreviewData(data);
    setIsPreviewOpen(true);
  };

  const handleBulkUploadConfirm = async (updatedData: {
    groups: Array<{ name: string; description?: string; exists: boolean; existingId?: number }>;
    clients: Array<{ name: string; industry?: string; website?: string; address?: string; code?: string; notes?: string; tspContact?: string; groupName: string; exists: boolean; existingId?: number }>;
    contacts: Array<{ name: string; email: string; phone: string; designation?: string; isPrimary: boolean; notes?: string; clientName: string; groupName: string; rowNumber: number }>;
    errors: Array<{ row: number; field: string; message: string }>;
    warnings: Array<{ row: number; message: string }>;
  }) => {
    try {
      const response = await fetch(API_ENDPOINTS.clients.bulkUpload.confirm, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to process bulk upload');
      }

      if (result.success) {
        setUploadResult(result.data);
        setIsPreviewOpen(false);
        setIsReportOpen(true);
        setClientsRefreshTrigger((prev) => prev + 1); // Refresh clients list
      } else {
        throw new Error(result.message || 'Failed to process bulk upload');
      }
    } catch (error: unknown) {
      console.error('Bulk upload confirm error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process bulk upload. Please try again.';
      toast.error(errorMessage);
    }
  };

  const handleUploadAnother = () => {
    setIsReportOpen(false);
    setUploadResult(null);
    setPreviewData(null);
    setIsBulkUploadOpen(true);
  };


  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      {/* ADD CLIENT DIALOG */}
      <ClientDialog
        open={isAddClientDialogOpen}
        onOpenChange={setIsAddClientDialogOpen}
        onSuccess={handleClientAdded}
        mode="create" industries={[]}      />

      {/* ADD CONTACT DIALOG */}
      <AddContactDialog
        open={isAddContactDialogOpen}
        onOpenChange={setIsAddContactDialogOpen}
        onContactAdded={handleContactAdded}
      />

      {/* BULK UPLOAD DIALOG */}
      <BulkUploadDialog
        open={isBulkUploadOpen}
        onOpenChange={setIsBulkUploadOpen}
        onPreviewReady={handleBulkUploadPreview}
      />

      {/* BULK UPLOAD PREVIEW */}
      {previewData && (
        <BulkUploadPreview
          open={isPreviewOpen}
          onOpenChange={setIsPreviewOpen}
          previewData={previewData}
          onConfirm={handleBulkUploadConfirm}
        />
      )}

      {/* BULK UPLOAD REPORT */}
      {uploadResult && (
        <BulkUploadReport
          open={isReportOpen}
          onOpenChange={setIsReportOpen}
          result={uploadResult}
          onUploadAnother={handleUploadAnother}
        />
      )}

      <div className="p-6">
        {/* MAIN CONTENT AREA */}
        <div className="bg-white rounded-[22px] shadow-sm border border-gray-200 overflow-hidden">
          {/* PAGE HEADER */}
          {/* <div className="px-6 pt-6 flex items-center justify-end"> */}
            {/* ACTION BUTTONS */}
            {/* <div className="flex items-center gap-4">
              {(activeTab === 'contacts' || activeTab === 'clients') && (
                <>
                <button
                  onClick={handleAddNew}
                  className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600  text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-colors shadow-sm"
                >
                  <Plus size={20} />
                  <span className="text-sm font-medium">
                    Add New {activeTab === 'contacts' ? 'Contact' : 'Client'}
                  </span>
                </button>
                  {activeTab === 'clients' && (
                    <button
                      onClick={() => setIsBulkUploadOpen(true)}
                      className="flex items-center gap-2 px-4 py-3 bg-white border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors shadow-sm"
                    >
                      <Upload size={20} />
                      <span className="text-sm font-medium">Bulk Upload</span>
                    </button>
                  )}
                </>
              )}
            </div> */}
          {/* </div> */}

          {/* TABS NAVIGATION */}
          <div className="flex items-center justify-between gap-0 px-6 mt-6 border-b border-gray-200 overflow-x-auto">
            {/* Main Tabs */}
            <div className="flex items-center gap-0">
            <button
              onClick={() => {
                setActiveTab('contacts');
                setSelectedClientId(null);
              }}
              className={`px-3 py-2.5 text-base font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'contacts'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Contacts Hub
            </button>
            <button
              onClick={() => {
                setActiveTab('clients');
                setSelectedClientId(null);
              }}
              className={`px-3 py-2.5 text-base font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'clients'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Clients Hub
            </button>
            <button
              onClick={() => {
                setActiveTab('organizations');
                setSelectedClientId(null);
              }}
              className={`px-3 py-2.5 text-base font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'organizations'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Organizations
            </button>
            
            {/* More Menu */}
            <Popover open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  className={`px-3 py-2.5 text-base font-semibold transition-colors whitespace-nowrap flex items-center gap-1 ${
                    ['opportunities', 'leads'].includes(activeTab)
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  More
                  <ChevronDown className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="start">
                <div className="flex flex-col">
                  <button
                    onClick={() => handleMoreMenuSelect('opportunities')}
                    className={`px-3 py-2 text-sm text-left rounded-md transition-colors ${
                      activeTab === 'opportunities'
                        ? 'bg-blue-50 text-blue-600 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Opportunities
                  </button>
                  <button
                    onClick={() => handleMoreMenuSelect('leads')}
                    className={`px-3 py-2 text-sm text-left rounded-md transition-colors ${
                      activeTab === 'leads'
                        ? 'bg-blue-50 text-blue-600 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Leads
                  </button>
                </div>
              </PopoverContent>
            </Popover>
            
            {activeTab === 'orgchart' && selectedClientId && (
              <button
                className="px-3 py-2.5 text-base font-semibold text-blue-600 border-b-2 border-blue-600"
              >
                Org Chart
              </button>
            )}
            </div>

            <div className="flex items-center gap-4 pb-2.5">
              {(activeTab === 'contacts' || activeTab === 'clients') && (
                <>
                <button
                  onClick={handleAddNew}
                  className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600  text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-colors shadow-sm"
                >
                  <Plus size={20} />
                  <span className="text-sm font-medium">
                    Add New {activeTab === 'contacts' ? 'Contact' : 'Client'}
                  </span>
                </button>
                  {activeTab === 'clients' && (
                    <button
                      onClick={() => setIsBulkUploadOpen(true)}
                      className="flex items-center gap-2 px-4 py-3 bg-white border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors shadow-sm"
                    >
                      <Upload size={20} />
                      <span className="text-sm font-medium">Bulk Upload</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* TAB CONTENT - Conditionally rendered components */}
          {/* {activeTab === 'dashboard' && <CRMDashboard />} */}
          {activeTab === 'opportunities' && <OpportunityPipeline />}
          {activeTab === 'leads' && <LeadsHub />}
          {activeTab === 'contacts' && <ContactsHub refreshKey={refreshContacts} />}
          {activeTab === 'clients' && <ClientsHub refreshTrigger={clientsRefreshTrigger} />}
          {activeTab === 'organizations' && (
            <MindmapView onClientClick={handleClientClick} />
          )}
          {activeTab === 'orgchart' && selectedClientId && (
            <OrgChartView clientId={selectedClientId} onBack={handleBackFromOrgChart} />
          )}
        </div>
      </div>
    </>
  );
}

export default function CRMPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <CRMPageContent />
    </Suspense>
  );
}