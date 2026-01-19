import { Router, Request, Response } from 'express';
import prisma from '../prisma-client';
import { requireAuth } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { ActivityService, ActivityActionType, ActivityEntityType } from '../services/activity.service';
import { EmailService } from '../services/email.service';

const router = Router();

// ============================================================================
// LEAVE CONFIGURATION
// ============================================================================

interface LeaveConfig {
  totalDays: number;
  applicableTo: string[];
  autoCalculate: boolean;
}

const LEAVE_CONFIG: Record<string, LeaveConfig> = {
  privilege: {
    totalDays: 15,
    applicableTo: ['male', 'female'],
    autoCalculate: false,
  },
  // regular: {  // ✅ KEEP THIS for backward compatibility
  //   totalDays: 15,
  //   applicableTo: ['male', 'female'],
  //   autoCalculate: false,
  // },
  maternity: {
    totalDays: 182, // 26 weeks
    applicableTo: ['female'],
    autoCalculate: true,
  },
  paternity: {
    totalDays: 15, // 2 weeks
    applicableTo: ['male'],
    autoCalculate: true,
  },
  sick: {
    totalDays: 999, // Unlimited (using high number)
    applicableTo: ['male', 'female'],
    autoCalculate: false,
  },
};


// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate working days between two dates, excluding weekends and holidays
 */
