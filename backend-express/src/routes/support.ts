import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import prisma from '../prisma-client';

const router = Router();

/**
 * GET /api/support/tickets
 * Get all support tickets with optional filters
 * Requires authentication
 */
router.get('/tickets', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, priority, status, search, assignedTo, raisedBy } = req.query;

    // Build dynamic where clause based on filters
    const whereClause: any = {};

    if (category && category !== 'all') {
      whereClause.category = category as string;
    }

    if (priority && priority !== 'all') {
      whereClause.priority = priority as string;
    }

    if (status && status !== 'all') {
      whereClause.status = status as string;
    }

    if (assignedTo) {
      whereClause.assigned_to = parseInt(assignedTo as string);
    }

    if (raisedBy) {
      whereClause.raised_by = parseInt(raisedBy as string);
    }

    if (search) {
      whereClause.OR = [
        {
          ticket_number: {
            contains: search as string,
            mode: 'insensitive',
          },
        },
        {
          subject: {
            contains: search as string,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: search as string,
            mode: 'insensitive',
          },
        },
      ];
    }

    // Fetch tickets with related data
    const tickets = await prisma.support_tickets.findMany({
      where: whereClause,
      include: {
        raised_by_user: {
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
        assignee: {
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
        client: {
          select: {
            client_id: true,
            client_name: true,
          },
        },
        matter: {
          select: {
            matter_id: true,
            matter_title: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Transform data to camelCase format
    const formattedTickets = tickets.map((ticket) => ({
      id: ticket.ticket_id,
      ticketNumber: ticket.ticket_number,
      subject: ticket.subject,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      clientId: ticket.client_id,
      clientName: ticket.client?.client_name || null,
      matterId: ticket.matter_id,
      matterTitle: ticket.matter?.matter_title || null,
      raisedBy: {
        id: ticket.raised_by_user.user_id,
        name: ticket.raised_by_user.name,
        email: ticket.raised_by_user.email,
        role: ticket.raised_by_user.role?.name || 'Lawyer',
      },
      assignedTo: ticket.assignee
        ? {
            id: ticket.assignee.user_id,
            name: ticket.assignee.name,
            email: ticket.assignee.email,
            role: ticket.assignee.role?.name || 'Lawyer',
          }
        : null,
      assignedAt: ticket.assigned_at,
      resolvedAt: ticket.resolved_at,
      comments: ticket.comments,
      attachmentUrl: ticket.attachment_url,
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
    }));

    res.status(200).json({
      success: true,
      data: formattedTickets,
    });
  } catch (error) {
    console.error('Get support tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch support tickets',
    });
  }
});

/**
 * GET /api/support/tickets/stats
 * Get ticket statistics and summaries
 * Requires authentication
 */
router.get('/tickets/stats', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.session as any).userId;

    // Get all tickets
    const allTickets = await prisma.support_tickets.findMany();

    // Get user's tickets (raised by user)
    const myTickets = allTickets.filter(t => t.raised_by === userId);

    // Get assigned tickets (assigned to user)
    const assignedTickets = allTickets.filter(t => t.assigned_to === userId);

    // Calculate statistics
    const stats = {
      total: allTickets.length,
      myTickets: myTickets.length,
      assignedToMe: assignedTickets.length,
      byStatus: {
        open: allTickets.filter(t => t.status === 'open').length,
        in_progress: allTickets.filter(t => t.status === 'in_progress').length,
        resolved: allTickets.filter(t => t.status === 'resolved').length,
        closed: allTickets.filter(t => t.status === 'closed').length,
      },
      byPriority: {
        low: allTickets.filter(t => t.priority === 'low').length,
        medium: allTickets.filter(t => t.priority === 'medium').length,
        high: allTickets.filter(t => t.priority === 'high').length,
        urgent: allTickets.filter(t => t.priority === 'urgent').length,
      },
      byCategory: {
        technical: allTickets.filter(t => t.category === 'technical').length,
        hr: allTickets.filter(t => t.category === 'hr').length,
        accounts: allTickets.filter(t => t.category === 'accounts').length,
        general: allTickets.filter(t => t.category === 'general').length,
      },
      unassigned: allTickets.filter(t => !t.assigned_to).length,
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get ticket stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ticket statistics',
    });
  }
});


/**
 * GET /api/support/tickets/:id
 * Get a specific support ticket by ID
 * Requires authentication
 */
