/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { MatterStatusDistribution } from './MatterStatusDistribution';
import { PracticeAreaDistribution } from './PracticeAreaDistribution';
import { TopHighValueMatters } from './TopHighValueMatters';
import { UpcomingDeadlines } from './UpcomingDeadlines';

interface MatterWidgetsDataProviderProps {
  widgetId: string;
  dateFrom?: string;  // Optional date filter from DashboardGrid
  dateTo?: string;    // Optional date filter from DashboardGrid
}

export const MatterWidgetsDataProvider: React.FC<MatterWidgetsDataProviderProps> = ({ 
  widgetId, 
  dateFrom, 
  dateTo 
}) => {
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, [dateFrom, dateTo]); // Re-fetch when date filters change

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Build query parameters
      const params = new URLSearchParams();
      
      // Add date filters if they exist
      if (dateFrom && dateTo) {
        params.append('startDate', dateFrom);
        params.append('endDate', dateTo);
      }
      
      const url = `/api/matters/analytics/overview${params.toString() ? `?${params.toString()}` : ''}`;

      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setAnalyticsData(result.data);
      } else {
        throw new Error(result.message || 'Failed to fetch analytics');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6 h-full flex items-center justify-center">
        <div className="text-center text-red-600">
          <p className="text-sm">{error}</p>
          <button 
            onClick={fetchAnalytics}
            className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Prepare data with colors
  const statusColors: Record<string, string> = {
    'Open': '#3b82f6',
    'In Progress': '#f59e0b',
    'Closed': '#6b7280',
    'On Hold': '#ef4444',
    'Pending': '#8b5cf6',
  };

  const statusData = (analyticsData?.statusDistribution || []).map((item: any) => ({
    ...item,
    color: statusColors[item.name] || '#94a3b8'
  }));

  const practiceAreaColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'];
  const practiceAreaData = (analyticsData?.practiceAreaDistribution || []).map((item: any, index: number) => ({
    ...item,
    color: practiceAreaColors[index % practiceAreaColors.length]
  }));

  const highValueMatters = analyticsData?.highValueMatters || [];
  const upcomingEvents = analyticsData?.upcomingDeadlines || [];

  // Render the appropriate widget based on widgetId
  switch (widgetId) {
    case 'matter-status-distribution':
      return <MatterStatusDistribution data={statusData} />;
    case 'practice-area-distribution':
      return <PracticeAreaDistribution data={practiceAreaData} />;
    case 'top-high-value-matters':
      return <TopHighValueMatters data={highValueMatters} />;
    case 'upcoming-deadlines':
      return <UpcomingDeadlines data={upcomingEvents} />;
    default:
      return <div className="bg-white rounded-lg shadow p-6">Widget not found</div>;
  }
};