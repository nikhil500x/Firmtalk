import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { requireAuth, requireRole } from '../middleware/auth';
import prisma from '../prisma-client';
import redisClient from '../config/redis';

const router = Router();

/**
 * Helper function to generate user code based on user_type and name initials
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
 * GET /api/users/roles
 * Get all available roles
 * Requires authentication
 */
router.get('/roles', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const roles = await prisma.roles.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch roles',
    });
  }
});

/**
 * POST /api/users
 * Create a new user
 * Requires: partner, admin, support, it, hr roles
 */
router.post('/', requireRole(['superadmin','partner', 'admin', 'support', 'it', 'hr']), async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      email,
      phone,
      password,
      role_id,
      practice_area,
      reporting_manager_id,
      gender,
      location,
      // user_type,
      // user_code
    } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !password || !role_id) {
      res.status(400).json({
        success: false,
        message: 'Name, email, phone, password, and role are required',
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

    // Check if email already exists
    const existingUser = await prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
      return;
    }

    // Verify role exists
     const role = await prisma.roles.findUnique({
      where: { role_id: parseInt(role_id) },
      select: { name: true },
    });

    if (!role) {
      res.status(400).json({
        success: false,
        message: 'Invalid role ID',
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
      autoUserType = 'staff';
    }

    // Generate unique user code
    const autoUserCode = await generateUniqueUserCode(autoUserType, name);

    console.log('Creating user with auto-generated type:', autoUserType, 'code:', autoUserCode);

    // Hash password before storing
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user with auto-generated values
    const newUser = await prisma.users.create({
      data: {
        name,
        email,
        phone,
        password: hashedPassword,
        role_id: parseInt(role_id),
        practice_area: practice_area || null,
        reporting_manager_id: reporting_manager_id ? parseInt(reporting_manager_id) : null,
        gender: gender ? gender.toLowerCase() : null,
        location: location ? location.toLowerCase() : null,
        user_type: autoUserType,  // ✅ Auto-generated
        user_code: autoUserCode,  // ✅ Auto-generated
        date_of_joining: new Date(),
        active_status: true,
        is_onboarded: true,
      },
      include: {
        role: true,
        reporting_manager: {
          select: {
            user_id: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: newUser.user_id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role.name,
        roleId: newUser.role.role_id,
        gender: newUser.gender,
        location: newUser.location,
        userType: newUser.user_type,
        userCode: newUser.user_code,
        dateOfJoining: newUser.date_of_joining,
        reportingManager: newUser.reporting_manager ? {
          user_id: newUser.reporting_manager.user_id,
          name: newUser.reporting_manager.name,
        } : null,
      },
    });
  } catch (error: any) {
    console.error('Create user error:', error);
    
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
      message: 'Failed to create user',
    });
  }
});

/**
 * PUT /api/users/:id
 * Update an existing user
 * Requires: partner, admin, support, it, hr roles
 */
router.put('/:id', requireRole(['superadmin', 'partner', 'admin', 'support', 'it', 'hr']), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
      return;
    }

    const {
      name,
      email,
      phone,
      password,
      role_id,
      practice_area,
      reporting_manager_id,
      active_status,
      gender,
      location,
    } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !role_id) {
      res.status(400).json({
        success: false,
        message: 'Name, email, phone, and role are required',
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

    // Check if user exists
    const existingUser = await prisma.users.findUnique({
      where: { user_id: userId },
    });

    if (!existingUser) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Check if role is changing
    const roleChanged = existingUser.role_id !== parseInt(role_id);

    // Check if email is already used by another user
    if (email !== existingUser.email) {
      const emailExists = await prisma.users.findUnique({
        where: { email },
      });

      if (emailExists) {
        res.status(409).json({
          success: false,
          message: 'Email is already in use by another user',
        });
        return;
      }
    }

    // Verify role exists AND get role name for user_type/code generation
    const role = await prisma.roles.findUnique({
      where: { role_id: parseInt(role_id) },
      select: { name: true, role_id: true },
    });

    if (!role) {
      res.status(400).json({
        success: false,
        message: 'Invalid role ID',
      });
      return;
    }

    // Verify reporting manager exists if provided
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

    // Auto-generate user_type and user_code based on role
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
      autoUserType = 'staff';
    }

    // Generate unique user code (only if name or role changed)
    const shouldRegenerateCode = 
      name !== existingUser.name || 
      role.role_id !== existingUser.role_id;
    
    const autoUserCode = shouldRegenerateCode 
      ? await generateUniqueUserCode(autoUserType, name)
      : existingUser.user_code || await generateUniqueUserCode(autoUserType, name);

    console.log('Updating user', userId, 'with type:', autoUserType, 'code:', autoUserCode);

    // Prepare update data
    const updateData: any = {
      name,
      email,
      phone,
      role_id: parseInt(role_id),
      practice_area: practice_area || null,
      reporting_manager_id: reporting_manager_id ? parseInt(reporting_manager_id) : null,
      gender: gender !== undefined ? (gender ? gender.toLowerCase() : null) : existingUser.gender,
      location: location !== undefined ? (location ? location.toLowerCase() : null) : existingUser.location,
      user_type: autoUserType,
      user_code: autoUserCode,
      active_status: active_status !== undefined ? active_status : existingUser.active_status,
      updated_at: new Date(),
    };

    // Only update password if provided
    if (password && password.trim()) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Update user
    const updatedUser = await prisma.users.update({
      where: { user_id: userId },
      data: updateData,
      include: {
        role: true,
        reporting_manager: {
          select: {
            user_id: true,
            name: true,
          },
        },
      },
    });

    // If role changed, invalidate user's sessions to force re-login
    if (roleChanged) {
      try {
        const pattern = 'touchstone:sess:*';
        const keys = await redisClient.keys(pattern);

        const deletePromises = keys.map(async (key) => {
          try {
            const sessionData = await redisClient.get(key);
            if (sessionData) {
              const session = JSON.parse(sessionData);
              if (session.userId === userId) {
                await redisClient.del(key);
                console.log(`✅ Deleted session for user ${userId} due to role change: ${key}`);
              }
            }
          } catch (err) {
            console.error(`Error processing session ${key}:`, err);
          }
        });

        await Promise.all(deletePromises);
      } catch (sessionError) {
        console.error('Error destroying user sessions:', sessionError);
      }
    }

    res.status(200).json({
      success: true,
      message: roleChanged
        ? 'User updated successfully. Role changed - user will need to log in again.'
        : 'User updated successfully',
      data: {
        id: updatedUser.user_id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role.name,
        roleId: updatedUser.role.role_id,
        gender: updatedUser.gender,
        location: updatedUser.location,
        userType: updatedUser.user_type,
        userCode: updatedUser.user_code,
        dateOfJoining: updatedUser.date_of_joining,
        active: updatedUser.active_status,
        reportingManager: updatedUser.reporting_manager ? {
          user_id: updatedUser.reporting_manager.user_id,
          name: updatedUser.reporting_manager.name,
        } : null,
        roleChanged,
      },
    });
   } catch (error: any) {
    console.error('Update user error:', error);
    
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
      message: 'Failed to update user',
    });
  }
});

