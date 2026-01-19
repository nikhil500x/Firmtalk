import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import prisma from '../prisma-client';

const router = Router();

// Apply role-based access control for contact routes (part of CRM)
// Contacts are accessible to: partner, sr-associate, admin, support, it
router.use(requireRole(['superadmin','partner','admin', 'support', 'it']));

/**
 * POST /api/contacts
 * Create a new contact
 * Requires authentication
 */
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { client_id, name, number, email, designation, is_primary } = req.body;

    // Validate required fields
    if (!client_id || !name || !number || !email) {
      res.status(400).json({
        success: false,
        message: 'Client ID, name, number, and email are required',
      });
      return;
    }

    // Verify client exists
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

    // Check if contact with same email already exists for this client
    const existingContact = await prisma.contacts.findFirst({
      where: {
        client_id: parseInt(client_id),
        email: email,
      },
    });

    if (existingContact) {
      res.status(409).json({
        success: false,
        message: 'Contact with this email already exists for this client',
      });
      return;
    }

    // Create new contact
    const newContact = await prisma.contacts.create({
      data: {
        client_id: parseInt(client_id),
        name,
        number,
        email,
        designation: designation || null,
        is_primary: is_primary || false,
        created_by: (req.session as any).userId || null,
      },
      include: {
        client: {
          select: {
            client_id: true,
            client_name: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Contact created successfully',
      data: {
        id: newContact.contact_id,
        name: newContact.name,
        email: newContact.email,
        client: newContact.client?.client_name || 'No Client Associated',
      },
    });
  } catch (error) {
    console.error('Create contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create contact',
    });
  }
});

