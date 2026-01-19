'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Plus } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import TaskOverview from '@/components/task/TaskOverview';
import MyTask from '@/components/task/MyTask';
import AllTask from '@/components/task/AllTask';
import TaskDialog from '@/components/task/TaskDialog';

export const dynamic = 'force-dynamic';

function TasksPageContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const priorityParam = searchParams.get('priority');
  const statusParam = searchParams.get('status');
  
  const [activeTab, setActiveTab] = useState<'mytasks' | 'alltasks'>('mytasks');
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit' | 'view'>('add');
  const [selectedTaskId, setSelectedTaskId] = useState<number | undefined>(undefined);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Persist view mode for each tab separately
  const [viewModes, setViewModes] = useState<{
    mytasks: 'board' | 'table';
    alltasks: 'board' | 'table';
  }>({
    mytasks: 'board',
    alltasks: 'board'
  });

  // Set active tab based on URL parameter
  useEffect(() => {
    if (tabParam === 'mytasks') {
      setActiveTab('mytasks');
    } else if (tabParam === 'alltasks') {
      setActiveTab('alltasks');
    } else if (priorityParam || statusParam) {
      // If there's a priority or status filter but no tab specified, default to alltasks
      setActiveTab('alltasks');
    }
  }, [tabParam, priorityParam, statusParam]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleAddTask = () => {
    setDialogMode('add');
    setSelectedTaskId(undefined);
    setShowTaskDialog(true);
  };

  const handleEditTask = (taskId: number) => {
    setDialogMode('edit');
    setSelectedTaskId(taskId);
    setShowTaskDialog(true);
  };

  const handleViewTask = (taskId: number) => {
    setDialogMode('view');
    setSelectedTaskId(taskId);
    setShowTaskDialog(true);
  };

  const handleCloseDialog = () => {
    setShowTaskDialog(false);
    setSelectedTaskId(undefined);
  };

  const handleTaskSuccess = () => {
    // Trigger refresh of task lists
    setRefreshTrigger(prev => prev + 1);
  };

  const handleViewModeChange = (tab: 'mytasks' | 'alltasks', mode: 'board' | 'table') => {
    setViewModes(prev => ({
      ...prev,
      [tab]: mode
    }));
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      <div className="p-6">
        {/* MAIN CONTENT AREA */}
        <div className="bg-white rounded-[22px] shadow-sm border border-gray-200 overflow-hidden">
          {/* PAGE HEADER */}
          {/* <div className="px-6 pt-6 flex items-center justify-between">
            
            ACTION BUTTONS
            
          </div> */}


          {/* TABS NAVIGATION */}
          <div className="flex items-center justify-between gap-0 px-6 mt-6 border-b border-gray-200 py-2.5">
            <div className="flex items-center gap-0">
              <button
                onClick={() => setActiveTab('mytasks')}
                className={`px-3 py-2.5 text-base font-semibold transition-colors ${
                  activeTab === 'mytasks'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                My Tasks
              </button>
              <button
                onClick={() => setActiveTab('alltasks')}
                className={`px-3 py-2.5 text-base font-semibold transition-colors ${
                  activeTab === 'alltasks'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                All Tasks
              </button>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleAddTask}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-b from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-colors shadow-sm"
              >
                <Plus size={20} />
                <span className="text-sm font-medium">Add New Task</span>
              </button>
            </div>
          </div>

          {/* TAB CONTENT - Conditionally rendered components */}
          {activeTab === 'mytasks' && (
            <MyTask 
              key={refreshTrigger}
              onEditTask={handleEditTask}
              onViewTask={handleViewTask}
              viewMode={viewModes.mytasks}
              onViewModeChange={(mode) => handleViewModeChange('mytasks', mode)}
            />
          )}
          {activeTab === 'alltasks' && (
            <AllTask 
              key={refreshTrigger}
              onEditTask={handleEditTask}
              onViewTask={handleViewTask}
              viewMode={viewModes.alltasks}
              onViewModeChange={(mode) => handleViewModeChange('alltasks', mode)}
            />
          )}
        </div>
      </div>

      {/* Task Dialog */}
      <TaskDialog
        isOpen={showTaskDialog}
        onClose={handleCloseDialog}
        mode={dialogMode}
        taskId={selectedTaskId}
        onSuccess={handleTaskSuccess}
      />
    </>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <TasksPageContent />
    </Suspense>
  );
}