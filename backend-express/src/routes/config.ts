import { Router, Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma/client.js';

const router = Router();
const prisma = new PrismaClient();

// ============================================================================
// PRACTICE AREAS
// ============================================================================

router.get('/practice-areas', async (req: Request, res: Response) => {
  try {
    const { active_only } = req.query;
    const practiceAreas = await prisma.practice_areas.findMany({
      where: active_only === 'true' ? { is_active: true } : undefined,
      orderBy: [{ display_order: 'asc' }, { name: 'asc' }],
    });
    res.json(practiceAreas);
  } catch (error) {
    console.error('Error fetching practice areas:', error);
    res.status(500).json({ error: 'Failed to fetch practice areas' });
  }
});

router.post('/practice-areas', async (req: Request, res: Response) => {
  try {
    const { name, description, display_order, is_active } = req.body;
    const practiceArea = await prisma.practice_areas.create({
      data: { name, description, display_order: display_order || 0, is_active: is_active ?? true },
    });
    res.status(201).json(practiceArea);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Practice area with this name already exists' });
    }
    console.error('Error creating practice area:', error);
    res.status(500).json({ error: 'Failed to create practice area' });
  }
});

router.put('/practice-areas/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, display_order, is_active } = req.body;
    const practiceArea = await prisma.practice_areas.update({
      where: { id: parseInt(id) },
      data: { name, description, display_order, is_active },
    });
    res.json(practiceArea);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Practice area not found' });
    }
    console.error('Error updating practice area:', error);
    res.status(500).json({ error: 'Failed to update practice area' });
  }
});

router.delete('/practice-areas/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.practice_areas.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Practice area deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Practice area not found' });
    }
    console.error('Error deleting practice area:', error);
    res.status(500).json({ error: 'Failed to delete practice area' });
  }
});

// ============================================================================
// MATTER TYPES
// ============================================================================

router.get('/matter-types', async (req: Request, res: Response) => {
  try {
    const { active_only } = req.query;
    const matterTypes = await prisma.matter_types.findMany({
      where: active_only === 'true' ? { is_active: true } : undefined,
      orderBy: [{ display_order: 'asc' }, { name: 'asc' }],
    });
    res.json(matterTypes);
  } catch (error) {
    console.error('Error fetching matter types:', error);
    res.status(500).json({ error: 'Failed to fetch matter types' });
  }
});

router.post('/matter-types', async (req: Request, res: Response) => {
  try {
    const { name, description, display_order, is_active } = req.body;
    const matterType = await prisma.matter_types.create({
      data: { name, description, display_order: display_order || 0, is_active: is_active ?? true },
    });
    res.status(201).json(matterType);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Matter type with this name already exists' });
    }
    console.error('Error creating matter type:', error);
    res.status(500).json({ error: 'Failed to create matter type' });
  }
});

router.put('/matter-types/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, display_order, is_active } = req.body;
    const matterType = await prisma.matter_types.update({
      where: { id: parseInt(id) },
      data: { name, description, display_order, is_active },
    });
    res.json(matterType);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Matter type not found' });
    }
    console.error('Error updating matter type:', error);
    res.status(500).json({ error: 'Failed to update matter type' });
  }
});

router.delete('/matter-types/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.matter_types.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Matter type deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Matter type not found' });
    }
    console.error('Error deleting matter type:', error);
    res.status(500).json({ error: 'Failed to delete matter type' });
  }
});

// ============================================================================
// MATTER STATUSES
// ============================================================================

router.get('/matter-statuses', async (req: Request, res: Response) => {
  try {
    const { active_only } = req.query;
    const statuses = await prisma.matter_statuses.findMany({
      where: active_only === 'true' ? { is_active: true } : undefined,
      orderBy: [{ display_order: 'asc' }, { name: 'asc' }],
    });
    res.json(statuses);
  } catch (error) {
    console.error('Error fetching matter statuses:', error);
    res.status(500).json({ error: 'Failed to fetch matter statuses' });
  }
});

router.post('/matter-statuses', async (req: Request, res: Response) => {
  try {
    const { name, code, color, display_order, is_final, is_active } = req.body;
    const status = await prisma.matter_statuses.create({
      data: { name, code, color, display_order: display_order || 0, is_final: is_final ?? false, is_active: is_active ?? true },
    });
    res.status(201).json(status);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Matter status with this name or code already exists' });
    }
    console.error('Error creating matter status:', error);
    res.status(500).json({ error: 'Failed to create matter status' });
  }
});