function calculateWorkingDays(
  startDate: Date,
  endDate: Date,
  holidays: Array<{ date: string }>
): number {
  let workingDays = 0;
  const currentDate = new Date(startDate);
  const holidayDates = new Set(holidays.map(h => h.date));

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
    const dateString = currentDate.toISOString().split('T')[0];
    const isHoliday = holidayDates.has(dateString);

    if (!isWeekend && !isHoliday) {
      workingDays++;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return workingDays;
}

/**
 * Calculate end date based on start date and number of working days
 */
function calculateEndDate(
  startDate: Date,
  workingDays: number,
  holidays: Array<{ date: string }>
): Date {
  let remainingDays = workingDays;
  const currentDate = new Date(startDate);
  const holidayDates = new Set(holidays.map(h => h.date));

  while (remainingDays > 0) {
    const dayOfWeek = currentDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dateString = currentDate.toISOString().split('T')[0];
    const isHoliday = holidayDates.has(dateString);

    if (!isWeekend && !isHoliday) {
      remainingDays--;
    }

    if (remainingDays > 0) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  return currentDate;
}

/**
 * Get holidays for a specific location and year from database
 */
async function getHolidaysByLocation(location: string, year: number): Promise<Array<{ date: string; day: string; occasion: string }>> {
  try {
    const holidays = await prisma.holidays.findMany({
      where: {
        location: location?.toLowerCase(),
        year: year,
      },
      orderBy: {
        date: 'asc',
      },
    });

    return holidays.map(h => ({
      date: h.date.toISOString().split('T')[0],
      day: h.day,
      occasion: h.occasion,
    }));
  } catch (error) {
    console.error('Error fetching holidays from database:', error);
    return [];
  }
}

/**
 * Initialize leave balance for a user
 */
// Updated initializeLeaveBalance function
async function initializeLeaveBalance(userId: number, year: number) {
  try {
    const user = await prisma.users.findUnique({
      where: { user_id: userId },
      select: { gender: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if privilege balance already exists
    let privilegeBalance = await prisma.leave_balances.findUnique({
      where: {
        user_id_leave_type_year: {
          user_id: userId,
          leave_type: 'privilege',
          year: year,
        },
      },
    });

    // ✅ Case 1: Balance exists and has been used (has applied or pending days)
    if (privilegeBalance && (privilegeBalance.applied > 0 || privilegeBalance.pending > 0)) {
      console.log(`✓ User ${userId} has active privilege balance (applied: ${privilegeBalance.applied}, pending: ${privilegeBalance.pending})`);
      return; // Don't touch it - user has active leaves
    }

    // ✅ Case 2: Balance exists but is unused/default - recreate it
    if (privilegeBalance && privilegeBalance.applied === 0 && privilegeBalance.pending === 0) {
      await prisma.leave_balances.delete({
        where: {
          balance_id: privilegeBalance.balance_id,
        },
      });
      // ✅ CRITICAL: Set to null so the creation block runs
      privilegeBalance = null;
    }

    // ✅ Case 3: No balance exists - create it
    if (!privilegeBalance) {
      await prisma.leave_balances.create({
        data: {
          user_id: userId,
          leave_type: 'privilege',
          year: year,
          total_allocated: LEAVE_CONFIG.privilege.totalDays,
          balance: LEAVE_CONFIG.privilege.totalDays,
          pending: 0,
          applied: 0,
        },
      });
      console.log(`✅ Successfully created privilege balance (15 days) for user ${userId}`);
    }

    // Optional: Clean up any legacy 'regular' type balances
    try {
      const regularBalance = await prisma.leave_balances.findUnique({
        where: {
          user_id_leave_type_year: {
            user_id: userId,
            leave_type: 'regular',
            year: year,
          },
        },
      });

      if (regularBalance) {
        console.log(`🗑️  Removing legacy 'regular' balance for user ${userId}`);
        await prisma.leave_balances.delete({
          where: {
            balance_id: regularBalance.balance_id,
          },
        });
      }
    } catch (error) {
      // Ignore if 'regular' doesn't exist
    }
  } catch (error) {
    console.error(`❌ Error initializing leave balance for user ${userId}:`, error);
    throw error; // Re-throw so caller knows it failed
  }
}

// Apply auth middleware to all routes
router.use(requireAuth);

/**
 * GET /api/leaves
 * Get all leaves with optional filters
 * Non-authorized users can only see their own leaves
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId, status, leaveType, startDate, endDate } = req.query;
    const sessionUserId = req.session.userId;
    const userRole = req.session.role?.name;

    const where: any = {};

    // Role-based data filtering: only certain roles can see all leaves
    const canSeeAllLeaves = ['superadmin','partner', 'admin', 'support', 'it', 'hr'].includes(userRole || '');
    
    if (userId) {
      const requestedUserId = parseInt(userId as string);
      // Security check: non-authorized users can only query their own leaves
      if (!canSeeAllLeaves && requestedUserId !== sessionUserId) {
        return res.status(403).json({
          success: false,
          message: 'You can only view your own leaves',
        });
      }
      where.user_id = requestedUserId;
    } else if (!canSeeAllLeaves) {
      // If no userId specified and user is not authorized, default to their own leaves
      where.user_id = sessionUserId;
    }

    if (status) {
      where.status = status as string;
    }

    if (leaveType) {
      where.leave_type = leaveType as string;
    }

    if (startDate || endDate) {
      where.start_date = {};
      if (startDate) {
        where.start_date.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.start_date.lte = new Date(endDate as string);
      }
    }

    const leaves = await prisma.leaves.findMany({
      where,
      include: {
        user: {
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
        },
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
      userId: leave.user_id,
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
      user: {
        id: leave.user.user_id,
        name: leave.user.name,
        email: leave.user.email,
        role: leave.user.role.name,
      },
      reviewer: leave.reviewer ? {
        id: leave.reviewer.user_id,
        name: leave.reviewer.name,
      } : null,
    }));

    res.json(successResponse(formattedLeaves, 'Leaves fetched successfully'));
  } catch (error) {
    console.error('Error fetching leaves:', error);
    res.status(500).json(errorResponse('Failed to fetch leaves'));
  }
});

// ============================================================================
// SPECIFIC ROUTES (MUST COME BEFORE /:id)
// ============================================================================


/**
 * GET /api/leaves/available-types
 * Get available leave types for current user based on gender
 */
router.get('/available-types', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json(errorResponse('Unauthorized'));
    }

    const user = await prisma.users.findUnique({
      where: { user_id: userId },
      select: { gender: true },
    });

    if (!user) {
      return res.status(404).json(errorResponse('User not found'));
    }

    const availableTypes = Object.entries(LEAVE_CONFIG)
      .filter(([_, config]) => config.applicableTo.includes(user.gender || ''))
      .map(([type, config]) => ({
        value: type,
        label: (type === 'privilege')
          ? 'Privilege Leave'  
          : type.charAt(0).toUpperCase() + type.slice(1) + ' Leave',
        totalDays: config.totalDays,
        autoCalculate: config.autoCalculate,
      }));

    res.json(successResponse(availableTypes, 'Available leave types fetched successfully'));
  } catch (error) {
    console.error('Error fetching available leave types:', error);
    res.status(500).json(errorResponse('Failed to fetch available leave types'));
  }
});

/**
 * GET /api/leaves/balances/all
 * Get leave balances for all users (HR view)
 * Restricted to: superadmin, partner, admin, support, it, hr
 */
// Updated route
router.get('/balances/all', async (req: Request, res: Response) => {
  try {
    const userRole = req.session.role?.name;
    const canViewAllBalances = ['superadmin', 'partner', 'admin', 'support', 'it', 'hr'].includes(userRole || '');

    if (!canViewAllBalances) {
      return res.status(403).json(errorResponse('You do not have permission to view all leave balances'));
    }

    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    // Step 1: Fetch users and balances in parallel
    const [users, allBalances] = await Promise.all([
      prisma.users.findMany({
        where: { active_status: true },
        select: {
          user_id: true,
          name: true,
          email: true,
          gender: true,
          role: { select: { name: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.leave_balances.findMany({
        where: { year: year },
      }),
    ]);
    console.log('before');
    const sickLeaves = await prisma.leaves.groupBy({
      by: ['user_id'],
      where: {
        leave_type: 'sick',
        start_date: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`),
        },
      },
      _sum: {
        total_days: true,
      },
    });
  console.log('SICK LEAVES GROUPED:', sickLeaves);

  const sickLeaveMap = new Map<number, number>();
    sickLeaves.forEach(s => {
      sickLeaveMap.set(s.user_id, s._sum.total_days || 0);
    });
    console.log('after');

    console.log(`📊 Found ${users.length} users and ${allBalances.length} balance records`);

    // Step 2: Find users WITHOUT privilege balance (optimize with Set for O(1) lookup)
    const usersWithBalance = new Set(
      allBalances
        .filter(b => b.leave_type === 'privilege')
        .map(b => b.user_id)
    );

    const usersWithoutBalance = users.filter(u => !usersWithBalance.has(u.user_id));

    // Step 3: ✅ BULK CREATE missing balances (single query instead of N queries!)
    if (usersWithoutBalance.length > 0) {
      console.log(`✨ Creating balances for ${usersWithoutBalance.length} users in bulk`);
      
      await prisma.leave_balances.createMany({
        data: usersWithoutBalance.map(user => ({
          user_id: user.user_id,
          leave_type: 'privilege',
          year: year,
          total_allocated: LEAVE_CONFIG.privilege.totalDays,
          balance: LEAVE_CONFIG.privilege.totalDays,
          pending: 0,
          applied: 0,
        })),
        skipDuplicates: true, // Skip if somehow already exists
      });

      console.log(`✅ Bulk created ${usersWithoutBalance.length} balances`);

      // Re-fetch balances to include newly created ones
      const newBalances = await prisma.leave_balances.findMany({
        where: { 
          year: year,
          user_id: { in: usersWithoutBalance.map(u => u.user_id) }
        },
      });
      allBalances.push(...newBalances);
    }

    // Step 4: Group balances by user_id
    const balancesByUser = new Map<number, typeof allBalances>();
    for (const balance of allBalances) {
      const existing = balancesByUser.get(balance.user_id) || [];
      existing.push(balance);
      balancesByUser.set(balance.user_id, existing);
    }

    // Step 5: Map users to their balances
    const userBalances = users.map((user) => {
      const balances = balancesByUser.get(user.user_id) || [];
      const privilegeBalance = balances.find(b => b.leave_type === 'privilege');
      
      // Fallback to default if somehow still missing
      const displayBalance = privilegeBalance || {
        total_allocated: LEAVE_CONFIG.privilege.totalDays,
        balance: LEAVE_CONFIG.privilege.totalDays,
        pending: 0,
        applied: 0,
      };
      
      return {
        userId: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role.name,
        totalAllocated: displayBalance.total_allocated,
        sickTaken: sickLeaveMap.get(user.user_id) || 0,
        balance: displayBalance.balance,
        pending: displayBalance.pending,
        applied: displayBalance.applied,
        balancesByType: balances.map(b => ({
          leaveType: b.leave_type,
          totalAllocated: b.total_allocated,
          balance: b.balance,
          pending: b.pending,
          applied: b.applied,
        })),
      };
    });

    console.log(`✅ Returning ${userBalances.length} user balances`);

    res.json(successResponse(userBalances, 'All leave balances fetched successfully'));
  } catch (error) {
    console.error('❌ Error fetching all leave balances:', error);
    res.status(500).json(errorResponse('Failed to fetch all leave balances'));
  }
});

/**
 * GET /api/leaves/balance/:userId
 * Get leave balance for a user
 */
router.get('/balance/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    // Initialize balance if not exists
    await initializeLeaveBalance(parseInt(userId), year);

    const balances = await prisma.leave_balances.findMany({
      where: {
        user_id: parseInt(userId),
        year: year,
      },
    });

    const formattedBalances = balances.map(balance => ({
      leaveType: balance.leave_type,
      year: balance.year,
      totalAllocated: balance.total_allocated,
      balance: balance.balance,
      pending: balance.pending,
      applied: balance.applied,
    }));

    res.json(successResponse(formattedBalances, 'Leave balance fetched successfully'));
  } catch (error) {
    console.error('Error fetching leave balance:', error);
    res.status(500).json(errorResponse('Failed to fetch leave balance'));
  }
});


/**
 * GET /api/leaves/balance-summary/:userId
 * Get simplified leave balance summary for dashboard widget
 */
router.get('/balance-summary/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    // Get user gender
    const user = await prisma.users.findUnique({
      where: { user_id: parseInt(userId) },
      select: { gender: true },
    });

    if (!user) {
      return res.status(404).json(errorResponse('User not found'));
    }

    // Initialize balance if not exists
    await initializeLeaveBalance(parseInt(userId), year);

    // Get all balances
    const balances = await prisma.leave_balances.findMany({
      where: {
        user_id: parseInt(userId),
        year: year,
      },
    });

    // Get sick leave DAYS taken (sum of total_days for approved sick leaves)
    const sickLeaves = await prisma.leaves.findMany({
      where: {
        user_id: parseInt(userId),
        leave_type: 'sick',
        status: 'approved',
        start_date: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`),
        },
      },
      select: {
        total_days: true,
      },
    });

    // Sum up all the days
    const sickLeavesTaken = sickLeaves.reduce((sum, leave) => sum + leave.total_days, 0);

    // Find specific balances
    const privilegeBalance = balances.find(b => b.leave_type === 'privilege');
    const maternityBalance = balances.find(b => b.leave_type === 'maternity');
    const paternityBalance = balances.find(b => b.leave_type === 'paternity');

    // ✅ REPLACE THE ENTIRE summary OBJECT WITH THIS:
    const summary = {
      privilege: {
        available: privilegeBalance?.balance || 0,
        total: privilegeBalance?.total_allocated || 0,
        applied: privilegeBalance?.applied || 0,  // ✅ ADD THIS
        pending: privilegeBalance?.pending || 0,  // ✅ ADD THIS
      },
      maternity: user.gender === 'female' ? {
        available: maternityBalance?.balance || 0,
        total: maternityBalance?.total_allocated || 0,
        applied: maternityBalance?.applied || 0,  // ✅ ADD THIS
        pending: maternityBalance?.pending || 0,  // ✅ ADD THIS
      } : null,
      paternity: user.gender === 'male' ? {
        available: paternityBalance?.balance || 0,
        total: paternityBalance?.total_allocated || 0,
        applied: paternityBalance?.applied || 0,  // ✅ ADD THIS
        pending: paternityBalance?.pending || 0,  // ✅ ADD THIS
      } : null,
      sickLeavesTaken: sickLeavesTaken,
    };

    res.json(successResponse(summary, 'Leave balance summary fetched successfully'));
  } catch (error) {
    console.error('Error fetching leave balance summary:', error);
    res.status(500).json(errorResponse('Failed to fetch leave balance summary'));
  }
});

/**
 * POST /api/leaves/calculate-working-days
 * Calculate working days between two dates
 */
router.post('/calculate-working-days', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    const { startDate, endDate, location } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json(errorResponse('Start date and end date are required'));
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return res.status(400).json(errorResponse('Start date cannot be after end date'));
    }

    // Get user location if not provided
    let userLocation = location;
    if (!userLocation && userId) {
      const user = await prisma.users.findUnique({
        where: { user_id: userId },
        select: { location: true },
      });
      userLocation = user?.location;
    }

    const year = start.getFullYear();
    const holidays = await getHolidaysByLocation(userLocation || '', year);
    const workingDays = calculateWorkingDays(start, end, holidays);

    res.json(successResponse({
      startDate: startDate,
      endDate: endDate,
      workingDays: workingDays,
      totalDays: Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    }, 'Working days calculated successfully'));
  } catch (error) {
    console.error('Error calculating working days:', error);
    res.status(500).json(errorResponse('Failed to calculate working days'));
  }
});





/**
 * POST /api/leaves/calculate-end-date
 * Calculate end date based on start date and working days
 */
router.post('/calculate-end-date', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    const { startDate, workingDays, location } = req.body;

    if (!startDate || !workingDays) {
      return res.status(400).json(errorResponse('Start date and working days are required'));
    }

    const start = new Date(startDate);

    // Get user location if not provided
    let userLocation = location;
    if (!userLocation && userId) {
      const user = await prisma.users.findUnique({
        where: { user_id: userId },
        select: { location: true },
      });
      userLocation = user?.location;
    }

    const year = start.getFullYear();
    const holidays = await getHolidaysByLocation(userLocation || '', year);
    const endDate = calculateEndDate(start, parseInt(workingDays), holidays);

    res.json(successResponse({
      startDate: startDate,
      workingDays: parseInt(workingDays),
      endDate: endDate.toISOString().split('T')[0],
    }, 'End date calculated successfully'));
  } catch (error) {
    console.error('Error calculating end date:', error);
    res.status(500).json(errorResponse('Failed to calculate end date'));
  }
});

