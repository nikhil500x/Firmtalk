import { Router, Request, Response } from 'express';
import prisma from '../prisma-client';
import { requireAuth, requireRole } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { CurrencyService } from '../services/currency.service';
import multer from 'multer';
import { S3Service } from '../services/s3.service';
import { InvoiceDocumentService } from '../services/invoice-document.service';

// Configure multer for invoice file uploads (memory storage, 25MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
    ];
    if (allowedMimes.includes(file.mimetype) || 
        file.originalname.endsWith('.pdf') || 
        file.originalname.endsWith('.docx') ||
        file.originalname.endsWith('.doc')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and Word documents (.pdf, .doc, .docx) are allowed.'));
    }
  }
});

const router = Router();

// Apply role-based access control for all invoice routes
router.use(requireRole(['superadmin','partner', 'admin', 'accountant', 'it']));

// ============================================================================
// OFFICE CODE MAPPING FOR INVOICE NUMBER GENERATION
// ============================================================================
const OFFICE_CODES: Record<string, string> = {
  'delhi': 'D',
  'mumbai': 'M',
  'bangalore': 'B',
  'delhi (lt)': 'LT',
};

/**
 * Generate invoice number in format: DDMMYYYY-OFFICE or DDMMYYYY-OFFICE-A/B/C for duplicates
 * First invoice of the day: DDMMYYYY-OFFICE (no suffix)
 * Second invoice: DDMMYYYY-OFFICE-A
 * Third invoice: DDMMYYYY-OFFICE-B, etc.
 */
async function generateInvoiceNumber(invoiceDate: Date | string, billingLocation: string): Promise<string> {
  // ✅ Use UTC methods to avoid timezone issues - invoice number should be based on calendar date
  // Parse the date to get year, month, day components without timezone conversion
  let year: number, month: number, day: number;
  
  // If it's a string (e.g., "2026-01-08"), parse it directly to avoid timezone issues
  if (typeof invoiceDate === 'string') {
    const dateMatch = invoiceDate.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      year = parseInt(dateMatch[1], 10);
      month = parseInt(dateMatch[2], 10);
      day = parseInt(dateMatch[3], 10);
    } else {
      // Fallback: parse as Date and use UTC methods
      const d = new Date(invoiceDate);
      year = d.getUTCFullYear();
      month = d.getUTCMonth() + 1; // getUTCMonth() returns 0-11
      day = d.getUTCDate();
    }
  } else {
    // If it's a Date object, use UTC methods to get the calendar date regardless of timezone
    year = invoiceDate.getUTCFullYear();
    month = invoiceDate.getUTCMonth() + 1; // getUTCMonth() returns 0-11
    day = invoiceDate.getUTCDate();
  }
  
  // Format date as DDMMYYYY
  const dateStr = `${String(day).padStart(2, '0')}${String(month).padStart(2, '0')}${year}`;
  
  // Get office code
  const officeCode = OFFICE_CODES[billingLocation.toLowerCase()] || 'M'; // Default to Mumbai
  
  // Get start and end of the invoice date (UTC) - use the extracted year, month, day
  const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  
  console.log(`[Invoice Number Generation] Starting - Date: ${dateStr}, Office: ${officeCode}`);
  console.log(`[Invoice Number Generation] Date range: ${dayStart.toISOString()} to ${dayEnd.toISOString()}`);
  
  // Get ALL invoices for this date first (without format filtering)
  const allInvoicesForDate = await prisma.invoices.findMany({
    where: {
      invoice_date: {
        gte: dayStart,
        lte: dayEnd,
      },
    },
    select: {
      invoice_number: true,
      invoice_date: true,
    },
  });
  
  console.log(`[Invoice Number Generation] Total invoices found for date: ${allInvoicesForDate.length}`);
  
  // Now filter to only invoices matching the new format pattern
  const newFormatPattern = /^\d{8}-(D|M|B|LT)(-[A-Z]+)?$/;
  const validInvoices = allInvoicesForDate.filter(inv => {
    const matches = newFormatPattern.test(inv.invoice_number);
    if (matches) {
      console.log(`[Invoice Number Generation] Valid invoice found: ${inv.invoice_number}`);
    }
    return matches;
  });
  
  // Determine invoice number based on count
  const count = validInvoices.length;
  
  console.log(`[Invoice Number Generation] Valid new format invoices: ${count}`);
  if (validInvoices.length > 0) {
    console.log(`[Invoice Number Generation] Existing invoices:`, validInvoices.map(i => `${i.invoice_number} (date: ${i.invoice_date.toISOString()})`));
  }
  
  if (count === 0) {
    // First invoice of the day - no suffix
    const invoiceNumber = `${dateStr}-${officeCode}`;
    console.log(`[Invoice Number Generation] ✅ Returning FIRST invoice (no suffix): ${invoiceNumber}`);
    return invoiceNumber;
  } else {
    // 2nd, 3rd, etc. - add suffix (A, B, C...)
    // count=1 means this is 2nd invoice, so suffix = A (index 0)
    const suffix = numberToSequence(count - 1);
    const invoiceNumber = `${dateStr}-${officeCode}-${suffix}`;
    console.log(`[Invoice Number Generation] ⚠️ Returning invoice #${count + 1} with suffix: ${invoiceNumber}`);
    return invoiceNumber;
  }
}

/**
 * Convert number to sequence letter (0=A, 1=B, ..., 25=Z, 26=AA, 27=AB, ...)
 */
function numberToSequence(num: number): string {
  let result = '';
  let n = num;
  
  do {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  
  return result;
}

/**
 * Validate invoice number format: DDMMYYYY-OFFICE or DDMMYYYY-OFFICE-SEQ
 */
function validateInvoiceNumberFormat(invoiceNumber: string): { valid: boolean; error?: string } {
  // Regex: 8 digits - (D|M|B|LT) with optional -[A-Z]+ suffix
  // Valid: 07012026-M, 07012026-M-A, 07012026-LT-AB
  const regex = /^\d{8}-(D|M|B|LT)(-[A-Z]+)?$/;
  
  if (!regex.test(invoiceNumber)) {
    return {
      valid: false,
      error: 'Invoice number must follow format: DDMMYYYY-OFFICE or DDMMYYYY-OFFICE-A (e.g., 07012026-M or 07012026-M-A)',
    };
  }
  
  // Validate the date portion
  const dateStr = invoiceNumber.substring(0, 8);
  const day = parseInt(dateStr.substring(0, 2));
  const month = parseInt(dateStr.substring(2, 4));
  const year = parseInt(dateStr.substring(4, 8));
  
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000 || year > 2100) {
    return {
      valid: false,
      error: 'Invalid date in invoice number',
    };
  }
  
  return { valid: true };
}

/**
 * Helper function to calculate invoice status
 */
function calculateInvoiceStatus(invoice: any): string {
  const now = new Date();
  const dueDate = new Date(invoice.due_date);
  
  if (invoice.amount_paid >= invoice.invoice_amount) {
    return 'paid';
  } else if (invoice.amount_paid > 0) {
    return 'partially_paid';
  } else if (dueDate < now) {
    return 'overdue';
  } else {
    return 'new';
  }
}

/**
 * Derive parent invoice status from split invoices
 */
function deriveParentInvoiceStatus(splitInvoices: any[]): string {
  if (!splitInvoices || splitInvoices.length === 0) {
    return 'new';
  }

  const splitStatuses = splitInvoices.map(split => {
    const splitStatus = calculateInvoiceStatus(split);
    return splitStatus;
  });

  // If all splits are paid, parent is paid
  if (splitStatuses.every(status => status === 'paid')) {
    return 'paid';
  }

  // If any split is paid or partially paid, parent is partially paid
  if (splitStatuses.some(status => status === 'paid' || status === 'partially_paid')) {
    return 'partially_paid';
  }

  // Check if any split is overdue
  const now = new Date();
  const hasOverdue = splitInvoices.some(split => {
    const dueDate = new Date(split.due_date);
    return dueDate < now && split.amount_paid === 0;
  });

  if (hasOverdue) {
    return 'overdue';
  }

  // Default to finalized or new based on parent invoice status
  return 'finalized';
}

/**
 * GET /api/invoices
 * Get all invoices with optional filters
 * ⚠️ MUST BE FIRST - matches exact path only
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { clientId, matterId, status, startDate, endDate } = req.query;

    const where: any = {};

    if (clientId) {
      where.client_id = parseInt(clientId as string);
    }

    if (matterId) {
      where.matter_id = parseInt(matterId as string);
    }

    if (status) {
      where.status = status as string;
    }

    if (startDate || endDate) {
      where.invoice_date = {};
      if (startDate) {
        where.invoice_date.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.invoice_date.lte = new Date(endDate as string);
      }
    }

    // Filter out split invoices (only show parent invoices and non-split invoices)
    where.parent_invoice_id = null;

    const invoices = await prisma.invoices.findMany({
      where,
      include: {
        client: {
          select: {
            client_id: true,
            client_name: true,
            address: true,
          },
        },
        matter: {
          select: {
            matter_id: true,
            matter_title: true,
          },
        },
        creator: {
          select: {
            user_id: true,
            name: true,
          },
        },
        split_invoices: {
          include: {
            payments: true,
            client: {
              select: {
                client_id: true,
                client_name: true,
              },
            },
            matter: {
              select: {
                matter_id: true,
                matter_title: true,
              },
            },
          },
        },
      },
      orderBy: {
        invoice_date: 'desc',
      },
    });

    const formattedInvoices = invoices.map((invoice) => {
      const isParent = invoice.split_invoices && invoice.split_invoices.length > 0;
      
      // Calculate split payment summary for parent invoices
      let splitPaymentSummary: any = null;
      if (isParent && invoice.split_invoices) {
        let totalPaid = 0;
        const splits = invoice.split_invoices.map((split: any) => {
          const splitFinalAmount = split.final_amount || split.invoice_amount || 0;
          const splitPaid = split.amount_paid || 0;
          const splitDue = splitFinalAmount - splitPaid;
          totalPaid += splitPaid;

          return {
            invoiceNumber: split.invoice_number,
            invoiceId: split.invoice_id,
            amountPaid: splitPaid,
            finalAmount: splitFinalAmount,
            amountDue: splitDue,
            currency: split.invoice_currency || split.matter_currency || 'INR',
            status: calculateInvoiceStatus(split),
          };
        });

        splitPaymentSummary = {
          totalPaid,
          splits,
        };
      }

      // Derive status for parent invoices
      let invoiceStatus = calculateInvoiceStatus(invoice);
      if (isParent && invoice.split_invoices) {
        invoiceStatus = deriveParentInvoiceStatus(invoice.split_invoices);
      }

      return {
        id: invoice.invoice_id,
        invoiceNumber: invoice.invoice_number,
        clientId: invoice.client_id,
        matterId: invoice.matter_id,
        invoiceDate: invoice.invoice_date.toISOString(),
        dueDate: invoice.due_date.toISOString(),
        invoiceAmount: invoice.invoice_amount || 0,
        finalAmount: invoice.final_amount || invoice.invoice_amount || 0,
        subtotal: invoice.subtotal || invoice.invoice_amount || 0,
        amountPaid: invoice.amount_paid,
        isSplit: invoice.isSplit,
        status: invoiceStatus,
        description: invoice.description,
        notes: invoice.notes,
        billingLocation: invoice.billing_location,
        createdBy: invoice.created_by,
        createdAt: invoice.created_at.toISOString(),
        updatedAt: invoice.updated_at.toISOString(),
        matter_currency: invoice.matter_currency,
        invoice_currency: invoice.invoice_currency,
        currency_conversion_rate: invoice.currency_conversion_rate,
        invoice_amount_in_matter_currency: invoice.invoice_amount_in_matter_currency,
        isParent,
        splitCount: isParent ? invoice.split_invoices.length : 0,
        splitPaymentSummary,
        client: {
          id: invoice.client.client_id,
          name: invoice.client.client_name,
          address: invoice.client.address,
        },
        matter: invoice.matter ? {
          id: invoice.matter.matter_id,
          title: invoice.matter.matter_title,
        } : null,
        creator: {
          id: invoice.creator.user_id,
          name: invoice.creator.name,
        },
      };
    });

    return res.status(200).json(successResponse(formattedInvoices, 'Invoices retrieved successfully'));
  } catch (error) {
    console.error('❌ Error fetching invoices:', error);
    return res.status(500).json(errorResponse('Failed to fetch invoices', error));
  }
});

/**
 * GET /api/invoices/paid-this-week
 * Get all invoices that received payments this week (Monday-Sunday)
 */
