"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Calendar, Clock, DollarSign, TrendingUp, AlertCircle, Users, Target, Briefcase, Award, FileText, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "react-toastify";

const COLORS = {
  primary: "#3b82f6",
  secondary: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  purple: "#8b5cf6",
  pink: "#ec4899",
  teal: "#14b8a6",
  indigo: "#6366f1",
};

export default function TimesheetAnalytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState("30");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [isCustomRange, setIsCustomRange] = useState(false); // NEW: Track if custom range is selected  
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  // const [softLoading, setSoftLoading] = useState(false); // ✅ ADD THIS

 
  const [isDateFilterActive, setIsDateFilterActive] = useState(false);
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
      
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
      
      const params = new URLSearchParams();
      
      // Always use date range if dates are set
      if (dateFrom && dateTo) {
        params.append('startDate', dateFrom);
        params.append('endDate', dateTo);
        console.log('📅 Using date range:', { dateFrom, dateTo });
      } else {
        params.append('days', dateRange);
        console.log('📅 Using days filter:', dateRange);
      }
      
      if (selectedUser !== "all") {
        params.append("userId", selectedUser);
      }
      
      const url = `${backendUrl}/api/analytics/timesheet-overview?${params}`;
      console.log('🔍 Fetching from:', url);
      
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
      console.log('📊 Received data:', result);
      
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
    
    fetchAnalytics();
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

  const handleClearDateFilter = () => {
    setDateFrom('');
    setDateTo('');
    setIsDateFilterActive(false);
    fetchAnalytics();
  };

  if (loading) {  // ✅ Simple condition
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
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

  const complianceData = analyticsData?.complianceHeatmap;
  const invoicedData = analyticsData?.invoicedVsNonInvoiced;
  const billableSplit = analyticsData?.billableSplit;
  const hoursLogged = analyticsData?.hoursLogged;
  const topContributors = analyticsData?.topContributors;
  const missingEntries = analyticsData?.missingEntries;
  const utilization = analyticsData?.utilization;
  const practiceArea = analyticsData?.practiceAreaData;
  const overview = analyticsData?.overview;
  const avgRealization = analyticsData?.avgRealization;

  const getComplianceColor = (hours: number) => {
    if (hours === 0) return "#ef4444";
    if (hours < 6) return "#f59e0b";
    return "#10b981";
  };

  // Custom gauge component
  const GaugeChart = ({ value, target, title, color }: any) => {
    const percentage = Math.min(value, 100);
    
    return (
      <div className="relative">
        <div className="text-center mb-2">
          <p className="text-xs text-gray-600 font-medium">{title}</p>
        </div>
        <div className="relative w-full aspect-square max-w-[200px] mx-auto">
          <svg viewBox="0 0 200 120" className="w-full">
            {/* Background arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="20"
              strokeLinecap="round"
            />
            {/* Colored arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke={color}
              strokeWidth="20"
              strokeLinecap="round"
              strokeDasharray={`${(percentage / 100) * 251.2} 251.2`}
            />
            {/* Center text */}
            <text x="100" y="90" textAnchor="middle" className="text-3xl font-bold" fill={color}>
              {value}%
            </text>
          </svg>
          {/* Target line */}
          {target && (
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-center">
              <p className="text-xs text-gray-500">Target: {target}%</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header with Filters and Date Range */}
      <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">Timesheet Analytics</h1>
                {/* ✅ ADD SOFT LOADING INDICATOR */}
                {/* {softLoading && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                    <span>Updating...</span>
                  </div>
                )} */}
              </div>
              {/* <p className="text-gray-600">Comprehensive insights into time tracking and billing</p> */}
            </div>
      

            
            {/* Compact Date Range Filter - Inline with Title */}
            <div className="flex flex-wrap items-end gap-8">
              {/* Date Range Dropdown */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Date Range
                </label>
                <Select value={dateRange} onValueChange={handleDateRangeChange}>
                  <SelectTrigger className="w-45 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 Days</SelectItem>
                    <SelectItem value="30">Last 30 Days</SelectItem>
                    <SelectItem value="60">Last 60 Days</SelectItem>
                    <SelectItem value="90">Last 90 Days</SelectItem>
                    <SelectItem value="custom">Custom Date Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Date From Input */}
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
              
              {/* Date To Input */}
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
              
              {/* Apply Button - Only show for custom range */}
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
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Overview Cards - Centered */}
        {overview && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Hours</CardTitle>
                <Clock className="h-5 w-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{overview.totalHours.toFixed(2)}</div>
                <p className="text-sm text-gray-600 mt-2">
                  {overview.billableHours.toFixed(2)} billable hours
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Amount</CardTitle>
                <DollarSign className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  ₹{overview.totalAmount.toFixed(2)}
                </div>
                <p className="text-sm text-gray-600 mt-2">From billable hours</p>
                <div className="mt-3">
                  <Badge variant="outline" className="text-xs">
                    <Coins className="h-3 w-3 mr-1" />
                    Multi-currency matters
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Utilization Rate</CardTitle>
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">
                  {parseFloat(overview.utilizationRate).toFixed(2)}%
                </div>
                <p className="text-sm text-gray-600 mt-2">Billable efficiency</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* 1. Daily Timesheet Compliance - Line Graph */}
          {complianceData && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Daily Timesheet Compliance Trend
                </CardTitle>
                <p className="text-sm text-gray-600">
                  {complianceData.statistics.complianceRate}% compliance rate • {complianceData.statistics.daysWithEntries} of {complianceData.statistics.totalWorkdays} workdays completed
                </p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={complianceData.heatmapData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      style={{ fontSize: '11px' }}
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis 
                      style={{ fontSize: '11px' }}
                      label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      formatter={(value: any) => [`${value.toFixed(2)} hours`, 'Total Hours']}
                    />
                    <Legend />
                    
                    {/* Reference line at 6 hours (compliance threshold) */}
                    <line 
                      y1="0" 
                      y2="100%" 
                      x1="0" 
                      x2="0" 
                      stroke="#10b981" 
                      strokeWidth={2} 
                      strokeDasharray="5 5"
                    />
                    
                    <Line
                      type="monotone"
                      dataKey="totalHours"
                      stroke={COLORS.primary}
                      strokeWidth={3}
                      name="Daily Hours"
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        const color = getComplianceColor(payload.totalHours);
                        return (
                          <circle 
                            cx={cx} 
                            cy={cy} 
                            r={5} 
                            fill={color} 
                            stroke="white" 
                            strokeWidth={2}
                          />
                        );
                      }}
                    />
                    
                    {/* Add a reference line for 6-hour target */}
                    <line
                      y={6}
                      stroke={COLORS.secondary}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                    />
                  </LineChart>
                </ResponsiveContainer>
                
                {/* Legend */}
                <div className="flex gap-4 mt-4 text-xs justify-center flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#ef4444" }}></div>
                    <span>Missing (0h)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#f59e0b" }}></div>
                    <span>Partial (&lt;6h)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#10b981" }}></div>
                    <span>Complete (6h+)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-green-600 border-dashed rounded"></div>
                    <span>6-hour target line</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 2. Invoiced vs Non-Invoiced Timesheets */}
          {invoicedData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Invoiced vs Non-Invoiced Timesheets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Invoiced", value: invoicedData.invoiced.amount },
                        { name: "Non-Invoiced", value: invoicedData.nonInvoiced.amount },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill={COLORS.secondary} />
                      <Cell fill={COLORS.warning} />
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => `₹${value.toLocaleString('en-IN')}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Invoiced:</span>
                    <span className="font-semibold text-green-600">₹{invoicedData.invoiced.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Non-Invoiced:</span>
                    <span className="font-semibold text-orange-600">₹{invoicedData.nonInvoiced.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 pt-2 border-t">
                    <span>Invoiced Entries: {invoicedData.invoiced.count}</span>
                    <span>Pending: {invoicedData.nonInvoiced.count}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 3. Billable vs Non-Billable Split */}
          {billableSplit && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Billable vs Non-Billable Split
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={billableSplit.chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                      fill="#8884d8"
                      dataKey="hours"
                    >
                      <Cell fill={COLORS.primary} />
                      <Cell fill={COLORS.danger} />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Billable Hours:</span>
                    <span className="font-semibold text-blue-600">{billableSplit.billableHours.toFixed(2)}h</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Non-Billable Hours:</span>
                    <span className="font-semibold text-red-600">{billableSplit.nonBillableHours.toFixed(2)}h</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-blue-600 pt-2 border-t">
                    <span>Billable Rate:</span>
                    <span>{parseFloat(billableSplit.billablePercentage).toFixed(2)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 4. Hours Logged (Last 7/30 Days) - Line Chart */}
          {hoursLogged && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-purple-600" />
                  Hours Logged Trend (Last {dateRange} Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={hoursLogged.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      style={{ fontSize: '11px' }}
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis style={{ fontSize: '11px' }} />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      formatter={(value: any, name: string) => [`${value.toFixed(2)} hours`, name]}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="billableHours"
                      stroke={COLORS.primary}
                      strokeWidth={3}
                      name="Billable Hours"
                      dot={{ fill: COLORS.primary, r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="nonBillableHours"
                      stroke={COLORS.danger}
                      strokeWidth={3}
                      name="Non-Billable Hours"
                      dot={{ fill: COLORS.danger, r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="totalHours"
                      stroke={COLORS.secondary}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="Total Hours"
                      dot={{ fill: COLORS.secondary, r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* 5. Top Time Contributors - Leaderboard */}
          {topContributors.leaderboard.map((user: any) => (
            <div key={user.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <div 
                  className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                    user.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                    user.rank === 2 ? 'bg-gray-200 text-gray-700' :
                    user.rank === 3 ? 'bg-orange-100 text-orange-700' :
                    'bg-blue-100 text-blue-600'
                  }`}
                >
                  {user.rank}
                </div>
                <div>
                  <div className="font-medium text-sm">{user.userName}</div>
                  <div className="text-xs text-gray-500">
                    {user.billableHours.toFixed(2)}h billable • {user.totalHours > 0 ? ((user.billableHours / user.totalHours) * 100).toFixed(2) : '0.00'}% rate
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-sm">{user.totalHours.toFixed(2)}h</div>
                <div className="text-xs text-green-600 font-medium">
                  ₹{user.totalAmount.toFixed(2)}
                </div>
              </div>
            </div>
          ))}

          {/* 6. Missing Time Entries - Alert List */}
          {missingEntries && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  Missing Time Entries (Last 7 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {missingEntries.totalMissing === 0 ? (
                  <Alert className="bg-green-50 border-green-200">
                    <AlertDescription className="text-green-800">
                      ✓ All users have submitted their timesheets for the last 7 days.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="mb-3 p-3 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-sm font-semibold text-red-800">
                        {missingEntries.totalMissing} missing entries detected
                      </p>
                    </div>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {missingEntries.missingEntries.slice(0, 10).map((entry: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-red-50 rounded border border-red-100 hover:border-red-300 transition-colors">
                          <div>
                            <div className="font-medium text-sm text-gray-900">{entry.userName}</div>
                            <div className="text-xs text-gray-600">
                              {new Date(entry.missingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                          </div>
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        </div>
                      ))}
                      {missingEntries.totalMissing > 10 && (
                        <p className="text-xs text-gray-500 text-center mt-2 py-2 bg-gray-50 rounded">
                          +{missingEntries.totalMissing - 10} more missing entries
                        </p>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* 7. Average Realization per Attorney - Bar Chart */}
          {avgRealization && avgRealization.attorneys.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Average Realization per Attorney
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Revenue generated per hour worked
                </p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={avgRealization.attorneys}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      style={{ fontSize: '11px' }}
                    />
                    <YAxis 
                      tickFormatter={(value) => `₹${value}`}
                      style={{ fontSize: '11px' }}
                    />
                    <Tooltip 
                      formatter={(value: any) => [`₹${value.toFixed(2)}`, 'Avg Rate']}
                      labelStyle={{ color: '#374151' }}
                    />
                    <Bar 
                      dataKey="avgRate" 
                      fill={COLORS.secondary}
                      radius={[8, 8, 0, 0]}
                      name="Average Rate per Hour"
                    >
                      {avgRealization.attorneys.map((entry: any, index: number) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={index % 2 === 0 ? COLORS.secondary : COLORS.teal} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* 8. Utilization vs Target - Dual Gauge */}
          {utilization && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-600" />
                  Utilization vs Target - Performance Gauges
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="text-center">
                    <GaugeChart 
                      value={parseFloat(utilization.utilizationRate).toFixed(2)} 
                      target={utilization.targetUtilization}
                      title="Current Utilization"
                      color={parseFloat(utilization.utilizationRate) >= utilization.targetUtilization ? COLORS.secondary : COLORS.danger}
                    />
                    <p className="text-sm text-gray-600 mt-4">
                      {parseFloat(utilization.utilizationRate).toFixed(2)}% of total hours are billable
                    </p>
                  </div>
                  <div className="text-center">
                    <GaugeChart 
                      value={utilization.targetUtilization} 
                      title="Target Utilization"
                      color={COLORS.indigo}
                    />
                    <p className="text-sm text-gray-600 mt-4">
                      Target: {utilization.targetUtilization}% billable hours
                    </p>
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Variance from Target:</span>
                    <span className={`text-xl font-bold ${parseFloat(utilization.variance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {parseFloat(utilization.variance) >= 0 ? '+' : ''}{parseFloat(utilization.variance).toFixed(2)}%
                    </span>
                  </div>
                  <div className="mt-3 flex justify-center">
                    <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                      utilization.status === 'on-target' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {utilization.status === 'on-target' ? '✓ On Target' : '⚠ Below Target'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 9. Time by Practice Area - Stacked Bar */}
          {practiceArea && practiceArea.practiceAreaData.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-indigo-600" />
                  Time Distribution by Practice Area
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={practiceArea.practiceAreaData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="practiceArea" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      style={{ fontSize: '11px' }}
                    />
                    <YAxis 
                      label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
                      style={{ fontSize: '11px' }}
                    />
                    <Tooltip 
                      formatter={(value: any, name: string) => [`${value.toFixed(2)} hours`, name]}
                    />
                    <Legend />
                    <Bar 
                      dataKey="billableHours" 
                      stackId="a" 
                      fill={COLORS.primary} name="Billable Hours" />
                    <Bar dataKey="nonBillableHours" stackId="a" fill={COLORS.danger} name="Non-Billable Hours" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}