/**
 * GET /api/leaves/firmwide-this-week
 * Get all leaves firmwide for the current week (Monday-Sunday)
 * Restricted to: hr, admin, superadmin
 */
router.get('/firmwide-this-week', async (req: Request, res: Response) => {
  try {
    const userRole = req.session.role?.name?.toLowerCase();
    const canViewFirmwideLeaves = ['superadmin', 'admin', 'hr'].includes(userRole || '');

    if (!canViewFirmwideLeaves) {
      return res.status(403).json(errorResponse('You do not have permission to view firmwide leaves'));
    }

    // Calculate current week boundaries (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    // Adjust for Monday start (0 = Sunday, so we need special handling)
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Query leaves where date range overlaps with current week
    // A leave overlaps if: leave_start <= week_end AND leave_end >= week_start
    const leaves = await prisma.leaves.findMany({
      where: {
        AND: [
          { start_date: { lte: weekEnd } },
          { end_date: { gte: weekStart } },
        ],
      },
      include: {
        user: {
          select: {
            user_id: true,
            name: true,
            email: true,
            location: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
        reviewer: {
          select: {
            user_id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { start_date: 'asc' },
        { user: { name: 'asc' } },
      ],
    });

    const formattedLeaves = leaves.map((leave) => ({
      id: leave.leave_id,
      userId: leave.user_id,
      leaveType: leave.leave_type,
      startDate: leave.start_date.toISOString().split('T')[0],
      endDate: leave.end_date.toISOString().split('T')[0],
      totalDays: leave.total_days,
      reason: leave.reason,
      status: leave.status,
      reviewedBy: leave.reviewed_by,
      reviewerComments: leave.reviewer_comments,
      createdAt: leave.created_at.toISOString(),
      updatedAt: leave.updated_at.toISOString(),
      user: {
        id: leave.user.user_id,
        name: leave.user.name,
        email: leave.user.email,
        location: leave.user.location,
        role: leave.user.role.name,
      },
      reviewer: leave.reviewer ? {
        id: leave.reviewer.user_id,
        name: leave.reviewer.name,
      } : null,
    }));

    res.json(successResponse({
      leaves: formattedLeaves,
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      totalCount: formattedLeaves.length,
    }, 'Firmwide leaves for this week fetched successfully'));
  } catch (error) {
    console.error('Error fetching firmwide leaves:', error);
    res.status(500).json(errorResponse('Failed to fetch firmwide leaves'));
  }
});

/**
 * POST /api/leaves/email-report
 * Send leaves report via email with CSV attachment
 * Restricted to: hr, admin, superadmin
 */
router.post('/email-report', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    const userRole = req.session.role?.name?.toLowerCase();
    const canSendReport = ['superadmin', 'admin', 'hr'].includes(userRole || '');

    if (!canSendReport) {
      return res.status(403).json(errorResponse('You do not have permission to send leaves report'));
    }

    const { emails, weekStart: customWeekStart } = req.body;

    // Validate emails
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json(errorResponse('At least one email address is required'));
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter((email: string) => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      return res.status(400).json(errorResponse(`Invalid email addresses: ${invalidEmails.join(', ')}`));
    }

    // Get sender info
    const sender = await prisma.users.findUnique({
      where: { user_id: userId },
      select: { name: true },
    });

    // Calculate week boundaries
    let weekStart: Date;
    let weekEnd: Date;

    if (customWeekStart) {
      weekStart = new Date(customWeekStart);
      weekStart.setHours(0, 0, 0, 0);
    } else {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      weekStart = new Date(now);
      weekStart.setDate(now.getDate() + mondayOffset);
      weekStart.setHours(0, 0, 0, 0);
    }

    weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Fetch leaves for the week
    const leaves = await prisma.leaves.findMany({
      where: {
        AND: [
          { start_date: { lte: weekEnd } },
          { end_date: { gte: weekStart } },
        ],
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            location: true,
            role: { select: { name: true } },
          },
        },
        reviewer: {
          select: { name: true },
        },
      },
      orderBy: [
        { start_date: 'asc' },
        { user: { name: 'asc' } },
      ],
    });

    // Generate CSV content
    const csvHeaders = [
      'Name',
      'Email',
      'Role',
      'Location',
      'Leave Type',
      'Start Date',
      'End Date',
      'Total Days',
      'Status',
      'Reason',
      'Reviewer',
      'Reviewer Comments',
      'Created At',
      'Updated At',
    ];

    const csvRows = leaves.map((leave) => [
      leave.user.name || '',
      leave.user.email || '',
      leave.user.role?.name || '',
      leave.user.location || '',
      leave.leave_type || '',
      leave.start_date.toISOString().split('T')[0],
      leave.end_date.toISOString().split('T')[0],
      leave.total_days.toString(),
      leave.status || '',
      `"${(leave.reason || '').replace(/"/g, '""')}"`,
      leave.reviewer?.name || '',
      `"${(leave.reviewer_comments || '').replace(/"/g, '""')}"`,
      leave.created_at.toISOString(),
      leave.updated_at.toISOString(),
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map((row) => row.join(',')),
    ].join('\n');

    // Send email
    const emailResult = await EmailService.sendLeavesReportEmail({
      recipientEmails: emails,
      senderName: sender?.name || 'HR Team',
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      csvContent,
      totalLeaves: leaves.length,
    });

    if (!emailResult.success) {
      return res.status(500).json(errorResponse(`Failed to send email: ${emailResult.error}`));
    }

    res.json(successResponse({
      messageId: emailResult.messageId,
      recipientCount: emails.length,
      leavesCount: leaves.length,
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
    }, 'Leaves report sent successfully'));
  } catch (error) {
    console.error('Error sending leaves report:', error);
    res.status(500).json(errorResponse('Failed to send leaves report'));
  }
});

/**
 * GET /api/leaves/holidays/:location/:year
 * Get holidays for a specific location and year from database
 */
router.get('/holidays/:location/:year', async (req: Request, res: Response) => {
  try {
    const { location, year } = req.params;
    const holidays = await getHolidaysByLocation(location, parseInt(year));

    res.json(successResponse(holidays, 'Holidays fetched successfully'));
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json(errorResponse('Failed to fetch holidays'));
  }
});

/**
 * GET /api/leaves/holidays
 * Get all holidays or filter by location/year via query params
 */
router.get('/holidays', async (req: Request, res: Response) => {
  try {
    const { location, year } = req.query;
    
    const where: any = {};
    if (location) {
      where.location = (location as string).toLowerCase();
    }
    if (year) {
      where.year = parseInt(year as string);
    }

    const holidays = await prisma.holidays.findMany({
      where,
      orderBy: [
        { year: 'asc' },
        { date: 'asc' },
      ],
    });

    const formattedHolidays = holidays.map(h => ({
      id: h.holiday_id,
      location: h.location,
      date: h.date.toISOString().split('T')[0],
      day: h.day,
      occasion: h.occasion,
      year: h.year,
    }));

    res.json(successResponse(formattedHolidays, 'Holidays fetched successfully'));
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json(errorResponse('Failed to fetch holidays'));
  }
});

/**
 * GET /api/leaves/stats/:userId
 * Get leave statistics for a user
 */
router.get('/stats/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const currentYear = new Date().getFullYear();

    // Get all leaves for the current year with error handling for connection pool issues
    let leaves;
    try {
      leaves = await prisma.leaves.findMany({
        where: {
          user_id: parseInt(userId),
          start_date: {
            gte: new Date(`${currentYear}-01-01`),
            lte: new Date(`${currentYear}-12-31`),
          },
        },
      });
    } catch (error: any) {
      // Handle connection pool timeout errors
      if (error?.code === 'P2024' || error?.message?.includes('connection pool') || error?.message?.includes('timeout')) {
        console.error('Connection pool timeout, returning empty stats:', error);
        // Return empty stats instead of crashing
        return res.json(successResponse({
          totalLeaves: 0,
          pendingLeaves: 0,
          approvedLeaves: 0,
          rejectedLeaves: 0,
          totalDaysUsed: 0,
          leavesByType: {
            sick: 0,
            casual: 0,
            earned: 0,
            maternity: 0,
            paternity: 0,
            unpaid: 0,
          },
        }, 'Leave statistics (connection timeout - retrying)'));
      }
      throw error;
    }

    // Calculate statistics
    const stats = {
      totalLeaves: leaves.length,
      pendingLeaves: leaves.filter(l => l.status === 'pending').length,
      approvedLeaves: leaves.filter(l => l.status === 'approved').length,
      rejectedLeaves: leaves.filter(l => l.status === 'rejected').length,
      totalDaysUsed: leaves
        .filter(l => l.status === 'approved')
        .reduce((sum, l) => sum + l.total_days, 0),
      leavesByType: {
        sick: leaves.filter(l => l.leave_type === 'sick' && l.status === 'approved').reduce((sum, l) => sum + l.total_days, 0),
        casual: leaves.filter(l => l.leave_type === 'casual' && l.status === 'approved').reduce((sum, l) => sum + l.total_days, 0),
        earned: leaves.filter(l => l.leave_type === 'earned' && l.status === 'approved').reduce((sum, l) => sum + l.total_days, 0),
        maternity: leaves.filter(l => l.leave_type === 'maternity' && l.status === 'approved').reduce((sum, l) => sum + l.total_days, 0),
        paternity: leaves.filter(l => l.leave_type === 'paternity' && l.status === 'approved').reduce((sum, l) => sum + l.total_days, 0),
        unpaid: leaves.filter(l => l.leave_type === 'unpaid' && l.status === 'approved').reduce((sum, l) => sum + l.total_days, 0),
      },
    };

    res.json(successResponse(stats, 'Leave statistics fetched successfully'));
  } catch (error) {
    console.error('Error fetching leave stats:', error);
    res.status(500).json(errorResponse('Failed to fetch leave statistics'));
  }
});

