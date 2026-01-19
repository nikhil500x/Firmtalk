'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Edit2, DollarSign, X } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';


import { API_ENDPOINTS } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import ExpenseRecordDialog from '@/components/finance/ExpenseRecordDialog';
import { toast } from 'react-toastify';


interface Vendor {
  vendor_id: number;
  vendor_name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
}

interface Matter {
  matter_id: number;
  matter_title: string;
  client?: {
    client_id: number;
    client_name: string;
  };
}

interface Recorder {
  user_id: number;
  name: string;
  email?: string;
}

interface OneTimeExpense {
  expense_id: number;
  category: string;
  sub_category?: string;
  description: string;
  vendor?: Vendor | null;
  amount: number;
  due_date?: string | null;
  matter?: Matter | null;
  receipt_url?: string | null;
  notes?: string | null;
  status: 'pending' | 'partially_paid' | 'paid';
  created_at: string;
  recorder: Recorder;
  payments: Payment[];
  total_paid?: number;
  remaining?: number;
}

interface Payment {
  payment_id: number;
  payment_date: string;
  amount: number;
  payment_method: string;
  transaction_ref: string | null;
  notes: string | null;
  recorder: Recorder;
}

export default function OneTimeExpenseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const expenseId = parseInt(params.expense_id as string);

  const [expense, setExpense] = useState<OneTimeExpense | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);


  const [paymentForm, setPaymentForm] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    amount: '',
    paymentMethod: '',
    transactionRef: '',
    notes: '',
  });

    // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchExpense = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        API_ENDPOINTS.expenses.oneTime.byId(expenseId),
        {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch expense');
      }

      const data = await response.json();

      if (data.success) {
        setExpense(data.data);
      } else {
        setError(data.message || 'Failed to load expense');
      }
    } catch (err) {
      console.error('Fetch expense error:', err);
      setError('Failed to load expense. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [expenseId, router]);

  const fetchPayments = useCallback(async () => {
    try {
      const response = await fetch(
        API_ENDPOINTS.expenses.payments.listForOneTime(expenseId),
        {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch payments');

      const data = await response.json();
      if (data.success) {
        setPayments(data.data || []);
      }
    } catch (err) {
      console.error('Fetch payments error:', err);
    }
  }, [expenseId]);

  useEffect(() => {
    fetchExpense();
    fetchPayments();
  }, [fetchExpense, fetchPayments]);

    // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!paymentForm.amount || !paymentForm.paymentMethod) {
      // alert('Please fill in all required fields');
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmittingPayment(true);

    try {
      const response = await fetch(
        API_ENDPOINTS.expenses.payments.record(),
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            onetime_expense_id: expenseId,
            amount: parseFloat(paymentForm.amount),
            payment_date: paymentForm.paymentDate,
            payment_method: paymentForm.paymentMethod,
            transaction_ref: paymentForm.transactionRef || null,
            notes: paymentForm.notes || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to record payment');
      }

      // alert('Payment recorded successfully!');
      toast.success('Payment recorded successfully!');
      setShowPaymentForm(false);

      // Reset form
      setPaymentForm({
        paymentDate: new Date().toISOString().split('T')[0],
        amount: '',
        paymentMethod: '',
        transactionRef: '',
        notes: '',
      });

      fetchExpense();
      fetchPayments();
    } catch (error) {
      console.error('Record payment error:', error);
      // alert(error instanceof Error ? error.message : 'Failed to record payment');
      toast.error(error instanceof Error ? error.message : 'Failed to record payment');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const formatDate = (dateString: string): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number): string => {
    return `₹${amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'partially_paid':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'paid':
        return 'Paid';
      case 'partially_paid':
        return 'Partially Paid';
      case 'pending':
        return 'Pending';
      default:
        return status;
    }
  };

  const getPaymentProgress = (): number => {
    if (!expense || expense.amount === 0) return 0;
    return ((expense.total_paid || 0) / expense.amount) * 100;
  };

    // ============================================================================
  // RENDER
  // ============================================================================

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-[22px] shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex flex-col items-center justify-center py-24">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-lg font-medium text-gray-600">
              Loading expense...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !expense) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-[22px] shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex flex-col items-center justify-center py-24">
            <p className="text-lg font-medium text-red-600 mb-4">
              {error || 'Expense not found'}
            </p>
            <Button onClick={() => router.push('/finance')}>
              Back to Expenses
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const remainingAmount =
    (expense.amount || 0) - (expense.total_paid || 0);

  return (
    <div className="p-6">
      <div className="bg-white rounded-[22px] shadow-sm border border-gray-200 overflow-hidden">

        {/* ===========================
            HEADER
        ============================ */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/finance')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} className="text-gray-600" />
              </button>

              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  One-Time Expense #{expense.expense_id}
                </h1>

                <p className="text-sm text-gray-500 mt-1">
                  Created {formatDate(expense.created_at)} by{' '}
                  {expense.recorder.name}
                </p>
              </div>
            </div>

            <span
              className={`px-4 py-2 rounded-full text-sm font-semibold border ${getStatusBadgeClass(
                expense.status
              )}`}
            >
              {getStatusText(expense.status)}
            </span>
          </div>

          {/* ===========================
              ACTION BUTTONS
          ============================ */}
          <div className="flex items-center gap-3">

            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => setIsEditDialogOpen(true)}
            >
            <Edit2 size={16} />
              Edit Expense
            </Button>


            {expense.status !== 'paid' && (
              <Button
                onClick={() => setShowPaymentForm(!showPaymentForm)}
                className="flex items-center gap-2 ml-auto"
              >
                <DollarSign size={16} />
                Record Payment
              </Button>
            )}
          </div>
        </div>

        {/* ===========================
            PAYMENT FORM COLLAPSIBLE
        ============================ */}
        {showPaymentForm && (
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Record Payment
              </h3>

              <button
                onClick={() => setShowPaymentForm(false)}
                className="p-1 hover:bg-blue-100 rounded"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            <form
              onSubmit={handleRecordPayment}
              className="grid grid-cols-5 gap-4"
            >
              {/* Payment Date */}
              <div>
                <Label htmlFor="paymentDate">Payment Date</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      paymentDate: e.target.value,
                    })
                  }
                  required
                />
              </div>

              {/* Amount */}
              <div>
                <Label htmlFor="amount">Amount (₹)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="Enter amount"
                  value={paymentForm.amount}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      amount: e.target.value,
                    })
                  }
                  required
                />
              </div>

              {/* Payment Method */}
              <div>
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select
                  value={paymentForm.paymentMethod}
                  onValueChange={(value) =>
                    setPaymentForm({
                      ...paymentForm,
                      paymentMethod: value,
                    })
                  }
                  required
                >
                  <SelectTrigger id="paymentMethod">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">
                      Bank Transfer
                    </SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Transaction Ref */}
              <div>
                <Label htmlFor="transactionRef">
                  Transaction Ref (Optional)
                </Label>
                <Input
                  id="transactionRef"
                  type="text"
                  placeholder="Reference #"
                  value={paymentForm.transactionRef}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      transactionRef: e.target.value,
                    })
                  }
                />
              </div>

              {/* Submit */}
              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="w-full"
                >
                  {isSubmittingPayment ? 'Recording...' : 'Record Payment'}
                </Button>
              </div>
            </form>
          </div>
        )}

                {/* ===========================
            CONTENT GRID
        ============================ */}
        <div className="grid grid-cols-3 gap-6 p-6">
          
          {/* LEFT COLUMN — EXPENSE PREVIEW (2/3) */}
          <div className="col-span-2 bg-gray-50 rounded-lg p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Expense Details
            </h3>

            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Category:</span>
                <span className="font-semibold">{expense.category}</span>
              </div>

              {expense.sub_category && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Sub-Category:</span>
                  <span>{expense.sub_category}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-gray-600">Amount:</span>
                <span className="font-bold text-gray-900">
                  {formatCurrency(expense.amount)}
                </span>
              </div>

              <div>
                <span className="text-gray-600 block mb-1">Description:</span>
                <p className="text-gray-800">{expense.description}</p>
              </div>

              {expense.vendor && (
                <div>
                  <span className="text-gray-600 block mb-1">Vendor:</span>
                  <p className="font-medium">{expense.vendor.vendor_name}</p>
                  {expense.vendor.contact_person && (
                    <p className="text-gray-600 text-xs">
                      Contact: {expense.vendor.contact_person}
                    </p>
                  )}
                </div>
              )}

              {expense.matter && (
                <div>
                  <span className="text-gray-600 block mb-1">Matter:</span>
                  <p className="font-medium">{expense.matter.matter_title}</p>
                  {expense.matter.client && (
                    <p className="text-gray-600 text-xs">
                      Client: {expense.matter.client.client_name}
                    </p>
                  )}
                </div>
              )}

              {expense.due_date && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Due Date:</span>
                  <span className="font-medium">
                    {formatDate(expense.due_date)}
                  </span>
                </div>
              )}

              {expense.notes && (
                <div>
                  <span className="text-gray-600 block mb-1">Notes:</span>
                  <p className="italic text-gray-700">{expense.notes}</p>
                </div>
              )}

              {expense.receipt_url && (
                <div className="mt-4">
                  <a
                    href={expense.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    View Receipt
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN — PAYMENT SUMMARY (1/3) */}
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 uppercase mb-4">
                Payment Summary
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Amount:</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(expense.amount)}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Paid:</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(expense.total_paid || 0)}
                  </span>
                </div>

                <div className="pt-3 border-t border-gray-300">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Remaining:</span>
                    <span
                      className={`font-bold ${
                        remainingAmount > 0
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}
                    >
                      {formatCurrency(remainingAmount)}
                    </span>
                  </div>

                  {expense.amount > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Payment Progress</span>
                        <span>{getPaymentProgress().toFixed(0)}%</span>
                      </div>

                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            expense.status === 'paid'
                              ? 'bg-green-500'
                              : expense.status === 'partially_paid'
                              ? 'bg-blue-500'
                              : 'bg-yellow-500'
                          }`}
                          style={{ width: `${getPaymentProgress()}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* PAYMENT HISTORY */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 uppercase">
                  Payment History ({payments.length})
                </h3>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {payments.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 text-sm">
                    No payments recorded yet
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {payments.map((p) => (
                      <div key={p.payment_id} className="p-4 hover:bg-gray-50">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-semibold text-gray-900">
                            {formatCurrency(p.amount)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDate(p.payment_date)}
                          </span>
                        </div>

                        <div className="space-y-1 text-xs text-gray-600">
                          <div className="flex justify-between">
                            <span>Method:</span>
                            <span className="font-medium">
                              {p.payment_method.toUpperCase()}
                            </span>
                          </div>

                          {p.transaction_ref && (
                            <div className="flex justify-between">
                              <span>Ref:</span>
                              <span className="font-mono">{p.transaction_ref}</span>
                            </div>
                          )}

                          <div className="flex justify-between">
                            <span>Recorded by:</span>
                            <span>{p.recorder.name}</span>
                          </div>

                          {p.notes && (
                            <p className="mt-2 text-gray-500 italic">
                              &quot;{p.notes}&quot;
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* EDIT EXPENSE DIALOG */}
            <ExpenseRecordDialog
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            onSuccess={() => {
                fetchExpense();  // refresh updated data
            }}
            mode="edit"
            expenseId={expense.expense_id}
            initialData={{
                expense_id: expense.expense_id,
                category: expense.category,
                sub_category: expense.sub_category ?? "",
                description: expense.description,
                vendor: expense.vendor
                ? {
                    vendor_id: expense.vendor.vendor_id,
                    vendor_name: expense.vendor.vendor_name
                    }
                : null,
                matter: expense.matter
                ? {
                    matter_id: expense.matter.matter_id,
                    matter_title: expense.matter.matter_title
                    }
                : null,
                amount: expense.amount,
                due_date: expense.due_date ?? null,
                receipt_url: expense.receipt_url ?? null,
                notes: expense.notes ?? null
            }}
            />
        </div>
      </div>
    </div>

    
  );
}
