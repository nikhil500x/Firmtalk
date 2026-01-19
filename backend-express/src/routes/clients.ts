import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import prisma from '../prisma-client';
import multer from 'multer';
import { BulkUploadService } from '../services/bulkUpload.service';

// Configure multer for file uploads (memory storage, 25MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/octet-stream' // fallback
    ];
    if (allowedMimes.includes(file.mimetype) || 
        file.originalname.endsWith('.xlsx') || 
        file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel files (.xlsx, .xls) are allowed.'));
    }
  }
});

const router = Router();

// Apply role-based access control for all CRM routes
router.use(requireRole(['superadmin', 'partner', 'admin', 'support', 'it']));

/**
 * GET /api/clients/groups
 * Get all client groups
 */
router.get('/groups', async (req: Request, res: Response): Promise<void> => {
  try {
    const groups = await prisma.client_groups.findMany({
      where: {
        active_status: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    res.status(200).json({
      success: true,
      data: groups.map((group) => ({
        id: group.group_id,
        name: group.name,
        description: group.description,
      })),
    });
  } catch (error) {
    console.error('Get client groups error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch client groups',
    });
  }
});

/**
 * POST /api/clients/groups
 * Create a new client group
 */
router.post('/groups', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({
        success: false,
        message: 'Group name is required',
      });
      return;
    }

    const existingGroup = await prisma.client_groups.findFirst({
      where: {
        name: {
          equals: name.trim(),
          mode: 'insensitive',
        },
      },
    });

    if (existingGroup) {
      res.status(409).json({
        success: false,
        message: 'A client group with this name already exists',
      });
      return;
    }

    const newGroup = await prisma.client_groups.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        active_status: true,
        created_by: (req.session as any).userId || null,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Client group created successfully',
      data: {
        id: newGroup.group_id,
        name: newGroup.name,
        description: newGroup.description,
      },
    });
  } catch (error) {
    console.error('Create client group error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create client group',
    });
  }
});

