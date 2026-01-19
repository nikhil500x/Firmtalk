import prisma from '../prisma-client';
import { TokenService } from './token.service';
import { EmailService } from './email.service';

/**
 * Invitation Service
 * Business logic for user invitation management
 */

export interface CreateInvitationParams {
  email: string;
  roleId: number;
  invitedBy: number;
  inviterName: string;
  firmName?: string;
}

export interface InvitationDetails {
  invitation_id: number;
  email: string;
  role_id: number;
  roleName: string;
  invited_by: number;
  inviterName: string;
  status: string;
  expires_at: Date;
  created_at: Date;
}

export class InvitationService {
  /**
   * Create and send a new user invitation
   */
  static async createInvitation(params: CreateInvitationParams): Promise<{
    success: boolean;
    message: string;
    data?: InvitationDetails;
  }> {
    try {
      const { email, roleId, invitedBy, inviterName, firmName = 'TouchStone' } = params;

      // 1. Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return {
          success: false,
          message: 'Invalid email format',
        };
      }

      // 2. Check if user already exists
      const existingUser = await prisma.users.findUnique({
        where: { email },
      });

      if (existingUser) {
        return {
          success: false,
          message: 'A user with this email already exists',
        };
      }

      // 3. Check for pending invitations
      const pendingInvitation = await prisma.user_invitations.findFirst({
        where: {
          email,
          status: 'pending',
        },
      });

      if (pendingInvitation) {
        return {
          success: false,
          message: 'A pending invitation already exists for this email',
        };
      }

      // 4. Verify role exists
      const role = await prisma.roles.findUnique({
        where: { role_id: roleId },
      });

      if (!role) {
        return {
          success: false,
          message: 'Invalid role ID',
        };
      }

      // 5. Verify inviter exists
      const inviter = await prisma.users.findUnique({
        where: { user_id: invitedBy },
      });

      if (!inviter) {
        return {
          success: false,
          message: 'Invalid inviter ID',
        };
      }

      // 6. Generate secure token
      const token = TokenService.generateInvitationToken();
      
      // 7. Calculate expiration
      const expiryHours = parseInt(process.env.INVITATION_EXPIRY_HOURS || '48');
      const expiresAt = TokenService.getExpirationDate(expiryHours);

      // 8. Create invitation in database
      const invitation = await prisma.user_invitations.create({
        data: {
          email,
          role_id: roleId,
          invited_by: invitedBy,
          token,
          status: 'pending',
          expires_at: expiresAt,
        },
        include: {
          role: true,
          inviter: true,
        },
      });

      // 9. Generate invitation link
      const frontendUrl = process.env.FRONTEND_URL;
      const invitationLink = `${frontendUrl}/onboarding/${token}`;

      // 10. Send invitation email
      const emailResult = await EmailService.sendInvitationEmail({
        recipientEmail: email,
        inviterName,
        firmName,
        roleName: role.name,
        invitationLink,
        expiresInHours: expiryHours,
      });

      if (!emailResult.success) {
        // In development, log the error but don't rollback
        console.warn(`Warning: Invitation email failed to send for ${email}: ${emailResult.error}`);
        // In production, you might want to rollback:
        // await prisma.user_invitations.delete({
        //   where: { invitation_id: invitation.invitation_id },
        // });
        // return { success: false, message: `Failed to send invitation email: ${emailResult.error}` };
      }

