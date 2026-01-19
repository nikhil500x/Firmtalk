'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface User {
   id: number;
  name: string;
  email: string;
  phone_number?: string | null;
  address?: string | null;
  practice_area?: string | null;
  last_login?: string | null;
  active_status?: boolean;
}

interface Role {
  id: number;
  name: string;
}

interface AuthContextType {
  user: User | null;
  role: Role | null;
  permissions: string[];
  accessibleRoutes: string[];
  accessibleSidebarItems: string[];
  loading: boolean;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  canAccessRoute: (route: string) => boolean;
  canViewSidebarItem: (itemLabel: string) => boolean;
}

// ============================================================================
// CONTEXT CREATION
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider Component
 * 
 * Fetches session and access control data from backend on mount.
 * All child components can access user, role, permissions, and RBAC data
 * without making additional API calls.
 * 
 * Features:
 * - Single session fetch on app load
 * - Backend-driven RBAC (routes and sidebar items)
 * - Automatic route protection based on backend configuration
 * - Cached user/role/permissions data
 * - Logout functionality
 * - Permission checking helpers
 * 
 * @param {Object} props
 * @param {ReactNode} props.children - Child components
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================
  
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [accessibleRoutes, setAccessibleRoutes] = useState<string[]>([]);
  const [accessibleSidebarItems, setAccessibleSidebarItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  const router = useRouter();
  const pathname = usePathname();

  // ==========================================================================
  // SESSION FETCH (ONCE ON MOUNT)
  // ==========================================================================
  
  useEffect(() => {
    const fetchSession = async () => {
      try {
        // Fetch session data
        const sessionResponse = await fetch(`/api/auth/session`, {
          credentials: 'include',
        });

        if (!sessionResponse.ok) {
          // Not authenticated - redirect to login
          if (!pathname.startsWith('/login')) {
            router.push('/login');
          }
          setLoading(false);
          return;
        }

        const sessionData = await sessionResponse.json();
        
        // Fetch access control from backend (single source of truth for RBAC)
        const accessResponse = await fetch(`/api/auth/access-control`, {
          credentials: 'include',
        });

        if (!accessResponse.ok) {
          console.error('Failed to fetch access control');
          // Fallback: still allow access but with empty permissions
          setUser(sessionData.data.user);
          setRole(sessionData.data.role);
          setPermissions(sessionData.data.permissions);
          setAccessibleRoutes(['/dashboard']); // Safe fallback
          setAccessibleSidebarItems(['Dashboard']);
          setLoading(false);
          return;
        }

        const accessData = await accessResponse.json();

        // Cache all data in state
        setUser(sessionData.data.user);
        setRole(sessionData.data.role);
        setPermissions(sessionData.data.permissions);
        
        // Cache RBAC data from backend (not hardcoded!)
        setAccessibleRoutes(accessData.data.accessibleRoutes);
        setAccessibleSidebarItems(accessData.data.accessibleSidebarItems);

        // Check if user can access current route (using backend data)
        const hasAccess = accessData.data.accessibleRoutes.some((route: string) => 
          pathname.startsWith(route)
        );
        
        if (!hasAccess && !pathname.startsWith('/login')) {
          // User doesn't have access - redirect to dashboard
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('Session fetch failed:', error);
        if (!pathname.startsWith('/login')) {
          router.push('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only runs ONCE on mount

  // ==========================================================================
  // ROUTE CHANGE MONITORING
  // ==========================================================================
  
  /**
   * Monitor route changes and verify access without re-fetching session
   * This uses the cached RBAC data from backend
   */
  useEffect(() => {
    if (!loading && accessibleRoutes.length > 0 && !pathname.startsWith('/login')) {
      const hasAccess = accessibleRoutes.some(route => pathname.startsWith(route));
      
      if (!hasAccess) {
        // Redirect to dashboard if trying to access forbidden route
        router.push('/dashboard');
      }
    }
  }, [pathname, accessibleRoutes, loading, router]);

  // ==========================================================================
  // HELPER FUNCTIONS
  // ==========================================================================
  
  /**
   * Logout function
   * Clears session on backend and resets local state
   */
  const logout = async () => {
    try {
      // 1. Attempt to notify the backend
      await fetch(`/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout API call failed, proceeding with local cleanup:', error);
    } finally {
      // 2. Always clear local storage regardless of API success/failure
      localStorage.clear();

      // 3. Hard redirect resets all React state (setUser, setRole, etc.) 
      // and ensures the user can't "back-button" into a private route
      window.location.replace('/login');
    }
  };

  /**
   * Check if user has a specific permission
   * @param permission - Permission name to check
   * @returns boolean
   */
  const hasPermission = (permission: string): boolean => {
    return permissions.includes(permission);
  };

  /**
   * Check if user's role can access a specific route
   * Uses backend-provided accessible routes (not hardcoded)
   * @param route - Route path to check (e.g., '/user', '/crm')
   * @returns boolean
   */
  const canAccessRoute = (route: string): boolean => {
    return accessibleRoutes.includes(route);
  };

  /**
   * Check if user's role can view a specific sidebar item
   * Uses backend-provided accessible sidebar items (not hardcoded)
   * @param itemLabel - Sidebar item label (e.g., 'User Management')
   * @returns boolean
   */
  const canViewSidebarItem = (itemLabel: string): boolean => {
    return accessibleSidebarItems.includes(itemLabel);
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  
  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        permissions,
        accessibleRoutes,
        accessibleSidebarItems,
        loading,
        logout,
        hasPermission,
        canAccessRoute,
        canViewSidebarItem,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================================
// CUSTOM HOOK
// ============================================================================

/**
 * useAuth Hook
 * 
 * Custom hook to access authentication context
 * Must be used within AuthProvider
 * 
 * @returns AuthContextType
 * @throws Error if used outside AuthProvider
 * 
 * @example
 * const { user, role, logout } = useAuth();
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

