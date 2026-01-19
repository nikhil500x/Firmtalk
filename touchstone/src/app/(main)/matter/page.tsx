'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Plus, X, Users } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import MatterMasterTable from '@/components/matter/MatterMasterTable';
import MatterMasterDialog from '@/components/matter/MatterMasterDialog';
import RateCardTable from '@/components/invoice/RateCardTable';
import RateCardDialog from '@/components/invoice/RateCardDialog';

interface Matter {
  id: number | string;
  [key: string]: unknown;
}

export const dynamic = 'force-dynamic';

function MatterManagementPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab');
  const userIdParam = searchParams.get('user');
  const statusParam = searchParams.get('status');

  type TabType = 'matter-master' | 'rate-cards';
  const [activeTab, setActiveTab] = useState<TabType>('matter-master');
  const [isAddMatterDialogOpen, setIsAddMatterDialogOpen] = useState(false);
  const [matterRefreshTrigger, setMatterRefreshTrigger] = useState(0);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [selectedMatter, setSelectedMatter] = useState<Matter | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isRateCardDialogOpen, setIsRateCardDialogOpen] = useState(false);
  const [rateCardDialogMode, setRateCardDialogMode] = useState<'create' | 'edit'>('create');
  const [editingRateCardId, setEditingRateCardId] = useState<number | undefined>(undefined);

  // Set active tab based on URL parameter
  useEffect(() => {
    if (tabParam === 'matter-master') {
      setActiveTab('matter-master');
    }
  }, [tabParam]);

  // Fetch user name if filtering by user
  useEffect(() => {
    const fetchUserName = async () => {
      if (userIdParam) {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users/${userIdParam}`, {
            credentials: 'include'
          });
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setUserName(data.data.name);
            }
          }
        } catch (error) {
          console.error('Error fetching user name:', error);
        }
      } else {
        setUserName(null);
      }
    };
    fetchUserName();
  }, [userIdParam]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleAddNewMatter = () => {
    setSelectedMatter(null);
    setDialogMode('create');
    setIsAddMatterDialogOpen(true);
  };

  const handleMatterAdded = () => {
    setMatterRefreshTrigger((prev) => prev + 1);
    setIsAddMatterDialogOpen(false);
  };

  const handleEditMatter = (matter: {
    id: string;
    matterId?: string;
    matterTitle?: string;
    clientName?: string;
    matterType?: string;
    assignedLawyer?: string;
    status?: string;
    deadline?: string;
    [key: string]: unknown;
  }) => {
    console.log('Edit matter clicked:', matter);
    setSelectedMatter(matter as Matter);
    setDialogMode('edit');
    setIsAddMatterDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsAddMatterDialogOpen(false);
    setSelectedMatter(null);
    setDialogMode('create');
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  const handleEditRateCard = (rateCard: {
    ratecard_id: number;
  }) => {
    setEditingRateCardId(rateCard.ratecard_id);
    setRateCardDialogMode('edit');
    setIsRateCardDialogOpen(true);
  };

  const handleAddRateCard = () => {
    setEditingRateCardId(undefined);
    setRateCardDialogMode('create');
    setIsRateCardDialogOpen(true);
  };

  return (
    <>
      {/* MATTER DIALOG (Create/Edit) */}
      <MatterMasterDialog
        open={isAddMatterDialogOpen}
        onOpenChange={(open) => {
          if (!open) handleDialogClose();
          setIsAddMatterDialogOpen(open);
        }}
        mode={dialogMode}
        matterId={selectedMatter?.id?.toString()}
        initialData={selectedMatter || undefined}
        onSuccess={handleMatterAdded}
      />

      <RateCardDialog
        open={isRateCardDialogOpen}
        onOpenChange={setIsRateCardDialogOpen}
        mode={rateCardDialogMode}
        rateCardId={editingRateCardId}
        onSuccess={() => {
          setMatterRefreshTrigger(prev => prev + 1);
          setIsRateCardDialogOpen(false);
          setEditingRateCardId(undefined);
          setRateCardDialogMode('create');
        }}
      />

      <div className="p-6">
        {/* Show filter info if filtering by user */}
        {userIdParam && statusParam && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-blue-800">
                Showing <strong>{statusParam === 'active' ? 'open' : 'closed'}</strong> matters for{' '}
                <strong>{userName || `User ID: ${userIdParam}`}</strong>
              </span>
            </div>
            <button
              onClick={() => router.push('/matter')}
              className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 p-1 rounded transition-colors"
              title="Clear filter"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* MAIN CONTENT AREA */}
        <div className="bg-white rounded-[22px] shadow-sm border border-gray-200 overflow-hidden">
          {/* TABS AND ACTION BUTTON */}
          <div className="flex items-center justify-between pb-3 px-6 mt-6 border-b border-gray-200">
            {/* TABS NAVIGATION */}
            <div className="flex items-center gap-0">
              <button
                onClick={() => setActiveTab('matter-master')}
                className={`px-3 py-2.5 text-base font-semibold transition-colors ${activeTab === 'matter-master'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
                  }`}
              >
                Matter Master
              </button>
              <button
                onClick={() => setActiveTab('rate-cards')}
                className={`px-3 py-2.5 text-base font-semibold transition-colors ${activeTab === 'rate-cards'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
                  }`}
              >
                Rate Cards
              </button>
            </div>

            {/* ACTION BUTTONS */}
            {activeTab === 'matter-master' && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push('/matter/user-overview')}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 
                            bg-gray-100 hover:bg-gray-200 
                            text-gray-700 rounded-xl 
                            transition-all duration-200"
                >
                  <Users size={18} />
                  <span className="text-sm font-medium">User Overview</span>
                </button>
                <button
                  onClick={handleAddNewMatter}
                  className="flex items-center justify-center gap-2 px-4 py-2.5
                              bg-gradient-to-b from-blue-500 to-blue-600 
                              text-white rounded-lg 
                              hover:from-blue-600 hover:to-blue-700 
                              transition-all duration-200 shadow-md 
                              hover:shadow-lg active:scale-[0.98]"
                >
                  <Plus size={20} className="stroke-[2.5]" />
                  <span className="text-base font-medium">Add New Matter</span>
                </button>
              </div>

            )}
            {activeTab === 'rate-cards' && (
              <button
                onClick={handleAddRateCard}
                className="mb-2 flex items-center justify-center gap-2 px-4 py-2.5 
                          bg-gradient-to-b from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-colors duration-200"
              >
                <Plus size={20} className="stroke-[2.5]" />
                <span className="text-base font-medium">Add Rate Card</span>
              </button>
            )}

          </div>
          {/* TAB CONTENT */}
          {activeTab === 'matter-master' && (
            <MatterMasterTable
              refreshTrigger={matterRefreshTrigger}
              onEdit={handleEditMatter}
              onRefresh={handleMatterAdded}
              userIdFilter={userIdParam ? parseInt(userIdParam) : undefined}
              statusFilter={statusParam || undefined}
            />
          )}
          {activeTab === 'rate-cards' && (
            <RateCardTable
              refreshTrigger={matterRefreshTrigger}
              onEdit={handleEditRateCard}
            />
          )}
        </div>
      </div>
    </>
  );

}

export default function MatterManagementPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <MatterManagementPageContent />
    </Suspense>
  );
}