/**
 * GET /api/users
 * Get all users (with optional filters)
 * Requires authentication
 */
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if user has permission to view users
    // TODO: Add permission check when you implement permission middleware
    // For now, allow all authenticated users
    
    // Get query parameters for filtering
    const { role, active_status, search } = req.query;

    // Build where clause based on filters
    const whereClause: any = {};

    if (role && role !== 'All') {
      // Find role by name
      const roleRecord = await prisma.roles.findFirst({
        where: { name: role as string }
      });
      
      if (roleRecord) {
        whereClause.role_id = roleRecord.role_id;
      }
    }

    if (active_status === 'Active') {
      whereClause.active_status = true;
    } else if (active_status === 'Inactive') {
      whereClause.active_status = false;
    }

    if (search) {
      whereClause.name = {
        contains: search as string,
        mode: 'insensitive',
      };
    }

    // Fetch users with role information and reporting manager
    const users = await prisma.users.findMany({
      where: whereClause,
      include: {
        role: true,
        reporting_manager: {
          select: {
            user_id: true,
            name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Transform data to match frontend interface
    const formattedUsers = users.map(user => ({
      id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      roleId: user.role.role_id,
      phone: user.phone,
      practiceArea: user.practice_area,
      gender: user.gender,
      location: user.location,
      userType: user.user_type,
      userCode: user.user_code,
      dateOfJoining: user.date_of_joining,
      reportingManager: user.reporting_manager ? {
        user_id: user.reporting_manager.user_id,
        name: user.reporting_manager.name,
      } : null,
      lastLogin: user.last_login,
      active: user.active_status,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    }));

    res.status(200).json({
      success: true,
      data: formattedUsers,
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
    });
  }
});

/**
 * GET /api/users/:id
 * Get a specific user by ID
 * Requires authentication
 */
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
      return;
    }

    const user = await prisma.users.findUnique({
      where: { user_id: userId },
      include: {
        role: true,
        reporting_manager: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Format response
    const formattedUser = {
      id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      roleId: user.role.role_id,
      phone: user.phone,
      practiceArea: user.practice_area,
      gender: user.gender,
      location: user.location,
      userType: user.user_type,
      userCode: user.user_code,
      dateOfJoining: user.date_of_joining,
      reportingManager: user.reporting_manager,
      lastLogin: user.last_login,
      active: user.active_status,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };

    res.status(200).json({
      success: true,
      data: formattedUser,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
    });
  }
});


/**
 * GET /api/users/:id/matters
 * Get all matters for a specific user
 * Returns matters where user is either assigned lawyer or team member
 * Requires authentication
 */
router.get('/:id/matters', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
      return;
    }

    // Verify user exists
    const user = await prisma.users.findUnique({
      where: { user_id: userId },
      select: {
        user_id: true,
        name: true,
        email: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Get matters where user is assigned lawyer
    const assignedMatters = await prisma.matters.findMany({
      where: {
        assigned_lawyer: userId,
        active_status: true,
      },
      include: {
        client: {
          select: {
            client_id: true,
            client_name: true,
            industry: true,
          },
        },
        assigned_lawyer_rel: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        start_date: 'desc',
      },
    });

    // Get matters where user is a team member
    const teamMatters = await prisma.matter_users.findMany({
      where: {
        user_id: userId,
      },
      include: {
        matter: {
          include: {
            client: {
              select: {
                client_id: true,
                client_name: true,
                industry: true,
              },
            },
            assigned_lawyer_rel: {
              select: {
                user_id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        assigned_at: 'desc',
      },
    });

    // Combine and format results
    const formattedAssignedMatters = assignedMatters.map(matter => ({
      id: matter.matter_id,
      clientId: matter.client_id,
      clientName: matter.client.client_name,
      clientIndustry: matter.client.industry,
      matterTitle: matter.matter_title,
      description: matter.description,
      matterType: matter.matter_type,
      practiceArea: matter.practice_area,
      startDate: matter.start_date,
      estimatedDeadline: matter.estimated_deadline,
      status: matter.status,
      estimatedValue: matter.estimated_value,
      billingRateType: matter.billing_rate_type,
      opposingPartyName: matter.opposing_party_name,
      matterRole: 'Lead Attorney',
      assignedAt: matter.start_date,
      isLeadLawyer: true,
      active: matter.active_status,
      createdAt: matter.created_at,
      updatedAt: matter.updated_at,
    }));

    const formattedTeamMatters = teamMatters
      .filter(tm => tm.matter.active_status) // Only active matters
      .map(tm => ({
        id: tm.matter.matter_id,
        clientId: tm.matter.client_id,
        clientName: tm.matter.client.client_name,
        clientIndustry: tm.matter.client.industry,
        matterTitle: tm.matter.matter_title,
        description: tm.matter.description,
        matterType: tm.matter.matter_type,
        practiceArea: tm.matter.practice_area,
        startDate: tm.matter.start_date,
        estimatedDeadline: tm.matter.estimated_deadline,
        status: tm.matter.status,
        estimatedValue: tm.matter.estimated_value,
        billingRateType: tm.matter.billing_rate_type,
        opposingPartyName: tm.matter.opposing_party_name,
        matterRole: tm.role || 'Team Member',
        hourlyRate: tm.hourly_rate,
        assignedAt: tm.assigned_at,
        isLeadLawyer: false,
        active: tm.matter.active_status,
        createdAt: tm.matter.created_at,
        updatedAt: tm.matter.updated_at,
      }));

    // Merge results, removing duplicates (in case user is both assigned lawyer and team member)
    const allMatters = [...formattedAssignedMatters];
    const assignedMatterIds = new Set(formattedAssignedMatters.map(m => m.id));

    formattedTeamMatters.forEach(matter => {
      if (!assignedMatterIds.has(matter.id)) {
        allMatters.push(matter);
      }
    });

    // Sort by most recent first
    allMatters.sort((a, b) => {
      const dateA = new Date(a.assignedAt).getTime();
      const dateB = new Date(b.assignedAt).getTime();
      return dateB - dateA;
    });

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.user_id,
          name: user.name,
          email: user.email,
        },
        matters: allMatters,
        summary: {
          total: allMatters.length,
          asLeadLawyer: formattedAssignedMatters.length,
          asTeamMember: formattedTeamMatters.filter(
            m => !assignedMatterIds.has(m.id)
          ).length,
          byStatus: {
            active: allMatters.filter(m => m.status === 'active').length,
            completed: allMatters.filter(m => m.status === 'completed').length,
            on_hold: allMatters.filter(m => m.status === 'on_hold').length,
            cancelled: allMatters.filter(m => m.status === 'cancelled').length,
          },
        },
      },
    });
  } catch (error) {
    console.error('Get user matters error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user matters',
    });
  }
});