router.get('/tickets/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const ticketId = parseInt(req.params.id);

    if (isNaN(ticketId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid ticket ID',
      });
      return;
    }

    const ticket = await prisma.support_tickets.findUnique({
      where: { ticket_id: ticketId },
      include: {
        raised_by_user: {
          select: {
            user_id: true,
            name: true,
            email: true,
            phone: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
        assignee: {
          select: {
            user_id: true,
            name: true,
            email: true,
            phone: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
        client: {
          select: {
            client_id: true,
            client_name: true,
            industry: true,
          },
        },
        matter: {
          select: {
            matter_id: true,
            matter_title: true,
            practice_area: true,
            status: true,
          },
        },
      },
    });

    if (!ticket) {
      res.status(404).json({
        success: false,
        message: 'Support ticket not found',
      });
      return;
    }

    // Format response
    const formattedTicket = {
      id: ticket.ticket_id,
      ticketNumber: ticket.ticket_number,
      subject: ticket.subject,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      client: ticket.client
        ? {
            id: ticket.client.client_id,
            name: ticket.client.client_name,
            industry: ticket.client.industry,
          }
        : null,
      matter: ticket.matter
        ? {
            id: ticket.matter.matter_id,
            title: ticket.matter.matter_title,
            practiceArea: ticket.matter.practice_area,
            status: ticket.matter.status,
          }
        : null,
      raisedBy: {
        id: ticket.raised_by_user.user_id,
        name: ticket.raised_by_user.name,
        email: ticket.raised_by_user.email,
        phone: ticket.raised_by_user.phone,
        role: ticket.raised_by_user.role?.name || 'Lawyer',
      },
      assignedTo: ticket.assignee
        ? {
            id: ticket.assignee.user_id,
            name: ticket.assignee.name,
            email: ticket.assignee.email,
            phone: ticket.assignee.phone,
            role: ticket.assignee.role?.name || 'Lawyer',
          }
        : null,
      assignedAt: ticket.assigned_at,
      resolvedAt: ticket.resolved_at,
      comments: ticket.comments,
      attachmentUrl: ticket.attachment_url,
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
    };

    res.status(200).json({
      success: true,
      data: formattedTicket,
    });
  } catch (error) {
    console.error('Get support ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch support ticket',
    });
  }
});

/**
 * POST /api/support/tickets
 * Create a new support ticket
 * Requires authentication
 */
router.post('/tickets', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      subject,
      description,
      category,
      priority,
      clientId,
      matterId,
      attachmentUrl,
    } = req.body;

    // Validate required fields
    if (!subject || !subject.trim()) {
      res.status(400).json({
        success: false,
        message: 'Subject is required',
      });
      return;
    }

    if (!category) {
      res.status(400).json({
        success: false,
        message: 'Category is required',
      });
      return;
    }

    // Get authenticated user ID
    const userId = (req.session as any).userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    // Validate client if provided
    if (clientId) {
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
    }

    // Validate matter if provided
    if (matterId) {
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
    }

    // Generate ticket number (format: SUPP-YYYY-XXX)
    const year = new Date().getFullYear();
    const lastTicket = await prisma.support_tickets.findFirst({
      where: {
        ticket_number: {
          startsWith: `SUPP-${year}-`,
        },
      },
      orderBy: {
        ticket_number: 'desc',
      },
    });

    let ticketNumber: string;
    if (lastTicket) {
      const lastNumber = parseInt(lastTicket.ticket_number.split('-')[2]);
      ticketNumber = `SUPP-${year}-${String(lastNumber + 1).padStart(3, '0')}`;
    } else {
      ticketNumber = `SUPP-${year}-001`;
    }

    // Create new ticket
    const newTicket = await prisma.support_tickets.create({
      data: {
        ticket_number: ticketNumber,
        subject: subject.trim(),
        description: description?.trim() || null,
        category,
        priority: priority || 'medium',
        status: 'open',
        client_id: clientId || null,
        matter_id: matterId || null,
        raised_by: userId,
        attachment_url: attachmentUrl || null,
      },
      include: {
        raised_by_user: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
        client: {
          select: {
            client_id: true,
            client_name: true,
          },
        },
        matter: {
          select: {
            matter_id: true,
            matter_title: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Support ticket created successfully',
      data: {
        id: newTicket.ticket_id,
        ticketNumber: newTicket.ticket_number,
        subject: newTicket.subject,
        category: newTicket.category,
        priority: newTicket.priority,
        status: newTicket.status,
        raisedBy: newTicket.raised_by_user.name,
      },
    });
  } catch (error) {
    console.error('Create support ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create support ticket',
    });
  }
});

/**
 * PUT /api/support/tickets/:id
 * Update an existing support ticket
 * Requires authentication
 */
