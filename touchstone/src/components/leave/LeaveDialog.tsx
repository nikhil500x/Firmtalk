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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { API_ENDPOINTS } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle, Info } from 'lucide-react';

interface LeaveData {
  leaveType?: string;
  startDate?: string;
  endDate?: string;
  totalDays?: number;
  reason?: string;
}

interface LeaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  mode: 'create' | 'edit';
  leaveId?: number;
  initialData?: LeaveData;
}

interface LeaveType {
  value: string;
  label: string;
  totalDays: number;
  autoCalculate: boolean;
}

interface LeaveBalance {
  leaveType: string;
  year: number;
  totalAllocated: number;
  balance: number;
  pending: number;
  applied: number;
}

const initialFormData = {
  leave_type: '',
  start_date: new Date().toISOString().split('T')[0],
  end_date: new Date().toISOString().split('T')[0],
  total_days: '',
  reason: '',
};

export default function LeaveDialog({
  open,
  onOpenChange,
  onSuccess,
  mode,
  leaveId,
  initialData,
}: LeaveDialogProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState(initialFormData);
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableLeaveTypes, setAvailableLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [selectedLeaveConfig, setSelectedLeaveConfig] = useState<LeaveType | null>(null);
  const [calculatedEndDate, setCalculatedEndDate] = useState<string>('');
  const [workingDaysInfo, setWorkingDaysInfo] = useState<string>('');

  // ============================================================================
  // FETCH AVAILABLE LEAVE TYPES AND BALANCES
  // ============================================================================

  useEffect(() => {
    if (open && user?.id) {
      fetchAvailableLeaveTypes();
      fetchLeaveBalances();
    }
  }, [open, user?.id]);

  const fetchAvailableLeaveTypes = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.leaves.availableTypes, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAvailableLeaveTypes(data.data);
        }
      }
    } catch (err) {
      console.error('Error fetching available leave types:', err);
    }
  };

  const fetchLeaveBalances = async () => {
    if (!user?.id) return;

    try {
      const year = new Date().getFullYear();
      const response = await fetch(API_ENDPOINTS.leaves.balance(user.id, year), {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLeaveBalances(data.data);
        }
      }
    } catch (err) {
      console.error('Error fetching leave balances:', err);
    }
  };

  // ============================================================================
  // INITIALIZE FORM DATA
  // ============================================================================

  useEffect(() => {
    if (mode === 'edit' && initialData) {
      setFormData({
        leave_type: initialData.leaveType || '',
        start_date: initialData.startDate || '',
        end_date: initialData.endDate || '',
        total_days: initialData.totalDays?.toString() || '',
        reason: initialData.reason || '',
      });
    } else {
      setFormData(initialFormData);
      setCalculatedEndDate('');
      setWorkingDaysInfo('');
    }
  }, [mode, initialData, open]);

  // ============================================================================
  // FORM HANDLERS
  // ============================================================================

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Handle date changes based on leave type
    if (name === 'start_date') {
      if (selectedLeaveConfig?.autoCalculate) {
        // Auto-calculate end date for maternity/paternity
        calculateEndDateForLeave(value, selectedLeaveConfig.totalDays);
      } else if (formData.end_date) {
        // Calculate working days for regular leave
        calculateWorkingDays(value, formData.end_date);
      }
    } else if (name === 'end_date' && !selectedLeaveConfig?.autoCalculate) {
      // Calculate working days for regular leave
      if (formData.start_date) {
        calculateWorkingDays(formData.start_date, value);
      }
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));

    // When leave type changes, update config and auto-calculate if needed
    if (name === 'leave_type') {
      const config = availableLeaveTypes.find(t => t.value === value);
      setSelectedLeaveConfig(config || null);

      if (config?.autoCalculate && formData.start_date) {
        calculateEndDateForLeave(formData.start_date, config.totalDays);
      } else {
        setCalculatedEndDate('');
        setWorkingDaysInfo('');
      }
    }
  };

  /**
   * Calculate end date for auto-calculated leave types (maternity/paternity)
   */
  const calculateEndDateForLeave = async (startDate: string, workingDays: number) => {
    if (!startDate || !workingDays) return;

    setIsCalculating(true);
    try {
      const response = await fetch(API_ENDPOINTS.leaves.calculateEndDate, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate,
          workingDays,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCalculatedEndDate(data.data.endDate);
          setFormData((prev) => ({
            ...prev,
            end_date: data.data.endDate,
            total_days: workingDays.toString(),
          }));
          setWorkingDaysInfo(`${workingDays} working days (excluding weekends and holidays)`);
        }
      }
    } catch (err) {
      console.error('Error calculating end date:', err);
    } finally {
      setIsCalculating(false);
    }
  };

  /**
   * Calculate working days for regular leave
   */
  const calculateWorkingDays = async (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      setError('End date cannot be before start date');
      return;
    }

    setIsCalculating(true);
    try {
      const response = await fetch(API_ENDPOINTS.leaves.calculateWorkingDays, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate,
          endDate,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setFormData((prev) => ({
            ...prev,
            total_days: data.data.workingDays.toString(),
          }));
          setWorkingDaysInfo(
            `${data.data.workingDays} working days out of ${data.data.totalDays} total days (excluding weekends and holidays)`
          );
          setError(null);
        }
      }
    } catch (err) {
      console.error('Error calculating working days:', err);
      setError('Failed to calculate working days');
    } finally {
      setIsCalculating(false);
    }
  };

  // ============================================================================
  // FORM SUBMISSION
  // ============================================================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.leave_type || !formData.start_date || !formData.reason) {
      setError('Please fill in all required fields');
      return;
    }

    // For regular leave, end date is required
    if (!selectedLeaveConfig?.autoCalculate && !formData.end_date) {
      setError('End date is required for regular leave');
      return;
    }

    
    // Check if sufficient balance is available (skip for sick leave)
    if (formData.leave_type !== 'sick') {
      const balance = leaveBalances.find(b => b.leaveType === formData.leave_type);
      const requiredDays = parseFloat(formData.total_days || '0');
      
      if (balance && balance.balance < requiredDays) {
        setError(`Insufficient leave balance. Available: ${balance.balance} days, Required: ${requiredDays} days`);
        return;
      }
    }

    setIsLoading(true);

    try {
      const payload = {
        leaveType: formData.leave_type,
        startDate: formData.start_date,
        endDate: formData.end_date || calculatedEndDate,
        totalDays: parseFloat(formData.total_days),
        reason: formData.reason,
      };

      const url =
        mode === 'create'
          ? API_ENDPOINTS.leaves.create
          : API_ENDPOINTS.leaves.update(leaveId!);

      const method = mode === 'create' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to save leave request');
      }

      // Success
      setFormData(initialFormData);
      setCalculatedEndDate('');
      setWorkingDaysInfo('');
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error saving leave:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to save leave request'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // DIALOG HANDLERS
  // ============================================================================

  const handleClose = () => {
    if (!isLoading) {
      setFormData(initialFormData);
      setError(null);
      setCalculatedEndDate('');
      setWorkingDaysInfo('');
      setSelectedLeaveConfig(null);
      onOpenChange(false);
    }
  };

  // Get current balance for selected leave type
  const getCurrentBalance = () => {
    if (!formData.leave_type) return null;
    return leaveBalances.find(b => b.leaveType === formData.leave_type);
  };

  const currentBalance = getCurrentBalance();

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Apply for Leave' : 'Edit Leave Request'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Submit a new leave request. Fill in all the required information.'
              : 'Update your leave request details.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* ERROR MESSAGE */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* LEAVE TYPE */}
            <div className="grid gap-2">
              <Label htmlFor="leave_type">
                Leave Type <span className="text-red-500 -ml-1.5">*</span>
              </Label>
              <Select
                value={formData.leave_type}
                onValueChange={(value) =>
                  handleSelectChange('leave_type', value)
                }
                disabled={mode === 'edit'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {availableLeaveTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedLeaveConfig?.autoCalculate && (
                <p className="text-xs text-blue-600 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  End date will be automatically calculated ({selectedLeaveConfig.totalDays} working days)
                </p>
              )}
              {formData.leave_type === 'sick' && (
                <p className="text-xs text-orange-600 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Sick leave can only be applied for current day or past dates
                </p>
              )}
            </div>

            {/* LEAVE BALANCE INFO */}
            {currentBalance && formData.leave_type !== 'sick' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <table className="w-full text-center text-sm">
                  <thead>
                    <tr className="border-b border-blue-200">
                      <th className="py-2 text-blue-700 font-medium">Available</th>
                      <th className="py-2 text-blue-700 font-medium">Total</th>
                      <th className="py-2 text-blue-700 font-medium">Pending</th>
                      <th className="py-2 text-blue-700 font-medium">Approved</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-2 text-blue-900 font-semibold">{currentBalance.balance}</td>
                      <td className="py-2 text-blue-900 font-semibold">{currentBalance.totalAllocated}</td>
                      <td className="py-2 text-blue-900 font-semibold">{currentBalance.pending}</td>
                      <td className="py-2 text-blue-900 font-semibold">{currentBalance.applied}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* DATE RANGE */}
            <div className="grid grid-cols-2 gap-4">
              {/* START DATE */}
              <div className="grid gap-2">
                <Label htmlFor="start_date">
                  Start Date <span className="text-red-500 -ml-1.5">*</span>
                </Label>
                <Input
                  id="start_date"
                  name="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={handleInputChange}
                  min={formData.leave_type === 'sick' ? undefined : new Date().toISOString().split('T')[0]}
                  max={formData.leave_type === 'sick' ? new Date().toISOString().split('T')[0] : undefined}
                  required
                />
              </div>

              {/* END DATE */}
              <div className="grid gap-2">
                <Label htmlFor="end_date">
                  End Date {!selectedLeaveConfig?.autoCalculate && <span className="text-red-500 -ml-1.5">*</span>}
                </Label>
                <Input
                  id="end_date"
                  name="end_date"
                  type="date"
                  value={formData.end_date || calculatedEndDate}
                  onChange={handleInputChange}
                  min={formData.start_date}
                  max={formData.leave_type === 'sick' ? new Date().toISOString().split('T')[0] : undefined}
                  disabled={selectedLeaveConfig?.autoCalculate || isCalculating}
                  required={!selectedLeaveConfig?.autoCalculate}
                  className={selectedLeaveConfig?.autoCalculate ? 'bg-gray-100' : ''}
                />
              </div>
            </div>

            {/* WORKING DAYS INFO */}
            {workingDaysInfo && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  {workingDaysInfo}
                </p>
              </div>
            )}

            {/* CALCULATING INDICATOR */}
            {isCalculating && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>Calculating...</span>
              </div>
            )}

            {/* TOTAL DAYS (HIDDEN - AUTO CALCULATED) */}
            <input type="hidden" name="total_days" value={formData.total_days} />

            {/* REASON */}
            <div className="grid gap-2">
              <Label htmlFor="reason">
                Reason <span className="text-red-500 -ml-1.5">*</span>
              </Label>
              <Textarea
                id="reason"
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                placeholder="Please provide a reason for your leave"
                rows={4}
                required
              />
            </div>
          </div>

          {/* FOOTER */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? mode === 'create'
                  ? 'Submitting...'
                  : 'Updating...'
                : mode === 'create'
                ? 'Submit Leave Request'
                : 'Update Leave Request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

