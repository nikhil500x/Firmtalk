import { Router, Request, Response } from 'express';
import prisma from '../prisma-client';
import { requireAuth, requireRole } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';

const router = Router();

// Apply role-based access control for all finance/expense routes
// Finance is accessible to: partner, admin, accountant, hr
// router.use(requireRole(['partner', 'admin', 'accountant', 'hr']));

// ============================================================================
// RECURRING EXPENSES ROUTES
// ============================================================================

/**
 * GET /api/expenses/recurring
 * Get all recurring expenses with optional filters
 * Query params:
 * - type: 'salary' | 'office_expense' | 'subscription'
 * - status: 'active' | 'paused' | 'completed'
 * - user_id: Filter salaries by lawyer
 * - vendor_id: Filter by vendor
 */
router.get('/recurring', async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, status, user_id, vendor_id } = req.query;

    const where: any = {};

    // Filter by recurring type
    if (type && typeof type === 'string') {
      where.recurring_type = type;
    }

    // Filter by status
    if (status && typeof status === 'string') {
      where.status = status;
    }

    // Filter by user (for salaries)
    if (user_id) {
      where.user_id = parseInt(user_id as string);
    }

    // Filter by vendor
    if (vendor_id) {
      where.vendor_id = parseInt(vendor_id as string);
    }

    const expenses = await prisma.recurring_expenses.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        lawyer: {
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
        vendor: {
          select: {
            vendor_id: true,
            vendor_name: true,
            contact_person: true,
            email: true,
            phone: true,
          },
        },
        creator: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
        payments: {
          orderBy: { payment_date: 'desc' },
          take: 5,
          include: {
            recorder: {
              select: {
                user_id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            payments: true,
          },
        },
      },
    });

    res.json(successResponse(expenses, 'Recurring expenses fetched successfully'));
  } catch (error) {
    console.error('Get recurring expenses error:', error);
    res.status(500).json(errorResponse('Failed to fetch recurring expenses'));
  }
});

/**
 * GET /api/expenses/recurring/:id
 * Get a single recurring expense by ID
 */
