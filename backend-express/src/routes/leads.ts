import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import prisma from '../prisma-client';

const router = Router();

// Apply role-based access control - CRM users can access
router.use(requireAuth);
router.use(requireRole(['superadmin', 'partner', 'sr-associate', 'associate', 'admin', 'support', 'it']));

/**
 * GET /api/leads
 * Get all leads with optional filters
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      status,
      source,
      assigned_to,
      practice_area_interest,
      search,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (status) {
      where.status = status;
    }
    if (source) {
      where.source = source;
    }
    if (assigned_to) {
      where.assigned_to = parseInt(assigned_to as string);
    }
    if (practice_area_interest) {
      where.practice_area_interest = practice_area_interest;
    }
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { company: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    let leads, total;
    try {
      [leads, total] = await Promise.all([
        prisma.leads.findMany({
          where,
          include: {
            assignee: {
              select: {
                user_id: true,
                name: true,
                email: true,
              },
            },
            creator: {
              select: {
                user_id: true,
                name: true,
                email: true,
              },
            },
            converted_client: {
              select: {
                client_id: true,
                client_name: true,
              },
            },
            converted_contact: {
              select: {
                contact_id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { updated_at: 'desc' },
          skip,
          take: limitNum,
        }),
        prisma.leads.count({ where }),
      ]);
    } catch (error: any) {
      // If table doesn't exist, return empty results
      if (error?.code === 'P2021' || error?.meta?.table?.includes('leads') || error?.message?.includes('leads') || error?.message?.includes('does not exist')) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: {
            total: 0,
            page: pageNum,
            limit: limitNum,
            totalPages: 0,
          },
        });
      }
      throw error;
    }

    res.status(200).json({
      success: true,
      data: leads,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leads',
    });
  }
});

/**
 * GET /api/leads/stats
 * Get lead statistics
 */
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    let total, byStatus, bySource, convertedCount;
    try {
      [total, byStatus, bySource] = await Promise.all([
        prisma.leads.count(),
        prisma.leads.groupBy({
          by: ['status'],
          _count: true,
        }),
        prisma.leads.groupBy({
          by: ['source'],
          _count: true,
        }),
      ]);

      convertedCount = await prisma.leads.count({
        where: {
          converted_to_client_id: {
            not: null,
          },
        },
      });
    } catch (error: any) {
      // If table doesn't exist, return empty stats
      if (error?.code === 'P2021' || error?.meta?.table?.includes('leads') || error?.message?.includes('leads') || error?.message?.includes('does not exist')) {
        return res.status(200).json({
          success: true,
          data: {
            total: 0,
            converted: 0,
            conversionRate: 0,
            byStatus: {},
            bySource: {},
          },
        });
      }
      throw error;
    }

    const conversionRate = total > 0 ? (convertedCount / total) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        total,
        converted: convertedCount,
        conversionRate: Math.round(conversionRate * 10) / 10,
        byStatus: byStatus.reduce((acc, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {} as Record<string, number>),
        bySource: bySource.reduce((acc, item) => {
          acc[item.source || 'unknown'] = item._count;
          return acc;
        }, {} as Record<string, number>),
      },
    });
  } catch (error) {
    console.error('Get leads stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch lead statistics',
    });
  }
});

/**
 * GET /api/leads/:id
 * Get a specific lead
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const leadId = parseInt(req.params.id);

    if (isNaN(leadId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid lead ID',
      });
      return;
    }

    const lead = await prisma.leads.findUnique({
      where: { lead_id: leadId },
      include: {
        assignee: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
        converted_client: {
          select: {
            client_id: true,
            client_name: true,
          },
        },
        converted_contact: {
          select: {
            contact_id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!lead) {
      res.status(404).json({
        success: false,
        message: 'Lead not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch lead',
    });
  }
});

/**
 * POST /api/leads
 * Create a new lead
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      email,
      phone,
      company,
      source,
      status,
      score,
      assigned_to,
      practice_area_interest,
      estimated_value,
      notes,
      tags,
    } = req.body;

    const userId = (req.session as any).userId;

    if (!name || !email) {
      res.status(400).json({
        success: false,
        message: 'Name and email are required',
      });
      return;
    }

    // Validate status
    const validStatuses = ['new', 'contacted', 'qualified', 'converted', 'lost'];
    const leadStatus = status || 'new';
    if (!validStatuses.includes(leadStatus)) {
      res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
      return;
    }

    // Validate score
    const leadScore = score !== undefined ? parseInt(score) : 0;
    if (leadScore < 0 || leadScore > 100) {
      res.status(400).json({
        success: false,
        message: 'Score must be between 0 and 100',
      });
      return;
    }

    const lead = await prisma.leads.create({
      data: {
        name,
        email,
        phone: phone || null,
        company: company || null,
        source: source || null,
        status: leadStatus,
        score: leadScore,
        assigned_to: assigned_to ? parseInt(assigned_to) : null,
        practice_area_interest: practice_area_interest || null,
        estimated_value: estimated_value ? parseFloat(estimated_value) : null,
        notes: notes || null,
        tags: Array.isArray(tags) ? tags : [],
        created_by: userId || null,
      },
      include: {
        assignee: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Lead created successfully',
      data: lead,
    });
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create lead',
    });
  }
});

/**
 * PUT /api/leads/:id
 * Update a lead
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const leadId = parseInt(req.params.id);
    const {
      name,
      email,
      phone,
      company,
      source,
      status,
      score,
      assigned_to,
      practice_area_interest,
      estimated_value,
      notes,
      tags,
    } = req.body;

    if (isNaN(leadId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid lead ID',
      });
      return;
    }

    const existing = await prisma.leads.findUnique({
      where: { lead_id: leadId },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Lead not found',
      });
      return;
    }

    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone || null;
    if (company !== undefined) updateData.company = company || null;
    if (source !== undefined) updateData.source = source || null;
    if (status !== undefined) {
      const validStatuses = ['new', 'contacted', 'qualified', 'converted', 'lost'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        });
        return;
      }
      updateData.status = status;
    }
    if (score !== undefined) {
      const leadScore = parseInt(score);
      if (leadScore < 0 || leadScore > 100) {
        res.status(400).json({
          success: false,
          message: 'Score must be between 0 and 100',
        });
        return;
      }
      updateData.score = leadScore;
    }
    if (assigned_to !== undefined) {
      updateData.assigned_to = assigned_to ? parseInt(assigned_to) : null;
    }
    if (practice_area_interest !== undefined) {
      updateData.practice_area_interest = practice_area_interest || null;
    }
    if (estimated_value !== undefined) {
      updateData.estimated_value = estimated_value ? parseFloat(estimated_value) : null;
    }
    if (notes !== undefined) updateData.notes = notes || null;
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : [];

    const lead = await prisma.leads.update({
      where: { lead_id: leadId },
      data: updateData,
      include: {
        assignee: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
        converted_client: {
          select: {
            client_id: true,
            client_name: true,
          },
        },
        converted_contact: {
          select: {
            contact_id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Lead updated successfully',
      data: lead,
    });
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update lead',
    });
  }
});

/**
 * PUT /api/leads/:id/score
 * Update lead score
 */
