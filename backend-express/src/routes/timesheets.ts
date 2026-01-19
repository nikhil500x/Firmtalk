import { Router, Request, Response } from 'express';
import prisma from '../prisma-client';
import { requireAuth } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { CurrencyService } from '../services/currency.service';

const router = Router();
const minutesToTimeString = (minutes: number): string => {
  if (!minutes) return '00:00';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

// Apply auth middleware to all routes
router.use(requireAuth);

/**
 * GET /api/timesheets
 * Get all timesheets with expense details
 * Non-admin users can only see their own timesheets
 */

const minutesToHours = (minutes: number): number =>{
  return minutes / 60;
}


router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId, matterId, startDate, endDate, dateFrom, dateTo } = req.query;
    const sessionUserId = req.session.userId;
    const userRole = req.session.role?.name;

    const where: any = {};

    // Role-based data filtering: non-admin/partner users can only see their own timesheets
    const canSeeAllTimesheets = ['superadmin','partner', 'admin', 'hr', 'accountant', 'it'].includes(userRole || '');
    
    if (userId) {
      where.user_id = parseInt(userId as string);
      // Security check: non-admin users can only query their own timesheets
      if (!canSeeAllTimesheets && where.user_id !== sessionUserId) {
        res.status(403).json({
          success: false,
          message: 'You can only view your own timesheets',
        });
        return;
      }
    } else if (!canSeeAllTimesheets) {
      // If no userId specified and user is not admin, default to their own timesheets
      where.user_id = sessionUserId;
    }

    if (matterId) {
      where.matter_id = parseInt(matterId as string);
    }

    // Support both startDate/endDate and dateFrom/dateTo for compatibility
    if (startDate || endDate || dateFrom || dateTo) {
      where.date = {};
      if (startDate || dateFrom) where.date.gte = new Date((dateFrom || startDate) as string);
      if (endDate || dateTo) where.date.lte = new Date((dateTo || endDate) as string);
    }

    const timesheets = await prisma.timesheets.findMany({
      where,
      include: {
        user: {
          select: {
            user_id: true,
            name: true,
            email: true,
            role: { select: { name: true } },
          },
        },
        matter: {
          select: {
            matter_id: true,
            matter_title: true,
            currency: true, // ✅ Add currency field
            client: {
              select: {
                client_id: true,
                client_name: true,
              },
            },
          },
        },
        expenses: {
          select: {
            expense_id: true,
            category: true,
            sub_category: true,
            description: true,
            amount: true,
            due_date: true,
            receipt_url: true,
            notes: true,
            status: true,
            expense_included: true,
            vendor: {
              select: {
                vendor_id: true,
                vendor_name: true,
              },
            },
          },
        },
        invoice_timesheets: {
          include: {
            invoice: {
              select: {
                invoice_number: true,
                invoice_id: true,
              },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    const formattedTimesheets = timesheets.map((timesheet) => ({
      id: timesheet.timesheet_id,
      userId: timesheet.user_id,
      matterId: timesheet.matter_id,
      date: timesheet.date.toISOString().split('T')[0],
      
      // Use both property names for compatibility
      hoursWorked: timesheet.hours_worked ?? 0,
      totalHours: timesheet.hours_worked ?? 0,
      
      billableHours: minutesToTimeString(timesheet.billable_hours ?? 0),
      nonBillableHours: minutesToTimeString(timesheet.non_billable_hours ?? 0),
      activityType: timesheet.activity_type,
      description: timesheet.description,
      
      hourlyRate: timesheet.hourly_rate ?? null, // Change from 0 to null
      calculatedAmount: timesheet.calculated_amount ?? null, // Change from 0 to null
      calculatedAmountCurrency: timesheet.calculated_amount_currency ?? null,
      
      expenses: timesheet.expenses.map(expense => ({
        id: expense.expense_id,
        category: expense.category,
        subCategory: expense.sub_category,
        description: expense.description,
        amount: expense.amount,
        dueDate: expense.due_date?.toISOString().split('T')[0] || null,
        receiptUrl: expense.receipt_url,
        notes: expense.notes,
        status: expense.status,
        expenseIncluded: expense.expense_included,
        vendor: expense.vendor ? {
          id: expense.vendor.vendor_id,
          name: expense.vendor.vendor_name,
        } : null,
      })),
      notes: timesheet.notes,
      remarks: timesheet.description,
      lastUpdate: timesheet.last_update,
      createdAt: timesheet.created_at,
      updatedAt: timesheet.updated_at,
      
      // Invoice status
      isInvoiced: timesheet.invoice_timesheets.length > 0,
      invoiceNumber: timesheet.invoice_timesheets[0]?.invoice?.invoice_number || null,
      invoiceId: timesheet.invoice_timesheets[0]?.invoice?.invoice_id || null,
      
      user: {
        id: timesheet.user.user_id,
        name: timesheet.user.name,
        email: timesheet.user.email,
        role: timesheet.user.role.name,
      },
      matterTitle: timesheet.matter?.matter_title || null,
      clientName: timesheet.matter?.client?.client_name || null,
      matter: timesheet.matter ? {
        id: timesheet.matter.matter_id,
        title: timesheet.matter.matter_title,
        currency: timesheet.matter.currency || null, // ✅ Add currency field
        client: {
          id: timesheet.matter?.client.client_id,
          name: timesheet.matter?.client.client_name,
        },
      } : null,
    }));

    res.json(successResponse(formattedTimesheets, 'Timesheets fetched successfully'));
  } catch (error) {
    console.error('Error fetching timesheets:', error);
    res.status(500).json(errorResponse('Failed to fetch timesheets'));
  }
});

/**
 * GET /api/timesheets/user/:userId
 * Get all timesheets for a specific user
 */
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const timesheets = await prisma.timesheets.findMany({
      where: {
        user_id: parseInt(userId),
      },
      include: {
        user: {
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
        matter: {
          select: {
            matter_id: true,
            matter_title: true,
            currency: true, // ✅ Add currency field
            client: {
              select: {
                client_id: true,
                client_name: true,
              },
            },
          },
        },
        expenses: {
          select: {
            expense_id: true,
            category: true,
            sub_category: true,
            description: true,
            amount: true,
            due_date: true,
            receipt_url: true,
            notes: true,
            status: true,
            expense_included: true,
            vendor: {
              select: {
                vendor_id: true,
                vendor_name: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    const formattedTimesheets = timesheets.map((timesheet) => ({
      id: timesheet.timesheet_id,
      userId: timesheet.user_id,
      matterId: timesheet.matter_id,
      date: timesheet.date.toISOString().split('T')[0],
      
      // Use both property names for compatibility
      hoursWorked: timesheet.hours_worked ?? 0,
      totalHours: minutesToTimeString(timesheet.hours_worked) ?? "00:00",
      
      billableHours: minutesToTimeString(timesheet.billable_hours) ?? "00:00",
      nonBillableHours: minutesToTimeString(timesheet.non_billable_hours) ?? "00:00",
      activityType: timesheet.activity_type,
      description: timesheet.description,
      
      hourlyRate: timesheet.hourly_rate ?? null, // Change from 0 to null
      calculatedAmount: timesheet.calculated_amount ?? null, // Change from 0 to null
      
      expenses: timesheet.expenses.map(expense => ({
        id: expense.expense_id,
        category: expense.category,
        subCategory: expense.sub_category,
        description: expense.description,
        amount: expense.amount,
        dueDate: expense.due_date?.toISOString().split('T')[0] || null,
        receiptUrl: expense.receipt_url,
        notes: expense.notes,
        status: expense.status,
        expenseIncluded: expense.expense_included,
        vendor: expense.vendor ? {
          id: expense.vendor.vendor_id,
          name: expense.vendor.vendor_name,
        } : null,
      })),
      notes: timesheet.notes,
      remarks: timesheet.description,
      lastUpdate: timesheet.last_update,
      createdAt: timesheet.created_at,
      updatedAt: timesheet.updated_at,
      user: {
        id: timesheet.user.user_id,
        name: timesheet.user.name,
        email: timesheet.user.email,
        role: timesheet.user.role.name,
      },
      matterTitle: timesheet.matter?.matter_title || null,
      clientName: timesheet.matter?.client?.client_name || null,
      matter: timesheet.matter ? {
        id: timesheet.matter.matter_id,
        title: timesheet.matter.matter_title,
        currency: timesheet.matter.currency || null, // ✅ Add currency field
        client: {
          id: timesheet.matter?.client.client_id,
          name: timesheet.matter?.client.client_name,
        },
      } : null,
    }));


    res.json(successResponse(formattedTimesheets, 'User timesheets fetched successfully'));
  } catch (error) {
    console.error('Error fetching user timesheets:', error);
    res.status(500).json(errorResponse('Failed to fetch user timesheets'));
  }
});

/**
 * GET /api/timesheets/matters/assigned
 * Get all matters assigned to the logged-in user (or specified user for admin/accountant) with their hourly rates
 * Query params: userId (optional, admin/accountant only) - fetch matters for specific user
 */
router.get('/matters/assigned', async (req: Request, res: Response) => {
  try {
    const sessionUserId = req.session.userId;
    const sessionUserRole = req.session.role?.name;

    if (!sessionUserId) {
      return res.status(401).json(errorResponse('Unauthorized'));
    }

    // Check if requesting matters for another user
    const requestedUserId = req.query.userId ? parseInt(req.query.userId as string) : null;
    let targetUserId = sessionUserId;

    if (requestedUserId && requestedUserId !== sessionUserId) {
      // Verify the session user has permission to fetch another user's matters
      const canFetchForOthers = ['admin', 'accountant'].includes(sessionUserRole || '');
      
      if (!canFetchForOthers) {
        return res.status(403).json(errorResponse('You do not have permission to fetch matters for other users'));
      }
      
      // Verify target user exists
      const targetUser = await prisma.users.findUnique({
        where: { user_id: requestedUserId },
        select: { user_id: true },
      });
      
      if (!targetUser) {
        return res.status(404).json(errorResponse('Target user not found'));
      }
      
      targetUserId = requestedUserId;
    }

    const matters = await prisma.matters.findMany({
      where: {
        OR: [
          { assigned_lawyer: targetUserId },
          {
            matter_users: {
              some: {
                user_id: targetUserId,
              },
            },
          },
        ],
        active_status: true,
      },
      select: {
        matter_id: true,
        matter_title: true,
        billing_rate_type: true,
        start_date: true,
        currency: true,
        client: {
          select: {
            client_id: true,
            client_name: true,
          },
        },
        matter_users: {
          where: { user_id: targetUserId },
          select: {
            hourly_rate: true,
            service_type: true,
          },
        },
      },
      orderBy: {
        matter_title: 'asc',
      },
    });

    const formattedMatters = matters.map((matter) => ({
      id: matter.matter_id,
      title: matter.matter_title,
      billingRateType: matter.billing_rate_type,
      startDate: matter.start_date,
      currency: matter.currency,
      client: {
        id: matter.client.client_id,
        name: matter.client.client_name,
      },
      // Return all service types with their rates for this user on this matter
      userServiceTypes: matter.matter_users.map(mu => ({
        serviceType: mu.service_type,
        hourlyRate: mu.hourly_rate,
      })),
    }));

    res.json(successResponse(formattedMatters, 'Assigned matters fetched successfully'));
  } catch (error) {
    console.error('Error fetching assigned matters:', error);
    res.status(500).json(errorResponse('Failed to fetch assigned matters'));
  }
});

/**
 * GET /api/timesheets/:id
 * Get a single timesheet by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const timesheet = await prisma.timesheets.findUnique({
      where: { timesheet_id: parseInt(id) },
      include: {
        user: {
          select: {
            user_id: true,
            name: true,
            email: true,
            role: { select: { name: true } },
          },
        },
        matter: {
          select: {
            matter_id: true,
            matter_title: true,
            currency: true, // ✅ Add currency field
            client: {
              select: {
                client_id: true,
                client_name: true,
              },
            },
          },
        },
        expenses: {
          select: {
            expense_id: true,
            category: true,
            sub_category: true,
            description: true,
            amount: true,
            due_date: true,
            receipt_url: true,
            notes: true,
            status: true,
            expense_included: true,
            vendor: {
              select: {
                vendor_id: true,
                vendor_name: true,
              },
            },
          },
        },
      },
    });

    if (!timesheet) {
      return res.status(404).json(errorResponse('Timesheet not found'));
    }

    const formatted = {
      id: timesheet.timesheet_id,
      userId: timesheet.user_id,
      user_id: timesheet.user_id,  
      matterId: timesheet.matter_id,
      matter_id: timesheet.matter_id,   
      date: timesheet.date.toISOString().split('T')[0],

      totalHours: minutesToTimeString(timesheet.hours_worked) ?? "00:00",
      hours_worked: timesheet.hours_worked ?? 0,  
      billableHours: minutesToTimeString(timesheet.billable_hours) ?? "00:00",
      nonBillableHours: minutesToTimeString(timesheet.non_billable_hours) ?? "00:00",

      activityType: timesheet.activity_type,
      activity_type: timesheet.activity_type,  
      description: timesheet.description,
      remarks: timesheet.description,
      notes: timesheet.notes,

      hourlyRate: timesheet.hourly_rate ?? null,
      hourly_rate: timesheet.hourly_rate ?? null,  
      calculatedAmount: timesheet.calculated_amount ?? null,
      calculated_amount: timesheet.calculated_amount ?? null,  

      expenses: timesheet.expenses.map(expense => ({
        id: expense.expense_id,
        category: expense.category,
        subCategory: expense.sub_category,
        description: expense.description,
        amount: expense.amount,
        dueDate: expense.due_date?.toISOString().split('T')[0] || null,
        receiptUrl: expense.receipt_url,
        notes: expense.notes,
        status: expense.status,
        expenseIncluded: expense.expense_included,
        vendor: expense.vendor ? {
          id: expense.vendor.vendor_id,
          name: expense.vendor.vendor_name,
        } : null,
      })),

      lastUpdate: timesheet.last_update,

      matterTitle: timesheet.matter?.matter_title || null,
      clientName: timesheet.matter?.client?.client_name || null,
      matter: timesheet.matter ? {
        id: timesheet.matter.matter_id,
        title: timesheet.matter.matter_title,
        currency: timesheet.matter.currency || null, // ✅ Add currency field
        client: {
          id: timesheet.matter?.client.client_id,
          name: timesheet.matter?.client.client_name,
        },
      } : null,
    };

    res.json(successResponse(formatted, 'Timesheet fetched successfully'));
  } catch (error) {
    console.error('Error fetching timesheet:', error);
    res.status(500).json(errorResponse('Failed to fetch timesheet'));
  }
});

/**
 * POST /api/timesheets
 * Create a new timesheet with optional multiple expenses
 * Admin/accountant can create timesheets for other users via targetUserId
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const sessionUserId = req.session.userId;
    const sessionUserRole = req.session.role?.name;
    
    if (!sessionUserId) {
      return res.status(401).json(errorResponse('Unauthorized'));
    }

    const {
      matterId,
      date,
      billableHours,
      nonBillableHours,
      activityType,
      description,
      expenseIds,
      notes,
      targetUserId, // New field for creating timesheets for other users
    } = req.body;

    if (!matterId || !date || !activityType) {
      return res.status(400).json(errorResponse('Missing required fields'));
    }

    if (billableHours === undefined && nonBillableHours === undefined) {
      return res.status(400).json(errorResponse('At least billable or non-billable hours must be provided'));
    }

    // Determine which user the timesheet is for
    let userId = sessionUserId;
    
    // If targetUserId is provided, verify the session user has permission
    if (targetUserId) {
      const canCreateForOthers = ['admin', 'accountant'].includes(sessionUserRole || '');
      
      if (!canCreateForOthers) {
        return res.status(403).json(errorResponse('You do not have permission to create timesheets for other users'));
      }
      
      userId = parseInt(targetUserId);
      
      // Verify target user exists
      const targetUser = await prisma.users.findUnique({
        where: { user_id: userId },
        select: { user_id: true, name: true },
      });
      
      if (!targetUser) {
        return res.status(404).json(errorResponse('Target user not found'));
      }
    }

    const matter = await prisma.matters.findUnique({
      where: { matter_id: parseInt(matterId) },
      select: {
        matter_id: true,
        status: true,
        billing_rate_type: true,
        currency: true,
        matter_users: {
          where: { user_id: userId },
          select: {
            hourly_rate: true,
            service_type: true,
          },
        },
      },
    });

    if (!matter) {
      return res.status(404).json(errorResponse('Matter not found'));
    }

    if (matter.matter_users.length === 0) {
      return res.status(403).json(errorResponse('You are not assigned to this matter'));
    }

    // Block timesheet creation for closed matters
    if (matter.status === 'closed') {
      return res.status(400).json(errorResponse('Cannot create timesheet for closed matter'));
    }

    const userMatterAssignment = matter.matter_users[0];
    const totalHoursWorked = (billableHours || 0) + (nonBillableHours || 0);
    const matterCurrency = matter.currency || 'INR';

    let hourlyRate = null;
    let calculatedAmount = null;
    let hourlyRateConversionRate = null;

    if (matter.billing_rate_type !== 'fixed') {
      // The hourly_rate in matter_users is already in matter currency (converted during assignment)
      hourlyRate = userMatterAssignment.hourly_rate;
      
      // ✅ Allow null hourly_rate (empty rate card scenario)
      // If hourlyRate is null, calculatedAmount will also be null
      if (hourlyRate) {
        // Calculate amount in matter currency
        calculatedAmount = ((billableHours || 0)/ 60) * hourlyRate;

        // Get conversion rate for audit trail (INR to matter currency)
        if (matterCurrency !== 'INR') {
          hourlyRateConversionRate = await CurrencyService.getExchangeRate('INR', matterCurrency);
        }
      }
      // If hourlyRate is null, calculatedAmount remains null (no billing possible yet)
    }

    const timesheet = await prisma.timesheets.create({
      data: {
        user_id: userId,
        matter_id: parseInt(matterId),
        date: new Date(date),
        hours_worked: totalHoursWorked,
        billable_hours: billableHours || 0,
        non_billable_hours: nonBillableHours || 0,
        activity_type: activityType,
        description: description || null,
        hourly_rate: hourlyRate,
        calculated_amount: calculatedAmount,
        notes: notes || null,
        last_update: new Date(),
        hourly_rate_currency: 'INR',
        hourly_rate_conversion_rate: hourlyRateConversionRate,
        calculated_amount_currency: matterCurrency,
        approved_by: userId, // Auto-approve by the person creating it
      },
      include: {
        user: { select: { name: true, email: true } },
        matter: {
          select: {
            matter_title: true,
            billing_rate_type: true,
            client: { select: { client_name: true } },
          },
        },
        expenses: {
          select: {
            expense_id: true,
            category: true,
            amount: true,
            description: true,
          },
        },
      },
    });

    // Link expenses to the timesheet if provided
    if (expenseIds && expenseIds.length > 0) {
      await prisma.onetime_expenses.updateMany({
        where: {
          expense_id: { in: expenseIds.map((id: string) => parseInt(id)) }
        },
        data: {
          timesheet_id: timesheet.timesheet_id,
          expense_included: true
        }
      });
    }

    res.status(201).json(successResponse(timesheet, 'Timesheet created successfully'));
  } catch (error) {
    console.error('Error creating timesheet:', error);
    res.status(500).json(errorResponse('Failed to create timesheet'));
  }
});


/**
 * PUT /api/timesheets/:id
 * Update an existing timesheet with optional multiple expenses
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json(errorResponse('Unauthorized'));
    }

    const {
      matterId,
      date,
      billableHours,
      nonBillableHours,
      activityType,
      description,
      expenseIds,
      expenseInclusionUpdates,
      notes,
    } = req.body;

    const existingTimesheet = await prisma.timesheets.findUnique({
      where: { timesheet_id: parseInt(id) },
    });

    if (!existingTimesheet) {
      return res.status(404).json(errorResponse('Timesheet not found'));
    }

    // FIX: Handle null matter_id and query separately
    let matter = null;
    let matterUser = null;
    
    if (existingTimesheet.matter_id) {
      matter = await prisma.matters.findUnique({
        where: { matter_id: existingTimesheet.matter_id },
        select: {
          billing_rate_type: true,
          currency: true,
        },
      });

      // Query matter_users separately to avoid relation issues
      matterUser = await prisma.matter_users.findFirst({
        where: {
          matter_id: existingTimesheet.matter_id,
          user_id: existingTimesheet.user_id,
        },
        select: {
          hourly_rate: true,
        },
      });
    }

    const totalHoursWorked = 
      (billableHours !== undefined ? billableHours : existingTimesheet.billable_hours) +
      (nonBillableHours !== undefined ? nonBillableHours : existingTimesheet.non_billable_hours);

    let calculatedAmount = existingTimesheet.calculated_amount;
    let finalHourlyRate = existingTimesheet.hourly_rate;
    const matterCurrency = matter?.currency || 'INR';
    let hourlyRateConversionRate = existingTimesheet.hourly_rate_conversion_rate;

    if (matter && matter.billing_rate_type !== 'fixed') {
      // Use the separately queried matterUser
      finalHourlyRate = matterUser?.hourly_rate || existingTimesheet.hourly_rate;
      const finalBillableHours = billableHours !== undefined ? billableHours : existingTimesheet.billable_hours;
      
      if (finalHourlyRate) {
        calculatedAmount = (finalBillableHours / 60) * finalHourlyRate;
      }

      // Update conversion rate if matter currency changed or not set
      if (matterCurrency !== 'INR' && !hourlyRateConversionRate) {
        hourlyRateConversionRate = await CurrencyService.getExchangeRate('INR', matterCurrency);
      }
    }

    const updateData: any = {
      matter_id: matterId || existingTimesheet.matter_id,
      date: date ? new Date(date) : existingTimesheet.date,
      hours_worked: totalHoursWorked,
      billable_hours: billableHours !== undefined ? billableHours : existingTimesheet.billable_hours,
      non_billable_hours: nonBillableHours !== undefined ? nonBillableHours : existingTimesheet.non_billable_hours,
      activity_type: activityType || existingTimesheet.activity_type,
      description: description !== undefined ? description : existingTimesheet.description,
      hourly_rate: finalHourlyRate,
      calculated_amount: calculatedAmount,
      notes: notes !== undefined ? notes : existingTimesheet.notes,
      last_update: new Date(),
      updated_at: new Date(),
      hourly_rate_conversion_rate: hourlyRateConversionRate,
      calculated_amount_currency: matterCurrency,
    };

    const updatedTimesheet = await prisma.timesheets.update({
      where: { timesheet_id: parseInt(id) },
      data: updateData,
      include: {
        user: { select: { name: true, email: true } },
        matter: {
          select: {
            matter_title: true,
            client: { select: { client_name: true } },
          },
        },
        expenses: {
          select: {
            expense_id: true,
            category: true,
            amount: true,
            description: true,
          },
        },
      },
    });

    // Update expense linking if provided
    if (expenseIds !== undefined) {
      // First, unlink all current expenses
      await prisma.onetime_expenses.updateMany({
        where: { timesheet_id: parseInt(id) },
        data: { 
          timesheet_id: null, 
          expense_included: false,
          approved_by: null,
          approved_at: null
        }
      });

      // Then link the new expenses
      if (expenseIds && expenseIds.length > 0) {
        await prisma.onetime_expenses.updateMany({
          where: {
            expense_id: { in: expenseIds.map((expId: string) => parseInt(expId)) }
          },
          data: {
            timesheet_id: parseInt(id),
            expense_included: true,
            approved_by: userId,
            approved_at: new Date()
          }
        });
      }
    }

    // Handle individual expense inclusion updates
    if (expenseInclusionUpdates && Array.isArray(expenseInclusionUpdates)) {
      for (const update of expenseInclusionUpdates) {
        await prisma.onetime_expenses.update({
          where: { expense_id: parseInt(update.expenseId) },
          data: { 
            expense_included: update.included,
            approved_by: userId,
            approved_at: new Date()
          }
        });
      }
    }

    res.json(successResponse(updatedTimesheet, 'Timesheet updated successfully'));
  } catch (error) {
    console.error('Error updating timesheet:', error);
    res.status(500).json(errorResponse('Failed to update timesheet'));
  }
});

/**
 * DELETE /api/timesheets/:id
 * Delete a timesheet entry
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json(errorResponse('Unauthorized'));
    }

    const existingTimesheet = await prisma.timesheets.findUnique({
      where: {
        timesheet_id: parseInt(id),
      },
    });

    if (!existingTimesheet) {
      return res.status(404).json(errorResponse('Timesheet not found'));
    }

    // Unlink expenses before deleting
    await prisma.onetime_expenses.updateMany({
      where: { timesheet_id: parseInt(id) },
      data: { timesheet_id: null, expense_included: false }
    });

    await prisma.timesheets.delete({
      where: {
        timesheet_id: parseInt(id),
      },
    });

    res.json(successResponse(null, 'Timesheet deleted successfully'));
  } catch (error) {
    console.error('Error deleting timesheet:', error);
    res.status(500).json(errorResponse('Failed to delete timesheet'));
  }
});

/**
 * PUT /api/timesheets/user/:userId/matter/:matterId/recalculate
 * Recalculate all timesheets for a user on a specific matter
 * Used when matter rate is updated to refresh calculated amounts
 */
router.put('/user/:userId/matter/:matterId/recalculate', async (req: Request, res: Response) => {
  try {
    const { userId, matterId } = req.params;
    const userIdInt = parseInt(userId);
    const matterIdInt = parseInt(matterId);

    if (isNaN(userIdInt) || isNaN(matterIdInt)) {
      res.status(400).json(errorResponse('Invalid user ID or matter ID'));
      return;
    }

    // Get the matter to find its currency
    const matter = await prisma.matters.findUnique({
      where: { matter_id: matterIdInt },
      select: { currency: true },
    });

    if (!matter) {
      res.status(404).json(errorResponse('Matter not found'));
      return;
    }

    // Get the updated hourly rate for this user on this matter
    const matterUser = await prisma.matter_users.findFirst({
      where: {
        matter_id: matterIdInt,
        user_id: userIdInt,
      },
      select: { hourly_rate: true },
    });

    if (!matterUser || !matterUser.hourly_rate) {
      res.status(404).json(errorResponse('Matter rate not found for this user'));
      return;
    }

    const hourlyRateInMatterCurrency = parseFloat(matterUser.hourly_rate.toString());

    // Find all timesheets for this user on this matter
    const timesheets = await prisma.timesheets.findMany({
      where: {
        user_id: userIdInt,
        matter_id: matterIdInt,
      },
      select: {
        timesheet_id: true,
        hours_worked: true,
        calculated_amount_currency: true,
      },
    });

    if (timesheets.length === 0) {
      res.json(successResponse({ updatedCount: 0 }, 'No timesheets found to update'));
      return;
    }

    // Update each timesheet with recalculated amount
    const updatePromises = timesheets.map(async (timesheet) => {
      const hoursWorked = parseFloat(timesheet.hours_worked?.toString() || '0');
      const calculatedAmount = hoursWorked * hourlyRateInMatterCurrency;

      return prisma.timesheets.update({
        where: { timesheet_id: timesheet.timesheet_id },
        data: {
          hourly_rate: hourlyRateInMatterCurrency,
          calculated_amount: calculatedAmount,
          calculated_amount_currency: matter.currency || 'INR',
        },
      });
    });

    await Promise.all(updatePromises);

    res.json(successResponse(
      { updatedCount: timesheets.length },
      `Successfully recalculated ${timesheets.length} timesheet(s)`
    ));
  } catch (error) {
    console.error('Error recalculating timesheets:', error);
    res.status(500).json(errorResponse('Failed to recalculate timesheets'));
  }
});

export default router;