router.get('/recurring/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const expenseId = parseInt(req.params.id);

    if (isNaN(expenseId)) {
      res.status(400).json(errorResponse('Invalid expense ID'));
      return;
    }

    const expense = await prisma.recurring_expenses.findUnique({
      where: { expense_id: expenseId },
      include: {
        lawyer: {
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
        vendor: true,
        creator: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
        payments: {
          orderBy: { payment_date: 'desc' },
          include: {
            recorder: {
              select: {
                user_id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!expense) {
      res.status(404).json(errorResponse('Recurring expense not found'));
      return;
    }

    res.json(successResponse(expense, 'Recurring expense fetched successfully'));
  } catch (error) {
    console.error('Get recurring expense error:', error);
    res.status(500).json(errorResponse('Failed to fetch recurring expense'));
  }
});

/**
 * POST /api/expenses/recurring
 * Create a new recurring expense (salary, office expense, or subscription)
 */
router.post('/recurring', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      res.status(401).json(errorResponse('User not authenticated'));
      return;
    }

    const {
      recurring_type,
      amount,
      start_date,
      end_date,
      recurrence_type,
      cycle_day,
      notes,
      // Salary-specific
      user_id,
      gross_salary,
      deductions,
      net_salary,
      // Office expense specific
      sub_category,
      vendor_id,
      // Subscription specific
      software_name,
      description,
      seats_licenses,
    } = req.body;

    // Validation
    if (!recurring_type || !['salary', 'office_expense', 'subscription'].includes(recurring_type)) {
      res.status(400).json(errorResponse('Invalid recurring type'));
      return;
    }

    if (!amount || amount <= 0) {
      res.status(400).json(errorResponse('Valid amount is required'));
      return;
    }

    if (!start_date) {
      res.status(400).json(errorResponse('Start date is required'));
      return;
    }

    if (!cycle_day || cycle_day < 1 || cycle_day > 31) {
      res.status(400).json(errorResponse('Cycle day must be between 1 and 31'));
      return;
    }

    // Type-specific validation
    if (recurring_type === 'salary' && !user_id) {
      res.status(400).json(errorResponse('lawyer (user_id) is required for salary'));
      return;
    }

    if (recurring_type === 'subscription' && !software_name) {
      res.status(400).json(errorResponse('Software name is required for subscription'));
      return;
    }

    // Verify lawyer exists (for salary)
    if (recurring_type === 'salary') {
      const lawyer = await prisma.users.findUnique({
        where: { user_id },
      });

      if (!lawyer) {
        res.status(404).json(errorResponse('lawyer not found'));
        return;
      }
    }

    // Verify vendor exists (if provided)
    if (vendor_id) {
      const vendor = await prisma.vendors.findUnique({
        where: { vendor_id },
      });

      if (!vendor) {
        res.status(404).json(errorResponse('Vendor not found'));
        return;
      }
    }

    const expense = await prisma.recurring_expenses.create({
      data: {
        recurring_type,
        amount,
        start_date: new Date(start_date),
        end_date: end_date ? new Date(end_date) : null,
        recurrence_type: recurrence_type || 'monthly',
        cycle_day,
        notes,
        user_id: recurring_type === 'salary' ? user_id : null,
        gross_salary: recurring_type === 'salary' ? gross_salary : null,
        deductions: recurring_type === 'salary' ? deductions : null,
        net_salary: recurring_type === 'salary' ? net_salary : null,
        sub_category: recurring_type === 'office_expense' ? sub_category : null,
        vendor_id: recurring_type === 'office_expense' ? vendor_id : null,
        software_name: recurring_type === 'subscription' ? software_name : null,
        description: recurring_type === 'subscription' ? description : null,
        seats_licenses: recurring_type === 'subscription' ? seats_licenses : null,
        created_by: userId,
      },
      include: {
        lawyer: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
        vendor: {
          select: {
            vendor_id: true,
            vendor_name: true,
          },
        },
      },
    });

    res.status(201).json(successResponse(expense, 'Recurring expense created successfully'));
  } catch (error) {
    console.error('Create recurring expense error:', error);
    res.status(500).json(errorResponse('Failed to create recurring expense'));
  }
});

/**
 * PATCH /api/expenses/recurring/:id
 * Update a recurring expense
 */
router.patch('/recurring/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const expenseId = parseInt(req.params.id);

    if (isNaN(expenseId)) {
      res.status(400).json(errorResponse('Invalid expense ID'));
      return;
    }

    const {
      amount,
      end_date,
      recurrence_type,
      cycle_day,
      status,
      notes,
      // Salary-specific
      gross_salary,
      deductions,
      net_salary,
      // Office expense specific
      sub_category,
      vendor_id,
      // Subscription specific
      software_name,
      description,
      seats_licenses,
    } = req.body;

    // Check if expense exists
    const existingExpense = await prisma.recurring_expenses.findUnique({
      where: { expense_id: expenseId },
    });

    if (!existingExpense) {
      res.status(404).json(errorResponse('Recurring expense not found'));
      return;
    }

    // Build update data based on expense type
    const updateData: any = {
      amount,
      end_date: end_date ? new Date(end_date) : undefined,
      recurrence_type,
      cycle_day,
      status,
      notes,
    };

    // Type-specific updates
    if (existingExpense.recurring_type === 'salary') {
      updateData.gross_salary = gross_salary;
      updateData.deductions = deductions;
      updateData.net_salary = net_salary;
    } else if (existingExpense.recurring_type === 'office_expense') {
      updateData.sub_category = sub_category;
      updateData.vendor_id = vendor_id;
    } else if (existingExpense.recurring_type === 'subscription') {
      updateData.software_name = software_name;
      updateData.description = description;
      updateData.seats_licenses = seats_licenses;
    }

    const updatedExpense = await prisma.recurring_expenses.update({
      where: { expense_id: expenseId },
      data: updateData,
      include: {
        lawyer: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
        vendor: {
          select: {
            vendor_id: true,
            vendor_name: true,
          },
        },
      },
    });

    res.json(successResponse(updatedExpense, 'Recurring expense updated successfully'));
  } catch (error) {
    console.error('Update recurring expense error:', error);
    res.status(500).json(errorResponse('Failed to update recurring expense'));
  }
});

