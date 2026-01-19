import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../prisma-client';
import { InvitationService } from '../services/invitation.service';

const router = Router();

/**
 * GET /api/onboarding/verify/:token
 * Verify invitation token and get details
 * Public route (no authentication required)
 */
router.get('/verify/:token', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    if (!token) {
      res.status(400).json({
        success: false,
        message: 'Token is required',
      });
      return;
    }

    // Verify token using invitation service
    const result = await InvitationService.verifyInvitation(token);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify invitation token',
    });
  }
});

/**
 * Generate unique user code with automatic suffix handling
 * @param userType - Type of user (lawyer, partner, staff)
 * @param name - User's full name
 * @returns Promise<string> - Unique user code (e.g., "STF:TX", "LWY:JD-2")
 */
async function generateUniqueUserCode(userType: string, name: string): Promise<string> {
  // Get initials from name
  const initials = name
    .trim()
    .split(' ')
    .filter((word: string) => word.length > 0)
    .map((word: string) => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 2);

  // Ensure we have at least 2 characters for initials
  const finalInitials = initials.length >= 2 ? initials : (initials + 'X').substring(0, 2);

  // Determine base code based on user type
  let baseCode: string;
  switch (userType.toLowerCase()) {
    case 'lawyer':
      baseCode = `LWY:${finalInitials}`;
      break;
    case 'partner':
      baseCode = finalInitials;
      break;
    case 'staff':
      baseCode = `STF:${finalInitials}`;
      break;
    default:
      baseCode = finalInitials;
  }

  // Check for existing codes with this base
  const existingCount = await prisma.users.count({
    where: {
      user_code: {
        startsWith: baseCode,
      },
    },
  });

  // Generate unique code
  if (existingCount === 0) {
    return baseCode;
  } else {
    return `${baseCode}-${existingCount + 1}`;
  }
}

/**
 * GET /api/onboarding/user-types/:roleName
 * Get available user types based on role name
 * Public route (no authentication required)
 */
router.get('/user-types/:roleName', async (req: Request, res: Response): Promise<void> => {
  try {
    const { roleName } = req.params;

    let userTypes: string[] = [];

    // Map role names to available user types
    if (roleName.toLowerCase().includes('lawyer')) {
      userTypes = ['Lawyer']; // CHANGED from array of specific types
    } else if (roleName.toLowerCase() === 'partner') {
      userTypes = ['Partner'];
    } else if (
      roleName.toLowerCase() === 'admin' ||
      roleName.toLowerCase() === 'hr' ||
      roleName.toLowerCase() === 'it' ||
      roleName.toLowerCase() === 'support'
    ) {
      userTypes = ['Staff']; // CHANGED from roleName.toLowerCase()
    }

    res.status(200).json({
      success: true,
      data: {
        roleName,
        userTypes,
      },
    });
  } catch (error) {
    console.error('Get user types error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user types',
    });
  }
});

/**
 * POST /api/onboarding/complete
 * Complete user onboarding (create user account)
 * Public route (no authentication required)
 */
