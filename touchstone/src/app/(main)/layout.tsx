'use client';

import React from 'react';
import Sidebar from '@/components/layout/sidebar';
import Topbar from '@/components/layout/topbar';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
// import { CurrencyProvider } from '@/contexts/CurrencyContext'; //wraps entire layout to provide currency context
import CommandPaletteWrapper from '@/components/dashboard/CommandPaletteWrapper';

/**
 * Dashboard Layout Component
 * 
 * Root layout for the dashboard section of the application.
 * Provides consistent structure across all dashboard pages.
 * 
 * Features:
 * - AuthProvider wraps entire layout for session management
 * - Single session fetch on mount (cached in context)
 * - Persistent sidebar navigation
 * - Fixed topbar with user profile and notifications
 * - Scrollable main content area
 * - Responsive flexbox layout
 * - Full viewport height
 * 
 * Layout Structure:
 * ┌─────────────────────────────────┐
 * │ Sidebar │  Topbar (sticky)      │
 * │  (fixed)├───────────────────────┤
 * │         │  Main Content Area    │
 * │         │  (scrollable)         │
 * │         │  {children}           │
 * └─────────────────────────────────┘
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Page content to be rendered in the main area
 * @returns {JSX.Element} The dashboard layout wrapper
 * 
 * @example
 * // This layout wraps all pages in /app/(main)/
 * // Usage in Next.js App Router:
 * // app/(main)/layout.tsx
 */
export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // =========================================================================
    // AUTH PROVIDER WRAPPER
    // Fetches session ONCE and provides cached data to all child components
    // =========================================================================
    <AuthProvider>
      <NotificationProvider>
        <CommandPaletteWrapper />
        <div className="flex h-screen bg-gray-50">
          <Sidebar /> {/*  Uses AuthContext for role-based filtering */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Topbar />
          <main 
            className="flex-1 overflow-auto"
            role="main"
            aria-label="Main content"
          >
            {children}
          </main>
        </div>
      </div>
      </NotificationProvider>
    </AuthProvider>
  );
}