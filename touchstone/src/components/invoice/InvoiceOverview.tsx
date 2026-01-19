'use client';

import React, { useState, useEffect } from 'react';
import { DollarSign, FileText, AlertCircle, TrendingUp, Calendar, CheckCircle2 } from 'lucide-react';
import { API_ENDPOINTS } from '@/lib/api';
import { formatAmountWithCurrency } from '@/lib/currencyUtils';

interface InvoiceStats {
  totalInvoices: number;
  totalInvoiced: number;
  totalPaid: number;
  outstanding: number;
  overdueCount: number;
  paidCount: number;
  newCount: number;
  partiallyPaidCount: number;
}

export default function InvoiceOverview() {
  const [stats, setStats] = useState<InvoiceStats>({
    totalInvoices: 0,
    totalInvoiced: 0,
    totalPaid: 0,
    outstanding: 0,
    overdueCount: 0,
    paidCount: 0,
    newCount: 0,
    partiallyPaidCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(API_ENDPOINTS.invoices.list, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch invoices');
        }

        const data = await response.json();
        
        if (data.success && data.data) {
          const invoices = data.data;
          
          // Calculate statistics
          const totalInvoices = invoices.length;
          const totalInvoiced = invoices.reduce((sum: number, inv: { invoice_amount: number }) => 
            sum + (inv.invoice_amount || 0), 0
          );
          const totalPaid = invoices.reduce((sum: number, inv: { amount_paid: number }) => 
            sum + (inv.amount_paid || 0), 0
          );
          const outstanding = totalInvoiced - totalPaid;
          
          // Count by status
          const overdueCount = invoices.filter((inv: { status: string }) => inv.status === 'overdue').length;
          const paidCount = invoices.filter((inv: { status: string }) => inv.status === 'paid').length;
          const newCount = invoices.filter((inv: { status: string }) => inv.status === 'new').length;
          const partiallyPaidCount = invoices.filter((inv: { status: string }) => inv.status === 'partially_paid').length;

          setStats({
            totalInvoices,
            totalInvoiced,
            totalPaid,
            outstanding,
            overdueCount,
            paidCount,
            newCount,
            partiallyPaidCount,
          });
        }
      } catch (err) {
        console.error('Error fetching invoice stats:', err);
        setError('Failed to load invoice statistics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-100 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-300 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Invoiced',
      value: formatAmountWithCurrency(stats.totalInvoiced, 'INR'),
      icon: DollarSign,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Total Paid',
      value: formatAmountWithCurrency(stats.totalPaid, 'INR'),
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Outstanding',
      value: formatAmountWithCurrency(stats.outstanding, 'INR'),
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      title: 'Total Invoices',
      value: stats.totalInvoices.toString(),
      icon: FileText,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  const statusCards = [
    {
      title: 'Paid',
      count: stats.paidCount,
      color: 'text-green-700',
      bgColor: 'bg-green-100',
    },
    {
      title: 'New',
      count: stats.newCount,
      color: 'text-blue-700',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Partially Paid',
      count: stats.partiallyPaidCount,
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-100',
    },
    {
      title: 'Overdue',
      count: stats.overdueCount,
      color: 'text-red-700',
      bgColor: 'bg-red-100',
    },
  ];

  return (
    <div className="px-6 py-8 space-y-6">
      {/* Main Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              className={`${card.bgColor} rounded-lg p-6 border border-gray-200 shadow-sm`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <Icon className={`${card.color} h-5 w-5`} />
              </div>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Status Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-gray-600" />
          Invoice Status Breakdown
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statusCards.map((card, index) => (
            <div
              key={index}
              className={`${card.bgColor} rounded-lg p-4 border border-gray-200`}
            >
              <p className="text-sm font-medium text-gray-600 mb-1">{card.title}</p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.count}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
