'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, RefreshCw, CreditCard, TrendingUp, Loader2, IndianRupee, Download } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

interface PaymentData {
  paymentId: number;
  invoiceId: number;
  invoiceNumber: string;
  clientId: number;
  clientName: string;
  matterId: number;
  matterTitle: string;
  paymentAmount: number;
  totalInvoiceAmount: number;
  amountPaid: number;
  paymentDate: string;
  paymentMethod: string;
  transactionRef: string | null;
  notes: string | null;
  recordedBy: string;
  invoiceStatus: string;
  billingLocation: string;
}

interface MonthlyData {
  month: string;
  monthShort: string;
  year: number;
  total: number;
}

interface FYSummary {
  fyStart: string;
  fyEnd: string;
  fyLabel: string;
  months: MonthlyData[];
  grandTotal: number;
  totalPayments: number;
}

export default function PaidThisWeekTable() {
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [weekStart, setWeekStart] = useState<string>('');
  const [weekEnd, setWeekEnd] = useState<string>('');
  const [totalPaidThisWeek, setTotalPaidThisWeek] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // FY Summary state
  const [fySummary, setFySummary] = useState<FYSummary | null>(null);
  const [isFYLoading, setIsFYLoading] = useState(true);

  const fetchPaidThisWeek = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/invoices/paid-this-week`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch payments');
      }

      const data = await response.json();
      if (data.success) {
        setPayments(data.data.payments);
        setWeekStart(data.data.weekStart);
        setWeekEnd(data.data.weekEnd);
        setTotalPaidThisWeek(data.data.totalPaidThisWeek);
      } else {
        throw new Error(data.message || 'Failed to fetch payments');
      }
    } catch (err) {
      console.error('Error fetching paid this week:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchFYSummary = useCallback(async () => {
    setIsFYLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/invoices/fy-monthly-summary`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch FY summary');
      }

      const data = await response.json();
      if (data.success) {
        setFySummary(data.data);
      }
    } catch (err) {
      console.error('Error fetching FY summary:', err);
    } finally {
      setIsFYLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPaidThisWeek();
    fetchFYSummary();
  }, [fetchPaidThisWeek, fetchFYSummary]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPaymentMethod = (method: string) => {
    const methods: Record<string, string> = {
      bank_transfer: 'Bank Transfer',
      check: 'Cheque',
      upi: 'UPI',
      cash: 'Cash',
    };
    return methods[method] || method;
  };

  const getStatusBadge = (status: string) => {
    const statusStyles: Record<string, string> = {
      paid: 'bg-green-100 text-green-800',
      partially_paid: 'bg-yellow-100 text-yellow-800',
      overdue: 'bg-red-100 text-red-800',
      new: 'bg-blue-100 text-blue-800',
    };
    return statusStyles[status] || 'bg-gray-100 text-gray-800';
  };

  const formatStatus = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Calculate max for bar chart scaling
  const maxMonthlyTotal = fySummary 
    ? Math.max(...fySummary.months.map(m => m.total), 1) 
    : 1;

  // Download as CSV
  const downloadCSV = () => {
    if (payments.length === 0) return;

    const headers = [
      'Invoice #',
      'Client',
      'Matter',
      'Payment Amount',
      'Invoice Total',
      'Payment Date',
      'Method',
      'Status',
      'Transaction Ref',
      'Notes',
      'Recorded By'
    ];

    const rows = payments.map(p => [
      p.invoiceNumber,
      `"${p.clientName.replace(/"/g, '""')}"`,
      `"${p.matterTitle.replace(/"/g, '""')}"`,
      p.paymentAmount,
      p.totalInvoiceAmount,
      formatDate(p.paymentDate),
      formatPaymentMethod(p.paymentMethod),
      formatStatus(p.invoiceStatus),
      p.transactionRef || '',
      `"${(p.notes || '').replace(/"/g, '""')}"`,
      p.recordedBy
    ]);

    // Add summary row
    rows.push([]);
    rows.push(['Total Paid This Week', '', '', totalPaidThisWeek, '', '', '', '', '', '', '']);
    if (fySummary) {
      rows.push([`${fySummary.fyLabel} Total`, '', '', fySummary.grandTotal, '', '', '', '', '', '', '']);
    }

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Paid_This_Week_${formatDate(weekStart).replace(/\s/g, '_')}_to_${formatDate(weekEnd).replace(/\s/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading payments...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header with week info */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Week: {formatDate(weekStart)} - {formatDate(weekEnd)}
            </h3>
            <p className="text-sm text-gray-500">
              {payments.length} payment{payments.length !== 1 ? 's' : ''} this week
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadCSV}
            disabled={payments.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
          <button
            onClick={() => { fetchPaidThisWeek(); fetchFYSummary(); }}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* This Week Total */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">Paid This Week</span>
          </div>
          <p className="text-2xl font-bold text-blue-900">{formatCurrency(totalPaidThisWeek)}</p>
        </div>

        {/* FY Total */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-700">
              {fySummary?.fyLabel || 'FY'} Total
            </span>
          </div>
          {isFYLoading ? (
            <Loader2 className="w-6 h-6 animate-spin text-green-600" />
          ) : (
            <p className="text-2xl font-bold text-green-900">
              {formatCurrency(fySummary?.grandTotal || 0)}
            </p>
          )}
        </div>
      </div>

      {/* FY Monthly Breakdown */}
      {fySummary && !isFYLoading && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
          <h4 className="font-semibold text-gray-900 mb-4">
            {fySummary.fyLabel} Monthly Breakdown
          </h4>
          <div className="grid grid-cols-12 gap-2">
            {fySummary.months.map((month) => (
              <div key={month.month} className="text-center">
                <div className="h-24 flex flex-col justify-end mb-1">
                  <div
                    className="bg-blue-500 rounded-t transition-all duration-300"
                    style={{
                      height: `${(month.total / maxMonthlyTotal) * 100}%`,
                      minHeight: month.total > 0 ? '4px' : '0',
                    }}
                  />
                </div>
                <p className="text-xs font-medium text-gray-600">{month.monthShort}</p>
                <p className="text-xs text-gray-500">
                  {month.total > 0 ? `₹${(month.total / 100000).toFixed(1)}L` : '-'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payments Table */}
      {payments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <IndianRupee className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No payments recorded this week</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Invoice #
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Matter
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Payment Amount
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Invoice Total
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Payment Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {payments.map((payment) => (
                <tr key={payment.paymentId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-blue-600">{payment.invoiceNumber}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {payment.clientName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {payment.matterTitle}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                    {formatCurrency(payment.paymentAmount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">
                    {formatCurrency(payment.totalInvoiceAmount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(payment.paymentDate)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatPaymentMethod(payment.paymentMethod)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(payment.invoiceStatus)}`}>
                      {formatStatus(payment.invoiceStatus)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

