import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { InvitationService } from '../services/invitation.service';

const router = Router();

/**
 * POST /api/invitations/send
 * Send a new user invitation
 * Requires authentication (Partner/Admin only)
 */
router.post('/send', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, role_id } = req.body;

    // Validate required fields
    if (!email || !role_id) {
      res.status(400).json({
        success: false,
        message: 'Email and role are required',
      });
      return;
    }

    // TODO: Add permission check - only Partners/Admins should be able to invite
    // For now, allow all authenticated users

    // Get inviter details from session
    const invitedBy = req.session.userId!;
    const inviterName = req.session.name!;

    // Create and send invitation
    const result = await InvitationService.createInvitation({
      email: email.toLowerCase().trim(),
      roleId: parseInt(role_id),
      invitedBy,
      inviterName,
      firmName: 'TouchStone', // TODO: Make this configurable
    });

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Send invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send invitation',
    });
  }
});

/**
 * GET /api/invitations
 * Get all invitations (with optional filters)
 * Requires authentication
 */
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, email } = req.query;

    // Get invitations with filters
    const invitations = await InvitationService.getInvitations({
      status: status as string | undefined,
      email: email as string | undefined,
    });

    res.status(200).json({
      success: true,
      data: invitations,
    });
  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invitations',
    });
  }
});

/**
 * POST /api/invitations/:id/resend
 * Resend an invitation email
 * Requires authentication
 */
router.post('/:id/resend', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const invitationId = parseInt(req.params.id);

    if (isNaN(invitationId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid invitation ID',
      });
      return;
    }

    const result = await InvitationService.resendInvitation(invitationId);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Resend invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend invitation',
    });
  }
});

/**
 * DELETE /api/invitations/:id
 * Cancel an invitation
 * Requires authentication
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const invitationId = parseInt(req.params.id);

    if (isNaN(invitationId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid invitation ID',
      });
      return;
    }

    const result = await InvitationService.cancelInvitation(invitationId);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Cancel invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel invitation',
    });
  }
});

export default router;

