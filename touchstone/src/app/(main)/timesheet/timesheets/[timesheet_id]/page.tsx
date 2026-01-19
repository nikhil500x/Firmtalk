"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Clock, ExternalLink } from "lucide-react";
import { API_ENDPOINTS } from "@/lib/api";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "react-day-picker";
import { toast } from "react-toastify";
import { formatAmountWithCurrency, type CurrencyCode } from '@/lib/currencyUtils';
import CurrencyBadge from '@/components/ui/currency-badge';

/**
 * Expense Interface
 */
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

/**
 * Timesheet Details Interface
 */
interface TimesheetDetails {
  id: number;
  date: string;
  userId: number;
  userName: string;
  userEmail: string;
  userRole: string;
  matterId: number;
  matterTitle: string;
  clientId: number;
  clientName: string;
  activityType: string;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  description: string | null;
  notes: string | null;
  calculatedAmount: number | null;
  calculatedAmountCurrency?: string; // ✅ Added currency field
  hourlyRate: number | null;
  matterCurrency?: string; // ✅ Added matter currency field
  expenses: ExpenseDetails[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Timesheet Entry for Table
 */
interface TimesheetEntry {
  id: number;
  date: string;
  matterTitle: string;
  clientName: string;
  activityType: string;
  totalHours: number;
  billableHours: number;
  remarks: string;
  notes: string;
}

export default function IndividualTimesheetPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const timesheetId = params.timesheet_id as string;

  const [timesheetDetails, setTimesheetDetails] =
    useState<TimesheetDetails | null>(null);
  const [userTimesheetEntries, setUserTimesheetEntries] = useState<
    TimesheetEntry[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"expenses" | "entries">(
    "expenses"
  );

  // Expense management state
  const [expenseStates, setExpenseStates] = useState<Record<number, boolean>>(
    {}
  );
  const [isUpdatingExpense, setIsUpdatingExpense] = useState<
    Record<number, boolean>
  >({});

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchTimesheetDetails = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        API_ENDPOINTS.timesheets.byId(parseInt(timesheetId)),
        {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to fetch timesheet details");
      }

      const data = await response.json();

      console.log("Fetched timesheet details:", data);

      if (data.success) {
        const timesheetData = data.data;

        // Set timesheet details
        setTimesheetDetails({
          id: timesheetData.id,
          date: timesheetData.date,
          userId: timesheetData.userId,
          userName: timesheetData.userName,
          userEmail: timesheetData.userEmail,
          userRole: timesheetData.userRole,
          matterId: timesheetData.matterId,
          matterTitle: timesheetData.matterTitle,
          clientId: timesheetData.clientId,
          clientName: timesheetData.clientName,
          activityType: timesheetData.activityType,
          totalHours: timesheetData.totalHours,
          billableHours: timesheetData.billableHours,
          nonBillableHours: timesheetData.nonBillableHours,
          description: timesheetData.description,
          notes: timesheetData.notes,
          calculatedAmount: timesheetData.calculatedAmount,
          hourlyRate: timesheetData.hourlyRate,
          expenses: timesheetData.expenses || [],
          createdAt: timesheetData.createdAt,
          updatedAt: timesheetData.updatedAt,

          calculatedAmountCurrency: timesheetData.matter?.currency,
  matterCurrency: timesheetData.matter?.currency,
        });

        // Initialize expense states
        if (timesheetData.expenses) {
          const initialStates: Record<number, boolean> = {};
          timesheetData.expenses.forEach((expense: ExpenseDetails) => {
            initialStates[expense.id] = expense.expenseIncluded;
          });
          setExpenseStates(initialStates);
        }
      } else {
        setError(data.message || "Failed to load timesheet details");
      }
    } catch (err) {
      console.error("Fetch timesheet details error:", err);
      setError("Failed to load timesheet details. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [timesheetId, router]);

  const fetchUserTimesheetEntries = useCallback(async () => {
    if (!timesheetDetails) return;

    try {
      const response = await fetch(
        API_ENDPOINTS.timesheets.byUser(timesheetDetails.userId),
        {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch user timesheet entries");
      }

      const data = await response.json();

      console.log("Fetched user timesheet entries:", data);

      if (data.success) {
        interface TimesheetEntryApiResponse {
          id: number;
          date: string;
          matterTitle: string;
          clientName: string;
          activityType: string;
          totalHours: number;
          billableHours: number;
          description?: string;
          notes?: string;
        }

        const formattedEntries = data.data.map(
          (entry: TimesheetEntryApiResponse) => ({
            id: entry.id,
            date: entry.date,
            matterTitle: entry.matterTitle,
            clientName: entry.clientName,
            activityType: entry.activityType,
            totalHours: entry.totalHours,
            billableHours: entry.billableHours,
            remarks: entry.description || "N/A",
            notes: entry.notes || "N/A",
          })
        );
        setUserTimesheetEntries(formattedEntries);
      }
    } catch (err) {
      console.error("Fetch user timesheet entries error:", err);
    }
  }, [timesheetDetails]);

  useEffect(() => {
    fetchTimesheetDetails();
  }, [fetchTimesheetDetails]);

  useEffect(() => {
    if (timesheetDetails && activeTab === "entries") {
      fetchUserTimesheetEntries();
    }
  }, [timesheetDetails, activeTab, fetchUserTimesheetEntries]);

  // ============================================================================
  // EVENT HANDLERS - EXPENSE MANAGEMENT
  // ============================================================================

  const handleAcceptExpense = async (expenseId: number) => {
    if (!timesheetDetails) return;

    setIsUpdatingExpense((prev) => ({ ...prev, [expenseId]: true }));
    try {
      const response = await fetch(
        API_ENDPOINTS.timesheets.update(timesheetDetails.id),
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            expenseInclusionUpdates: [{ expenseId, included: true }],
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to accept expense");
      }

      setExpenseStates((prev) => ({ ...prev, [expenseId]: true }));
      fetchTimesheetDetails(); // Refresh data
    } catch (err) {
      console.error("Error accepting expense:", err);
      // alert(err instanceof Error ? err.message : "Failed to accept expense");
      toast.error(err instanceof Error ? err.message : "Failed to accept expense");
    } finally {
      setIsUpdatingExpense((prev) => ({ ...prev, [expenseId]: false }));
    }
  };

  const handleRejectExpense = async (expenseId: number) => {
    if (!timesheetDetails) return;

    setIsUpdatingExpense((prev) => ({ ...prev, [expenseId]: true }));
    try {
      const response = await fetch(
        API_ENDPOINTS.timesheets.update(timesheetDetails.id),
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            expenseInclusionUpdates: [{ expenseId, included: false }],
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to reject expense");
      }

      setExpenseStates((prev) => ({ ...prev, [expenseId]: false }));
      fetchTimesheetDetails(); // Refresh data
    } catch (err) {
      console.error("Error rejecting expense:", err);
      // alert(err instanceof Error ? err.message : "Failed to reject expense");
      toast.error(err instanceof Error ? err.message : "Failed to reject expense");
    } finally {
      setIsUpdatingExpense((prev) => ({ ...prev, [expenseId]: false }));
    }
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const formatCurrency = (amount: number, currency: CurrencyCode = 'INR') => {
    return formatAmountWithCurrency(amount, currency);
  };

  // ✅ Get timesheet amount only (no expenses - different currencies)
  const getTimesheetAmount = (): number => {
    if (!timesheetDetails) return 0;
    return timesheetDetails.calculatedAmount || 0;
  };

  // ✅ Get expense amount only (always in INR)
  const getExpenseAmount = (): number => {
    if (!timesheetDetails || !timesheetDetails.expenses || timesheetDetails.expenses.length === 0) {
      return 0;
    }
    return timesheetDetails.expenses.reduce((sum, expense) => {
      return expenseStates[expense.id] ? sum + expense.amount : sum;
    }, 0);
  };

  // ✅ Get timesheet currency (from calculatedAmountCurrency or matterCurrency, fallback to INR)
  const getTimesheetCurrency = (): CurrencyCode => {
    if (!timesheetDetails) return 'INR';
    return (timesheetDetails.calculatedAmountCurrency || timesheetDetails.matterCurrency || 'INR') as CurrencyCode;
  };

  // ✅ Check if currencies are different
  const hasMixedCurrencies = (): boolean => {
    const timesheetCurrency = getTimesheetCurrency();
    const expenseAmount = getExpenseAmount();
    return timesheetCurrency !== 'INR' && expenseAmount > 0;
  };

  // ✅ DEPRECATED: Do not use this - it incorrectly mixes currencies
  // Keep for backward compatibility only
  const calculateTotalAmount = (): number => {
    // ⚠️ WARNING: This function incorrectly mixes currencies (USD + INR)
    // Display should show timesheet and expense amounts separately
    const timesheetAmount = getTimesheetAmount();
    const expenseAmount = getExpenseAmount();
    const timesheetCurrency = getTimesheetCurrency();
    
    // If same currency, can add (but expenses are always INR)
    if (timesheetCurrency === 'INR') {
      return timesheetAmount + expenseAmount;
    }
    
    // Different currencies - cannot add directly
    // Return timesheet amount only (expenses shown separately)
    return timesheetAmount;
  };

  const getTotalExpenseAmount = (): number => {
    if (
      !timesheetDetails ||
      !timesheetDetails.expenses ||
      timesheetDetails.expenses.length === 0
    )
      return 0;
    return timesheetDetails.expenses.reduce((sum, expense) => {
      return expenseStates[expense.id] ? sum + expense.amount : sum;
    }, 0);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-lg font-medium text-gray-500">
            Loading timesheet details...
          </p>
        </div>
      </div>
    );
  }

  if (error || !timesheetDetails) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-lg font-medium text-red-500">
            Error loading timesheet
          </p>
          <p className="text-sm text-gray-600">
            {error || "Timesheet not found"}
          </p>
          <Button
            onClick={fetchTimesheetDetails}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* BREADCRUMBS */}
      <div className="flex items-center gap-2 mb-4 text-sm">
        <button
          onClick={() => router.push("/timesheet")}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
        >
          <Clock size={16} />
          <span>Timesheets</span>
        </button>
        <span className="text-gray-400">›</span>
        <span className="text-blue-600">{timesheetDetails.userName}</span>
        <span className="text-gray-400">›</span>
        <span className="text-gray-900">Timesheet Details</span>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="bg-white rounded-[22px] shadow-sm border border-gray-200 overflow-hidden">
        {/* PAGE HEADER WITH TIMESHEET INFO */}
        <div className="px-6 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-medium text-gray-900">
              Timesheet Details
            </h1>
          </div>

          {/* TIMESHEET INFO CARD */}
          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            {/* Core Details - Horizontal Layout */}
            <div className="grid grid-cols-5 gap-4 mb-4">
              <div>
                <Label className="text-xs font-medium text-gray-500">
                  Date
                </Label>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {timesheetDetails.date}
                </p>
              </div>

              <div>
                <Label className="text-xs font-medium text-gray-500">
                  User
                </Label>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {user?.name}
                </p>
                <p className="text-xs text-gray-600">
                  {user?.email}
                </p>
              </div>

              <div>
                <Label className="text-xs font-medium text-gray-500">
                  Matter Title
                </Label>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {timesheetDetails.matterTitle}
                </p>
              </div>

              <div>
                <Label className="text-xs font-medium text-gray-500">
                  Client Name
                </Label>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {timesheetDetails.clientName}
                </p>
              </div>

              <div>
                <Label className="text-xs font-medium text-gray-500">
                  Activity Type
                </Label>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {timesheetDetails.activityType}
                </p>
              </div>
            </div>

            {/* Hours and Financial Info - Horizontal Layout */}
            <div className="grid grid-cols-5 gap-4 mb-4 pt-4 border-t border-gray-200">
              <div>
                <Label className="text-xs font-medium text-gray-500">
                  Total Hours
                </Label>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {(timesheetDetails.totalHours ?? 0)} hrs
                </p>
              </div>

              <div>
                <Label className="text-xs font-medium text-gray-500">
                  Billable Hours
                </Label>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {(timesheetDetails.billableHours ?? 0)} hrs
                </p>
              </div>

              <div>
                <Label className="text-xs font-medium text-gray-500">
                  Non-Billable Hours
                </Label>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {(timesheetDetails.nonBillableHours ?? 0)} hrs
                </p>
              </div>

              <div>
                <Label className="text-xs font-medium text-gray-500">
                  Hourly Rate
                </Label>
                <p className="mt-1 text-sm font-medium text-gray-900 flex items-center gap-2">
                  {timesheetDetails.hourlyRate
                    ? formatAmountWithCurrency(timesheetDetails.hourlyRate, getTimesheetCurrency())
                    : "N/A"}
                  {timesheetDetails.hourlyRate && getTimesheetCurrency() !== 'INR' && (
                    <CurrencyBadge currency={getTimesheetCurrency()} />
                  )}
                </p>
              </div>

              <div>
                <Label className="text-xs font-medium text-gray-500">
                  Time-based Amount
                </Label>
                <p className="mt-1 text-sm font-semibold text-gray-900 flex items-center gap-2">
                  {timesheetDetails.calculatedAmount
                    ? formatAmountWithCurrency(timesheetDetails.calculatedAmount, getTimesheetCurrency())
                    : formatCurrency(0, getTimesheetCurrency())}
                  {timesheetDetails.calculatedAmount && getTimesheetCurrency() !== 'INR' && (
                    <CurrencyBadge currency={getTimesheetCurrency()} />
                  )}
                </p>
              </div>
            </div>

            {/* Description/Remarks - Scrollable */}
            {timesheetDetails.description && (
              <div className="mb-3 pt-4 border-t border-gray-200">
                <Label className="text-xs font-medium text-gray-500">
                  Description
                </Label>
                <div className="mt-1 text-sm text-gray-900 whitespace-pre-wrap max-h-20 overflow-y-auto bg-white rounded px-3 py-2 border border-gray-200">
                  {timesheetDetails.description}
                </div>
              </div>
            )}

            {/* Notes - Scrollable */}
            {timesheetDetails.notes && (
              <div className={timesheetDetails.description ? "" : "pt-4 border-t border-gray-200"}>
                <Label className="text-xs font-medium text-gray-500">
                  Internal Notes
                </Label>
                <div className="mt-1 text-sm text-gray-900 whitespace-pre-wrap max-h-20 overflow-y-auto bg-white rounded px-3 py-2 border border-gray-200">
                  {timesheetDetails.notes}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TABS */}
        <div className="flex items-center px-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("expenses")}
            className={`px-4 py-3 text-base font-semibold transition-colors ${
              activeTab === "expenses"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Expenses ({timesheetDetails.expenses.length})
          </button>
          <button
            onClick={() => setActiveTab("entries")}
            className={`px-4 py-3 text-base font-semibold transition-colors ${
              activeTab === "entries"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            User Timesheet Entries
          </button>
        </div>

        {/* EXPENSES TAB */}
        {activeTab === "expenses" && (
          <div className="px-6 py-6">
            {timesheetDetails.expenses &&
            timesheetDetails.expenses.length > 0 ? (
              <>
                <div className="space-y-4 mb-6">
                  {timesheetDetails.expenses.map((expense, index) => (
                    <div
                      key={expense.id}
                      className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200"
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-700">
                          Expense #{index + 1}
                        </span>
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            expenseStates[expense.id]
                              ? "bg-green-100 text-green-600"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {expenseStates[expense.id]
                            ? "Included in Total"
                            : "Excluded from Total"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs font-medium text-gray-500">
                            Category
                          </Label>
                          <p className="mt-1 text-sm text-gray-900 capitalize">
                            {expense.category.replace(/_/g, " ")}
                          </p>
                        </div>
                        {expense.subCategory && (
                          <div>
                            <Label className="text-xs font-medium text-gray-500">
                              Sub Category
                            </Label>
                            <p className="mt-1 text-sm text-gray-900">
                              {expense.subCategory}
                            </p>
                          </div>
                        )}
                      </div>

                      <div>
                        <Label className="text-xs font-medium text-gray-500">
                          Description
                        </Label>
                        <p className="mt-1 text-sm text-gray-900">
                          {expense.description}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {expense.vendor && (
                          <div>
                            <Label className="text-xs font-medium text-gray-500">
                              Vendor
                            </Label>
                            <p className="mt-1 text-sm text-gray-900">
                              {expense.vendor.name}
                            </p>
                          </div>
                        )}
                        <div>
                          <Label className="text-xs font-medium text-gray-500">
                            Amount
                          </Label>
                          <p className="mt-1 text-base font-semibold text-gray-900 flex items-center gap-2">
                            {formatAmountWithCurrency(expense.amount, 'INR')}
                            <CurrencyBadge currency="INR" />
                          </p>
                        </div>
                      </div>

                      {expense.receiptUrl && (
                        <div>
                          <Label className="text-xs font-medium text-gray-500">
                            Receipt
                          </Label>
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
                          <Label className="text-xs font-medium text-gray-500">
                            Expense Notes
                          </Label>
                          <p className="mt-1 text-sm text-gray-600">
                            {expense.notes}
                          </p>
                        </div>
                      )}

                    </div>
                  ))}
                </div>

                {/* Total Amount Summary */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium text-gray-900">
                        Billable Amount Breakdown
                      </Label>
                    </div>
                    <div className="text-sm text-gray-600 space-y-2">
                      {/* Time-based charges */}
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-2">
                          Time-based charges (
                          {(timesheetDetails.billableHours ?? 0)} hrs
                          ×{" "}
                          {timesheetDetails.hourlyRate
                            ? formatAmountWithCurrency(timesheetDetails.hourlyRate, getTimesheetCurrency())
                            : formatCurrency(0, getTimesheetCurrency())}
                          ):
                          {getTimesheetCurrency() !== 'INR' && (
                            <CurrencyBadge currency={getTimesheetCurrency()} />
                          )}
                        </span>
                        <span className="font-medium text-gray-900">
                          {timesheetDetails.calculatedAmount
                            ? formatAmountWithCurrency(timesheetDetails.calculatedAmount, getTimesheetCurrency())
                            : formatCurrency(0, getTimesheetCurrency())}
                        </span>
                      </div>
                      
                      {/* Expenses */}
                      {timesheetDetails.expenses &&
                        timesheetDetails.expenses.length > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="flex items-center gap-2">
                              Total expense charges (
                              {
                                timesheetDetails.expenses.filter(
                                  (e) => expenseStates[e.id]
                                ).length
                              }{" "}
                              of {timesheetDetails.expenses.length} included):
                              <CurrencyBadge currency="INR" />
                            </span>
                            <span
                              className={`font-medium ${
                                getExpenseAmount() > 0
                                  ? "text-green-600"
                                  : "text-gray-600"
                              }`}
                            >
                              {formatAmountWithCurrency(getExpenseAmount(), 'INR')}
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

              </>
            ) : (
              <div className="py-12 text-center text-gray-500">
                <p className="text-lg font-medium">No expenses found</p>
                <p className="text-sm">
                  This timesheet entry has no associated expenses
                </p>
              </div>
            )}

          </div>
        )}

        {/* USER TIMESHEET ENTRIES TAB */}
        {activeTab === "entries" && (
          <div className="overflow-x-auto">
            <table className="w-full">
              {/* TABLE HEADER */}
              <thead className="bg-white border-t border-b border-gray-200">
                <tr>
                  <th
                    className="px-6 py-3 text-center text-base font-medium text-gray-500"
                    scope="col"
                  >
                    Date
                  </th>
                  <th
                    className="px-6 py-3 text-left text-base font-medium text-gray-500"
                    scope="col"
                  >
                    Matter Title
                  </th>
                  <th
                    className="px-6 py-3 text-left text-base font-medium text-gray-500"
                    scope="col"
                  >
                    Client Name
                  </th>
                  <th
                    className="px-6 py-3 text-left text-base font-medium text-gray-500"
                    scope="col"
                  >
                    Activity Type
                  </th>
                  <th
                    className="px-6 py-3 text-center text-base font-medium text-gray-500"
                    scope="col"
                  >
                    Total Hours
                  </th>
                  <th
                    className="px-6 py-3 text-left text-base font-medium text-gray-500"
                    scope="col"
                  >
                    Remarks
                  </th>
                  <th
                    className="px-6 py-3 text-center text-base font-medium text-gray-500"
                    scope="col"
                  >
                    Actions
                  </th>
                </tr>
              </thead>

              {/* TABLE BODY */}
              <tbody className="bg-white divide-y divide-gray-200">
                {userTimesheetEntries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-lg font-medium">
                          No timesheet entries found
                        </p>
                        <p className="text-sm">
                          This user has no other timesheet entries
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  userTimesheetEntries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-base text-gray-900">
                          {entry.date}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-base text-gray-900">
                          {entry.matterTitle}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-base text-gray-900">
                          {entry.clientName}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-base text-gray-900">
                          {entry.activityType}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-base text-gray-900">
                          {entry.totalHours}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-base text-gray-900">
                          {entry.remarks}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() =>
                            router.push(`/timesheet/timesheets/${entry.id}`)
                          }
                          className="text-base text-blue-600 hover:text-blue-800 hover:underline font-medium"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