router.get('/paid-this-week', async (req: Request, res: Response) => {
  try {
    // Calculate current week boundaries (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Get all payments made this week
    const payments = await prisma.invoice_payments.findMany({
      where: {
        payment_date: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      include: {
        invoice: {
          select: {
            invoice_id: true,
            invoice_number: true,
            client_id: true,
            matter_id: true,
            invoice_amount: true,
            amount_paid: true,
            due_date: true,
            billing_location: true,
            parent_invoice_id: true, // Include to filter split invoices
            client: {
              select: {
                client_id: true,
                client_name: true,
              },
            },
            matter: {
              select: {
                matter_id: true,
                matter_title: true,
              },
            },
          },
        },
        recorder: {
          select: {
            user_id: true,
            name: true,
          },
        },
      },
      orderBy: {
        payment_date: 'desc',
      },
    });

    // Filter out payments on split invoices (only show payments on parent or non-split invoices)
    const filteredPayments = payments.filter(payment => !payment.invoice.parent_invoice_id);

    const formattedPayments = filteredPayments.map((payment) => ({
      paymentId: payment.payment_id,
      invoiceId: payment.invoice_id,
      invoiceNumber: payment.invoice.invoice_number,
      clientId: payment.invoice.client_id,
      clientName: payment.invoice.client?.client_name || 'N/A',
      matterId: payment.invoice.matter_id,
      matterTitle: payment.invoice.matter?.matter_title || 'N/A',
      paymentAmount: payment.amount,
      totalInvoiceAmount: payment.invoice.invoice_amount || 0,
      amountPaid: payment.invoice.amount_paid,
      paymentDate: payment.payment_date.toISOString(),
      paymentMethod: payment.payment_method,
      transactionRef: payment.transaction_ref,
      notes: payment.notes,
      recordedBy: payment.recorder?.name || 'N/A',
      invoiceStatus: calculateInvoiceStatus(payment.invoice),
      billingLocation: payment.invoice.billing_location,
    }));

    // Calculate total paid this week
    const totalPaidThisWeek = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

    res.json(successResponse({
      payments: formattedPayments,
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      totalPayments: filteredPayments.length,
      totalPaidThisWeek,
    }, 'Payments for this week fetched successfully'));
  } catch (error) {
    console.error('Error fetching paid invoices this week:', error);
    res.status(500).json(errorResponse('Failed to fetch paid invoices'));
  }
});

/**
 * GET /api/invoices/generate-number
 * Generate a suggested invoice number based on date and location
 */
router.get('/generate-number', async (req: Request, res: Response) => {
  try {
    const { date, location } = req.query;

    if (!date || !location) {
      return res.status(400).json(errorResponse('Date and location are required'));
    }

    const invoiceDate = new Date(date as string);
    if (isNaN(invoiceDate.getTime())) {
      return res.status(400).json(errorResponse('Invalid date format'));
    }

    const billingLocation = (location as string).toLowerCase();
    if (!OFFICE_CODES[billingLocation]) {
      return res.status(400).json(errorResponse(
        `Invalid location. Must be one of: ${Object.keys(OFFICE_CODES).join(', ')}`
      ));
    }

    const suggestedNumber = await generateInvoiceNumber(invoiceDate, billingLocation);

    res.json(successResponse({
      invoiceNumber: suggestedNumber,
      date: invoiceDate.toISOString().split('T')[0],
      location: billingLocation,
      officeCode: OFFICE_CODES[billingLocation],
    }, 'Invoice number generated successfully'));
  } catch (error) {
    console.error('Error generating invoice number:', error);
    res.status(500).json(errorResponse('Failed to generate invoice number'));
  }
});

/**
 * GET /api/invoices/debug-date
 * Debug endpoint to check what invoices exist for a given date
 */
router.get('/debug-date', async (req: Request, res: Response) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json(errorResponse('Date is required'));
    }

    const invoiceDate = new Date(date as string);
    if (isNaN(invoiceDate.getTime())) {
      return res.status(400).json(errorResponse('Invalid date format'));
    }

    const dayStart = new Date(invoiceDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(invoiceDate);
    dayEnd.setHours(23, 59, 59, 999);

    const dateStr = `${String(invoiceDate.getDate()).padStart(2, '0')}${String(invoiceDate.getMonth() + 1).padStart(2, '0')}${String(invoiceDate.getFullYear())}`;

    // Get ALL invoices for this date (any format)
    const allInvoices = await prisma.invoices.findMany({
      where: {
        invoice_date: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      select: {
        invoice_id: true,
        invoice_number: true,
        invoice_date: true,
        billing_location: true,
      },
      orderBy: {
        invoice_date: 'asc',
      },
    });

    // Get invoices matching new format
    const newFormatInvoices = allInvoices.filter(inv => {
      const pattern = /^\d{8}-(D|M|B|LT)(-[A-Z]+)?$/;
      return pattern.test(inv.invoice_number);
    });

    res.json(successResponse({
      date: invoiceDate.toISOString().split('T')[0],
      dateStr,
      dayRange: {
        start: dayStart.toISOString(),
        end: dayEnd.toISOString(),
      },
      totalInvoices: allInvoices.length,
      newFormatInvoices: newFormatInvoices.length,
      allInvoices: allInvoices.map(inv => ({
        id: inv.invoice_id,
        number: inv.invoice_number,
        date: inv.invoice_date.toISOString().split('T')[0],
        location: inv.billing_location,
        isNewFormat: /^\d{8}-(D|M|B|LT)(-[A-Z]+)?$/.test(inv.invoice_number),
      })),
    }, 'Date debug information fetched successfully'));
  } catch (error) {
    console.error('Error fetching date debug info:', error);
    res.status(500).json(errorResponse('Failed to fetch date debug information'));
  }
});

/**
 * GET /api/invoices/fy-monthly-summary
 * Get monthly breakdown of payments for the current financial year (Apr 1 - Mar 31)
 */
router.get('/fy-monthly-summary', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11
    const currentYear = now.getFullYear();
    
    // Determine financial year
    // If current month is April (3) or later, FY starts this year
    // If current month is Jan-Mar (0-2), FY started last year
    const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
    const fyEndYear = fyStartYear + 1;
    
    const fyStart = new Date(fyStartYear, 3, 1); // April 1
    fyStart.setHours(0, 0, 0, 0);
    
    const fyEnd = new Date(fyEndYear, 2, 31); // March 31
    fyEnd.setHours(23, 59, 59, 999);

    // Get all payments in the financial year
    const payments = await prisma.invoice_payments.findMany({
      where: {
        payment_date: {
          gte: fyStart,
          lte: fyEnd,
        },
      },
      select: {
        amount: true,
        payment_date: true,
      },
    });

    // Group by month
    const monthlyTotals: Record<string, number> = {};
    const monthNames = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    
    // Initialize all months with 0
    monthNames.forEach((month, index) => {
      const year = index < 9 ? fyStartYear : fyEndYear;
      const key = `${month} ${year}`;
      monthlyTotals[key] = 0;
    });

    // Sum up payments by month
    payments.forEach((payment) => {
      const paymentDate = new Date(payment.payment_date);
      const paymentMonth = paymentDate.getMonth();
      const paymentYear = paymentDate.getFullYear();
      
      // Convert to FY month index (April = 0, March = 11)
      const fyMonthIndex = paymentMonth >= 3 ? paymentMonth - 3 : paymentMonth + 9;
      const monthName = monthNames[fyMonthIndex];
      const key = `${monthName} ${paymentYear}`;
      
      if (monthlyTotals.hasOwnProperty(key)) {
        monthlyTotals[key] += payment.amount;
      }
    });

    // Convert to array format
    const months = monthNames.map((month, index) => {
      const year = index < 9 ? fyStartYear : fyEndYear;
      const key = `${month} ${year}`;
      return {
        month: key,
        monthShort: month,
        year,
        total: monthlyTotals[key] || 0,
      };
    });

    // Calculate grand total
    const grandTotal = payments.reduce((sum, p) => sum + p.amount, 0);

    res.json(successResponse({
      fyStart: fyStart.toISOString().split('T')[0],
      fyEnd: fyEnd.toISOString().split('T')[0],
      fyLabel: `FY ${fyStartYear}-${fyEndYear.toString().slice(-2)}`,
      months,
      grandTotal,
      totalPayments: payments.length,
    }, 'FY monthly summary fetched successfully'));
  } catch (error) {
    console.error('Error fetching FY monthly summary:', error);
    res.status(500).json(errorResponse('Failed to fetch FY monthly summary'));
  }
});

/**
 * POST /api/invoices/detect-currencies
 * Detect all unique currencies from selected matters/timesheets
 * Returns currency breakdown to help user select invoice currency and exchange rates
 */
router.post('/detect-currencies', requireAuth, async (req: Request, res: Response) => {
  try {
    const { matterIds, timesheetIds } = req.body;

    if (!matterIds || !Array.isArray(matterIds) || matterIds.length === 0) {
      return res.status(400).json(errorResponse('matterIds array is required'));
    }

    // Get all matters and their currencies
    const matters = await prisma.matters.findMany({
      where: {
        matter_id: { in: matterIds },
      },
      select: {
        matter_id: true,
        matter_title: true,
        currency: true,
      },
    });

    // Get currency breakdown from matters
    const currencyBreakdown: Record<string, {
      currency: string;
      matters: Array<{ id: number; title: string }>;
      amount: number;
    }> = {};

    matters.forEach(matter => {
      const currency = matter.currency || 'INR';
      if (!currencyBreakdown[currency]) {
        currencyBreakdown[currency] = {
          currency,
          matters: [],
          amount: 0,
        };
      }
      currencyBreakdown[currency].matters.push({
        id: matter.matter_id,
        title: matter.matter_title,
      });
    });

    // If timesheets are provided, get currency breakdown from timesheets too
    if (timesheetIds && Array.isArray(timesheetIds) && timesheetIds.length > 0) {
      const timesheets = await prisma.timesheets.findMany({
        where: {
          timesheet_id: { in: timesheetIds },
        },
        select: {
          timesheet_id: true,
          calculated_amount: true,
          calculated_amount_currency: true,
          matter_id: true,
        },
      });

      // Get matter currencies for timesheets that don't have currency
      const timesheetMatterIds = timesheets
        .filter(ts => ts.matter_id && !ts.calculated_amount_currency)
        .map(ts => ts.matter_id!)
        .filter((id, idx, arr) => arr.indexOf(id) === idx); // unique

      const timesheetMatters = await prisma.matters.findMany({
        where: {
          matter_id: { in: timesheetMatterIds },
        },
        select: {
          matter_id: true,
          currency: true,
        },
      });

      const matterCurrencyMap = new Map(
        timesheetMatters.map(m => [m.matter_id, m.currency || 'INR'])
      );

      // Add timesheet amounts to currency breakdown
      timesheets.forEach(ts => {
        const amount = ts.calculated_amount || 0;
        if (amount === 0) return;

        const currency = ts.calculated_amount_currency || 
                        (ts.matter_id ? (matterCurrencyMap.get(ts.matter_id) || 'INR') : 'INR');
        
        if (!currencyBreakdown[currency]) {
          currencyBreakdown[currency] = {
            currency,
            matters: [],
            amount: 0,
          };
        }
        currencyBreakdown[currency].amount += amount;
      });
    }

    // ✅ ADD EXPENSES TO CURRENCY BREAKDOWN (if expenseIds provided)
    if (req.body.expenseIds && Array.isArray(req.body.expenseIds) && req.body.expenseIds.length > 0) {
      const expenses = await prisma.onetime_expenses.findMany({
        where: {
          expense_id: { in: req.body.expenseIds },
          matter_id: { not: null }, // Only include expenses with a matter
        },
        select: {
          expense_id: true,
          amount: true,
          amount_currency: true,
        },
      });

      // Add expenses to INR breakdown (expenses are always in INR)
      expenses.forEach(expense => {
        const amount = expense.amount || 0;
        if (amount === 0) return;
        
        const currency = expense.amount_currency || 'INR';
        
        if (!currencyBreakdown[currency]) {
          currencyBreakdown[currency] = {
            currency,
            matters: [],
            amount: 0,
          };
        }
        currencyBreakdown[currency].amount += amount;
      });
    }

    // Convert to array and sort by currency
    const breakdown = Object.values(currencyBreakdown).sort((a, b) => a.currency.localeCompare(b.currency));
    const uniqueCurrencies = breakdown.map(b => b.currency);

    return res.status(200).json({
      success: true,
      data: {
        currencies: uniqueCurrencies,
        breakdown,
        requiresExchangeRates: uniqueCurrencies.length > 1,
        suggestedInvoiceCurrency: uniqueCurrencies[0] || 'INR', // Suggest first currency or INR
      },
    });
  } catch (error) {
    console.error('Error detecting currencies:', error);
    res.status(500).json(errorResponse('Failed to detect currencies', error));
  }
});

