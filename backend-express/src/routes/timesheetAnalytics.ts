import { Router, Request, Response } from 'express';
import prisma from '../prisma-client';
import { requireAuth } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';

const router = Router();
router.use(requireAuth);

// ✅ UPDATED: Now accepts optional startDate and endDate parameters
const getDateRange = (days?: number, startDate?: string, endDate?: string) => {
  // If custom date range is provided, use it
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Include the entire end date
    return { startDate: start, endDate: end };
  }
  
  // Otherwise, use the days parameter (default behavior)
  const endDate_calc = new Date();
  const startDate_calc = new Date();
  startDate_calc.setDate(startDate_calc.getDate() - (days || 30));
  return { startDate: startDate_calc, endDate: endDate_calc };
};

// Helper function to convert minutes to hours for display/calculation
// Handles BigInt from Prisma aggregations
const minutesToHours = (minutes: number | bigint | null): number => {
  if (minutes === null || minutes === undefined) return 0;
  const numMinutes = typeof minutes === 'bigint' ? Number(minutes) : minutes;
  return numMinutes / 60;
};

const canSeeAllData = (role?: string) =>
  ['superadmin', 'partner', 'admin', 'hr', 'accountant'].includes(role || '');

// Single comprehensive endpoint that returns all analytics data
router.get('/timesheet-overview', async (req: Request, res: Response) => {
  try {
    // ✅ UPDATED: Now reads startDate and endDate from query params
    const { userId, days = '30', startDate, endDate } = req.query;
    const sessionUserId = req.session.userId!;
    const userRole = req.session.role?.name;


    // ✅ UPDATED: Pass startDate and endDate to getDateRange
    const daysNum = parseInt(days as string);
    const range = getDateRange(
      startDate && endDate ? undefined : daysNum, 
      startDate as string | undefined, 
      endDate as string | undefined
    );

   

    const where: any = {
      date: {
        gte: range.startDate,
        lte: range.endDate
      }
    };

    if (userId && canSeeAllData(userRole)) {
      where.user_id = parseInt(userId as string);
    } else if (!canSeeAllData(userRole)) {
      where.user_id = sessionUserId;
    }


    // Fetch all timesheet data once
    const timesheets = await prisma.timesheets.findMany({
      where,
      include: {
        matter: {
          select: { practice_area: true }
        },
      },
      orderBy: { date: 'asc' },
    });


    // 1. COMPLIANCE HEATMAP
    const dateMap = new Map();
    timesheets.forEach(ts => {
      const dateStr = ts.date.toISOString().split('T')[0];
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, { date: dateStr, totalHours: 0 }); // ✅ Removed status
      }
      // Convert minutes to hours for display
      dateMap.get(dateStr).totalHours += minutesToHours(ts.hours_worked || 0);
    });

    const heatmapData = [];
    const currentDate = new Date(range.startDate);
    while (currentDate <= range.endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        heatmapData.push(dateMap.get(dateStr) || { date: dateStr, totalHours: 0 }); // ✅ Removed status: 'missing'
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const daysWithEntries = heatmapData.filter(d => d.totalHours > 0).length;
    const complianceHeatmap = {
      heatmapData,
      statistics: {
        totalWorkdays: heatmapData.length,
        daysWithEntries,
        complianceRate: heatmapData.length > 0 ? ((daysWithEntries / heatmapData.length) * 100).toFixed(2) : '0',
      },
    };

    // 2. INVOICED VS NON-INVOICED
    const invoicedIds: any[] = [];
    const invoicedSet = new Set(invoicedIds.map((i: any) => i.timesheet_id));
    let invoiced = { hours: 0, amount: 0, count: 0 };
    let nonInvoiced = { hours: 0, amount: 0, count: 0 };

    timesheets.forEach(ts => {
      const target = invoicedSet.has(ts.timesheet_id) ? invoiced : nonInvoiced;
      // Convert minutes to hours
      target.hours += minutesToHours(ts.billable_hours || 0);
      target.amount += ts.calculated_amount || 0;
      target.count++;
    });

    const invoicedVsNonInvoiced = { invoiced, nonInvoiced };

    // 3. BILLABLE SPLIT
    const billable = minutesToHours(timesheets.reduce((sum, t) => sum + (t.billable_hours || 0), 0));
    const nonBillable = minutesToHours(timesheets.reduce((sum, t) => sum + (t.non_billable_hours || 0), 0));
    const total = billable + nonBillable;

    const billableSplit = {
      billableHours: billable,
      nonBillableHours: nonBillable,
      billablePercentage: total > 0 ? ((billable / total) * 100).toFixed(2) : '0',
      chartData: [
        { category: 'Billable', hours: billable },
        { category: 'Non-Billable', hours: nonBillable },
      ],
    };

    // 4. HOURS LOGGED
    const hoursDateMap = new Map();
    timesheets.forEach(ts => {
      const dateStr = ts.date.toISOString().split('T')[0];
      if (!hoursDateMap.has(dateStr)) {
        hoursDateMap.set(dateStr, { date: dateStr, billableHours: 0, nonBillableHours: 0, totalHours: 0 });
      }
      const entry = hoursDateMap.get(dateStr);
      // Convert minutes to hours
      entry.billableHours += minutesToHours(ts.billable_hours || 0);
      entry.nonBillableHours += minutesToHours(ts.non_billable_hours || 0);
      entry.totalHours += minutesToHours(ts.hours_worked || 0);
    });

    const hoursLogged = { chartData: Array.from(hoursDateMap.values()) };

    // 5. TOP CONTRIBUTORS
    let topContributors = { leaderboard: [] as any[] };

    if (canSeeAllData(userRole)) {
      const userIds = [...new Set(timesheets.map(ts => ts.user_id))];
      const users = await prisma.users.findMany({
        where: { user_id: { in: userIds } },
        select: {
          user_id: true,
          name: true,
        },
      });

      const userMap = new Map();
      timesheets.forEach(ts => {
        if (!userMap.has(ts.user_id)) {
          const user = users.find(u => u.user_id === ts.user_id);
          userMap.set(ts.user_id, {
            userId: ts.user_id,
            userName: user?.name || 'Unknown',
            totalHours: 0,
            billableHours: 0,
            totalAmount: 0,
          });
        }
        const user = userMap.get(ts.user_id);
        user.totalHours += minutesToHours(ts.hours_worked || 0);
        user.billableHours += minutesToHours(ts.billable_hours || 0);
        user.totalAmount += ts.calculated_amount || 0;
      });

      const leaderboard = Array.from(userMap.values())
        .sort((a, b) => b.totalHours - a.totalHours)
        .slice(0, 10)
        .map((user, idx) => ({ rank: idx + 1, ...user }));

      topContributors = { leaderboard };
    }

    // 6. MISSING ENTRIES
    let missingEntries = { missingEntries: [] as any[], totalMissing: 0 };

    if (canSeeAllData(userRole)) {
      // ✅ UPDATED: Use the same date range for missing entries
      // But limit to last 7 days if the range is longer
      const range7 = startDate && endDate 
        ? range  // Use the custom range if provided
        : getDateRange(7);  // Otherwise use last 7 days
        
      const users = await prisma.users.findMany({
        where: {
          role_id: { in: [1, 2, 3, 4] },
          active_status: true,
        },
        select: { user_id: true, name: true },
      });

      const timesheets7 = await prisma.timesheets.findMany({
        where: {
          date: {
            gte: range7.startDate,
            lte: range7.endDate
          }
        },
        select: { user_id: true, date: true },
      });

      const userTimesheetMap = new Map();
      timesheets7.forEach(ts => {
        userTimesheetMap.set(`${ts.user_id}-${ts.date.toISOString().split('T')[0]}`, true);
      });

      const missing: any[] = [];
      const currentDate = new Date(range7.startDate);
      while (currentDate <= range7.endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          users.forEach(user => {
            if (!userTimesheetMap.has(`${user.user_id}-${dateStr}`)) {
              missing.push({
                userId: user.user_id,
                userName: user.name || 'Unknown User',
                missingDate: dateStr
              });
            }
          });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      missingEntries = { missingEntries: missing, totalMissing: missing.length };
    }

    // 7. UTILIZATION
    const utilizationRate = total > 0 ? (billable / total) * 100 : 0;
    const targetUtilization = 75;

    const utilization = {
      utilizationRate: utilizationRate.toFixed(2),
      targetUtilization,
      variance: (utilizationRate - targetUtilization).toFixed(2),
      status: utilizationRate >= targetUtilization ? 'on-target' : 'below-target',
    };

    // 8. PRACTICE AREA DATA
    const areaMap = new Map();
    timesheets.forEach(ts => {
      const area = ts.matter?.practice_area || 'Unassigned';
      if (!areaMap.has(area)) {
        areaMap.set(area, {
          practiceArea: area,
          billableHours: 0,
          nonBillableHours: 0,
          totalHours: 0
        });
      }
      const entry = areaMap.get(area);
      entry.billableHours += minutesToHours(ts.billable_hours || 0);
      entry.nonBillableHours += minutesToHours(ts.non_billable_hours || 0);
      entry.totalHours += minutesToHours(ts.hours_worked || 0);
    });

    const practiceAreaData = {
      practiceAreaData: Array.from(areaMap.values()).sort((a, b) => b.totalHours - a.totalHours)
    };

    // 9. OVERVIEW
    const totalHours = minutesToHours(timesheets.reduce((sum, t) => sum + (t.hours_worked || 0), 0));
    const billableHours = minutesToHours(timesheets.reduce((sum, t) => sum + (t.billable_hours || 0), 0));
    const totalAmount = timesheets.reduce((sum, t) => sum + (t.calculated_amount || 0), 0);

    const overview = {
      totalHours,
      billableHours,
      totalAmount,
      utilizationRate: totalHours > 0 ? ((billableHours / totalHours) * 100).toFixed(2) : '0',
      // approved: timesheets.filter(t => t.status === 'approved').length,
      // pending: timesheets.filter(t => t.status === 'pending').length,
    };

    // 10. AVERAGE REALIZATION PER ATTORNEY
    let avgRealization = { attorneys: [] as any[] };

    if (canSeeAllData(userRole)) {
      const userIds = [...new Set(timesheets.map(ts => ts.user_id))];
      const users = await prisma.users.findMany({
        where: { user_id: { in: userIds } },
        select: {
          user_id: true,
          name: true,
        },
      });

      const attorneyMap = new Map();
      timesheets.forEach(ts => {
        if (!attorneyMap.has(ts.user_id)) {
          const user = users.find(u => u.user_id === ts.user_id);
          attorneyMap.set(ts.user_id, {
            userId: ts.user_id,
            name: user?.name || 'Unknown',
            totalHours: 0,
            totalAmount: 0,
          });
        }
        const attorney = attorneyMap.get(ts.user_id);
        attorney.totalHours += minutesToHours(ts.hours_worked || 0);
        attorney.totalAmount += ts.calculated_amount || 0;
      });

      const attorneys = Array.from(attorneyMap.values())
        .map(attorney => ({
          ...attorney,
          avgRate: attorney.totalHours > 0 ? Math.round(attorney.totalAmount / attorney.totalHours) : 0,
        }))
        .sort((a, b) => b.avgRate - a.avgRate)
        .slice(0, 10);

      avgRealization = { attorneys };
    }

    // Return all data in one response
    res.json(successResponse({
      complianceHeatmap,
      invoicedVsNonInvoiced,
      billableSplit,
      hoursLogged,
      topContributors,
      missingEntries,
      utilization,
      practiceAreaData,
      overview,
      avgRealization,
    }));

  } catch (error) {
    console.error('Error in timesheet-overview:', error);
    res.status(500).json(errorResponse('Failed to fetch timesheet analytics'));
  }
});

// Aggregate billable hours per user
router.get('/user-billable-hours', async (req: Request, res: Response) => {
  try {
    const grouped = await prisma.$queryRaw<{ user_id: number; total_billed_minutes: number }[]>`
      SELECT
        user_id,
        SUM(COALESCE(billable_hours, 0) + COALESCE(non_billable_hours, 0)) AS total_billed_minutes
      FROM timesheets
      GROUP BY user_id
    `;

    const userIds = grouped.map((g) => g.user_id);
    const users = await prisma.users.findMany({
      where: { user_id: { in: userIds } },
      select: { user_id: true, name: true },
    });
    const userNameMap = new Map(users.map((u) => [u.user_id, u.name]));

    const result = grouped.map((g) => ({
      userId: g.user_id,
      userName: userNameMap.get(g.user_id) || 'Unknown',
      totalHours: minutesToHours(g.total_billed_minutes || 0), // Convert to hours for display
    }));

    res.json(successResponse(result));
  } catch (error) {
    console.error('Error fetching user billable hours:', error);
    res.status(500).json(errorResponse('Failed to fetch user billable hours'));
  }
});

export default router;