router.put('/tickets/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const ticketId = parseInt(req.params.id);

    if (isNaN(ticketId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid ticket ID',
      });
      return;
    }

    const {
      subject,
      description,
      category,
      priority,
      status,
      assignedTo,
      comments,
      attachmentUrl,
    } = req.body;

    // Check if ticket exists
    const existingTicket = await prisma.support_tickets.findUnique({
      where: { ticket_id: ticketId },
    });

    if (!existingTicket) {
      res.status(404).json({
        success: false,
        message: 'Support ticket not found',
      });
      return;
    }

    // Validate assignedTo user if provided
    if (assignedTo) {
      const user = await prisma.users.findUnique({
        where: { user_id: assignedTo },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'Assigned user not found',
        });
        return;
      }
    }

    // Build update data object
    const updateData: any = {
      updated_at: new Date(),
    };

    if (subject) updateData.subject = subject.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (category) updateData.category = category;
    if (priority) updateData.priority = priority;
    if (status) {
      updateData.status = status;
      // Set resolved_at if status is resolved or closed
      if ((status === 'resolved' || status === 'closed') && !existingTicket.resolved_at) {
        updateData.resolved_at = new Date();
      }
    }
    if (assignedTo !== undefined) {
      updateData.assigned_to = assignedTo || null;
      // Set assigned_at if being assigned for first time
      if (assignedTo && !existingTicket.assigned_to) {
        updateData.assigned_at = new Date();
      }
    }
    if (comments !== undefined) updateData.comments = comments?.trim() || null;
    if (attachmentUrl !== undefined) updateData.attachment_url = attachmentUrl || null;

    // Update ticket
    const updatedTicket = await prisma.support_tickets.update({
      where: { ticket_id: ticketId },
      data: updateData,
      include: {
        raised_by_user: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
        assignee: {
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
      message: 'Support ticket updated successfully',
      data: {
        id: updatedTicket.ticket_id,
        ticketNumber: updatedTicket.ticket_number,
        subject: updatedTicket.subject,
        status: updatedTicket.status,
        priority: updatedTicket.priority,
        assignedTo: updatedTicket.assignee?.name || null,
      },
    });
  } catch (error) {
    console.error('Update support ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update support ticket',
    });
  }
});

/**
 * PUT /api/support/tickets/:id/assign
 * Assign a ticket to a user
 * Requires authentication
 */
router.put('/tickets/:id/assign', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const ticketId = parseInt(req.params.id);
    const { userId } = req.body;

    if (isNaN(ticketId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid ticket ID',
      });
      return;
    }

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
      return;
    }

    // Verify ticket exists
    const ticket = await prisma.support_tickets.findUnique({
      where: { ticket_id: ticketId },
    });

    if (!ticket) {
      res.status(404).json({
        success: false,
        message: 'Support ticket not found',
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

    // Assign ticket
    const updatedTicket = await prisma.support_tickets.update({
      where: { ticket_id: ticketId },
      data: {
        assigned_to: userId,
        assigned_at: new Date(),
        status: ticket.status === 'open' ? 'in_progress' : ticket.status,
      },
    });

    res.status(200).json({
      success: true,
      message: `Ticket assigned to ${user.name}`,
      data: {
        ticketId: updatedTicket.ticket_id,
        assignedTo: {
          id: user.user_id,
          name: user.name,
          email: user.email,
        },
      },
    });
  } catch (error) {
    console.error('Assign ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign ticket',
    });
  }
});

/**
 * PUT /api/support/tickets/:id/resolve
 * Mark a ticket as resolved
 * Requires authentication
 */
router.put('/tickets/:id/resolve', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const ticketId = parseInt(req.params.id);
    const { comments } = req.body;

    if (isNaN(ticketId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid ticket ID',
      });
      return;
    }

    const ticket = await prisma.support_tickets.findUnique({
      where: { ticket_id: ticketId },
    });

    if (!ticket) {
      res.status(404).json({
        success: false,
        message: 'Support ticket not found',
      });
      return;
    }

    const updatedTicket = await prisma.support_tickets.update({
      where: { ticket_id: ticketId },
      data: {
        status: 'resolved',
        resolved_at: new Date(),
        comments: comments?.trim() || ticket.comments,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Ticket marked as resolved',
      data: {
        ticketId: updatedTicket.ticket_id,
        ticketNumber: updatedTicket.ticket_number,
        status: updatedTicket.status,
        resolvedAt: updatedTicket.resolved_at,
      },
    });
  } catch (error) {
    console.error('Resolve ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve ticket',
    });
  }
});

/**
 * DELETE /api/support/tickets/:id
 * Delete a support ticket
 * Requires authentication
 */
router.delete('/tickets/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const ticketId = parseInt(req.params.id);

    if (isNaN(ticketId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid ticket ID',
      });
      return;
    }

    const ticket = await prisma.support_tickets.findUnique({
      where: { ticket_id: ticketId },
    });

    if (!ticket) {
      res.status(404).json({
        success: false,
        message: 'Support ticket not found',
      });
      return;
    }

    await prisma.support_tickets.delete({
      where: { ticket_id: ticketId },
    });

    res.status(200).json({
      success: true,
      message: 'Support ticket deleted successfully',
    });
  } catch (error) {
    console.error('Delete support ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete support ticket',
    });
  }
});


export default router;