/**
 * POST /api/invoices
 * Create a new invoice
 * ⚠️ MUST BE BEFORE /:id - exact path match
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      clientId,
      matterId, // Deprecated: kept for backward compatibility, prefer matterIds
      matterIds, // NEW: array of matter IDs for multi-matter support
      invoiceNumber: providedInvoiceNumber,
      invoiceDate,
      dueDate,
      invoiceAmount,
      description,
      notes,
      timesheetIds,
      expenseIds, // NEW: Optional array of expense IDs to include
      includeExpenses, // NEW: Optional flag to include expenses
      dateFrom,
      dateTo,
      billingLocation,
      invoiceCurrency,
      exchangeRates, // NEW: Map of { currency: rate } for converting each currency to invoiceCurrency
    } = req.body;

    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json(errorResponse('Unauthorized'));
    }

    // Validation - invoiceNumber is now optional (will be auto-generated)
    if (!clientId || !invoiceDate || !dueDate || !invoiceAmount || !description) {
      return res.status(400).json(errorResponse(
        'Missing required fields: clientId, invoiceDate, dueDate, invoiceAmount, description'
      ));
    }

    // Validate billing location
    if (!billingLocation) {
      return res.status(400).json(errorResponse('Billing location is required'));
    }

    if (invoiceAmount <= 0) {
      return res.status(400).json(errorResponse('Invoice amount must be greater than 0'));
    }

    // Determine matterIds array - support both old (matterId) and new (matterIds) format
    let finalMatterIds: number[] = [];
    if (matterIds && Array.isArray(matterIds) && matterIds.length > 0) {
      finalMatterIds = matterIds;
    } else if (matterId) {
      finalMatterIds = [matterId];
    }

    if (finalMatterIds.length === 0) {
      return res.status(400).json(errorResponse('At least one matter is required'));
    }

    // Generate or validate invoice number
    let invoiceNumber: string;
    const invoiceDateObj = new Date(invoiceDate);

    if (providedInvoiceNumber) {
      // User provided an invoice number - validate format strictly
      const validation = validateInvoiceNumberFormat(providedInvoiceNumber);
      if (!validation.valid) {
        return res.status(400).json(errorResponse(validation.error || 'Invalid invoice number format'));
      }
      invoiceNumber = providedInvoiceNumber;
    } else {
      // Auto-generate invoice number
      invoiceNumber = await generateInvoiceNumber(invoiceDateObj, billingLocation);
    }

    // Check for duplicate invoice number
    const existingInvoice = await prisma.invoices.findUnique({
      where: { invoice_number: invoiceNumber },
    });

    if (existingInvoice) {
      return res.status(409).json(errorResponse('Invoice number already exists'));
    }

    // Validate dates
    const dueDateObj = new Date(dueDate);
    if (dueDateObj < invoiceDateObj) {
      return res.status(400).json(errorResponse('Due date must be after invoice date'));
    }

    // Verify client exists
    const client = await prisma.clients.findUnique({
      where: { client_id: clientId },
    });

    if (!client) {
      return res.status(404).json(errorResponse('Client not found'));
    }

    // Verify all matters exist and belong to the same client, get currencies
    const matters = await prisma.matters.findMany({
      where: {
        matter_id: { in: finalMatterIds },
      },
        select: {
          matter_id: true,
          client_id: true,
          currency: true,
        matter_title: true,
        },
      });

    if (matters.length !== finalMatterIds.length) {
      return res.status(404).json(errorResponse('One or more matters not found'));
    }

    // Validate all matters belong to the same client
    const invalidMatters = matters.filter(m => m.client_id !== clientId);
    if (invalidMatters.length > 0) {
      return res.status(400).json(errorResponse('All matters must belong to the specified client'));
    }

    // ✅ DETECT ALL UNIQUE CURRENCIES FROM MATTERS
    const matterCurrencies = matters.map(m => m.currency || 'INR');
    const uniqueMatterCurrencies = [...new Set(matterCurrencies)];
    const isMultiMatter = finalMatterIds.length > 1;

    // ✅ REQUIRE invoiceCurrency if multiple currencies exist
    if (!invoiceCurrency) {
      if (uniqueMatterCurrencies.length > 1) {
        return res.status(400).json(errorResponse(
          'Invoice currency is required when matters have different currencies. Please provide invoiceCurrency and exchangeRates.'
        ));
      }
    }

    // Validate invoice currency if provided
    const finalInvoiceCurrency = invoiceCurrency || uniqueMatterCurrencies[0] || 'INR';
    if (!CurrencyService.isSupportedCurrency(finalInvoiceCurrency)) {
      return res.status(400).json(errorResponse(
        `Invalid invoice currency. Supported currencies: ${CurrencyService.getSupportedCurrencies().join(', ')}`
      ));
    }

    // ✅ VALIDATE EXCHANGE RATES FOR ALL CURRENCIES (if multi-currency)
    const currenciesNeedingConversion = uniqueMatterCurrencies.filter(c => c !== finalInvoiceCurrency);
    if (currenciesNeedingConversion.length > 0) {
      if (!exchangeRates || typeof exchangeRates !== 'object') {
        return res.status(400).json(errorResponse(
          `Exchange rates are required for multi-currency invoices. Please provide exchangeRates for: ${currenciesNeedingConversion.join(', ')} to ${finalInvoiceCurrency}`
        ));
      }

      // Validate all required exchange rates are provided
      const missingRates = currenciesNeedingConversion.filter(c => !exchangeRates[c] || exchangeRates[c] <= 0);
      if (missingRates.length > 0) {
        return res.status(400).json(errorResponse(
          `Missing or invalid exchange rates for: ${missingRates.join(', ')}. All rates must be > 0.`
        ));
      }
    }

    // Validate timesheets if provided
    if (timesheetIds && timesheetIds.length > 0) {
      // Check if any timesheets are already invoiced
      const alreadyInvoiced = await prisma.invoice_timesheets.findMany({
        where: {
          timesheet_id: { in: timesheetIds },
        },
        include: {
          invoice: {
            select: {
              invoice_number: true,
            },
          },
        },
      });

      if (alreadyInvoiced.length > 0) {
        const invoiceNumbers = alreadyInvoiced.map(it => it.invoice.invoice_number).join(', ');
        return res.status(400).json(errorResponse(
          `Some timesheets are already invoiced in: ${invoiceNumbers}`
        ));
      }

      // Verify all timesheets exist and are approved
      const timesheets = await prisma.timesheets.findMany({
        where: {
          timesheet_id: { in: timesheetIds },
        },
      });

      if (timesheets.length !== timesheetIds.length) {
        return res.status(404).json(errorResponse('Some timesheets not found'));
      }

      // All timesheets are auto-approved on creation (approved_by is set to creator's user_id)
      // No need to check approval status

      // Validate timesheets belong to the selected matters
      const invalidTimesheets = timesheets.filter(ts => ts.matter_id && !finalMatterIds.includes(ts.matter_id));
      if (invalidTimesheets.length > 0) {
        return res.status(400).json(errorResponse('All timesheets must belong to the selected matters'));
      }
    }

    // ✅ FETCH TIMESHEET DETAILS WITH CURRENCY INFO
    let timesheetDetails: Array<{
      timesheet_id: number;
      billable_hours: number | null;
      calculated_amount: number | null;
      hourly_rate: number | null;
      calculated_amount_currency: string | null;
      matter_id: number | null;
    }> = [];
    let subtotal = 0;
    
    if (timesheetIds && timesheetIds.length > 0) {
      timesheetDetails = await prisma.timesheets.findMany({
        where: {
          timesheet_id: { in: timesheetIds },
        },
        select: {
          timesheet_id: true,
          billable_hours: true,
          calculated_amount: true,
          hourly_rate: true,
          calculated_amount_currency: true,
          matter_id: true,
        },
      });

      // ✅ GET MATTER CURRENCIES FOR TIMESHEETS (if timesheet currency is missing)
      const timesheetMatterIds = timesheetDetails
        .map(ts => ts.matter_id)
        .filter((id): id is number => id !== null);
      
      const timesheetMatters = await prisma.matters.findMany({
        where: {
          matter_id: { in: timesheetMatterIds },
        },
        select: {
          matter_id: true,
          currency: true,
        },
      });

      const matterCurrencyMap = new Map(
        timesheetMatters.map(m => [m.matter_id, m.currency || 'INR'])
      );

      // ✅ CONVERT ALL TIMESHEET AMOUNTS TO INVOICE CURRENCY
      // For each timesheet, determine its currency and convert to invoice currency
      subtotal = timesheetDetails.reduce((sum, ts) => {
        const amount = ts.calculated_amount || 0;
        if (amount === 0) return sum;

        // Determine timesheet currency (prefer timesheet currency, fallback to matter currency)
        const tsCurrency = ts.calculated_amount_currency || 
                          (ts.matter_id ? (matterCurrencyMap.get(ts.matter_id) || 'INR') : 'INR');

        // Convert to invoice currency if needed
        if (tsCurrency === finalInvoiceCurrency) {
          return sum + amount;
        } else {
          // Use provided exchange rate
          const exchangeRate = exchangeRates?.[tsCurrency];
          if (!exchangeRate || exchangeRate <= 0) {
            throw new Error(`Missing exchange rate for ${tsCurrency} to ${finalInvoiceCurrency}`);
          }
          return sum + (amount * exchangeRate);
        }
      }, 0);
    }

    // ✅ HANDLE EXPENSES (if includeExpenses flag is true and expenseIds provided)
    let expenseDetails: Array<{
      expense_id: number;
      amount: number;
      amount_currency: string;
      matter_id: number | null;
    }> = [];
    let expenseSubtotal = 0;

    if (includeExpenses && expenseIds && Array.isArray(expenseIds) && expenseIds.length > 0) {
      // Fetch expenses
      expenseDetails = await prisma.onetime_expenses.findMany({
        where: {
          expense_id: { in: expenseIds },
          // ✅ Only include expenses that have a matter (as per plan requirement)
          matter_id: { not: null },
        },
        select: {
          expense_id: true,
          amount: true,
          amount_currency: true,
          matter_id: true,
        },
      });

      if (expenseDetails.length === 0) {
        return res.status(404).json(errorResponse('No valid expenses found (expenses must have a matter)'));
      }

      // Validate all expenses have matter_id
      const invalidExpenses = expenseDetails.filter(e => !e.matter_id);
      if (invalidExpenses.length > 0) {
        return res.status(400).json(errorResponse(
          `Cannot include expenses without matter. Expense IDs: ${invalidExpenses.map(e => e.expense_id).join(', ')}`
        ));
      }

      // ✅ Convert expense amounts to invoice currency
      // Expenses are always in INR, convert to invoice currency if needed
      expenseSubtotal = expenseDetails.reduce((sum, expense) => {
        const amount = expense.amount || 0;
        if (amount === 0) return sum;

        // Expenses are always in INR
        const expenseCurrency = expense.amount_currency || 'INR';
        
        // Convert to invoice currency if needed
        if (expenseCurrency === finalInvoiceCurrency) {
          return sum + amount;
        } else {
          // Use provided exchange rate for INR to invoice currency
          const exchangeRate = exchangeRates?.[expenseCurrency];
          if (!exchangeRate || exchangeRate <= 0) {
            throw new Error(`Missing exchange rate for ${expenseCurrency} (expenses) to ${finalInvoiceCurrency}`);
          }
          return sum + (amount * exchangeRate);
        }
      }, 0);

      // ✅ Update exchange rates to include INR if expenses are being added
      if (!exchangeRates) {
        exchangeRates = {};
      }
      if (finalInvoiceCurrency !== 'INR' && !exchangeRates['INR']) {
        // INR to invoice currency exchange rate is required for expenses
        return res.status(400).json(errorResponse(
          `Exchange rate for INR to ${finalInvoiceCurrency} is required when including expenses`
        ));
      }
    }

    // ✅ ADD EXPENSE SUBTOTAL TO INVOICE SUBTOTAL
    const totalSubtotal = subtotal + expenseSubtotal;
    
    // ✅ STORE EXCHANGE RATES IN DATABASE (store as JSON or use first rate as primary)
    // For backward compatibility, store the primary conversion rate (first currency to invoice)
    let currencyConversionRate = null;
    const primaryCurrency = uniqueMatterCurrencies[0] || 'INR';
    if (primaryCurrency !== finalInvoiceCurrency && exchangeRates?.[primaryCurrency]) {
      currencyConversionRate = exchangeRates[primaryCurrency];
    }

    // ✅ If no timesheets, handle provided invoiceAmount
    let finalInvoiceAmount = parseFloat(invoiceAmount);
    let invoiceAmountInMatterCurrency = null;

    if (!timesheetIds || timesheetIds.length === 0) {
      // No timesheets - convert provided amount if needed
      if (primaryCurrency !== finalInvoiceCurrency) {
        const exchangeRate = exchangeRates?.[primaryCurrency];
        if (!exchangeRate) {
          return res.status(400).json(errorResponse(
            `Exchange rate required for ${primaryCurrency} to ${finalInvoiceCurrency}`
          ));
        }
        invoiceAmountInMatterCurrency = finalInvoiceAmount;
        finalInvoiceAmount = finalInvoiceAmount * exchangeRate;
      }
    } else {
      // ✅ If timesheets exist, use calculated subtotal instead of manual invoiceAmount
      // This ensures invoice_amount matches the actual calculated amount from timesheets + expenses
      finalInvoiceAmount = totalSubtotal;
    }

    const finalAmount = totalSubtotal || finalInvoiceAmount; // Use converted subtotal (timesheets + expenses) if items exist

    // Create invoice with timesheet links in a transaction
    const invoice = await prisma.$transaction(async (tx) => {
      const newInvoice = await tx.invoices.create({
        data: {
          client_id: clientId,
            matter_id: isMultiMatter ? null : finalMatterIds[0], // Set matter_id only for single matter
          invoice_number: invoiceNumber,
          invoice_date: new Date(invoiceDate),
          due_date: new Date(dueDate),
          invoice_amount: finalInvoiceAmount,
          amount_paid: 0,
          isSplit: false,
            status: 'draft', // Changed from 'new' to 'draft'
          description,
          notes: notes || null,
          date_from: dateFrom ? new Date(dateFrom) : null,
          date_to: dateTo ? new Date(dateTo) : null,
            billing_location: billingLocation,
          created_by: userId,
            matter_currency: primaryCurrency, // Store primary matter currency
          invoice_currency: finalInvoiceCurrency,
            currency_conversion_rate: currencyConversionRate, // Primary conversion rate (first currency to invoice)
          invoice_amount_in_matter_currency: invoiceAmountInMatterCurrency,
            // ✅ Store user exchange rate to INR if invoice currency is not INR
            user_exchange_rate: finalInvoiceCurrency !== 'INR' ? (exchangeRates?.[finalInvoiceCurrency] || null) : null,
            // ✅ Store exchange rates as JSON for multi-currency invoices
            exchange_rates: exchangeRates && Object.keys(exchangeRates).length > 0 ? JSON.stringify(exchangeRates) : null,
            is_multi_matter: isMultiMatter,
            subtotal: totalSubtotal, // ✅ Include expenses in subtotal
            final_amount: finalAmount,
            discount_type: null,
            discount_value: 0,
            discount_amount: 0,
        },
        include: {
          client: {
            select: {
              client_id: true,
              client_name: true,
              address: true,
            },
          },
          matter: {
            select: {
              matter_id: true,
              matter_title: true,
            },
          },
            invoice_matters: {
              include: {
                matter: {
                  select: {
                    matter_id: true,
                    matter_title: true,
                  },
                },
            },
          },
          creator: {
            select: {
              user_id: true,
              name: true,
            },
          },
        },
      });

        // Create invoice_matters records for all matters
        await tx.invoice_matters.createMany({
          data: finalMatterIds.map((mId: number) => ({
            invoice_id: newInvoice.invoice_id,
            matter_id: mId,
          })),
        });

        // Link timesheets to invoice with billed hours copied from original
        if (timesheetIds && timesheetIds.length > 0 && timesheetDetails.length > 0) {
          const timesheetMap = new Map(timesheetDetails.map(ts => [ts.timesheet_id, ts]));
        await tx.invoice_timesheets.createMany({
            data: timesheetIds.map((tsId: number) => {
              const ts = timesheetMap.get(tsId);
              if (!ts) {
                throw new Error(`Timesheet ${tsId} not found`);
              }
              
              // Get original amount and currency
              const originalAmount = ts.calculated_amount || 0;
              const tsCurrency = ts.calculated_amount_currency || 
                                (ts.matter_id ? (matterCurrencyMap.get(ts.matter_id) || 'INR') : 'INR');
              
              // Convert to invoice currency if needed
              let billedAmount = originalAmount;
              if (tsCurrency !== finalInvoiceCurrency && exchangeRates?.[tsCurrency]) {
                billedAmount = originalAmount * exchangeRates[tsCurrency];
              }
              
              return {
            invoice_id: newInvoice.invoice_id,
            timesheet_id: tsId,
                billed_hours: ts.billable_hours || null,
                billed_amount: billedAmount, // ✅ Store converted amount in invoice currency
                hourly_rate: ts.hourly_rate || null,
              };
            }),
        });
      }

      // ✅ Link expenses to invoice with conversion
      if (includeExpenses && expenseIds && expenseIds.length > 0 && expenseDetails.length > 0) {
        const expenseMap = new Map(expenseDetails.map(e => [e.expense_id, e]));
        
        // ✅ Verify invoice_expenses model exists in transaction
        if (!tx.invoice_expenses) {
          console.error('❌ ERROR: tx.invoice_expenses is undefined. Prisma client may need regeneration or server restart.');
          throw new Error('Invoice expenses model not available. Please restart the server after Prisma client regeneration.');
        }
        
        await tx.invoice_expenses.createMany({
          data: expenseIds.map((expenseId: number) => {
            const expense = expenseMap.get(expenseId);
            if (!expense) {
              throw new Error(`Expense ${expenseId} not found`);
            }

            const expenseAmount = expense.amount || 0;
            const expenseCurrency = expense.amount_currency || 'INR';
            
            // Convert expense amount to invoice currency
            let billedAmount = expenseAmount;
            let exchangeRate = null;
            
            if (expenseCurrency !== finalInvoiceCurrency) {
              const rate = exchangeRates?.[expenseCurrency];
              if (!rate || rate <= 0) {
                throw new Error(`Missing exchange rate for ${expenseCurrency} to ${finalInvoiceCurrency}`);
              }
              exchangeRate = rate;
              billedAmount = expenseAmount * rate;
              // Round to 4 decimals internally for precision (will be rounded to 2 for display)
              billedAmount = parseFloat(billedAmount.toFixed(4));
            }

            return {
              invoice_id: newInvoice.invoice_id,
              expense_id: expenseId,
              billed_amount: billedAmount,
              billed_amount_currency: finalInvoiceCurrency,
              original_amount: expenseAmount,
              original_currency: expenseCurrency,
              exchange_rate: exchangeRate,
            };
          }),
        });
      }

      return newInvoice;
    });

    const formattedInvoice = {
      id: invoice.invoice_id,
      invoiceNumber: invoice.invoice_number,
      clientId: invoice.client_id,
      matterId: invoice.matter_id,
      matterIds: invoice.invoice_matters?.map(im => im.matter_id) || (invoice.matter_id ? [invoice.matter_id] : []),
      invoiceDate: invoice.invoice_date.toISOString(),
      dueDate: invoice.due_date.toISOString(),
      invoiceAmount: invoice.invoice_amount || 0,
      // Currency fields (for multi-currency display + conversion)
      matterCurrency: invoice.matter_currency || 'INR',
      invoiceCurrency: invoice.invoice_currency || invoice.matter_currency || 'INR',
      currencyConversionRate: invoice.currency_conversion_rate,
      invoiceAmountInMatterCurrency: invoice.invoice_amount_in_matter_currency,
      amountPaid: invoice.amount_paid,
      isSplit: invoice.isSplit,
      status: invoice.status,
      description: invoice.description,
      notes: invoice.notes,
      billingLocation: invoice.billing_location,
      createdBy: invoice.created_by,
      createdAt: invoice.created_at.toISOString(),
      updatedAt: invoice.updated_at.toISOString(),
      isMultiMatter: invoice.is_multi_matter || false,
      subtotal: invoice.subtotal || 0,
      finalAmount: invoice.final_amount || invoice.invoice_amount || 0,
      discountType: invoice.discount_type,
      discountValue: invoice.discount_value || 0,
      discountAmount: invoice.discount_amount || 0,
      userExchangeRate: invoice.user_exchange_rate,
      amountInINR: invoice.amount_in_inr,
      client: {
        id: invoice.client.client_id,
        name: invoice.client.client_name,
        address: invoice.client.address,
      },
      matter: invoice.matter ? {
        id: invoice.matter.matter_id,
        title: invoice.matter.matter_title,
      } : null,
      matters: invoice.invoice_matters?.map(im => ({
        id: im.matter.matter_id,
        title: im.matter.matter_title,
      })) || [],
      creator: {
        id: invoice.creator.user_id,
        name: invoice.creator.name,
      },
    };

    return res.status(201).json(successResponse(formattedInvoice, 'Invoice created successfully'));
  } catch (error) {
    console.error('Error creating invoice:', error);
    return res.status(500).json(errorResponse('Failed to create invoice', error));
  }
});

/**
 * PUT /api/invoices/:id/timesheets/:timesheetId
 * Update billed hours for a specific timesheet in invoice
 */