/**
 * POST /api/clients
 * Create a new client with reference support
 */
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      companyName,
      industry,
      clientGroup,
      website,
      address,
      city,
      state,
      postalCode,
      country,
      status,
      internalReferenceId,
      externalReferenceName,
      externalReferenceEmail,  
      externalReferencePhone,  
      notes,
      clientCreationRequestedBy,
    } = req.body;

    // Validate required fields
    if (!companyName || !industry) {
      res.status(400).json({
        success: false,
        message: 'Company name and industry are required',
      });
      return;
    }

    const userId = (req.session as any).userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    // Validate reference: Only one type can be filled
    if (internalReferenceId && externalReferenceName) {
      res.status(400).json({
        success: false,
        message: 'Cannot have both internal and external reference',
      });
      return;
    }

    // If internal reference provided, verify user exists
    if (internalReferenceId) {
      const referrer = await prisma.users.findUnique({
        where: { user_id: parseInt(internalReferenceId) },
      });

      if (!referrer) {
        res.status(400).json({
          success: false,
          message: 'Invalid internal reference user',
        });
        return;
      }
    }

    // Handle client group
    let groupId = null;
    if (clientGroup) {
      let group = await prisma.client_groups.findFirst({
        where: { name: clientGroup },
      });

      if (!group) {
        group = await prisma.client_groups.create({
          data: {
            name: clientGroup,
            active_status: true,
            created_by: userId || null,
          },
        });
      }

      groupId = group.group_id;
    }

    // Combine address fields
    const fullAddress = [address, city, state, postalCode, country]
      .filter(Boolean)
      .join(', ');

    // Create new client
    const newClient = await prisma.clients.create({
      data: {
        user_id: userId,
        client_name: companyName,
        industry,
        website_url: website || null,
        address: fullAddress || null,
        group_id: groupId,
        active_status: status === 'Active' || status === 'Prospect',
        internal_reference_id: internalReferenceId ? parseInt(internalReferenceId) : null,
        external_reference_name: externalReferenceName?.trim() || null,
        external_reference_email: externalReferenceEmail?.trim() || null,
        external_reference_phone: externalReferencePhone?.trim() || null,
        notes: notes?.trim() || null,
        client_creation_requested_by: clientCreationRequestedBy ? parseInt(clientCreationRequestedBy) : null,
      },
      include: {
        group: true,
        user: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
        contacts: true,
        internal_referrer: {
          select: {
            user_id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    // ✅ ADD THIS: Generate and update client_code after creation
    const clientCode = String(newClient.client_id).padStart(4, '0'); // e.g., "0001", "0057", "0186"
    const updatedClient = await prisma.clients.update({
      where: { client_id: newClient.client_id },
      data: { client_code: clientCode },
      include: {
        group: true,
        user: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
        contacts: true,
        internal_referrer: {
          select: {
            user_id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Client created successfully',
      data: {
        id: updatedClient.client_id,
        clientCode: updatedClient.client_code, // ✅ Return actual client_code
        companyName: updatedClient.client_name,
        industry: newClient.industry,
        clientGroup: newClient.group?.name || null,
        website: newClient.website_url,
        address: newClient.address,
        status: newClient.active_status ? 'Active' : 'Inactive',
        // Changed: Use internal_referrer (who referred the client) instead of creator
        createdBy: newClient.internal_referrer?.name || newClient.external_reference_name || 'Unknown',
        // NEW: Reference data
        internalReference: newClient.internal_referrer ? {
          id: newClient.internal_referrer.user_id,
          name: newClient.internal_referrer.name,
          email: newClient.internal_referrer.email,
          phone: newClient.internal_referrer.phone,
        } : null,
        externalReferenceName: newClient.external_reference_name,
        externalReferenceEmail: newClient.external_reference_email,  // ADD THIS
        externalReferencePhone: newClient.external_reference_phone,  // ADD THIS
        notes: newClient.notes,
        clientCreationRequestedBy: newClient.client_creation_requested_by,
      },
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create client',
    });
  }
});

/**
 * PUT /api/clients/:id
 * Update an existing client with reference support
 */
router.put('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = parseInt(req.params.id);

    if (isNaN(clientId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid client ID',
      });
      return;
    }

    const {
      companyName,
      industry,
      clientGroup,
      website,
      address,
      city,
      state,
      postalCode,
      country,
      status,
      // NEW: Reference fields
      internalReferenceId,
      externalReferenceName,
      externalReferenceEmail,  // ADD THIS
      externalReferencePhone,  // ADD THIS
      notes,
      clientCreationRequestedBy
    } = req.body;

    if (!companyName || !industry) {
      res.status(400).json({
        success: false,
        message: 'Company name and industry are required',
      });
      return;
    }

    const existingClient = await prisma.clients.findUnique({
      where: { client_id: clientId },
    });

    if (!existingClient) {
      res.status(404).json({
        success: false,
        message: 'Client not found',
      });
      return;
    }

    // Validate reference: Only one type can be filled
    if (internalReferenceId && externalReferenceName) {
      res.status(400).json({
        success: false,
        message: 'Cannot have both internal and external reference',
      });
      return;
    }

    // If internal reference provided, verify user exists
    if (internalReferenceId) {
      const referrer = await prisma.users.findUnique({
        where: { user_id: parseInt(internalReferenceId) },
      });

      if (!referrer) {
        res.status(400).json({
          success: false,
          message: 'Invalid internal reference user',
        });
        return;
      }
    }

    // Handle client group
    let groupId = null;
    if (clientGroup && clientGroup !== 'Independent') {
      let group = await prisma.client_groups.findFirst({
        where: { name: clientGroup },
      });

      if (!group) {
        const userId = (req.session as any).userId;
        group = await prisma.client_groups.create({
          data: {
            name: clientGroup,
            active_status: true,
            created_by: userId || null,
          },
        });
      }

      groupId = group.group_id;
    }

    const fullAddress = [address, city, state, postalCode, country]
      .filter(Boolean)
      .join(', ');

    // Update client
    const updatedClient = await prisma.clients.update({
      where: { client_id: clientId },
      data: {
        client_name: companyName,
        industry,
        website_url: website || null,
        address: fullAddress || null,
        group_id: groupId,
        active_status: status === 'Active' || status === 'Prospect',
        // NEW: Reference fields
        internal_reference_id: internalReferenceId ? parseInt(internalReferenceId) : null,
        external_reference_name: externalReferenceName?.trim() || null,
        external_reference_email: externalReferenceEmail?.trim() || null,  // ADD THIS
        external_reference_phone: externalReferencePhone?.trim() || null,  // ADD THIS
        notes: notes?.trim() || null,
        client_creation_requested_by: clientCreationRequestedBy ? parseInt(clientCreationRequestedBy) : null,
        updated_at: new Date(),
      },
      include: {
        group: true,
        user: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
        contacts: {
          where: {
            is_primary: true,
          },
        },
        // NEW: Include internal referrer
        internal_referrer: {
          select: {
            user_id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Client updated successfully',
      data: {
        id: updatedClient.client_id,
        companyName: updatedClient.client_name,
        industry: updatedClient.industry,
        clientGroup: updatedClient.group?.name || null,
        website: updatedClient.website_url,
        address: updatedClient.address,
        status: updatedClient.active_status ? 'Active' : 'Inactive',
        updatedBy: updatedClient.user.name,
        // NEW: Reference data
        internalReference: updatedClient.internal_referrer ? {
          id: updatedClient.internal_referrer.user_id,
          name: updatedClient.internal_referrer.name,
          email: updatedClient.internal_referrer.email,
          phone: updatedClient.internal_referrer.phone,
        } : null,
        externalReferenceName: updatedClient.external_reference_name,
        externalReferenceEmail: updatedClient.external_reference_email,  // ADD THIS
        externalReferencePhone: updatedClient.external_reference_phone,  // ADD THIS
        notes: updatedClient.notes,
        clientCreationRequestedBy: updatedClient.client_creation_requested_by,
      },
    });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update client',
    });
  }
});

/**
 * GET /api/clients
 * Get all clients with reference information
 */
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { industry, status, search } = req.query;

    const whereClause: any = {};

    if (industry && industry !== 'All') {
      whereClause.industry = industry as string;
    }

    if (status === 'Active') {
      whereClause.active_status = true;
    } else if (status === 'Inactive') {
      whereClause.active_status = false;
    }

    if (search) {
      whereClause.OR = [
        {
          client_name: {
            contains: search as string,
            mode: 'insensitive',
          },
        },
      ];
    }

    // ✅ ADD THIS: Fetch unique industries
    const uniqueIndustries = await prisma.clients.findMany({
      select: {
        industry: true,
      },
      where: {
        industry: {
          not: null,
        },
      },
      distinct: ['industry'],
      orderBy: {
        industry: 'asc',
      },
    });

    const industriesList = uniqueIndustries
      .map(c => c.industry)
      .filter(Boolean) as string[];

    let clients;
    try {
      clients = await prisma.clients.findMany({
        where: whereClause,
        include: {
          group: true,
          user: {
            select: {
              user_id: true,
              name: true,
            },
          },
          contacts: true,
          internal_referrer: {
            select: {
              user_id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2022' && (error?.meta?.column?.includes('referral') || error?.message?.includes('referral'))) {
        try {
          clients = await prisma.clients.findMany({
            where: whereClause,
            include: {
              group: true,
              user: {
                select: {
                  user_id: true,
                  name: true,
                },
              },
              contacts: true,
            },
            orderBy: {
              created_at: 'desc',
            },
          });
        } catch (retryError: any) {
          console.error('Retry error fetching clients:', retryError);
          res.status(503).json({
            success: false,
            message: 'CRM features require database migration. Please run: npx prisma migrate dev',
          });
          return;
        }
      } else {
        throw error;
      }
    }

    if (!clients) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch clients',
      });
      return;
    }

    const formattedClients = clients.map((client) => ({
      id: client.client_id,
      clientCode: client.client_code || String(client.client_id).padStart(4, '0'),
      companyName: client.client_name,
      industry: client.industry || '',
      clientGroup: client.group?.name || 'Independent',
      website: client.website_url || '',
      address: client.address || '',
      contactsCount: client.contacts?.length || 0,
      contacts: (client.contacts || []).map((contact) => ({
        id: contact.contact_id,
        name: contact.name,
        email: contact.email,
        number: contact.number,
        designation: contact.designation,
        isPrimary: contact.is_primary,
      })),
      status: client.active_status ? 'Active' : 'Inactive',
      lastInteraction: client.updated_at.toDateString(),
      createdAt: client.created_at,
      createdBy: (client as any).internal_referrer?.name || client.external_reference_name || 'Unknown',
      internalReference: (client as any).internal_referrer ? {
        id: (client as any).internal_referrer.user_id,
        name: (client as any).internal_referrer.name,
        email: (client as any).internal_referrer.email,
        phone: (client as any).internal_referrer.phone,
      } : null,
      externalReferenceName: client.external_reference_name || null,
      externalReferenceEmail: client.external_reference_email || null,
      externalReferencePhone: client.external_reference_phone || null,
      notes: client.notes || null,
      clientCreationRequestedBy: client.client_creation_requested_by || null,
    }));

    // ✅ MODIFY THE RESPONSE to include industries
    res.status(200).json({
      success: true,
      data: formattedClients,
      industries: industriesList, // ✅ ADD THIS LINE
    });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch clients',
    });
  }
});

