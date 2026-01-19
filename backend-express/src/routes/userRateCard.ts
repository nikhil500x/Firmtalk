import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import prisma from '../prisma-client';

const router = Router();

// ⚠️ IMPORTANT: Put specific routes BEFORE parameterized routes

/**
 * GET /api/rate-cards/active
 * Get all active rate cards 
 */
router.get('/active', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { service_type } = req.query;

    const whereClause: any = {
      is_active: true,
      effective_date: {
        lte: new Date()
      },
      OR: [
        { end_date: null },
        { end_date: { gte: new Date() } }
      ]
    };

    if (service_type) {
      whereClause.service_type = service_type as string;
    }

    const rateCards = await prisma.user_rate_card.findMany({
      where: whereClause,
      orderBy: [
        { user_id: 'asc' },
        { service_type: 'asc' }
      ],
      include: {
        user: {
          select: {
            user_id: true,
            name: true,
            email: true,
            practice_area: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: rateCards,
      count: rateCards.length
    });
  } catch (error: any) {
    console.error('Error fetching active rate cards:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rate cards',
      error: error.message
    });
  }
});


/**
 * GET /api/rate-cards/service-types
 * Get all distinct service types (must be before /:rateCardId route)
 */
router.get('/service-types', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    // Get distinct service types from user_rate_card table
    const serviceTypes = await prisma.user_rate_card.findMany({
      where: {
        is_active: true,
      },
      distinct: ['service_type'],
      select: {
        service_type: true,
      },
      orderBy: {
        service_type: 'asc',
      },
    });

    // Extract just the service type strings
    const serviceTypeList = serviceTypes.map(st => st.service_type);

    res.status(200).json({
      success: true,
      data: serviceTypeList,
      count: serviceTypeList.length,
    });
  } catch (error: any) {
    console.error('Error fetching service types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service types',
      error: error.message,
    });
  }
});

/**
 * GET /api/rate-cards/user/:userId/service-types
 * Get distinct service types for a specific user with active rate cards
 */
router.get('/user/:userId/service-types', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    // Get distinct service types for this user with active rate cards
    const serviceTypes = await prisma.user_rate_card.findMany({
      where: {
        user_id: parseInt(userId),
        is_active: true,
        effective_date: {
          lte: new Date()
        },
        OR: [
          { end_date: null },
          { end_date: { gte: new Date() } }
        ]
      },
      distinct: ['service_type'],
      select: {
        service_type: true,
      },
      orderBy: {
        service_type: 'asc',
      },
    });

    // Extract just the service type strings
    const serviceTypeList = serviceTypes.map(st => st.service_type);

    res.status(200).json({
      success: true,
      data: serviceTypeList,
      count: serviceTypeList.length,
    });
  } catch (error: any) {
    console.error('Error fetching user service types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service types',
      error: error.message,
    });
  }
});

/**
 * GET /api/rate-cards/user/:userId/service/:serviceType/active
 * Get active rate for a user by service type
 * ⚠️ CRITICAL: serviceType will come URL-encoded, need to decode it
 */
router.get('/user/:userId/service/:serviceType/active', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, serviceType } = req.params;
    
    // ✅ Decode the service type (it comes URL-encoded)
    const decodedServiceType = decodeURIComponent(serviceType);
    
   

    const rateCard = await prisma.user_rate_card.findFirst({
      where: {
        user_id: parseInt(userId),
        service_type: decodedServiceType, // Use decoded service type
        is_active: true,
        effective_date: {
          lte: new Date()
        },
        OR: [
          { end_date: null },
          { end_date: { gte: new Date() } }
        ]
      },
      orderBy: {
        effective_date: 'desc'
      },
      include: {
        user: {
          select: {
            user_id: true,
            name: true,
            email: true,
            practice_area: true
          }
        }
      }
    });


    if (!rateCard) {
      res.status(404).json({
        success: false,
        message: `No active rate card found for user ${userId} with service type "${decodedServiceType}"`
      });
      return;
    }

    console.log('Fetched active rate card:', rateCard);

    res.status(200).json({
      success: true,
      data: rateCard
    });
  } catch (error: any) {
    console.error('Error fetching active rate card:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rate card',
      error: error.message
    });
  }
});

