import { Router, Request, Response } from 'express';
import { requireAuth, requireRole, requirePermission } from '../middleware/auth';
import prisma from '../prisma-client';
import { getRateForMatterAssignment } from './userRateCard';
import { ActivityService, ActivityActionType, ActivityEntityType } from '../services/activity.service';
import { InteractionService } from '../services/interaction.service';
import { ConflictCheckerService } from '../services/conflictchecker.service';
import { CurrencyService } from '../services/currency.service';
import { cursorTo } from 'node:readline';

const router = Router();

// Apply role-based access control for all matter routes
// Matters are accessible to: partner, sr-associate, associate, admin, accountant
// router.use(requireRole(['partner', 'sr-associate', 'associate', 'admin', 'accountant']));

/**
 * Helper function to check if user can close/reopen a matter
 * Permissions: Partners, Admins, Superadmins, and assigned lead lawyer can close/reopen
 */
async function canCloseOrReopenMatter(userId: number, userRole: string | undefined, matter: { assigned_lawyer: number | null }): Promise<boolean> {
  // Partners, admins, and superadmins can always close/reopen
  const roleName = (userRole || '').toLowerCase();
  if (roleName === 'partner' || roleName === 'admin' || roleName === 'superadmin' || roleName === 'super admin') {
    return true;
  }
  
  // Assigned lead lawyer can close/reopen
  if (matter.assigned_lawyer === userId) {
    return true;
  }
  
  return false;
}

/**
 * POST /api/matters
 * Create a new matter
 * Requires authentication
 */
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      client_id,
      assigned_lawyers, // Array of { user_id, service_type, hourly_rate } for multiple leads
      matter_title,
      description,
      matter_type,
      practice_area,
      start_date,
      estimated_deadline,
      status,
      estimated_value,
      billing_rate_type,
      opposing_party_name,
      active_status,
      engagement_letter_url,
      matter_creation_requested_by,
      team_members, // Array of { user_id, role, service_type, hourly_rate }
      currency, // Currency for the matter (default: INR)
    } = req.body;

    // Validate required fields
    if (!client_id || !matter_title || !start_date) {
      res.status(400).json({
        success: false,
        message: 'Client ID, matter title, and start date are required',
      });
      return;
    }

    // Validate currency if provided
    const matterCurrency = currency || 'INR';
    if (!CurrencyService.isSupportedCurrency(matterCurrency)) {
      res.status(400).json({
        success: false,
        message: `Invalid currency. Supported currencies: ${CurrencyService.getSupportedCurrencies().join(', ')}`,
      });
      return;
    }

    // Validate assigned_lawyers array
    if (!assigned_lawyers || !Array.isArray(assigned_lawyers) || assigned_lawyers.length === 0) {
      res.status(400).json({
        success: false,
        message: 'At least one lead is required',
      });
      return;
    }

    // Verify client exists and get client_code
    const client = await prisma.clients.findUnique({
      where: { client_id: parseInt(client_id) },
      select: {
        client_id: true,
        client_code: true,
        client_name: true,
      },
    });

    if (!client) {
      res.status(400).json({
        success: false,
        message: 'Invalid client ID',
      });
      return;
    }

    // Set assigned_lawyer to first lead
    const primaryLeadId = assigned_lawyers[0]?.user_id ? parseInt(assigned_lawyers[0].user_id) : null;

    // Create matter (without matter_code first to get the matter_id)
    const newMatter = await prisma.matters.create({
      data: {
        client_id: parseInt(client_id),
        assigned_lawyer: primaryLeadId,
        matter_title,
        description: description || null,
        matter_type: matter_type || null,
        practice_area: practice_area || null,
        start_date: new Date(start_date),
        estimated_deadline: estimated_deadline ? new Date(estimated_deadline) : null,
        status: status || 'Open',
        estimated_value: estimated_value ? parseFloat(estimated_value) : null,
        billing_rate_type: billing_rate_type || 'Hourly',
        opposing_party_name: opposing_party_name || null,
        active_status: active_status !== undefined ? active_status : true,
        engagement_letter_url: engagement_letter_url || null,
        created_by: req.session.userId || null,
        matter_creation_requested_by: matter_creation_requested_by ? parseInt(matter_creation_requested_by) : null,
        currency: matterCurrency,
      },
      include: {
        client: {
          select: {
            client_id: true,
            client_name: true,
            client_code: true,
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
    });

    // Generate matter_code: client_code-matter_id (both padded to 4 digits)
    // If client_code is not set, use client_id
    const clientCodePart = client.client_code 
      ? client.client_code.padStart(4, '0')
      : client.client_id.toString().padStart(4, '0');
    const matterIdPart = newMatter.matter_id.toString().padStart(4, '0');
    const matterCode = `${clientCodePart}-${matterIdPart}`;

    // Update matter with generated matter_code
    await prisma.matters.update({
      where: { matter_id: newMatter.matter_id },
      data: { matter_code: matterCode },
    });

    // Add assigned lawyers to matter_users with is_lead=true
    const notifyUserIds: number[] = [];
    const addedLeadIds: number[] = []; // Track added leads to avoid duplicates

    for (const lead of assigned_lawyers) {
      if (!lead.user_id) {
        continue; // Skip invalid entries
      }

      const leadId = parseInt(lead.user_id);
      
      // Avoid duplicates
      if (addedLeadIds.includes(leadId)) {
        continue;
      }
      // Verify user exists
      const lawyer = await prisma.users.findUnique({
        where: { user_id: leadId },
      });

      if (!lawyer) {
        continue; // Skip invalid users
      }

      // Track this lead to avoid duplicates
      addedLeadIds.push(leadId);

      // Get rate card in matter currency
      // let finalHourlyRate = lead.hourly_rate ? parseFloat(lead.hourly_rate) : null;
      
      // if (!finalHourlyRate) {
      //   const rateCardConverted = await CurrencyService.getRateCardInMatterCurrency(
      //     leadId,
      //     lead.service_type,
      //     matterCurrency
      //   );
        
      //   // ✅ Handle empty rate cards - suggested_rate will be null for empty rate cards
      //   if (rateCardConverted && rateCardConverted.has_rates) {
      //     finalHourlyRate = rateCardConverted.suggested_rate;
      //   }
      //   // If empty rate card (has_rates = false), finalHourlyRate remains null
      // } else if (matterCurrency !== 'INR') {
      //   // If hourly rate is provided, assume it's in INR and convert to matter currency
      //   const conversion = await CurrencyService.convertAmount(
      //     finalHourlyRate,
      //     'INR',
      //     matterCurrency
      //   );
      //   finalHourlyRate = conversion.convertedAmount;
      // }

      const inputRate = lead.hourly_rate_input
        ? Number(lead.hourly_rate_input)
        : null;

      const conversionRate = lead.conversion_rate ?? 1;

      const hourlyRate = inputRate;


      await prisma.matter_users.create({
        data: {
          matter_id: newMatter.matter_id,
          user_id: leadId,
          role: req.session.role?.name,
          service_type: null,
          hourly_rate: hourlyRate,
          is_lead: true,
        },
      });

      notifyUserIds.push(leadId);
      if (hourlyRate) {
        await prisma.user_rate_card.create({
          data: {
            user_id: leadId,
            matter_id: newMatter.matter_id,
            min_hourly_rate: hourlyRate * 0.5,
            max_hourly_rate: hourlyRate * 1.5,
            currency_conversion_rate: conversionRate,
            effective_date: new Date(),
            is_active: true,
            created_by: req.session.userId!,
          },
        });
      }
    }

    // Add team members if provided
    if (team_members && Array.isArray(team_members)) {
      for (const member of team_members) {
        const memberId = parseInt(member.user_id);

        // Skip if this is one of the assigned leads (already added above)
        if (addedLeadIds.includes(memberId)) {
          continue;
        }

        // Verify user exists
        const user = await prisma.users.findUnique({
          where: { user_id: memberId },
        });

        if (!user) {
          continue; // Skip invalid users
        }

        // Validate service_type is provided
        // if (!member.service_type) {
        //   continue; // Skip members without service_type
        // }

        // Fetch rate from rate card if service_type is provided and convert to matter currency
        // let finalHourlyRate = member.hourly_rate ? parseFloat(member.hourly_rate) : null;
        
        // if (!finalHourlyRate) {
        //   const rateCardConverted = await CurrencyService.getRateCardInMatterCurrency(
        //     memberId,
        //     member.service_type,
        //     matterCurrency
        //   );
          
        //   // ✅ Handle empty rate cards - suggested_rate will be null for empty rate cards
        //   if (rateCardConverted && rateCardConverted.has_rates) {
        //     finalHourlyRate = rateCardConverted.suggested_rate;
        //   }
        //   // If empty rate card (has_rates = false), finalHourlyRate remains null
        // } else if (matterCurrency !== 'INR') {
        //   // If hourly rate is provided, assume it's in INR and convert to matter currency
        //   const conversion = await CurrencyService.convertAmount(
        //     finalHourlyRate,
        //     'INR',
        //     matterCurrency
        //   );
        //   finalHourlyRate = conversion.convertedAmount;
        // }

        const inputRate = member.hourly_rate_input
          ? Number(member.hourly_rate_input)
          : null;

        const conversionRate = member.conversion_rate ?? 1;

        const hourlyRate = inputRate;

        await prisma.matter_users.create({
          data: {
            matter_id: newMatter.matter_id,
            user_id: memberId,
            role: member.role || null,
            service_type: null,
            hourly_rate: hourlyRate,
            is_lead: false,
          },
        });

        notifyUserIds.push(memberId);
        if (hourlyRate) {
          await prisma.user_rate_card.create({
            data: {
              user_id: memberId,
              matter_id: newMatter.matter_id,
              min_hourly_rate: hourlyRate * 0.5,
              max_hourly_rate: hourlyRate * 1.5,
              currency_conversion_rate: conversionRate,
              effective_date: new Date(),
              is_active: true,
              created_by: req.session.userId!,
            },
          });
        }
      }
    }

    // Log activity and notify all added users
    try {
      await ActivityService.createActivity({
        actionType: ActivityActionType.MATTER_CREATED,
        actorId: req.session.userId!,
        entityType: ActivityEntityType.MATTER,
        entityId: newMatter.matter_id,
        metadata: {
          matterTitle: newMatter.matter_title,
          clientName: newMatter.client.client_name,
          assignedLawyer: newMatter.assigned_lawyer_rel?.name || null,
        },
        notifyUserIds: notifyUserIds.length > 0 ? notifyUserIds : undefined,
      });
    } catch (activityError) {
      console.error('Failed to log activity:', activityError);
      // Don't fail the request if activity logging fails
    }

    // Auto-link matter to contacts (background, non-blocking)
    if (req.session.userId) {
      InteractionService.linkMatter(req.session.userId, {
        matter_id: newMatter.matter_id,
        matter_title: newMatter.matter_title,
        client_id: parseInt(client_id),
        practice_area: practice_area || null,
        start_date: new Date(start_date),
      }).catch(error => {
        console.error('Failed to auto-link matter to contacts:', error);
      });
    }

    // Notify all partners about new matter for conflict checking (background, non-blocking)
    // try {
    //   ConflictCheckerService.notifyPartnersOfMatterCreation({
    //     matterId: newMatter.matter_id,
    //     matterTitle: newMatter.matter_title,
    //     clientName: newMatter.client.client_name,
    //     practiceArea: practice_area || 'General',
    //     opposingParty: opposing_party_name,
    //     assignedLawyerName: newMatter.assigned_lawyer_rel?.name || 'Unassigned',
    //     createdAt: newMatter.created_at,
    //     description: description || '',
    //     createdBy: req.session.userId!,
    //   }).catch(error => {
    //     console.error('Failed to notify partners for conflict check:', error);
    //     // Don't fail the request
    //   });
    // } catch (notificationError) {
    //   console.error('Error initiating partner notifications:', notificationError);
    //   // Don't fail the request
    // }

    res.status(201).json({
      success: true,
      message: 'Matter created successfully',
      data: {
        id: newMatter.matter_id,
        title: newMatter.matter_title,
        client: newMatter.client.client_name,
        status: newMatter.status,
        active: newMatter.active_status,
      },
    });
  } catch (error) {
    console.error('Create matter error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create matter',
    });
  }
});

