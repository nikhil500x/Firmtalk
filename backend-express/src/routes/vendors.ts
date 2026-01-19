import { Router, Request, Response } from 'express';
import prisma from '../prisma-client';
import { requireAuth, requireRole } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';

const router = Router();

// Apply role-based access control for vendor routes
// Vendors are accessible to: partner, admin, accountant, hr
// router.use(requireRole(['partner', 'admin', 'accountant', 'hr']));

/**
 * GET /api/vendors
 * Get all vendors with optional filters
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { active_status, search } = req.query;

    const where: any = {};

    // Filter by active status
    if (active_status !== undefined) {
      where.active_status = active_status === 'true';
    }

    // Search by vendor name or contact person
    if (search && typeof search === 'string') {
      where.OR = [
        { vendor_name: { contains: search, mode: 'insensitive' } },
        { contact_person: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const vendors = await prisma.vendors.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        _count: {
          select: {
            onetime_expenses: true,
            recurring_expenses: true,
          },
        },
      },
    });

    res.json(successResponse(vendors, 'Vendors fetched successfully'));
  } catch (error) {
    console.error('Get vendors error:', error);
    res.status(500).json(errorResponse('Failed to fetch vendors'));
  }
});

/**
 * GET /api/vendors/:id
 * Get a single vendor by ID
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const vendorId = parseInt(req.params.id);

    if (isNaN(vendorId)) {
      res.status(400).json(errorResponse('Invalid vendor ID'));
      return;
    }

    const vendor = await prisma.vendors.findUnique({
      where: { vendor_id: vendorId },
      include: {
        onetime_expenses: {
          orderBy: { created_at: 'desc' },
          take: 10,
        },
        recurring_expenses: {
          orderBy: { created_at: 'desc' },
          take: 10,
        },
      },
    });

    if (!vendor) {
      res.status(404).json(errorResponse('Vendor not found'));
      return;
    }

    res.json(successResponse(vendor, 'Vendor fetched successfully'));
  } catch (error) {
    console.error('Get vendor error:', error);
    res.status(500).json(errorResponse('Failed to fetch vendor'));
  }
});

/**
 * POST /api/vendors
 * Create a new vendor
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      vendor_name,
      contact_person,
      email,
      phone,
      pan_card_number,
      bank_name,
      account_number,
      ifsc_code,
      payment_terms,
      notes,
    } = req.body;

    // Validation
    if (!vendor_name) {
      res.status(400).json(errorResponse('Vendor name is required'));
      return;
    }

    // Check if vendor with same name already exists
    const existingVendor = await prisma.vendors.findFirst({
      where: {
        vendor_name: {
          equals: vendor_name,
          mode: 'insensitive',
        },
      },
    });

    if (existingVendor) {
      res.status(400).json(errorResponse('Vendor with this name already exists'));
      return;
    }

    const vendor = await prisma.vendors.create({
      data: {
        vendor_name,
        contact_person,
        email,
        phone,
        pan_card_number,
        bank_name,
        account_number,
        ifsc_code,
        payment_terms,
        notes,
      },
    });

    res.status(201).json(successResponse(vendor, 'Vendor created successfully'));
  } catch (error) {
    console.error('Create vendor error:', error);
    res.status(500).json(errorResponse('Failed to create vendor'));
  }
});

/**
 * PATCH /api/vendors/:id
 * Update a vendor
 */
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const vendorId = parseInt(req.params.id);

    if (isNaN(vendorId)) {
      res.status(400).json(errorResponse('Invalid vendor ID'));
      return;
    }

    const {
      vendor_name,
      contact_person,
      email,
      phone,
      pan_card_number,
      bank_name,
      account_number,
      ifsc_code,
      payment_terms,
      notes,
      active_status,
    } = req.body;

    // Check if vendor exists
    const existingVendor = await prisma.vendors.findUnique({
      where: { vendor_id: vendorId },
    });

    if (!existingVendor) {
      res.status(404).json(errorResponse('Vendor not found'));
      return;
    }

    // If updating vendor name, check for duplicates
    if (vendor_name && vendor_name !== existingVendor.vendor_name) {
      const duplicateVendor = await prisma.vendors.findFirst({
        where: {
          vendor_name: {
            equals: vendor_name,
            mode: 'insensitive',
          },
          vendor_id: {
            not: vendorId,
          },
        },
      });

      if (duplicateVendor) {
        res.status(400).json(errorResponse('Vendor with this name already exists'));
        return;
      }
    }

    const updatedVendor = await prisma.vendors.update({
      where: { vendor_id: vendorId },
      data: {
        vendor_name,
        contact_person,
        email,
        phone,
        pan_card_number,
        bank_name,
        account_number,
        ifsc_code,
        payment_terms,
        notes,
        active_status,
      },
    });

    res.json(successResponse(updatedVendor, 'Vendor updated successfully'));
  } catch (error) {
    console.error('Update vendor error:', error);
    res.status(500).json(errorResponse('Failed to update vendor'));
  }
});

/**
 * DELETE /api/vendors/:id
 * Delete/deactivate a vendor
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const vendorId = parseInt(req.params.id);

    if (isNaN(vendorId)) {
      res.status(400).json(errorResponse('Invalid vendor ID'));
      return;
    }

    // Check if vendor exists
    const vendor = await prisma.vendors.findUnique({
      where: { vendor_id: vendorId },
      include: {
        _count: {
          select: {
            onetime_expenses: true,
            recurring_expenses: true,
          },
        },
      },
    });

    if (!vendor) {
      res.status(404).json(errorResponse('Vendor not found'));
      return;
    }

    // If vendor has expenses, just deactivate instead of delete
    if (vendor._count.onetime_expenses > 0 || vendor._count.recurring_expenses > 0) {
      const deactivatedVendor = await prisma.vendors.update({
        where: { vendor_id: vendorId },
        data: { active_status: false },
      });

      res.json(successResponse(deactivatedVendor, 'Vendor deactivated successfully'));
    } else {
      // Safe to delete if no expenses
      await prisma.vendors.delete({
        where: { vendor_id: vendorId },
      });

      res.json(successResponse(null, 'Vendor deleted successfully'));
    }
  } catch (error) {
    console.error('Delete vendor error:', error);
    res.status(500).json(errorResponse('Failed to delete vendor'));
  }
});

export default router;