router.put('/:id/score', async (req: Request, res: Response): Promise<void> => {
  try {
    const leadId = parseInt(req.params.id);
    const { score } = req.body;

    if (isNaN(leadId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid lead ID',
      });
      return;
    }

    const leadScore = parseInt(score);
    if (isNaN(leadScore) || leadScore < 0 || leadScore > 100) {
      res.status(400).json({
        success: false,
        message: 'Score must be a number between 0 and 100',
      });
      return;
    }

    const lead = await prisma.leads.update({
      where: { lead_id: leadId },
      data: { score: leadScore },
    });

    res.status(200).json({
      success: true,
      message: 'Lead score updated successfully',
      data: lead,
    });
  } catch (error) {
    console.error('Update lead score error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update lead score',
    });
  }
});

/**
 * POST /api/leads/:id/convert
 * Convert lead to client/contact
 */
router.post('/:id/convert', async (req: Request, res: Response): Promise<void> => {
  try {
    const leadId = parseInt(req.params.id);
    const { create_contact, client_data, contact_data } = req.body;

    if (isNaN(leadId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid lead ID',
      });
      return;
    }

    const lead = await prisma.leads.findUnique({
      where: { lead_id: leadId },
    });

    if (!lead) {
      res.status(404).json({
        success: false,
        message: 'Lead not found',
      });
      return;
    }

    if (lead.converted_to_client_id) {
      res.status(400).json({
        success: false,
        message: 'Lead has already been converted',
      });
      return;
    }

    const userId = (req.session as any).userId;

    // Create client
    const client = await prisma.clients.create({
      data: {
        user_id: userId || 1, // Fallback to first user if no session
        client_name: lead.company || lead.name,
        industry: null,
        website_url: null,
        address: null,
        active_status: true,
        referral_source: lead.source || null,
        ...client_data, // Allow override with additional data
      },
    });

    let contact = null;
    if (create_contact !== false) {
      // Create contact
      contact = await prisma.contacts.create({
        data: {
          client_id: client.client_id,
          name: lead.name,
          email: lead.email,
          number: lead.phone || '',
          designation: null,
          is_primary: true,
          created_by: userId || null,
          ...contact_data, // Allow override with additional data
        },
      });
    }

    // Update lead with conversion info
    const updatedLead = await prisma.leads.update({
      where: { lead_id: leadId },
      data: {
        converted_to_client_id: client.client_id,
        converted_to_contact_id: contact?.contact_id || null,
        status: 'converted',
      },
      include: {
        converted_client: {
          select: {
            client_id: true,
            client_name: true,
          },
        },
        converted_contact: {
          select: {
            contact_id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Lead converted successfully',
      data: {
        lead: updatedLead,
        client,
        contact,
      },
    });
  } catch (error) {
    console.error('Convert lead error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to convert lead',
    });
  }
});

/**
 * DELETE /api/leads/:id
 * Delete a lead
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const leadId = parseInt(req.params.id);

    if (isNaN(leadId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid lead ID',
      });
      return;
    }

    const lead = await prisma.leads.findUnique({
      where: { lead_id: leadId },
    });

    if (!lead) {
      res.status(404).json({
        success: false,
        message: 'Lead not found',
      });
      return;
    }

    await prisma.leads.delete({
      where: { lead_id: leadId },
    });

    res.status(200).json({
      success: true,
      message: 'Lead deleted successfully',
    });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete lead',
    });
  }
});

export default router;