/**
 * PUT /api/matters/:id
 * Update an existing matter
 * Requires authentication
 */
router.put('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const matterId = parseInt(req.params.id);

    if (isNaN(matterId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid matter ID',
      });
      return;
    }

    const {
      client_id,
      assigned_lawyer,
      assigned_lawyer_service_type,
      assigned_lawyer_hourly_rate,
      assigned_lawyers, // Array of { user_id, service_type, hourly_rate } for multiple leads
      matter_title,
      description,
      matter_type,
      practice_area,
      start_date,
      estimated_deadline,
      status,
      estimated_value,
      billing_rate_type,
      opposing_party_name,
      active_status,
      engagement_letter_url,
      matter_creation_requested_by,
      reassign_lead_only, // New flag to indicate this is only a lead reassignment
      status_change_comment, // Optional comment when closing/reopening
    } = req.body;

    console.log('📝 Matter Update Request Body:', {
      matter_title,
      start_date,
      client_id,
      reassign_lead_only,
      hasTitle: !!matter_title,
      hasStartDate: !!start_date,
    });

    // Check if this is a partial update (only specific fields being updated)
    const isPartialUpdate = Object.keys(req.body).length <= 3; // Small payload suggests partial update
    const hasOnlyEngagementLetter = 
      Object.keys(req.body).length === 1 && 
      req.body.engagement_letter_url !== undefined;
    const isStatusChangeOnly = 
      Object.keys(req.body).length <= 2 && 
      (req.body.status !== undefined || req.body.status_change_comment !== undefined);

    // Validate required fields (skip for reassign_lead_only, engagement letter only, or status change only)
    if (!reassign_lead_only && !hasOnlyEngagementLetter && !isStatusChangeOnly) {
      // Only validate if fields are provided (undefined check) and if they are, ensure they're not empty
      if (matter_title !== undefined && (!matter_title || matter_title.trim() === '')) {
        res.status(400).json({
          success: false,
          message: 'Matter title cannot be empty',
        });
        return;
      }
      
      if (start_date !== undefined && !start_date) {
        res.status(400).json({
          success: false,
          message: 'Start date cannot be empty',
        });
        return;
      }
    }

    // Check if matter exists
    const existingMatter = await prisma.matters.findUnique({
      where: { matter_id: matterId },
      include: {
        assigned_lawyer_rel: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!existingMatter) {
      res.status(404).json({
        success: false,
        message: 'Matter not found',
      });
      return;
    }

    // Check for status changes and validate permissions
    const oldStatus = existingMatter.status;
    const newStatus = status !== undefined ? status : existingMatter.status;
    const isStatusChange = oldStatus !== newStatus;
    const isClosing = isStatusChange && newStatus === 'closed';
    const isReopening = isStatusChange && oldStatus === 'closed' && (newStatus === 'active' || newStatus === 'open' || newStatus === 'in-progress');
    
    // Validate status transitions
    if (isStatusChange) {
      // Block reopening 'completed' matters
      if (oldStatus === 'completed' && newStatus !== 'completed') {
        res.status(400).json({
          success: false,
          message: 'Cannot change status of a completed matter',
        });
        return;
      }
      
      // Require comment when closing
      if (isClosing && (!status_change_comment || status_change_comment.trim() === '')) {
        res.status(400).json({
          success: false,
          message: 'Comment is required when closing a matter',
        });
        return;
      }
      
      // Check permissions for closing/reopening
      if (isClosing || isReopening) {
        const userRole = req.session.role?.name;
        const hasPermission = await canCloseOrReopenMatter(
          req.session.userId!,
          userRole,
          existingMatter
        );
        
        if (!hasPermission) {
          res.status(403).json({
            success: false,
            message: 'You do not have permission to close or reopen this matter. Only partners, admins, and the assigned lead lawyer can perform this action.',
          });
          return;
        }
      }
    }

    // Verify client exists if provided
    if (client_id) {
      const client = await prisma.clients.findUnique({
        where: { client_id: parseInt(client_id) },
      });

      if (!client) {
        res.status(400).json({
          success: false,
          message: 'Invalid client ID',
        });
        return;
      }
    }

    // Handle assigned_lawyers array update
    let newAssignedLawyerId: number | null = null;
    let newLawyerWasAlreadyTeamMember = false;

    if (assigned_lawyers && Array.isArray(assigned_lawyers) && assigned_lawyers.length > 0) {
      // Remove all existing leads
      await prisma.matter_users.deleteMany({
        where: {
          matter_id: matterId,
          is_lead: true,
        },
      });

      // Add new leads
      const addedLeadIds: number[] = [];
      for (const lead of assigned_lawyers) {
        if (!lead.user_id) {
          continue;
        }

        const leadId = parseInt(lead.user_id);
        
        // Avoid duplicates
        if (addedLeadIds.includes(leadId)) {
          continue;
        }

        // Verify user exists
        const lawyer = await prisma.users.findUnique({
          where: { user_id: leadId },
          include: { role: true },
        });

        if (!lawyer) {
          continue;
        }

        addedLeadIds.push(leadId);

        // Get rate in matter currency
       const matterCurrency = existingMatter.currency || 'INR';

        let finalHourlyRate =
          lead.hourly_rate !== undefined && lead.hourly_rate !== null
            ? Number(lead.hourly_rate)
            : null;



        await prisma.matter_users.create({
          data: {
            matter_id: matterId,
            user_id: leadId,
            role: lawyer.role?.name || null,
            service_type: null,
            hourly_rate: finalHourlyRate,
            is_lead: true,
          },
        });
      }

      // Set assigned_lawyer to first lead
      newAssignedLawyerId = assigned_lawyers[0]?.user_id ? parseInt(assigned_lawyers[0].user_id) : null;
    } else if (assigned_lawyer !== undefined) {
      // Legacy single assigned_lawyer handling (for backward compatibility)
      if (assigned_lawyer) {
        const lawyer = await prisma.users.findUnique({
          where: { user_id: parseInt(assigned_lawyer) },
          include: { role: true },
        });

        if (!lawyer) {
          res.status(400).json({
            success: false,
            message: 'Invalid assigned lawyer ID',
          });
          return;
        }

        newAssignedLawyerId = parseInt(assigned_lawyer);
        
        // Update is_lead flag
        const oldAssignedLawyerId = existingMatter.assigned_lawyer;
        
        if (oldAssignedLawyerId !== newAssignedLawyerId) {
          // Remove old lead
          if (oldAssignedLawyerId) {
            await prisma.matter_users.deleteMany({
              where: {
                matter_id: matterId,
                user_id: oldAssignedLawyerId,
                is_lead: true,
              },
            });
          }

          // Add new lead
          if (!assigned_lawyer_service_type) {
            res.status(400).json({
              success: false,
              message: 'Service type is required for assigned lawyer',
            });
            return;
          }

          let finalHourlyRate =
          assigned_lawyer_hourly_rate !== undefined && assigned_lawyer_hourly_rate !== null
            ? Number(assigned_lawyer_hourly_rate)
            : null;

          await prisma.matter_users.create({
            data: {
              matter_id: matterId,
              user_id: newAssignedLawyerId,
              role: lawyer.role?.name || null,
              service_type: assigned_lawyer_service_type,
              hourly_rate: finalHourlyRate,
              is_lead: true,
            },
          });
        }
      }
    }

    // Update matter
    // ✅ If reassign_lead_only, only update assigned_lawyer field
    const updateData: any = reassign_lead_only
      ? {
        assigned_lawyer: assigned_lawyer !== undefined ? newAssignedLawyerId : existingMatter.assigned_lawyer,
        updated_at: new Date(),
      }
      : {
        client_id: client_id ? parseInt(client_id) : existingMatter.client_id,
        assigned_lawyer: assigned_lawyer !== undefined ? newAssignedLawyerId : existingMatter.assigned_lawyer,
        matter_title: matter_title !== undefined ? matter_title : existingMatter.matter_title,
        description: description !== undefined ? description : existingMatter.description,
        matter_type: matter_type !== undefined ? matter_type : existingMatter.matter_type,
        practice_area: practice_area !== undefined ? practice_area : existingMatter.practice_area,
        start_date: start_date !== undefined ? new Date(start_date) : existingMatter.start_date,
        estimated_deadline: estimated_deadline !== undefined ? (estimated_deadline ? new Date(estimated_deadline) : null) : existingMatter.estimated_deadline,
        status: status !== undefined ? status : existingMatter.status,
        estimated_value: estimated_value !== undefined ? (estimated_value ? parseFloat(estimated_value) : null) : existingMatter.estimated_value,
        billing_rate_type: billing_rate_type !== undefined ? billing_rate_type : existingMatter.billing_rate_type,
        opposing_party_name: opposing_party_name !== undefined ? opposing_party_name : existingMatter.opposing_party_name,
        active_status: active_status !== undefined ? active_status : existingMatter.active_status,
        engagement_letter_url: engagement_letter_url !== undefined ? engagement_letter_url : existingMatter.engagement_letter_url,
        matter_creation_requested_by: matter_creation_requested_by !== undefined ? (matter_creation_requested_by ? parseInt(matter_creation_requested_by) : null) : existingMatter.matter_creation_requested_by,
        updated_at: new Date(),
      };

    if (!reassign_lead_only && billing_rate_type === 'hourly') {
      const teamMembers = req.body.team_members;

      if (Array.isArray(teamMembers)) {
        for (const member of teamMembers) {
          if (!member.user_id) continue;

          await prisma.matter_users.updateMany({
            where: {
              matter_id: matterId,
              user_id: member.user_id,
              is_lead: false,
            },
            data: {
              hourly_rate:
                member.hourly_rate_input !== undefined
                  ? Number(member.hourly_rate_input)
                  : null,
            },
          });
        }
      }
    }

    const updatedMatter = await prisma.matters.update({
      where: { matter_id: matterId },
      data: updateData,
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
            email: true,
          },
        },
      },
    });

    // Notify new assigned lawyer if they were just added (not already a team member)
    if (newAssignedLawyerId && newAssignedLawyerId !== existingMatter.assigned_lawyer && !newLawyerWasAlreadyTeamMember) {
      try {
        await ActivityService.createActivity({
          actionType: ActivityActionType.TEAM_MEMBER_ADDED,
          actorId: req.session.userId!,
          entityType: ActivityEntityType.MATTER,
          entityId: matterId,
          metadata: {
            matterTitle: updatedMatter.matter_title,
            memberName: updatedMatter.assigned_lawyer_rel?.name || 'Unknown',
            memberRole: 'Lead Lawyer',
            serviceType: null,
          },
          notifyUserIds: [newAssignedLawyerId],
        });
      } catch (activityError) {
        console.error('Failed to log activity for new assigned lawyer:', activityError);
        // Don't fail the request if activity logging fails
      }
    }

    // Log activity and notify team members when status changes to/from 'closed'
    if (isStatusChange && (isClosing || isReopening)) {
      try {
        const now = new Date();
        const metadata: any = {
          matterTitle: updatedMatter.matter_title,
          oldStatus: oldStatus,
          newStatus: newStatus,
        };
        
        if (status_change_comment) {
          metadata.comment = status_change_comment;
        }
        
        if (isClosing) {
          metadata.closedDate = now.toISOString();
        } else if (isReopening) {
          metadata.reopenedDate = now.toISOString();
        }
        
        // Get all team members to notify
        const notifyUserIds = await ActivityService.getMatterNotificationRecipients(
          matterId,
          req.session.userId
        );
        
        await ActivityService.createActivity({
          actionType: ActivityActionType.MATTER_STATUS_CHANGED,
          actorId: req.session.userId!,
          entityType: ActivityEntityType.MATTER,
          entityId: matterId,
          metadata: metadata,
          notifyUserIds: notifyUserIds,
        });
      } catch (activityError) {
        console.error('Failed to log activity for status change:', activityError);
        // Don't fail the request if activity logging fails
      }
    }

    res.status(200).json({
      success: true,
      message: 'Matter updated successfully',
      data: {
        id: updatedMatter.matter_id,
        title: updatedMatter.matter_title,
        client: updatedMatter.client.client_name,
        status: updatedMatter.status,
        active: updatedMatter.active_status,
      },
    });
  } catch (error) {
    console.error('Update matter error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update matter',
    });
  }
});

