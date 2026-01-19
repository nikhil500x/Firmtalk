import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import prisma from '../prisma-client';

const router = Router();

// Helper function for success response
const successResponse = (data: unknown, message = 'Success') => ({
  success: true,
  data,
  message,
});

// Helper function for error response
const errorResponse = (message: string) => ({
  success: false,
  message,
});

// Roles that can approve timesheets
const TIMESHEET_APPROVAL_ROLES = ['superadmin', 'partner', 'admin', 'support', 'it', 'accountant'];

// Roles that can approve leaves
const LEAVE_APPROVAL_ROLES = ['superadmin', 'partner', 'admin', 'support', 'it', 'hr'];

/**
 * GET /api/approvals/pending
 * Get counts of pending approvals (leaves only)
 * Only returns items that the current user has permission to approve
 */
router.get('/pending', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.session.userId;
    const userRole = req.session.role?.name?.toLowerCase() || '';

    if (!userId) {
      res.status(401).json(errorResponse('Unauthorized'));
      return;
    }

    // Check if user can approve leaves
    const canApproveLeaves = LEAVE_APPROVAL_ROLES.includes(userRole);

    let pendingLeavesCount = 0;

    // Get pending timesheets count if user has permission
    // NOTE: Timesheets are now auto-approved, so there are no pending timesheets
    // Keeping this for backward compatibility but always returning 0
    // if (canApproveTimesheets) {
    //   pendingTimesheetsCount = 0; // Timesheets are auto-approved on creation
    // }

    // Get pending leaves count if user has permission
    if (canApproveLeaves) {
      pendingLeavesCount = await prisma.leaves.count({
        where: {
          status: 'pending',
        },
      });
    }

    res.json(successResponse({
      leaves: {
        count: pendingLeavesCount,
        canApprove: canApproveLeaves,
      },
      total: pendingLeavesCount,
    }, 'Pending approvals fetched successfully'));
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json(errorResponse('Failed to fetch pending approvals'));
  }
});

/**
 * GET /api/approvals/pending/details
 * Get detailed list of pending approvals (leaves only)
 * Returns first few items for preview
 */
router.get('/pending/details', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.session.userId;
    const userRole = req.session.role?.name?.toLowerCase() || '';
    const limit = parseInt(req.query.limit as string) || 5;

    if (!userId) {
      res.status(401).json(errorResponse('Unauthorized'));
      return;
    }

    const canApproveLeaves = LEAVE_APPROVAL_ROLES.includes(userRole);

    let pendingLeaves: any[] = [];

    // Get pending timesheets if user has permission
    // NOTE: Timesheets are now auto-approved, so there are no pending timesheets
    // Keeping this for backward compatibility but always returning empty array
    // if (canApproveTimesheets) {
    //   pendingTimesheets = []; // Timesheets are auto-approved on creation
    // }

    // Get pending leaves if user has permission
    if (canApproveLeaves) {
      pendingLeaves = await prisma.leaves.findMany({
        where: {
          status: 'pending',
        },
        include: {
          user: {
            select: {
              user_id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        take: limit,
      });
    }

    // Transform leaves for frontend
    const transformedLeaves = pendingLeaves.map(leave => ({
      id: leave.leave_id,
      userId: leave.user_id,
      userName: leave.user?.name || 'Unknown',
      leaveType: leave.leave_type,
      startDate: leave.start_date,
      endDate: leave.end_date,
      totalDays: leave.total_days,
      reason: leave.reason,
      createdAt: leave.created_at,
    }));

    res.json(successResponse({
      leaves: {
        items: transformedLeaves,
        count: pendingLeaves.length,
        canApprove: canApproveLeaves,
      },
    }, 'Pending approval details fetched successfully'));
  } catch (error) {
    console.error('Error fetching pending approval details:', error);
    res.status(500).json(errorResponse('Failed to fetch pending approval details'));
  }
});

export default router;