/**
 * GET /api/clients/:clientId/group-clients
 * Get all clients in the same group as the given client
 */
router.get('/:clientId/group-clients', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = parseInt(req.params.clientId);

    if (isNaN(clientId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid client ID',
      });
      return;
    }

    // Get the client and its group_id
    const client = await prisma.clients.findUnique({
      where: { client_id: clientId },
      select: {
        client_id: true,
        client_name: true,
        group_id: true,
      },
    });

    if (!client) {
      res.status(404).json({
        success: false,
        message: 'Client not found',
      });
      return;
    }

    if (!client.group_id) {
      // Client doesn't belong to a group
      res.status(200).json({
        success: true,
        data: [],
        message: 'Client does not belong to a group',
      });
      return;
    }

    // Get all clients in the same group
    const groupClients = await prisma.clients.findMany({
      where: {
        group_id: client.group_id,
        active_status: true,
      },
      select: {
        client_id: true,
        client_name: true,
        client_code: true,
      },
      orderBy: {
        client_name: 'asc',
      },
    });

    res.status(200).json({
      success: true,
      data: groupClients.map(c => ({
        id: c.client_id,
        name: c.client_name,
        code: c.client_code || String(c.client_id).padStart(4, '0'),
      })),
    });
  } catch (error) {
    console.error('Error fetching group clients:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch group clients',
    });
  }
});

