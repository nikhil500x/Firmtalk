'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function InviteExpiredPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
            <span className="text-5xl">⏰</span>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Invitation Expired or Invalid
          </h1>

          {/* Description */}
          <p className="text-gray-600 mb-6">
            This invitation link is either invalid, has expired, or has already been used.
            Please contact your administrator to request a new invitation.
          </p>

          {/* Information Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Common reasons:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• The invitation has expired (invitations are valid for 48 hours)</li>
              <li>• The invitation has already been accepted</li>
              <li>• The invitation link is incorrect or incomplete</li>
              <li>• The invitation was cancelled by an administrator</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={() => router.push('/login')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-3"
            >
              Go to Login Page
            </Button>

            <p className="text-sm text-gray-500">
              Need help? Contact your system administrator to resend the invitation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


