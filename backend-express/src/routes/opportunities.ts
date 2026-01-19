import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import prisma from '../prisma-client';

const router = Router();

// Apply role-based access control - CRM users can access
router.use(requireAuth);
router.use(requireRole(['superadmin', 'partner', 'sr-associate', 'associate', 'admin', 'support', 'it']));

/**
 * GET /api/opportunities
 * Get all opportunities with optional filters
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      stage,
      practice_area,
      assigned_to,
      client_id,
      contact_id,
      search,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (stage) {
      where.stage = stage;
    }
    if (practice_area) {
      where.practice_area = practice_area;
    }
    if (assigned_to) {
      where.assigned_to = parseInt(assigned_to as string);
    }
    if (client_id) {
      where.client_id = parseInt(client_id as string);
    }
    if (contact_id) {
      where.contact_id = parseInt(contact_id as string);
    }
    if (search) {
      where.OR = [
        { opportunity_name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    let opportunities, total;
    try {
      [opportunities, total] = await Promise.all([
        prisma.opportunities.findMany({
          where,
          include: {
            client: {
              select: {
                client_id: true,
                client_name: true,
              },
            },
            contact: {
              select: {
                contact_id: true,
                name: true,
                email: true,
              },
            },
            matter: {
              select: {
                matter_id: true,
                matter_title: true,
              },
            },
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
          orderBy: { updated_at: 'desc' },
          skip,
          take: limitNum,
        }),
        prisma.opportunities.count({ where }),
      ]);
    } catch (error: any) {
      // If table doesn't exist, return empty results
      if (error?.code === 'P2021' || error?.meta?.table?.includes('opportunities') || error?.message?.includes('opportunities') || error?.message?.includes('does not exist')) {
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
      data: opportunities,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get opportunities error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch opportunities',
    });
  }
});

/**
 * GET /api/opportunities/pipeline
 * Get pipeline data grouped by stage for Kanban view
 */
router.get('/pipeline', async (req: Request, res: Response): Promise<void> => {
  try {
    const { practice_area, assigned_to } = req.query;

    const where: any = {};
    if (practice_area) {
      where.practice_area = practice_area;
    }
    if (assigned_to) {
      where.assigned_to = parseInt(assigned_to as string);
    }

    let opportunities;
    try {
      opportunities = await prisma.opportunities.findMany({
        where,
        include: {
          client: {
            select: {
              client_id: true,
              client_name: true,
            },
          },
          contact: {
            select: {
              contact_id: true,
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
        orderBy: { updated_at: 'desc' },
      });
    } catch (error: any) {
      // If table doesn't exist, return empty pipeline
      if (error?.code === 'P2021' || error?.meta?.table?.includes('opportunities') || error?.message?.includes('opportunities') || error?.message?.includes('does not exist')) {
        return res.status(200).json({
          success: true,
          data: {
            pipeline: {
              prospect: [],
              consultation: [],
              proposal: [],
              negotiation: [],
              won: [],
              lost: [],
            },
            totalOpportunities: 0,
            pipelineValue: 0,
            stages: ['prospect', 'consultation', 'proposal', 'negotiation', 'won', 'lost'],
          },
        });
      }
      throw error;
    }

    // Group by stage
    const stages = ['prospect', 'consultation', 'proposal', 'negotiation', 'won', 'lost'];
    const pipeline: Record<string, any[]> = {};
    
    stages.forEach(stage => {
      pipeline[stage] = opportunities.filter(opp => opp.stage === stage);
    });

    // Calculate pipeline value
    const pipelineValue = opportunities
      .filter(opp => !['won', 'lost'].includes(opp.stage))
      .reduce((sum, opp) => {
        const value = opp.estimated_value || 0;
        const probability = opp.probability / 100;
        return sum + (value * probability);
      }, 0);

    res.status(200).json({
      success: true,
      data: {
        pipeline,
        totalOpportunities: opportunities.length,
        pipelineValue,
        stages,
      },
    });
  } catch (error) {
    console.error('Get pipeline error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pipeline data',
    });
  }
});

/**
 * GET /api/opportunities/stats
 * Get pipeline statistics
 */
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    let total, byStage, byPracticeArea, activeOpportunities;
    try {
      [total, byStage, byPracticeArea] = await Promise.all([
        prisma.opportunities.count(),
        prisma.opportunities.groupBy({
          by: ['stage'],
          _count: true,
          _sum: {
            estimated_value: true,
          },
        }),
        prisma.opportunities.groupBy({
          by: ['practice_area'],
          _count: true,
          _sum: {
            estimated_value: true,
          },
        }),
      ]);

      activeOpportunities = await prisma.opportunities.findMany({
        where: {
          stage: {
            notIn: ['won', 'lost'],
          },
        },
      });
    } catch (error: any) {
      // If table doesn't exist, return empty stats
      if (error?.code === 'P2021' || error?.meta?.table?.includes('opportunities') || error?.message?.includes('opportunities') || error?.message?.includes('does not exist')) {
        return res.status(200).json({
          success: true,
          data: {
            total: 0,
            active: 0,
            won: 0,
            lost: 0,
            winRate: 0,
            pipelineValue: 0,
            byStage: {},
            byPracticeArea: {},
          },
        });
      }
      throw error;
    }

    const pipelineValue = activeOpportunities.reduce((sum, opp) => {
      const value = opp.estimated_value || 0;
      const probability = opp.probability / 100;
      return sum + (value * probability);
    }, 0);

    const wonCount = byStage.find(s => s.stage === 'won')?._count || 0;
    const lostCount = byStage.find(s => s.stage === 'lost')?._count || 0;
    const winRate = wonCount + lostCount > 0 
      ? (wonCount / (wonCount + lostCount)) * 100 
      : 0;

    res.status(200).json({
      success: true,
      data: {
        total,
        active: activeOpportunities.length,
        won: wonCount,
        lost: lostCount,
        winRate: Math.round(winRate * 10) / 10,
        pipelineValue,
        byStage: byStage.reduce((acc, item) => {
          acc[item.stage] = {
            count: item._count,
            totalValue: item._sum.estimated_value || 0,
          };
          return acc;
        }, {} as Record<string, any>),
        byPracticeArea: byPracticeArea.reduce((acc, item) => {
          acc[item.practice_area || 'unknown'] = {
            count: item._count,
            totalValue: item._sum.estimated_value || 0,
          };
          return acc;
        }, {} as Record<string, any>),
      },
    });
  } catch (error) {
    console.error('Get opportunities stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
    });
  }
});