/**
 * GET /api/clients/:id
 * Get a specific client by ID with reference information
 */
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = parseInt(req.params.id);

    if (isNaN(clientId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid client ID',
      });
      return;
    }

    const client = await prisma.clients.findUnique({
      where: { client_id: clientId },
      include: {
        group: true,
        user: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
        contacts: true,
        // NEW: Include internal referrer
        internal_referrer: {
          select: {
            user_id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        // Include client creation requester
        client_requester: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!client) {
      res.status(404).json({
        success: false,
        message: 'Client not found',
      });
      return;
    }

    const addressParts = client.address?.split(', ') || [];
    const primaryContact = client.contacts.find((c) => c.is_primary);

    const formattedClient = {
      id: client.client_id,
      companyName: client.client_name,
      industry: client.industry || '',
      clientGroup: client.group?.name || 'Independent',
      website: client.website_url || '',
      address: addressParts[0] || '',
      city: addressParts[1] || '',
      state: addressParts[2] || '',
      postalCode: addressParts[3] || '',
      country: addressParts[4] || '',
      primaryContact: primaryContact
        ? {
            id: primaryContact.contact_id,
            name: primaryContact.name,
            email: primaryContact.email,
            number: primaryContact.number,
            designation: primaryContact.designation,
          }
        : null,
      contacts: client.contacts.map((contact) => ({
        id: contact.contact_id,
        name: contact.name,
        email: contact.email,
        number: contact.number,
        designation: contact.designation,
        isPrimary: contact.is_primary,
      })),
      status: client.active_status ? 'Active' : 'Inactive',
      // Changed: Use internal_referrer (who referred the client) instead of creator
      createdBy: client.internal_referrer?.name || client.external_reference_name || 'Unknown',
      createdAt: client.created_at,
      updatedAt: client.updated_at,
      // NEW: Reference data
      internalReference: client.internal_referrer ? {
        id: client.internal_referrer.user_id,
        name: client.internal_referrer.name,
        email: client.internal_referrer.email,
        phone: client.internal_referrer.phone,
      } : null,
      externalReferenceName: client.external_reference_name,
      externalReferenceEmail: client.external_reference_email,
      externalReferencePhone: client.external_reference_phone,
      notes: client.notes,
      clientCreationRequestedBy: client.client_requester ? {
        id: client.client_requester.user_id,
        name: client.client_requester.name,
        email: client.client_requester.email,
      } : null,
    };

    res.status(200).json({
      success: true,
      data: formattedClient,
    });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch client',
    });
  }
});