router.put('/:id/timesheets/:timesheetId', async (req: Request, res: Response) => {
  try {
    const { id, timesheetId } = req.params;
    const { billedHours, billedAmount, hourlyRate } = req.body;

    const invoice = await prisma.invoices.findUnique({
      where: { invoice_id: parseInt(id) },
      select: { status: true },
    });

    if (!invoice) {
      return res.status(404).json(errorResponse('Invoice not found'));
    }

    // Only allow if status is 'draft'
    if (invoice.status !== 'draft') {
      return res.status(400).json(errorResponse(`Cannot update timesheet details. Invoice status must be 'draft'. Current status: '${invoice.status}'`));
    }

    // Verify timesheet exists and is linked to this invoice
    const invoiceTimesheet = await prisma.invoice_timesheets.findUnique({
      where: {
        invoice_id_timesheet_id: {
          invoice_id: parseInt(id),
          timesheet_id: parseInt(timesheetId),
        },
      },
      include: {
        timesheet: {
          select: {
            hourly_rate: true,
          },
        },
      },
    });

    if (!invoiceTimesheet) {
      return res.status(404).json(errorResponse('Timesheet not found in this invoice'));
    }

    // ✅ Determine hourly rate (use provided hourlyRate, otherwise use existing)
    const rateToUse = hourlyRate !== undefined ? hourlyRate : (invoiceTimesheet.hourly_rate || invoiceTimesheet.timesheet.hourly_rate || 0);
    
    // Determine billed hours to use (use provided billedHours, otherwise use existing)
    const billedHoursToUse = billedHours !== undefined ? billedHours : invoiceTimesheet.billed_hours;
    
    // ✅ Calculate billed_amount: Always recalculate from billed_hours * hourly_rate to ensure correctness
    let calculatedBilledAmount = billedAmount;
    
    if (billedHoursToUse !== undefined && billedHoursToUse !== null && rateToUse > 0) {
      // billedHours is in minutes, convert to hours then multiply by rate
      calculatedBilledAmount = (billedHoursToUse / 60) * rateToUse;
    } else if (calculatedBilledAmount === undefined || calculatedBilledAmount === null) {
      // If no billedHours provided but we need to calculate, use existing billed_hours
      const existingBilledHours = invoiceTimesheet.billed_hours || 0;
      if (existingBilledHours > 0 && rateToUse > 0) {
        calculatedBilledAmount = (existingBilledHours / 60) * rateToUse;
      } else {
        calculatedBilledAmount = invoiceTimesheet.billed_amount || 0;
      }
    }

    // Update billed hours, hourly rate, and amount
    await prisma.invoice_timesheets.update({
      where: {
        invoice_id_timesheet_id: {
          invoice_id: parseInt(id),
          timesheet_id: parseInt(timesheetId),
        },
      },
      data: {
        billed_hours: billedHours !== undefined ? billedHours : invoiceTimesheet.billed_hours,
        hourly_rate: hourlyRate !== undefined ? hourlyRate : invoiceTimesheet.hourly_rate,
        billed_amount: calculatedBilledAmount !== undefined ? calculatedBilledAmount : invoiceTimesheet.billed_amount,
      },
    });

    // Recalculate invoice subtotal and final_amount
    const allInvoiceTimesheets = await prisma.invoice_timesheets.findMany({
      where: { invoice_id: parseInt(id) },
      select: { billed_amount: true },
    });

    const subtotal = allInvoiceTimesheets.reduce((sum, it) => sum + (it.billed_amount || 0), 0);

    // Get current discount
    const currentInvoice = await prisma.invoices.findUnique({
      where: { invoice_id: parseInt(id) },
      select: {
        discount_type: true,
        discount_value: true,
        user_exchange_rate: true,
      },
    });

    let discountAmount = 0;
    if (currentInvoice?.discount_type && currentInvoice.discount_value !== undefined) {
      if (currentInvoice.discount_type === 'percentage') {
        discountAmount = subtotal * (currentInvoice.discount_value / 100);
      } else {
        discountAmount = currentInvoice.discount_value;
      }
      // Enforce limits
      discountAmount = Math.min(discountAmount, subtotal);
      discountAmount = Math.max(0, discountAmount);
    }

    const finalAmount = subtotal - discountAmount;
    let amountInINR = null;
    if (currentInvoice?.user_exchange_rate) {
      amountInINR = finalAmount * currentInvoice.user_exchange_rate;
    }

    // Update invoice totals
    await prisma.invoices.update({
      where: { invoice_id: parseInt(id) },
      data: {
        subtotal,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        amount_in_inr: amountInINR,
        invoice_amount: finalAmount, // Keep invoice_amount in sync
      },
    });

    return res.status(200).json(successResponse({
      billedHours: billedHours !== undefined ? billedHours : invoiceTimesheet.billed_hours,
      billedAmount: calculatedBilledAmount !== undefined ? calculatedBilledAmount : invoiceTimesheet.billed_amount,
      subtotal,
      discountAmount,
      finalAmount,
      amountInINR,
    }, 'Billed hours updated successfully'));
  } catch (error) {
    console.error('Error updating billed hours:', error);
    return res.status(500).json(errorResponse('Failed to update billed hours', error));
  }
});

/**
 * POST /api/invoices/:id/finalize
 * Finalize draft invoice with optional splits and partner shares
 */
