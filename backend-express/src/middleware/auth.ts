import { Request, Response, NextFunction } from 'express';

/**
 * Authentication middleware
 * Checks if user is authenticated via session
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  // Debug logging for session issues
  console.log('[AUTH DEBUG] Path:', req.path);
  console.log('[AUTH DEBUG] Cookie header:', req.headers.cookie);
  console.log('[AUTH DEBUG] Session ID:', req.sessionID);
  console.log('[AUTH DEBUG] Session exists:', !!req.session);
  console.log('[AUTH DEBUG] User ID in session:', req.session?.userId);
  
  if (!req.session || !req.session.userId) {
    console.log('[AUTH DEBUG] ❌ Auth failed - no session or userId');
    console.log('[AUTH DEBUG] Session object:', req.session);
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
    return;
  }
  console.log('[AUTH DEBUG] ✅ Auth success for user:', req.session.userId);
  next();
};

/**
 * Role-based authorization middleware
 * @param allowedRoles - Array of role names allowed to access the route
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session || !req.session.userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const userRole = req.session.role?.name;
    
    if (!userRole || !allowedRoles.includes(userRole)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
};

/**
 * Permission-based authorization middleware
 * @param requiredPermissions - Array of permission names required
 */
export const requirePermission = (requiredPermissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session || !req.session.userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const userPermissions = req.session.permissions || [];
    const hasPermission = requiredPermissions.every(permission => 
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
};

