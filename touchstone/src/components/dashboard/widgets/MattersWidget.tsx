'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_ENDPOINTS } from '@/lib/api';
import { FileText, Calendar, Plus, ExternalLink, AlertTriangle } from 'lucide-react';
import WidgetContainer from './WidgetContainer';
import { Button } from '@/components/ui/button';
import MatterMasterDialog from '@/components/matter/MatterMasterDialog';

interface Matter {
  id: number;
  status: string;
  estimatedDeadline: string | null;
  estimatedValue?: number;
}

interface MattersSummary {
  active: number;
  upcomingDeadlines: number;
  total: number;
  overdueDeadlines?: number;
  totalValue?: number;
}

export default function MattersWidget() {
  const router = useRouter();
  const [summary, setSummary] = useState<MattersSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isMatterDialogOpen, setIsMatterDialogOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummary = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await fetch(API_ENDPOINTS.matters.list, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch matters');
      }

      const data = await response.json();
      if (data.success) {
        const matters: Matter[] = data.data || [];
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const active = matters.filter((matter) => matter.status === 'active').length;
        
        const upcomingDeadlines = matters.filter((matter) => {
          if (!matter.estimatedDeadline) return false;
          const deadline = new Date(matter.estimatedDeadline);
          return deadline >= now && deadline <= nextWeek;
        }).length;

        const overdueDeadlines = matters.filter((matter) => {
          if (!matter.estimatedDeadline) return false;
          const deadline = new Date(matter.estimatedDeadline);
          return deadline < now && matter.status === 'active';
        }).length;

        const totalValue = matters.reduce((sum, matter) => sum + (matter.estimatedValue || 0), 0);

        setSummary({
          active,
          upcomingDeadlines,
          total: matters.length,
          overdueDeadlines,
          totalValue,
        });
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Error fetching matters summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to load matter data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleWidgetClick = () => {
    router.push('/matter');
  };

  const handleAddMatter = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMatterDialogOpen(true);
  };

  const handleMatterSuccess = () => {
    setIsMatterDialogOpen(false);
    fetchSummary(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const emptyState = !loading && !error && summary && summary.total === 0;

  return (
    <>
      <WidgetContainer
        title="Matters"
        icon={<FileText className="w-5 h-5 text-blue-600" />}
        loading={loading}
        error={error}
        onRefresh={() => fetchSummary(true)}
        onRetry={() => fetchSummary()}
        lastUpdated={lastUpdated}
        onClick={handleWidgetClick}
        aria-label="Matters Summary - Click to view all matters"
        footer={
          <div className="flex items-center justify-between w-full">
            <Link
              href="/matter"
              onClick={(e) => e.stopPropagation()}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              View All
              <ExternalLink className="w-3 h-3" />
            </Link>
            <Button
              size="sm"
              onClick={handleAddMatter}
              className="h-8"
            >
              <Plus className="w-4 h-4 mr-1" />
              New Matter
            </Button>
          </div>
        }
      >
        {emptyState ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm text-gray-600 mb-2">No matters yet</p>
            <p className="text-xs text-gray-500 mb-4">Create your first matter to get started</p>
            <Button size="sm" onClick={handleAddMatter} variant="outline">
              <Plus className="w-4 h-4 mr-1" />
              Create Matter
            </Button>
          </div>
        ) : summary ? (
          <div className="space-y-4">
            {/* Main Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <div className="text-2xl font-bold text-blue-700">{summary.active}</div>
                <div className="text-xs text-blue-600 font-medium">Active Matters</div>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div className="text-2xl font-bold text-gray-700">{summary.total}</div>
                <div className="text-xs text-gray-600 font-medium">Total Matters</div>
              </div>
            </div>

            {/* Deadline Alerts
            {summary.overdueDeadlines && summary.overdueDeadlines > 0 && (
              <div className="flex items-center gap-2 text-red-700 text-sm bg-red-50 border border-red-200 p-3 rounded-lg">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">{summary.overdueDeadlines} deadline{summary.overdueDeadlines !== 1 ? 's' : ''} overdue</span>
              </div>
            )} */}

            {/* {summary.upcomingDeadlines > 0 && (
              <div className="flex items-center gap-2 text-orange-700 text-sm bg-orange-50 border border-orange-200 p-3 rounded-lg">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span>{summary.upcomingDeadlines} deadline{summary.upcomingDeadlines !== 1 ? 's' : ''} this week</span>
              </div>
            )} */}

            {/* Total Value */}
            {summary.totalValue && summary.totalValue > 0 && (
              <div className="pt-3 border-t">
                <div className="text-xs text-gray-600 font-medium mb-1">Total Estimated Value</div>
                <div className="text-lg font-bold text-gray-900">{formatCurrency(summary.totalValue)}</div>
              </div>
            )}
          </div>
        ) : null}
      </WidgetContainer>

      {/* Matter Dialog */}
      <MatterMasterDialog
        open={isMatterDialogOpen}
        onOpenChange={setIsMatterDialogOpen}
        mode="create"
        onSuccess={handleMatterSuccess}
      />
    </>
  );
}