router.put('/matter-statuses/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const status = await prisma.matter_statuses.update({
      where: { id: parseInt(id) },
      data,
    });
    res.json(status);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Matter status not found' });
    }
    console.error('Error updating matter status:', error);
    res.status(500).json({ error: 'Failed to update matter status' });
  }
});

// ============================================================================
// ACTIVITY TYPES
// ============================================================================

router.get('/activity-types', async (req: Request, res: Response) => {
  try {
    const { active_only, category } = req.query;
    const where: any = {};
    if (active_only === 'true') where.is_active = true;
    if (category) where.category = category;

    const activityTypes = await prisma.activity_types.findMany({
      where,
      orderBy: [{ display_order: 'asc' }, { name: 'asc' }],
    });
    res.json(activityTypes);
  } catch (error) {
    console.error('Error fetching activity types:', error);
    res.status(500).json({ error: 'Failed to fetch activity types' });
  }
});

router.post('/activity-types', async (req: Request, res: Response) => {
  try {
    const { name, category, description, is_billable, display_order, is_active } = req.body;
    const activityType = await prisma.activity_types.create({
      data: { name, category, description, is_billable: is_billable ?? true, display_order: display_order || 0, is_active: is_active ?? true },
    });
    res.status(201).json(activityType);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Activity type with this name already exists' });
    }
    console.error('Error creating activity type:', error);
    res.status(500).json({ error: 'Failed to create activity type' });
  }
});

router.put('/activity-types/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const activityType = await prisma.activity_types.update({
      where: { id: parseInt(id) },
      data,
    });
    res.json(activityType);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Activity type not found' });
    }
    console.error('Error updating activity type:', error);
    res.status(500).json({ error: 'Failed to update activity type' });
  }
});

router.delete('/activity-types/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.activity_types.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Activity type deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Activity type not found' });
    }
    console.error('Error deleting activity type:', error);
    res.status(500).json({ error: 'Failed to delete activity type' });
  }
});

// ============================================================================
// EXPENSE CATEGORIES
// ============================================================================

router.get('/expense-categories', async (req: Request, res: Response) => {
  try {
    const { active_only, flat } = req.query;
    const where: any = {};
    if (active_only === 'true') where.is_active = true;

    const categories = await prisma.expense_categories.findMany({
      where,
      include: flat !== 'true' ? { children: true, parent: true } : undefined,
      orderBy: [{ display_order: 'asc' }, { name: 'asc' }],
    });
    res.json(categories);
  } catch (error) {
    console.error('Error fetching expense categories:', error);
    res.status(500).json({ error: 'Failed to fetch expense categories' });
  }
});

router.post('/expense-categories', async (req: Request, res: Response) => {
  try {
    const { name, code, description, parent_id, is_billable, display_order, is_active } = req.body;
    const category = await prisma.expense_categories.create({
      data: { name, code, description, parent_id, is_billable: is_billable ?? true, display_order: display_order || 0, is_active: is_active ?? true },
    });
    res.status(201).json(category);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Expense category with this name or code already exists' });
    }
    console.error('Error creating expense category:', error);
    res.status(500).json({ error: 'Failed to create expense category' });
  }
});

router.put('/expense-categories/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const category = await prisma.expense_categories.update({
      where: { id: parseInt(id) },
      data,
    });
    res.json(category);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Expense category not found' });
    }
    console.error('Error updating expense category:', error);
    res.status(500).json({ error: 'Failed to update expense category' });
  }
});

router.delete('/expense-categories/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.expense_categories.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Expense category deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Expense category not found' });
    }
    console.error('Error deleting expense category:', error);
    res.status(500).json({ error: 'Failed to delete expense category' });
  }
});

// ============================================================================
// LEAVE TYPES
// ============================================================================

router.get('/leave-types', async (req: Request, res: Response) => {
  try {
    const { active_only } = req.query;
    const leaveTypes = await prisma.leave_types.findMany({
      where: active_only === 'true' ? { is_active: true } : undefined,
      orderBy: [{ display_order: 'asc' }, { name: 'asc' }],
    });
    res.json(leaveTypes);
  } catch (error) {
    console.error('Error fetching leave types:', error);
    res.status(500).json({ error: 'Failed to fetch leave types' });
  }
});