/**
 * DELETE /api/expenses/recurring/:id
 * Delete a recurring expense
 */
router.delete('/recurring/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const expenseId = parseInt(req.params.id);

    if (isNaN(expenseId)) {
      res.status(400).json(errorResponse('Invalid expense ID'));
      return;
    }

    // Check if expense exists
    const expense = await prisma.recurring_expenses.findUnique({
      where: { expense_id: expenseId },
      include: {
        _count: {
          select: {
            payments: true,
          },
        },
      },
    });

    if (!expense) {
      res.status(404).json(errorResponse('Recurring expense not found'));
      return;
    }

    // If expense has payments, mark as completed instead of delete
    if (expense._count.payments > 0) {
      const updatedExpense = await prisma.recurring_expenses.update({
        where: { expense_id: expenseId },
        data: { status: 'completed', end_date: new Date() },
      });

      res.json(successResponse(updatedExpense, 'Recurring expense marked as completed'));
    } else {
      // Safe to delete if no payments
      await prisma.recurring_expenses.delete({
        where: { expense_id: expenseId },
      });

      res.json(successResponse(null, 'Recurring expense deleted successfully'));
    }
  } catch (error) {
    console.error('Delete recurring expense error:', error);
    res.status(500).json(errorResponse('Failed to delete recurring expense'));
  }
});

// ============================================================================
// ONE-TIME EXPENSES ROUTES
// ============================================================================

/**
 * GET /api/expenses/onetime
 * Get all one-time expenses with optional filters
 * Query params:
 * - category: expense category
 * - status: 'pending' | 'partially_paid' | 'paid'
 * - matter_id: Filter by matter
 * - vendor_id: Filter by vendor
 */
router.get('/onetime', async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, status, matter_id, vendor_id, start_date, end_date } = req.query;

    const where: any = {};

    // Filter by category
    if (category && typeof category === 'string') {
      where.category = category;
    }

    // Filter by status
    if (status && typeof status === 'string') {
      where.status = status;
    }

    // Filter by matter
    if (matter_id) {
      where.matter_id = parseInt(matter_id as string);
    }

    // Filter by vendor
    if (vendor_id) {
      where.vendor_id = parseInt(vendor_id as string);
    }

    // Filter by date range
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) {
        where.created_at.gte = new Date(start_date as string);
      }
      if (end_date) {
        where.created_at.lte = new Date(end_date as string);
      }
    }

    const expenses = await prisma.onetime_expenses.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        vendor: {
          select: {
            vendor_id: true,
            vendor_name: true,
            contact_person: true,
            email: true,
            phone: true,
          },
        },
        matter: {
          select: {
            matter_id: true,
            matter_title: true,
            client: {
              select: {
                client_id: true,
                client_name: true,
              },
            },
          },
        },
        approver: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
        recorder: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
        payments: {
          orderBy: { payment_date: 'desc' },
          include: {
            recorder: {
              select: {
                user_id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            payments: true,
          },
        },
      },
    });

    // Calculate total paid for each expense
    const expensesWithTotals = expenses.map(expense => {
      const totalPaid = expense.payments.reduce((sum, payment) => sum + payment.amount, 0);
      return {
        ...expense,
        total_paid: totalPaid,
        remaining: expense.amount - totalPaid,
      };
    });

    res.json(successResponse(expensesWithTotals, 'One-time expenses fetched successfully'));
  } catch (error) {
    console.error('Get one-time expenses error:', error);
    res.status(500).json(errorResponse('Failed to fetch one-time expenses'));
  }
});

/**
 * GET /api/expenses/onetime/:id
 * Get a single one-time expense by ID
 */