/**
 * GET /api/leaves/user/:userId
 * Get all leaves for a specific user
 */
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const leaves = await prisma.leaves.findMany({
      where: {
        user_id: parseInt(userId),
      },
      include: {
        user: {
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
        },
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
      userId: leave.user_id,
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
      user: {
        id: leave.user.user_id,
        name: leave.user.name,
        email: leave.user.email,
        role: leave.user.role.name,
      },
      reviewer: leave.reviewer ? {
        id: leave.reviewer.user_id,
        name: leave.reviewer.name,
      } : null,
    }));

    res.json(successResponse(formattedLeaves, 'User leaves fetched successfully'));
  } catch (error) {
    console.error('Error fetching user leaves:', error);
    res.status(500).json(errorResponse('Failed to fetch user leaves'));
  }
});

/**
 * GET /api/leaves/:id
 * Get a single leave by ID
 * NOTE: This MUST come after all specific routes to avoid catching them
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const leave = await prisma.leaves.findUnique({
      where: {
        leave_id: parseInt(id),
      },
      include: {
        user: {
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
        },
        reviewer: {
          select: {
            user_id: true,
            name: true,
          },
        },
      },
    });

    if (!leave) {
      return res.status(404).json(errorResponse('Leave not found'));
    }

    const formattedLeave = {
      id: leave.leave_id,
      userId: leave.user_id,
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
      user: {
        id: leave.user.user_id,
        name: leave.user.name,
        email: leave.user.email,
        role: leave.user.role.name,
      },
      reviewer: leave.reviewer ? {
        id: leave.reviewer.user_id,
        name: leave.reviewer.name,
      } : null,
    };

    res.json(successResponse(formattedLeave, 'Leave fetched successfully'));
  } catch (error) {
    console.error('Error fetching leave:', error);
    res.status(500).json(errorResponse('Failed to fetch leave'));
  }
});

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * POST /api/leaves
 * Create a new leave request with smart calculation
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json(errorResponse('Unauthorized'));
    }

    let {
      leaveType,
      startDate,
      endDate,
      totalDays,
      reason,
    } = req.body;

    // Validation
    if (!leaveType || !startDate || !reason) {
      return res.status(400).json(errorResponse('Missing required fields'));
    }

    // Validate leave type
    const validLeaveTypes = ['privilege', 'maternity', 'paternity', 'sick'];
    if (!validLeaveTypes.includes(leaveType)) {
      return res.status(400).json(errorResponse('Invalid leave type'));
    }

    // Get user details (gender, location)
    const user = await prisma.users.findUnique({
      where: { user_id: userId },
      select: {
        gender: true,
        location: true,
        reporting_manager_id: true,
        name: true,
        email: true,
      },
    });

    if (!user) {
      return res.status(404).json(errorResponse('User not found'));
    }

    // Validate leave type for gender
    const config = LEAVE_CONFIG[leaveType];
    if (!config) {
      return res.status(400).json(errorResponse('Invalid leave type'));
    }

    if (!config.applicableTo.includes(user.gender || '')) {
      return res.status(403).json(errorResponse(`${leaveType} leave is not applicable for your gender`));
    }

    // Get holidays for user's location
    const year = new Date(startDate).getFullYear();
    const holidays = await getHolidaysByLocation(user.location || '', year);

    // Auto-calculate end date for maternity/paternity
    const start = new Date(startDate);
    let end: Date;
    let workingDays: number;

    if (config.autoCalculate) {
      // Calculate end date based on configured working days
      end = calculateEndDate(start, config.totalDays, holidays);
      workingDays = config.totalDays;
    } else {
      // For privilege leaves, use provided end date
      if (!endDate) {
        return res.status(400).json(errorResponse('End date is required for Privilege leave'));
      }
      end = new Date(endDate);
      
      if (start > end) {
        return res.status(400).json(errorResponse('Start date cannot be after end date'));
      }

      // Calculate working days excluding weekends and holidays
      workingDays = calculateWorkingDays(start, end, holidays);
    }

 
    // Initialize leave balance if not exists (skip for sick leave)
    if (leaveType !== 'sick') {
      await initializeLeaveBalance(userId, year);

      // Check if balance exists for this leave type
      let balance = await prisma.leave_balances.findUnique({
        where: {
          user_id_leave_type_year: {
            user_id: userId,
            leave_type: leaveType,
            year: year,
          },
        },
      });

      // ✅ If balance doesn't exist for maternity/paternity, create it on-demand
      if (!balance && (leaveType === 'maternity' || leaveType === 'paternity')) {
        const config = LEAVE_CONFIG[leaveType];
        
        // Verify user is eligible based on gender
        if (!config.applicableTo.includes(user.gender || '')) {
          return res.status(403).json(errorResponse(`${leaveType} leave is not applicable for your gender`));
        }

        // Create the balance
        balance = await prisma.leave_balances.create({
          data: {
            user_id: userId,
            leave_type: leaveType,
            year: year,
            total_allocated: config.totalDays,
            balance: config.totalDays,
            pending: 0,
            applied: 0,
          },
        });
        
        console.log(`✅ Created ${leaveType} leave balance for user ${userId}`);
      }

      if (!balance) {
        return res.status(400).json(errorResponse('Leave balance not found. Please contact HR.'));
      }

      if (balance.balance < workingDays) {
        return res.status(400).json(errorResponse(`Insufficient leave balance. Available: ${balance.balance} days, Required: ${workingDays} days`));
      }
    }

    // Create leave record
    const leave = await prisma.leaves.create({
      data: {
        user_id: userId,
        leave_type: leaveType,
        start_date: start,
        end_date: end,
        total_days: workingDays,
        reason: reason,
        status: 'pending',
        year: year,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            reporting_manager_id: true,
          },
        },
      },
    });

    // Update balance (decrement balance, increment pending) - skip for sick leave
    if (leaveType !== 'sick') {
      const balance = await prisma.leave_balances.findUnique({
        where: {
          user_id_leave_type_year: {
            user_id: userId,
            leave_type: leaveType,
            year: year,
          },
        },
      });

      if (balance) {
        await prisma.leave_balances.update({
          where: {
            user_id_leave_type_year: {
              user_id: userId,
              leave_type: leaveType,
              year: year,
            },
          },
          data: {
            balance: balance.balance - workingDays,
            pending: balance.pending + workingDays,
          },
        });
      }
    }

    // Log activity and notify the reporting manager
    try {
      const notifyUsers: number[] = [];
      if (leave.user.reporting_manager_id) {
        notifyUsers.push(leave.user.reporting_manager_id);
      }

      await ActivityService.createActivity({
        actionType: ActivityActionType.LEAVE_REQUESTED,
        actorId: userId,
        entityType: ActivityEntityType.LEAVE,
        entityId: leave.leave_id,
        metadata: {
          leaveType: leave.leave_type,
          startDate: leave.start_date.toISOString().split('T')[0],
          endDate: leave.end_date.toISOString().split('T')[0],
          totalDays: leave.total_days,
          reason: leave.reason,
        },
        notifyUserIds: notifyUsers,
      });
    } catch (activityError) {
      console.error('Failed to log leave request activity:', activityError);
    }

    res.status(201).json(successResponse({
      leave,
      calculatedEndDate: end.toISOString().split('T')[0],
      workingDays,
    }, 'Leave request created successfully'));
  } catch (error) {
    console.error('Error creating leave:', error);
    res.status(500).json(errorResponse('Failed to create leave request'));
  }
});

/**
 * PUT /api/leaves/:id
 * Update a leave request
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json(errorResponse('Unauthorized'));
    }

    const {
      leaveType,
      startDate,
      endDate,
      totalDays,
      reason,
    } = req.body;

    // Check if leave exists
    const existingLeave = await prisma.leaves.findUnique({
      where: {
        leave_id: parseInt(id),
      },
    });

    if (!existingLeave) {
      return res.status(404).json(errorResponse('Leave not found'));
    }

    // Only allow user to edit their own leaves if status is pending
    if (existingLeave.user_id !== userId) {
      return res.status(403).json(errorResponse('You can only edit your own leaves'));
    }

    if (existingLeave.status !== 'pending') {
      return res.status(400).json(errorResponse('Cannot edit leave that has been reviewed'));
    }

    // Validate dates if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start > end) {
        return res.status(400).json(errorResponse('Start date cannot be after end date'));
      }
    }

    const updatedLeave = await prisma.leaves.update({
      where: {
        leave_id: parseInt(id),
      },
      data: {
        leave_type: leaveType || existingLeave.leave_type,
        start_date: startDate ? new Date(startDate) : existingLeave.start_date,
        end_date: endDate ? new Date(endDate) : existingLeave.end_date,
        total_days: totalDays || existingLeave.total_days,
        reason: reason || existingLeave.reason,
        updated_at: new Date(),
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    res.json(successResponse(updatedLeave, 'Leave updated successfully'));
  } catch (error) {
    console.error('Error updating leave:', error);
    res.status(500).json(errorResponse('Failed to update leave'));
  }
});

/**
 * DELETE /api/leaves/:id
 * Delete/Cancel a leave request and restore balance
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json(errorResponse('Unauthorized'));
    }

    // Check if leave exists
    const existingLeave = await prisma.leaves.findUnique({
      where: {
        leave_id: parseInt(id),
      },
    });

    if (!existingLeave) {
      return res.status(404).json(errorResponse('Leave not found'));
    }

    // Only allow user to delete their own leaves
    if (existingLeave.user_id !== userId) {
      return res.status(403).json(errorResponse('You can only delete your own leaves'));
    }

    // Get year for balance update
    const year = existingLeave.year || new Date(existingLeave.start_date).getFullYear();

    // Get current balance
    const balance = await prisma.leave_balances.findUnique({
      where: {
        user_id_leave_type_year: {
          user_id: existingLeave.user_id,
          leave_type: existingLeave.leave_type,
          year: year,
        },
      },
    });

    // Can only delete/cancel pending leaves
    if (existingLeave.status !== 'pending') {
      // Instead of deleting, cancel it
      await prisma.leaves.update({
        where: {
          leave_id: parseInt(id),
        },
        data: {
          status: 'cancelled',
          updated_at: new Date(),
        },
      });

      // If balance exists, restore it based on current status (skip for sick leave)
      if (existingLeave.leave_type !== 'sick' && balance) {
        if (existingLeave.status === 'approved') {
          // If it was approved, restore from applied
          await prisma.leave_balances.update({
            where: {
              user_id_leave_type_year: {
                user_id: existingLeave.user_id,
                leave_type: existingLeave.leave_type,
                year: year,
              },
            },
            data: {
              balance: balance.balance + existingLeave.total_days,
              applied: Math.max(0, balance.applied - existingLeave.total_days),
            },
          });
        }
      }

      res.json(successResponse(null, 'Leave cancelled successfully'));
    } else {
      // Delete pending leave
      await prisma.leaves.delete({
        where: {
          leave_id: parseInt(id),
        },
      });

      // Restore balance for pending leave (skip for sick leave)
      if (existingLeave.leave_type !== 'sick' && balance) {
        await prisma.leave_balances.update({
          where: {
            user_id_leave_type_year: {
              user_id: existingLeave.user_id,
              leave_type: existingLeave.leave_type,
              year: year,
            },
          },
          data: {
            balance: balance.balance + existingLeave.total_days,
            pending: Math.max(0, balance.pending - existingLeave.total_days),
          },
        });
      }

      res.json(successResponse(null, 'Leave deleted successfully'));
    }
  } catch (error) {
    console.error('Error deleting leave:', error);
    res.status(500).json(errorResponse('Failed to delete leave'));
  }
});

/**
 * POST /api/leaves/:id/approve
 * Approve a leave request and update balance
 * Restricted to: superadmin, partner, admin, support, it, hr
 */
