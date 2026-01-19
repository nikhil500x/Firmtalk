'use client';

import React, { useState, useEffect } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { Plus, X,Calendar } from 'lucide-react';
import { MatterWidgetsDataProvider } from './widgets/matters/MatterWidgetsDataProvider';
import { TimesheetWidgetsDataProvider } from './widgets/timesheets/TimesheetWidgetsDataProvider';
import { PendingApprovalsDataProvider } from './widgets/approvals/PendingApprovalsDataProvider';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

/**
 * Convert widget ID to proper case display name
 * Example: "matter-status-distribution" → "Matter Status Distribution"
 */
const formatWidgetName = (widgetId: string): string => {
  return widgetId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const ResponsiveGridLayout = WidthProvider(Responsive);

interface WidgetSize {
  w: number;      // Width in grid units
  h: number;      // Height in grid units
  minW: number;   // Minimum width (same as w for fixed size)
  maxW: number;   // Maximum width (same as w for fixed size)
  minH: number;   // Minimum height (same as h for fixed size)
  maxH: number;   // Maximum height (same as h for fixed size)
}

interface WidgetConfig {
  id: string;
  module: string;
  size: WidgetSize;
}

// Widget Registry with Fixed Sizes (3 widgets per row: each widget = 4 columns = 1/3 width)
const WIDGET_REGISTRY: WidgetConfig[] = [
  {
    id: 'matter-status-distribution',
    module: 'matters',
    size: { w: 4, h: 4, minW: 4, maxW: 4, minH: 4, maxH: 4 }  // Fixed 4x4 (1/3 width - 3 per row)
  },
  {
    id: 'practice-area-distribution',
    module: 'matters',
    size: { w: 4, h: 4, minW: 4, maxW: 4, minH: 4, maxH: 4 }  // Fixed 4x4 (1/3 width - 3 per row)
  },
  {
    id: 'top-high-value-matters',
    module: 'matters',
    size: { w: 8, h: 4, minW: 8, maxW: 8, minH: 4, maxH: 4 }  // Fixed 8x4 (2/3 width - wider)
  },
  {
    id: 'upcoming-deadlines',
    module: 'matters',
    size: { w: 4, h: 4, minW: 4, maxW: 4, minH: 4, maxH: 4 }  // Fixed 4x4 (1/3 width - standard)
  },
  {
    id: 'timesheet-invoiced-vs-non-invoiced',
    module: 'timesheets',
    size: { w: 4, h: 4, minW: 4, maxW: 4, minH: 4, maxH: 4 }
  },
  {
    id: 'timesheet-billable-split',
    module: 'timesheets',
    size: { w: 4, h: 4, minW: 4, maxW: 4, minH: 4, maxH: 4 }
  }
];

interface DashboardWidget {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW: number;
  maxW: number;
  minH: number;
  maxH: number;
  static?: boolean;  // If true, widget can't be moved or resized at all
}

export default function DashboardGrid() {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showPendingApprovals, setShowPendingApprovals] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  
  // Date range filter states
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const [dateRange, setDateRange] = useState("30"); // Default to last 30 days
  const [isCustomRange, setIsCustomRange] = useState(false);

  // Helper function to get date range based on selection
  const getDateRangeFromDays = (days: string) => {
    const today = new Date();
    const from = new Date();
    from.setDate(today.getDate() - parseInt(days));
    
    return {
      from: from.toISOString().split('T')[0],
      to: today.toISOString().split('T')[0]
    };
  };

  // Fetch pending approvals count
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const response = await fetch(`/api/dashboard/pending-approvals`, {
          credentials: 'include',
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setPendingApprovalsCount(data.data.total || 0);
          }
        }
      } catch (error) {
        console.error('Error fetching pending approvals count:', error);
      }
    };

    fetchPendingCount();
    // Refresh count every 30 seconds
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close the pending approvals popover when clicking outside
  useEffect(() => {
    if (!showPendingApprovals) return;

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking inside the popover or the button
      if (target.closest('.pending-approvals-popover') || target.closest('.pending-approvals-button')) {
        return;
      }
      setShowPendingApprovals(false);
    };

    const timer = setTimeout(() => {
      document.addEventListener('click', handleGlobalClick);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [showPendingApprovals]);

  // Close the widget picker when clicking outside
  useEffect(() => {
    if (!showPicker) return;

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking inside the picker or the "Add Widget" button
      if (target.closest('.widget-picker-dropdown') || target.closest('.add-widget-button')) {
        return;
      }
      setShowPicker(false);
    };

    // Small delay to prevent immediate closing when opening
    const timer = setTimeout(() => {
      document.addEventListener('click', handleGlobalClick);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [showPicker]);

  // Load widgets from localStorage on mount
  useEffect(() => {
    const savedWidgets = localStorage.getItem('dashboard-widgets');
    if (savedWidgets) {
      setWidgets(JSON.parse(savedWidgets));
    } else {
      // Default widgets for first time users with fixed sizes (3 widgets per row)
      const defaultWidgets: DashboardWidget[] = [
        {
          i: 'matter-status-distribution',
          x: 0, y: 0,
          w: 4, h: 4,
          minW: 4, maxW: 4, minH: 4, maxH: 4
        },
        {
          i: 'practice-area-distribution',
          x: 4, y: 0,
          w: 4, h: 4,
          minW: 4, maxW: 4, minH: 4, maxH: 4
        },
      ];
      setWidgets(defaultWidgets);
      localStorage.setItem('dashboard-widgets', JSON.stringify(defaultWidgets));
    }
  }, []);

  // ✅ ADD THIS NEW useEffect TO INITIALIZE DATES
  useEffect(() => {
    // Auto-populate dates on mount with default range (Last 30 Days)
    if (!dateFrom && !dateTo && !isCustomRange) {
      const range = getDateRangeFromDays(dateRange);
      setDateFrom(range.from);
      setDateTo(range.to);
    }
  }, []); // Run only on mount

  // ✅ ADD THIS NEW HANDLER
  const handleDateRangeChange = (value: string) => {
    setDateRange(value);
    
    if (value === 'custom') {
      // Enable custom date range mode
      setIsCustomRange(true);
      setDateFrom('');
      setDateTo('');
    } else {
      // Preset range selected
      setIsCustomRange(false);
      const range = getDateRangeFromDays(value);
      setDateFrom(range.from);
      setDateTo(range.to);
    }
  };

  // Save widgets to localStorage when they change
  const saveWidgets = (newWidgets: DashboardWidget[]) => {
    setWidgets(newWidgets);
    localStorage.setItem('dashboard-widgets', JSON.stringify(newWidgets));
  };

  const handleLayoutChange = (layout: Layout[]) => {
    const updatedWidgets = layout.map(item => {
      // Find the existing widget to preserve its properties
      const existingWidget = widgets.find(w => w.i === item.i);
      return {
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: existingWidget?.minW ?? item.w,
        maxW: existingWidget?.maxW ?? item.w,
        minH: existingWidget?.minH ?? item.h,
        maxH: existingWidget?.maxH ?? item.h,
        static: existingWidget?.static
      };
    });
    saveWidgets(updatedWidgets);
  };

  const addWidget = (widgetConfig: WidgetConfig) => {
    // Check if widget already exists
    if (widgets.find(w => w.i === widgetConfig.id)) {
      return; // Silently return if already added
    }

    // Calculate next available position (left-to-right, then wrap)
    let nextX = 0;
    let nextY = 0;

    if (widgets.length > 0) {
      // Sort widgets by position (top-to-bottom, left-to-right)
      const sortedWidgets = [...widgets].sort((a, b) => {
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
      });

      // Find the last widget
      const lastWidget = sortedWidgets[sortedWidgets.length - 1];

      // Try to place next to last widget
      nextX = lastWidget.x + lastWidget.w;
      nextY = lastWidget.y;

      // If it doesn't fit in the row (exceeds 12 columns), wrap to next row
      if (nextX + widgetConfig.size.w > 12) {
        nextX = 0;
        // Find the maximum Y position + height to place below
        const maxY = Math.max(...sortedWidgets.map(w => w.y + w.h));
        nextY = maxY;
      }
    }

    // Create new widget with fixed size constraints and calculated position
    const newWidget: DashboardWidget = {
      i: widgetConfig.id,
      x: nextX,
      y: nextY,
      w: widgetConfig.size.w,
      h: widgetConfig.size.h,
      minW: widgetConfig.size.minW,
      maxW: widgetConfig.size.maxW,
      minH: widgetConfig.size.minH,
      maxH: widgetConfig.size.maxH,
      static: false,
    };

    saveWidgets([...widgets, newWidget]);
    // Removed: setShowPicker(false) - keep picker open for multiple additions
  };

  const removeWidget = (widgetId: string) => {
    const updatedWidgets = widgets.filter(w => w.i !== widgetId);
    saveWidgets(updatedWidgets);
  };

  const renderWidget = (widget: DashboardWidget) => {
    const widgetConfig = WIDGET_REGISTRY.find(w => w.id === widget.i);

    if (!widgetConfig) {
      return <div className="bg-white rounded-lg shadow p-6">Widget not found</div>;
    }

    // ✅ UPDATED: Always pass date filter props
    const dateFilterProps = dateFrom && dateTo ? { dateFrom, dateTo } : {};

    if (widgetConfig.module === 'matters') {
      return <MatterWidgetsDataProvider widgetId={widget.i} {...dateFilterProps} />;
    }

    if (widgetConfig.module === 'timesheets') {
      return <TimesheetWidgetsDataProvider widgetId={widget.i} {...dateFilterProps} />;
    }

    if (widgetConfig.module === 'approvals') {
      return <PendingApprovalsDataProvider widgetId={widget.i} {...dateFilterProps} />;
    }

    return <div className="bg-white rounded-lg shadow p-6">Widget not supported</div>;
  };

  const moduleOrder = Array.from(
    new Set(WIDGET_REGISTRY.map((widget) => widget.module))
  );

  const moduleLabels: Record<string, string> = {
    matters: 'Matters Module',
    timesheets: 'Timesheets Module',
  };

  // Format the count for display (99+ for 100 or more)
  const displayCount = pendingApprovalsCount > 99 ? '99+' : pendingApprovalsCount.toString();

  const handleApplyDateFilter = () => {
    if (!dateFrom || !dateTo) {
      alert('Please select both start and end dates');
      return;
    }
    
    if (new Date(dateFrom) > new Date(dateTo)) {
      alert('Start date cannot be after end date');
      return;
    }
    
    // ✅ No need for setIsDateFilterActive - just let the dates trigger updates
  };

  const handleClearDateFilter = () => {
    setDateFrom('');
    setDateTo('');
    setIsCustomRange(false);
    setDateRange('30'); // ✅ Reset to default
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* loader to get pending count immediately on page load */}
      <div className="hidden">
        <PendingApprovalsDataProvider
          widgetId="pending-approvals-hidden-loader"
          onDataLoad={(data) => setPendingCount(data.total ?? 0)}
        />
      </div>

      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 shadow-sm">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              {/* <p className="text-gray-600">Customize your dashboard with widgets</p> */}
            </div>
            <div className="flex gap-2">
              {/* Pending Approvals Button */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPendingApprovals(!showPendingApprovals);
                  }}
                  className="pending-approvals-button flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  {pendingApprovalsCount > 0 ? (
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white text-orange-600 font-bold text-sm">
                      {displayCount}
                    </div>
                  ) : (
                    <Calendar className="w-4 h-4" />
                  )}
                  Pending Approvals
                </button>

                {/* Pending Approvals Popover */}
                {showPendingApprovals && (
                  <div className="pending-approvals-popover absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[600px] overflow-y-auto">
                    <div className="p-4">
                      <PendingApprovalsDataProvider widgetId="pending-approvals" />
                    </div>
                  </div>
                )}
              </div>
            
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPicker(!showPicker);
                  }}
                  className="add-widget-button flex items-center gap-2 px-4 py-2 bg-gradient-to-b from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Widget
                </button>

                {/* Widget Picker Dropdown */}
                {showPicker && (
                  <div className="widget-picker-dropdown absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[600px] overflow-y-auto">
                    <div className="p-4 space-y-5">
                      {moduleOrder.map((moduleKey) => (
                        <div key={moduleKey} className="space-y-3">
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {moduleLabels[moduleKey] || moduleKey}
                          </div>
                          {WIDGET_REGISTRY.filter((w) => w.module === moduleKey).map((widget) => {
                            const isAdded = widgets.some((w) => w.i === widget.id);
                            return (
                              <div
                                key={widget.id}
                                className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-all"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 mb-1">
                                    {formatWidgetName(widget.id)}
                                  </p>
                                </div>

                                {/* Add/Remove Toggle Button */}
                                <button
                                  onClick={() => isAdded ? removeWidget(widget.id) : addWidget(widget)}
                                  className={`flex-shrink-0 p-2.5 rounded-lg transition-all ${isAdded
                                      ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
                                    }`}
                                  title={isAdded ? 'Remove widget' : 'Add widget'}
                                >
                                  {isAdded ? (
                                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                    </svg>
                                  ) : (
                                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="flex flex-wrap items-end gap-6">
            {/* ✅ ADD Date Range Dropdown */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Date Range
              </label>
              <select
                value={dateRange}
                onChange={(e) => handleDateRangeChange(e.target.value)}
                className="w-44 h-8 text-sm border border-gray-300 rounded px-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="60">Last 60 Days</option>
                <option value="90">Last 90 Days</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <div>
                <label htmlFor="date-from" className="block text-xs font-medium text-gray-700 mb-1">
                  From
                </label>
                <input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    if (isCustomRange) {
                      setDateFrom(e.target.value);
                      if (dateTo && e.target.value > dateTo) {
                        setDateTo('');
                      }
                    }
                  }}
                  max={dateTo || new Date().toISOString().split('T')[0]}
                  disabled={!isCustomRange}
                  className="w-36 h-8 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
              
              <div>
                <label htmlFor="date-to" className="block text-xs font-medium text-gray-700 mb-1">
                  To
                </label>
                <input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    if (isCustomRange) {
                      setDateTo(e.target.value);
                    }
                  }}
                  min={dateFrom || undefined}
                  max={new Date().toISOString().split('T')[0]}
                  disabled={!isCustomRange}
                  className="w-36 h-8 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
            </div>
            
            
          </div>

          {/* Active filter indicator */}
          {dateFrom && dateTo && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  Showing data from <strong>{new Date(dateFrom).toLocaleDateString()}</strong> to <strong>{new Date(dateTo).toLocaleDateString()}</strong>
                  {!isCustomRange && <span className="ml-2 text-xs">(Preset: Last {dateRange} days)</span>}
                </span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {/* Grid Layout */}
        {widgets.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <p className="text-gray-600 mb-4">No widgets added yet</p>
            <button
              onClick={() => setShowPicker(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Your First Widget
            </button>
          </div>
        ) : (
          <ResponsiveGridLayout
            className={`layout ${isDragging ? 'dragging-active' : ''}`}
            layouts={{ lg: widgets }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={80}
            margin={[16, 16]}
            containerPadding={[0, 0]}
            onLayoutChange={handleLayoutChange}
            onDragStart={() => setIsDragging(true)}
            onDragStop={() => setIsDragging(false)}
            draggableHandle=".drag-handle"
            isResizable={false}
            isDraggable={true}
            compactType="vertical"
            preventCollision={false}
            useCSSTransforms={true}
          >
            {widgets.map(widget => {
              const widgetConfig = WIDGET_REGISTRY.find(w => w.id === widget.i);
              return (
                <div key={widget.i} className="relative group">
                  {/* Widget Header with Drag Handle and Remove Button */}
                  <div className="absolute top-2 right-2 z-10 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div
                      className="drag-handle cursor-move px-3 py-1.5 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 hover:border-blue-400 transition-all"
                      title="Drag to reposition"
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex gap-0.5">
                          <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                          <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                        </div>
                        <div className="flex gap-0.5">
                          <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                          <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                        </div>
                        <div className="flex gap-0.5">
                          <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                          <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeWidget(widget.i)}
                      className="p-1.5 bg-white border border-red-300 text-red-600 rounded shadow-sm hover:bg-red-50 hover:border-red-400 transition-all"
                      title="Remove widget"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Size Badge (bottom-left, shows on hover) */}
                  {widgetConfig && (
                    <div className="absolute bottom-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-900/75 text-white text-xs rounded backdrop-blur-sm">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2" />
                        </svg>
                        {widgetConfig.size.w}×{widgetConfig.size.h} (Fixed)
                      </span>
                    </div>
                  )}

                  {/* Widget Content */}
                  <div className="h-full overflow-auto">
                    {renderWidget(widget)}
                  </div>
                </div>
              );
            })}
          </ResponsiveGridLayout>
        )}
      </div>
    </div>
  );
}