/**
 * GET /api/matters
 * Get all matters (with optional filters)
 * Requires authentication
 * Role-based filtering: only partner, admin, support, it, hr, and accountant can see all matters
 * Other roles can only see matters they are assigned to
 */
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    // Get query parameters for filtering
    const {
      client_id,
      assigned_lawyer,
      status,
      practice_area,
      active_status,
      search,
      page,
      limit,
    } = req.query;

    const sessionUserId = req.session.userId;
    const userRole = req.session.role?.name;

    // Build where clause based on filters
    const whereClause: any = {};

    // Role-based data filtering: only certain roles can see all matters
    const canSeeAllMatters = ['superadmin', 'partner', 'admin', 'support', 'it', 'hr', 'accountant'].includes(userRole || '');

    if (!canSeeAllMatters) {
      // Other users can only see matters they are assigned to (as assigned_lawyer or in matter_users)
      whereClause.OR = [
        { assigned_lawyer: sessionUserId },
        {
          matter_users: {
            some: {
              user_id: sessionUserId
            }
          }
        }
      ];
    }

    if (client_id) {
      whereClause.client_id = parseInt(client_id as string);
    }

    if (assigned_lawyer) {
      const requestedLawyerId = parseInt(assigned_lawyer as string);
      // Security check: non-privileged users can only query their own matters
      if (!canSeeAllMatters && requestedLawyerId !== sessionUserId) {
        res.status(403).json({
          success: false,
          message: 'You can only view your own matters',
        });
        return;
      }
      whereClause.assigned_lawyer = requestedLawyerId;
    }

    if (status && status !== 'All') {
      whereClause.status = status as string;
    }

    if (practice_area && practice_area !== 'All') {
      whereClause.practice_area = practice_area as string;
    }

    if (active_status === 'Active') {
      whereClause.active_status = true;
    } else if (active_status === 'Inactive') {
      whereClause.active_status = false;
    }

    if (search) {
      whereClause.matter_title = {
        contains: search as string,
        mode: 'insensitive',
      };
    }
    console.log(whereClause);

    // Pagination
    const pageNum = page ? parseInt(page as string) : 1;
    const limitNum = limit ? parseInt(limit as string) : 50;
    const skip = (pageNum - 1) * limitNum;

    // Fetch matters with related data
    const [matters, total] = await Promise.all([
      prisma.matters.findMany({
        where: whereClause,
        skip,
        take: limitNum,
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
          matter_users: {
            include: {
              user: {
                select: {
                  user_id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
          creator: {
            select: {
              user_id: true,
              name: true,
            }
          }
        },
        orderBy: {
          created_at: 'desc',
        },
      }),
      prisma.matters.count({ where: whereClause }),
    ]);

    // Transform data to match frontend interface
    const formattedMatters = matters.map(matter => {
      // Extract leads from matter_users
      const leads = matter.matter_users.filter(mu => mu.is_lead);
      const regularMembers = matter.matter_users.filter(mu => !mu.is_lead);
      
      return {
        id: matter.matter_id,
        matterCode: matter.matter_code,
        clientId: matter.client_id,
        clientName: matter.client.client_name,
        clientIndustry: matter.client.industry,
        assignedLawyer: matter.assigned_lawyer_rel
          ? {
            id: matter.assigned_lawyer_rel.user_id,
            name: matter.assigned_lawyer_rel.name,
            email: matter.assigned_lawyer_rel.email,
          }
          : null,
        assignedLeads: leads.map(lead => ({
          userId: lead.user_id,
          name: lead.user.name,
          email: lead.user.email,
          serviceType: lead.service_type,
          hourlyRate: lead.hourly_rate,
          isLead: true,
        })),
        matterTitle: matter.matter_title,
        description: matter.description,
        matterType: matter.matter_type,
        practiceArea: matter.practice_area,
        startDate: matter.start_date,
        estimatedDeadline: matter.estimated_deadline,
        status: matter.status,
        estimatedValue: matter.estimated_value,
        currency: matter.currency,
        billingRateType: matter.billing_rate_type,
        opposingPartyName: matter.opposing_party_name,
        engagementLetterUrl: matter.engagement_letter_url,
        conflictDetected: matter.has_conflict,
        conflictstatus: matter.conflict_status,
        teamMembers: regularMembers.map(mu => ({
          userId: mu.user_id,
          name: mu.user.name,
          email: mu.user.email,
          role: mu.user.role?.name || mu.role || 'Lawyer',
          serviceType: mu.service_type,
          hourlyRate: mu.hourly_rate,
          assignedAt: mu.assigned_at,
        })),
        active: matter.active_status,
        createdAt: matter.created_at,
        updatedAt: matter.updated_at,
        createdBy: matter.creator?.name || 'Unknown',
      };
    });

    res.status(200).json({
      success: true,
      data: formattedMatters,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get matters error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch matters',
    });
  }
});