router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json(errorResponse('Unauthorized'));
    }

    // Role-based access control: only certain roles can approve leaves
    const userRole = req.session.role?.name;
    const canApproveLeaves = ['superadmin', 'partner', 'admin', 'support', 'it', 'hr'].includes(userRole || '');
    
    if (!canApproveLeaves) {
      return res.status(403).json(errorResponse('You do not have permission to approve leave requests'));
    }

    // Get leave details
    const existingLeave = await prisma.leaves.findUnique({
      where: { leave_id: parseInt(id) },
    });

    if (!existingLeave) {
      return res.status(404).json(errorResponse('Leave not found'));
    }

    if (existingLeave.status !== 'pending') {
      return res.status(400).json(errorResponse('Only pending leaves can be approved'));
    }

    // Update leave status
    const leave = await prisma.leaves.update({
      where: {
        leave_id: parseInt(id),
      },
      data: {
        status: 'approved',
        reviewed_by: userId,
        reviewer_comments: comments || null,
        updated_at: new Date(),
      },
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
    });

    // Update balance (decrement pending, increment applied)
    // Update balance (decrement pending, increment applied) - skip for sick leave
    if (existingLeave.leave_type !== 'sick') {
      const year = existingLeave.year || new Date(existingLeave.start_date).getFullYear();
      const balance = await prisma.leave_balances.findUnique({
        where: {
          user_id_leave_type_year: {
            user_id: existingLeave.user_id,
            leave_type: existingLeave.leave_type,
            year: year,
          },
        },
      });

      if (balance) {
        await prisma.leave_balances.update({
          where: {
            user_id_leave_type_year: {
              user_id: existingLeave.user_id,
              leave_type: existingLeave.leave_type,
              year: year,
            },
          },
          data: {
            pending: Math.max(0, balance.pending - existingLeave.total_days),
            applied: balance.applied + existingLeave.total_days,
          },
        });
      }
    }

    // Log activity and notify the leave requester
    try {
      await ActivityService.createActivity({
        actionType: ActivityActionType.LEAVE_APPROVED,
        actorId: userId,
        entityType: ActivityEntityType.LEAVE,
        entityId: leave.leave_id,
        metadata: {
          leaveType: leave.leave_type,
          startDate: leave.start_date.toISOString().split('T')[0],
          endDate: leave.end_date.toISOString().split('T')[0],
          totalDays: leave.total_days,
          comments: comments,
        },
        notifyUserIds: [leave.user_id],
      });
    } catch (activityError) {
      console.error('Failed to log leave approval activity:', activityError);
    }

    res.json(successResponse(leave, 'Leave approved successfully'));
  } catch (error) {
    console.error('Error approving leave:', error);
    res.status(500).json(errorResponse('Failed to approve leave'));
  }
});

