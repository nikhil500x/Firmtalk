'use client';

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { API_ENDPOINTS } from '@/lib/api';
import { toast } from 'react-toastify';

interface Invitation {
  invitation_id: number;
  email: string;
  roleName: string;
  inviterName: string;
  status: string;
  expires_at: string;
  created_at: string;
}

interface PendingInvitationsProps {
  invitations: Invitation[];
  onRefresh: () => void;
}

export default function PendingInvitations({ invitations, onRefresh }: PendingInvitationsProps) {
  const [loadingAction, setLoadingAction] = useState<{ id: number; action: string } | null>(null);

  const onlyPendingInvitations = invitations.filter(inv => inv.status !== 'accepted'); // Filter out accepted invitations, show only pending and expired ones

  const handleResend = async (invitationId: number) => {
    if (!confirm('Are you sure you want to resend this invitation?')) {
      return;
    }

    setLoadingAction({ id: invitationId, action: 'resend' });

    try {
      const response = await fetch(API_ENDPOINTS.invitations.resend(invitationId), {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        // alert('Invitation resent successfully!');
        toast.success('Invitation resent successfully!');
        onRefresh();
      } else {
        // alert(data.message || 'Failed to resend invitation');
        toast.error(data.message || 'Failed to resend invitation');
      }
    } catch (error) {
      console.error('Resend invitation error:', error);
      // alert('Failed to resend invitation. Please try again.');
      toast.error('Failed to resend invitation. Please try again.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCancel = async (invitationId: number) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) {
      return;
    }

    setLoadingAction({ id: invitationId, action: 'cancel' });

    try {
      const response = await fetch(API_ENDPOINTS.invitations.cancel(invitationId), {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        // alert('Invitation cancelled successfully!');
        toast.success('Invitation cancelled successfully!');
        onRefresh();
      } else {
        // alert(data.message || 'Failed to cancel invitation');
        toast.error(data.message || 'Failed to cancel invitation');
      }
    } catch (error) {
      console.error('Cancel invitation error:', error);
      // alert('Failed to cancel invitation. Please try again.');
      toast.error('Failed to cancel invitation. Please try again.');
    } finally {
      setLoadingAction(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    const isExpired = new Date(expiresAt) < new Date();
    
    if (status === 'accepted') {
      return (
        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
          Accepted
        </span>
      );
    }
    
    if (isExpired || status === 'expired') {
      return (
        <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
          Expired
        </span>
      );
    }
    
    return (
      <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
        Pending
      </span>
    );
  };

  if (onlyPendingInvitations.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <div className="text-gray-400 text-5xl mb-4">📧</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Invitations</h3>
        <p className="text-gray-500">
          All invitations have been accepted or expired. Send a new invitation to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Invited By
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Sent Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Expires
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {onlyPendingInvitations.map((invitation) => {
              const isExpired = new Date(invitation.expires_at) < new Date();
              const isPending = invitation.status === 'pending' && !isExpired;

              return (
                <tr key={invitation.invitation_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{invitation.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">{invitation.roleName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">{invitation.inviterName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">{formatDate(invitation.created_at)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">{formatDate(invitation.expires_at)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(invitation.status, invitation.expires_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex gap-2 justify-end">
                      {isPending && (
                        <>
                          <Button
                            onClick={() => handleResend(invitation.invitation_id)}
                            disabled={loadingAction !== null}
                            variant="outline"
                            className="text-xs px-3 py-1 h-auto border-blue-500 text-blue-600 hover:bg-blue-50"
                          >
                            {loadingAction?.id === invitation.invitation_id && loadingAction.action === 'resend'
                              ? 'Resending...'
                              : 'Resend'}
                          </Button>
                          <Button
                            onClick={() => handleCancel(invitation.invitation_id)}
                            disabled={loadingAction !== null}
                            variant="outline"
                            className="text-xs px-3 py-1 h-auto border-red-500 text-red-600 hover:bg-red-50"
                          >
                            {loadingAction?.id === invitation.invitation_id && loadingAction.action === 'cancel'
                              ? 'Cancelling...'
                              : 'Cancel'}
                          </Button>
                        </>
                      )}
                      {!isPending && invitation.status !== 'accepted' && (
                        <span className="text-xs text-gray-400">No actions available</span>
                      )}
                      {invitation.status === 'accepted' && (
                        <span className="text-xs text-green-600">✓ Completed</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