/**
 * GET /api/matters/client/:clientId
 * Get all matters for a specific client
 * Requires authentication
 */
router.get('/client/:clientId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = parseInt(req.params.clientId);

    if (isNaN(clientId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid client ID',
      });
      return;
    }

    // Verify client exists
    const client = await prisma.clients.findUnique({
      where: { client_id: clientId },
    });

    if (!client) {
      res.status(404).json({
        success: false,
        message: 'Client not found',
      });
      return;
    }

    // Fetch matters for the client
    const matters = await prisma.matters.findMany({
      where: {
        client_id: clientId,
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
        matter_users: {
          include: {
            user: {
              select: {
                user_id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Transform data to match frontend interface
    const formattedMatters = matters.map(matter => ({
      id: matter.matter_id,
      matterCode: matter.matter_code,
      clientId: matter.client_id,
      clientName: matter.client.client_name,
      clientIndustry: matter.client.industry,
      assignedLawyer: matter.assigned_lawyer_rel
        ? {
          id: matter.assigned_lawyer_rel.user_id,
          name: matter.assigned_lawyer_rel.name,
          email: matter.assigned_lawyer_rel.email,
        }
        : null,
      matterTitle: matter.matter_title,
      title: matter.matter_title, // Alias for frontend compatibility (InvoiceDialog expects 'title')
      description: matter.description,
      matterType: matter.matter_type,
      practiceArea: matter.practice_area,
      startDate: matter.start_date,
      estimatedDeadline: matter.estimated_deadline,
      status: matter.status,
      estimatedValue: matter.estimated_value,
      billingRateType: matter.billing_rate_type,
      opposingPartyName: matter.opposing_party_name,
      engagementLetterUrl: matter.engagement_letter_url,
      teamMembers: matter.matter_users.map(mu => ({
        userId: mu.user_id,
        name: mu.user.name,
        email: mu.user.email,
        role: mu.user.role?.name || mu.role || 'Lawyer',
        serviceType: mu.service_type,
        hourlyRate: mu.hourly_rate,
        assignedAt: mu.assigned_at,
      })),
      active: matter.active_status,
      createdAt: matter.created_at,
      updatedAt: matter.updated_at,
    }));

    res.status(200).json({
      success: true,
      data: formattedMatters,
    });
  } catch (error) {
    console.error('Get matters by client error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch matters for client',
    });
  }
});

/**
 * GET /api/matters/user-statistics
 * Get matter statistics grouped by user (open and closed counts)
 * NOTE: This route must come before /:id to avoid route conflicts
 */
router.get('/user-statistics', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const start = Date.now();
    const { office, role: roleFilter } = req.query;

    const whereClause: any = { active_status: true };

    if (office && office !== 'all') {
      whereClause.location = office;
    }

    if (roleFilter && roleFilter !== 'all') {
      whereClause.role = { name: roleFilter as string };
    }

    const users = await prisma.users.findMany({
      where: whereClause,
      select: {
        user_id: true,
        name: true,
        email: true,
        location: true,
        role: { select: { name: true } }
      }
    });

    const userIds = users.map(u => u.user_id);

    const matters = await prisma.matters.findMany({
      where: {
        active_status: true,
        OR: [
          { assigned_lawyer: { in: userIds } },
          {
            matter_users: {
              some: { user_id: { in: userIds } }
            }
          }
        ]
      },
      select: {
        matter_id: true,
        status: true,
        assigned_lawyer: true,
        matter_users: {
          select: { user_id: true }
        }
      }
    });

    const OPEN_STATUSES = new Set(['active', 'open', 'in-progress']);
    const CLOSED_STATUSES = new Set(['closed', 'completed', 'resolved']);

    const statsMap = new Map<number, { open: number; closed: number }>();

    for (const id of userIds) {
      statsMap.set(id, { open: 0, closed: 0 });
    }

    for (const matter of matters) {
      const status = matter.status?.toLowerCase();
      const isOpen = OPEN_STATUSES.has(status);
      const isClosed = CLOSED_STATUSES.has(status);

      const involvedUsers = new Set<number>();

      if (matter.assigned_lawyer) {
        involvedUsers.add(matter.assigned_lawyer);
      }

      matter.matter_users.forEach(mu => involvedUsers.add(mu.user_id));

      involvedUsers.forEach(userId => {
        const stats = statsMap.get(userId);
        if (!stats) return;

        if (isOpen) stats.open += 1;
        if (isClosed) stats.closed += 1;
      });
    }

    const userStats = users.map(user => {
      const stats = statsMap.get(user.user_id) || { open: 0, closed: 0 };

      return {
        userId: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role?.name || 'Unknown',
        location: user.location || 'Unknown',
        openMatters: stats.open,
        closedMatters: stats.closed,
        totalMatters: stats.open + stats.closed
      };
    });

    userStats.sort((a, b) => b.openMatters - a.openMatters);

    const end = Date.now();
    console.log('User statistics API time (OPTIMIZED):', end - start, 'ms');

    res.status(200).json({
      success: true,
      data: userStats
    });

  } catch (error) {
    console.error('Get user matter statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user matter statistics'
    });
  }
});