/**
 * POST /api/leaves/:id/reject
 * Reject a leave request and restore balance
 * Restricted to: superadmin, partner, admin, support, it, hr
 */
router.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json(errorResponse('Unauthorized'));
    }

    if (!comments) {
      return res.status(400).json(errorResponse('Rejection comments are required'));
    }

    // Role-based access control: only certain roles can reject leaves
    const userRole = req.session.role?.name;
    const canRejectLeaves = ['superadmin', 'partner', 'admin', 'support', 'it', 'hr'].includes(userRole || '');
    
    if (!canRejectLeaves) {
      return res.status(403).json(errorResponse('You do not have permission to reject leave requests'));
    }

    // Get leave details
    const existingLeave = await prisma.leaves.findUnique({
      where: { leave_id: parseInt(id) },
    });

    if (!existingLeave) {
      return res.status(404).json(errorResponse('Leave not found'));
    }

    if (existingLeave.status !== 'pending') {
      return res.status(400).json(errorResponse('Only pending leaves can be rejected'));
    }

    // Update leave status
    const leave = await prisma.leaves.update({
      where: {
        leave_id: parseInt(id),
      },
      data: {
        status: 'rejected',
        reviewed_by: userId,
        reviewer_comments: comments,
        updated_at: new Date(),
      },
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
    });

    // Update balance (restore balance, decrement pending) - skip for sick leave
    if (existingLeave.leave_type !== 'sick') {
      const year = existingLeave.year || new Date(existingLeave.start_date).getFullYear();
      const balance = await prisma.leave_balances.findUnique({
        where: {
          user_id_leave_type_year: {
            user_id: existingLeave.user_id,
            leave_type: existingLeave.leave_type,
            year: year,
          },
        },
      });

      if (balance) {
        await prisma.leave_balances.update({
          where: {
            user_id_leave_type_year: {
              user_id: existingLeave.user_id,
              leave_type: existingLeave.leave_type,
              year: year,
            },
          },
          data: {
            balance: balance.balance + existingLeave.total_days,
            pending: Math.max(0, balance.pending - existingLeave.total_days),
          },
        });
      }
    }

    // Log activity and notify the leave requester
    try {
      await ActivityService.createActivity({
        actionType: ActivityActionType.LEAVE_REJECTED,
        actorId: userId,
        entityType: ActivityEntityType.LEAVE,
        entityId: leave.leave_id,
        metadata: {
          leaveType: leave.leave_type,
          startDate: leave.start_date.toISOString().split('T')[0],
          endDate: leave.end_date.toISOString().split('T')[0],
          totalDays: leave.total_days,
          comments: comments,
        },
        notifyUserIds: [leave.user_id],
      });
    } catch (activityError) {
      console.error('Failed to log leave rejection activity:', activityError);
    }

    res.json(successResponse(leave, 'Leave rejected successfully'));
  } catch (error) {
    console.error('Error rejecting leave:', error);
    res.status(500).json(errorResponse('Failed to reject leave'));
  }
});