router.post('/:id/finalize', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { splits, partnerShares } = req.body;

    const invoice = await prisma.invoices.findUnique({
      where: { invoice_id: parseInt(id) },
      include: {
        client: {
          select: { group_id: true },
        },
        invoice_matters: {
          include: {
            matter: {
              select: { currency: true },
            },
          },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json(errorResponse('Invoice not found'));
    }

    // Only allow finalizing if status is 'draft'
    if (invoice.status !== 'draft') {
      return res.status(400).json(errorResponse(`Cannot finalize invoice. Current status: '${invoice.status}'. Only draft invoices can be finalized.`));
    }

    // Validate partner shares - required, must total 100%
    if (!partnerShares || !Array.isArray(partnerShares) || partnerShares.length === 0) {
      return res.status(400).json(errorResponse('Partner shares are required'));
    }

    const partnerShareTotal = partnerShares.reduce((sum, ps: any) => sum + (ps.percentage || 0), 0);
    if (Math.abs(partnerShareTotal - 100) > 0.01) {
      return res.status(400).json(errorResponse(`Partner shares must total exactly 100%. Current total: ${partnerShareTotal}%`));
    }

    // ✅ Validate exchange rates for multi-currency invoices
    const invoiceCurrency = invoice.invoice_currency || invoice.matter_currency || 'INR';
    
    // Parse exchange rates from JSON if available
    let exchangeRates: Record<string, number> = {};
    if (invoice.exchange_rates) {
      try {
        exchangeRates = typeof invoice.exchange_rates === 'string' 
          ? JSON.parse(invoice.exchange_rates) 
          : invoice.exchange_rates;
      } catch (e) {
        console.error('Error parsing exchange_rates:', e);
      }
    }
    
    // Get all unique currencies from invoice matters
    const matterCurrencies = invoice.invoice_matters
      ?.map(im => im.matter?.currency || 'INR')
      .filter(Boolean) || [];
    const uniqueCurrencies = [...new Set(matterCurrencies)];
    
    // Check if multi-currency (more than one currency or invoice currency differs from matter currencies)
    const needsConversion = uniqueCurrencies.length > 1 || 
      (uniqueCurrencies.length === 1 && uniqueCurrencies[0] !== invoiceCurrency);
    
    if (needsConversion) {
      // Find currencies that need conversion to invoice currency
      const currenciesNeedingConversion = uniqueCurrencies.filter(c => c !== invoiceCurrency);
      
      if (currenciesNeedingConversion.length > 0) {
        // Check if all required exchange rates are provided
        const missingRates = currenciesNeedingConversion.filter(c => 
          !exchangeRates[c] || exchangeRates[c] <= 0
        );
        
        if (missingRates.length > 0) {
          return res.status(400).json(errorResponse(
            `Exchange rates are required for multi-currency invoices before finalizing. Missing rates for: ${missingRates.join(', ')}`
          ));
        }
      }
    }
    
    // ✅ Also check single currency conversion to INR (legacy support)
    if (invoiceCurrency !== 'INR' && !invoice.user_exchange_rate && Object.keys(exchangeRates).length === 0) {
      // Only error if no exchange rates at all
      if (!invoice.exchange_rates) {
        return res.status(400).json(errorResponse('Exchange rate is required for invoices with non-INR currency before finalizing'));
      }
    }

    // Validate splits if provided
    let finalSplits: Array<{ clientId: number; percentage: number }> = [];
    if (splits && Array.isArray(splits) && splits.length > 0) {
      if (splits.length === 1 && splits[0].percentage === 100) {
        // Single client, no split needed
        finalSplits = [];
      } else {
        // Validate split percentages total 100%
        const splitTotal = splits.reduce((sum, split: any) => sum + (split.percentage || 0), 0);
        if (Math.abs(splitTotal - 100) > 0.01) {
          return res.status(400).json(errorResponse(`Split percentages must total exactly 100%. Current total: ${splitTotal}%`));
        }

        // Validate all split clients belong to same group
        if (invoice.client.group_id === null) {
          return res.status(400).json(errorResponse('Cannot split invoice. Invoice client does not belong to a group'));
        }

        const splitClientIds = splits.map((s: any) => s.clientId);
        const splitClients = await prisma.clients.findMany({
          where: {
            client_id: { in: splitClientIds },
          },
          select: {
            client_id: true,
            client_name: true,
            group_id: true,
          },
        });

        if (splitClients.length !== splitClientIds.length) {
          return res.status(404).json(errorResponse('One or more split clients not found'));
        }

        // Check for duplicate client IDs
        const uniqueClientIds = new Set(splitClientIds);
        if (uniqueClientIds.size !== splitClientIds.length) {
          return res.status(400).json(errorResponse('Duplicate client IDs in splits'));
        }

        // Validate all clients are in same group
        const invalidClients = splitClients.filter(c => c.group_id !== invoice.client.group_id);
        if (invalidClients.length > 0) {
          return res.status(400).json(errorResponse('All split clients must belong to the same group as the invoice client'));
        }

        finalSplits = splits;
      }
    }

    // Finalize invoice(s) in transaction
    const result = await prisma.$transaction(async (tx) => {
      const finalAmount = invoice.final_amount || invoice.invoice_amount || 0;
      const invoicesToFinalize: number[] = [];

      // If splits, create child invoices
      if (finalSplits.length > 1) {
        // Get all invoice_timesheets and invoice_matters to copy
        const invoiceTimesheets = await tx.invoice_timesheets.findMany({
          where: { invoice_id: parseInt(id) },
        });
        const invoiceMatters = await tx.invoice_matters.findMany({
          where: { invoice_id: parseInt(id) },
        });

        // Create child invoices
        for (let i = 0; i < finalSplits.length; i++) {
          const split = finalSplits[i];
          const splitSequence = i + 1;

          // Generate split invoice number: parent-invoice-number-{sequence}
          // Handle cases like: 07012026-M -> 07012026-M-1, or 07012026-M-A -> 07012026-M-A-1
          let splitInvoiceNumber = invoice.invoice_number;
          // Append split sequence
          splitInvoiceNumber = `${splitInvoiceNumber}-${splitSequence}`;

          const splitAmount = finalAmount * (split.percentage / 100);

          const childInvoice = await tx.invoices.create({
            data: {
              parent_invoice_id: parseInt(id),
              client_id: split.clientId,
              matter_id: invoice.matter_id,
              invoice_number: splitInvoiceNumber,
              invoice_date: invoice.invoice_date,
              due_date: invoice.due_date,
              invoice_amount: splitAmount,
              amount_paid: 0,
              isSplit: false,
              status: 'finalized',
              description: invoice.description,
              notes: invoice.notes,
              date_from: invoice.date_from,
              date_to: invoice.date_to,
              billing_location: invoice.billing_location,
              created_by: invoice.created_by,
              matter_currency: invoice.matter_currency,
              invoice_currency: invoice.invoice_currency,
              currency_conversion_rate: invoice.currency_conversion_rate,
              invoice_amount_in_matter_currency: invoice.invoice_amount_in_matter_currency,
              is_multi_matter: invoice.is_multi_matter,
              subtotal: invoice.subtotal ? invoice.subtotal * (split.percentage / 100) : splitAmount,
              final_amount: splitAmount,
              discount_type: invoice.discount_type,
              discount_value: invoice.discount_value,
              discount_amount: invoice.discount_amount ? invoice.discount_amount * (split.percentage / 100) : 0,
              user_exchange_rate: invoice.user_exchange_rate,
              amount_in_inr: invoice.amount_in_inr ? invoice.amount_in_inr * (split.percentage / 100) : null,
              split_percentage: split.percentage,
              split_sequence: splitSequence,
            },
          });

          invoicesToFinalize.push(childInvoice.invoice_id);

          // Copy invoice_matters
          await tx.invoice_matters.createMany({
            data: invoiceMatters.map(im => ({
              invoice_id: childInvoice.invoice_id,
              matter_id: im.matter_id,
            })),
          });

          // Copy invoice_timesheets
          await tx.invoice_timesheets.createMany({
            data: invoiceTimesheets.map(it => ({
              invoice_id: childInvoice.invoice_id,
              timesheet_id: it.timesheet_id,
              billed_hours: it.billed_hours,
              billed_amount: it.billed_amount,
              hourly_rate: it.hourly_rate,
            })),
          });

          // Create partner shares for this split invoice
          await tx.invoice_partner_shares.createMany({
            data: partnerShares.map((ps: any) => ({
              invoice_id: childInvoice.invoice_id,
              partner_user_id: ps.userId,
              share_percentage: ps.percentage,
            })),
          });
        }

        // Mark parent invoice as split
        await tx.invoices.update({
          where: { invoice_id: parseInt(id) },
          data: {
            isSplit: true,
            status: 'finalized',
          },
        });
        invoicesToFinalize.push(parseInt(id));
      } else {
        // No splits, just finalize parent invoice
        await tx.invoices.update({
          where: { invoice_id: parseInt(id) },
          data: { status: 'finalized' },
        });
        invoicesToFinalize.push(parseInt(id));
      }

      // Create partner shares for parent invoice (or if no splits)
      if (finalSplits.length <= 1) {
        await tx.invoice_partner_shares.createMany({
          data: partnerShares.map((ps: any) => ({
            invoice_id: parseInt(id),
            partner_user_id: ps.userId,
            share_percentage: ps.percentage,
          })),
        });
      }

      return invoicesToFinalize;
    });

    return res.status(200).json(successResponse({
      invoiceIds: result,
      message: finalSplits.length > 1 ? `Invoice finalized and split into ${finalSplits.length} invoices` : 'Invoice finalized successfully',
    }, 'Invoice finalized successfully'));
  } catch (error) {
    console.error('Error finalizing invoice:', error);
    return res.status(500).json(errorResponse('Failed to finalize invoice', error));
  }
});

/**
 * POST /api/invoices/:id/upload
 * Upload signed invoice file to cloud storage
 */
router.post('/:id/upload', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json(errorResponse('Unauthorized'));
    }

    if (!req.file) {
      return res.status(400).json(errorResponse('No file uploaded'));
    }

    const invoice = await prisma.invoices.findUnique({
      where: { invoice_id: parseInt(id) },
      select: { status: true },
    });

    if (!invoice) {
      return res.status(404).json(errorResponse('Invoice not found'));
    }

    // Only allow upload if status is 'finalized'
    if (invoice.status !== 'finalized') {
      return res.status(400).json(errorResponse(`Cannot upload invoice. Status must be 'finalized'. Current status: '${invoice.status}'`));
    }

    // Upload file to S3
    const uploadResult = await S3Service.uploadInvoiceFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      parseInt(id),
      userId
    );

    // Update invoice with uploaded file URL
    await prisma.invoices.update({
      where: { invoice_id: parseInt(id) },
      data: {
        uploaded_invoice_url: uploadResult.publicUrl,
        uploaded_at: new Date(),
        status: 'invoice_uploaded',
      },
    });

    return res.status(200).json(successResponse({
      fileUrl: uploadResult.publicUrl,
      fileName: req.file.originalname,
    }, 'Invoice file uploaded successfully'));
  } catch (error) {
    console.error('Error uploading invoice:', error);
    return res.status(500).json(errorResponse('Failed to upload invoice', error));
  }
});

/**
 * GET /api/invoices/:id/download-template
 * Generate and download invoice Word document template
 */