router.post('/complete', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      token,
      name,
      phone,
      password,
      practice_area,
      reporting_manager_id,
      gender,
      location,
      user_type,
      user_code
    } = req.body;

    // Validate required fields
    if (!token || !name || !phone || !password) {
      res.status(400).json({
        success: false,
        message: 'Token, name, phone, and password are required',
      });
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
      });
      return;
    }

    // Validate gender if provided
    if (gender && !['male', 'female'].includes(gender.toLowerCase())) {
      res.status(400).json({
        success: false,
        message: 'Gender must be either male or female',
      });
      return;
    }

    // Validate location if provided
    if (location && !['delhi', 'mumbai', 'bangalore', 'delhi (lt)'].includes(location.toLowerCase())) {
      res.status(400).json({
        success: false,
        message: 'Location must be one of: delhi, mumbai, bangalore, delhi (lt)',
      });
      return;
    }

    // 1. Verify invitation token
    const verificationResult = await InvitationService.verifyInvitation(token);

    if (!verificationResult.success || !verificationResult.data) {
      res.status(400).json({
        success: false,
        message: verificationResult.message,
      });
      return;
    }

    const { invitation_id, email, role_id } = verificationResult.data;

    // 2. Check if user already exists (double-check)
    const existingUser = await prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'A user with this email already exists',
      });
      return;
    }

    // 3. Verify reporting manager if provided
    if (reporting_manager_id) {
      const manager = await prisma.users.findUnique({
        where: { user_id: parseInt(reporting_manager_id) },
      });

      if (!manager) {
        res.status(400).json({
          success: false,
          message: 'Invalid reporting manager ID',
        });
        return;
      }
    }

    // 4. Auto-generate user_type and user_code based on role
    const role = await prisma.roles.findUnique({
      where: { role_id },
      select: { name: true },
    });

    if (!role) {
      res.status(400).json({
        success: false,
        message: 'Invalid role',
      });
      return;
    }

    // Determine user_type based on role
    let autoUserType: string;
    const roleLower = role.name.toLowerCase().trim();

    if (
      roleLower.includes('lawyer') || 
      roleLower.includes('associate') || 
      roleLower.includes('counsel') || 
      roleLower.includes('intern')
    ) {
      autoUserType = 'lawyer';
    } else if (roleLower.includes('partner')) {
      autoUserType = 'partner';
    } else if (
      roleLower.includes('admin') || 
      roleLower.includes('hr') || 
      roleLower.includes('it') || 
      roleLower.includes('support')
    ) {
      autoUserType = 'staff';
    } else {
      // Default fallback
      autoUserType = 'staff';
    }

    // Generate unique user code
    const autoUserCode = await generateUniqueUserCode(autoUserType, name);
    
    console.log('Generated user type:', autoUserType, 'user code:', autoUserCode, 'for role:', role.name);

    // console.log('Generated user type:', autoUserType, 'user code:', autoUserCode, 'for role:', role.name);


    // 5. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 6. Create user account
    const newUser = await prisma.users.create({
      data: {
        name,
        email,
        phone,
        password: hashedPassword,
        role_id,
        practice_area: practice_area || null,
        reporting_manager_id: reporting_manager_id ? parseInt(reporting_manager_id) : null,
        gender: gender ? gender.toLowerCase() : null,
        location: location ? location.toLowerCase() : null,
        user_type: autoUserType,  // ✅ Use auto-generated value
        user_code: autoUserCode,  // ✅ Use auto-generated value
        date_of_joining: new Date(),
        active_status: true,
        is_onboarded: true,
      },
      include: {
        role: true,
      },
    });

    // 7. Update invitation status to accepted
    await prisma.user_invitations.update({
      where: { invitation_id },
      data: {
        status: 'accepted',
        accepted_at: new Date(),
      },
    });

    // 8. Return success response
    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: {
          id: newUser.user_id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role.name,
          gender: newUser.gender,
          location: newUser.location,
          userType: newUser.user_type,
          userCode: newUser.user_code,
          dateOfJoining: newUser.date_of_joining,
        },
      },
    });
  } catch (error: any) {
    console.error('Complete onboarding error:', error);
    
    // Handle Prisma unique constraint violation
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'field';
      res.status(409).json({
        success: false,
        message: `A user with this ${field} already exists`,
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to complete onboarding',
    });
  }
});

/**
 * GET /api/onboarding/managers
 * Get list of potential reporting managers for onboarding form
 * Public route (no authentication required)
 */
router.get('/managers', async (req: Request, res: Response): Promise<void> => {
  try {
    // Get users who can be reporting managers (Partners, Senior Associates, etc.)
    const managers = await prisma.users.findMany({
      where: {
        active_status: true,
        is_onboarded: true,
      },
      select: {
        user_id: true,
        name: true,
        email: true,
        role: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    const formattedManagers = managers.map(manager => ({
      id: manager.user_id,
      name: manager.name,
      email: manager.email,
      role: manager.role.name,
    }));

    res.status(200).json({
      success: true,
      data: formattedManagers,
    });
  } catch (error) {
    console.error('Get managers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch managers',
    });
  }
});

export default router;

