import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import prisma from '../prisma-client';

const router = Router();

// Apply role-based access control - view access for all CRM users, edit for partners/admins only
router.use(requireAuth);
router.use(requireRole(['superadmin', 'partner', 'sr-associate', 'associate', 'admin', 'support', 'it']));

/**
 * GET /api/org-chart/client/:clientId
 * Get org chart for a specific client
 * Returns contacts with relationships, badges, and basic info
 */
router.get('/client/:clientId', async (req: Request, res: Response): Promise<void> => {
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
    let client;
    try {
      client = await prisma.clients.findUnique({
        where: { client_id: clientId },
        select: {
          client_id: true,
          client_name: true,
        },
      });
    } catch (error: any) {
      // If referral_source column doesn't exist, try without it
      if (error?.code === 'P2022' && (error?.meta?.column?.includes('referral') || error?.message?.includes('referral'))) {
        client = await prisma.clients.findUnique({
          where: { client_id: clientId },
          select: {
            client_id: true,
            client_name: true,
          },
        });
      } else {
        throw error;
      }
    }

    if (!client) {
      res.status(404).json({
        success: false,
        message: 'Client not found',
      });
      return;
    }

    // Fetch all contacts for this client
    // Use try-catch for backward compatibility if contact_relationships/contact_badges tables don't exist yet
    let contacts;
    try {
      contacts = await prisma.contacts.findMany({
        where: { client_id: clientId },
        include: {
          creator: {
            select: {
              user_id: true,
              name: true,
              email: true,
            },
          },
          relationships_from: {
            include: {
              to_contact: {
                select: {
                  contact_id: true,
                  name: true,
                  email: true,
                  designation: true,
                },
              },
              creator: {
                select: {
                  user_id: true,
                  name: true,
                },
              },
            },
          },
          relationships_to: {
            include: {
              from_contact: {
                select: {
                  contact_id: true,
                  name: true,
                  email: true,
                  designation: true,
                },
              },
              creator: {
                select: {
                  user_id: true,
                  name: true,
                },
              },
            },
          },
          badges: {
            include: {
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
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
    } catch (error: any) {
      // If contact_relationships or contact_badges tables don't exist, fetch contacts without them
      if (error.code === 'P2021' || error.message?.includes('contact_relationships') || error.message?.includes('contact_badges')) {
        contacts = await prisma.contacts.findMany({
          where: { client_id: clientId },
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
            name: 'asc',
          },
        });
        // Add empty relationships and badges arrays for backward compatibility
        contacts = contacts.map(contact => ({
          ...contact,
          relationships_from: [],
          relationships_to: [],
          badges: [],
        }));
      } else {
        throw error;
      }
    }

    // Transform data for frontend
    const transformedContacts = contacts.map(contact => ({
      id: contact.contact_id,
      name: contact.name,
      email: contact.email,
      phone: contact.number,
      designation: contact.designation || null,
      isPrimary: contact.is_primary,
      createdBy: contact.creator?.name || 'Unknown',
      createdAt: contact.created_at,
      updatedAt: contact.updated_at,
      // Relationships
      relationships: [
        ...contact.relationships_from.map(rel => ({
          id: rel.relationship_id,
          toContactId: rel.to_contact_id,
          toContactName: rel.to_contact.name,
          toContactEmail: rel.to_contact.email,
          toContactDesignation: rel.to_contact.designation,
          type: rel.relationship_type,
          lineStyle: rel.line_style,
          lineColor: rel.line_color,
          notes: rel.notes,
          createdBy: rel.creator?.name || 'Unknown',
          createdAt: rel.created_at,
        })),
        ...contact.relationships_to.map(rel => ({
          id: rel.relationship_id,
          fromContactId: rel.from_contact_id,
          fromContactName: rel.from_contact.name,
          fromContactEmail: rel.from_contact.email,
          fromContactDesignation: rel.from_contact.designation,
          type: rel.relationship_type,
          lineStyle: rel.line_style,
          lineColor: rel.line_color,
          notes: rel.notes,
          createdBy: rel.creator?.name || 'Unknown',
          createdAt: rel.created_at,
        })),
      ],
      // Badges
      badges: contact.badges.map(badge => ({
        type: badge.badge_type,
        createdBy: badge.creator?.name || 'Unknown',
        createdAt: badge.created_at,
      })),
    }));

    res.status(200).json({
      success: true,
      data: {
        client: {
          id: client.client_id,
          name: client.client_name,
          industry: client.industry,
        },
        contacts: transformedContacts,
      },
    });
  } catch (error) {
    console.error('Get org chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch org chart',
    });
  }
});

/**
 * GET /api/org-chart/mindmap
 * Get all clients for mindmap view
 * Returns clients with contact counts
 */
router.get('/mindmap', async (req: Request, res: Response): Promise<void> => {
  try {
    let clients;
    try {
      clients = await prisma.clients.findMany({
        where: {
          active_status: true,
        },
        include: {
          _count: {
            select: {
              contacts: true,
              matters: true,
            },
          },
        },
        orderBy: {
          client_name: 'asc',
        },
      });
    } catch (error: any) {
      // If referral_source column doesn't exist, try without it
      if (error?.code === 'P2022' && (error?.meta?.column?.includes('referral') || error?.message?.includes('referral'))) {
        // Retry without any referral-related fields
        clients = await prisma.clients.findMany({
          where: {
            active_status: true,
          },
          select: {
            client_id: true,
            client_name: true,
            industry: true,
            website_url: true,
            address: true,
            _count: {
              select: {
                contacts: true,
                matters: true,
              },
            },
          },
          orderBy: {
            client_name: 'asc',
          },
        });
      } else {
        throw error;
      }
    }

    const transformedClients = clients.map((client: any) => ({
      id: client.client_id,
      name: client.client_name,
      industry: client.industry || null,
      contactCount: client._count?.contacts || 0,
      matterCount: client._count?.matters || 0,
      website: client.website_url || null,
      address: client.address || null,
    }));

    res.status(200).json({
      success: true,
      data: transformedClients,
    });
  } catch (error: any) {
    console.error('Get mindmap error:', error);
    // If it's still a P2022 error, return empty array
    if (error?.code === 'P2022') {
      res.status(200).json({
        success: true,
        data: [],
        message: 'CRM features require database migration. Please run: npx prisma migrate dev',
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: 'Failed to fetch mindmap data',
    });
  }
});

/**
 * POST /api/org-chart/relationship
 * Create a new relationship between contacts
 * Requires partner/admin/superadmin role
 */
router.post('/relationship', requireRole(['superadmin', 'partner', 'admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { fromContactId, toContactId, relationshipType, lineStyle, lineColor, notes } = req.body;
    const userId = (req.session as any).userId;

    if (!fromContactId || !toContactId || !relationshipType) {
      res.status(400).json({
        success: false,
        message: 'From contact ID, to contact ID, and relationship type are required',
      });
      return;
    }

    if (fromContactId === toContactId) {
      res.status(400).json({
        success: false,
        message: 'A contact cannot have a relationship with itself',
      });
      return;
    }

    // Verify both contacts exist
    const [fromContact, toContact] = await Promise.all([
      prisma.contacts.findUnique({ where: { contact_id: parseInt(fromContactId) } }),
      prisma.contacts.findUnique({ where: { contact_id: parseInt(toContactId) } }),
    ]);

    if (!fromContact || !toContact) {
      res.status(404).json({
        success: false,
        message: 'One or both contacts not found',
      });
      return;
    }

    // Check if relationship already exists
    let existing;
    try {
      existing = await prisma.contact_relationships.findFirst({
        where: {
          from_contact_id: parseInt(fromContactId),
          to_contact_id: parseInt(toContactId),
          relationship_type: relationshipType,
        },
      });
    } catch (error: any) {
      // If table doesn't exist, return error
      if (error.code === 'P2021' || error.message?.includes('contact_relationships')) {
        res.status(503).json({
          success: false,
          message: 'Org chart features require database migration. Please run: npx prisma migrate dev',
        });
        return;
      }
      throw error;
    }

    if (existing) {
      res.status(409).json({
        success: false,
        message: 'This relationship already exists',
      });
      return;
    }

    // Create relationship
    let relationship;
    try {
      relationship = await prisma.contact_relationships.create({
        data: {
          from_contact_id: parseInt(fromContactId),
          to_contact_id: parseInt(toContactId),
          relationship_type: relationshipType,
          line_style: lineStyle || 'solid',
          line_color: lineColor || null,
          notes: notes || null,
          created_by: userId || null,
        },
        include: {
          from_contact: {
            select: {
              contact_id: true,
              name: true,
              email: true,
            },
          },
          to_contact: {
            select: {
              contact_id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    } catch (error: any) {
      // If table doesn't exist, return error
      if (error.code === 'P2021' || error.message?.includes('contact_relationships')) {
        res.status(503).json({
          success: false,
          message: 'Org chart features require database migration. Please run: npx prisma migrate dev',
        });
        return;
      }
      throw error;
    }

    res.status(201).json({
      success: true,
      message: 'Relationship created successfully',
      data: {
        id: relationship.relationship_id,
        fromContact: {
          id: relationship.from_contact.contact_id,
          name: relationship.from_contact.name,
          email: relationship.from_contact.email,
        },
        toContact: {
          id: relationship.to_contact.contact_id,
          name: relationship.to_contact.name,
          email: relationship.to_contact.email,
        },
        type: relationship.relationship_type,
        lineStyle: relationship.line_style,
        lineColor: relationship.line_color,
        notes: relationship.notes,
      },
    });
  } catch (error: any) {
    console.error('Create relationship error:', error);
    if (error.code === 'P2002') {
      res.status(409).json({
        success: false,
        message: 'This relationship already exists',
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create relationship',
    });
  }
});

/**
 * PUT /api/org-chart/relationship/:id
 * Update a relationship
 * Requires partner/admin/superadmin role
 */
router.put('/relationship/:id', requireRole(['superadmin', 'partner', 'admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const relationshipId = parseInt(req.params.id);
    const { relationshipType, lineStyle, lineColor, notes } = req.body;

    if (isNaN(relationshipId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid relationship ID',
      });
      return;
    }

    // Verify relationship exists
    const existing = await prisma.contact_relationships.findUnique({
      where: { relationship_id: relationshipId },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Relationship not found',
      });
      return;
    }

    // Update relationship
    const updated = await prisma.contact_relationships.update({
      where: { relationship_id: relationshipId },
      data: {
        relationship_type: relationshipType || existing.relationship_type,
        line_style: lineStyle || existing.line_style,
        line_color: lineColor !== undefined ? lineColor : existing.line_color,
        notes: notes !== undefined ? notes : existing.notes,
        updated_at: new Date(),
      },
      include: {
        from_contact: {
          select: {
            contact_id: true,
            name: true,
            email: true,
          },
        },
        to_contact: {
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
      message: 'Relationship updated successfully',
      data: {
        id: updated.relationship_id,
        fromContact: {
          id: updated.from_contact.contact_id,
          name: updated.from_contact.name,
          email: updated.from_contact.email,
        },
        toContact: {
          id: updated.to_contact.contact_id,
          name: updated.to_contact.name,
          email: updated.to_contact.email,
        },
        type: updated.relationship_type,
        lineStyle: updated.line_style,
        lineColor: updated.line_color,
        notes: updated.notes,
      },
    });
  } catch (error) {
    console.error('Update relationship error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update relationship',
    });
  }
});

/**
 * DELETE /api/org-chart/relationship/:id
 * Delete a relationship
 * Requires partner/admin/superadmin role
 */
router.delete('/relationship/:id', requireRole(['superadmin', 'partner', 'admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const relationshipId = parseInt(req.params.id);

    if (isNaN(relationshipId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid relationship ID',
      });
      return;
    }

    // Verify relationship exists
    const existing = await prisma.contact_relationships.findUnique({
      where: { relationship_id: relationshipId },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Relationship not found',
      });
      return;
    }

    // Delete relationship
    await prisma.contact_relationships.delete({
      where: { relationship_id: relationshipId },
    });

    res.status(200).json({
      success: true,
      message: 'Relationship deleted successfully',
    });
  } catch (error) {
    console.error('Delete relationship error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete relationship',
    });
  }
});

/**
 * POST /api/org-chart/contact/:contactId/badge
 * Add a badge to a contact
 * Requires partner/admin/superadmin role
 */
router.post('/contact/:contactId/badge', requireRole(['superadmin', 'partner', 'admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const contactId = parseInt(req.params.contactId);
    const { badgeType } = req.body;
    const userId = (req.session as any).userId;

    if (isNaN(contactId) || !badgeType) {
      res.status(400).json({
        success: false,
        message: 'Contact ID and badge type are required',
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

    // Check if badge already exists
    const existing = await prisma.contact_badges.findUnique({
      where: {
        contact_id_badge_type: {
          contact_id: contactId,
          badge_type: badgeType,
        },
      },
    });

    if (existing) {
      res.status(409).json({
        success: false,
        message: 'This badge already exists for this contact',
      });
      return;
    }

    // Create badge
    const badge = await prisma.contact_badges.create({
      data: {
        contact_id: contactId,
        badge_type: badgeType,
        created_by: userId || null,
      },
      include: {
        creator: {
          select: {
            user_id: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Badge added successfully',
      data: {
        id: badge.badge_id,
        contactId: badge.contact_id,
        badgeType: badge.badge_type,
        createdBy: badge.creator?.name || 'Unknown',
        createdAt: badge.created_at,
      },
    });
  } catch (error: any) {
    console.error('Add badge error:', error);
    if (error.code === 'P2002') {
      res.status(409).json({
        success: false,
        message: 'This badge already exists for this contact',
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: 'Failed to add badge',
    });
  }
});

/**
 * DELETE /api/org-chart/contact/:contactId/badge/:badgeType
 * Remove a badge from a contact
 * Requires partner/admin/superadmin role
 */
router.delete('/contact/:contactId/badge/:badgeType', requireRole(['superadmin', 'partner', 'admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const contactId = parseInt(req.params.contactId);
    const badgeType = req.params.badgeType;

    if (isNaN(contactId) || !badgeType) {
      res.status(400).json({
        success: false,
        message: 'Contact ID and badge type are required',
      });
      return;
    }

    // Verify badge exists
    const existing = await prisma.contact_badges.findUnique({
      where: {
        contact_id_badge_type: {
          contact_id: contactId,
          badge_type: badgeType,
        },
      },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Badge not found',
      });
      return;
    }

    // Delete badge
    await prisma.contact_badges.delete({
      where: {
        contact_id_badge_type: {
          contact_id: contactId,
          badge_type: badgeType,
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Badge removed successfully',
    });
  } catch (error) {
    console.error('Remove badge error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove badge',
    });
  }
});

export default router;

