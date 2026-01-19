'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
  Menu,
  LayoutDashboard,
  Users,
  UserCog,
  FileText,
  File,
  Calendar,
  ClipboardList,
  Clock,
  Receipt,
  Wallet,
  HelpCircle,
  Settings,
  LogOut
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

/**
 * Sidebar Component
 * 
 * A collapsible navigation sidebar with main menu items and footer actions.
 * Features:
 * - Toggle collapse/expand functionality
 * - Background image with overlay
 * - Active state highlighting based on current route
 * - Responsive icon-only mode when collapsed
 * - Role-based access control (hides items user can't access)
 * - Uses cached AuthContext (no additional API calls)
 * 
 * @returns {JSX.Element} The sidebar navigation component
 */
export default function Sidebar() {
  // ============================================================================
  // STATE & HOOKS
  // ============================================================================
  
  /** Controls whether the sidebar is collapsed (icon-only) or expanded */
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  /** Controls whether the logout confirmation dialog is open */
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  
  /** Controls loading state during logout */
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  /** Get current pathname for active state highlighting */
  const pathname = usePathname();
  
  /** Get auth context - NO API CALL, uses cached session data */
  const { user, logout, canViewSidebarItem, loading } = useAuth();

  const mainMenuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
    { icon: UserCog, label: 'CRM', href: '/crm' },
    { icon: FileText, label: 'Matter Management', href: '/matter' },
    { icon: Clock, label: 'Timesheets', href: '/timesheet' },
    { icon: Receipt, label: 'Billing & Invoices', href: '/invoice' },
    { icon: Wallet, label: 'Finance Management', href: '/finance' },
    { icon: ClipboardList, label: 'Task Management', href: '/task' },
    { icon: Users, label: 'User Management', href: '/user' },
    { icon: Users, label: 'HR', href: '/hr' },
    { icon: File, label: 'Document Management', href: '/document' },
    { icon: Calendar, label: 'Calendar', href: '/calendar' },
  ];

  const filteredMenuItems = mainMenuItems.filter(item => 
    canViewSidebarItem(item.label)
  );

  // ============================================================================
  // HANDLERS
  // ============================================================================

  /** Handle logout button click - shows confirmation dialog */
  const handleLogoutClick = () => {
    setShowLogoutDialog(true);
  };

  /** Handle confirmed logout - closes dialog and logs out */
  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
      setShowLogoutDialog(false);
    }
  };

  /** Handle cancelled logout - just closes dialog */
  const handleCancelLogout = () => {
    setShowLogoutDialog(false);
  };

  // Footer menu items: Support now uses href instead of onClick
  const footerMenuItems = [
    { icon: HelpCircle, label: 'Support', href: '/support' },
    // { icon: Settings, label: 'Settings', onClick: () => console.log('Settings clicked') },
    { icon: LogOut, label: 'Logout', onClick: handleLogoutClick },
  ];

  // ============================================================================
  // RENDER
  // ============================================================================

  // Show loading state if auth context is still loading
  if (loading) {
    return (
      <div className="w-64 bg-[#0F3C5F] flex items-center justify-center h-screen">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div
      className={`${
        isCollapsed ? 'w-20' : 'w-64'
      } text-white transition-all duration-300 ease-in-out flex flex-col relative overflow-hidden h-screen`}
      style={{
        backgroundImage: 'url("/images/backgroundnavbar.jpg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* ========================================================================
          BACKGROUND OVERLAY
          Adds a semi-transparent blue overlay for better text readability
      ========================================================================= */}
      <div className="absolute inset-0 bg-blue-900/40" aria-hidden="true"></div>

      {/* ========================================================================
          MAIN CONTENT CONTAINER
          Contains header, navigation menu, and footer actions
      ========================================================================= */}
      <div className="relative z-10 flex flex-col h-full">
        
        {/* ======================================================================
            HEADER SECTION
            Contains toggle button and company branding
        ====================================================================== */}
        <div className="p-0 flex items-center gap-0 border-b border-white/10">
          {/* Collapse/Expand Toggle Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!isCollapsed}
            suppressHydrationWarning
          >
            <Menu size={24} />
          </button>
          
          {/* Company Branding - Only visible when expanded */}
          {!isCollapsed && (
            <div className="flex flex-col">
              <Image
                src="/images/TouchStonePartnersWhiteLogo.png"
                alt="Firmtalk"
                height={64}        // h-16 → 64px
                width={200}       // set an approximate width (adjust as needed)
                className="object-contain"
              />
            </div>
          )}
        </div>

        {/* ======================================================================
            MAIN NAVIGATION MENU
            Scrollable list of primary navigation items
            Filtered based on user role - only shows allowed items
        ====================================================================== */}
        <nav className="flex-1 overflow-y-auto py-4 scrollbar-hide" aria-label="Main navigation">
          <ul className="space-y-1 px-2">
            {filteredMenuItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              
              return (
                <li key={index}>
                  <Link
                    href={item.href}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-white text-blue-900 shadow-lg'
                        : 'text-white hover:bg-white/10'
                    } ${isCollapsed ? 'justify-center' : ''}`}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon
                      size={20}
                      className={isActive ? 'text-blue-900' : 'text-white'}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    {/* Menu item label - Only visible when expanded */}
                    {!isCollapsed && (
                      <span className="text-sm font-medium">{item.label}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ======================================================================
            FOOTER MENU
            Contains utility actions (Support, Settings, Logout)
            CHANGE: Support now renders as Link, others remain as buttons
        ====================================================================== */}
        <div className="border-t border-white/10 py-4">
          <ul className="space-y-1 px-2" aria-label="Footer navigation">
            {footerMenuItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = item.href && (pathname === item.href || pathname.startsWith(item.href + '/'));
              
              return (
                <li key={index}>
                  {item.href ? (
                    // Render as Link if href exists (Support)
                    <Link
                      href={item.href}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                        isActive
                          ? 'bg-white text-blue-900 shadow-lg'
                          : 'text-white hover:bg-white/10'
                      } ${isCollapsed ? 'justify-center' : ''}`}
                      aria-label={item.label}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon
                        size={20}
                        strokeWidth={2}
                        aria-hidden="true"
                        className={isActive ? 'text-blue-900' : 'text-white'}
                      />
                      {!isCollapsed && (
                        <span className="text-sm font-medium">{item.label}</span>
                      )}
                    </Link>
                  ) : (
                    // Render as button if onClick exists (Settings, Logout)
                    <button
                      onClick={item.onClick}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all text-white hover:bg-white/10 ${
                        isCollapsed ? 'justify-center' : ''
                      }`}
                      aria-label={item.label}
                      suppressHydrationWarning
                    >
                      <Icon size={20} strokeWidth={2} aria-hidden="true" />
                      {/* Menu item label - Only visible when expanded */}
                      {!isCollapsed && (
                        <span className="text-sm font-medium">{item.label}</span>
                      )}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* ========================================================================
          LOGOUT CONFIRMATION DIALOG
          Shows a confirmation dialog before logging the user out
      ========================================================================= */}
      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to log out? You will need to sign in again to access your account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelLogout}
              disabled={isLoggingOut}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}