router.post('/leave-types', async (req: Request, res: Response) => {
  try {
    const { name, code, description, days_per_year, carry_forward, max_carry_days, requires_doc, min_notice_days, display_order, is_active } = req.body;
    const leaveType = await prisma.leave_types.create({
      data: {
        name, code, description,
        days_per_year: days_per_year || 0,
        carry_forward: carry_forward ?? false,
        max_carry_days: max_carry_days || 0,
        requires_doc: requires_doc ?? false,
        min_notice_days: min_notice_days || 0,
        display_order: display_order || 0,
        is_active: is_active ?? true
      },
    });
    res.status(201).json(leaveType);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Leave type with this name or code already exists' });
    }
    console.error('Error creating leave type:', error);
    res.status(500).json({ error: 'Failed to create leave type' });
  }
});

router.put('/leave-types/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const leaveType = await prisma.leave_types.update({
      where: { id: parseInt(id) },
      data,
    });
    res.json(leaveType);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Leave type not found' });
    }
    console.error('Error updating leave type:', error);
    res.status(500).json({ error: 'Failed to update leave type' });
  }
});

router.delete('/leave-types/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.leave_types.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Leave type deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Leave type not found' });
    }
    console.error('Error deleting leave type:', error);
    res.status(500).json({ error: 'Failed to delete leave type' });
  }
});

// ============================================================================
// INDUSTRIES
// ============================================================================

router.get('/industries', async (req: Request, res: Response) => {
  try {
    const { active_only } = req.query;
    const industries = await prisma.industries.findMany({
      where: active_only === 'true' ? { is_active: true } : undefined,
      orderBy: [{ display_order: 'asc' }, { name: 'asc' }],
    });
    res.json(industries);
  } catch (error) {
    console.error('Error fetching industries:', error);
    res.status(500).json({ error: 'Failed to fetch industries' });
  }
});

router.post('/industries', async (req: Request, res: Response) => {
  try {
    const { name, description, display_order, is_active } = req.body;
    const industry = await prisma.industries.create({
      data: { name, description, display_order: display_order || 0, is_active: is_active ?? true },
    });
    res.status(201).json(industry);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Industry with this name already exists' });
    }
    console.error('Error creating industry:', error);
    res.status(500).json({ error: 'Failed to create industry' });
  }
});

router.put('/industries/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const industry = await prisma.industries.update({
      where: { id: parseInt(id) },
      data,
    });
    res.json(industry);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Industry not found' });
    }
    console.error('Error updating industry:', error);
    res.status(500).json({ error: 'Failed to update industry' });
  }
});

router.delete('/industries/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.industries.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Industry deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Industry not found' });
    }
    console.error('Error deleting industry:', error);
    res.status(500).json({ error: 'Failed to delete industry' });
  }
});

// ============================================================================
// CURRENCIES
// ============================================================================

router.get('/currencies', async (req: Request, res: Response) => {
  try {
    const { active_only } = req.query;
    const currencies = await prisma.currencies.findMany({
      where: active_only === 'true' ? { is_active: true } : undefined,
      orderBy: [{ is_default: 'desc' }, { code: 'asc' }],
    });
    res.json(currencies);
  } catch (error) {
    console.error('Error fetching currencies:', error);
    res.status(500).json({ error: 'Failed to fetch currencies' });
  }
});

router.post('/currencies', async (req: Request, res: Response) => {
  try {
    const { code, name, symbol, decimal_places, is_default, is_active } = req.body;

    // If setting as default, unset other defaults
    if (is_default) {
      await prisma.currencies.updateMany({
        where: { is_default: true },
        data: { is_default: false },
      });
    }

    const currency = await prisma.currencies.create({
      data: { code, name, symbol, decimal_places: decimal_places ?? 2, is_default: is_default ?? false, is_active: is_active ?? true },
    });
    res.status(201).json(currency);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Currency with this code already exists' });
    }
    console.error('Error creating currency:', error);
    res.status(500).json({ error: 'Failed to create currency' });
  }
});

router.put('/currencies/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const data = req.body;

    // If setting as default, unset other defaults
    if (data.is_default) {
      await prisma.currencies.updateMany({
        where: { is_default: true, NOT: { code } },
        data: { is_default: false },
      });
    }

    const currency = await prisma.currencies.update({
      where: { code },
      data,
    });
    res.json(currency);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Currency not found' });
    }
    console.error('Error updating currency:', error);
    res.status(500).json({ error: 'Failed to update currency' });
  }
});