/**
 * GET /api/rate-cards/user/:userId/history
 * Get rate card history for a user
 */
router.get('/user/:userId/history', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { service_type } = req.query;

    const whereClause: any = {
      user_id: parseInt(userId)
    };

    if (service_type) {
      whereClause.service_type = service_type as string;
    }

    const rateCards = await prisma.user_rate_card.findMany({
      where: whereClause,
      orderBy: [
        { service_type: 'asc' },
        { effective_date: 'desc' }
      ]
    });

    // Group by service type
    const groupedHistory = rateCards.reduce((acc: any, card) => {
      if (!acc[card.service_type]) {
        acc[card.service_type] = [];
      }
      acc[card.service_type].push(card);
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: groupedHistory
    });
  } catch (error: any) {
    console.error('Error fetching rate card history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rate card history',
      error: error.message
    });
  }
});

/**
 * GET /api/rate-cards/user/:userId
 * Get all rate cards for a user
 */
router.get('/user/:userId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { is_active } = req.query;

    const whereClause: any = {
      user_id: parseInt(userId)
    };

    if (is_active !== undefined) {
      whereClause.is_active = is_active === 'true';
    }

    const rateCards = await prisma.user_rate_card.findMany({
      where: whereClause,
      orderBy: [
        { is_active: 'desc' },
        { effective_date: 'desc' }
      ],
      include: {
        user: {
          select: {
            user_id: true,
            name: true,
            email: true,
            practice_area: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: rateCards,
      count: rateCards.length
    });
  } catch (error: any) {
    console.error('Error fetching user rate cards:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rate cards',
      error: error.message
    });
  }
});

/**
 * POST /api/rate-cards/bulk
 * Bulk create rate cards (must be before POST /)
 */