/**
 * GET /api/opportunities/:id
 * Get a specific opportunity
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const opportunityId = parseInt(req.params.id);

    if (isNaN(opportunityId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid opportunity ID',
      });
      return;
    }

    const opportunity = await prisma.opportunities.findUnique({
      where: { opportunity_id: opportunityId },
      include: {
        client: {
          select: {
            client_id: true,
            client_name: true,
            industry: true,
          },
        },
        contact: {
          select: {
            contact_id: true,
            name: true,
            email: true,
            phone: true,
            designation: true,
          },
        },
        matter: {
          select: {
            matter_id: true,
            matter_title: true,
            status: true,
          },
        },
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

    if (!opportunity) {
      res.status(404).json({
        success: false,
        message: 'Opportunity not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: opportunity,
    });
  } catch (error) {
    console.error('Get opportunity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch opportunity',
    });
  }
});

/**
 * POST /api/opportunities
 * Create a new opportunity
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      opportunity_name,
      description,
      practice_area,
      stage,
      probability,
      estimated_value,
      expected_close_date,
      source,
      client_id,
      contact_id,
      assigned_to,
    } = req.body;

    const userId = (req.session as any).userId;

    if (!opportunity_name) {
      res.status(400).json({
        success: false,
        message: 'Opportunity name is required',
      });
      return;
    }

    // Validate stage
    const validStages = ['prospect', 'consultation', 'proposal', 'negotiation', 'won', 'lost'];
    const oppStage = stage || 'prospect';
    if (!validStages.includes(oppStage)) {
      res.status(400).json({
        success: false,
        message: `Invalid stage. Must be one of: ${validStages.join(', ')}`,
      });
      return;
    }

    // Validate probability
    const prob = probability !== undefined ? parseInt(probability) : 0;
    if (prob < 0 || prob > 100) {
      res.status(400).json({
        success: false,
        message: 'Probability must be between 0 and 100',
      });
      return;
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

    // Verify contact exists if provided
    if (contact_id) {
      const contact = await prisma.contacts.findUnique({
        where: { contact_id: parseInt(contact_id) },
      });
      if (!contact) {
        res.status(400).json({
          success: false,
          message: 'Invalid contact ID',
        });
        return;
      }
    }

    const opportunity = await prisma.opportunities.create({
      data: {
        opportunity_name,
        description: description || null,
        practice_area: practice_area || null,
        stage: oppStage,
        probability: prob,
        estimated_value: estimated_value ? parseFloat(estimated_value) : null,
        expected_close_date: expected_close_date ? new Date(expected_close_date) : null,
        source: source || null,
        client_id: client_id ? parseInt(client_id) : null,
        contact_id: contact_id ? parseInt(contact_id) : null,
        assigned_to: assigned_to ? parseInt(assigned_to) : null,
        created_by: userId || null,
      },
      include: {
        client: {
          select: {
            client_id: true,
            client_name: true,
          },
        },
        contact: {
          select: {
            contact_id: true,
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

    res.status(201).json({
      success: true,
      message: 'Opportunity created successfully',
      data: opportunity,
    });
  } catch (error) {
    console.error('Create opportunity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create opportunity',
    });
  }
});

/**
 * PUT /api/opportunities/:id
 * Update an opportunity
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const opportunityId = parseInt(req.params.id);
    const {
      opportunity_name,
      description,
      practice_area,
      stage,
      probability,
      estimated_value,
      expected_close_date,
      source,
      client_id,
      contact_id,
      assigned_to,
      lost_reason,
      won_notes,
    } = req.body;

    if (isNaN(opportunityId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid opportunity ID',
      });
      return;
    }

    const existing = await prisma.opportunities.findUnique({
      where: { opportunity_id: opportunityId },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Opportunity not found',
      });
      return;
    }

    const updateData: any = {};

    if (opportunity_name !== undefined) updateData.opportunity_name = opportunity_name;
    if (description !== undefined) updateData.description = description || null;
    if (practice_area !== undefined) updateData.practice_area = practice_area || null;
    if (stage !== undefined) {
      const validStages = ['prospect', 'consultation', 'proposal', 'negotiation', 'won', 'lost'];
      if (!validStages.includes(stage)) {
        res.status(400).json({
          success: false,
          message: `Invalid stage. Must be one of: ${validStages.join(', ')}`,
        });
        return;
      }
      updateData.stage = stage;
    }
    if (probability !== undefined) {
      const prob = parseInt(probability);
      if (prob < 0 || prob > 100) {
        res.status(400).json({
          success: false,
          message: 'Probability must be between 0 and 100',
        });
        return;
      }
      updateData.probability = prob;
    }
    if (estimated_value !== undefined) {
      updateData.estimated_value = estimated_value ? parseFloat(estimated_value) : null;
    }
    if (expected_close_date !== undefined) {
      updateData.expected_close_date = expected_close_date ? new Date(expected_close_date) : null;
    }
    if (source !== undefined) updateData.source = source || null;
    if (client_id !== undefined) {
      updateData.client_id = client_id ? parseInt(client_id) : null;
    }
    if (contact_id !== undefined) {
      updateData.contact_id = contact_id ? parseInt(contact_id) : null;
    }
    if (assigned_to !== undefined) {
      updateData.assigned_to = assigned_to ? parseInt(assigned_to) : null;
    }
    if (lost_reason !== undefined) updateData.lost_reason = lost_reason || null;
    if (won_notes !== undefined) updateData.won_notes = won_notes || null;

    const opportunity = await prisma.opportunities.update({
      where: { opportunity_id: opportunityId },
      data: updateData,
      include: {
        client: {
          select: {
            client_id: true,
            client_name: true,
          },
        },
        contact: {
          select: {
            contact_id: true,
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
      message: 'Opportunity updated successfully',
      data: opportunity,
    });
  } catch (error) {
    console.error('Update opportunity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update opportunity',
    });
  }
});

/**
 * PUT /api/opportunities/:id/stage
 * Update opportunity stage
 */