router.delete('/currencies/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    await prisma.currencies.delete({ where: { code } });
    res.json({ message: 'Currency deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Currency not found' });
    }
    console.error('Error deleting currency:', error);
    res.status(500).json({ error: 'Failed to delete currency' });
  }
});

// ============================================================================
// BILLING TYPES
// ============================================================================

router.get('/billing-types', async (req: Request, res: Response) => {
  try {
    const { active_only } = req.query;
    const billingTypes = await prisma.billing_types.findMany({
      where: active_only === 'true' ? { is_active: true } : undefined,
      orderBy: [{ display_order: 'asc' }, { name: 'asc' }],
    });
    res.json(billingTypes);
  } catch (error) {
    console.error('Error fetching billing types:', error);
    res.status(500).json({ error: 'Failed to fetch billing types' });
  }
});

router.post('/billing-types', async (req: Request, res: Response) => {
  try {
    const { name, code, description, display_order, is_active } = req.body;
    const billingType = await prisma.billing_types.create({
      data: { name, code, description, display_order: display_order || 0, is_active: is_active ?? true },
    });
    res.status(201).json(billingType);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Billing type with this name or code already exists' });
    }
    console.error('Error creating billing type:', error);
    res.status(500).json({ error: 'Failed to create billing type' });
  }
});

router.put('/billing-types/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const billingType = await prisma.billing_types.update({
      where: { id: parseInt(id) },
      data,
    });
    res.json(billingType);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Billing type not found' });
    }
    console.error('Error updating billing type:', error);
    res.status(500).json({ error: 'Failed to update billing type' });
  }
});

// ============================================================================
// FIRM SETTINGS
// ============================================================================

router.get('/firm-settings', async (req: Request, res: Response) => {
  try {
    const { category, public_only } = req.query;
    const where: any = {};
    if (category) where.category = category;
    if (public_only === 'true') where.is_public = true;

    const settings = await prisma.firm_settings.findMany({
      where,
      orderBy: [{ category: 'asc' }, { setting_key: 'asc' }],
    });

    // Convert to key-value object for easier frontend use
    const settingsObject = settings.reduce((acc: any, setting) => {
      let value: any = setting.setting_value;
      if (setting.setting_type === 'number') value = parseFloat(value);
      else if (setting.setting_type === 'boolean') value = value === 'true';
      else if (setting.setting_type === 'json') value = JSON.parse(value);
      acc[setting.setting_key] = { ...setting, parsed_value: value };
      return acc;
    }, {});

    res.json({ settings, settingsObject });
  } catch (error) {
    console.error('Error fetching firm settings:', error);
    res.status(500).json({ error: 'Failed to fetch firm settings' });
  }
});

router.get('/firm-settings/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const setting = await prisma.firm_settings.findUnique({
      where: { setting_key: key },
    });
    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    res.json(setting);
  } catch (error) {
    console.error('Error fetching firm setting:', error);
    res.status(500).json({ error: 'Failed to fetch firm setting' });
  }
});

router.post('/firm-settings', async (req: Request, res: Response) => {
  try {
    const { setting_key, setting_value, setting_type, category, label, description, is_public } = req.body;
    const setting = await prisma.firm_settings.create({
      data: {
        setting_key,
        setting_value: String(setting_value),
        setting_type: setting_type || 'string',
        category: category || 'general',
        label,
        description,
        is_public: is_public ?? false
      },
    });
    res.status(201).json(setting);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Setting with this key already exists' });
    }
    console.error('Error creating firm setting:', error);
    res.status(500).json({ error: 'Failed to create firm setting' });
  }
});

router.put('/firm-settings/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { setting_value, setting_type, category, label, description, is_public } = req.body;
    const setting = await prisma.firm_settings.upsert({
      where: { setting_key: key },
      update: { setting_value: String(setting_value), setting_type, category, label, description, is_public },
      create: { setting_key: key, setting_value: String(setting_value), setting_type: setting_type || 'string', category: category || 'general', label, description, is_public: is_public ?? false },
    });
    res.json(setting);
  } catch (error) {
    console.error('Error updating firm setting:', error);
    res.status(500).json({ error: 'Failed to update firm setting' });
  }
});

router.delete('/firm-settings/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    await prisma.firm_settings.delete({ where: { setting_key: key } });
    res.json({ message: 'Setting deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Setting not found' });
    }
    console.error('Error deleting firm setting:', error);
    res.status(500).json({ error: 'Failed to delete firm setting' });
  }
});