/**
 * DELETE /api/clients/:id
 * Delete a client
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = parseInt(req.params.id);

    if (isNaN(clientId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid client ID',
      });
      return;
    }

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

    await prisma.clients.delete({
      where: { client_id: clientId },
    });

    res.status(200).json({
      success: true,
      message: 'Client deleted successfully',
    });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete client',
    });
  }
});

/**
 * GET /api/clients/:id/matters
 * Get all matters for a specific client
 */
router.get('/:id/matters', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = parseInt(req.params.id);

    if (isNaN(clientId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid client ID',
      });
      return;
    }

    const client = await prisma.clients.findUnique({
      where: { client_id: clientId },
      select: {
        client_id: true,
        client_name: true,
        industry: true,
        website_url: true,
        address: true,
      },
    });

    if (!client) {
      res.status(404).json({
        success: false,
        message: 'Client not found',
      });
      return;
    }

    const matters = await prisma.matters.findMany({
      where: {
        client_id: clientId,
        active_status: true,
      },
      include: {
        assigned_lawyer_rel: {
          select: {
            user_id: true,
            role_id: true,
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
                role: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        start_date: 'desc',
      },
    });

    const formattedMatters = matters.map(matter => ({
      id: matter.matter_id,
      clientId: matter.client_id,
      matterTitle: matter.matter_title,
      description: matter.description,
      matterType: matter.matter_type,
      practiceArea: matter.practice_area,
      startDate: matter.start_date,
      estimatedDeadline: matter.estimated_deadline,
      status: matter.status,
      estimatedValue: matter.estimated_value,
      billingRateType: matter.billing_rate_type,
      opposingPartyName: matter.opposing_party_name,
      assignedLawyer: matter.assigned_lawyer_rel
        ? {
            id: matter.assigned_lawyer_rel.user_id,
            roleId: matter.assigned_lawyer_rel.role_id,
            name: matter.assigned_lawyer_rel.name,
            email: matter.assigned_lawyer_rel.email,
            phone: matter.assigned_lawyer_rel.phone,
            practiceArea: matter.assigned_lawyer_rel.practice_area,
          }
        : null,
      teamMembers: matter.matter_users.map(mu => ({
        userId: mu.user_id,
        name: mu.user.name,
        email: mu.user.email,
        phone: mu.user.phone,
        userRole: mu.user.role?.name || 'Lawyer',
        matterRole: mu.role,
        hourlyRate: mu.hourly_rate,
        assignedAt: mu.assigned_at,
      })),
      active: matter.active_status,
      createdAt: matter.created_at,
      updatedAt: matter.updated_at,
    }));

    res.status(200).json({
      success: true,
      data: {
        client: {
          id: client.client_id,
          name: client.client_name,
          industry: client.industry,
          website: client.website_url,
          address: client.address,
        },
        matters: formattedMatters,
        summary: {
          total: formattedMatters.length,
          byStatus: {
            active: formattedMatters.filter(m => m.status === 'active').length,
            completed: formattedMatters.filter(m => m.status === 'completed').length,
            on_hold: formattedMatters.filter(m => m.status === 'on_hold').length,
            cancelled: formattedMatters.filter(m => m.status === 'cancelled').length,
          },
          byPracticeArea: formattedMatters.reduce((acc, matter) => {
            const area = matter.practiceArea || 'Unspecified';
            acc[area] = (acc[area] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          totalEstimatedValue: formattedMatters.reduce(
            (sum, m) => sum + (m.estimatedValue || 0),
            0
          ),
        },
      },
    });
  } catch (error) {
    console.error('Get client matters error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch client matters',
    });
  }
});

/**
 * GET /api/clients/bulk-upload/template
 * Download Excel template for bulk upload
 */
router.get('/bulk-upload/template', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const templateBuffer = BulkUploadService.generateTemplate();
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="crm_bulk_upload_template.xlsx"');
    res.send(templateBuffer);
  } catch (error) {
    console.error('Generate template error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate template',
    });
  }
});