/**
 * GET /api/matters/:id
 * Get a specific matter by ID
 * Requires authentication
 */
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const matterId = parseInt(req.params.id);

    if (isNaN(matterId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid matter ID',
      });
      return;
    }

    const matter = await prisma.matters.findUnique({
      where: { matter_id: matterId },
      include: {
        client: {
          include: {
            contacts: true,
            group: true,
          },
        },
        assigned_lawyer_rel: {
          select: {
            user_id: true,
            role: true,
            name: true,
            email: true,
            phone: true,
            practice_area: true,
          },
        },
        matter_users: {
          include: {
            user: {
              select: {
                user_id: true,
                name: true,
                email: true,
                phone: true,
                practice_area: true,
              },
            },
          },
        },
        matter_conflicts: {
          where:{
            matter_id: matterId
          },
          include: {
            raiser: {
              select: {
                user_id: true,
                name: true,
                email: true,
              },
            },
            resolver: {
              select: {
                user_id: true,
                name: true,
                email: true,
              },
            },
            matter:{
              select:{
                matter_id:true
              }
            }
          },
          orderBy: {
            raised_at: 'desc',
          },
        },
        matter_requester: {
          select: {
            user_id: true,
            name: true,
            email: true,
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

    // Find all lead entries (is_lead: true)
    const leadEntries = matter.matter_users.filter(
      (mu: any) => mu.is_lead === true
    );

    // Find the primary assigned lawyer entry (first lead or matching assigned_lawyer field)
    const assignedLawyerId = matter.assigned_lawyer_rel?.user_id;
    const assignedLawyerEntry = leadEntries.find(
      (mu: any) => mu.user_id === assignedLawyerId
    ) || leadEntries[0]; // Fallback to first lead if no match

    // All other team members (not leads)
    const regularTeamMembers = matter.matter_users.filter(
      (mu: any) => !mu.is_lead
    );
    
    // Additional leads (excluding the primary assigned lawyer)
    const additionalLeads = leadEntries.filter(
      (mu: any) => assignedLawyerId ? mu.user_id !== assignedLawyerId : false
    );

    // Format response
    const formattedMatter = {
      id: matter.matter_id,
      matterCode: matter.matter_code,
      client: {
        id: matter.client.client_id,
        name: matter.client.client_name,
        industry: matter.client.industry,
        website: matter.client.website_url,
        address: matter.client.address,
        group: matter.client.group,
        contacts: matter.client.contacts.map((contact: any) => ({
          id: contact.contact_id,
          name: contact.name,
          number: contact.number,
          email: contact.email,
          designation: contact.designation,
          isPrimary: contact.is_primary,
        })),
      },
      assignedLawyer: matter.assigned_lawyer_rel
        ? {
          id: matter.assigned_lawyer_rel.user_id,
          name: matter.assigned_lawyer_rel.name,
          email: matter.assigned_lawyer_rel.email,
          phone: matter.assigned_lawyer_rel.phone,
          practiceArea: matter.assigned_lawyer_rel.practice_area,
          serviceType: assignedLawyerEntry?.service_type || null,
          hourlyRate: assignedLawyerEntry?.hourly_rate || null,
        }
        : null,
      assignedLeads: leadEntries.map((lead: any) => ({
        userId: lead.user_id,
        name: lead.user.name,
        email: lead.user.email,
        phone: lead.user.phone,
        practiceArea: lead.user.practice_area,
        serviceType: lead.service_type,
        hourlyRate: lead.hourly_rate,
        isLead: true,
      })),
      matterTitle: matter.matter_title,
      description: matter.description,
      matterType: matter.matter_type,
      practiceArea: matter.practice_area,
      startDate: matter.start_date,
      estimatedDeadline: matter.estimated_deadline,
      status: matter.status,
      estimatedValue: matter.estimated_value,
      currency: matter.currency,
      billingRateType: matter.billing_rate_type,
      opposingPartyName: matter.opposing_party_name,
      engagementLetterUrl: matter.engagement_letter_url,
      teamMembers: regularTeamMembers.map((mu: any) => ({
        userId: mu.user_id,
        name: mu.user.name,
        email: mu.user.email,
        phone: mu.user.phone,
        practiceArea: mu.user.practice_area,
        userRole: mu.user.role?.name || 'Lawyer',
        matterRole: mu.role,
        serviceType: mu.service_type,
        hourlyRate: mu.hourly_rate,
        assignedAt: mu.assigned_at,
      })),
      hasConflict: matter.has_conflict,
      conflictStatus: matter.conflict_status,
      conflicts: matter.matter_conflicts.map((conflict: any) => ({
        conflictId: conflict.conflict_id,
        matterId: conflict.matter.matter_id,
        raisedBy: conflict.raised_by,
        raiserName: conflict.raiser.name || conflict.raiser.email,
        conflictType: conflict.conflict_type,
        conflictDescription: conflict.conflict_description,
        conflictDetails: conflict.conflict_details,
        severity: conflict.severity,
        status: conflict.status,
        resolvedBy: conflict.resolved_by,
        resolverName: conflict.resolver ? conflict.resolver.name || conflict.resolver.email : null,
        resolutionNotes: conflict.resolution_notes,
        raisedAt: conflict.raised_at,
        resolvedAt: conflict.resolved_at,
      })),
      active: matter.active_status,
      createdAt: matter.created_at,
      updatedAt: matter.updated_at,
      matterCreationRequestedBy: matter.matter_requester ? {
        id: matter.matter_requester.user_id,
        name: matter.matter_requester.name,
        email: matter.matter_requester.email,
      } : null,
    };


    res.status(200).json({
      success: true,
      data: formattedMatter,
    });
  } catch (error) {
    console.error('Get matter error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch matter',
    });
  }
});

/**
 * DELETE /api/matters/:id
 * Delete a matter
 * Requires authentication
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const matterId = parseInt(req.params.id);

    if (isNaN(matterId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid matter ID',
      });
      return;
    }

    // Check if matter exists
    const existingMatter = await prisma.matters.findUnique({
      where: { matter_id: matterId },
    });

    if (!existingMatter) {
      res.status(404).json({
        success: false,
        message: 'Matter not found',
      });
      return;
    }

    // Delete related matter_users first (if any)
    await prisma.matter_users.deleteMany({
      where: { matter_id: matterId },
    });

    // Delete the matter
    await prisma.matters.delete({
      where: { matter_id: matterId },
    });

    res.status(200).json({
      success: true,
      message: 'Matter deleted successfully',
      data: {
        id: matterId,
      },
    });
  } catch (error) {
    console.error('Delete matter error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete matter',
    });
  }
});


/**
 * POST /api/matters/:id/team
 * Add a team member to a matter
 */
router.post('/:id/team', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const matterId = parseInt(req.params.id);
    const { user_id, role, service_type, hourly_rate } = req.body;

    if (isNaN(matterId) || !user_id || !service_type) {
      res.status(400).json({
        success: false,
        message: 'Matter ID, user ID, and service type are required',
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

    // Check if user exists
    const user = await prisma.users.findUnique({
      where: { user_id: parseInt(user_id) },
      include: { role: true },
    });

    if (!user) {
      res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
      return;
    }

    // Get matter currency
    const matterCurrency = matter.currency || 'INR';

    // Fetch rate range from rate card and convert to matter currency
    let finalHourlyRate = hourly_rate ? parseFloat(hourly_rate) : null;
    const rateCardConverted = await CurrencyService.getRateCardInMatterCurrency(
      parseInt(user_id),
      service_type,
      matterCurrency
    );

    // ✅ Handle empty rate cards and rate validation
    if (rateCardConverted !== null) {
      if (rateCardConverted.has_rates) {
        // Rate card has rates - validate if rate is provided
        if (finalHourlyRate) {
          // Convert provided rate from INR to matter currency for comparison
          let rateToCompare = finalHourlyRate;
          if (matterCurrency !== 'INR') {
            const conversion = await CurrencyService.convertAmount(
              finalHourlyRate,
              'INR',
              matterCurrency
            );
            rateToCompare = conversion.convertedAmount;
          }
          
          if (rateToCompare < rateCardConverted.min_rate! || rateToCompare > rateCardConverted.max_rate!) {
            res.status(400).json({
              success: false,
              message: `Hourly rate must be between ${matterCurrency} ${rateCardConverted.min_rate} and ${matterCurrency} ${rateCardConverted.max_rate}`,
            });
            return;
          }
          finalHourlyRate = rateToCompare;
        } else {
          // If no rate provided, use suggested rate (already in matter currency)
          finalHourlyRate = rateCardConverted.suggested_rate;
        }
      } else {
        // Empty rate card - finalHourlyRate will remain null (or use provided rate if any)
        if (finalHourlyRate && matterCurrency !== 'INR') {
          const conversion = await CurrencyService.convertAmount(
            finalHourlyRate,
            'INR',
            matterCurrency
          );
          finalHourlyRate = conversion.convertedAmount;
        }
        // If no hourly_rate provided, finalHourlyRate stays null (empty rate card scenario)
      }
    } else if (!hourly_rate) {
      // Only error if no manual rate is provided as fallback
      res.status(400).json({
        success: false,
        message: `No active rate card found for user ${user.name} with service type ${service_type}`,
      });
      return;
    } else if (matterCurrency !== 'INR') {
      // Convert manually provided rate from INR to matter currency
      if (finalHourlyRate !== null) {
        const conversion = await CurrencyService.convertAmount(
          finalHourlyRate,
          'INR',
          matterCurrency
        );
        finalHourlyRate = conversion.convertedAmount;
      }
    }

    // Add team member with service_type and hourly_rate
    const teamMember = await prisma.matter_users.create({
      data: {
        matter_id: matterId,
        user_id: parseInt(user_id),
        role: role || null,
        service_type: service_type,
        hourly_rate: finalHourlyRate,
        is_lead: false,
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
    });

    // Log activity and notify the added user
    try {
      await ActivityService.createActivity({
        actionType: ActivityActionType.TEAM_MEMBER_ADDED,
        actorId: req.session.userId!,
        entityType: ActivityEntityType.MATTER,
        entityId: matterId,
        metadata: {
          matterTitle: matter.matter_title,
          memberName: user.name || user.email,
          memberRole: role || 'Team Member',
          serviceType: service_type,
        },
        notifyUserIds: [parseInt(user_id)], // Notify the added user
      });
    } catch (activityError) {
      console.error('Failed to log activity:', activityError);
      // Don't fail the request if activity logging fails
    }

    res.status(201).json({
      success: true,
      message: 'Team member added successfully',
      data: teamMember,
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({
        success: false,
        message: 'User is already a team member on this matter with this service type',
      });
      return;
    }
    console.error('Add team member error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add team member',
    });
  }
});

/**
 * PUT /api/matters/:id/team/:userId/:serviceType
 * Update a team member's role, service type, or rate
 * Note: serviceType in URL is the CURRENT service type, service_type in body is the NEW service type (if changing)
 */
router.put('/:id/team/:userId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const matterId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);
    // const currentServiceType = req.params.serviceType;
    const { role, service_type, hourly_rate_input, user_id } = req.body;
    console.log(hourly_rate_input);
    

    if (isNaN(matterId) || isNaN(userId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid matter ID, user ID, or service type',
      });
      return;
    }

    // Get existing team member data
    const existingMember = await prisma.matter_users.findUnique({
      where: {
        matter_id_user_id: {
          matter_id: matterId,
          user_id: userId,
        },
      },
    });

    if (!existingMember) {
      res.status(404).json({
        success: false,
        message: 'Team member not found on this matter with this service type',
      });
      return;
    }

    // Check if we're changing the user_id (replacing the team member)
    if (user_id && parseInt(user_id) !== userId) {
      // Verify new user exists
      const newUser = await prisma.users.findUnique({
        where: { user_id: parseInt(user_id) },
        include: { role: true },
      });

      if (!newUser) {
        res.status(400).json({
          success: false,
          message: 'Invalid new user ID',
        });
        return;
      }

      // const newServiceType = service_type || currentServiceType;

      // Fetch rate range for new user
      let finalHourlyRate =
      hourly_rate_input !== undefined
        ? Number(hourly_rate_input)
        : null;
      // const rateRange = await getRateForMatterAssignment(
      //   parseInt(user_id),
      //   newServiceType
      // );

      // ✅ Handle empty rate cards
      // if (rateRange !== null && rateRange.has_rates && !finalHourlyRate) {
      //   finalHourlyRate = rateRange.suggested_rate;
      // }
      // If empty rate card (has_rates = false), finalHourlyRate remains null

      // Delete old team member
      await prisma.matter_users.delete({
        where: {
          matter_id_user_id: {
            matter_id: matterId,
            user_id: userId,
          },
        },
      });

      // Create new team member
      const newTeamMember = await prisma.matter_users.create({
        data: {
          matter_id: matterId,
          user_id: parseInt(user_id),
          role: role || existingMember.role,
          // service_type: newServiceType,
          hourly_rate: finalHourlyRate,
          is_lead: existingMember.is_lead,
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
      });

      res.status(200).json({
        success: false,
        message: 'Team member replaced successfully',
        data: newTeamMember,
      });
      return;
    }

    // If service_type is being changed, we need to delete and recreate
    // if (service_type !== undefined && service_type !== currentServiceType) {
    //   // Fetch rate range for new service type
    //   let finalHourlyRate =
    //   hourly_rate_input !== undefined
    //     ? Number(hourly_rate_input)
    //     : null;
    //   const rateRange = await getRateForMatterAssignment(userId, service_type);
    //   // ✅ Handle empty rate cards
    //   if (rateRange !== null && rateRange.has_rates && !finalHourlyRate) {
    //     finalHourlyRate = rateRange.suggested_rate;
    //   }
    //   // If empty rate card (has_rates = false), finalHourlyRate remains null

    //   // Delete old entry
    //   await prisma.matter_users.delete({
    //     where: {
    //       matter_id_user_id_service_type: {
    //         matter_id: matterId,
    //         user_id: userId,
    //         service_type: currentServiceType,
    //       },
    //     },
    //   });

    //   // Create new entry with new service type
    //   const teamMember = await prisma.matter_users.create({
    //     data: {
    //       matter_id: matterId,
    //       user_id: userId,
    //       service_type: service_type,
    //       role: role !== undefined ? role : existingMember.role,
    //       hourly_rate: finalHourlyRate,
    //       is_lead: existingMember.is_lead,
    //     },
    //     include: {
    //       user: {
    //         select: {
    //           user_id: true,
    //           name: true,
    //           email: true,
    //         },
    //       },
    //     },
    //   });

    //   res.status(200).json({
    //     success: true,
    //     message: 'Team member updated successfully',
    //     data: teamMember,
    //   });
    //   return;
    // }

    // Just updating role or hourly_rate (service_type stays the same)
    const updateData: any = {};

    if (role !== undefined) {
      updateData.role = role;
    }

    // Allow manual hourly_rate override (if explicitly provided)
    if (hourly_rate_input !== undefined) {
      updateData.hourly_rate =
        hourly_rate_input !== null
          ? Number(hourly_rate_input)
          : null;
    }

    // Update existing team member
    const teamMember = await prisma.matter_users.update({
       where: {
          matter_id_user_id: {
            matter_id: matterId,
            user_id: userId,
          },
        },
        data: updateData,
      include: {
        user: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (hourly_rate_input !== undefined) {
  const rate = hourly_rate_input !== null ? Number(hourly_rate_input) : null;

  if (rate !== null) {
    await prisma.user_rate_card.updateMany({
      where: {
        matter_id: matterId,
        user_id: userId,
        is_active: true,
      },
      data: {
        min_hourly_rate: rate * 0.5,
        max_hourly_rate: rate * 1.5,
        updated_at: new Date(),
      },
    });
  }
}

    res.status(200).json({
      success: true,
      message: 'Team member updated successfully',
      data: teamMember,
    });
  } catch (error) {
    console.error('Update team member error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update team member',
    });
  }
});



/**
 * PUT /api/matters/:matterId/users/:userId/rate
 * Update the hourly_rate for a specific matter_user assignment
 * Used after updating an empty rate card to set matter-specific rate
 * Requires authentication
 */
router.put('/:matterId/users/:userId/rate', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const matterId = parseInt(req.params.matterId);
    const userId = parseInt(req.params.userId);
    const { service_type, hourly_rate } = req.body;

    if (isNaN(matterId) || isNaN(userId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid matter ID or user ID',
      });
      return;
    }

    if (!service_type) {
      res.status(400).json({
        success: false,
        message: 'Service type is required',
      });
      return;
    }

    if (hourly_rate === undefined || hourly_rate === null) {
      res.status(400).json({
        success: false,
        message: 'Hourly rate is required',
      });
      return;
    }

    const parsedRate = parseFloat(hourly_rate);
    if (isNaN(parsedRate) || parsedRate <= 0) {
      res.status(400).json({
        success: false,
        message: 'Hourly rate must be a positive number',
      });
      return;
    }

    // Verify matter_user exists
    const existingMatterUser = await prisma.matter_users.findUnique({
      where: {
        matter_id_user_id: {
          matter_id: matterId,
          user_id: userId,
        },
      },
    });

    if (!existingMatterUser) {
      res.status(404).json({
        success: false,
        message: 'User not found in this matter with the specified service type',
      });
      return;
    }

    // Get matter to fetch currency
    const matter = await prisma.matters.findUnique({
      where: { matter_id: matterId },
      select: { currency: true },
    });

    // Update matter_users.hourly_rate
    const updatedMatterUser = await prisma.matter_users.update({
      where: {
        matter_id_user_id: {
          matter_id: matterId,
          user_id: userId,
        },
      },
      data: {
        hourly_rate: parsedRate,
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
    });
    

    res.status(200).json({
      success: true,
      message: 'Matter hourly rate updated successfully',
      data: updatedMatterUser,
    });
  } catch (error) {
    console.error('Update matter user rate error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update matter hourly rate',
    });
  }
});