// ============================================================================
// LOCATIONS (Enhanced)
// ============================================================================

router.get('/locations', async (req: Request, res: Response) => {
  try {
    const { active_only, billing_only } = req.query;
    const where: any = {};
    if (active_only === 'true') where.active_status = true;
    if (billing_only === 'true') where.is_billing_location = true;

    const locations = await prisma.locations.findMany({
      where,
      orderBy: { location_name: 'asc' },
    });
    res.json(locations);
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

router.post('/locations', async (req: Request, res: Response) => {
  try {
    const location = await prisma.locations.create({
      data: req.body,
    });
    res.status(201).json(location);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Location with this code already exists' });
    }
    console.error('Error creating location:', error);
    res.status(500).json({ error: 'Failed to create location' });
  }
});

router.put('/locations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const location = await prisma.locations.update({
      where: { location_id: parseInt(id) },
      data: req.body,
    });
    res.json(location);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Location not found' });
    }
    console.error('Error updating location:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

router.delete('/locations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Soft delete - just set active_status to false
    await prisma.locations.update({
      where: { location_id: parseInt(id) },
      data: { active_status: false },
    });
    res.json({ message: 'Location deactivated' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Location not found' });
    }
    console.error('Error deleting location:', error);
    res.status(500).json({ error: 'Failed to delete location' });
  }
});

// ============================================================================
// AUDIT LOGS (Read Only)
// ============================================================================

router.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const { entity_type, entity_id, changed_by, action, page = '1', limit = '50' } = req.query;
    const where: any = {};
    if (entity_type) where.entity_type = entity_type;
    if (entity_id) where.entity_id = parseInt(entity_id as string);
    if (changed_by) where.changed_by = parseInt(changed_by as string);
    if (action) where.action = action;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [logs, total] = await Promise.all([
      prisma.audit_logs.findMany({
        where,
        include: { changer: { select: { user_id: true, name: true, email: true } } },
        orderBy: { changed_at: 'desc' },
        skip,
        take,
      }),
      prisma.audit_logs.count({ where }),
    ]);

    res.json({ logs, total, page: parseInt(page as string), limit: parseInt(limit as string), totalPages: Math.ceil(total / take) });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// ============================================================================
// COMBINED CONFIG ENDPOINT (Fetch all active configs at once)
// ============================================================================

router.get('/all', async (req: Request, res: Response) => {
  try {
    const [
      practiceAreas,
      matterTypes,
      matterStatuses,
      activityTypes,
      expenseCategories,
      leaveTypes,
      industries,
      currencies,
      billingTypes,
      locations,
      firmSettings,
    ] = await Promise.all([
      prisma.practice_areas.findMany({ where: { is_active: true }, orderBy: [{ display_order: 'asc' }, { name: 'asc' }] }),
      prisma.matter_types.findMany({ where: { is_active: true }, orderBy: [{ display_order: 'asc' }, { name: 'asc' }] }),
      prisma.matter_statuses.findMany({ where: { is_active: true }, orderBy: [{ display_order: 'asc' }, { name: 'asc' }] }),
      prisma.activity_types.findMany({ where: { is_active: true }, orderBy: [{ display_order: 'asc' }, { name: 'asc' }] }),
      prisma.expense_categories.findMany({ where: { is_active: true }, orderBy: [{ display_order: 'asc' }, { name: 'asc' }] }),
      prisma.leave_types.findMany({ where: { is_active: true }, orderBy: [{ display_order: 'asc' }, { name: 'asc' }] }),
      prisma.industries.findMany({ where: { is_active: true }, orderBy: [{ display_order: 'asc' }, { name: 'asc' }] }),
      prisma.currencies.findMany({ where: { is_active: true }, orderBy: [{ is_default: 'desc' }, { code: 'asc' }] }),
      prisma.billing_types.findMany({ where: { is_active: true }, orderBy: [{ display_order: 'asc' }, { name: 'asc' }] }),
      prisma.locations.findMany({ where: { active_status: true }, orderBy: { location_name: 'asc' } }),
      prisma.firm_settings.findMany({ where: { is_public: true } }),
    ]);

    res.json({
      practiceAreas,
      matterTypes,
      matterStatuses,
      activityTypes,
      expenseCategories,
      leaveTypes,
      industries,
      currencies,
      billingTypes,
      locations,
      firmSettings,
    });
  } catch (error) {
    console.error('Error fetching all config:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

export default router;
