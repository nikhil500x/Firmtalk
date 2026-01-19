'use client';

import { useAuth } from '@/contexts/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoute: string; // e.g., '/user', '/invoice', '/finance'
}

/**
 * ProtectedRoute Component
 * 
 * Prevents unauthorized access to protected routes by checking user permissions
 * before rendering the page content. Shows loading state during auth check
 * and redirects immediately if user lacks access.
 * 
 * This prevents the "flash of unauthorized content" issue by blocking render
 * until authorization is confirmed.
 * 
 * @param children - The page content to protect
 * @param requiredRoute - The route path that needs to be in user's accessible routes
 * 
 * @example
 * export default function UserPage() {
 *   return (
 *     <ProtectedRoute requiredRoute="/user">
 *       <div>User Management Content</div>
 *     </ProtectedRoute>
 *   );
 * }
 */
export default function ProtectedRoute({ children, requiredRoute }: ProtectedRouteProps) {
  const { accessibleRoutes, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      const hasAccess = accessibleRoutes.some(route => pathname.startsWith(route));
      
      if (!hasAccess) {
        // Redirect immediately to dashboard
        router.replace('/dashboard');
      }
    }
  }, [loading, accessibleRoutes, pathname, router]);

  // Show loading state while checking permissions
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[600px]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <div className="mt-4 text-lg text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  // Check if user has access to this route
  const hasAccess = accessibleRoutes.some(route => pathname.startsWith(route));
  
  if (!hasAccess) {
    // Show unauthorized message while redirecting (prevents flash)
    return (
      <div className="flex items-center justify-center h-full min-h-[600px] bg-gray-50">
        <div className="max-w-md p-8 bg-white rounded-lg shadow-lg text-center">
          <ShieldAlert className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 mb-6">
            You don&apos;t have permission to access this page. Redirecting to dashboard...
          </p>
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent" />
        </div>
      </div>
    );
  }

  // User has access - render the page
  return <>{children}</>;
}