/**
 * DELETE /api/matters/:id/team/:userId/:serviceType
 * Remove a team member from a matter
 * Restricted to: partner, admin, support, it, accountant
 */
router.delete('/:id/team/:userId/:serviceType', requireAuth, requirePermission(['mm:delete']), async (req: Request, res: Response): Promise<void> => {
  try {
    const matterId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);
    const serviceType = req.params.serviceType;

    if (isNaN(matterId) || isNaN(userId) || !serviceType) {
      res.status(400).json({
        success: false,
        message: 'Invalid matter ID, user ID, or service type',
      });
      return;
    }

    // Role-based access control: only certain roles can remove team members
    // const userRole = req.session.role?.name;
    // const canRemoveTeamMembers = ['partner', 'admin', 'support', 'it', 'accountant'].includes(userRole || '');

    // if (!canRemoveTeamMembers) {
    //   res.status(403).json({
    //     success: false,
    //     message: 'You do not have permission to remove team members from matters',
    //   });
    //   return;
    // }

    // Check if the team member exists and get matter/user details
    const existingMember = await prisma.matter_users.findUnique({
      where: {
        matter_id_user_id: {
          matter_id: matterId,
          user_id: userId,
        },
      },
      include: {
        user: { select: { name: true, email: true } },
        matter: { select: { matter_title: true } },
      },
    });

    if (!existingMember) {
      res.status(404).json({
        success: false,
        message: 'Team member not found on this matter with this service type',
      });
      return;
    }

    // Delete the team member
    await prisma.matter_users.delete({
      where: {
        matter_id_user_id: {
          matter_id: matterId,
          user_id: userId,
        },
      },
    });

    // Log activity and notify the removed user
    try {
      await ActivityService.createActivity({
        actionType: ActivityActionType.TEAM_MEMBER_REMOVED,
        actorId: req.session.userId!,
        entityType: ActivityEntityType.MATTER,
        entityId: matterId,
        metadata: {
          matterTitle: existingMember.matter.matter_title,
          memberName: existingMember.user.name || existingMember.user.email,
        },
        notifyUserIds: [userId], // Notify the removed user
      });
    } catch (activityError) {
      console.error('Failed to log activity:', activityError);
    }

    res.status(200).json({
      success: true,
      message: 'Team member removed successfully',
    });
  } catch (error) {
    console.error('Delete team member error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove team member',
    });
  }
});

