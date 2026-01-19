/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { 
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { Calendar, Clock, FileText, Scale, TrendingUp, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
    {children}
  </div>
);

const CardHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-4">{children}</div>
);

const CardTitle = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <h3 className={`text-lg font-semibold text-gray-900 ${className}`}>{children}</h3>
);

const Badge = ({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' }) => {
  const variants: Record<'default' | 'success' | 'warning' | 'danger', string> = {
    default: 'bg-blue-100 text-blue-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800'
  };

// ✅ ADD SELECT COMPONENT
const Select = ({ value, onValueChange, children }: { value: string; onValueChange: (value: string) => void; children: React.ReactNode }) => (
  <div className="relative inline-block">
    {children}
  </div>
);

const SelectTrigger = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <select 
    onChange={(e) => {
      const parent = e.currentTarget.parentElement?.parentElement;
      if (parent) {
        const onValueChange = (parent as any).__onValueChange;
        if (onValueChange) onValueChange(e.target.value);
      }
    }}
    className={`${className} appearance-none bg-white border border-gray-300 rounded px-3 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500`}
  >
    {children}
  </select>
);

const SelectContent = ({ children }: { children: React.ReactNode }) => <>{children}</>;

const SelectItem = ({ value, children }: { value: string; children: React.ReactNode }) => (
  <option value={value}>{children}</option>
);

const SelectValue = () => null;
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
};