/**
 * GET /api/contacts
 * Get all contacts (with optional filters)
 * Requires authentication
 */
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    // Get query parameters for filtering
    const { client_id, search } = req.query;

    // Build where clause based on filters
    const whereClause: any = {};

    if (client_id) {
      whereClause.client_id = parseInt(client_id as string);
    }

    if (search) {
      whereClause.OR = [
        {
          name: {
            contains: search as string,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: search as string,
            mode: 'insensitive',
          },
        },
        {
          designation: {
            contains: search as string,
            mode: 'insensitive',
          },
        },
      ];
    }

    // Fetch contacts with client information
    const contacts = await prisma.contacts.findMany({
      where: whereClause,
      include: {
        client: {
          select: {
            client_id: true,
            client_name: true,
            industry: true,
            internal_referrer: {
              select: {
                user_id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
            external_reference_name: true,
          },
        },
        creator: {
          select: {
            user_id: true,
            name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Transform data to match frontend interface
    const formattedContacts = contacts.map(contact => ({
      id: contact.contact_id,
      clientId: contact.client_id,
      clientName: contact.client?.client_name || 'No Client Associated',
      clientIndustry: contact.client?.industry || 'N/A',
      name: contact.name,
      number: contact.number,
      email: contact.email,
      designation: contact.designation,
      // Changed: Use client's referrer (who referred the client) instead of contact creator
      createdBy: contact.client?.internal_referrer?.name || contact.client?.external_reference_name || 'Unknown',
      // Include full referrer info for ReferredBy component
      internalReference: contact.client?.internal_referrer ? {
        id: contact.client.internal_referrer.user_id,
        name: contact.client.internal_referrer.name,
        email: contact.client.internal_referrer.email,
        phone: contact.client.internal_referrer.phone,
      } : null,
      externalReferenceName: contact.client?.external_reference_name || null,
      createdAt: contact.created_at,
      updatedAt: contact.updated_at,
    }));

    res.status(200).json({
      success: true,
      data: formattedContacts,
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contacts',
    });
  }
});

/**
 * GET /api/contacts/:id
 * Get a specific contact by ID
 * Requires authentication
 */
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const contactId = parseInt(req.params.id);

    if (isNaN(contactId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid contact ID',
      });
      return;
    }

    const contact = await prisma.contacts.findUnique({
      where: { contact_id: contactId },
      include: {
        client: {
          select: {
            client_id: true,
            client_name: true,
            industry: true,
            website_url: true,
            address: true,
            internal_referrer: {
              select: {
                user_id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
            external_reference_name: true,
            group: {
              select: {
                group_id: true,
                name: true,
              },
            },
          },
        },
        creator: {
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
        badges: {
          select: {
            badge_id: true,
            badge_type: true,
            created_at: true,
            creator: {
              select: {
                name: true,
              },
            },
          },
        },
        relationships_from: {
          where: { relationship_type: 'reports_to' },
          include: {
            to_contact: {
              select: {
                contact_id: true,
                name: true,
                email: true,
                designation: true,
              },
            },
          },
        },
        relationships_to: {
          where: { relationship_type: 'reports_to' },
          include: {
            from_contact: {
              select: {
                contact_id: true,
                name: true,
                email: true,
                designation: true,
              },
            },
          },
        },
      },
    });

    if (!contact) {
      res.status(404).json({
        success: false,
        message: 'Contact not found',
      });
      return;
    }

    // Get last interaction
    const lastInteraction = await prisma.contact_interactions.findFirst({
      where: { contact_id: contactId },
      orderBy: { created_at: 'desc' },
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

    // Get interaction statistics
    const [totalInteractions, interactionsByType] = await Promise.all([
      prisma.contact_interactions.count({
        where: { contact_id: contactId },
      }),
      prisma.contact_interactions.groupBy({
        by: ['interaction_type'],
        where: { contact_id: contactId },
        _count: true,
      }),
    ]);

    // Get associated matters count
    const mattersCount = contact.client_id? await prisma.matters.count({
      where: { client_id: contact.client_id },
    }) : 0 ;

    // Get associated tasks count (tasks for this client)
    const tasksCount = contact.client_id? await prisma.tasks.count({
      where: { client_id: contact.client_id },
    }): 0;

    // Calculate relationship duration
    const relationshipDurationDays = Math.floor(
      (new Date().getTime() - contact.created_at.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Format response
    const formattedContact = {
      id: contact.contact_id,
      clientId: contact.client_id,
      name: contact.name,
      number: contact.number,
      email: contact.email,
      designation: contact.designation,
      isPrimary: contact.is_primary,
      birthday: contact.birthday,
      anniversary: contact.anniversary,
      linkedinUrl: contact.linkedin_url,
      twitterHandle: contact.twitter_handle,
      notes: contact.notes,
      tags: contact.tags || [],
      preferredContactMethod: contact.preferred_contact_method,
      timezone: contact.timezone,
      client: contact.client ? {
        client_id: contact.client.client_id,
        client_name: contact.client.client_name,
        industry: contact.client.industry || 'N/A',
        website_url: contact.client.website_url || null,
        address: contact.client.address || null,
        group: contact.client.group || null,
      } : {
        client_id: contact.client_id,
        client_name: 'No Client Associated',
        industry: 'N/A',
        website_url: null,
        address: null,
        group: null,
      },
      creator: contact.creator ? {
        id: contact.creator.user_id,
        name: contact.creator.name,
        email: contact.creator.email,
        role: contact.creator.role?.name || null,
      } : null,
      createdAt: contact.created_at,
      updatedAt: contact.updated_at,
      badges: contact.badges.map(b => ({
        id: b.badge_id,
        type: b.badge_type,
        createdBy: b.creator?.name || 'Unknown',
        createdAt: b.created_at,
      })),
      reportsTo: contact.relationships_from.length > 0 ? {
        id: contact.relationships_from[0].to_contact.contact_id,
        name: contact.relationships_from[0].to_contact.name,
        email: contact.relationships_from[0].to_contact.email,
        designation: contact.relationships_from[0].to_contact.designation,
      } : null,
      manages: contact.relationships_to.map(rel => ({
        id: rel.from_contact.contact_id,
        name: rel.from_contact.name,
        email: rel.from_contact.email,
        designation: rel.from_contact.designation,
      })),
      lastInteraction: lastInteraction ? {
        id: lastInteraction.interaction_id,
        type: lastInteraction.interaction_type,
        date: lastInteraction.created_at,
        createdBy: {
          id: lastInteraction.creator.user_id,
          name: lastInteraction.creator.name,
          email: lastInteraction.creator.email,
        },
        data: JSON.parse(lastInteraction.interaction_data || '{}'),
      } : null,
      stats: {
        totalInteractions,
        interactionsByType: interactionsByType.reduce((acc, item) => {
          acc[item.interaction_type] = item._count;
          return acc;
        }, {} as Record<string, number>),
        relationshipDurationDays,
        mattersCount,
        tasksCount,
        daysSinceLastInteraction: lastInteraction
          ? Math.floor((new Date().getTime() - lastInteraction.created_at.getTime()) / (1000 * 60 * 60 * 24))
          : null,
      },
    };

    res.status(200).json({
      success: true,
      data: formattedContact,
    });
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contact',
    });
  }
});

/**
 * PUT /api/contacts/:id
 * Update a contact
 * Requires authentication
 */
router.put('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const contactId = parseInt(req.params.id);
    const {
      name,
      number,
      email,
      designation,
      is_primary,
      client_id,
      birthday,
      anniversary,
      linkedin_url,
      twitter_handle,
      notes,
      tags,
      preferred_contact_method,
      timezone,
    } = req.body;

    if (isNaN(contactId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid contact ID',
      });
      return;
    }

    // Check if contact exists
    const existingContact = await prisma.contacts.findUnique({
      where: { contact_id: contactId },
    });

    if (!existingContact) {
      res.status(404).json({
        success: false,
        message: 'Contact not found',
      });
      return;
    }

    // If client_id is being changed, verify the new client exists
    if (client_id && client_id !== existingContact.client_id) {
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

    // If email is being changed, check if it already exists for the target client
    if (email && email !== existingContact.email) {
      const targetClientId = client_id ? parseInt(client_id) : existingContact.client_id;
      
      const duplicateContact = await prisma.contacts.findFirst({
        where: {
          client_id: targetClientId,
          email: email,
          contact_id: {
            not: contactId,
          },
        },
      });

      if (duplicateContact) {
        res.status(409).json({
          success: false,
          message: 'Contact with this email already exists for this client',
        });
        return;
      }
    }

    // Update contact
    const updateData: any = {
      client_id: client_id ? parseInt(client_id) : existingContact.client_id,
      name: name || existingContact.name,
      number: number || existingContact.number,
      email: email || existingContact.email,
      designation: designation !== undefined ? designation : existingContact.designation,
      is_primary: is_primary !== undefined ? is_primary : existingContact.is_primary,
    };

    // Add new CRM fields if provided
    if (birthday !== undefined) {
      updateData.birthday = birthday ? new Date(birthday) : null;
    }
    if (anniversary !== undefined) {
      updateData.anniversary = anniversary ? new Date(anniversary) : null;
    }
    if (linkedin_url !== undefined) {
      updateData.linkedin_url = linkedin_url || null;
    }
    if (twitter_handle !== undefined) {
      updateData.twitter_handle = twitter_handle || null;
    }
    if (notes !== undefined) {
      updateData.notes = notes || null;
    }
    if (tags !== undefined) {
      updateData.tags = Array.isArray(tags) ? tags : [];
    }
    if (preferred_contact_method !== undefined) {
      updateData.preferred_contact_method = preferred_contact_method || null;
    }
    if (timezone !== undefined) {
      updateData.timezone = timezone || null;
    }

    const updatedContact = await prisma.contacts.update({
      where: { contact_id: contactId },
      data: updateData,
      include: {
        client: {
          select: {
            client_id: true,
            client_name: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Contact updated successfully',
      data: {
        id: updatedContact.contact_id,
        name: updatedContact.name,
        email: updatedContact.email,
        clientId: updatedContact.client_id,
        client: updatedContact.client?.client_name || 'No Client Associated',
      },
    });
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update contact',
    });
  }
});

/**
 * DELETE /api/contacts/:id
 * Delete a contact
 * Requires authentication
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const contactId = parseInt(req.params.id);

    if (isNaN(contactId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid contact ID',
      });
      return;
    }

    // Check if contact exists
    const existingContact = await prisma.contacts.findUnique({
      where: { contact_id: contactId },
    });

    if (!existingContact) {
      res.status(404).json({
        success: false,
        message: 'Contact not found',
      });
      return;
    }

    // Delete contact
    await prisma.contacts.delete({
      where: { contact_id: contactId },
    });

    res.status(200).json({
      success: true,
      message: 'Contact deleted successfully',
    });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete contact',
    });
  }
});

/**
 * GET /api/contacts/client/:clientId
 * Get all contacts for a specific client
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

    // Fetch contacts for this client
    const contacts = await prisma.contacts.findMany({
      where: { client_id: clientId },
      include: {
        client: {
          select: {
            client_id: true,
            internal_referrer: {
              select: {
                user_id: true,
                name: true,
              },
            },
            external_reference_name: true,
          },
        },
        creator: {
          select: {
            user_id: true,
            name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Transform data
    const formattedContacts = contacts.map(contact => ({
      id: contact.contact_id,
      clientId: contact.client_id,
      name: contact.name,
      number: contact.number,
      email: contact.email,
      designation: contact.designation,
      // Changed: Use client's referrer (who referred the client) instead of contact creator
      createdBy: contact.client?.internal_referrer?.name || contact.client?.external_reference_name || 'Unknown',
      // Include full referrer info for ReferredBy component
      internalReference: contact.client?.internal_referrer ? {
        id: contact.client.internal_referrer.user_id,
        name: contact.client.internal_referrer.name,
        email: contact.client.internal_referrer.email,
        phone: contact.client.internal_referrer.phone,
      } : null,
      externalReferenceName: contact.client?.external_reference_name || null,
      createdAt: contact.created_at,
      updatedAt: contact.updated_at,
    }));

    res.status(200).json({
      success: true,
      data: formattedContacts,
    });
  } catch (error) {
    console.error('Get client contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch client contacts',
    });
  }
});


export default router;