/**
 * POST /api/leaves/calculate-working-days
 * Calculate working days between two dates
 */
router.post('/calculate-working-days', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    const { startDate, endDate, location } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json(errorResponse('Start date and end date are required'));
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return res.status(400).json(errorResponse('Start date cannot be after end date'));
    }

    // Get user location if not provided
    let userLocation = location;
    if (!userLocation && userId) {
      const user = await prisma.users.findUnique({
        where: { user_id: userId },
        select: { location: true },
      });
      userLocation = user?.location;
    }

    const year = start.getFullYear();
    const holidays = await getHolidaysByLocation(userLocation || '', year);  // ✅ FIXED
    const workingDays = calculateWorkingDays(start, end, holidays);

    res.json(successResponse({
      startDate: startDate,
      endDate: endDate,
      workingDays: workingDays,
      totalDays: Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    }, 'Working days calculated successfully'));
  } catch (error) {
    console.error('Error calculating working days:', error);
    res.status(500).json(errorResponse('Failed to calculate working days'));
  }
});

/**
 * POST /api/leaves/calculate-end-date
 * Calculate end date based on start date and working days
 */
router.post('/calculate-end-date', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    const { startDate, workingDays, location } = req.body;

    if (!startDate || !workingDays) {
      return res.status(400).json(errorResponse('Start date and working days are required'));
    }

    const start = new Date(startDate);

    // Get user location if not provided
    let userLocation = location;
    if (!userLocation && userId) {
      const user = await prisma.users.findUnique({
        where: { user_id: userId },
        select: { location: true },
      });
      userLocation = user?.location;
    }

    const year = start.getFullYear();
    const holidays = await getHolidaysByLocation(userLocation || '', year);
    const endDate = calculateEndDate(start, parseInt(workingDays), holidays);

    res.json(successResponse({
      startDate: startDate,
      workingDays: parseInt(workingDays),
      endDate: endDate.toISOString().split('T')[0],
    }, 'End date calculated successfully'));
  } catch (error) {
    console.error('Error calculating end date:', error);
    res.status(500).json(errorResponse('Failed to calculate end date'));
  }
});


