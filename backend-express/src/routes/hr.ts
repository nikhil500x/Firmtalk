import { Router, Request, Response } from 'express';
import prisma from '../prisma-client';
import { requireAuth } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// ============================================================================
// ONBOARDING ROUTES
// ============================================================================

/**
 * GET /api/hr/onboarding/:userId
 * Get onboarding stages for a user
 */
router.get('/onboarding/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const sessionUserId = req.session.userId;
    const userRole = req.session.role?.name;

    // Check permissions: user can see their own, or admin roles can see all
    const canSeeAll = ['superadmin', 'partner', 'admin', 'support', 'it', 'hr'].includes(userRole || '');
    
    if (!canSeeAll && parseInt(userId) !== sessionUserId) {
      return res.status(403).json(errorResponse('You can only view your own onboarding stages'));
    }

    const stages = await prisma.onboarding_stages.findMany({
      where: {
        user_id: parseInt(userId),
      },
      include: {
        assignee: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
        user: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    const formattedStages = stages.map((stage) => ({
      id: stage.stage_id,
      userId: stage.user_id,
      stageName: stage.stage_name,
      status: stage.status,
      completedAt: stage.completed_at,
      assignedTo: stage.assigned_to,
      notes: stage.notes,
      createdAt: stage.created_at,
      updatedAt: stage.updated_at,
      assignee: stage.assignee ? {
        id: stage.assignee.user_id,
        name: stage.assignee.name,
        email: stage.assignee.email,
      } : null,
      user: {
        id: stage.user.user_id,
        name: stage.user.name,
        email: stage.user.email,
      },
    }));

    res.json(successResponse(formattedStages, 'Onboarding stages fetched successfully'));
  } catch (error) {
    console.error('Error fetching onboarding stages:', error);
    res.status(500).json(errorResponse('Failed to fetch onboarding stages'));
  }
});

/**
 * POST /api/hr/onboarding/:userId/stages
 * Create/update onboarding stage
 */
router.post('/onboarding/:userId/stages', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { stageName, status, assignedTo, notes } = req.body;
    const userRole = req.session.role?.name;

    // Only admin roles can create/update onboarding stages
    const canManage = ['superadmin', 'partner', 'admin', 'support', 'it', 'hr'].includes(userRole || '');
    
    if (!canManage) {
      return res.status(403).json(errorResponse('You do not have permission to manage onboarding stages'));
    }

    if (!stageName) {
      return res.status(400).json(errorResponse('Stage name is required'));
    }

    const validStatuses = ['pending', 'in_progress', 'completed', 'skipped'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json(errorResponse('Invalid status'));
    }

    const stage = await prisma.onboarding_stages.create({
      data: {
        user_id: parseInt(userId),
        stage_name: stageName,
        status: status || 'pending',
        assigned_to: assignedTo ? parseInt(assignedTo) : null,
        notes: notes || null,
        completed_at: status === 'completed' ? new Date() : null,
      },
      include: {
        assignee: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
        user: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const formattedStage = {
      id: stage.stage_id,
      userId: stage.user_id,
      stageName: stage.stage_name,
      status: stage.status,
      completedAt: stage.completed_at,
      assignedTo: stage.assigned_to,
      notes: stage.notes,
      createdAt: stage.created_at,
      updatedAt: stage.updated_at,
      assignee: stage.assignee ? {
        id: stage.assignee.user_id,
        name: stage.assignee.name,
        email: stage.assignee.email,
      } : null,
      user: {
        id: stage.user.user_id,
        name: stage.user.name,
        email: stage.user.email,
      },
    };

    res.status(201).json(successResponse(formattedStage, 'Onboarding stage created successfully'));
  } catch (error) {
    console.error('Error creating onboarding stage:', error);
    res.status(500).json(errorResponse('Failed to create onboarding stage'));
  }
});

/**
 * PUT /api/hr/onboarding/:userId/stages/:stageId
 * Update onboarding stage status
 */
router.put('/onboarding/:userId/stages/:stageId', async (req: Request, res: Response) => {
  try {
    const { userId, stageId } = req.params;
    const { status, notes, assignedTo } = req.body;
    const userRole = req.session.role?.name;

    // Only admin roles can update onboarding stages
    const canManage = ['superadmin', 'partner', 'admin', 'support', 'it', 'hr'].includes(userRole || '');
    
    if (!canManage) {
      return res.status(403).json(errorResponse('You do not have permission to update onboarding stages'));
    }

    const validStatuses = ['pending', 'in_progress', 'completed', 'skipped'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json(errorResponse('Invalid status'));
    }

    const updateData: any = {};
    if (status) {
      updateData.status = status;
      if (status === 'completed') {
        updateData.completed_at = new Date();
      } else if (status !== 'completed') {
        updateData.completed_at = null;
      }
    }
    if (notes !== undefined) updateData.notes = notes;
    if (assignedTo !== undefined) updateData.assigned_to = assignedTo ? parseInt(assignedTo) : null;

    const stage = await prisma.onboarding_stages.update({
      where: {
        stage_id: parseInt(stageId),
      },
      data: updateData,
      include: {
        assignee: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
        user: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const formattedStage = {
      id: stage.stage_id,
      userId: stage.user_id,
      stageName: stage.stage_name,
      status: stage.status,
      completedAt: stage.completed_at,
      assignedTo: stage.assigned_to,
      notes: stage.notes,
      createdAt: stage.created_at,
      updatedAt: stage.updated_at,
      assignee: stage.assignee ? {
        id: stage.assignee.user_id,
        name: stage.assignee.name,
        email: stage.assignee.email,
      } : null,
      user: {
        id: stage.user.user_id,
        name: stage.user.name,
        email: stage.user.email,
      },
    };

    res.json(successResponse(formattedStage, 'Onboarding stage updated successfully'));
  } catch (error) {
    console.error('Error updating onboarding stage:', error);
    res.status(500).json(errorResponse('Failed to update onboarding stage'));
  }
});

// ============================================================================
// OFFBOARDING ROUTES
// ============================================================================

/**
 * GET /api/hr/offboarding/:userId
 * Get offboarding stages for a user
 */
router.get('/offboarding/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const sessionUserId = req.session.userId;
    const userRole = req.session.role?.name;

    // Check permissions: user can see their own, or admin roles can see all
    const canSeeAll = ['superadmin', 'partner', 'admin', 'support', 'it', 'hr'].includes(userRole || '');
    
    if (!canSeeAll && parseInt(userId) !== sessionUserId) {
      return res.status(403).json(errorResponse('You can only view your own offboarding stages'));
    }

    const stages = await prisma.offboarding_stages.findMany({
      where: {
        user_id: parseInt(userId),
      },
      include: {
        assignee: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
        user: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    const formattedStages = stages.map((stage) => ({
      id: stage.stage_id,
      userId: stage.user_id,
      stageName: stage.stage_name,
      status: stage.status,
      completedAt: stage.completed_at,
      assignedTo: stage.assigned_to,
      notes: stage.notes,
      createdAt: stage.created_at,
      updatedAt: stage.updated_at,
      assignee: stage.assignee ? {
        id: stage.assignee.user_id,
        name: stage.assignee.name,
        email: stage.assignee.email,
      } : null,
      user: {
        id: stage.user.user_id,
        name: stage.user.name,
        email: stage.user.email,
      },
    }));

    res.json(successResponse(formattedStages, 'Offboarding stages fetched successfully'));
  } catch (error) {
    console.error('Error fetching offboarding stages:', error);
    res.status(500).json(errorResponse('Failed to fetch offboarding stages'));
  }
});

/**
 * POST /api/hr/offboarding/:userId/stages
 * Create/update offboarding stage
 */
router.post('/offboarding/:userId/stages', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { stageName, status, assignedTo, notes } = req.body;
    const userRole = req.session.role?.name;

    // Only admin roles can create/update offboarding stages
    const canManage = ['superadmin', 'partner', 'admin', 'support', 'it', 'hr'].includes(userRole || '');
    
    if (!canManage) {
      return res.status(403).json(errorResponse('You do not have permission to manage offboarding stages'));
    }

    if (!stageName) {
      return res.status(400).json(errorResponse('Stage name is required'));
    }

    const validStatuses = ['pending', 'in_progress', 'completed', 'skipped'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json(errorResponse('Invalid status'));
    }

    const stage = await prisma.offboarding_stages.create({
      data: {
        user_id: parseInt(userId),
        stage_name: stageName,
        status: status || 'pending',
        assigned_to: assignedTo ? parseInt(assignedTo) : null,
        notes: notes || null,
        completed_at: status === 'completed' ? new Date() : null,
      },
      include: {
        assignee: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
        user: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const formattedStage = {
      id: stage.stage_id,
      userId: stage.user_id,
      stageName: stage.stage_name,
      status: stage.status,
      completedAt: stage.completed_at,
      assignedTo: stage.assigned_to,
      notes: stage.notes,
      createdAt: stage.created_at,
      updatedAt: stage.updated_at,
      assignee: stage.assignee ? {
        id: stage.assignee.user_id,
        name: stage.assignee.name,
        email: stage.assignee.email,
      } : null,
      user: {
        id: stage.user.user_id,
        name: stage.user.name,
        email: stage.user.email,
      },
    };

    res.status(201).json(successResponse(formattedStage, 'Offboarding stage created successfully'));
  } catch (error) {
    console.error('Error creating offboarding stage:', error);
    res.status(500).json(errorResponse('Failed to create offboarding stage'));
  }
});

/**
 * PUT /api/hr/offboarding/:userId/stages/:stageId
 * Update offboarding stage status
 */
router.put('/offboarding/:userId/stages/:stageId', async (req: Request, res: Response) => {
  try {
    const { userId, stageId } = req.params;
    const { status, notes, assignedTo } = req.body;
    const userRole = req.session.role?.name;

    // Only admin roles can update offboarding stages
    const canManage = ['superadmin', 'partner', 'admin', 'support', 'it', 'hr'].includes(userRole || '');
    
    if (!canManage) {
      return res.status(403).json(errorResponse('You do not have permission to update offboarding stages'));
    }

    const validStatuses = ['pending', 'in_progress', 'completed', 'skipped'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json(errorResponse('Invalid status'));
    }

    const updateData: any = {};
    if (status) {
      updateData.status = status;
      if (status === 'completed') {
        updateData.completed_at = new Date();
      } else if (status !== 'completed') {
        updateData.completed_at = null;
      }
    }
    if (notes !== undefined) updateData.notes = notes;
    if (assignedTo !== undefined) updateData.assigned_to = assignedTo ? parseInt(assignedTo) : null;

    const stage = await prisma.offboarding_stages.update({
      where: {
        stage_id: parseInt(stageId),
      },
      data: updateData,
      include: {
        assignee: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
        user: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const formattedStage = {
      id: stage.stage_id,
      userId: stage.user_id,
      stageName: stage.stage_name,
      status: stage.status,
      completedAt: stage.completed_at,
      assignedTo: stage.assigned_to,
      notes: stage.notes,
      createdAt: stage.created_at,
      updatedAt: stage.updated_at,
      assignee: stage.assignee ? {
        id: stage.assignee.user_id,
        name: stage.assignee.name,
        email: stage.assignee.email,
      } : null,
      user: {
        id: stage.user.user_id,
        name: stage.user.name,
        email: stage.user.email,
      },
    };

    res.json(successResponse(formattedStage, 'Offboarding stage updated successfully'));
  } catch (error) {
    console.error('Error updating offboarding stage:', error);
    res.status(500).json(errorResponse('Failed to update offboarding stage'));
  }
});

// ============================================================================
// HOLIDAYS ROUTES
// ============================================================================

/**
 * GET /api/hr/holidays
 * Get holidays with optional filters
 */
router.get('/holidays', async (req: Request, res: Response) => {
  try {
    const { type, stateCode, year, isActive } = req.query;

    const where: any = {};

    if (type) {
      where.type = type as string;
    }

    if (stateCode) {
      where.state_code = stateCode as string;
    }

    if (isActive !== undefined) {
      where.is_active = isActive === 'true';
    }

    if (year) {
      const yearNum = parseInt(year as string);
      where.date = {
        gte: new Date(`${yearNum}-01-01`),
        lte: new Date(`${yearNum}-12-31`),
      };
    }

    const holidays = await prisma.holidays.findMany({
      where,
      orderBy: {
        date: 'asc',
      },
    });

    const formattedHolidays = holidays.map((holiday) => ({
      id: holiday.holiday_id,
      name: holiday.name,
      date: holiday.date.toISOString().split('T')[0],
      type: holiday.type,
      stateCode: holiday.state_code,
      isActive: holiday.is_active,
      createdAt: holiday.created_at,
      updatedAt: holiday.updated_at,
    }));

    res.json(successResponse(formattedHolidays, 'Holidays fetched successfully'));
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json(errorResponse('Failed to fetch holidays'));
  }
});

/**
 * POST /api/hr/holidays
 * Create holiday (admin only)
 */
router.post('/holidays', async (req: Request, res: Response) => {
  try {
    const { name, date, type, stateCode, isActive } = req.body;
    const userRole = req.session.role?.name;

    // Only admin roles can create holidays
    const canManage = ['superadmin', 'partner', 'admin', 'support', 'it', 'hr'].includes(userRole || '');
    
    if (!canManage) {
      return res.status(403).json(errorResponse('You do not have permission to create holidays'));
    }

    if (!name || !date || !type) {
      return res.status(400).json(errorResponse('Name, date, and type are required'));
    }

    const validTypes = ['state', 'national'];
    if (!validTypes.includes(type)) {
      return res.status(400).json(errorResponse('Type must be "state" or "national"'));
    }

    if (type === 'state' && !stateCode) {
      return res.status(400).json(errorResponse('State code is required for state holidays'));
    }

    const holiday = await prisma.holidays.create({
      data: {
        name,
        date: new Date(date),
        type,
        state_code: type === 'state' ? stateCode : null,
        is_active: isActive !== undefined ? isActive : true,
      },
    });

    const formattedHoliday = {
      id: holiday.holiday_id,
      name: holiday.name,
      date: holiday.date.toISOString().split('T')[0],
      type: holiday.type,
      stateCode: holiday.state_code,
      isActive: holiday.is_active,
      createdAt: holiday.created_at,
      updatedAt: holiday.updated_at,
    };

    res.status(201).json(successResponse(formattedHoliday, 'Holiday created successfully'));
  } catch (error) {
    console.error('Error creating holiday:', error);
    res.status(500).json(errorResponse('Failed to create holiday'));
  }
});

/**
 * PUT /api/hr/holidays/:holidayId
 * Update holiday
 */
router.put('/holidays/:holidayId', async (req: Request, res: Response) => {
  try {
    const { holidayId } = req.params;
    const { name, date, type, stateCode, isActive } = req.body;
    const userRole = req.session.role?.name;

    // Only admin roles can update holidays
    const canManage = ['superadmin', 'partner', 'admin', 'support', 'it', 'hr'].includes(userRole || '');
    
    if (!canManage) {
      return res.status(403).json(errorResponse('You do not have permission to update holidays'));
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (date) updateData.date = new Date(date);
    if (type) {
      const validTypes = ['state', 'national'];
      if (!validTypes.includes(type)) {
        return res.status(400).json(errorResponse('Type must be "state" or "national"'));
      }
      updateData.type = type;
      if (type === 'state') {
        updateData.state_code = stateCode || null;
      } else {
        updateData.state_code = null;
      }
    }
    if (stateCode !== undefined && type === 'state') updateData.state_code = stateCode;
    if (isActive !== undefined) updateData.is_active = isActive;

    const holiday = await prisma.holidays.update({
      where: {
        holiday_id: parseInt(holidayId),
      },
      data: updateData,
    });

    const formattedHoliday = {
      id: holiday.holiday_id,
      name: holiday.name,
      date: holiday.date.toISOString().split('T')[0],
      type: holiday.type,
      stateCode: holiday.state_code,
      isActive: holiday.is_active,
      createdAt: holiday.created_at,
      updatedAt: holiday.updated_at,
    };

    res.json(successResponse(formattedHoliday, 'Holiday updated successfully'));
  } catch (error) {
    console.error('Error updating holiday:', error);
    res.status(500).json(errorResponse('Failed to update holiday'));
  }
});

/**
 * DELETE /api/hr/holidays/:holidayId
 * Delete holiday
 */
router.delete('/holidays/:holidayId', async (req: Request, res: Response) => {
  try {
    const { holidayId } = req.params;
    const userRole = req.session.role?.name;

    // Only admin roles can delete holidays
    const canManage = ['superadmin', 'partner', 'admin', 'support', 'it', 'hr'].includes(userRole || '');
    
    if (!canManage) {
      return res.status(403).json(errorResponse('You do not have permission to delete holidays'));
    }

    await prisma.holidays.delete({
      where: {
        holiday_id: parseInt(holidayId),
      },
    });

    res.json(successResponse(null, 'Holiday deleted successfully'));
  } catch (error) {
    console.error('Error deleting holiday:', error);
    res.status(500).json(errorResponse('Failed to delete holiday'));
  }
});

// ============================================================================
// LEAVES ROUTES (HR-specific endpoints)
// ============================================================================

/**
 * GET /api/hr/leaves/available/:userId
 * Get available leave balance for a user
 */
router.get('/leaves/available/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const sessionUserId = req.session.userId;
    const userRole = req.session.role?.name;

    // Check permissions
    const canSeeAll = ['superadmin', 'partner', 'admin', 'support', 'it', 'hr'].includes(userRole || '');
    
    if (!canSeeAll && parseInt(userId) !== sessionUserId) {
      return res.status(403).json(errorResponse('You can only view your own leave balance'));
    }

    // Get leave stats for the current year
    const currentYear = new Date().getFullYear();
    const leaves = await prisma.leaves.findMany({
      where: {
        user_id: parseInt(userId),
        start_date: {
          gte: new Date(`${currentYear}-01-01`),
          lte: new Date(`${currentYear}-12-31`),
        },
        status: 'approved',
      },
    });

    if(!leaves) {
      return res.status(404).json(errorResponse('No leaves found for the user'));
    }

    // Calculate used leaves by type
    const usedLeaves = {
      sick: leaves.filter(l => l.leave_type === 'sick').reduce((sum, l) => sum + l.total_days, 0),
      casual: leaves.filter(l => l.leave_type === 'casual').reduce((sum, l) => sum + l.total_days, 0),
      earned: leaves.filter(l => l.leave_type === 'earned').reduce((sum, l) => sum + l.total_days, 0),
      maternity: leaves.filter(l => l.leave_type === 'maternity').reduce((sum, l) => sum + l.total_days, 0),
      paternity: leaves.filter(l => l.leave_type === 'paternity').reduce((sum, l) => sum + l.total_days, 0),
      unpaid: leaves.filter(l => l.leave_type === 'unpaid').reduce((sum, l) => sum + l.total_days, 0),
    };

    // Default leave balances (can be configured per user/role)
    const totalLeaves = {
      sick: 12, // 12 sick leaves per year
      casual: 12, // 12 casual leaves per year
      earned: 15, // 15 earned leaves per year
      maternity: 180, // 180 days maternity leave
      paternity: 5, // 5 days paternity leave
      unpaid: Infinity, // Unlimited unpaid leaves
    };

    const availableLeaves = {
      sick: totalLeaves.sick - usedLeaves.sick,
      casual: totalLeaves.casual - usedLeaves.casual,
      earned: totalLeaves.earned - usedLeaves.earned,
      maternity: totalLeaves.maternity - usedLeaves.maternity,
      paternity: totalLeaves.paternity - usedLeaves.paternity,
      unpaid: totalLeaves.unpaid,
    };

    res.json(successResponse({
      used: usedLeaves,
      available: availableLeaves,
      total: totalLeaves,
    }, 'Leave balance fetched successfully'));
  } catch (error) {
    console.error('Error fetching leave balance:', error);
    res.status(500).json(errorResponse('Failed to fetch leave balance'));
  }
});

/**
 * GET /api/hr/leaves/applied/:userId
 * Get applied leaves for a user
 */
router.get('/leaves/applied/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const sessionUserId = req.session.userId;
    const userRole = req.session.role?.name;

    // Check permissions
    const canSeeAll = ['superadmin', 'partner', 'admin', 'support', 'it', 'hr'].includes(userRole || '');
    
    if (!canSeeAll && parseInt(userId) !== sessionUserId) {
      return res.status(403).json(errorResponse('You can only view your own applied leaves'));
    }

    const leaves = await prisma.leaves.findMany({
      where: {
        user_id: parseInt(userId),
      },
      include: {
        reviewer: {
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

    const formattedLeaves = leaves.map((leave) => ({
      id: leave.leave_id,
      leaveType: leave.leave_type,
      startDate: leave.start_date.toISOString().split('T')[0],
      endDate: leave.end_date.toISOString().split('T')[0],
      totalDays: leave.total_days,
      reason: leave.reason,
      status: leave.status,
      reviewedBy: leave.reviewed_by,
      reviewerComments: leave.reviewer_comments,
      createdAt: leave.created_at,
      updatedAt: leave.updated_at,
      reviewer: leave.reviewer ? {
        id: leave.reviewer.user_id,
        name: leave.reviewer.name,
      } : null,
    }));

    res.json(successResponse(formattedLeaves, 'Applied leaves fetched successfully'));
  } catch (error) {
    console.error('Error fetching applied leaves:', error);
    res.status(500).json(errorResponse('Failed to fetch applied leaves'));
  }
});

export default router;

