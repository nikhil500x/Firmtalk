
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { API_ENDPOINTS } from '@/lib/api';
import { Check, X, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-toastify';
import { formatAmountWithCurrency, type CurrencyCode } from '@/lib/currencyUtils';
import CurrencyBadge from '@/components/ui/currency-badge';

interface ExpenseDetails {
  id: number;
  category: string;
  subCategory: string | null;
  description: string;
  amount: number;
  vendor: {
    id: number;
    name: string;
  } | null;
  dueDate: string | null;
  receiptUrl: string | null;
  notes: string | null;
  status: string;
  expenseIncluded: boolean;
}

interface TimesheetEntry {
  id: number;
  date: string;
  matterTitle: string;
  clientName: string;
  activityType: string;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  isBillable: boolean;
  expenses: ExpenseDetails[];
  status: 'pending' | 'approved' | 'rejected' | 'draft';
  remarks: string;
  notes: string;
  description: string;
  calculatedAmount: number | null;
  calculatedAmountCurrency?: string; // ✅ Added currency field
  hourlyRate: number | null;
  matterCurrency?: string; // ✅ Added matter currency field
}

interface TimesheetEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: TimesheetEntry | null;
  onSuccess?: () => void;
}

export default function TimesheetEntryDialog({
  open,
  onOpenChange,
  entry,
  onSuccess,
}: TimesheetEntryDialogProps) {
  // Get user role for authorization checks
  const { role } = useAuth();
  
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [showRejectionInput, setShowRejectionInput] = useState(false);
  const [expenseStates, setExpenseStates] = useState<Record<number, boolean>>({});
  const [isUpdatingExpense, setIsUpdatingExpense] = useState<Record<number, boolean>>({});

  // Authorization check: only certain roles can approve/reject timesheets
  const canApproveTimesheets = () => {
    const authorizedRoles = ['partner', 'admin', 'support', 'it', 'accountant'];
    return role?.name ? authorizedRoles.includes(role.name) : false;
  };

  // Initialize expense states when entry changes
  useEffect(() => {
    if (entry && entry.expenses) {
      const initialStates: Record<number, boolean> = {};
      entry.expenses.forEach(expense => {
        initialStates[expense.id] = expense.expenseIncluded;
      });
      setExpenseStates(initialStates);
    }
  }, [entry]);

  if (!entry) return null;

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleAcceptExpense = async (expenseId: number) => {
    setIsUpdatingExpense(prev => ({ ...prev, [expenseId]: true }));
    try {
      const response = await fetch(API_ENDPOINTS.timesheets.update(entry.id), {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expenseInclusionUpdates: [
            { expenseId, included: true }
          ]
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to accept expense');
      }

      setExpenseStates(prev => ({ ...prev, [expenseId]: true }));
      onSuccess?.();
    } catch (err) {
      console.error('Error accepting expense:', err);
      // alert(err instanceof Error ? err.message : 'Failed to accept expense');
      toast.error(err instanceof Error ? err.message : 'Failed to accept expense');
    } finally {
      setIsUpdatingExpense(prev => ({ ...prev, [expenseId]: false }));
    }
  };

  const handleRejectExpense = async (expenseId: number) => {
    setIsUpdatingExpense(prev => ({ ...prev, [expenseId]: true }));
    try {
      const response = await fetch(API_ENDPOINTS.timesheets.update(entry.id), {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expenseInclusionUpdates: [
            { expenseId, included: false }
          ]
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to reject expense');
      }

      setExpenseStates(prev => ({ ...prev, [expenseId]: false }));
      onSuccess?.();
    } catch (err) {
      console.error('Error rejecting expense:', err);
      // alert(err instanceof Error ? err.message : 'Failed to reject expense');
      toast.error(err instanceof Error ? err.message : 'Failed to reject expense');
    } finally {
      setIsUpdatingExpense(prev => ({ ...prev, [expenseId]: false }));
    }
  };

  const handleApprove = async () => {
    const confirmed = confirm("Are you sure you want to approve this timesheet?");
    if (!confirmed) return;

    setIsApproving(true);
    try {
      const response = await fetch(API_ENDPOINTS.timesheets.approve(entry.id), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to approve timesheet');
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error('Error approving timesheet:', err);
      // alert(err instanceof Error ? err.message : 'Failed to approve timesheet');
      toast.error(err instanceof Error ? err.message : 'Failed to approve timesheet');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionNotes.trim()) {
      // alert('Please provide a reason for rejection');
      toast.error('Please provide a reason for rejection');
      return;
    }

    setIsRejecting(true);
    try {
      const response = await fetch(API_ENDPOINTS.timesheets.reject(entry.id), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: rejectionNotes }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to reject timesheet');
      }

      setRejectionNotes('');
      setShowRejectionInput(false);
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error('Error rejecting timesheet:', err);
      // alert(err instanceof Error ? err.message : 'Failed to reject timesheet');
      toast.error(err instanceof Error ? err.message : 'Failed to reject timesheet');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleClose = () => {
    setRejectionNotes('');
    setShowRejectionInput(false);
    onOpenChange(false);
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-600';
      case 'pending':
        return 'bg-yellow-100 text-yellow-600';
      case 'rejected':
        return 'bg-red-100 text-red-600';
      case 'draft':
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusText = (status: string): string => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const formatCurrency = (amount: number, currency: CurrencyCode = 'INR') => {
    return formatAmountWithCurrency(amount, currency);
  };

  // ✅ Get timesheet amount only (no expenses - different currencies)
  const getTimesheetAmount = (): number => {
    return entry.calculatedAmount || 0;
  };

  // ✅ Get expense amount only (always in INR)
  const getTotalExpenseAmount = (): number => {
    if (!entry.expenses || entry.expenses.length === 0) return 0;
    return entry.expenses.reduce((sum, expense) => {
      return expenseStates[expense.id] ? sum + expense.amount : sum;
    }, 0);
  };

  // ✅ Get timesheet currency (from calculatedAmountCurrency or matterCurrency, fallback to INR)
  const getTimesheetCurrency = (): CurrencyCode => {
    return (entry.calculatedAmountCurrency || entry.matterCurrency || 'INR') as CurrencyCode;
  };

  // ✅ Check if currencies are different
  const hasMixedCurrencies = (): boolean => {
    const timesheetCurrency = getTimesheetCurrency();
    const expenseAmount = getTotalExpenseAmount();
    return timesheetCurrency !== 'INR' && expenseAmount > 0;
  };

  // ✅ DEPRECATED: Do not use this - it incorrectly mixes currencies
  // Keep for backward compatibility only
  const calculateTotalAmount = (): number => {
    // ⚠️ WARNING: This function incorrectly mixes currencies (USD + INR)
    // Display should show timesheet and expense amounts separately
    const timesheetAmount = getTimesheetAmount();
    const expenseAmount = getTotalExpenseAmount();
    const timesheetCurrency = getTimesheetCurrency();
    
    // If same currency, can add (but expenses are always INR)
    if (timesheetCurrency === 'INR') {
      return timesheetAmount + expenseAmount;
    }
    
    // Different currencies - cannot add directly
    // Return timesheet amount only (expenses shown separately)
    return timesheetAmount;
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Timesheet Entry Details</DialogTitle>
          <DialogDescription>
            Review and approve or reject this timesheet entry
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Status</span>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass(entry.status)}`}>
              {getStatusText(entry.status)}
            </span>
          </div>

          {/* Entry Information Grid */}
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Date</Label>
                <p className="mt-1 text-base text-gray-900">{entry.date}</p>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-500">Matter Title</Label>
                <p className="mt-1 text-base text-gray-900">{entry.matterTitle}</p>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-500">Client Name</Label>
                <p className="mt-1 text-base text-gray-900">{entry.clientName}</p>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-500">Activity Type</Label>
                <p className="mt-1 text-base text-gray-900">{entry.activityType}</p>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Total Hours</Label>
                <p className="mt-1 text-base text-gray-900">{(entry.totalHours ?? 0).toFixed(2)} hrs</p>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-500">Billable Hours</Label>
                <p className="mt-1 text-base text-gray-900">{(entry.billableHours ?? 0).toFixed(2)} hrs</p>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-500">Hourly Rate</Label>
                <p className="mt-1 text-base text-gray-900">
                  {entry.hourlyRate ? formatCurrency(entry.hourlyRate) : 'N/A'}
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-500">Time-based Amount</Label>
                <p className="mt-1 text-base font-semibold text-gray-900">
                  {entry.calculatedAmount ? formatCurrency(entry.calculatedAmount) : formatCurrency(0)}
                </p>
              </div>
            </div>
          </div>

          {/* Remarks */}
          {entry.remarks && (
            <div>
              <Label className="text-sm font-medium text-gray-500">Remarks</Label>
              <p className="mt-1 text-base text-gray-900 whitespace-pre-wrap">{entry.remarks}</p>
            </div>
          )}

          {/* Notes */}
          {entry.notes && (
            <div>
              <Label className="text-sm font-medium text-gray-500">Notes</Label>
              <p className="mt-1 text-base text-gray-900 whitespace-pre-wrap">{entry.notes}</p>
            </div>
          )}

          {/* Expenses Section */}
          {entry.expenses && entry.expenses.length > 0 && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Associated Expenses ({entry.expenses.length})
              </h3>

              <div className="space-y-4">
                {entry.expenses.map((expense, index) => (
                  <div key={expense.id} className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
                    <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                      <span className="text-sm font-medium text-gray-700">
                        Expense #{index + 1}
                      </span>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        expenseStates[expense.id] ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                      }`}>
                        {expenseStates[expense.id] ? 'Included in Total' : 'Excluded from Total'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs font-medium text-gray-500">Category</Label>
                        <p className="mt-1 text-sm text-gray-900 capitalize">
                          {expense.category.replace(/_/g, ' ')}
                        </p>
                      </div>
                      {expense.subCategory && (
                        <div>
                          <Label className="text-xs font-medium text-gray-500">Sub Category</Label>
                          <p className="mt-1 text-sm text-gray-900">{expense.subCategory}</p>
                        </div>
                      )}
                    </div>

                    <div>
                      <Label className="text-xs font-medium text-gray-500">Description</Label>
                      <p className="mt-1 text-sm text-gray-900">{expense.description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {expense.vendor && (
                        <div>
                          <Label className="text-xs font-medium text-gray-500">Vendor</Label>
                          <p className="mt-1 text-sm text-gray-900">{expense.vendor.name}</p>
                        </div>
                      )}
                      <div>
                        <Label className="text-xs font-medium text-gray-500">Amount</Label>
                        <p className="mt-1 text-base font-semibold text-gray-900">
                          {formatCurrency(expense.amount)}
                        </p>
                      </div>
                    </div>

                    {expense.receiptUrl && (
                      <div>
                        <Label className="text-xs font-medium text-gray-500">Receipt</Label>
                        <a
                          href={expense.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                        >
                          View Receipt
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    )}

                    {expense.notes && (
                      <div>
                        <Label className="text-xs font-medium text-gray-500">Expense Notes</Label>
                        <p className="mt-1 text-sm text-gray-600">{expense.notes}</p>
                      </div>
                    )}

                    {/* Accept/Reject Expense Buttons - Only visible to authorized roles */}
                    {entry.status === 'pending' && canApproveTimesheets() && (
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                        <Button
                          type="button"
                          size="sm"
                          variant={expenseStates[expense.id] ? 'default' : 'outline'}
                          onClick={() => handleAcceptExpense(expense.id)}
                          disabled={isUpdatingExpense[expense.id] || expenseStates[expense.id]}
                          className={expenseStates[expense.id] ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
                        >
                          <Check size={16} className="mr-1" />
                          {expenseStates[expense.id] ? 'Accepted' : 'Accept'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={!expenseStates[expense.id] ? 'default' : 'outline'}
                          onClick={() => handleRejectExpense(expense.id)}
                          disabled={isUpdatingExpense[expense.id] || !expenseStates[expense.id]}
                          className={!expenseStates[expense.id] ? 'bg-red-600 hover:bg-red-700 text-white' : 'border-red-300 text-red-600 hover:bg-red-50'}
                        >
                          <X size={16} className="mr-1" />
                          {!expenseStates[expense.id] ? 'Rejected' : 'Reject'}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Total Amount Summary */}
          <div className="border-t border-gray-200 pt-4">
            <div className="bg-blue-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium text-gray-900">Billable Amount Breakdown</Label>
              </div>
              <div className="text-sm text-gray-600 space-y-2">
                {/* Time-based charges */}
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    Time-based charges ({(entry.billableHours ?? 0).toFixed(2)} hrs × {entry.hourlyRate ? formatCurrency(entry.hourlyRate, getTimesheetCurrency()) : formatCurrency(0, getTimesheetCurrency())}):
                    {getTimesheetCurrency() !== 'INR' && (
                      <CurrencyBadge currency={getTimesheetCurrency()} />
                    )}
                  </span>
                  <span className="font-medium text-gray-900">
                    {entry.calculatedAmount 
                      ? formatAmountWithCurrency(entry.calculatedAmount, getTimesheetCurrency())
                      : formatCurrency(0, getTimesheetCurrency())
                    }
                  </span>
                </div>
                
                {/* Expenses */}
                {entry.expenses && entry.expenses.length > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2">
                      Total expense charges ({entry.expenses.filter(e => expenseStates[e.id]).length} of {entry.expenses.length} included):
                      <CurrencyBadge currency="INR" />
                    </span>
                    <span className={`font-medium ${getTotalExpenseAmount() > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                      {formatAmountWithCurrency(getTotalExpenseAmount(), 'INR')}
                    </span>
                  </div>
                )}
                
                {/* Warning if mixed currencies */}
                {hasMixedCurrencies() && (
                  <div className="bg-orange-50 border border-orange-200 rounded p-2 mt-2">
                    <p className="text-xs text-orange-800 font-medium">
                      ⚠️ Amounts are in different currencies ({getTimesheetCurrency()} and INR). Cannot add directly without conversion.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Rejection Notes Input (conditional) */}
          {showRejectionInput && (
            <div>
              <Label htmlFor="rejection-notes" className="text-sm font-medium text-red-600">
                Rejection Reason <span className="text-red-500 -ml-1.5">*</span>
              </Label>
              <Textarea
                id="rejection-notes"
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                placeholder="Please provide a reason for rejecting this entry..."
                rows={4}
                className="mt-2 border-red-300 focus:border-red-500 focus:ring-red-500"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isApproving || isRejecting}
          >
            Close
          </Button>

          {/* Only show approve/reject buttons to authorized roles */}
          {canApproveTimesheets() && (
            <div className="flex gap-2">
              {entry.status === 'pending' && (
                <>
                  {showRejectionInput ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowRejectionInput(false);
                          setRejectionNotes('');
                        }}
                        disabled={isRejecting}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={handleReject}
                        disabled={isRejecting || !rejectionNotes.trim()}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowRejectionInput(true)}
                        disabled={isApproving}
                        className="border-red-600 text-red-600 hover:bg-red-50"
                      >
                        Reject Timesheet
                      </Button>
                      <Button
                        type="button"
                        onClick={handleApprove}
                        disabled={isApproving}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        {isApproving ? 'Approving...' : 'Approve Timesheet'}
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}