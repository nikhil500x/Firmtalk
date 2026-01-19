import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import prisma from '../prisma-client';

const router = Router();

/**
 * GET /api/matters/analytics/overview
 * Get aggregated analytics data for matter overview dashboard
 * Query params: startDate (optional), endDate (optional)
 */
router.get('/analytics/overview', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionUserId = req.session.userId;
    const userRole = req.session.role?.name;

    // ✅ READ DATE PARAMETERS FROM QUERY
    const { startDate, endDate } = req.query;
    

    // Determine access permissions
    const canSeeAllMatters = ['superadmin', 'partner', 'admin', 'support', 'it', 'hr', 'accountant'].includes(userRole || '');
    
    // Build base where clause for role-based filtering
    const baseWhereClause: any = {};
    
    // ✅ ADD DATE FILTERING TO WHERE CLAUSE
    if (startDate || endDate) {
      baseWhereClause.start_date = {};
      
      if (startDate) {
        baseWhereClause.start_date.gte = new Date(startDate as string);
      }
      
      if (endDate) {
        // Add one day to include the entire end date
        const endDateTime = new Date(endDate as string);
        endDateTime.setHours(23, 59, 59, 999);
        baseWhereClause.start_date.lte = endDateTime;
      }
    }
    
    // ✅ ADD ROLE-BASED FILTERING
    if (!canSeeAllMatters) {
      // If we already have conditions in baseWhereClause, wrap them with AND
      const existingConditions = { ...baseWhereClause };
      
      // Reset baseWhereClause and add both date and role conditions
      Object.keys(baseWhereClause).forEach(key => delete baseWhereClause[key]);
      
      baseWhereClause.AND = [
        existingConditions, // Date filters
        {
          OR: [
            { assigned_lawyer: sessionUserId },
            {
              matter_users: {
                some: {
                  user_id: sessionUserId
                }
              }
            }
          ]
        }
      ];
    }


    // Fetch all matters with minimal data needed for analytics
    const matters = await prisma.matters.findMany({
      where: baseWhereClause,
      select: {
        matter_id: true,
        matter_title: true,
        status: true,
        practice_area: true,
        start_date: true,
        estimated_deadline: true,
        estimated_value: true,
        active_status: true,
        assigned_lawyer: true,
        assigned_lawyer_rel: {
          select: {
            user_id: true,
            name: true,
          }
        }
      }
    });


    // 1. Status Distribution
    const statusDistribution = matters.reduce((acc: any, matter) => {
      const status = matter.status || 'Unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const statusData = Object.entries(statusDistribution).map(([name, value]) => ({
      name,
      value,
    }));

    // 2. Practice Area Distribution
    const practiceAreaDistribution = matters.reduce((acc: any, matter) => {
      const area = matter.practice_area || 'Other';
      acc[area] = (acc[area] || 0) + 1;
      return acc;
    }, {});

    const practiceAreaData = Object.entries(practiceAreaDistribution).map(([name, value]) => ({
      name,
      value,
    }));

    // 3. Top 10 High-Value Matters
    const highValueMatters = matters
      .filter(m => m.estimated_value && m.estimated_value > 0)
      .sort((a, b) => (b.estimated_value || 0) - (a.estimated_value || 0))
      .slice(0, 10)
      .map(m => ({
        id: m.matter_id,
        name: m.matter_title.length > 20 ? m.matter_title.substring(0, 20) + '...' : m.matter_title,
        value: m.estimated_value,
      }));

    // 4. Matter Aging Analysis (based on current date - start date)
    const now = new Date();
    
    type AgingBucket = '0-30' | '31-60' | '61-90' | '91-180' | '181-365' | '365+';
    type StatusCategory = 'active' | 'pending' | 'closed';
    
    const aging: Record<AgingBucket, Record<StatusCategory, number>> = {
      '0-30': { active: 0, pending: 0, closed: 0 },
      '31-60': { active: 0, pending: 0, closed: 0 },
      '61-90': { active: 0, pending: 0, closed: 0 },
      '91-180': { active: 0, pending: 0, closed: 0 },
      '181-365': { active: 0, pending: 0, closed: 0 },
      '365+': { active: 0, pending: 0, closed: 0 }
    };

    const agingMatters: Record<AgingBucket, Record<StatusCategory, Array<{ id: number; title: string; age: number }>>> = {
      '0-30': { active: [], pending: [], closed: [] },
      '31-60': { active: [], pending: [], closed: [] },
      '61-90': { active: [], pending: [], closed: [] },
      '91-180': { active: [], pending: [], closed: [] },
      '181-365': { active: [], pending: [], closed: [] },
      '365+': { active: [], pending: [], closed: [] }
    };

    matters.forEach(matter => {
      const startDate = new Date(matter.start_date);
      // Calculate matter age: current date - start date
      const daysDiff = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
      let range: AgingBucket;
      if (daysDiff <= 30) range = '0-30';
      else if (daysDiff <= 60) range = '31-60';
      else if (daysDiff <= 90) range = '61-90';
      else if (daysDiff <= 180) range = '91-180';
      else if (daysDiff <= 365) range = '181-365';
      else range = '365+';

      const status = matter.status?.toLowerCase() || '';
      let statusCategory: StatusCategory;
      
      if (status.includes('open') || status.includes('progress') || status.includes('active')) {
        statusCategory = 'active';
      } else if (status.includes('pending') || status.includes('hold')) {
        statusCategory = 'pending';
      } else if (status.includes('closed') || status.includes('complete')) {
        statusCategory = 'closed';
      } else {
        // If status doesn't match any category, count as active
        statusCategory = 'active';
      }

      aging[range][statusCategory]++;
      agingMatters[range][statusCategory].push({
        id: matter.matter_id,
        title: matter.matter_title,
        age: daysDiff
      });
    });

    const matterAgingData = Object.entries(aging).map(([range, counts]) => ({
      range: range === '0-30' ? '0-30 days' : 
             range === '31-60' ? '31-60 days' : 
             range === '61-90' ? '61-90 days' :
             range === '91-180' ? '91-180 days' :
             range === '181-365' ? '181-365 days' : '365+ days',
      active: counts.active,
      pending: counts.pending,
      closed: counts.closed,
      total: counts.active + counts.pending + counts.closed,
      matters: {
        active: agingMatters[range as AgingBucket].active,
        pending: agingMatters[range as AgingBucket].pending,
        closed: agingMatters[range as AgingBucket].closed
      }
    }));

    // 5. Attorney Workload
    const workloadMap = new Map<number, { name: string; matters: number }>();
    
    matters.forEach(matter => {
      if (matter.assigned_lawyer && matter.assigned_lawyer_rel) {
        const id = matter.assigned_lawyer;
        if (!workloadMap.has(id)) {
          workloadMap.set(id, {
            name: matter.assigned_lawyer_rel.name ?? '',
            matters: 0
          });
        }
        workloadMap.get(id)!.matters++;
      }
    });

    const attorneyWorkload = Array.from(workloadMap.values())
      .sort((a, b) => b.matters - a.matters)
      .slice(0, 5);

    // 6. Matter Progress (active matters only)
    const activeMatters = matters
      .filter(m => m.status?.toLowerCase() !== 'closed')
      .slice(0, 4);

    const matterProgress = activeMatters.map(matter => {
      const startDate = new Date(matter.start_date);
      let progress = 0;
      
      if (matter.estimated_deadline) {
        const deadline = new Date(matter.estimated_deadline);
        const totalDays = (deadline.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        const elapsedDays = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        progress = Math.min(Math.round((elapsedDays / totalDays) * 100), 100);
      } else {
        const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        progress = Math.min(daysSinceStart * 2, 90);
      }

      return {
        id: matter.matter_id,
        title: matter.matter_title,
        progress: Math.max(0, progress),
        stage: matter.status
      };
    });

    // 7. Upcoming Deadlines (next 30 days + recent past 7 days for overdue items)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const upcomingDeadlines = matters
      .filter(m => {
        if (!m.estimated_deadline) {
          return false;
        }
        
        const deadline = new Date(m.estimated_deadline);
        
        // Check if date is valid
        if (isNaN(deadline.getTime())) {
          return false;
        }
        
        // Include deadlines from past 7 days (overdue) and next 30 days (upcoming)
        return deadline >= sevenDaysAgo && deadline <= thirtyDaysFromNow;
      })
      .sort((a, b) => new Date(a.estimated_deadline!).getTime() - new Date(b.estimated_deadline!).getTime())
      .slice(0, 5)
      .map(m => {
        const deadline = new Date(m.estimated_deadline!);
        const daysUntil = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: m.matter_id,
          date: m.estimated_deadline,
          title: m.matter_title,
          type: daysUntil < 0 ? 'overdue' : 'deadline',
          daysUntil: daysUntil
        };
      });

    // 8. Summary Stats
    const totalMatters = matters.length;
    const activeMattersCount = matters.filter(m => m.active_status).length;
    const closedMattersCount = matters.filter(m => m.status?.toLowerCase().includes('closed')).length;
    const totalValue = matters.reduce((sum, m) => sum + (m.estimated_value || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalMatters,
          activeMatters: activeMattersCount,
          closedMatters: closedMattersCount,
          totalValue,
        },
        statusDistribution: statusData,
        practiceAreaDistribution: practiceAreaData,
        highValueMatters,
        matterAging: matterAgingData,
        attorneyWorkload,
        matterProgress,
        upcomingDeadlines,
      }
    });
  } catch (error) {
    console.error('Matter analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch matter analytics',
    });
  }
});

export default router;
