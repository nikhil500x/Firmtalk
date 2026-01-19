'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, DollarSign, User, Building, Package, Edit, Trash2 } from 'lucide-react';
import SalaryDialog from '@/components/finance/SalaryDialog';
import OfficeExpenseDialog from '@/components/finance/OfficeExpenseDialog';
import SubscriptionDialog from '@/components/finance/SubscriptionDialog';
import { formatRoleDisplay } from '@/utils/roleDisplay';
import { toast } from 'react-toastify';

interface RecurringExpense {
  expense_id: number;
  recurring_type: string;
  amount: number;
  start_date: string;
  end_date: string | null;
  recurrence_type: string;
  cycle_day: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  
  // Salary fields
  user_id: number | null;
  gross_salary: number | null;
  deductions: number | null;
  net_salary: number | null;
  lawyer?: {
    user_id: number;
    name: string;
    email: string;
    role: {
      name: string;
    };
  } | null;
  
  // Office expense fields
  sub_category: string | null;
  vendor?: {
    vendor_id: number;
    vendor_name: string;
    contact_name: string | null;
    phone: string | null;
  } | null;
  
  // Subscription fields
  software_name: string | null;
  description: string | null;
  seats_licenses: number | null;
  
  // Payment info
  _count: {
    payments: number;
  };
}