router.get('/:id/download-template', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const invoice = await prisma.invoices.findUnique({
      where: { invoice_id: parseInt(id) },
      include: {
        client: {
          select: {
            client_name: true,
            address: true,
          },
        },
        matter: {
          select: {
            matter_id: true,
            matter_title: true,
          },
        },
        invoice_matters: {
          include: {
            matter: {
              select: {
                matter_id: true,
                matter_title: true,
              },
            },
          },
        },
        invoice_timesheets: {
          include: {
            timesheet: {
              include: {
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        creator: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json(errorResponse('Invoice not found'));
    }

    // Only allow download if status is 'finalized' or later
    if (invoice.status !== 'finalized' && invoice.status !== 'invoice_uploaded' && invoice.status !== 'paid') {
      return res.status(400).json(errorResponse(`Cannot download template. Invoice must be finalized. Current status: '${invoice.status}'`));
    }

    // Prepare data for document generation
    const matters = invoice.invoice_matters?.length > 0
      ? invoice.invoice_matters.map(im => ({ id: im.matter_id, title: im.matter.matter_title }))
      : (invoice.matter ? [{ id: invoice.matter.matter_id, title: invoice.matter.matter_title }] : []);

    const timesheets = (invoice.invoice_timesheets || []).map(it => ({
      date: it.timesheet.date,
      userName: it.timesheet.user.name || 'Unknown',
      description: it.timesheet.description,
      billedHours: it.billed_hours,
      hourlyRate: it.hourly_rate || it.timesheet.hourly_rate,
      billedAmount: it.billed_amount,
    }));

    const documentData = {
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date,
      client: {
        name: invoice.client.client_name,
        address: invoice.client.address,
      },
      matters,
      timesheets,
      subtotal: invoice.subtotal || invoice.invoice_amount || 0,
      discountType: invoice.discount_type,
      discountValue: invoice.discount_value,
      discountAmount: invoice.discount_amount || 0,
      finalAmount: invoice.final_amount || invoice.invoice_amount || 0,
      invoiceCurrency: invoice.invoice_currency || invoice.matter_currency || 'INR',
      userExchangeRate: invoice.user_exchange_rate,
      amountInINR: invoice.amount_in_inr,
      description: invoice.description,
      notes: invoice.notes,
      billingLocation: invoice.billing_location,
    };

    // Generate Word document
    const docBuffer = await InvoiceDocumentService.generateInvoiceDocument(documentData);

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice-${invoice.invoice_number}.docx"`);
    res.setHeader('Content-Length', docBuffer.length.toString());

    return res.send(docBuffer);
  } catch (error) {
    console.error('Error generating invoice template:', error);
    return res.status(500).json(errorResponse('Failed to generate invoice template', error));
  }
});

/**
 * GET /api/invoices/client/:clientId
 * Get all invoices for a specific client
 * ⚠️ MUST BE BEFORE /:id - more specific path
 */
router.get('/client/:clientId', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;

    const invoices = await prisma.invoices.findMany({
      where: { 
        client_id: parseInt(clientId),
        parent_invoice_id: null, // Filter out split invoices
      },
      include: {
        client: {
          select: {
            client_id: true,
            client_name: true,
            address: true,
          },
        },
        matter: {
          select: {
            matter_id: true,
            matter_title: true,
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
        invoice_date: 'desc',
      },
    });

    const formattedInvoices = invoices.map((invoice) => ({
      id: invoice.invoice_id,
      invoiceNumber: invoice.invoice_number,
      clientId: invoice.client_id,
      matterId: invoice.matter_id,
      invoiceDate: invoice.invoice_date.toISOString(),
      dueDate: invoice.due_date.toISOString(),
      invoiceAmount: invoice.invoice_amount || 0,
      amountPaid: invoice.amount_paid,
      isSplit: invoice.isSplit,
      status: calculateInvoiceStatus(invoice),
      description: invoice.description,
      notes: invoice.notes,
      billingLocation: invoice.billing_location, // ✅ ADDED
      createdBy: invoice.created_by,
      createdAt: invoice.created_at.toISOString(),
      updatedAt: invoice.updated_at.toISOString(),
      client: {
        id: invoice.client.client_id,
        name: invoice.client.client_name,
        address: invoice.client.address,
      },
      matter: invoice.matter ? {
        id: invoice.matter.matter_id,
        title: invoice.matter.matter_title,
      } : null,
      creator: {
        id: invoice.creator.user_id,
        name: invoice.creator.name,
      },
    }));

    return res.status(200).json(successResponse(formattedInvoices, 'Client invoices retrieved successfully'));
  } catch (error) {
    console.error('❌ Error fetching client invoices:', error);
    return res.status(500).json(errorResponse('Failed to fetch client invoices', error));
  }
});

/**
 * GET /api/invoices/matter/:matterId
 * Get all invoices for a specific matter
 * ⚠️ MUST BE BEFORE /:id - more specific path
 */
router.get('/matter/:matterId', async (req: Request, res: Response) => {
  try {
    const { matterId } = req.params;

    const invoices = await prisma.invoices.findMany({
      where: { 
        matter_id: parseInt(matterId),
        parent_invoice_id: null, // Filter out split invoices
      },
      include: {
        client: {
          select: {
            client_id: true,
            client_name: true,
            address: true,
          },
        },
        matter: {
          select: {
            matter_id: true,
            matter_title: true,
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
        invoice_date: 'desc',
      },
    });

    const formattedInvoices = invoices.map((invoice) => ({
      id: invoice.invoice_id,
      invoiceNumber: invoice.invoice_number,
      clientId: invoice.client_id,
      matterId: invoice.matter_id,
      invoiceDate: invoice.invoice_date.toISOString(),
      dueDate: invoice.due_date.toISOString(),
      invoiceAmount: invoice.invoice_amount || 0,
      amountPaid: invoice.amount_paid,
      isSplit: invoice.isSplit,
      status: calculateInvoiceStatus(invoice),
      description: invoice.description,
      notes: invoice.notes,
      billingLocation: invoice.billing_location, // ✅ ADDED
      createdBy: invoice.created_by,
      createdAt: invoice.created_at.toISOString(),
      updatedAt: invoice.updated_at.toISOString(),
      client: {
        id: invoice.client.client_id,
        name: invoice.client.client_name,
        address: invoice.client.address,
      },
      matter: invoice.matter ? {
        id: invoice.matter.matter_id,
        title: invoice.matter.matter_title,
      } : null,
      creator: {
        id: invoice.creator.user_id,
        name: invoice.creator.name,
      },
    }));

    return res.status(200).json(successResponse(formattedInvoices, 'Matter invoices retrieved successfully'));
  } catch (error) {
    console.error('❌ Error fetching matter invoices:', error);
    return res.status(500).json(errorResponse('Failed to fetch matter invoices', error));
  }
});

/**
 * GET /api/invoices/:id/splits
 * Get all split invoices for a parent invoice
 * ⚠️ MUST BE BEFORE /:id - more specific path
 */
router.get('/:id/splits', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const splitInvoices = await prisma.invoices.findMany({
      where: { parent_invoice_id: parseInt(id) },
      include: {
        client: {
          select: {
            client_id: true,
            client_name: true,
            address: true,
          },
        },
        matter: {
          select: {
            matter_id: true,
            matter_title: true,
          },
        },
        payments: true,
        invoice_partner_shares: {
          include: {
            partner: {
              select: {
                user_id: true,
                name: true,
                email: true,
              },
            },
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
        split_sequence: 'asc', // Order by split sequence (1, 2, 3...)
      },
    });

    const formattedSplits = splitInvoices.map((invoice) => ({
      id: invoice.invoice_id,
      invoiceNumber: invoice.invoice_number,
      clientId: invoice.client_id,
      matterId: invoice.matter_id,
      invoiceDate: invoice.invoice_date.toISOString(),
      dueDate: invoice.due_date.toISOString(),
      invoiceAmount: invoice.invoice_amount || 0,
      finalAmount: invoice.final_amount || invoice.invoice_amount || 0,
      amountPaid: invoice.amount_paid,
      splitPercentage: invoice.split_percentage,
      splitSequence: invoice.split_sequence,
      status: calculateInvoiceStatus(invoice),
      description: invoice.description,
      billingLocation: invoice.billing_location,
      invoice_currency: invoice.invoice_currency,
      matter_currency: invoice.matter_currency,
      client: {
        id: invoice.client.client_id,
        name: invoice.client.client_name,
      },
      matter: invoice.matter ? {
        id: invoice.matter.matter_id,
        title: invoice.matter.matter_title,
      } : null,
      creator: {
        id: invoice.creator.user_id,
        name: invoice.creator.name,
      },
      partnerShares: invoice.invoice_partner_shares.map(ps => ({
        userId: ps.partner.user_id,
        userName: ps.partner.name,
        userEmail: ps.partner.email,
        percentage: ps.share_percentage,
      })),
      paymentCount: invoice.payments.length,
    }));

    return res.status(200).json(successResponse(formattedSplits, 'Split invoices retrieved successfully'));
  } catch (error) {
    console.error('❌ Error fetching split invoices:', error);
    return res.status(500).json(errorResponse('Failed to fetch split invoices', error));
  }
});

/**
 * GET /api/invoices/:id
 * Get a single invoice by ID
 * ⚠️ MUST BE AFTER specific paths like /client/:id and /matter/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const invoice = await prisma.invoices.findUnique({
      where: { invoice_id: parseInt(id) },
      include: {
        client: {
          select: {
            client_id: true,
            client_name: true,
            address: true,
          },
        },
        matter: {
          select: {
            matter_id: true,
            matter_title: true,
            currency: true,
          },
        },
        invoice_matters: {
          include: {
            matter: {
              select: {
                matter_id: true,
                matter_title: true,
                currency: true,
              },
            },
          },
        },
        invoice_partner_shares: {
          include: {
            partner: {
              select: {
                user_id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        invoice_timesheets: {
          include: {
            timesheet: {
              include: {
                user: {
                  select: {
                    user_id: true,
                    name: true,
                  },
                },
                matter: {
                  select: {
                    matter_id: true,
                    currency: true,
                  },
                },
              },
            },
          },
        },
        invoice_expenses: {
          include: {
            expense: {
              select: {
                expense_id: true,
                category: true,
                sub_category: true,
                description: true,
                amount: true,
                amount_currency: true,
              },
            },
          },
        },
        creator: {
          select: {
            user_id: true,
            name: true,
          },
        },
        split_invoices: {
          include: {
            payments: true,
            client: {
              select: {
                client_id: true,
                client_name: true,
              },
            },
            matter: {
              select: {
                matter_id: true,
                matter_title: true,
              },
            },
          },
        },
        parent_invoice: {
          select: {
            invoice_id: true,
            invoice_number: true,
            client: {
              select: {
                client_id: true,
                client_name: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json(errorResponse('Invoice not found'));
    }

    const isParent = invoice.split_invoices && invoice.split_invoices.length > 0;
    const isSplit = invoice.parent_invoice_id !== null;

    // Calculate split payment summary for parent invoices
    let splitPaymentSummary: any = null;
    if (isParent && invoice.split_invoices) {
      let totalPaid = 0;
      const splits = invoice.split_invoices.map((split: any) => {
        const splitFinalAmount = split.final_amount || split.invoice_amount || 0;
        const splitPaid = split.amount_paid || 0;
        const splitDue = splitFinalAmount - splitPaid;
        totalPaid += splitPaid;

        return {
          invoiceNumber: split.invoice_number,
          invoiceId: split.invoice_id,
          amountPaid: splitPaid,
          finalAmount: splitFinalAmount,
          amountDue: splitDue,
          currency: split.invoice_currency || split.matter_currency || 'INR',
          status: calculateInvoiceStatus(split),
        };
      });

      splitPaymentSummary = {
        totalPaid,
        splits,
      };
    }

    // Derive status for parent invoices
    let invoiceStatus = invoice.status;
    if (isParent && invoice.split_invoices) {
      invoiceStatus = deriveParentInvoiceStatus(invoice.split_invoices);
    }

    const formattedInvoice = {
      id: invoice.invoice_id,
      invoiceNumber: invoice.invoice_number,
      clientId: invoice.client_id,
      matterId: invoice.matter_id,
      matterIds: invoice.invoice_matters?.map(im => im.matter_id) || (invoice.matter_id ? [invoice.matter_id] : []),
      invoiceDate: invoice.invoice_date.toISOString(),
      dueDate: invoice.due_date.toISOString(),
      invoiceAmount: invoice.invoice_amount || 0,
      amountPaid: invoice.amount_paid,
      isSplit: invoice.isSplit,
      status: invoiceStatus,
      isParent,
      isSplit,
      splitCount: isParent ? invoice.split_invoices.length : 0,
      parentInvoiceId: isSplit ? invoice.parent_invoice_id : null,
      splitPaymentSummary,
      description: invoice.description,
      notes: invoice.notes,
      billingLocation: invoice.billing_location,
      createdBy: invoice.created_by,
      createdAt: invoice.created_at.toISOString(),
      updatedAt: invoice.updated_at.toISOString(),
      isMultiMatter: invoice.is_multi_matter || false,
      subtotal: invoice.subtotal || 0,
      finalAmount: invoice.final_amount || invoice.invoice_amount || 0,
      discountType: invoice.discount_type,
      discountValue: invoice.discount_value || 0,
      discountAmount: invoice.discount_amount || 0,
      userExchangeRate: invoice.user_exchange_rate,
      amountInINR: invoice.amount_in_inr,
      uploadedInvoiceUrl: invoice.uploaded_invoice_url,
      uploadedAt: invoice.uploaded_at?.toISOString(),
      client: {
        id: invoice.client.client_id,
        name: invoice.client.client_name,
        address: invoice.client.address,
      },
      matter: invoice.matter ? {
        id: invoice.matter.matter_id,
        title: invoice.matter.matter_title,
        currency: invoice.matter.currency || 'INR',
      } : null,
      matters: invoice.invoice_matters?.map(im => ({
        id: im.matter.matter_id,
        title: im.matter.matter_title,
        currency: im.matter.currency || 'INR',
      })) || [],
      // ✅ Currency fields (previously missing!)
      matterCurrency: invoice.matter_currency || invoice.matter?.currency || invoice.invoice_matters?.[0]?.matter?.currency || 'INR',
      invoiceCurrency: invoice.invoice_currency || invoice.matter_currency || invoice.matter?.currency || invoice.invoice_matters?.[0]?.matter?.currency || 'INR',
      currencyConversionRate: invoice.currency_conversion_rate,
      invoiceAmountInMatterCurrency: invoice.invoice_amount_in_matter_currency,
      // ✅ Return saved exchange rates as object
      exchangeRates: invoice.exchange_rates ? (typeof invoice.exchange_rates === 'string' ? JSON.parse(invoice.exchange_rates) : invoice.exchange_rates) : null,
      partnerShares: invoice.invoice_partner_shares?.map(ps => ({
        userId: ps.partner_user_id,
        userName: ps.partner.name,
        userEmail: ps.partner.email,
        percentage: ps.share_percentage,
      })) || [],
      timesheets: invoice.invoice_timesheets?.map(it => ({
        timesheetId: it.timesheet_id,
        billedHours: it.billed_hours,
        billedAmount: it.billed_amount,
        hourlyRate: it.hourly_rate,
        originalHours: it.timesheet.billable_hours,
        originalAmount: it.timesheet.calculated_amount,
        currency: it.timesheet.calculated_amount_currency || it.timesheet.matter?.currency || 'INR', // ✅ Include currency
        user: {
          id: it.timesheet.user.user_id,
          name: it.timesheet.user.name,
        },
        date: it.timesheet.date,
        description: it.timesheet.description,
      })) || [],
      expenses: invoice.invoice_expenses?.map(ie => ({
        expenseId: ie.expense.expense_id,
        category: ie.expense.category,
        subCategory: ie.expense.sub_category,
        description: ie.expense.description,
        originalAmount: ie.original_amount, // Original amount in INR
        amount: ie.billed_amount, // Converted amount in invoice currency
        originalCurrency: ie.original_currency || 'INR',
        currency: ie.billed_amount_currency || invoice.invoice_currency || 'INR',
        exchangeRate: ie.exchange_rate,
      })) || [],
      creator: {
        id: invoice.creator.user_id,
        name: invoice.creator.name,
      },
    };

    return res.status(200).json(successResponse(formattedInvoice, 'Invoice retrieved successfully'));
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return res.status(500).json(errorResponse('Failed to fetch invoice', error));
  }
});

/**
 * GET /api/invoices/:id/timesheet-summary
 * Get detailed timesheet entries for invoice (individual entries, not grouped)
 */

// Helper function to convert minutes to hours for display/calculation
const minutesToHours = (minutes: number): number => {
  return minutes / 60;
};

router.get('/:id/timesheet-summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const invoiceId = parseInt(req.params.id);

    if (isNaN(invoiceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invoice ID',
      });
    }

    // Get the invoice with its timesheets and expenses
    const invoice = await prisma.invoices.findUnique({
      where: { invoice_id: invoiceId },
      select: {
        invoice_id: true,
        invoice_number: true,
        status: true,
        invoice_currency: true,
        matter_currency: true,
        exchange_rates: true, // ✅ Include exchange rates
        invoice_timesheets: {
          include: {
            timesheet: {
              include: {
                user: {
                  select: {
                    user_id: true,
                    name: true,
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
                    currency: true,
                    client: {
                      select: {
                        client_code: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        invoice_expenses: {
          include: {
            expense: {
              select: {
                expense_id: true,
                category: true,
                sub_category: true,
                description: true,
                amount: true,
                amount_currency: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    // ✅ Parse exchange rates from JSON
    let exchangeRates: Record<string, number> = {};
    if (invoice.exchange_rates) {
      try {
        exchangeRates = typeof invoice.exchange_rates === 'string' 
          ? JSON.parse(invoice.exchange_rates) 
          : invoice.exchange_rates;
      } catch (e) {
        console.error('Error parsing exchange_rates in timesheet-summary:', e);
      }
    }

    const invoiceCurrency = invoice.invoice_currency || invoice.matter_currency || 'INR';

    // Filter out null timesheets
    const validInvoiceTimesheets = invoice.invoice_timesheets.filter(it => it.timesheet !== null);

    if (validInvoiceTimesheets.length === 0 && invoice.invoice_expenses.length === 0) {
      return res.json({
        success: true,
        data: {
          timesheetEntries: [],
          expenseEntries: [],
          periodFrom: null,
          periodTo: null,
          isSingleDate: false,
          invoiceCurrency,
          exchangeRates,
        },
      });
    }

    // Extract timesheets for date calculation
    const timesheets = validInvoiceTimesheets.map(it => it.timesheet!);

    // ✅ FIND THE ACTUAL EARLIEST AND LATEST TIMESHEET DATES
    const timesheetDates = timesheets.map(t => new Date(t.date).getTime());
    const earliestDate = new Date(Math.min(...timesheetDates));
    const latestDate = new Date(Math.max(...timesheetDates));

    // ✅ Check if all timesheets are from the same date
    const isSingleDate = earliestDate.getTime() === latestDate.getTime();

    // Group timesheets by user and calculate totals
    // ✅ Use billed_hours/billed_amount from invoice_timesheets if available, otherwise fall back to timesheet values
    const timesheetEntries = validInvoiceTimesheets.map(invoiceTimesheet => {
      const timesheet = invoiceTimesheet.timesheet!;

      // Use billed values if available, otherwise use original timesheet values
      const billedHoursInMinutes = invoiceTimesheet.billed_hours ?? timesheet.billable_hours ?? 0;
      const hours = billedHoursInMinutes / 60;
      const hourlyRate = invoiceTimesheet.hourly_rate ?? timesheet.hourly_rate ?? 0;
      
      // ✅ ALWAYS recalculate fees from billed hours * hourly rate to ensure correctness
      // This fixes cases where billed_amount might be incorrect (e.g., 261.05 instead of 2400)
      let fees = 0;
      if (billedHoursInMinutes > 0 && hourlyRate > 0) {
        // Always calculate: hours (from billedHours) * hourlyRate
        fees = hours * hourlyRate;
      } else {
        // Fallback only if we can't calculate
        fees = invoiceTimesheet.billed_amount ?? timesheet.calculated_amount ?? 0;
      }

      // ✅ Ensure timesheet_id is always present
      if (!timesheet.timesheet_id) {
        console.error('⚠️ Missing timesheet_id for invoice_timesheet:', invoiceTimesheet);
      }

      const timesheetCurrency = timesheet.calculated_amount_currency || timesheet.matter?.currency || 'INR';
      
      // ✅ Convert fees to invoice currency if needed (for finalized invoices)
      let convertedFees = fees;
      if (invoice.status === 'finalized' && timesheetCurrency !== invoiceCurrency && exchangeRates[timesheetCurrency]) {
        convertedFees = fees * exchangeRates[timesheetCurrency];
        // Round to 4 decimals internally
        convertedFees = parseFloat(convertedFees.toFixed(4));
      }

      return {
        timesheetId: timesheet.timesheet_id, // ✅ CRITICAL: Must be set for editing
        lawyerName: timesheet.user.name,
        lawyerRole: timesheet.user.role?.name || 'Lawyer',
        hours: hours,
        hourlyRate: hourlyRate,
        fees: convertedFees, // ✅ Use converted fees for finalized invoices
        date: timesheet.date,
        // ✅ ADD: Original values for comparison in draft editing
        originalHours: (timesheet.billable_hours ?? 0) / 60,
        originalFees: timesheet.calculated_amount ?? 0,
        billedHours: billedHoursInMinutes, // Keep in minutes for editing
        billedAmount: convertedFees, // ✅ Use converted amount for finalized invoices
        // ✅ ADD: Currency information from timesheet/matter
        currency: timesheetCurrency,
        originalCurrency: timesheetCurrency, // Original currency of the timesheet
        // ✅ ADD: Description and activity type for itemized entries tab
        description: timesheet.description || null,
        activityType: timesheet.activity_type || null,
        // ✅ ADD: Matter title and ID for itemized entries tab
        matterTitle: timesheet.matter?.matter_title || null,
        matterId: timesheet.matter?.matter_id || null,
        // ✅ ADD: Client code for formatted matter ID display
        clientCode: timesheet.matter?.client?.client_code || null,
      };
    });

    // ✅ Process expenses
    const expenseEntries = invoice.invoice_expenses.map(invoiceExpense => {
      const expense = invoiceExpense.expense;
      return {
        expenseId: expense.expense_id,
        category: expense.category,
        subCategory: expense.sub_category,
        description: expense.description,
        amount: invoiceExpense.billed_amount || expense.amount, // Use billed amount if converted
        originalAmount: invoiceExpense.original_amount || expense.amount,
        currency: invoiceExpense.billed_amount_currency || invoiceCurrency,
        originalCurrency: invoiceExpense.original_currency || 'INR',
        exchangeRate: invoiceExpense.exchange_rate,
      };
    });

    res.json({
      success: true,
      data: {
        timesheetEntries,
        expenseEntries, // ✅ Include expenses
        periodFrom: earliestDate.toISOString().split('T')[0],
        periodTo: latestDate.toISOString().split('T')[0],
        isSingleDate: isSingleDate,
        invoiceCurrency, // ✅ Include invoice currency
        exchangeRates, // ✅ Include exchange rates
      },
    });
  } catch (error) {
    console.error('Error fetching timesheet summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch timesheet summary',
    });
  }
});

/**
 * GET /api/invoices/:id/currency-breakdown
 * Get currency breakdown for an invoice showing original and converted amounts
 */
router.get('/:id/currency-breakdown', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const invoice = await prisma.invoices.findUnique({
      where: { invoice_id: parseInt(id) },
      select: {
        invoice_id: true,
        invoice_number: true,
        invoice_amount: true,
        matter_currency: true,
        invoice_currency: true,
        currency_conversion_rate: true,
        invoice_amount_in_matter_currency: true,
      },
    });

    if (!invoice) {
      return res.status(404).json(errorResponse('Invoice not found'));
    }

    const breakdown = {
      invoice_id: invoice.invoice_id,
      invoice_number: invoice.invoice_number,
      matter_currency: invoice.matter_currency || 'INR',
      invoice_currency: invoice.invoice_currency || invoice.matter_currency || 'INR',
      original_amount: invoice.invoice_amount_in_matter_currency || invoice.invoice_amount,
      converted_amount: invoice.invoice_amount,
      conversion_rate: invoice.currency_conversion_rate || 1,
      is_converted: invoice.matter_currency !== invoice.invoice_currency && invoice.currency_conversion_rate !== null,
    };

    res.json({
      success: true,
      data: breakdown,
    });
  } catch (error) {
    console.error('Error fetching currency breakdown:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch currency breakdown',
    });
  }
});

/**
 * GET /api/invoices/:id/payments
 * Get all payments for an invoice
 */
router.get('/:id/payments', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const invoice = await prisma.invoices.findUnique({
      where: { invoice_id: parseInt(id) },
      include: {
        split_invoices: {
          select: {
            invoice_id: true,
            invoice_number: true,
          },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json(errorResponse('Invoice not found'));
    }

    // Get payments from parent invoice
    const parentPayments = await prisma.invoice_payments.findMany({
      where: { invoice_id: parseInt(id) },
      include: {
        recorder: {
          select: {
            user_id: true,
            name: true,
          },
        },
      },
    });

    // If parent invoice has splits, also get payments from all split invoices
    let splitInvoicePayments: any[] = [];
    if (invoice.split_invoices && invoice.split_invoices.length > 0) {
      const splitInvoiceIds = invoice.split_invoices.map(split => split.invoice_id);
      
      const splitPayments = await prisma.invoice_payments.findMany({
        where: { 
          invoice_id: { in: splitInvoiceIds },
        },
        include: {
          recorder: {
            select: {
              user_id: true,
              name: true,
            },
          },
          invoice: {
            select: {
              invoice_id: true,
              invoice_number: true,
            },
          },
        },
      });

      splitInvoicePayments = splitPayments;
    }

    // Combine and format all payments
    const allPayments = [
      ...parentPayments.map(payment => ({
        ...payment,
        isSplitPayment: false,
        splitInvoiceNumber: null,
      })),
      ...splitInvoicePayments.map(payment => ({
        ...payment,
        isSplitPayment: true,
        splitInvoiceNumber: payment.invoice.invoice_number,
      })),
    ];

    // Sort by payment date (newest first)
    allPayments.sort((a, b) => {
      const dateA = new Date(a.payment_date).getTime();
      const dateB = new Date(b.payment_date).getTime();
      return dateB - dateA;
    });

    const formattedPayments = allPayments.map((payment) => ({
      id: payment.payment_id,
      invoiceId: payment.invoice_id,
      paymentDate: payment.payment_date.toISOString(),
      amount: payment.amount,
      paymentMethod: payment.payment_method,
      transactionRef: payment.transaction_ref,
      notes: payment.notes,
      recordedBy: payment.recorded_by,
      createdAt: payment.created_at.toISOString(),
      isSplitPayment: payment.isSplitPayment,
      splitInvoiceNumber: payment.splitInvoiceNumber,
      splitInvoiceId: payment.isSplitPayment ? payment.invoice_id : null,
      recorder: {
        id: payment.recorder.user_id,
        name: payment.recorder.name,
      },
    }));

    return res.status(200).json(successResponse(formattedPayments, 'Invoice payments retrieved successfully'));
  } catch (error) {
    console.error('Error fetching invoice payments:', error);
    return res.status(500).json(errorResponse('Failed to fetch invoice payments', error));
  }
});

/**
 * PUT /api/invoices/:id
 * Update an invoice
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      invoiceNumber,
      invoiceDate,
      dueDate,
      invoiceAmount,
      description,
      notes,
      timesheetIds,
      dateFrom,
      dateTo,
      billingLocation,
      discountType,
      discountValue,
      userExchangeRate,
      exchangeRates, // NEW: Map of { currency: rate } for multi-currency invoices
      matterIds, // Support adding/removing matters
    } = req.body;

    const existingInvoice = await prisma.invoices.findUnique({
      where: { invoice_id: parseInt(id) },
    });

    if (!existingInvoice) {
      return res.status(404).json(errorResponse('Invoice not found'));
    }

    // Only allow updates if invoice status is 'draft'
    if (existingInvoice.status !== 'draft') {
      return res.status(400).json(errorResponse(`Cannot update invoice with status '${existingInvoice.status}'. Only draft invoices can be updated.`));
    }

    if (invoiceNumber && invoiceNumber !== existingInvoice.invoice_number) {
      const duplicateInvoice = await prisma.invoices.findUnique({
        where: { invoice_number: invoiceNumber },
      });

      if (duplicateInvoice) {
        return res.status(409).json(errorResponse('Invoice number already exists'));
      }
    }

    if (invoiceAmount !== undefined && invoiceAmount <= 0) {
      return res.status(400).json(errorResponse('Invoice amount must be greater than 0'));
    }

    if (invoiceDate && dueDate) {
      const invoiceDateObj = new Date(invoiceDate);
      const dueDateObj = new Date(dueDate);
      if (dueDateObj < invoiceDateObj) {
        return res.status(400).json(errorResponse('Due date must be after invoice date'));
      }
    }

    // Validate timesheets if provided
    if (timesheetIds !== undefined && timesheetIds.length > 0) {
      // Check if any timesheets are already invoiced (excluding current invoice)
      const alreadyInvoiced = await prisma.invoice_timesheets.findMany({
        where: {
          timesheet_id: { in: timesheetIds },
          invoice_id: { not: parseInt(id) },
        },
        include: {
          invoice: {
            select: {
              invoice_number: true,
            },
          },
        },
      });

      if (alreadyInvoiced.length > 0) {
        const invoiceNumbers = alreadyInvoiced.map(it => it.invoice.invoice_number).join(', ');
        return res.status(400).json(errorResponse(
          `Some timesheets are already invoiced in: ${invoiceNumbers}`
        ));
      }

      // Verify all timesheets exist and are approved
      const timesheets = await prisma.timesheets.findMany({
        where: {
          timesheet_id: { in: timesheetIds },
        },
      });

      if (timesheets.length !== timesheetIds.length) {
        return res.status(404).json(errorResponse('Some timesheets not found'));
      }

      // All timesheets are auto-approved on creation (approved_by is set to creator's user_id)
      // No need to check approval status
    }

    const updateData: any = {};

    if (invoiceNumber) updateData.invoice_number = invoiceNumber;
    if (invoiceDate) updateData.invoice_date = new Date(invoiceDate);
    if (dueDate) updateData.due_date = new Date(dueDate);
    if (invoiceAmount !== undefined) updateData.invoice_amount = invoiceAmount;
    if (description) updateData.description = description;
    if (notes !== undefined) updateData.notes = notes || null;
    if (dateFrom !== undefined) updateData.date_from = dateFrom ? new Date(dateFrom) : null;
    if (dateTo !== undefined) updateData.date_to = dateTo ? new Date(dateTo) : null;
    if (billingLocation) updateData.billing_location = billingLocation;

    // Handle discount fields
    if (discountType !== undefined) updateData.discount_type = discountType;
    if (discountValue !== undefined) updateData.discount_value = discountValue;

    // Handle exchange rate
    if (userExchangeRate !== undefined) updateData.user_exchange_rate = userExchangeRate;
    
    // ✅ Handle multi-currency exchange rates - save as JSON
    if (exchangeRates && typeof exchangeRates === 'object' && Object.keys(exchangeRates).length > 0) {
      updateData.exchange_rates = JSON.stringify(exchangeRates);
    } else if (exchangeRates === null || exchangeRates === undefined) {
      // Allow clearing exchange rates by sending null/undefined
      updateData.exchange_rates = null;
    }
    
    // ✅ Handle multi-currency exchange rates - recalculate subtotal
    // Get current subtotal from invoice_timesheets
    let currentInvoiceTimesheets = await prisma.invoice_timesheets.findMany({
      where: { invoice_id: parseInt(id) },
      select: { billed_amount: true },
    });
    let currentSubtotal = currentInvoiceTimesheets.reduce((sum, it) => sum + (it.billed_amount || 0), 0) || existingInvoice.subtotal || 0;
    
    // ✅ If exchangeRates provided, recalculate subtotal using exchange rates
    if (exchangeRates && typeof exchangeRates === 'object' && Object.keys(exchangeRates).length > 0) {
      const invoiceWithTimesheets = await prisma.invoices.findUnique({
        where: { invoice_id: parseInt(id) },
        include: {
          invoice_timesheets: {
            include: {
              timesheet: {
                include: {
                  matter: {
                    select: {
                      matter_id: true,
                      currency: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      
      if (invoiceWithTimesheets && invoiceWithTimesheets.invoice_timesheets.length > 0) {
        const invoiceCurrency = invoiceWithTimesheets.invoice_currency || 'INR';
        
        // Recalculate subtotal using exchange rates
        const recalculatedSubtotal = invoiceWithTimesheets.invoice_timesheets.reduce((sum, it) => {
          const amount = it.billed_amount || 0;
          if (amount === 0) return sum;
          
          // Determine timesheet currency
          const tsCurrency = it.timesheet.calculated_amount_currency || 
                            (it.timesheet.matter?.currency || 'INR');
          
          // Convert to invoice currency if needed
          if (tsCurrency === invoiceCurrency) {
            return sum + amount;
          } else {
            const rate = exchangeRates[tsCurrency];
            if (!rate || rate <= 0) {
              // If rate missing, use existing amount (don't throw error in update)
              return sum + amount;
            }
            return sum + (amount * rate);
          }
        }, 0);
        
        // Update subtotal if different
        if (recalculatedSubtotal !== currentSubtotal && recalculatedSubtotal > 0) {
          currentSubtotal = recalculatedSubtotal;
        }
      }
    }

    // Recalculate amounts if discount or exchange rate changed

    // Calculate discount amount
    let discountAmount = 0;
    if (discountType && discountValue !== undefined) {
      if (discountType === 'percentage') {
        discountAmount = currentSubtotal * (discountValue / 100);
      } else if (discountType === 'fixed') {
        discountAmount = discountValue;
      }
      // Enforce limits: discount cannot exceed subtotal, cannot be negative
      if (discountAmount > currentSubtotal) {
        return res.status(400).json(errorResponse('Discount amount cannot exceed subtotal'));
      }
      if (discountAmount < 0) {
        return res.status(400).json(errorResponse('Discount amount cannot be negative'));
      }
      updateData.discount_amount = discountAmount;
      updateData.subtotal = currentSubtotal;
      updateData.final_amount = currentSubtotal - discountAmount;
    } else if (existingInvoice.discount_type && existingInvoice.discount_value !== undefined) {
      // Recalculate with existing discount if subtotal changed
      if (existingInvoice.discount_type === 'percentage') {
        discountAmount = currentSubtotal * (existingInvoice.discount_value / 100);
      } else {
        discountAmount = existingInvoice.discount_value;
      }
      discountAmount = Math.min(discountAmount, currentSubtotal);
      discountAmount = Math.max(0, discountAmount);
      updateData.discount_amount = discountAmount;
      updateData.subtotal = currentSubtotal;
      updateData.final_amount = currentSubtotal - discountAmount;
    } else {
      // No discount
      updateData.subtotal = currentSubtotal;
      updateData.final_amount = currentSubtotal;
    }

    // Calculate amount_in_inr if exchange rate provided
    if (userExchangeRate !== undefined && updateData.final_amount !== undefined) {
      updateData.amount_in_inr = updateData.final_amount * userExchangeRate;
    } else if (existingInvoice.user_exchange_rate && updateData.final_amount !== undefined) {
      updateData.amount_in_inr = updateData.final_amount * existingInvoice.user_exchange_rate;
    }

    // Handle matterIds update if provided
    let shouldUpdateMatters = false;
    if (matterIds !== undefined && Array.isArray(matterIds)) {
      shouldUpdateMatters = true;
      // Validate all matters belong to same client
      if (matterIds.length > 0) {
        const matters = await prisma.matters.findMany({
          where: { matter_id: { in: matterIds } },
          select: { matter_id: true, client_id: true },
        });
        if (matters.length !== matterIds.length) {
          return res.status(404).json(errorResponse('One or more matters not found'));
        }
        const invalidMatters = matters.filter(m => m.client_id !== existingInvoice.client_id);
        if (invalidMatters.length > 0) {
          return res.status(400).json(errorResponse('All matters must belong to the invoice client'));
        }
      }
    }

    // Update invoice and timesheet links in a transaction
    const invoice = await prisma.$transaction(async (tx) => {
      // Update matters if needed
      if (shouldUpdateMatters) {
        // Delete existing invoice_matters
        await tx.invoice_matters.deleteMany({
          where: { invoice_id: parseInt(id) },
        });
        // Create new ones
        if (matterIds!.length > 0) {
          await tx.invoice_matters.createMany({
            data: matterIds!.map((mId: number) => ({
              invoice_id: parseInt(id),
              matter_id: mId,
            })),
          });
        }
        // Update matter_id and is_multi_matter flag
        if (matterIds!.length === 0) {
          updateData.matter_id = null;
          updateData.is_multi_matter = false;
        } else if (matterIds!.length === 1) {
          updateData.matter_id = matterIds![0];
          updateData.is_multi_matter = false;
        } else {
          updateData.matter_id = null;
          updateData.is_multi_matter = true;
        }
      }

      const updatedInvoice = await tx.invoices.update({
        where: { invoice_id: parseInt(id) },
        data: updateData,
        include: {
          client: {
            select: {
              client_id: true,
              client_name: true,
              address: true,
            },
          },
          matter: {
            select: {
              matter_id: true,
              matter_title: true,
            },
          },
          invoice_matters: {
            include: {
              matter: {
                select: {
                  matter_id: true,
                  matter_title: true,
                },
              },
            },
          },
          creator: {
            select: {
              user_id: true,
              name: true,
            },
          },
        },
      });

      // Update timesheet links if provided
      if (timesheetIds !== undefined) {
        // Delete existing links
        await tx.invoice_timesheets.deleteMany({
          where: { invoice_id: parseInt(id) },
        });

        // Create new links with billed hours copied from timesheet
        if (timesheetIds.length > 0) {
          const timesheetDetails = await tx.timesheets.findMany({
            where: { timesheet_id: { in: timesheetIds } },
            select: {
              timesheet_id: true,
              billable_hours: true,
              calculated_amount: true,
              hourly_rate: true,
            },
          });
          const timesheetMap = new Map(timesheetDetails.map(ts => [ts.timesheet_id, ts]));
          await tx.invoice_timesheets.createMany({
            data: timesheetIds.map((tsId: number) => {
              const ts = timesheetMap.get(tsId);
              return {
              invoice_id: parseInt(id),
              timesheet_id: tsId,
                billed_hours: ts?.billable_hours || null,
                billed_amount: ts?.calculated_amount || null,
                hourly_rate: ts?.hourly_rate || null,
              };
            }),
          });
        }
      }

      return updatedInvoice;
    });

    const formattedInvoice = {
      id: invoice.invoice_id,
      invoiceNumber: invoice.invoice_number,
      clientId: invoice.client_id,
      matterId: invoice.matter_id,
      matterIds: invoice.invoice_matters?.map((im: any) => im.matter_id) || (invoice.matter_id ? [invoice.matter_id] : []),
      invoiceDate: invoice.invoice_date.toISOString(),
      dueDate: invoice.due_date.toISOString(),
      invoiceAmount: invoice.invoice_amount || 0,
      amountPaid: invoice.amount_paid,
      isSplit: invoice.isSplit,
      status: invoice.status,
      description: invoice.description,
      notes: invoice.notes,
      billingLocation: invoice.billing_location,
      createdBy: invoice.created_by,
      createdAt: invoice.created_at.toISOString(),
      updatedAt: invoice.updated_at.toISOString(),
      isMultiMatter: invoice.is_multi_matter || false,
      subtotal: invoice.subtotal || 0,
      finalAmount: invoice.final_amount || invoice.invoice_amount || 0,
      discountType: invoice.discount_type,
      discountValue: invoice.discount_value || 0,
      discountAmount: invoice.discount_amount || 0,
      userExchangeRate: invoice.user_exchange_rate,
      amountInINR: invoice.amount_in_inr,
      client: {
        id: invoice.client.client_id,
        name: invoice.client.client_name,
        address: invoice.client.address,
      },
      matter: invoice.matter ? {
        id: invoice.matter.matter_id,
        title: invoice.matter.matter_title,
      } : null,
      matters: invoice.invoice_matters?.map((im: any) => ({
        id: im.matter.matter_id,
        title: im.matter.matter_title,
      })) || [],
      creator: {
        id: invoice.creator.user_id,
        name: invoice.creator.name,
      },
    };

    return res.status(200).json(successResponse(formattedInvoice, 'Invoice updated successfully'));
  } catch (error) {
    console.error('Error updating invoice:', error);
    return res.status(500).json(errorResponse('Failed to update invoice', error));
  }
});

/**
 * DELETE /api/invoices/:id
 * Delete an invoice
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existingInvoice = await prisma.invoices.findUnique({
      where: { invoice_id: parseInt(id) },
      include: {
        payments: true,
        split_invoices: {
          include: {
            payments: true,
          },
        },
      },
    });

    if (!existingInvoice) {
      return res.status(404).json(errorResponse('Invoice not found'));
    }

    // Check if invoice has its own payments
    if (existingInvoice.payments && existingInvoice.payments.length > 0) {
      return res.status(400).json(errorResponse(
        'Cannot delete invoice with recorded payments. Please delete payments first.'
      ));
    }

    // Check if invoice is a parent with split invoices that have payments
    if (existingInvoice.split_invoices && existingInvoice.split_invoices.length > 0) {
      const splitsWithPayments = existingInvoice.split_invoices.filter(
        (split: any) => split.payments && split.payments.length > 0
      );

      if (splitsWithPayments.length > 0) {
        const splitNumbers = splitsWithPayments.map((split: any) => split.invoice_number);
        return res.status(400).json(errorResponse(
          `Cannot delete parent invoice. The following split invoices have recorded payments: ${splitNumbers.join(', ')}. Please delete payments first.`
        ));
      }
    }

    await prisma.invoices.delete({
      where: { invoice_id: parseInt(id) },
    });

    return res.status(200).json(successResponse(null, 'Invoice deleted successfully'));
  } catch (error) {
    console.error('Error deleting invoice:', error);
    return res.status(500).json(errorResponse('Failed to delete invoice', error));
  }
});

/**
 * POST /api/invoices/:id/payments
 * Record a payment for an invoice
 */
router.post('/:id/payments', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { paymentDate, amount, paymentMethod, transactionRef, notes } = req.body;

    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json(errorResponse('Unauthorized'));
    }

    if (!paymentDate || !amount || !paymentMethod) {
      return res.status(400).json(errorResponse(
        'Missing required fields: paymentDate, amount, paymentMethod'
      ));
    }

    if (amount <= 0) {
      return res.status(400).json(errorResponse('Payment amount must be greater than 0'));
    }

    const validMethods = ['bank_transfer', 'check', 'upi', 'cash'];
    if (!validMethods.includes(paymentMethod)) {
      return res.status(400).json(errorResponse(
        'Invalid payment method. Must be one of: bank_transfer, check, upi, cash'
      ));
    }

    const invoice = await prisma.invoices.findUnique({
      where: { invoice_id: parseInt(id) },
      include: {
        split_invoices: true,
      },
    });

    if (!invoice) {
      return res.status(404).json(errorResponse('Invoice not found'));
    }

    // Prevent payments on parent invoices
    if (invoice.split_invoices && invoice.split_invoices.length > 0) {
      return res.status(400).json(errorResponse(
        'Cannot record payments on parent invoice. Please record payments on individual split invoices instead.'
      ));
    }

    const remainingAmount = (invoice.invoice_amount || 0) - invoice.amount_paid;
    if (amount > remainingAmount) {
      return res.status(400).json(errorResponse(
        `Payment amount (₹${amount}) exceeds remaining balance (₹${remainingAmount})`
      ));
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.invoice_payments.create({
        data: {
          invoice_id: parseInt(id),
          payment_date: new Date(paymentDate),
          amount,
          payment_method: paymentMethod,
          transaction_ref: transactionRef || null,
          notes: notes || null,
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

      const newAmountPaid = invoice.amount_paid + amount;
      let newStatus = invoice.status;

      if (newAmountPaid >= (invoice.invoice_amount || 0)) {
        newStatus = 'paid';
      } else if (newAmountPaid > 0) {
        newStatus = 'partially_paid';
      }

      await tx.invoices.update({
        where: { invoice_id: parseInt(id) },
        data: {
          amount_paid: newAmountPaid,
          status: newStatus,
        },
      });

      return payment;
    });

    const formattedPayment = {
      id: result.payment_id,
      invoiceId: result.invoice_id,
      paymentDate: result.payment_date.toISOString(),
      amount: result.amount,
      paymentMethod: result.payment_method,
      transactionRef: result.transaction_ref,
      notes: result.notes,
      recordedBy: result.recorded_by,
      createdAt: result.created_at.toISOString(),
      recorder: {
        id: result.recorder.user_id,
        name: result.recorder.name,
      },
    };

    return res.status(201).json(successResponse(formattedPayment, 'Payment recorded successfully'));
  } catch (error) {
    console.error('Error recording payment:', error);
    return res.status(500).json(errorResponse('Failed to record payment', error));
  }
});

export default router;