router.get('/onetime/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const expenseId = parseInt(req.params.id);

    if (isNaN(expenseId)) {
      res.status(400).json(errorResponse('Invalid expense ID'));
      return;
    }

    const expense = await prisma.onetime_expenses.findUnique({
      where: { expense_id: expenseId },
      include: {
        vendor: true,
        matter: {
          select: {
            matter_id: true,
            matter_title: true,
            client: {
              select: {
                client_id: true,
                client_name: true,
              },
            },
          },
        },
        approver: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
        recorder: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
        payments: {
          orderBy: { payment_date: 'desc' },
          include: {
            recorder: {
              select: {
                user_id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!expense) {
      res.status(404).json(errorResponse('One-time expense not found'));
      return;
    }

    // Calculate totals
    const totalPaid = expense.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const expenseWithTotals = {
      ...expense,
      total_paid: totalPaid,
      remaining: expense.amount - totalPaid,
    };

    res.json(successResponse(expenseWithTotals, 'One-time expense fetched successfully'));
  } catch (error) {
    console.error('Get one-time expense error:', error);
    res.status(500).json(errorResponse('Failed to fetch one-time expense'));
  }
});

/**
 * POST /api/expenses/onetime
 * Create a new one-time expense
 */
router.post('/onetime', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      res.status(401).json(errorResponse('User not authenticated'));
      return;
    }

    const {
      category,
      sub_category,
      description,
      vendor_id,
      amount,
      due_date,
      matter_id,
      receipt_url,
      notes,
    } = req.body;

    // Validation
    if (!category) {
      res.status(400).json(errorResponse('Category is required'));
      return;
    }

    if (!description) {
      res.status(400).json(errorResponse('Description is required'));
      return;
    }

    if (!amount || amount <= 0) {
      res.status(400).json(errorResponse('Valid amount is required'));
      return;
    }

    // Verify vendor exists (if provided)
    if (vendor_id) {
      const vendor = await prisma.vendors.findUnique({
        where: { vendor_id },
      });

      if (!vendor) {
        res.status(404).json(errorResponse('Vendor not found'));
        return;
      }
    }

    // Verify matter exists (if provided)
    if (matter_id) {
      const matter = await prisma.matters.findUnique({
        where: { matter_id },
      });

      if (!matter) {
        res.status(404).json(errorResponse('Matter not found'));
        return;
      }
    }

    const expense = await prisma.onetime_expenses.create({
      data: {
        category,
        sub_category,
        description,
        vendor_id,
        amount,
        due_date: due_date ? new Date(due_date) : null,
        matter_id,
        receipt_url,
        notes,
        recorded_by: userId,
      },
      include: {
        vendor: {
          select: {
            vendor_id: true,
            vendor_name: true,
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

    res.status(201).json(successResponse(expense, 'One-time expense created successfully'));
  } catch (error) {
    console.error('Create one-time expense error:', error);
    res.status(500).json(errorResponse('Failed to create one-time expense'));
  }
});

/**
 * PATCH /api/expenses/onetime/:id
 * Update a one-time expense
 */
router.patch('/onetime/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const expenseId = parseInt(req.params.id);

    if (isNaN(expenseId)) {
      res.status(400).json(errorResponse('Invalid expense ID'));
      return;
    }

    const {
      category,
      sub_category,
      description,
      vendor_id,
      amount,
      due_date,
      matter_id,
      status,
      receipt_url,
      notes,
    } = req.body;

    // Check if expense exists
    const existingExpense = await prisma.onetime_expenses.findUnique({
      where: { expense_id: expenseId },
    });

    if (!existingExpense) {
      res.status(404).json(errorResponse('One-time expense not found'));
      return;
    }

    const updatedExpense = await prisma.onetime_expenses.update({
      where: { expense_id: expenseId },
      data: {
        category,
        sub_category,
        description,
        vendor_id,
        amount,
        due_date: due_date ? new Date(due_date) : undefined,
        matter_id,
        status,
        receipt_url,
        notes,
      },
      include: {
        vendor: {
          select: {
            vendor_id: true,
            vendor_name: true,
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

    res.json(successResponse(updatedExpense, 'One-time expense updated successfully'));
  } catch (error) {
    console.error('Update one-time expense error:', error);
    res.status(500).json(errorResponse('Failed to update one-time expense'));
  }
});

/**
 * PATCH /api/expenses/onetime/:id/approve
 * Approve a one-time expense
 */
router.patch('/onetime/:id/approve', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.session?.userId;
    const expenseId = parseInt(req.params.id);

    if (!userId) {
      res.status(401).json(errorResponse('User not authenticated'));
      return;
    }

    if (isNaN(expenseId)) {
      res.status(400).json(errorResponse('Invalid expense ID'));
      return;
    }

    // Check if expense exists
    const expense = await prisma.onetime_expenses.findUnique({
      where: { expense_id: expenseId },
    });

    if (!expense) {
      res.status(404).json(errorResponse('One-time expense not found'));
      return;
    }

    const approvedExpense = await prisma.onetime_expenses.update({
      where: { expense_id: expenseId },
      data: {
        approved_by: userId,
        approved_at: new Date(),
      },
      include: {
        approver: {
          select: {
            user_id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json(successResponse(approvedExpense, 'One-time expense approved successfully'));
  } catch (error) {
    console.error('Approve one-time expense error:', error);
    res.status(500).json(errorResponse('Failed to approve one-time expense'));
  }
});

/**
 * DELETE /api/expenses/onetime/:id
 * Delete a one-time expense
 */
router.delete('/onetime/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const expenseId = parseInt(req.params.id);

    if (isNaN(expenseId)) {
      res.status(400).json(errorResponse('Invalid expense ID'));
      return;
    }

    // Check if expense exists
    const expense = await prisma.onetime_expenses.findUnique({
      where: { expense_id: expenseId },
      include: {
        _count: {
          select: {
            payments: true,
          },
        },
      },
    });

    if (!expense) {
      res.status(404).json(errorResponse('One-time expense not found'));
      return;
    }

    // If expense has payments, mark as cancelled instead of delete
    if (expense._count.payments > 0) {
      res.status(400).json(errorResponse('Cannot delete expense with payments. Update status instead.'));
      return;
    }

    // Safe to delete if no payments
    await prisma.onetime_expenses.delete({
      where: { expense_id: expenseId },
    });

    res.json(successResponse(null, 'One-time expense deleted successfully'));
  } catch (error) {
    console.error('Delete one-time expense error:', error);
    res.status(500).json(errorResponse('Failed to delete one-time expense'));
  }
});

// ============================================================================
// EXPENSE PAYMENTS ROUTES
// ============================================================================

/**
 * POST /api/expenses/payments
 * Record a payment for an expense (recurring or one-time)
 */
router.post('/payments', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      res.status(401).json(errorResponse('User not authenticated'));
      return;
    }

    const {
      onetime_expense_id,
      recurring_expense_id,
      payment_date,
      payment_for_month,
      amount,
      payment_method,
      transaction_ref,
      notes,
    } = req.body;

    // Validation
    if (!onetime_expense_id && !recurring_expense_id) {
      res.status(400).json(errorResponse('Either onetime_expense_id or recurring_expense_id is required'));
      return;
    }

    if (onetime_expense_id && recurring_expense_id) {
      res.status(400).json(errorResponse('Cannot specify both onetime_expense_id and recurring_expense_id'));
      return;
    }

    if (!amount || amount <= 0) {
      res.status(400).json(errorResponse('Valid amount is required'));
      return;
    }

    if (!payment_date) {
      res.status(400).json(errorResponse('Payment date is required'));
      return;
    }

    if (!payment_method) {
      res.status(400).json(errorResponse('Payment method is required'));
      return;
    }

    // Verify expense exists
    if (onetime_expense_id) {
      const expense = await prisma.onetime_expenses.findUnique({
        where: { expense_id: onetime_expense_id },
        include: {
          payments: true,
        },
      });

      if (!expense) {
        res.status(404).json(errorResponse('One-time expense not found'));
        return;
      }

      // Check if payment exceeds remaining amount
      const totalPaid = expense.payments.reduce((sum, p) => sum + p.amount, 0);
      const remaining = expense.amount - totalPaid;

      if (amount > remaining) {
        res.status(400).json(errorResponse(`Payment amount (${amount}) exceeds remaining balance (${remaining})`));
        return;
      }
    }

    if (recurring_expense_id) {
      const expense = await prisma.recurring_expenses.findUnique({
        where: { expense_id: recurring_expense_id },
      });

      if (!expense) {
        res.status(404).json(errorResponse('Recurring expense not found'));
        return;
      }

      if (!payment_for_month) {
        res.status(400).json(errorResponse('payment_for_month is required for recurring expenses'));
        return;
      }
    }

    // Create payment
    const payment = await prisma.expense_payments.create({
      data: {
        onetime_expense_id,
        recurring_expense_id,
        payment_date: new Date(payment_date),
        payment_for_month: payment_for_month ? new Date(payment_for_month) : null,
        amount,
        payment_method,
        transaction_ref,
        notes,
        recorded_by: userId,
      },
      include: {
        recorder: {
          select: {
            user_id: true,
            name: true,
          },
        },
      },
    });

    // Update expense status if applicable
    if (onetime_expense_id) {
      const expense = await prisma.onetime_expenses.findUnique({
        where: { expense_id: onetime_expense_id },
        include: { payments: true },
      });

      if (expense) {
        const totalPaid = expense.payments.reduce((sum, p) => sum + p.amount, 0) + amount;
        let newStatus = 'pending';

        if (totalPaid >= expense.amount) {
          newStatus = 'paid';
        } else if (totalPaid > 0) {
          newStatus = 'partially_paid';
        }

        await prisma.onetime_expenses.update({
          where: { expense_id: onetime_expense_id },
          data: { status: newStatus },
        });
      }
    }

    res.status(201).json(successResponse(payment, 'Payment recorded successfully'));
  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json(errorResponse('Failed to record payment'));
  }
});

/**
 * GET /api/expenses/payments
 * Get all expense payments with optional filters
 */
router.get('/payments', async (req: Request, res: Response): Promise<void> => {
  try {
    const { onetime_expense_id, recurring_expense_id, start_date, end_date } = req.query;

    const where: any = {};

    if (onetime_expense_id) {
      where.onetime_expense_id = parseInt(onetime_expense_id as string);
    }

    if (recurring_expense_id) {
      where.recurring_expense_id = parseInt(recurring_expense_id as string);
    }

    if (start_date || end_date) {
      where.payment_date = {};
      if (start_date) {
        where.payment_date.gte = new Date(start_date as string);
      }
      if (end_date) {
        where.payment_date.lte = new Date(end_date as string);
      }
    }

    const payments = await prisma.expense_payments.findMany({
      where,
      orderBy: { payment_date: 'desc' },
      include: {
        onetime_expense: {
          select: {
            expense_id: true,
            description: true,
            category: true,
            amount: true,
          },
        },
        recurring_expense: {
          select: {
            expense_id: true,
            recurring_type: true,
            amount: true,
            software_name: true,
          },
        },
        recorder: {
          select: {
            user_id: true,
            name: true,
          },
        },
      },
    });

    res.json(successResponse(payments, 'Payments fetched successfully'));
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json(errorResponse('Failed to fetch payments'));
  }
});

/**
 * DELETE /api/expenses/payments/:id
 * Delete a payment record
 */
router.delete('/payments/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const paymentId = parseInt(req.params.id);

    if (isNaN(paymentId)) {
      res.status(400).json(errorResponse('Invalid payment ID'));
      return;
    }

    const payment = await prisma.expense_payments.findUnique({
      where: { payment_id: paymentId },
    });

    if (!payment) {
      res.status(404).json(errorResponse('Payment not found'));
      return;
    }

    await prisma.expense_payments.delete({
      where: { payment_id: paymentId },
    });

    // Update expense status if one-time expense
    if (payment.onetime_expense_id) {
      const expense = await prisma.onetime_expenses.findUnique({
        where: { expense_id: payment.onetime_expense_id },
        include: { payments: true },
      });

      if (expense) {
        const totalPaid = expense.payments.reduce((sum, p) => sum + p.amount, 0);
        let newStatus = 'pending';

        if (totalPaid >= expense.amount) {
          newStatus = 'paid';
        } else if (totalPaid > 0) {
          newStatus = 'partially_paid';
        }

        await prisma.onetime_expenses.update({
          where: { expense_id: payment.onetime_expense_id },
          data: { status: newStatus },
        });
      }
    }

    res.json(successResponse(null, 'Payment deleted successfully'));
  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(500).json(errorResponse('Failed to delete payment'));
  }
});

export default router;