export default function RecurringExpenseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const expenseId = params.expenseId as string;
  
  const [expense, setExpense] = useState<RecurringExpense | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchExpense = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${ process.env.NEXT_PUBLIC_BACKEND_URL }/api/expenses/recurring/${expenseId}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch expense details');
      }

      const data = await response.json();
      setExpense(data.data);
    } catch (err) {
      console.error('Fetch expense error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load expense');
    } finally {
      setLoading(false);
    }
  }, [expenseId]);

  useEffect(() => {
    fetchExpense();
  }, [fetchExpense]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleBack = () => {
    router.push('/finance?tab=recurring');
  };

  const handleEdit = () => {
    setIsEditDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this recurring expense?')) {
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/expenses/recurring/${expenseId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete expense');
      }

      // alert('Expense deleted successfully');
      toast.success('Expense deleted successfully');
      router.push('/finance?tab=recurring');
    } catch (error) {
      console.error('Delete error:', error);
      // alert('Failed to delete expense');
      toast.error('Failed to delete expense');
    }
  };

  const handleEditSuccess = () => {
    fetchExpense();
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'salary':
        return 'Salary';
      case 'office_expense':
        return 'Office Expense';
      case 'subscription':
        return 'Software Subscription';
      default:
        return type;
    }
  };

  // ============================================================================
  // RENDER STATES
  // ============================================================================

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-lg font-medium text-gray-600">Loading expense details...</p>
        </div>
      </div>
    );
  }

  if (error || !expense) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-[22px] shadow-sm border border-gray-200 p-8">
          <div className="text-center">
            <p className="text-lg font-medium text-red-600 mb-4">
              {error || 'Expense not found'}
            </p>
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Recurring Expenses
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      {/* EDIT DIALOGS */}
      {expense.recurring_type === 'salary' && (
        <SalaryDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSuccess={handleEditSuccess}
          mode="edit"
          expenseId={expense.expense_id}
          initialData={expense}
        />
      )}
      {expense.recurring_type === 'office_expense' && (
        <OfficeExpenseDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSuccess={handleEditSuccess}
          mode="edit"
          expenseId={expense.expense_id}
          initialData={expense}
        />
      )}
      {expense.recurring_type === 'subscription' && (
        <SubscriptionDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSuccess={handleEditSuccess}
          mode="edit"
          expenseId={expense.expense_id}
          initialData={expense}
        />
      )}

      <div className="p-6">
        {/* BACK BUTTON */}
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">Back to Recurring Expenses</span>
        </button>

        {/* MAIN CONTENT */}
        <div className="bg-white rounded-[22px] shadow-sm border border-gray-200 overflow-hidden">
          {/* HEADER */}
          <div className="px-6 py-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-semibold text-gray-900">
                    {expense.recurring_type === 'salary' && expense.lawyer?.name}
                    {expense.recurring_type === 'office_expense' && 
                      (expense.sub_category?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Office Expense')}
                    {expense.recurring_type === 'subscription' && expense.software_name}
                  </h1>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass(expense.status)}`}>
                    {expense.status.charAt(0).toUpperCase() + expense.status.slice(1)}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {getTypeLabel(expense.recurring_type)} • ID: {expense.expense_id}
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Edit size={18} />
                  <span>Edit</span>
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 size={18} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>

          {/* CONTENT */}
          <div className="p-6">
            {/* AMOUNT CARD */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 mb-6 border border-green-200">
              <div className="flex items-center gap-3 mb-2">
                <DollarSign size={24} className="text-green-600" />
                <h2 className="text-lg font-semibold text-gray-700">Amount</h2>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(expense.amount)}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Recurring {expense.recurrence_type} on day {expense.cycle_day}
              </p>
            </div>

            {/* DETAILS SECTIONS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* SALARY SPECIFIC */}
              {expense.recurring_type === 'salary' && (
                <>
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <div className="flex items-center gap-3 mb-4">
                      <User size={20} className="text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Lawyer Details</h3>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-500">Name</p>
                        <p className="text-base font-medium text-gray-900">{expense.lawyer?.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="text-base text-gray-900">{expense.lawyer?.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Role</p>
                        <p className="text-base text-gray-900">
                          {formatRoleDisplay(expense.lawyer?.role.name)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <div className="flex items-center gap-3 mb-4">
                      <DollarSign size={20} className="text-green-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Salary Breakdown</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <p className="text-sm text-gray-500">Gross Salary</p>
                        <p className="text-base font-medium text-gray-900">
                          {formatCurrency(expense.gross_salary || 0)}
                        </p>
                      </div>
                      <div className="flex justify-between">
                        <p className="text-sm text-gray-500">Deductions</p>
                        <p className="text-base font-medium text-red-600">
                          - {formatCurrency(expense.deductions || 0)}
                        </p>
                      </div>
                      <div className="border-t border-gray-300 pt-2">
                        <div className="flex justify-between">
                          <p className="text-base font-semibold text-gray-900">Net Salary</p>
                          <p className="text-lg font-bold text-green-600">
                            {formatCurrency(expense.net_salary || expense.amount)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* OFFICE EXPENSE SPECIFIC */}
              {expense.recurring_type === 'office_expense' && (
                <>
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <div className="flex items-center gap-3 mb-4">
                      <Building size={20} className="text-purple-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Expense Details</h3>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-500">Category</p>
                        <p className="text-base font-medium text-gray-900 capitalize">
                          {expense.sub_category?.replace('_', ' ') || 'Office Expense'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Amount</p>
                        <p className="text-base font-medium text-gray-900">
                          {formatCurrency(expense.amount)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {expense.vendor && (
                    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                      <div className="flex items-center gap-3 mb-4">
                        <Building size={20} className="text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Vendor</h3>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-500">Name</p>
                          <p className="text-base font-medium text-gray-900">{expense.vendor.vendor_name}</p>
                        </div>
                        {expense.vendor.contact_name && (
                          <div>
                            <p className="text-sm text-gray-500">Contact</p>
                            <p className="text-base text-gray-900">{expense.vendor.contact_name}</p>
                          </div>
                        )}
                        {expense.vendor.phone && (
                          <div>
                            <p className="text-sm text-gray-500">Phone</p>
                            <p className="text-base text-gray-900">{expense.vendor.phone}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* SUBSCRIPTION SPECIFIC */}
              {expense.recurring_type === 'subscription' && (
                <>
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <div className="flex items-center gap-3 mb-4">
                      <Package size={20} className="text-indigo-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Subscription Details</h3>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-500">Software Name</p>
                        <p className="text-base font-medium text-gray-900">{expense.software_name}</p>
                      </div>
                      {expense.description && (
                        <div>
                          <p className="text-sm text-gray-500">Description</p>
                          <p className="text-base text-gray-900">{expense.description}</p>
                        </div>
                      )}
                      {expense.seats_licenses && (
                        <div>
                          <p className="text-sm text-gray-500">Seats/Licenses</p>
                          <p className="text-base text-gray-900">{expense.seats_licenses}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {expense.end_date && (
                    <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
                      <div className="flex items-center gap-3 mb-4">
                        <Calendar size={20} className="text-yellow-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Subscription Period</h3>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-500">End Date</p>
                          <p className="text-base font-medium text-gray-900">
                            {formatDate(expense.end_date)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* SCHEDULE INFO */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                  <Calendar size={20} className="text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Schedule</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500">Start Date</p>
                    <p className="text-base font-medium text-gray-900">{formatDate(expense.start_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Recurrence</p>
                    <p className="text-base text-gray-900 capitalize">{expense.recurrence_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Cycle Day</p>
                    <p className="text-base text-gray-900">Day {expense.cycle_day} of the month</p>
                  </div>
                  {/* <div>
                    <p className="text-sm text-gray-500">Total Payments Made</p>
                    <p className="text-base font-medium text-gray-900">{expense._count.payments} payments</p>
                  </div> */}
                </div>
              </div>

              {/* NOTES */}
              {expense.notes && (
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 lg:col-span-2">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Notes</h3>
                  <p className="text-base text-gray-700 whitespace-pre-wrap">{expense.notes}</p>
                </div>
              )}
            </div>

            {/* TIMESTAMPS */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex gap-6 text-sm text-gray-500">
                <div>
                  <span className="font-medium">Created:</span> {formatDate(expense.created_at)}
                </div>
                <div>
                  <span className="font-medium">Last Updated:</span> {formatDate(expense.updated_at)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

