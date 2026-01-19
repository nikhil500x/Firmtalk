/**
 * Role-Based Access Control (RBAC) Configuration
 * Centralizes role-based routing and access control logic
 * 
 * This file defines:
 * - Default login redirect (same for all users)
 * - Route access permissions per role
 * - Helper functions for permission checking
 */

export const DEFAULT_LOGIN_REDIRECT = '/dashboard';

// ============================================================================
// ROLE-BASED ROUTE ACCESS
// ============================================================================

/**
 * Define which routes each role can access
 * Used for backend route protection and frontend navigation filtering
 */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  // Level 1 — Superadmin
  'superadmin': [
    '/dashboard', '/user', '/crm', '/matter', '/document',
    '/calendar', '/task', '/timesheet', '/invoice',
    '/finance', '/profile', '/leave', '/support', '/hr',
  ],

  // Level 2 — Partner & Admin
  'admin': [
    '/dashboard', '/user', '/crm', '/matter', '/document',
    '/calendar', '/task', '/timesheet', '/invoice',
    '/finance', '/profile', '/leave', '/support', '/hr',
  ],
  'partner': [
    '/dashboard', '/user', '/crm', '/matter', '/document',
    '/calendar', '/task', '/timesheet', '/invoice',
    '/finance', '/profile', '/leave', '/support', '/hr',
  ],

  // Level 3 — Staff
  'hr': [
    '/dashboard', '/user', '/timesheet', '/finance',
    '/task', '/document', '/calendar', '/profile',
    '/leave', '/support', '/hr',
  ],
  'it': [
    '/dashboard', '/user', '/crm', '/matter', '/document',
    '/calendar', '/task', '/timesheet', '/finance',
    '/profile', '/leave', '/support', '/hr','/invoice',
  ],
  'accountant': [
    '/dashboard', '/matter', '/timesheet', '/finance',
    '/task', '/document', '/calendar', '/invoice',
    '/profile', '/leave', '/support', '/hr',
  ],
  'support': [
    '/dashboard', '/user', '/crm', '/matter', '/document',
    '/calendar', '/task', '/timesheet', '/finance',
    '/profile', '/leave', '/support', '/hr',
  ],

  // Level 4 — Lawyers 
  'sr-associate': [
    '/dashboard', '/matter', '/document', '/calendar',
    '/task', '/timesheet', '/profile', '/leave',
    '/support',
  ],
  'associate': [
    '/dashboard', '/matter', '/document', '/calendar',
    '/task', '/timesheet', '/profile', '/leave',
    '/support',
  ],
  'counsel': [
    '/dashboard', '/matter', '/document', '/calendar',
    '/task', '/timesheet', '/profile', '/leave',
    '/support',
  ],
  'intern': [
    '/dashboard', '/timesheet', '/task', '/document',
    '/calendar', '/profile', '/leave',
    '/support',
  ],
};


/**
 * Define which sidebar items each role can see
 * Maps to the labels in sidebar component
 */
export const ROLE_SIDEBAR_ACCESS: Record<string, string[]> = {
  // Level 1 — Superadmin
  'superadmin': [
    'Dashboard', 'User Management', 'CRM',
    'Matter Management', 'Document Management',
    'Calendar', 'Task Management', 'Timesheets',
    'Billing & Invoices', 'Finance Management',
    'Profile', 'Leave', 'Support', 'HR',
  ],

  // Level 2 — Partner & Admin
  'admin': [
    'Dashboard', 'User Management', 'CRM',
    'Matter Management', 'Document Management',
    'Calendar', 'Task Management', 'Timesheets',
    'Billing & Invoices', 'Finance Management',
    'Support', 'HR',
  ],
  'partner': [
    'Dashboard', 'User Management', 'CRM',
    'Matter Management', 'Document Management',
    'Calendar', 'Task Management', 'Timesheets',
    'Billing & Invoices', 'Finance Management',
    'Support', 'HR',
  ],

  // Level 3 — Staff
  'hr': [
    'Dashboard', 'User Management', 'Timesheets',
    'Finance Management', 'Task Management',
    'Document Management', 'Calendar',
    'Support', 'HR',
  ],
  'it': [
    'Dashboard', 'User Management', 'CRM',
    'Matter Management', 'Document Management',
    'Calendar', 'Task Management', 'Timesheets',
    'Billing & Invoices',
    'Finance Management', 'Support', 'HR',
  ],
  'accountant': [
    'Dashboard', 'Matter Management', 'Timesheets',
    'Finance Management', 'Task Management',
    'Billing & Invoices', 'Document Management',
    'Calendar', 'Support', 'HR',
  ],
  'support': [
    'Dashboard', 'User Management', 'CRM',
    'Matter Management', 'Document Management',
    'Calendar', 'Task Management', 'Timesheets',
    'Finance Management', 'Support', 'HR',
  ],

  // Level 4 — Lawyers (NO HR sidebar)
  'sr-associate': [
    'Dashboard', 'Matter Management', 'Document Management',
    'Calendar', 'Task Management', 'Timesheets',
    'Support',
  ],
  'associate': [
    'Dashboard', 'Matter Management', 'Document Management',
    'Calendar', 'Task Management', 'Timesheets',
    'Support',
  ],
  'counsel': [
    'Dashboard', 'Matter Management', 'Document Management',
    'Calendar', 'Task Management', 'Timesheets',
    'Support',
  ],
  'intern': [
    'Dashboard', 'Timesheets', 'Task Management',
    'Document Management', 'Calendar',
    'Support',
  ],
};


// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get redirect URL after login (now same for all roles)
 * @param roleName - User's role name (no longer used, kept for backwards compatibility)
 * @returns Default dashboard URL
 */
export const getRedirectUrlByRole = (roleName: string): string => {
  return DEFAULT_LOGIN_REDIRECT;
};

/**
 * Check if a user's role can access a specific route
 * @param roleName - User's role name
 * @param route - Route to check (e.g., '/user', '/crm')
 * @returns boolean - true if user can access the route
 */
export const canAccessRoute = (roleName: string, route: string): boolean => {
  const allowedRoutes = ROLE_PERMISSIONS[roleName] || [];
  return allowedRoutes.includes(route);
};

/**
 * Get all routes accessible by a specific role
 * @param roleName - User's role name
 * @returns Array of accessible route paths
 */
export const getAccessibleRoutes = (roleName: string): string[] => {
  return ROLE_PERMISSIONS[roleName] || [];
};

/**
 * Check if a role exists in the system
 * @param roleName - Role name to check
 * @returns boolean - true if role exists
 */
export const isValidRole = (roleName: string): boolean => {
  return roleName in ROLE_PERMISSIONS;
};

/**
 * Get all valid role names defined in the system
 * @returns Array of role names
 */
export const getAllRoles = (): string[] => {
  return Object.keys(ROLE_PERMISSIONS);
};

/**
 * Get all sidebar items accessible by a specific role
 * @param roleName - User's role name
 * @returns Array of accessible sidebar item labels
 */
export const getAccessibleSidebarItems = (roleName: string): string[] => {
  return ROLE_SIDEBAR_ACCESS[roleName] || [];
};

