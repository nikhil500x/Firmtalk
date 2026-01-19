import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { ConflictCheckerService } from '../services/conflictchecker.service';
import prisma from '../prisma-client';

const router = Router();

/**
 * GET /api/conflicts/verify/:token
 * Verify conflict raise token and return matter details
 * Requires authentication to ensure partner identity
 */
router.get('/verify/:token', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const sessionUserId = req.session.userId;
    const userRole = req.session.role?.name;

    // Verify token
    const verification = await ConflictCheckerService.verifyConflictToken(token);

    if (!verification.valid || !verification.matterId || !verification.partnerId) {
      res.status(400).json({
        success: false,
        message: verification.error || 'Invalid token',
      });
      return;
    }

    // Check if logged-in user matches the partner in token
    if (verification.partnerId !== sessionUserId) {
      res.status(403).json({
        success: false,
        message: 'This conflict raise link was issued to a different user',
      });
      return;
    }

    // Verify user is actually a partner
    if (userRole !== 'partner') {
      res.status(403).json({
        success: false,
        message: 'Only partners can raise conflicts',
      });
      return;
    }

    // Get matter details
    const matter = await prisma.matters.findUnique({
      where: { matter_id: verification.matterId },
      include: {
        client: {
          select: {
            client_id: true,
            client_name: true,
          },
        },
        assigned_lawyer_rel: {
          select: {
            user_id: true,
            name: true,
          },
        },
      },
    });

    if (!matter) {
      res.status(404).json({
        success: false,
        message: 'Matter not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        matterId: matter.matter_id,
        partnerId: verification.partnerId,
        matterTitle: matter.matter_title,
        clientName: matter.client.client_name,
        practiceArea: matter.practice_area,
        opposingParty: matter.opposing_party_name,
        assignedLawyer: matter.assigned_lawyer_rel?.name || 'Unassigned',
        description: matter.description,
        createdAt: matter.created_at,
      },
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify token',
    });
  }
});

/**
 * POST /api/conflicts/raise
 * Raise a conflict on a matter
 * Requires authentication (token validates partner)
 */
router.post('/raise', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, conflict_type, conflict_description, conflict_details, severity } = req.body;

    // Validate required fields
    if (!token || !conflict_type || !conflict_description || !severity) {
      res.status(400).json({
        success: false,
        message: 'Token, conflict type, description, and severity are required',
      });
      return;
    }

    // Verify user role
    const userRole = req.session.role?.name;
    if (userRole !== 'partner') {
      res.status(403).json({
        success: false,
        message: 'Only partners can raise conflicts',
      });
      return;
    }

    // Raise conflict
    const result = await ConflictCheckerService.raiseConflict({
      token,
      conflictType: conflict_type,
      conflictDescription: conflict_description,
      conflictDetails: conflict_details,
      severity,
    });

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Raise conflict error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to raise conflict',
    });
  }
});

/**
 * GET /api/conflicts/matter/:matterId
 * Get all conflicts for a specific matter
 * Requires authentication
 */
router.get('/matter/:matterId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const matterId = parseInt(req.params.matterId);

    if (isNaN(matterId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid matter ID',
      });
      return;
    }

    // Check if matter exists
    const matter = await prisma.matters.findUnique({
      where: { matter_id: matterId },
    });

    if (!matter) {
      res.status(404).json({
        success: false,
        message: 'Matter not found',
      });
      return;
    }

    // Get conflicts
    const conflicts = await ConflictCheckerService.getConflictsByMatter(matterId);

    res.status(200).json({
      success: true,
      data: conflicts,
    });
  } catch (error) {
    console.error('Get conflicts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conflicts',
    });
  }
});

/**
 * PUT /api/conflicts/:conflictId/resolve
 * Resolve a conflict
 * Requires authentication (partner or admin only)
 */
router.put('/:conflictId/resolve', requireAuth, requireRole(['superadmin','partner', 'admin', 'it']), async (req: Request, res: Response): Promise<void> => {
  try {
    const conflictId = parseInt(req.params.conflictId);
    const { resolution_notes } = req.body;

    if (isNaN(conflictId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid conflict ID',
      });
      return;
    }

    const result = await ConflictCheckerService.resolveConflict(
      conflictId,
      req.session.userId!,
      resolution_notes
    );

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Resolve conflict error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve conflict',
    });
  }
});

/**
 * DELETE /api/conflicts/:conflictId
 * Dismiss a conflict
 * Requires authentication (partner or admin only)
 */
router.delete('/:conflictId', requireAuth, requireRole(['partner', 'admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const conflictId = parseInt(req.params.conflictId);

    if (isNaN(conflictId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid conflict ID',
      });
      return;
    }

    const result = await ConflictCheckerService.dismissConflict(
      conflictId,
      req.session.userId!
    );

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Dismiss conflict error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to dismiss conflict',
    });
  }
});

/**
 * GET /api/conflicts/stats
 * Get conflict statistics
 * Requires authentication (partner or admin only)
 */
router.get('/stats', requireAuth, requireRole(['partner', 'admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    // Get conflict counts by status
    const stats = await prisma.matter_conflicts.groupBy({
      by: ['status'],
      _count: {
        conflict_id: true,
      },
    });

    // Get conflicts by severity
    const severityStats = await prisma.matter_conflicts.groupBy({
      by: ['severity'],
      _count: {
        conflict_id: true,
      },
      where: {
        status: { in: ['pending', 'under_review'] },
      },
    });

    // Get total matters with conflicts
    const mattersWithConflicts = await prisma.matters.count({
      where: {
        has_conflict: true,
      },
    });

    res.status(200).json({
      success: true,
      data: {
        byStatus: stats.reduce((acc, item) => {
          acc[item.status] = item._count.conflict_id;
          return acc;
        }, {} as Record<string, number>),
        bySeverity: severityStats.reduce((acc, item) => {
          acc[item.severity] = item._count.conflict_id;
          return acc;
        }, {} as Record<string, number>),
        mattersWithConflicts,
      },
    });
  } catch (error) {
    console.error('Get conflict stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conflict statistics',
    });
  }
});

export default router;

