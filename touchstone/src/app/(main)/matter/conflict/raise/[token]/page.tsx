'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { API_ENDPOINTS } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'react-toastify';

interface MatterData {
  matterId: number;
  partnerId: number;
  matterTitle: string;
  clientName: string;
  practiceArea: string;
  opposingParty?: string;
  assignedLawyer: string;
  description?: string;
  createdAt: string;
}

interface FormData {
  conflictType: string;
  severity: string;
  conflictDescription: string;
  conflictDetails: string;
}

interface FormErrors {
  conflictType?: string;
  severity?: string;
  conflictDescription?: string;
}

export default function RaiseConflictPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [matterData, setMatterData] = useState<MatterData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    conflictType: '',
    severity: '',
    conflictDescription: '',
    conflictDetails: '',
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    const checkAuthAndVerifyToken = async () => {
      try {
        // 1. Check if user is authenticated
        const authResponse = await fetch(API_ENDPOINTS.auth.session, {
          credentials: 'include',
        });

        if (!authResponse.ok) {
          // Not authenticated - redirect to login with return URL
          const returnUrl = `/matter/conflict/raise/${token}`;
          window.location.href = `/login?returnUrl=${encodeURIComponent(returnUrl)}`;
          return;
        }

        const authData = await authResponse.json();
        setIsAuthenticated(true);

        // 2. Verify token
        const tokenResponse = await fetch(API_ENDPOINTS.conflicts.verify(token), {
          credentials: 'include',
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json();
          setError(errorData.message || 'Invalid or expired token');
          setIsVerifying(false);
          return;
        }

        const tokenResult = await tokenResponse.json();

        // 3. Verify logged-in user matches token partner
        if (authData.data.user.id !== tokenResult.data.partnerId) {
          setError(
            'This conflict raise link was intended for a different user. Please contact the system administrator if you believe this is an error.'
          );
          setIsVerifying(false);
          return;
        }

        // 4. Check if user is actually a partner
        if (authData.data.role?.name !== 'partner') {
          setError('Only partners can raise conflicts on matters.');
          setIsVerifying(false);
          return;
        }

        setMatterData(tokenResult.data);
        setIsVerifying(false);
      } catch (err) {
        console.error('Verification error:', err);
        setError('Failed to verify token. Please try again.');
        setIsVerifying(false);
      }
    };

    checkAuthAndVerifyToken();
  }, [token, router]);

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!formData.conflictType) {
      errors.conflictType = 'Conflict type is required';
    }

    if (!formData.severity) {
      errors.severity = 'Severity is required';
    }

    if (!formData.conflictDescription.trim()) {
      errors.conflictDescription = 'Conflict description is required';
    } else if (formData.conflictDescription.trim().length < 20) {
      errors.conflictDescription = 'Description must be at least 20 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(API_ENDPOINTS.conflicts.raise, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          conflict_type: formData.conflictType,
          severity: formData.severity,
          conflict_description: formData.conflictDescription,
          conflict_details: formData.conflictDetails.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSubmitSuccess(true);
        // Redirect to matter page after 2 seconds
        setTimeout(() => {
          router.push(`/matter/matter-master/${matterData?.matterId}`);
        }, 2000);
      } else {
        // alert(data.message || 'Failed to raise conflict');
        toast.error(data.message || 'Failed to raise conflict');
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error('Submit error:', err);
      // alert('Failed to raise conflict. Please try again.');
      toast.error('Failed to raise conflict. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 mb-2">⚠️ Access Denied</h2>
          <p className="text-red-700">{error}</p>
          <Button
            onClick={() => router.push('/matter')}
            className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white"
          >
            Return to Matters
          </Button>
        </div>
      </div>
    );
  }

  if (submitSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-green-50 border border-green-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-green-800 mb-2">✓ Conflict Raised Successfully</h2>
          <p className="text-green-700">
            Your conflict has been recorded and relevant parties have been notified.
          </p>
          <p className="text-green-600 text-sm mt-2">Redirecting to matter page...</p>
        </div>
      </div>
    );
  }

  if (!matterData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Header */}
          <div className="bg-red-600 text-white px-6 py-4 rounded-t-lg">
            <h1 className="text-2xl font-bold">⚠️ Raise Conflict of Interest</h1>
            <p className="text-red-100 text-sm mt-1">
              Please provide details about the potential conflict
            </p>
          </div>

          {/* Matter Details */}
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Matter Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-gray-500">Matter Title:</span>
                <p className="font-medium text-gray-900">{matterData.matterTitle}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Client:</span>
                <p className="font-medium text-gray-900">{matterData.clientName}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Practice Area:</span>
                <p className="font-medium text-gray-900">{matterData.practiceArea}</p>
              </div>
              {matterData.opposingParty && (
                <div>
                  <span className="text-xs text-gray-500">Opposing Party:</span>
                  <p className="font-medium text-gray-900">{matterData.opposingParty}</p>
                </div>
              )}
              <div>
                <span className="text-xs text-gray-500">Assigned Lawyer:</span>
                <p className="font-medium text-gray-900">{matterData.assignedLawyer}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Created:</span>
                <p className="font-medium text-gray-900">
                  {new Date(matterData.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Conflict Form */}
          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
            {/* Conflict Type */}
            <Field>
              <FieldLabel className="text-base font-medium text-gray-900">
                Type of Conflict <span className="text-red-500">*</span>
              </FieldLabel>
              <Select
                value={formData.conflictType}
                onValueChange={(value) => setFormData({ ...formData, conflictType: value })}
                disabled={isSubmitting}
              >
                <SelectTrigger className="bg-white border-gray-300">
                  <SelectValue placeholder="Select conflict type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client Conflict</SelectItem>
                  <SelectItem value="opposing_party">Opposing Party Conflict</SelectItem>
                  <SelectItem value="personal">Personal Interest</SelectItem>
                  <SelectItem value="prior_representation">Prior Representation</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {formErrors.conflictType && <FieldError>{formErrors.conflictType}</FieldError>}
            </Field>

            {/* Severity */}
            <Field>
              <FieldLabel className="text-base font-medium text-gray-900">
                Severity Level <span className="text-red-500">*</span>
              </FieldLabel>
              <Select
                value={formData.severity}
                onValueChange={(value) => setFormData({ ...formData, severity: value })}
                disabled={isSubmitting}
              >
                <SelectTrigger className="bg-white border-gray-300">
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - Minor concern</SelectItem>
                  <SelectItem value="medium">Medium - Moderate concern</SelectItem>
                  <SelectItem value="high">High - Significant concern</SelectItem>
                  <SelectItem value="critical">Critical - Must not proceed</SelectItem>
                </SelectContent>
              </Select>
              {formErrors.severity && <FieldError>{formErrors.severity}</FieldError>}
            </Field>

            {/* Conflict Description */}
            <Field>
              <FieldLabel className="text-base font-medium text-gray-900">
                Conflict Description <span className="text-red-500">*</span>
              </FieldLabel>
              <textarea
                value={formData.conflictDescription}
                onChange={(e) =>
                  setFormData({ ...formData, conflictDescription: e.target.value })
                }
                disabled={isSubmitting}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                placeholder="Describe the nature of the conflict..."
              />
              <p className="text-xs text-gray-500 mt-1">Minimum 20 characters</p>
              {formErrors.conflictDescription && (
                <FieldError>{formErrors.conflictDescription}</FieldError>
              )}
            </Field>

            {/* Additional Details */}
            <Field>
              <FieldLabel className="text-base font-medium text-gray-900">
                Additional Details (Optional)
              </FieldLabel>
              <textarea
                value={formData.conflictDetails}
                onChange={(e) => setFormData({ ...formData, conflictDetails: e.target.value })}
                disabled={isSubmitting}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                placeholder="Any additional context or supporting information..."
              />
            </Field>

            {/* Warning Box */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>⚠️ Important:</strong> By submitting this form, you are formally flagging this
                matter for potential conflict of interest. All partners and relevant stakeholders will
                be notified.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/matters')}
                disabled={isSubmitting}
                className="flex-1 border-gray-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {isSubmitting ? 'Submitting...' : 'Raise Conflict'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