/**
 * GET /api/leaves/holidays/:location/:year
 * Get holidays for a specific location and year from database
 */
router.get('/holidays/:location/:year', async (req: Request, res: Response) => {
  try {
    const { location, year } = req.params;
    const holidays = await getHolidaysByLocation(location, parseInt(year));

    res.json(successResponse(holidays, 'Holidays fetched successfully'));
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json(errorResponse('Failed to fetch holidays'));
  }
});

/**
 * GET /api/leaves/holidays
 * Get all holidays or filter by location/year via query params
 */
router.get('/holidays', async (req: Request, res: Response) => {
  try {
    const { location, year } = req.query;
    
    const where: any = {};
    if (location) {
      where.location = (location as string).toLowerCase();
    }
    if (year) {
      where.year = parseInt(year as string);
    }

    const holidays = await prisma.holidays.findMany({
      where,
      orderBy: [
        { year: 'asc' },
        { date: 'asc' },
      ],
    });

    const formattedHolidays = holidays.map(h => ({
      id: h.holiday_id,
      location: h.location,
      date: h.date.toISOString().split('T')[0],
      day: h.day,
      occasion: h.occasion,
      year: h.year,
    }));

    res.json(successResponse(formattedHolidays, 'Holidays fetched successfully'));
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json(errorResponse('Failed to fetch holidays'));
  }
});


/**
 * GET /api/leaves/stats/:userId
 * Get leave statistics for a user
 */
router.get('/stats/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const currentYear = new Date().getFullYear();

    // Get all leaves for the current year with error handling for connection pool issues
    let leaves;
    try {
      leaves = await prisma.leaves.findMany({
        where: {
          user_id: parseInt(userId),
          start_date: {
            gte: new Date(`${currentYear}-01-01`),
            lte: new Date(`${currentYear}-12-31`),
          },
        },
      });
    } catch (error: any) {
      // Handle connection pool timeout errors
      if (error?.code === 'P2024' || error?.message?.includes('connection pool') || error?.message?.includes('timeout')) {
        console.error('Connection pool timeout, returning empty stats:', error);
        // Return empty stats instead of crashing
        return res.json(successResponse({
          totalLeaves: 0,
          pendingLeaves: 0,
          approvedLeaves: 0,
          rejectedLeaves: 0,
          totalDaysUsed: 0,
          leavesByType: {
            sick: 0,
            casual: 0,
            earned: 0,
            maternity: 0,
            paternity: 0,
            unpaid: 0,
          },
        }, 'Leave statistics (connection timeout - retrying)'));
      }
      throw error;
    }

    // Calculate statistics
    const stats = {
      totalLeaves: leaves.length,
      pendingLeaves: leaves.filter(l => l.status === 'pending').length,
      approvedLeaves: leaves.filter(l => l.status === 'approved').length,
      rejectedLeaves: leaves.filter(l => l.status === 'rejected').length,
      totalDaysUsed: leaves
        .filter(l => l.status === 'approved')
        .reduce((sum, l) => sum + l.total_days, 0),
      leavesByType: {
        sick: leaves.filter(l => l.leave_type === 'sick' && l.status === 'approved').reduce((sum, l) => sum + l.total_days, 0),
        casual: leaves.filter(l => l.leave_type === 'casual' && l.status === 'approved').reduce((sum, l) => sum + l.total_days, 0),
        earned: leaves.filter(l => l.leave_type === 'earned' && l.status === 'approved').reduce((sum, l) => sum + l.total_days, 0),
        maternity: leaves.filter(l => l.leave_type === 'maternity' && l.status === 'approved').reduce((sum, l) => sum + l.total_days, 0),
        paternity: leaves.filter(l => l.leave_type === 'paternity' && l.status === 'approved').reduce((sum, l) => sum + l.total_days, 0),
        unpaid: leaves.filter(l => l.leave_type === 'unpaid' && l.status === 'approved').reduce((sum, l) => sum + l.total_days, 0),
      },
    };

    res.json(successResponse(stats, 'Leave statistics fetched successfully'));
  } catch (error) {
    console.error('Error fetching leave stats:', error);
    res.status(500).json(errorResponse('Failed to fetch leave statistics'));
  }
});

export default router;