router.post('/bulk', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { rateCards } = req.body;

    if (!Array.isArray(rateCards) || rateCards.length === 0) {
      res.status(400).json({
        success: false,
        message: 'rateCards must be a non-empty array'
      });
      return;
    }

    const createdCards = [];
    const errors = [];

    for (const card of rateCards) {
      try {
        const { user_id, service_type, min_hourly_rate, max_hourly_rate, effective_date, end_date } = card;

        if (!user_id || !service_type || !min_hourly_rate || !max_hourly_rate || !effective_date) {
          errors.push({
            card,
            error: 'Missing required fields'
          });
          continue;
        }

        if (min_hourly_rate > max_hourly_rate) {
          errors.push({
            card,
            error: 'Minimum rate cannot be greater than maximum rate'
          });
          continue;
        }

        await prisma.user_rate_card.updateMany({
          where: {
            user_id,
            service_type,
            is_active: true
          },
          data: {
            is_active: false,
            end_date: new Date(effective_date)
          }
        });

        const newCard = await prisma.user_rate_card.create({
          data: {
            user_id,
            service_type,
            min_hourly_rate: parseFloat(min_hourly_rate),
            max_hourly_rate: parseFloat(max_hourly_rate),
            effective_date: new Date(effective_date),
            end_date: end_date ? new Date(end_date) : null,
            is_active: true,
            created_by: (req.session as any).userId || null
          }
        });

        createdCards.push(newCard);
      } catch (error: any) {
        errors.push({
          card,
          error: error.message
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Created ${createdCards.length} rate cards`,
      data: {
        created: createdCards,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error: any) {
    console.error('Error bulk creating rate cards:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk create rate cards',
      error: error.message
    });
  }
});



/**
 * GET /api/rate-cards
 * Get all rate cards with role-based visibility
 */
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { is_active, service_type, user_id } = req.query;
    // console.log("Query:",req.query);
    
    const sessionUserId = req.session.userId;
    // console.log(sessionUserId);
    
    const userRole = req.session.role?.name;

    // Roles that can see all rate cards
    const canSeeAllRateCards = [
      'superadmin',
      'partner',
      'admin',
      'support',
      'it',
      'hr',
      'accountant',
    ].includes(userRole || '');

    const sessionUser = await prisma.users.findUnique({
      where: { user_id: sessionUserId },
      select: { user_id: true },
    });

    if (!sessionUser) {
      res.status(401).json({
        success: false,
        message: 'Invalid session user',
      });
      return;
    }

    const effectiveUserId = sessionUser.user_id;

    const whereClause: any = {};

    if (
      user_id &&
      !canSeeAllRateCards &&
      parseInt(user_id as string) !== effectiveUserId
    ) {
      res.status(403).json({
        success: false,
        message: 'You can only view your own rate cards',
      });
      return;
    }

    if (!canSeeAllRateCards) {
      whereClause.user_id = effectiveUserId;
    } else if (user_id) {
      whereClause.user_id = parseInt(user_id as string);
    }

    if (is_active !== undefined) {
      whereClause.is_active = is_active === 'true';
    }

    if (service_type) {
      whereClause.service_type = service_type as string;
    }

    const rateCards = await prisma.user_rate_card.findMany({
      where: whereClause,
      orderBy: [
        { is_active: 'desc' },
        { user_id: 'asc' },
        { service_type: 'asc' },
        { effective_date: 'desc' },
      ],
      include: {
        user: {
          select: {
            user_id: true,
            name: true,
            email: true,
            practice_area: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      data: rateCards,
      count: rateCards.length,
    });
  } catch (error: any) {
    console.error('Error fetching rate cards:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rate cards',
      error: error.message,
    });
  }
});

/**
 * POST /api/rate-cards
 * Create a new rate card for a user
 */
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { user_id, service_type, min_hourly_rate, max_hourly_rate, effective_date, end_date, is_active, allow_empty_rates } = req.body;

    // Basic required fields
    if (!user_id || !service_type || !effective_date) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: user_id, service_type, effective_date'
      });
      return;
    }

    // ✅ NEW: Support for empty rate cards
    const isEmptyRateCard = allow_empty_rates === true || (min_hourly_rate === undefined && max_hourly_rate === undefined);
    
    if (!isEmptyRateCard) {
      // If not creating empty rate card, validate rates are provided
      if (!min_hourly_rate || !max_hourly_rate) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: min_hourly_rate, max_hourly_rate (or set allow_empty_rates: true)'
        });
        return;
      }

      if (min_hourly_rate <= 0 || max_hourly_rate <= 0) {
        res.status(400).json({
          success: false,
          message: 'Hourly rates must be greater than 0'
        });
        return;
      }

      if (min_hourly_rate > max_hourly_rate) {
        res.status(400).json({
          success: false,
          message: 'Minimum hourly rate cannot be greater than maximum hourly rate'
        });
        return;
      }
    } else {
      // Creating empty rate card - both must be null
      if ((min_hourly_rate !== undefined && min_hourly_rate !== null) || 
          (max_hourly_rate !== undefined && max_hourly_rate !== null)) {
        res.status(400).json({
          success: false,
          message: 'For empty rate cards, both min and max rates must be omitted or null'
        });
        return;
      }
    }

    const userExists = await prisma.users.findUnique({
      where: { user_id }
    });

    if (!userExists) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // ✅ NEW: Check if trying to create an active rate card when one already exists
    const requestedIsActive = is_active !== undefined ? is_active : true;
    
    if (requestedIsActive) {
      const existingActiveCard = await prisma.user_rate_card.findFirst({
        where: {
          user_id,
          service_type,
          is_active: true
        }
      });

      if (existingActiveCard) {
        res.status(400).json({
          success: false,
          message: `Cannot create active rate card: An active rate card (ID: ${existingActiveCard.ratecard_id}) already exists for this user and service type.`
        });
        return;
      }
    }

    // Note: Removed the automatic deactivation logic since we're now preventing duplicates
    // If you want to auto-deactivate old cards, uncomment this:
    /*
    await prisma.user_rate_card.updateMany({
      where: {
        user_id,
        service_type,
        is_active: true
      },
      data: {
        is_active: false,
        end_date: new Date(effective_date)
      }
    });
    */

    const rateCard = await prisma.user_rate_card.create({
      data: {
        user_id,
        service_type,
        min_hourly_rate: min_hourly_rate ? parseFloat(min_hourly_rate) : null,
        max_hourly_rate: max_hourly_rate ? parseFloat(max_hourly_rate) : null,
        effective_date: new Date(effective_date),
        end_date: end_date ? new Date(end_date) : null,
        is_active: requestedIsActive,
        created_by: (req.session as any).userId || null
      },
      include: {
        user: {
          select: {
            user_id: true,
            name: true,
            email: true,
            practice_area: true
          }
        }
      }
    });

    const message = isEmptyRateCard 
      ? 'Empty rate card created successfully (rates must be set later)'
      : 'Rate card created successfully';

    res.status(201).json({
      success: true,
      message,
      data: rateCard,
      isEmptyRateCard
    });
  } catch (error: any) {
    console.error('Error creating rate card:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create rate card',
      error: error.message
    });
  }
});

/**
 * GET /api/rate-cards/:rateCardId
 * Get a specific rate card by ID
 * ⚠️ THIS MUST BE AFTER ALL OTHER GET ROUTES
 */
router.get('/:rateCardId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { rateCardId } = req.params;

    const rateCard = await prisma.user_rate_card.findUnique({
      where: { ratecard_id: parseInt(rateCardId) },
      include: {
        user: {
          select: {
            user_id: true,
            name: true,
            email: true,
            practice_area: true
          }
        }
      }
    });

    if (!rateCard) {
      res.status(404).json({
        success: false,
        message: 'Rate card not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: rateCard
    });
  } catch (error: any) {
    console.error('Error fetching rate card:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rate card',
      error: error.message
    });
  }
});

/**
 * PUT /api/rate-cards/:rateCardId
 * Update a rate card
 */
router.put('/:rateCardId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { rateCardId } = req.params;
    const { min_hourly_rate, max_hourly_rate, effective_date, end_date, is_active } = req.body;

    const existingRateCard = await prisma.user_rate_card.findUnique({
      where: { ratecard_id: parseInt(rateCardId) }
    });

    if (!existingRateCard) {
      res.status(404).json({
        success: false,
        message: 'Rate card not found'
      });
      return;
    }

    // ✅ NEW: Check if trying to activate and if another active rate card exists
    if (is_active === true && !existingRateCard.is_active) {
      const activeRateCard = await prisma.user_rate_card.findFirst({
        where: {
          user_id: existingRateCard.user_id,
          service_type: existingRateCard.service_type,
          is_active: true,
          ratecard_id: {
            not: parseInt(rateCardId) // Exclude the current rate card
          }
        }
      });

      if (activeRateCard) {
        res.status(400).json({
          success: false,
          message: `Cannot activate: An active rate card (ID: ${activeRateCard.ratecard_id}) already exists for this user and service type. Please deactivate it first.`
        });
        return;
      }
    }

    const updateData: any = {
      updated_at: new Date()
    };

    // ✅ NEW: Handle rate updates including empty rate cards
    if (min_hourly_rate !== undefined || max_hourly_rate !== undefined) {
      const newMinRate = min_hourly_rate !== undefined 
        ? (min_hourly_rate === null ? null : parseFloat(min_hourly_rate))
        : existingRateCard.min_hourly_rate;
      const newMaxRate = max_hourly_rate !== undefined 
        ? (max_hourly_rate === null ? null : parseFloat(max_hourly_rate))
        : existingRateCard.max_hourly_rate;

      // Only validate if rates are being set (not null)
      if (newMinRate !== null && newMaxRate !== null) {
        if (newMinRate <= 0 || newMaxRate <= 0) {
          res.status(400).json({
            success: false,
            message: 'Hourly rates must be greater than 0'
          });
          return;
        }

        if (newMinRate > newMaxRate) {
          res.status(400).json({
            success: false,
            message: 'Minimum hourly rate cannot be greater than maximum hourly rate'
          });
          return;
        }
      }

      // Ensure both are null or both are set
      if ((newMinRate === null && newMaxRate !== null) || (newMinRate !== null && newMaxRate === null)) {
        res.status(400).json({
          success: false,
          message: 'Both min and max rates must be set together or both must be null'
        });
        return;
      }

      if (min_hourly_rate !== undefined) {
        updateData.min_hourly_rate = newMinRate;
      }
      if (max_hourly_rate !== undefined) {
        updateData.max_hourly_rate = newMaxRate;
      }
    }

    if (effective_date !== undefined) {
      updateData.effective_date = new Date(effective_date);
    }

    if (end_date !== undefined) {
      updateData.end_date = end_date ? new Date(end_date) : null;
    }

    if (is_active !== undefined) {
      updateData.is_active = is_active;
      
      // ✅ NEW: Clear end_date when activating
      // if (is_active === true) {
      //   updateData.end_date = null;
      // }
    }

    const updatedRateCard = await prisma.user_rate_card.update({
      where: { ratecard_id: parseInt(rateCardId) },
      data: updateData,
      include: {
        user: {
          select: {
            user_id: true,
            name: true,
            email: true,
            practice_area: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Rate card updated successfully',
      data: updatedRateCard
    });
  } catch (error: any) {
    console.error('Error updating rate card:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update rate card',
      error: error.message
    });
  }
});

/**
 * DELETE /api/rate-cards/:rateCardId
 * Deactivate a rate card
 */
router.delete('/:rateCardId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { rateCardId } = req.params;

    const existingRateCard = await prisma.user_rate_card.findUnique({
      where: { ratecard_id: parseInt(rateCardId) }
    });

    if (!existingRateCard) {
      res.status(404).json({
        success: false,
        message: 'Rate card not found'
      });
      return;
    }

    const deactivatedRateCard = await prisma.user_rate_card.update({
      where: { ratecard_id: parseInt(rateCardId) },
      data: {
        is_active: false,
        end_date: new Date(),
        updated_at: new Date()
      }
    });

    res.status(200).json({
      success: true,
      message: 'Rate card deactivated successfully',
      data: deactivatedRateCard
    });
  } catch (error: any) {
    console.error('Error deactivating rate card:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate rate card',
      error: error.message
    });
  }
});

/**
 * Helper function to get rate range for matter assignment
 * Returns an object with min_rate, max_rate, and suggested_rate (midpoint)
 * ✅ NEW: Now handles empty rate cards (when min/max are null)
 */
export const getRateForMatterAssignment = async (
  userId: number,
  serviceType: string,
  assignmentDate: Date = new Date()
): Promise<{ 
  has_rate_card: boolean; 
  has_rates: boolean; 
  min_rate: number | null; 
  max_rate: number | null; 
  suggested_rate: number | null;
  is_empty_rate_card: boolean;
} | null> => {
  try {
    const rateCard = await prisma.user_rate_card.findFirst({
      where: {
        user_id: userId,
        service_type: serviceType,
        is_active: true,
        effective_date: {
          lte: assignmentDate
        },
        OR: [
          { end_date: null },
          { end_date: { gte: assignmentDate } }
        ]
      },
      orderBy: {
        effective_date: 'desc'
      }
    });

    if (!rateCard) {
      return null;
    }

    // ✅ Check if this is an empty rate card
    const isEmptyRateCard = rateCard.min_hourly_rate === null || rateCard.max_hourly_rate === null;
    const hasRates = !isEmptyRateCard;

    return {
      has_rate_card: true,
      has_rates: hasRates,
      min_rate: rateCard.min_hourly_rate,
      max_rate: rateCard.max_hourly_rate,
      suggested_rate: hasRates ? (rateCard.min_hourly_rate! + rateCard.max_hourly_rate!) / 2 : null,
      is_empty_rate_card: isEmptyRateCard
    };
  } catch (error) {
    console.error('Error fetching rate for matter assignment:', error);
    return null;
  }
};

export default router;