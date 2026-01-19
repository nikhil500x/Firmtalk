import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../prisma-client.js';
import { getRedirectUrlByRole, getAccessibleRoutes, getAccessibleSidebarItems } from '../utils/roleMapping.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/auth/login
 * Login endpoint
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate input , second validation in the backend
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
      return;
    }

    // 1. Find user by email with relations
    const user = await prisma.users.findUnique({
      where: { email },
      include: {
        role: {
          include: {
            role_permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    // Generic error message to prevent email enumeration
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    // Check if user is active
    if (!user.active_status) {
      res.status(401).json({
        success: false,
        message: 'Account is inactive',
      });
      return;
    }

    // Check if user has completed onboarding
    if (!user.is_onboarded) {
      res.status(401).json({
        success: false,
        message: 'Account setup is not complete. Please complete your onboarding.',
      });
      return;
    }

    // 2. Verify password
    // Check if password exists (shouldn't be null for onboarded users)
    if (!user.password) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    // Use bcrypt to compare passwords
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    // 3. Extract permissions from role
    const permissions = user.role.role_permissions.map(
      rp => rp.permission.name
    );

    // 4. Create session and store user data
    req.session.userId = user.user_id;
    req.session.email = user.email;
    req.session.name = user.name ?? undefined;
    req.session.role = {
      id: user.role.role_id,
      name: user.role.name,
    };
    req.session.permissions = permissions;

    // Explicitly mark session as modified
    req.session.touch();

    // Save session to Redis
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          reject(err);
        } else {
          console.log('Session saved successfully. Session ID:', req.sessionID);
          console.log('Cookie will be set by express-session middleware');
          resolve();
        }
      });
    });

    // Update last login timestamp
    await prisma.users.update({
      where: { user_id: user.user_id },
      data: { last_login: new Date() },
    });

    // 5. Determine redirect URL based on role
    const redirectUrl = getRedirectUrlByRole(user.role.name);

    // 6. Log session details before sending response
    console.log('[LOGIN DEBUG] Session ID:', req.sessionID);
    console.log('[LOGIN DEBUG] Session userId:', req.session.userId);
    console.log('[LOGIN DEBUG] Session cookie config:', {
      domain: req.session.cookie.domain,
      path: req.session.cookie.path,
      httpOnly: req.session.cookie.httpOnly,
      secure: req.session.cookie.secure,
      sameSite: req.session.cookie.sameSite,
    });
    console.log('[LOGIN DEBUG] Response headers before send:', res.getHeaders());
    
    // 7. Return success response
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.user_id,
          name: user.name,
          email: user.email,
        },
        role: user.role.name,
        permissions: permissions,
        redirectUrl: redirectUrl,
      },
    });
    
    // Log after response is sent (this won't block)
    console.log('[LOGIN DEBUG] Login response sent. Check Set-Cookie header in browser DevTools.');
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during login',
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout endpoint
 */
router.post('/logout', (req: Request, res: Response): void => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({
        success: false,
        message: 'Logout failed',
      });
      return;
    }
    
    res.clearCookie('touchstone.sid');
    res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  });
});

/**
 * GET /api/auth/session
 * Get current session data
 */
router.get('/session', (req: Request, res: Response): void => {
  if (!req.session || !req.session.userId) {
    res.status(401).json({
      success: false,
      message: 'Not authenticated',
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: req.session.userId,
        name: req.session.name,
        email: req.session.email,
        
      },
      role: req.session.role,
      permissions: req.session.permissions,
    },
  });
});

/**
 * GET /api/auth/access-control
 * Returns user's accessible routes and sidebar items based on role
 * This is the single source of truth for frontend RBAC
 */
router.get('/access-control', requireAuth, (req: Request, res: Response): void => {
  try {
    const userRole = req.session.role?.name;
    
    if (!userRole) {
      res.status(401).json({
        success: false,
        message: 'Role not found in session',
      });
      return;
    }

    // Get accessible routes and sidebar items from centralized config
    const accessibleRoutes = getAccessibleRoutes(userRole);
    const accessibleSidebarItems = getAccessibleSidebarItems(userRole);

    res.status(200).json({
      success: true,
      data: {
        role: userRole,
        accessibleRoutes,
        accessibleSidebarItems,
        permissions: req.session.permissions || [],
      },
    });
  } catch (error) {
    console.error('Access control fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch access control',
    });
  }
});

export default router;

