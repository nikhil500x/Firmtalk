import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../prisma-client.js';

const router = Router();

/**
 * GET /api/profile
 * Get current logged-in user's complete profile information
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if user is authenticated
    if (!req.session || !req.session.userId) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
      return;
    }

    // Fetch complete user data from database
    const user = await prisma.users.findUnique({
      where: { 
        user_id: req.session.userId 
      },
      include: {
        role: true, // Include role information
      },
    });

    // User not found
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Return complete profile data (excluding password)
    res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        user: {
          user_id: user.user_id,
          name: user.name,
          email: user.email,
          phone: user.phone ?? undefined,
          phone_number: user.phone ?? undefined, // For compatibility
          practice_area: user.practice_area ?? undefined,
          last_login: user.last_login ?? undefined,
          active_status: user.active_status,
          gender: user.gender ?? undefined,
          location: user.location ?? undefined,
          user_type: user.user_type ?? undefined,
          user_code: user.user_code ?? undefined,
          date_of_joining: user.date_of_joining ?? undefined,
        },
        role: {
          role_id: user.role.role_id,
          name: user.role.name,
        },
      },
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching profile',
      error: process.env.NODE_ENV === 'development' ? error : undefined,
    });
  }
});

/**
 * POST /api/profile/verify-password
 * Verify user's current password
 */
router.post('/verify-password', async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if user is authenticated
    if (!req.session || !req.session.userId) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
      return;
    }

    const { currentPassword } = req.body;

    // Validate input
    if (!currentPassword) {
      res.status(400).json({
        success: false,
        message: 'Current password is required',
      });
      return;
    }

    // Fetch user from database
    const user = await prisma.users.findUnique({
      where: { user_id: req.session.userId },
    });

    if (!user || !user.password) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!passwordMatch) {
      res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Password verified successfully',
    });
  } catch (error) {
    console.error('Password verification error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while verifying password',
    });
  }
});

/**
 * POST /api/profile/change-password
 * Change user's password
 */
router.post('/change-password', async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if user is authenticated
    if (!req.session || !req.session.userId) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      res.status(400).json({
        success: false,
        message: 'All password fields are required',
      });
      return;
    }

    // Check if new passwords match
    if (newPassword !== confirmPassword) {
      res.status(400).json({
        success: false,
        message: 'New passwords do not match',
      });
      return;
    }

    // Validate password strength (optional but recommended)
    if (newPassword.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
      });
      return;
    }

    // Fetch user from database
    const user = await prisma.users.findUnique({
      where: { user_id: req.session.userId },
    });

    if (!user || !user.password) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!passwordMatch) {
      res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
      return;
    }

    // Check if new password is same as current password
    const sameAsOld = await bcrypt.compare(newPassword, user.password);
    if (sameAsOld) {
      res.status(400).json({
        success: false,
        message: 'New password must be different from current password',
      });
      return;
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    await prisma.users.update({
      where: { user_id: req.session.userId },
      data: { password: hashedPassword },
    });

    // Destroy session to force re-login
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
      }
    });

    // Clear cookie
    res.clearCookie('touchstone.sid');

    res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please login with your new password.',
    });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while changing password',
    });
  }
});


/**
 * PUT /api/profile/update
 * Update user's profile information
 */
router.put('/update', async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if user is authenticated
    if (!req.session || !req.session.userId) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
      return;
    }

    const { email, phone, gender, location, practice_area, date_of_joining } = req.body;

    // Validate email
    if (!email) {
      res.status(400).json({
        success: false,
        message: 'Email is required',
      });
      return;
    }

    // Check if email is already used by another user
    const existingUser = await prisma.users.findFirst({
      where: {
        email: email,
        user_id: { not: req.session.userId }
      }
    });

    if (existingUser) {
      res.status(400).json({
        success: false,
        message: 'Email is already in use by another account',
      });
      return;
    }

    // Prepare update data
    const updateData: any = {
      email,
      phone: phone || null,
      gender: gender || null,
      location: location || null,
      practice_area: practice_area || null,
    };

    // Add date_of_joining to update if provided
    if (date_of_joining) {
      updateData.date_of_joining = new Date(date_of_joining);
    }

    // Update user profile
    const updatedUser = await prisma.users.update({
      where: { user_id: req.session.userId },
      data: updateData,
      include: {
        role: true,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          user_id: updatedUser.user_id,
          name: updatedUser.name,
          email: updatedUser.email,
          phone: updatedUser.phone ?? undefined,
          phone_number: updatedUser.phone ?? undefined,
          practice_area: updatedUser.practice_area ?? undefined,
          last_login: updatedUser.last_login ?? undefined,
          active_status: updatedUser.active_status,
          gender: updatedUser.gender ?? undefined,
          location: updatedUser.location ?? undefined,
          user_type: updatedUser.user_type ?? undefined,
          user_code: updatedUser.user_code ?? undefined,
          date_of_joining: updatedUser.date_of_joining ?? undefined,
        },
        role: {
          role_id: updatedUser.role.role_id,
          name: updatedUser.role.name,
        },
      },
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating profile',
    });
  }
});

export default router;