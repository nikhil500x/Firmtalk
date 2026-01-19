import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import prisma from '../prisma-client';

const router = Router();

// Apply role-based access control - all CRM users can view, partners see full details
router.use(requireAuth);
router.use(requireRole(['superadmin', 'partner', 'sr-associate', 'associate', 'admin', 'support', 'it']));

/**
 * GET /api/interactions/contact/:contactId
 * Get all interactions for a specific contact
 * Partners see full details, others see summary
 */
router.get('/contact/:contactId', async (req: Request, res: Response): Promise<void> => {
  try {
    const contactId = parseInt(req.params.contactId);
    const userId = (req.session as any).userId;
    const userRole = (req.session as any).role?.name;

    if (isNaN(contactId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid contact ID',
      });
      return;
    }

    // Verify contact exists
    const contact = await prisma.contacts.findUnique({
      where: { contact_id: contactId },
    });

    if (!contact) {
      res.status(404).json({
        success: false,
        message: 'Contact not found',
      });
      return;
    }

    // Fetch interactions
    const interactions = await prisma.contact_interactions.findMany({
      where: { contact_id: contactId },
      include: {
        creator: {
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
    });

    // Check if user is partner/admin for full details
    const isPartner = ['partner', 'superadmin', 'admin'].includes(userRole);

    // Transform data - full details for partners, summary for others
    const transformedInteractions = interactions.map(interaction => {
      let interactionData;
      try {
        interactionData = JSON.parse(interaction.interaction_data);
      } catch {
        interactionData = {};
      }

      if (isPartner) {
        // Full details for partners
        return {
          id: interaction.interaction_id,
          type: interaction.interaction_type,
          data: interactionData,
          relatedEntityType: interaction.related_entity_type,
          relatedEntityId: interaction.related_entity_id,
          createdBy: {
            id: interaction.creator.user_id,
            name: interaction.creator.name,
            email: interaction.creator.email,
          },
          createdAt: interaction.created_at,
        };
      } else {
        // Summary for others
        return {
          id: interaction.interaction_id,
          type: interaction.interaction_type,
          summary: {
            subject: interactionData.subject || interactionData.title || 'Interaction',
            date: interactionData.date || interaction.created_at,
            participantsCount: Array.isArray(interactionData.participants) 
              ? interactionData.participants.length 
              : (interactionData.participants ? 1 : 0),
          },
          relatedEntityType: interaction.related_entity_type,
          relatedEntityId: interaction.related_entity_id,
          createdAt: interaction.created_at,
        };
      }
    });

    res.status(200).json({
      success: true,
      data: transformedInteractions,
    });
  } catch (error) {
    console.error('Get interactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch interactions',
    });
  }
});

/**
 * GET /api/interactions/contact/:contactId/timeline
 * Get chronological timeline of interactions for a contact
 * Partners see full details, others see summary
 */
router.get('/contact/:contactId/timeline', async (req: Request, res: Response): Promise<void> => {
  try {
    const contactId = parseInt(req.params.contactId);
    const userRole = (req.session as any).role?.name;

    if (isNaN(contactId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid contact ID',
      });
      return;
    }

    // Verify contact exists
    const contact = await prisma.contacts.findUnique({
      where: { contact_id: contactId },
    });

    if (!contact) {
      res.status(404).json({
        success: false,
        message: 'Contact not found',
      });
      return;
    }

    // Fetch interactions grouped by date
    const interactions = await prisma.contact_interactions.findMany({
      where: { contact_id: contactId },
      include: {
        creator: {
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
    });

    // Check if user is partner/admin for full details
    const isPartner = ['partner', 'superadmin', 'admin'].includes(userRole);

    // Group by date
    const groupedByDate: Record<string, any[]> = {};
    
    interactions.forEach(interaction => {
      const date = new Date(interaction.created_at).toISOString().split('T')[0];
      if (!groupedByDate[date]) {
        groupedByDate[date] = [];
      }

      let interactionData;
      try {
        interactionData = JSON.parse(interaction.interaction_data);
      } catch {
        interactionData = {};
      }

      if (isPartner) {
        groupedByDate[date].push({
          id: interaction.interaction_id,
          type: interaction.interaction_type,
          data: interactionData,
          relatedEntityType: interaction.related_entity_type,
          relatedEntityId: interaction.related_entity_id,
          createdBy: {
            id: interaction.creator.user_id,
            name: interaction.creator.name,
            email: interaction.creator.email,
          },
          createdAt: interaction.created_at,
        });
      } else {
        groupedByDate[date].push({
          id: interaction.interaction_id,
          type: interaction.interaction_type,
          summary: {
            subject: interactionData.subject || interactionData.title || 'Interaction',
            date: interactionData.date || interaction.created_at,
            participantsCount: Array.isArray(interactionData.participants) 
              ? interactionData.participants.length 
              : (interactionData.participants ? 1 : 0),
          },
          relatedEntityType: interaction.related_entity_type,
          relatedEntityId: interaction.related_entity_id,
          createdAt: interaction.created_at,
        });
      }
    });

    // Transform to array format
    const timeline = Object.keys(groupedByDate)
      .sort((a, b) => b.localeCompare(a)) // Most recent first
      .map(date => ({
        date,
        interactions: groupedByDate[date],
      }));

    res.status(200).json({
      success: true,
      data: timeline,
    });
  } catch (error) {
    console.error('Get timeline error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch timeline',
    });
  }
});

/**
 * POST /api/interactions
 * Create a new interaction
 * Can be called automatically by system or manually
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { contactId, interactionType, interactionData, relatedEntityType, relatedEntityId } = req.body;
    const userId = (req.session as any).userId;

    if (!contactId || !interactionType || !interactionData) {
      res.status(400).json({
        success: false,
        message: 'Contact ID, interaction type, and interaction data are required',
      });
      return;
    }

    // Verify contact exists
    const contact = await prisma.contacts.findUnique({
      where: { contact_id: parseInt(contactId) },
    });

    if (!contact) {
      res.status(404).json({
        success: false,
        message: 'Contact not found',
      });
      return;
    }

    // Create interaction
    const interaction = await prisma.contact_interactions.create({
      data: {
        contact_id: parseInt(contactId),
        interaction_type: interactionType,
        interaction_data: typeof interactionData === 'string' 
          ? interactionData 
          : JSON.stringify(interactionData),
        related_entity_type: relatedEntityType || null,
        related_entity_id: relatedEntityId ? parseInt(relatedEntityId) : null,
        created_by: userId || null,
      },
      include: {
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
      message: 'Interaction created successfully',
      data: {
        id: interaction.interaction_id,
        contactId: interaction.contact_id,
        type: interaction.interaction_type,
        data: JSON.parse(interaction.interaction_data),
        relatedEntityType: interaction.related_entity_type,
        relatedEntityId: interaction.related_entity_id,
        createdBy: {
          id: interaction.creator.user_id,
          name: interaction.creator.name,
          email: interaction.creator.email,
        },
        createdAt: interaction.created_at,
      },
    });
  } catch (error) {
    console.error('Create interaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create interaction',
    });
  }
});

export default router;

