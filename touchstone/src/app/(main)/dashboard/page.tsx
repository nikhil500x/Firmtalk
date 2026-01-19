'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import MatterOverview from '@/components/matter/MatterOverview';
import TimesheetOverview from '@/components/timesheet/TimesheetOverview';
import DashboardGrid from '@/components/dashboard/DashboardGrid';
import TimesheetSummaryWidget from '@/components/dashboard/widgets/TimesheetSummaryWidget';
import TasksWidget from '@/components/dashboard/widgets/TasksWidget';
import MattersWidget from '@/components/dashboard/widgets/MattersWidget';
import LeavesWidget from '@/components/dashboard/widgets/LeavesWidget';
import CRMDashboard from '@/components/crm/CRMDashboard';
import UserMatterStats from '@/components/matter/UserMatterStats';

/**
 * Dashboard Page Component
 * 
 * Main dashboard that all users land on after login.
 * Uses AuthContext to display user-specific information and role-based content.
 * Features tabbed interface for different dashboard views.
 * NO additional API calls - uses cached session data from AuthProvider.
 */
export default function DashboardPage() {
  // ============================================================================
  // STATE
  // ============================================================================
  
  const [activeTab, setActiveTab] = useState<'overview' | 'matters' | 'timesheets' | 'crm' | 'user-overview'>('overview');

  // ============================================================================
  // AUTH CONTEXT - NO API CALL, uses cached data
  // ============================================================================
  
  const { user, role, loading, canAccessRoute } = useAuth();

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-xl text-gray-600">Loading dashboard...</div>
      </div>
    );
  }

  // ============================================================================
  // TAB CONFIGURATION - Filter tabs based on route access
  // ============================================================================
  
  const allTabs = [
    { id: 'overview' as const, label: 'Overview', route: '/dashboard' },
    { id: 'matters' as const, label: 'Matters', route: '/matter' },
    { id: 'timesheets' as const, label: 'Timesheets', route: '/timesheet' },
    { id: 'crm' as const, label: 'CRM', route: '/crm' },
    // { id: 'user-overview' as const, label: 'User Overview', route: '/matter' }, // ✅ NEW TAB
  ];

  // Filter tabs based on user's accessible routes (always show Overview)
  const tabs = allTabs.filter(tab => 
    tab.route === '/dashboard' || canAccessRoute(tab.route)
  );

  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <>
      {/* MAIN CONTENT AREA */}
      <div className="p-6">
        
        {/* TAB NAVIGATION */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* TAB CONTENT */}
        <div className="tab-content">
          
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <>
            <DashboardGrid />
            <div className="space-y-6">
              {/* Welcome Section */}
              {/* <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  Welcome to Touchstone Partners, {user?.name}!
                </h2>
                <p className="text-gray-600 mb-4">
                  You&apos;re logged in as <span className="font-semibold text-blue-600">{formatRoleDisplay(role?.name)}</span>
                </p>
                
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <h3 className="text-lg font-semibold mb-3 text-gray-800">Your Account Details:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="text-base font-medium text-gray-900">{user?.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Role</p>
                      <p className="text-base font-medium text-gray-900">{formatRoleDisplay(role?.name)}</p>
                    </div>
                  </div>
                </div>
              </div> */}

              {/* Widgets Grid - Conditionally render based on route access */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {canAccessRoute('/timesheet') && <TimesheetSummaryWidget />}
                {canAccessRoute('/task') && <TasksWidget />}
                {canAccessRoute('/matter') && <MattersWidget />}
                {canAccessRoute('/leave') && <LeavesWidget />}
              </div>
            </div>
            </>
          )}

          {/* MATTERS TAB */}
          {activeTab === 'matters' && (
            <MatterOverview />
          )}

          {/* TIMESHEETS TAB */}
          {activeTab === 'timesheets' && (
            <TimesheetOverview />
          )}

          {/* CRM TAB */}
          {activeTab === 'crm' && (
            <CRMDashboard />
          )}

          {/* USER OVERVIEW TAB */}
          {activeTab === 'user-overview' && (
            <UserMatterStats />
          )}

          
        </div>
      </div>
    </>
  );
}