/**
 * POST /api/clients/bulk-upload/preview
 * Upload Excel file and return preview data (no DB changes)
 */
router.post('/bulk-upload/preview', requireAuth, upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
      return;
    }

    const userId = (req.session as any).userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    // Parse Excel file
    const parsedRows = BulkUploadService.parseExcelFile(req.file.buffer);

    // Create preview
    const previewData = await BulkUploadService.createPreview(parsedRows, userId);

    res.status(200).json({
      success: true,
      data: previewData,
      message: 'Preview generated successfully',
    });
  } catch (error: any) {
    console.error('Bulk upload preview error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to process Excel file',
    });
  }
});

/**
 * POST /api/clients/bulk-upload/download-preview
 * Download Excel file with corrected preview data
 */
router.post('/bulk-upload/download-preview', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const previewData = req.body;

    // Validate preview data structure
    if (!previewData || !previewData.groups || !previewData.clients || !previewData.contacts) {
      res.status(400).json({
        success: false,
        message: 'Invalid preview data structure',
      });
      return;
    }

    // Generate Excel file from preview data
    const excelBuffer = BulkUploadService.generatePreviewExcel(previewData);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="bulk_upload_corrected.xlsx"');
    res.send(excelBuffer);
  } catch (error: any) {
    console.error('Download preview Excel error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate Excel file',
    });
  }
});

/**
 * POST /api/clients/bulk-upload/confirm
 * Confirm and process bulk upload
 */
router.post('/bulk-upload/confirm', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.session as any).userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    const previewData = req.body;

    // Validate preview data structure
    if (!previewData || !previewData.groups || !previewData.clients || !previewData.contacts) {
      res.status(400).json({
        success: false,
        message: 'Invalid preview data structure',
      });
      return;
    }

    // Check for errors - don't proceed if there are validation errors
    if (previewData.errors && previewData.errors.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Cannot proceed with errors. Please fix errors in preview.',
        data: { errors: previewData.errors }
      });
      return;
    }

    // Process bulk upload
    const result = await BulkUploadService.processBulkUpload(previewData, userId);

    // Generate results Excel file
    const resultsBuffer = BulkUploadService.generateResultsFile(result);
    const resultsBase64 = resultsBuffer.toString('base64');

    res.status(200).json({
      success: true,
      data: {
        ...result,
        resultsFile: resultsBase64, // Include base64 encoded Excel file
      },
      message: 'Bulk upload completed',
    });
  } catch (error: any) {
    console.error('Bulk upload confirm error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process bulk upload',
    });
  }
});

export default router;