/**
 * GET /api/matters/:id/team/history
 * Get past team members for a matter (from activity logs)
 */
router.get('/:id/team/history', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const matterId = parseInt(req.params.id);

    if (isNaN(matterId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid matter ID',
      });
      return;
    }

    // Get all team-related activities for this matter, including MATTER_CREATED
    const activities = await prisma.user_activities.findMany({
      where: {
        entity_type: ActivityEntityType.MATTER,
        entity_id: matterId,
        action_type: {
          in: [
            ActivityActionType.MATTER_CREATED,
            ActivityActionType.TEAM_MEMBER_ADDED,
            ActivityActionType.TEAM_MEMBER_REMOVED,
          ],
        },
      },
      orderBy: { created_at: 'asc' },
      include: {
        actor: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Get the matter creation date for members without explicit add activity
    const matterCreationActivity = activities.find(
      a => a.action_type === ActivityActionType.MATTER_CREATED
    );
    const matterCreatedDate = matterCreationActivity?.created_at || new Date();
    const matterCreatedBy = matterCreationActivity?.actor.name || 'System';
    const matterCreatedById = matterCreationActivity?.actor.user_id || 0;

    // Parse metadata and build history
    const parsedActivities = activities.map(activity => ({
      ...activity,
      metadata: activity.metadata ? JSON.parse(activity.metadata) : null,
    }));

    // Build past team members by tracking additions and removals
    const teamMemberMap = new Map<string, any>();

    for (const activity of parsedActivities) {
      const metadata = activity.metadata || {};
      const memberName = metadata.memberName || 'Unknown';
      const memberRole = metadata.memberRole || metadata.role || 'Team Member';
      const serviceType = metadata.serviceType || null;

      if (activity.action_type === ActivityActionType.TEAM_MEMBER_ADDED) {
        // Track when member was added
        const key = `${memberName}-${activity.created_at.toISOString()}`;
        teamMemberMap.set(key, {
          memberName,
          role: memberRole,
          serviceType,
          addedDate: activity.created_at,
          addedBy: activity.actor.name,
          addedById: activity.actor.user_id,
          removedDate: null,
          removedBy: null,
          removedById: null,
          status: 'active',
        });
      } else if (activity.action_type === ActivityActionType.TEAM_MEMBER_REMOVED) {
        // Find the most recent active entry for this member and mark as removed
        let foundKey: string | null = null;
        for (const [key, member] of teamMemberMap.entries()) {
          if (member.memberName === memberName && member.status === 'active') {
            foundKey = key;
            break;
          }
        }

        if (foundKey) {
          const member = teamMemberMap.get(foundKey);
          if (member) {
            member.removedDate = activity.created_at;
            member.removedBy = activity.actor.name;
            member.removedById = activity.actor.user_id;
            member.status = 'removed';

            // Calculate duration
            const durationMs = new Date(activity.created_at).getTime() - new Date(member.addedDate).getTime();
            member.durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));
          }
        } else {
          // No matching ADDED activity found - this member was likely added at matter creation
          // Create an entry using matter creation date as the start date
          const key = `${memberName}-orphaned-${activity.created_at.toISOString()}`;
          const durationMs = new Date(activity.created_at).getTime() - new Date(matterCreatedDate).getTime();

          teamMemberMap.set(key, {
            memberName,
            role: memberRole,
            serviceType,
            addedDate: matterCreatedDate,
            addedBy: matterCreatedBy,
            addedById: matterCreatedById,
            removedDate: activity.created_at,
            removedBy: activity.actor.name,
            removedById: activity.actor.user_id,
            status: 'removed',
            durationDays: Math.floor(durationMs / (1000 * 60 * 60 * 24)),
          });
        }
      }
    }

    // Convert map to array and filter only removed members (past members)
    const pastMembers = Array.from(teamMemberMap.values())
      .filter(member => member.status === 'removed')
      .sort((a, b) => new Date(b.removedDate).getTime() - new Date(a.removedDate).getTime());

    res.status(200).json({
      success: true,
      data: pastMembers,
      message: 'Past team members retrieved successfully',
    });
  } catch (error) {
    console.error('Get team history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve team history',
    });
  }
});

export default router;