const MatterOverviewDashboard = () => {
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgeBuckets, setSelectedAgeBuckets] = useState<string[]>([
    '0-30 days', '31-60 days', '61-90 days', '91-180 days', '181-365 days', '365+ days'
  ]);

  // ✅ ADD THESE NEW STATE VARIABLES
  const [dateRange, setDateRange] = useState("30"); // Default to last 30 days
  const [isCustomRange, setIsCustomRange] = useState(false);
  
  // Date range filter states
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  // const [isDateFilterActive, setIsDateFilterActive] = useState(false);

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

  useEffect(() => {
    // ✅ Auto-populate dates on mount with default range (Last 30 Days)
    if (!dateFrom && !dateTo && !isCustomRange) {
      const range = getDateRangeFromDays(dateRange);
      setDateFrom(range.from);
      setDateTo(range.to);
    }
  }, []); // Run only on mount

  useEffect(() => {
    // Only fetch if we have valid dates or a preset range
    if ((dateFrom && dateTo) || (!isCustomRange && dateRange !== 'custom')) {
      fetchAnalytics();
    }
  }, [dateFrom, dateTo, dateRange]);

  const fetchAnalytics = async () => {
    try {
      // ✅ Only show loading on first load
      if (!analyticsData) {
        setLoading(true);
      }
      
      setError(null);
      
      let url = `/api/matters/analytics/overview`;
      const params = new URLSearchParams();
      
      // ✅ UPDATED: Always use date range if dates are set
      if (dateFrom && dateTo) {
        params.append('startDate', dateFrom);
        params.append('endDate', dateTo);
        console.log('📅 Using date range:', { dateFrom, dateTo });
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      console.log('🔍 Fetching analytics with URL:', url);
      
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
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
      // ✅ Only set loading false after first load
      if (loading) {
        setLoading(false);
      }
    }
  };

  const handleApplyDateFilter = () => {
    if (!dateFrom || !dateTo) {
      // alert('Please select both start and end dates');
      toast.error('Please select both start and end dates');
      return;
    }
    
    if (new Date(dateFrom) > new Date(dateTo)) {
      // alert('Start date cannot be after end date');
      toast.error('Start date cannot be after end date');
      return;
    }
    
    // ✅ REMOVED: setIsDateFilterActive(true);
    // Just fetch analytics, no need for separate state
    fetchAnalytics();
  };

  const handleClearDateFilter = () => {
    setDateFrom('');
    setDateTo('');
    setIsCustomRange(false);
    setDateRange('30'); // ✅ Reset to default
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading matter data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <Card className="max-w-2xl w-full">
          <div className="flex items-start gap-3 text-red-600 mb-4">
            <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-lg">Error Loading Data</h3>
              <p className="text-sm text-gray-600 mt-2 break-words">{error}</p>
            </div>
          </div>
          <button 
            onClick={fetchAnalytics}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </Card>
      </div>
    );
  }

  // Extract data from analytics response
  const statusData = analyticsData?.statusDistribution || [];
  const practiceAreaData = analyticsData?.practiceAreaDistribution || [];
  const highValueMatters = analyticsData?.highValueMatters || [];
  const allMatterAgingData = analyticsData?.matterAging || [];
  const attorneyWorkload = analyticsData?.attorneyWorkload || [];
  const matterProgress = analyticsData?.matterProgress || [];
  const upcomingEvents = analyticsData?.upcomingDeadlines || [];

  // Filter matter aging data based on selected buckets
  const matterAgingData = allMatterAgingData.filter((item: any) => 
    selectedAgeBuckets.includes(item.range)
  );

  // Available age buckets for filtering
  const availableAgeBuckets = ['0-30 days', '31-60 days', '61-90 days', '91-180 days', '181-365 days', '365+ days'];

  // Toggle age bucket selection
  const toggleAgeBucket = (bucket: string) => {
    setSelectedAgeBuckets(prev => 
      prev.includes(bucket) 
        ? prev.filter(b => b !== bucket)
        : [...prev, bucket]
    );
  };

  // Select/deselect all age buckets
  const toggleAllAgeBuckets = () => {
    if (selectedAgeBuckets.length === availableAgeBuckets.length) {
      setSelectedAgeBuckets([]);
    } else {
      setSelectedAgeBuckets(availableAgeBuckets);
    }
  };

  // Add colors to status data
  const statusColors: Record<string, string> = {
    'Open': '#3b82f6',
    'In Progress': '#f59e0b',
    'Closed': '#6b7280',
    'On Hold': '#ef4444',
    'Pending': '#8b5cf6',
  };
  const statusDataWithColors = statusData.map((item: any) => ({
    ...item,
    color: statusColors[item.name] || '#94a3b8'
  }));

  // Add colors to practice area data
  const practiceAreaColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'];
  const practiceAreaDataWithColors = practiceAreaData.map((item: any, index: number) => ({
    ...item,
    color: practiceAreaColors[index % practiceAreaColors.length]
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header with Date Filter */}
      <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Matter Overview</h1>
              {/* <p className="text-gray-600">Comprehensive view of all active legal matters</p> */}
            </div>
            
            {/* Compact Date Range Filter */}
            <div className="flex flex-wrap items-end gap-6">
              {/* ✅ ADD Date Range Dropdown */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Date Range
                </label>
                <select
                  value={dateRange}
                  onChange={(e) => handleDateRangeChange(e.target.value)}
                  className="w-45 h-8 text-sm border border-gray-300 rounded px-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              
              {/* ✅ Only show Apply button for custom range */}
              {/* {isCustomRange && (
                <button
                  onClick={handleApplyDateFilter}
                  disabled={!dateFrom || !dateTo}
                  className="h-8 px-3 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Apply
                </button>
              )} */}
              
              {/* ✅ Show Clear button when dates are set */}
              {/* {dateFrom && dateTo && (
                <button
                  onClick={handleClearDateFilter}
                  className="h-8 px-3 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  Clear
                </button>
              )} */}
            </div>
          </div>
          
          {/* Active filter indicator */}
          {dateFrom && dateTo && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
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
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          
          {/* Matter Status Distribution - Donut Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-blue-600" />
                Matter Status Distribution
              </CardTitle>
            </CardHeader>
            {statusDataWithColors.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={statusDataWithColors}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {statusDataWithColors.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {statusDataWithColors.map((item: any) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-sm text-gray-600">{item.name}: {item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-center py-8">No data available</p>
            )}
          </Card>

          {/* Matters by Practice Area - Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Matters by Practice Area
              </CardTitle>
            </CardHeader>
            {practiceAreaDataWithColors.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={practiceAreaDataWithColors}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {practiceAreaDataWithColors.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-8">No data available</p>
            )}
          </Card>

          {/* Upcoming Deadlines */}
          <Card className="xl:row-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Upcoming Deadlines
              </CardTitle>
            </CardHeader>
            <div className="space-y-3">
              {upcomingEvents.length > 0 ? (
                upcomingEvents.map((event: any, idx: number) => (
                  <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-50 rounded">
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-medium text-sm text-gray-900">{event.title}</p>
                      <Badge variant="warning">
                        {event.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(event.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">No upcoming deadlines</p>
              )}
            </div>
          </Card>

          {/* Matter Progress Timeline */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Matter Progress Timeline
              </CardTitle>
            </CardHeader>
            <div className="space-y-4">
              {matterProgress.length > 0 ? (
                matterProgress.map((matter: any, idx: number) => (
                  <div key={idx}>
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <p className="font-medium text-sm text-gray-900">{matter.title}</p>
                        <p className="text-xs text-gray-600">{matter.stage}</p>
                      </div>
                      <span className="text-sm font-semibold text-blue-600">{matter.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${matter.progress}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">No active matters</p>
              )}
            </div>
          </Card>

          {/* Top 10 High-Value Matters - Bar Chart */}
          {highValueMatters.length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Top 10 High-Value Matters</CardTitle>
              </CardHeader>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={highValueMatters} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tickFormatter={formatCurrency} />
                  <YAxis dataKey="name" type="category" width={150} style={{ fontSize: '12px' }} />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Matter Aging - Stacked Bar Chart with Filters and Matter Details */}
          <Card className="md:col-span-2 xl:col-span-3">
            <CardHeader>
              <div className="flex flex-col gap-4">
                <CardTitle>Matter Aging Analysis</CardTitle>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">Filter by age range:</p>
                    <button
                      onClick={toggleAllAgeBuckets}
                      className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                    >
                      {selectedAgeBuckets.length === availableAgeBuckets.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableAgeBuckets.map((bucket) => (
                      <button
                        key={bucket}
                        onClick={() => toggleAgeBucket(bucket)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          selectedAgeBuckets.includes(bucket)
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {bucket}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            {matterAgingData.length > 0 ? (
              <div className="space-y-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={matterAgingData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="range" style={{ fontSize: '11px' }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="active" stackId="a" fill="#3b82f6" name="Active" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pending" stackId="a" fill="#f59e0b" name="Pending" />
                    <Bar dataKey="closed" stackId="a" fill="#6b7280" name="Closed" />
                  </BarChart>
                </ResponsiveContainer>

                {/* Matter Details by Age Range */}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 pt-4 border-t">
                  {matterAgingData.map((ageGroup: any) => {
                    const allMatters = [
                      ...(ageGroup.matters?.active || []).map((m: any) => ({ ...m, status: 'active' })),
                      ...(ageGroup.matters?.pending || []).map((m: any) => ({ ...m, status: 'pending' })),
                      ...(ageGroup.matters?.closed || []).map((m: any) => ({ ...m, status: 'closed' }))
                    ];
                    
                    if (allMatters.length === 0) return null;

                    return (
                      <div key={ageGroup.range} className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-semibold text-sm text-gray-900 mb-3 flex items-center justify-between">
                          <span>{ageGroup.range}</span>
                          <Badge variant="default">{allMatters.length}</Badge>
                        </h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {allMatters.map((matter: any) => (
                            <div 
                              key={matter.id} 
                              className="bg-white rounded p-2 text-xs border border-gray-200"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-medium text-gray-900 flex-1 line-clamp-2">
                                  {matter.title}
                                </p>
                                <Badge 
                                  variant={
                                    matter.status === 'active' ? 'default' :
                                    matter.status === 'pending' ? 'warning' : 
                                    'success'
                                  }
                                >
                                  {matter.status}
                                </Badge>
                              </div>
                              <p className="text-gray-600 mt-1">Age: {matter.age} days</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No data available for selected age ranges</p>
            )}
          </Card>

          {/* Attorney Workload Allocation - Vertical Bar */}
          {attorneyWorkload.length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Attorney Workload Allocation</CardTitle>
              </CardHeader>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={attorneyWorkload}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45} 
                    textAnchor="end" 
                    height={100} 
                    style={{ fontSize: '11px' }}
                    interval={0}
                  />
                  <YAxis 
                    label={{ value: 'Number of Matters', angle: -90, position: 'insideLeft' }}
                    allowDecimals={false}
                  />
                  <Tooltip />
                  <Bar dataKey="matters" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
};

export default MatterOverviewDashboard;