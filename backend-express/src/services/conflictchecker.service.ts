import prisma from '../prisma-client';
import { TokenService } from './token.service';
import { EmailService } from './email.service';
import { ActivityService, ActivityActionType, ActivityEntityType } from './activity.service';


/**
 * Conflict Checker Service
 * Business logic for matter conflict detection and management
 */

export interface NotifyPartnersParams {
  matterId: number;
  matterTitle: string;
  clientName: string;
  practiceArea: string;
  opposingParty?: string;
  assignedLawyerName: string;
  createdAt: Date;
  description?: string;
  createdBy: number;
}

export interface RaiseConflictParams {
  token: string;
  conflictType: string;
  conflictDescription: string;
  conflictDetails?: string;
  severity: string;
}

export interface ConflictDetails {
  conflict_id: number;
  matter_id: number;
  raised_by: number;
  raiser_name: string;
  conflict_type: string;
  conflict_description: string;
  conflict_details?: string;
  severity: string;
  status: string;
  resolved_by?: number;
  resolver_name?: string;
  resolution_notes?: string;
  raised_at: Date;
  resolved_at?: Date;
}

interface TokenEntry {
  token: string;
  partner_id: number;
  expires_at: string;
  used?: boolean;
}

export class ConflictCheckerService {
  /**
   * Send matter creation emails to all partners
   */
  static async notifyPartnersOfMatterCreation(
    params: NotifyPartnersParams
  ): Promise<{ success: boolean; emailsSent: number; errors: string[] }> {
    try {
      const {
        matterId,
        matterTitle,
        clientName,
        practiceArea,
        opposingParty,
        assignedLawyerName,
        createdAt,
        description,
      } = params;

      // 1. Fetch all active partners
      const partners = await prisma.users.findMany({
        where: {
          active_status: true,
          role: {
            name: 'it',
          },
        },
        select: {
          user_id: true,
          name: true,
          email: true,
        },
      });

      if (partners.length === 0) {
        console.warn('No active partners found to notify');
        return { success: true, emailsSent: 0, errors: [] };
      }

      // 2. Generate tokens for all partners
      const tokenEntries: TokenEntry[] = [];
      const expiryHours = 7 * 24; // 7 days
      const expiresAt = TokenService.getExpirationDate(expiryHours);

      for (const partner of partners) {
        const token = TokenService.generateInvitationToken();
        tokenEntries.push({
          token,
          partner_id: partner.user_id,
          expires_at: expiresAt.toISOString(),
          used: false,
        });
      }

      // 3. Store tokens in matter
      await prisma.matters.update({
        where: { matter_id: matterId },
        data: {
          conflict_raise_tokens: tokenEntries as any,
        },
      });

      // 4. Send email to each partner
      const frontendUrl = process.env.FRONTEND_URL;
      const emailPromises = partners.map(async (partner, index) => {
        try {
          const token = tokenEntries[index].token;
          const raiseConflictLink = `${frontendUrl}/matter/conflict/raise/${token}`;
          const viewMatterLink = `${frontendUrl}/matter/matter-master/${matterId}`;

          await EmailService.sendMatterCreationEmail({
            recipientEmail: partner.email,
            recipientName: partner.name || partner.email,
            matterTitle,
            clientName,
            practiceArea,
            opposingParty,
            assignedLawyerName,
            createdAt: createdAt.toISOString(),
            description,
            raiseConflictLink,
            viewMatterLink,
          });

          return { success: true, partnerId: partner.user_id };
        } catch (error) {
          console.error(`Failed to send email to partner ${partner.email}:`, error);
          return {
            success: false,
            partnerId: partner.user_id,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      const results = await Promise.allSettled(emailPromises);

      const emailsSent = results.filter(
        (r) => r.status === 'fulfilled' && r.value.success
      ).length;

      const errors = results
        .filter((r) => r.status === 'fulfilled' && !r.value.success)
        .map((r) => (r.status === 'fulfilled' ? r.value.error : 'Unknown error'));

      return {
        success: emailsSent > 0,
        emailsSent,
        errors,
      };
    } catch (error) {
      console.error('Failed to notify partners:', error);
      return {
        success: false,
        emailsSent: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Verify conflict raise token
   */
  static async verifyConflictToken(token: string): Promise<{
    valid: boolean;
    matterId?: number;
    partnerId?: number;
    error?: string;
  }> {
    try {
      // Fetch all matters - we'll filter nulls in code
      const matters = await prisma.matters.findMany({
        select: {
          matter_id: true,
          conflict_raise_tokens: true,
        },
      });

      // Find the matter containing this token
      let matchedMatter = null;
      let tokenEntry = null;

      for (const matter of matters) {
        // Skip if conflict_raise_tokens is null or not an array
        if (!matter.conflict_raise_tokens || !Array.isArray(matter.conflict_raise_tokens)) {
          continue;
        }

        const tokens = matter.conflict_raise_tokens as unknown as TokenEntry[];
        const foundToken = tokens.find((t) => t.token === token);

        if (foundToken) {
          matchedMatter = matter;
          tokenEntry = foundToken;
          break;
        }
      }

      if (!matchedMatter || !tokenEntry) {
        return { valid: false, error: 'Invalid token' };
      }

      // Check if expired
      if (TokenService.isTokenExpired(new Date(tokenEntry.expires_at))) {
        return { valid: false, error: 'Token has expired (7 days limit)' };
      }

      // Check if already used
      if (tokenEntry.used) {
        return { valid: false, error: 'This conflict has already been raised' };
      }

      return {
        valid: true,
        matterId: matchedMatter.matter_id,
        partnerId: tokenEntry.partner_id,
      };
    } catch (error) {
      console.error('Token verification error:', error);
      return {
        valid: false,
        error: 'Failed to verify token',
      };
    }
  }

  /**
   * Raise a conflict on a matter
   */
  static async raiseConflict(params: RaiseConflictParams): Promise<{
    success: boolean;
    message: string;
    data?: ConflictDetails;
  }> {
    try {
      const { token, conflictType, conflictDescription, conflictDetails, severity } = params;

      // 1. Verify token
      const verification = await this.verifyConflictToken(token);
      if (!verification.valid || !verification.matterId || !verification.partnerId) {
        return {
          success: false,
          message: verification.error || 'Invalid token',
        };
      }

      // 2. Get matter details for notification
      const matter = await prisma.matters.findUnique({
        where: { matter_id: verification.matterId },
        include: {
          client: { select: { client_name: true } },
          assigned_lawyer_rel: { select: { user_id: true, name: true } },
          creator: { select: { user_id: true } },
        },
      });

      if (!matter) {
        return { success: false, message: 'Matter not found' };
      }

      // 3. Create conflict record
      const conflict = await prisma.matter_conflicts.create({
        data: {
          matter_id: verification.matterId,
          raised_by: verification.partnerId,
          conflict_type: conflictType,
          conflict_description: conflictDescription,
          conflict_details: conflictDetails || null,
          severity,
          status: 'pending',
        },
        include: {
          raiser: {
            select: {
              user_id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // 4. Update matter conflict status
      await prisma.matters.update({
        where: { matter_id: verification.matterId },
        data: {
          has_conflict: true,
          conflict_status: 'pending',
        },
      });

      // 5. Mark token as used
      const tokens = matter.conflict_raise_tokens as TokenEntry[] | null;
      if (tokens) {
        const updatedTokens = tokens.map((t) =>
          t.token === token ? { ...t, used: true } : t
        );
        await prisma.matters.update({
          where: { matter_id: verification.matterId },
          data: { conflict_raise_tokens: updatedTokens as any },
        });
      }

      // 6. Build notification list: creator, assigned lawyer, all partners
      const notifyUserIds: number[] = [];
      if (matter.created_by) notifyUserIds.push(matter.created_by);
      if (matter.assigned_lawyer) notifyUserIds.push(matter.assigned_lawyer);

      // Get all partners
      const partners = await prisma.users.findMany({
        where: {
          active_status: true,
          role: { name: 'it' },
        },
        select: { user_id: true },
      });
      notifyUserIds.push(...partners.map((p) => p.user_id));

      // Remove duplicates
      const uniqueNotifyIds = Array.from(new Set(notifyUserIds));

      // 7. Log activity and notify
      try {
        await ActivityService.createActivity({
          actionType: ActivityActionType.CONFLICT_RAISED,
          actorId: verification.partnerId,
          entityType: ActivityEntityType.MATTER,
          entityId: verification.matterId,
          metadata: {
            matterTitle: matter.matter_title,
            clientName: matter.client.client_name,
            conflictType,
            severity,
            raiserName: conflict.raiser.name || conflict.raiser.email,
          },
          notifyUserIds: uniqueNotifyIds,
        });
      } catch (activityError) {
        console.error('Failed to log conflict activity:', activityError);
        // Don't fail the request
      }

      return {
        success: true,
        message: 'Conflict raised successfully',
        data: {
          conflict_id: conflict.conflict_id,
          matter_id: conflict.matter_id,
          raised_by: conflict.raised_by,
          raiser_name: conflict.raiser.name || conflict.raiser.email,
          conflict_type: conflict.conflict_type,
          conflict_description: conflict.conflict_description,
          conflict_details: conflict.conflict_details || undefined,
          severity: conflict.severity,
          status: conflict.status,
          raised_at: conflict.raised_at,
        },
      };
    } catch (error) {
      console.error('Raise conflict error:', error);
      return {
        success: false,
        message: 'Failed to raise conflict',
      };
    }
  }

  /**
   * Get all conflicts for a matter
   */
  static async getConflictsByMatter(matterId: number): Promise<ConflictDetails[]> {
    try {
      const conflicts = await prisma.matter_conflicts.findMany({
        where: { matter_id: matterId },
        include: {
          raiser: {
            select: {
              name: true,
              email: true,
            },
          },
          resolver: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { raised_at: 'desc' },
      });

      return conflicts.map((c) => ({
        conflict_id: c.conflict_id,
        matter_id: c.matter_id,
        raised_by: c.raised_by,
        raiser_name: c.raiser.name || c.raiser.email,
        conflict_type: c.conflict_type,
        conflict_description: c.conflict_description,
        conflict_details: c.conflict_details || undefined,
        severity: c.severity,
        status: c.status,
        resolved_by: c.resolved_by || undefined,
        resolver_name: c.resolver ? c.resolver.name || c.resolver.email : undefined,
        resolution_notes: c.resolution_notes || undefined,
        raised_at: c.raised_at,
        resolved_at: c.resolved_at || undefined,
      }));
    } catch (error) {
      console.error('Get conflicts error:', error);
      return [];
    }
  }

  /**
   * Resolve a conflict
   */
  static async resolveConflict(
    conflictId: number,
    resolvedBy: number,
    resolutionNotes?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Get conflict details
      const conflict = await prisma.matter_conflicts.findUnique({
        where: { conflict_id: conflictId },
        include: {
          matter: true,
          raiser: { select: { name: true, email: true } },
        },
      });

      if (!conflict) {
        return { success: false, message: 'Conflict not found' };
      }

      if (conflict.status === 'resolved') {
        return { success: false, message: 'Conflict already resolved' };
      }

      // Update conflict
      await prisma.matter_conflicts.update({
        where: { conflict_id: conflictId },
        data: {
          status: 'resolved',
          resolved_by: resolvedBy,
          resolution_notes: resolutionNotes || null,
          resolved_at: new Date(),
        },
      });

      // Check if all conflicts for this matter are resolved
      const remainingConflicts = await prisma.matter_conflicts.count({
        where: {
          matter_id: conflict.matter_id,
          status: { in: ['pending', 'under_review'] },
        },
      });

      // Update matter status if all conflicts resolved
      if (remainingConflicts === 0) {
        await prisma.matters.update({
          where: { matter_id: conflict.matter_id },
          data: {
            conflict_status: 'resolved',
          },
        });
      }

      // Log activity
      try {
        await ActivityService.createActivity({
          actionType: ActivityActionType.CONFLICT_RESOLVED,
          actorId: resolvedBy,
          entityType: ActivityEntityType.MATTER,
          entityId: conflict.matter_id,
          metadata: {
            matterTitle: conflict.matter.matter_title,
            conflictType: conflict.conflict_type,
            raiserName: conflict.raiser.name || conflict.raiser.email,
          },
          notifyUserIds: [conflict.raised_by],
        });
      } catch (activityError) {
        console.error('Failed to log resolution activity:', activityError);
      }

      return {
        success: true,
        message: 'Conflict resolved successfully',
      };
    } catch (error) {
      console.error('Resolve conflict error:', error);
      return {
        success: false,
        message: 'Failed to resolve conflict',
      };
    }
  }

  /**
   * Dismiss a conflict
   */
  static async dismissConflict(
    conflictId: number,
    dismissedBy: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      const conflict = await prisma.matter_conflicts.findUnique({
        where: { conflict_id: conflictId },
        include: {
          matter: true,
          raiser: { select: { name: true } },
        },
      });

      if (!conflict) {
        return { success: false, message: 'Conflict not found' };
      }

      await prisma.matter_conflicts.update({
        where: { conflict_id: conflictId },
        data: { status: 'dismissed' },
      });

      // Check remaining active conflicts
      const remainingConflicts = await prisma.matter_conflicts.count({
        where: {
          matter_id: conflict.matter_id,
          status: { in: ['pending', 'under_review'] },
        },
      });

      if (remainingConflicts === 0) {
        await prisma.matters.update({
          where: { matter_id: conflict.matter_id },
          data: { conflict_status: null, has_conflict: false },
        });
      }

      // Log activity
      try {
        await ActivityService.createActivity({
          actionType: ActivityActionType.CONFLICT_DISMISSED,
          actorId: dismissedBy,
          entityType: ActivityEntityType.MATTER,
          entityId: conflict.matter_id,
          metadata: {
            matterTitle: conflict.matter.matter_title,
            conflictType: conflict.conflict_type,
          },
          notifyUserIds: [conflict.raised_by],
        });
      } catch (activityError) {
        console.error('Failed to log dismissal activity:', activityError);
      }

      return { success: true, message: 'Conflict dismissed successfully' };
    } catch (error) {
      console.error('Dismiss conflict error:', error);
      return { success: false, message: 'Failed to dismiss conflict' };
    }
  }
}