/**
 * GET /api/users/:userId/permissions
 * Get user's role permissions
 * Requires: partner, admin, support, it roles
 */
router.get('/:userId/permissions', requireRole(['superadmin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const userIdNumber = parseInt(userId);

    if (isNaN(userIdNumber)) {
      res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
      return;
    }

    // Get user with their role and role permissions
    const user = await prisma.users.findUnique({
      where: { user_id: userIdNumber },
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

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Get all available permissions
    const allPermissions = await prisma.permissions.findMany({
      orderBy: { name: 'asc' },
    });

    // Map permissions to include enabled status
    const userPermissionIds = new Set(
      user.role.role_permissions.map(rp => rp.permission_id)
    );

    const permissionsWithStatus = allPermissions.map(permission => ({
      id: permission.permission_id,
      name: permission.name,
      enabled: userPermissionIds.has(permission.permission_id),
    }));

    res.status(200).json({
      success: true,
      data: {
        userId: user.user_id,
        userName: user.name,
        roleId: user.role_id,
        roleName: user.role.name,
        permissions: permissionsWithStatus,
      },
    });
  } catch (error) {
    console.error('Get user permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user permissions',
    });
  }
});

/**
 * PUT /api/users/:userId/permissions
 * Update user's role permissions
 * This updates the role_permissions table and invalidates the user's session
 * Requires: partner, admin, support, it roles
 */
router.put('/:userId/permissions', requireRole(['superadmin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body; // Array of permission IDs/names like ['user:read', 'crm:create']
    const userIdNumber = parseInt(userId);

    if (isNaN(userIdNumber)) {
      res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
      return;
    }

    if (!Array.isArray(permissions)) {
      res.status(400).json({
        success: false,
        message: 'Permissions must be an array',
      });
      return;
    }

    // Get user with their role
    const user = await prisma.users.findUnique({
      where: { user_id: userIdNumber },
      include: {
        role: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Get all permissions that match the provided permission names
    const permissionRecords = await prisma.permissions.findMany({
      where: {
        name: {
          in: permissions,
        },
      },
    });

    if (permissionRecords.length === 0 && permissions.length > 0) {
      res.status(400).json({
        success: false,
        message: 'No valid permissions found',
      });
      return;
    }

    const permissionIds = permissionRecords.map(p => p.permission_id);

    // Use a transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // 1. Delete all existing role permissions for this role
      await tx.role_permissions.deleteMany({
        where: {
          role_id: user.role_id,
        },
      });

      // 2. Create new role permissions
      if (permissionIds.length > 0) {
        await tx.role_permissions.createMany({
          data: permissionIds.map(permissionId => ({
            role_id: user.role_id,
            permission_id: permissionId,
          })),
        });
      }
    });

    // 3. Invalidate user's session to force re-login with new permissions
    // Find all sessions for this user and destroy them
    try {
      // Get all session keys from Redis
      const pattern = 'touchstone:sess:*';
      const keys = await redisClient.keys(pattern);

      // Check each session to see if it belongs to this user
      const deletePromises = keys.map(async (key) => {
        try {
          const sessionData = await redisClient.get(key);
          if (sessionData) {
            const session = JSON.parse(sessionData);
            // If this session belongs to the user whose permissions were updated, delete it
            if (session.userId === userIdNumber) {
              await redisClient.del(key);
              console.log(`✅ Deleted session for user ${userIdNumber}: ${key}`);
            }
          }
        } catch (err) {
          console.error(`Error processing session ${key}:`, err);
        }
      });

      await Promise.all(deletePromises);
    } catch (sessionError) {
      console.error('Error destroying user sessions:', sessionError);
      // Don't fail the request if session deletion fails
      // The permissions were still updated successfully
    }

    res.status(200).json({
      success: true,
      message: 'User permissions updated successfully. The user will need to log in again.',
      data: {
        userId: user.user_id,
        roleId: user.role_id,
        roleName: user.role.name,
        permissionsUpdated: permissionIds.length,
      },
    });
  } catch (error) {
    console.error('Update user permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user permissions',
    });
  }
});

/**
 * GET /api/users/permissions/all
 * Get all available permissions in the system
 * Requires: partner, admin, support, it roles
 */
router.get('/permissions/all', requireRole(['superadmin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const permissions = await prisma.permissions.findMany({
      orderBy: { name: 'asc' },
    });

    res.status(200).json({
      success: true,
      data: permissions,
    });
  } catch (error) {
    console.error('Get all permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch permissions',
    });
  }
});


export default router;