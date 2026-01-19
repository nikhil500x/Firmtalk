'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_ENDPOINTS } from '@/lib/api';
import { Clock, Plus, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';
import WidgetContainer from './WidgetContainer';
import { Button } from '@/components/ui/button';
import QuickTimesheetEntry from '@/components/timesheet/QuickTimesheetEntry';

interface Timesheet {
  id: number;
  date: string;
  hoursWorked: number;
  billableHours: number;
  nonBillableHours: number;
}

interface TimesheetSummary {
  totalEntries: number;
  weeklyTotal: number;
  monthlyTotal: number;
  weeklyBillable: number;
  monthlyBillable: number;
  previousWeeklyTotal?: number;
  previousMonthlyTotal?: number;
}

// Helper function to convert minutes to hours for display
const minutesToHours = (minutes: number): number => {
  return minutes / 60;
};

export default function TimesheetSummaryWidget() {
  const router = useRouter();
  const [summary, setSummary] = useState<TimesheetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummary = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await fetch(API_ENDPOINTS.timesheets.list, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch timesheets');
      }

      const data = await response.json();
      if (data.success) {
        const timesheets: Timesheet[] = data.data || [];
        const now = new Date();
        
        // Calculate current week
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        
        // Calculate previous week
        const prevWeekStart = new Date(weekStart);
        prevWeekStart.setDate(weekStart.getDate() - 7);
        const prevWeekEnd = new Date(weekStart);
        prevWeekEnd.setDate(weekStart.getDate() - 1);
        prevWeekEnd.setHours(23, 59, 59, 999);
        
        // Calculate current month
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        
        // Calculate previous month
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        // Total entries count
        const totalEntries = timesheets.length;

        // Weekly totals
        const weeklyTotal = timesheets
          .filter((ts) => {
            const tsDate = new Date(ts.date);
            return tsDate >= weekStart && tsDate <= now;
          })
          .reduce((sum, ts) => sum + (minutesToHours(ts.hoursWorked) || 0), 0);

        const weeklyBillable = timesheets
          .filter((ts) => {
            const tsDate = new Date(ts.date);
            return tsDate >= weekStart && tsDate <= now;
          })
          .reduce((sum, ts) => sum + (minutesToHours(ts.billableHours) || 0), 0);

        const previousWeeklyTotal = timesheets
          .filter((ts) => {
            const tsDate = new Date(ts.date);
            return tsDate >= prevWeekStart && tsDate <= prevWeekEnd;
          })
          .reduce((sum, ts) => sum + (minutesToHours(ts.hoursWorked) || 0), 0);

        // Monthly totals
        const monthlyTotal = timesheets
          .filter((ts) => {
            const tsDate = new Date(ts.date);
            return tsDate >= monthStart && tsDate <= now;
          })
          .reduce((sum, ts) => sum + (minutesToHours(ts.hoursWorked) || 0), 0);

        const monthlyBillable = timesheets
          .filter((ts) => {
            const tsDate = new Date(ts.date);
            return tsDate >= monthStart && tsDate <= now;
          })
          .reduce((sum, ts) => sum + (minutesToHours(ts.billableHours) || 0), 0);

        const previousMonthlyTotal = timesheets
          .filter((ts) => {
            const tsDate = new Date(ts.date);
            return tsDate >= prevMonthStart && tsDate <= prevMonthEnd;
          })
          .reduce((sum, ts) => sum + (minutesToHours(ts.hoursWorked) || 0), 0);

        setSummary({
          totalEntries,
          weeklyTotal,
          monthlyTotal,
          weeklyBillable,
          monthlyBillable,
          previousWeeklyTotal,
          previousMonthlyTotal,
        });
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Error fetching timesheet summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to load timesheet data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const weeklyChange = useMemo(() => {
    if (!summary?.previousWeeklyTotal || summary.previousWeeklyTotal === 0) return null;
    const change = ((summary.weeklyTotal - summary.previousWeeklyTotal) / summary.previousWeeklyTotal) * 100;
    return change;
  }, [summary]);

  const monthlyChange = useMemo(() => {
    if (!summary?.previousMonthlyTotal || summary.previousMonthlyTotal === 0) return null;
    const change = ((summary.monthlyTotal - summary.previousMonthlyTotal) / summary.previousMonthlyTotal) * 100;
    return change;
  }, [summary]);

  const weeklyUtilization = useMemo(() => {
    if (!summary || summary.weeklyTotal === 0) return 0;
    return (summary.weeklyBillable / summary.weeklyTotal) * 100;
  }, [summary]);

  const monthlyUtilization = useMemo(() => {
    if (!summary || summary.monthlyTotal === 0) return 0;
    return (summary.monthlyBillable / summary.monthlyTotal) * 100;
  }, [summary]);

  const handleWidgetClick = () => {
    router.push('/timesheet');
  };

  const handleQuickEntry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsQuickEntryOpen(true);
  };

  const handleQuickEntrySuccess = () => {
    setIsQuickEntryOpen(false);
    fetchSummary(true);
  };

  const emptyState = !loading && !error && summary && summary.totalEntries === 0;

  return (
    <>
      <WidgetContainer
        title="Timesheet Summary"
        icon={<Clock className="w-5 h-5 text-blue-600" />}
        loading={loading}
        error={error}
        onRefresh={() => fetchSummary(true)}
        onRetry={() => fetchSummary()}
        lastUpdated={lastUpdated}
        onClick={handleWidgetClick}
        aria-label="Timesheet Summary - Click to view all timesheets"
        footer={
          <div className="flex items-center justify-between w-full">
            <Link
              href="/timesheet"
              onClick={(e) => e.stopPropagation()}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              View All
              <ExternalLink className="w-3 h-3" />
            </Link>
            <Button
              size="sm"
              onClick={handleQuickEntry}
              className="h-8"
            >
              <Plus className="w-4 h-4 mr-1" />
              Log Time
            </Button>
          </div>
        }
      >
        {emptyState ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm text-gray-600 mb-2">No timesheets yet</p>
            <p className="text-xs text-gray-500 mb-4">Start logging your hours to see your summary</p>
            <Button size="sm" onClick={handleQuickEntry} variant="outline">
              <Plus className="w-4 h-4 mr-1" />
              Log Your First Entry
            </Button>
          </div>
        ) : summary ? (
          <div className="space-y-4">
            {/* Total Entries Summary */}
            <div className="text-center p-3 rounded-lg bg-blue-50 border border-blue-200">
              <div className="text-3xl font-bold text-blue-700">{summary.totalEntries}</div>
              <div className="text-xs text-blue-600 font-medium">Total Entries</div>
            </div>

            {/* Weekly & Monthly Totals with Trends */}
            <div className="space-y-3 pt-3 border-t">
              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-green-600 font-medium">Weekly Hours</div>
                  {weeklyChange !== null && (
                    <div className={`flex items-center gap-1 ${weeklyChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {weeklyChange >= 0 ? (
                        <ArrowUp className="w-3 h-3" />
                      ) : (
                        <ArrowDown className="w-3 h-3" />
                      )}
                      <span className="text-xs font-semibold">{Math.abs(weeklyChange).toFixed(0)}%</span>
                    </div>
                  )}
                </div>
                <div className="flex items-baseline justify-between">
                  <div className="text-xl font-bold text-green-900">{summary.weeklyTotal.toFixed(1)}h</div>
                  <div className="text-xs text-green-700">
                    {summary.weeklyBillable.toFixed(1)}h billable ({weeklyUtilization.toFixed(0)}%)
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-purple-600 font-medium">Monthly Hours</div>
                  {monthlyChange !== null && (
                    <div className={`flex items-center gap-1 ${monthlyChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {monthlyChange >= 0 ? (
                        <ArrowUp className="w-3 h-3" />
                      ) : (
                        <ArrowDown className="w-3 h-3" />
                      )}
                      <span className="text-xs font-semibold">{Math.abs(monthlyChange).toFixed(0)}%</span>
                    </div>
                  )}
                </div>
                <div className="flex items-baseline justify-between">
                  <div className="text-xl font-bold text-purple-900">{summary.monthlyTotal.toFixed(1)}h</div>
                  <div className="text-xs text-purple-700">
                    {summary.monthlyBillable.toFixed(1)}h billable ({monthlyUtilization.toFixed(0)}%)
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </WidgetContainer>

      {/* Quick Entry Dialog */}
      <QuickTimesheetEntry
        open={isQuickEntryOpen}
        onOpenChange={setIsQuickEntryOpen}
        selectedDate={new Date()}
        onSuccess={handleQuickEntrySuccess}
      />
    </>
  );
}