router.put('/:id/stage', async (req: Request, res: Response): Promise<void> => {
  try {
    const opportunityId = parseInt(req.params.id);
    const { stage, notes } = req.body;

    if (isNaN(opportunityId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid opportunity ID',
      });
      return;
    }

    const validStages = ['prospect', 'consultation', 'proposal', 'negotiation', 'won', 'lost'];
    if (!stage || !validStages.includes(stage)) {
      res.status(400).json({
        success: false,
        message: `Invalid stage. Must be one of: ${validStages.join(', ')}`,
      });
      return;
    }

    const existing = await prisma.opportunities.findUnique({
      where: { opportunity_id: opportunityId },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Opportunity not found',
      });
      return;
    }

    const updateData: any = { stage };
    if (stage === 'won' && notes) {
      updateData.won_notes = notes;
    }
    if (stage === 'lost' && notes) {
      updateData.lost_reason = notes;
    }

    const opportunity = await prisma.opportunities.update({
      where: { opportunity_id: opportunityId },
      data: updateData,
      include: {
        client: {
          select: {
            client_id: true,
            client_name: true,
          },
        },
        contact: {
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
      message: 'Opportunity stage updated successfully',
      data: opportunity,
    });
  } catch (error) {
    console.error('Update opportunity stage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update opportunity stage',
    });
  }
});