      // 11. Return success
      return {
        success: true,
        message: 'Invitation sent successfully',
        data: {
          invitation_id: invitation.invitation_id,
          email: invitation.email,
          role_id: invitation.role_id,
          roleName: role.name,
          invited_by: invitation.invited_by,
          inviterName: inviter.name ?? 'Unknown',
          status: invitation.status,
          expires_at: invitation.expires_at,
          created_at: invitation.created_at,
        },
      };
    } catch (error) {
      console.error('Create invitation error:', error);
      return {
        success: false,
        message: 'Failed to create invitation',
      };
    }
  }

  /**
   * Verify invitation token and get details
   */
  static async verifyInvitation(token: string): Promise<{
    success: boolean;
    message: string;
    data?: {
      invitation_id: number;
      email: string;
      role_id: number;
      roleName: string;
    };
  }> {
    try {
      // Find invitation by token
      const invitation = await prisma.user_invitations.findUnique({
        where: { token },
        include: {
          role: true,
        },
      });

      if (!invitation) {
        return {
          success: false,
          message: 'Invalid invitation token',
        };
      }

      // Check if already accepted
      if (invitation.status === 'accepted') {
        return {
          success: false,
          message: 'This invitation has already been accepted',
        };
      }

      // Check if expired
      if (TokenService.isTokenExpired(invitation.expires_at)) {
        // Update status to expired
        await prisma.user_invitations.update({
          where: { invitation_id: invitation.invitation_id },
          data: { status: 'expired' },
        });

        return {
          success: false,
          message: 'This invitation has expired',
        };
      }

      return {
        success: true,
        message: 'Invitation is valid',
        data: {
          invitation_id: invitation.invitation_id,
          email: invitation.email,
          role_id: invitation.role_id,
          roleName: invitation.role.name,
        },
      };
    } catch (error) {
      console.error('Verify invitation error:', error);
      return {
        success: false,
        message: 'Failed to verify invitation',
      };
    }
  }

  /**
   * Get all invitations (with optional filters)
   */
  static async getInvitations(filters?: {
    status?: string;
    email?: string;
  }): Promise<InvitationDetails[]> {
    try {
      const whereClause: any = {};

      if (filters?.status) {
        whereClause.status = filters.status;
      }

      if (filters?.email) {
        whereClause.email = {
          contains: filters.email,
          mode: 'insensitive',
        };
      }

      const invitations = await prisma.user_invitations.findMany({
        where: whereClause,
        include: {
          role: true,
          inviter: true,
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      return invitations.map(inv => ({
        invitation_id: inv.invitation_id,
        email: inv.email,
        role_id: inv.role_id,
        roleName: inv.role.name,
        invited_by: inv.invited_by,
        inviterName: inv.inviter.name ?? 'Unknown',
        status: inv.status,
        expires_at: inv.expires_at,
        created_at: inv.created_at,
      }));
    } catch (error) {
      console.error('Get invitations error:', error);
      return [];
    }
  }

  /**
   * Resend an invitation email
   */
  static async resendInvitation(invitationId: number): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      // Get invitation
      const invitation = await prisma.user_invitations.findUnique({
        where: { invitation_id: invitationId },
        include: {
          role: true,
          inviter: true,
        },
      });

      if (!invitation) {
        return {
          success: false,
          message: 'Invitation not found',
        };
      }

      if (invitation.status === 'accepted') {
        return {
          success: false,
          message: 'Cannot resend an accepted invitation',
        };
      }

      // Generate new token and expiration
      const newToken = TokenService.generateInvitationToken();
      const expiryHours = parseInt(process.env.INVITATION_EXPIRY_HOURS || '48');
      const newExpiresAt = TokenService.getExpirationDate(expiryHours);

      // Update invitation
      await prisma.user_invitations.update({
        where: { invitation_id: invitationId },
        data: {
          token: newToken,
          expires_at: newExpiresAt,
          status: 'pending',
        },
      });

      // Generate new invitation link
      const frontendUrl = process.env.FRONTEND_URL;
      const invitationLink = `${frontendUrl}/onboarding/${newToken}`;

      // Resend email
      const emailResult = await EmailService.sendInvitationEmail({
        recipientEmail: invitation.email,
        inviterName: invitation.inviter.name ?? 'Unknown',
        firmName: 'TouchStone',
        roleName: invitation.role.name,
        invitationLink,
        expiresInHours: expiryHours,
      });

      if (!emailResult.success) {
        // In development, log the error but don't fail the invitation
        console.warn(`Warning: Invitation email failed to send for ${invitation.email}: ${emailResult.error}`);
        // In production, you might want to fail:
        // return { success: false, message: `Failed to send email: ${emailResult.error}` };
      }

      return {
        success: true,
        message: 'Invitation resent successfully',
      };
    } catch (error) {
      console.error('Resend invitation error:', error);
      return {
        success: false,
        message: 'Failed to resend invitation',
      };
    }
  }

  /**
   * Cancel an invitation
   */
  static async cancelInvitation(invitationId: number): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const invitation = await prisma.user_invitations.findUnique({
        where: { invitation_id: invitationId },
      });

      if (!invitation) {
        return {
          success: false,
          message: 'Invitation not found',
        };
      }

      if (invitation.status === 'accepted') {
        return {
          success: false,
          message: 'Cannot cancel an accepted invitation',
        };
      }

      await prisma.user_invitations.delete({
        where: { invitation_id: invitationId },
      });

      return {
        success: true,
        message: 'Invitation cancelled successfully',
      };
    } catch (error) {
      console.error('Cancel invitation error:', error);
      return {
        success: false,
        message: 'Failed to cancel invitation',
      };
    }
  }
}

