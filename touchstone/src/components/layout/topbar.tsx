'use client';

// ============================================================================
// IMPORTS
// ============================================================================
import { Bell, User, ChevronDown } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext'; // Use AuthContext for all data
import { useNotifications } from '@/contexts/NotificationContext';
import AzureConnectButton from '@/components/azure/AzureConnectButton';
import NotificationPanel from '@/components/notifications/NotificationPanel';
import { formatRoleDisplay } from '@/utils/roleDisplay';
// import CurrencySwitcher from '@/components/CurrencySwitcher';   // use when needed

// ============================================================================
// TOPBAR COMPONENT - OPTIMIZED WITH ORIGINAL DESIGN
// Uses AuthContext data only - NO additional API calls
// ============================================================================
export default function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const profileRef = useRef<HTMLDivElement>(null);
  
  // ✅ Get ALL data from AuthContext (already cached - no API call!)
  const { user, role, loading } = useAuth();
  
  // Get notification data from NotificationContext
  const { unreadCount: notificationCount } = useNotifications();
  
  // Local UI state
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  
  // Add this below your other useState declarations
  const [mounted, setMounted] = useState(false);

  // Ensure component waits for the client to hydrate
  useEffect(() => {
    setMounted(true);
  }, []);

  

  // ---------------------------------------------------------------------------
  // GET PAGE TITLE FROM ROUTE
  // ---------------------------------------------------------------------------
  const getPageTitle = () => {
    const routes: Record<string, string> = {
      '/dashboard': 'Dashboard',
      '/user': 'User Management',
      '/crm': 'CRM',
      '/matter': 'Matter Management',
      '/document': 'Document Management',
      '/calendar': 'Calendar',
      '/task': 'Task Management',
      '/timesheet': 'Timesheets',
      '/invoice': 'Billing & Invoices',
      '/finance': 'Finance Management',
      '/profile': 'My Profile',
      '/leave': 'Leave Management',
      '/support': 'Support Center',
      '/hr': 'HR Management',
    };
    
    return routes[pathname] || 'Dashboard';
  };

  const pageTitle = getPageTitle();

  // ---------------------------------------------------------------------------
  // GET USER INITIALS
  // ---------------------------------------------------------------------------
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // ---------------------------------------------------------------------------
  // CLOSE DROPDOWN WHEN CLICKING OUTSIDE
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ---------------------------------------------------------------------------
  // HANDLE PROFILE NAVIGATION
  // ---------------------------------------------------------------------------
  const handleProfileClick = () => {
    setIsProfileOpen(false);
    router.push('/profile');
  };

  const handleLeaveManagementClick = () => {
    router.push('/leave');
  }

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-50 shadow-sm">
      {/* =====================================================================
          PAGE TITLE (LEFT SIDE)
          Automatically updates based on current route
      ===================================================================== */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
          {pageTitle}
        </h1>
      </div>
      
      {/* =====================================================================
          RIGHT SIDE ACTIONS
          Messages, Notifications, and User Profile
      ===================================================================== */}
      <div className="flex items-center gap-3">
        
        {/* ===================================================================
            AZURE CONNECT BUTTON
            Shows Azure connection status and allows connect/disconnect
        =================================================================== */}
        <AzureConnectButton />

        {/* DIVIDER between Azure and notifications */}
        <div className="w-px h-8 bg-gray-200 mx-1" />
        
        {/* ===================================================================
            NOTIFICATIONS BUTTON
            Shows unread notification count badge and opens panel
        =================================================================== */}
        <div className="relative">
          <button 
            onClick={() => setIsNotificationOpen(!isNotificationOpen)}
            className="relative p-2.5 hover:bg-gray-50 rounded-xl transition-all duration-200 group" 
            aria-label="View notifications"
            title="Notifications"
          >
            <Bell size={20} className="text-gray-600 group-hover:text-gray-900 transition-colors" />
            {mounted && notificationCount > 0 && (
              <span className="absolute top-1 right-1 w-5 h-5 bg-red-600 text-white text-xs font-semibold rounded-full flex items-center justify-center border-2 border-white">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </button>

          {/* Notification Panel */}
          <NotificationPanel 
            isOpen={isNotificationOpen}
            onClose={() => setIsNotificationOpen(false)}
          />
        </div>

        {/* DIVIDER between notifications and profile */}
        <div className="w-px h-8 bg-gray-200 mx-2" />
        
        {/* ===================================================================
            PROFILE DROPDOWN
            Displays user info and dropdown menu with profile/logout
            ✅ Uses AuthContext data - NO API calls!
        =================================================================== */}
        <div className="relative" ref={profileRef}>
          
          {/* PROFILE BUTTON */}
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-xl transition-all duration-200 group"
            aria-label="User profile menu"
            title="Profile"
            disabled={loading}
          >
            {/* User Avatar with Initials - ✅ Uses AuthContext user data */}
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center ring-2 ring-blue-100 group-hover:ring-blue-200 transition-all">
              <span className="text-white text-sm font-semibold">
                {getInitials(user?.name)}
              </span>
            </div>
            
            {/* User Name and Role (hidden on mobile) - ✅ Uses AuthContext data */}
            <div className="hidden md:flex flex-col items-start">
              <span className="text-sm font-medium text-gray-900">
                {user?.name || 'User'}
              </span>
              <span className="text-xs text-gray-500">
                {formatRoleDisplay(role?.name) || 'Role'}
              </span>
            </div>
            
            {/* Dropdown Arrow Icon */}
            <ChevronDown 
              size={16} 
              className={`text-gray-500 transition-transform duration-200 hidden md:block ${
                isProfileOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* ================================================================
              DROPDOWN MENU
              Shows user info, profile link, and logout
              ✅ All data from AuthContext - instant render!
          ================================================================ */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-200 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
              
              {/* USER INFO SECTION - ✅ Uses AuthContext data */}
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center ring-2 ring-blue-100">
                    <span className="text-white font-semibold">
                      {getInitials(user?.name)}
                    </span>
                  </div>
                  {/* User Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {user?.name || 'User'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {user?.email || 'email@example.com'}
                    </p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 mt-1">
                      {formatRoleDisplay(role?.name) || 'Role'}
                    </span>
                  </div>
                </div>
              </div>

              {/* MENU ITEMS */}
              <div className="py-2">
                {/* My Profile Link */}
                <button
                  className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors group"
                  onClick={handleProfileClick}
                >
                  <User size={18} className="text-gray-500 group-hover:text-gray-900" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">My Profile</p>
                    <p className="text-xs text-gray-500">View and edit profile</p>
                  </div>
                </button>
                <button
                  className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors group"
                  onClick={handleLeaveManagementClick}
                >
                  <User size={18} className="text-gray-500 group-hover:text-gray-900" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Leave Management</p>
                    <p className="text-xs text-gray-500">View and edit leave management</p>
                  </div>
                </button>

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}