/**
 * POST /api/opportunities/:id/convert
 * Convert opportunity to matter (when won)
 */
router.post('/:id/convert', async (req: Request, res: Response): Promise<void> => {
  try {
    const opportunityId = parseInt(req.params.id);
    const { matter_data } = req.body; // Additional matter data if needed

    if (isNaN(opportunityId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid opportunity ID',
      });
      return;
    }

    const opportunity = await prisma.opportunities.findUnique({
      where: { opportunity_id: opportunityId },
      include: {
        client: true,
        contact: true,
      },
    });

    if (!opportunity) {
      res.status(404).json({
        success: false,
        message: 'Opportunity not found',
      });
      return;
    }

    if (opportunity.stage !== 'won') {
      res.status(400).json({
        success: false,
        message: 'Only won opportunities can be converted to matters',
      });
      return;
    }

    if (!opportunity.client_id) {
      res.status(400).json({
        success: false,
        message: 'Opportunity must be linked to a client to convert to matter',
      });
      return;
    }

    // Create matter using existing matter creation logic
    // This uses the existing matter creation endpoint internally
    const matterData = {
      client_id: opportunity.client_id,
      matter_title: opportunity.opportunity_name,
      description: opportunity.description || null,
      practice_area: opportunity.practice_area || null,
      start_date: new Date().toISOString(),
      estimated_value: opportunity.estimated_value || null,
      assigned_lawyer: opportunity.assigned_to || null,
      ...matter_data, // Allow override with additional data
    };

    // Note: In a real implementation, you might want to call the matter creation service
    // For now, we'll create it directly
    const matter = await prisma.matters.create({
      data: {
        client_id: opportunity.client_id,
        matter_title: opportunity.opportunity_name,
        description: opportunity.description || null,
        practice_area: opportunity.practice_area || null,
        start_date: new Date(),
        estimated_value: matterData.estimated_value,
        assigned_lawyer: matterData.assigned_lawyer,
        created_by: (req.session as any).userId || null,
      },
    });

    // Link opportunity to matter
    await prisma.opportunities.update({
      where: { opportunity_id: opportunityId },
      data: {
        matter_id: matter.matter_id,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Opportunity converted to matter successfully',
      data: {
        opportunity: {
          ...opportunity,
          matter_id: matter.matter_id,
        },
        matter,
      },
    });
  } catch (error) {
    console.error('Convert opportunity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to convert opportunity to matter',
    });
  }
});

/**
 * DELETE /api/opportunities/:id
 * Delete an opportunity
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const opportunityId = parseInt(req.params.id);

    if (isNaN(opportunityId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid opportunity ID',
      });
      return;
    }

    const opportunity = await prisma.opportunities.findUnique({
      where: { opportunity_id: opportunityId },
    });

    if (!opportunity) {
      res.status(404).json({
        success: false,
        message: 'Opportunity not found',
      });
      return;
    }

    await prisma.opportunities.delete({
      where: { opportunity_id: opportunityId },
    });

    res.status(200).json({
      success: true,
      message: 'Opportunity deleted successfully',
    });
  } catch (error) {
    console.error('Delete opportunity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete opportunity',
    });
  }
});

export default router;

