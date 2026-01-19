'use client';

import React, { useState } from 'react';
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
import { API_ENDPOINTS } from '@/lib/api';
import { toast } from 'react-toastify';
import { convertCurrency, formatAmountWithCurrency, type CurrencyCode } from '@/lib/currencyUtils';

interface SetMatterRateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  matterId: number;
  userId: number;
  userName: string;
  matterTitle: string;
  serviceType: string;
  rateRange: {
    min: number;
    max: number;
  };
  matterCurrency?: CurrencyCode;
}

export default function SetMatterRateDialog({
  open,
  onOpenChange,
  onSuccess,
  matterId,
  userId,
  userName,
  matterTitle,
  serviceType,
  rateRange,
  matterCurrency = 'INR',
}: SetMatterRateDialogProps) {
  const [hourlyRate, setHourlyRate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [convertedRate, setConvertedRate] = useState<number | null>(null);

  // Calculate converted rate when hourly rate changes
  const handleRateChange = async (value: string) => {
    setHourlyRate(value);
    const rate = parseFloat(value);
    
    if (!isNaN(rate) && matterCurrency !== 'INR') {
      const converted = await convertCurrency(rate, 'INR', matterCurrency);
      setConvertedRate(converted);
    } else {
      setConvertedRate(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const rate = parseFloat(hourlyRate);

    // Validation
    if (!hourlyRate || isNaN(rate)) {
      setError('Please enter a valid hourly rate');
      return;
    }

    if (rate < rateRange.min || rate > rateRange.max) {
      setError(`Rate must be between ${formatAmountWithCurrency(rateRange.min, 'INR')} and ${formatAmountWithCurrency(rateRange.max, 'INR')}`);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        API_ENDPOINTS.matters.team.updateRate(matterId, userId),
        {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            service_type: serviceType,
            hourly_rate: rate,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to update matter rate');
      }

      // Recalculate all timesheets for this user on this matter
      try {
        const recalculateResponse = await fetch(
          API_ENDPOINTS.timesheets.recalculateForUserMatter(userId, matterId),
          {
            method: 'PUT',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        const recalculateData = await recalculateResponse.json();
        
        if (recalculateResponse.ok && recalculateData.success) {
          toast.success(`Matter rate updated and ${recalculateData.data?.updatedCount || 0} timesheet(s) recalculated`);
        } else {
          toast.success('Matter rate updated successfully');
          toast.warning('Some timesheets may need manual recalculation');
        }
      } catch (recalcError) {
        console.error('Error recalculating timesheets:', recalcError);
        toast.success('Matter rate updated successfully');
        toast.warning('Some timesheets may need manual recalculation');
      }

      setHourlyRate('');
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error('Error updating matter rate:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update matter rate';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setHourlyRate('');
    setError(null);
    setConvertedRate(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set Matter Billing Rate</DialogTitle>
          <DialogDescription>
            Set the hourly rate for this user on this specific matter
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Matter Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
            <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
              <span className="text-gray-600 font-medium">Matter:</span>
              <span className="text-gray-900">{matterTitle}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
              <span className="text-gray-600 font-medium">User:</span>
              <span className="text-gray-900">{userName}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
              <span className="text-gray-600 font-medium">Service Type:</span>
              <span className="text-gray-900">{serviceType}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
              <span className="text-gray-600 font-medium">Rate Range:</span>
              <span className="text-gray-900 font-semibold">
                {formatAmountWithCurrency(rateRange.min, 'INR')} - {formatAmountWithCurrency(rateRange.max, 'INR')}
              </span>
            </div>
          </div>

          {/* Hourly Rate Input */}
          <div className="grid gap-2">
            <Label htmlFor="hourly_rate">
              Matter Hourly Rate (INR) <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                ₹
              </span>
              <Input
                id="hourly_rate"
                type="number"
                step="0.01"
                min={rateRange.min}
                max={rateRange.max}
                value={hourlyRate}
                onChange={(e) => handleRateChange(e.target.value)}
                placeholder={`Enter rate between ${rateRange.min} and ${rateRange.max}`}
                className="pl-8"
                required
                autoFocus
              />
            </div>
            {convertedRate && matterCurrency !== 'INR' && (
              <p className="text-xs text-blue-600 font-medium">
                💡 Will be stored as: {formatAmountWithCurrency(convertedRate, matterCurrency)}
              </p>
            )}
            <p className="text-xs text-gray-500">
              Enter a rate within the allowed range for this user&apos;s rate card
            </p>
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? 'Updating...' : 'Confirm Rate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
