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
import LeaveDialog from '@/components/leave/LeaveDialog';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Calendar, 
  Clock, 
  User, 
  FileText, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Pencil,
  Trash2
} from 'lucide-react';
import { formatRoleDisplay } from '@/utils/roleDisplay';

interface Leave {
  id: number;
  userId: number;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reviewedBy: number | null;
  reviewerComments: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  reviewer: {
    id: number;
    name: string;
  } | null;
}

interface ViewLeaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaveId?: number;
  userId?: number;
  onSuccess?: () => void;
}

export default function ViewLeaveDialog({
  open,
  onOpenChange,
  leaveId,
  userId,
  onSuccess,
}: ViewLeaveDialogProps) {
  // Get user role for authorization checks
  const { role } = useAuth();
  
  const [leave, setLeave] = useState<Leave | null>(null);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [selectedLeaveId, setSelectedLeaveId] = useState<number | undefined>(leaveId);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionComments, setRejectionComments] = useState('');
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Authorization check: only certain roles can approve/reject leaves
  const canApproveLeaves = () => {
    const authorizedRoles = ['superadmin','partner', 'admin', 'support', 'it', 'hr'];
    return role?.name ? authorizedRoles.includes(role.name) : false;
  };

  // ============================================================================
  // FETCH CURRENT USER
  // ============================================================================

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/profile`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setCurrentUserId(data.data.user.user_id);
          }
        }
      } catch (err) {
        console.error('Error fetching current user:', err);
      }
    };

    fetchCurrentUser();
  }, []);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  useEffect(() => {
    if (!open) {
      setLeave(null);
      setLeaves([]);
      setError(null);
      setShowRejectForm(false);
      setRejectionComments('');
      setIsEditDialogOpen(false);
      return;
    }

    const fetchLeaveData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // If userId is provided, fetch all leaves for that user
        if (userId) {
          const response = await fetch(API_ENDPOINTS.leaves.byUser(userId), {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error('Failed to fetch user leaves');
          }

          const data = await response.json();

          if (data.success && data.data.length > 0) {
            setLeaves(data.data);
            // Select the first leave or the specified leaveId
            const initialLeave = leaveId 
              ? data.data.find((l: Leave) => l.id === leaveId) || data.data[0]
              : data.data[0];
            setLeave(initialLeave);
            setSelectedLeaveId(initialLeave.id);
          } else {
            setError('No leaves found for this user');
          }
        } 
        // If only leaveId is provided, fetch that specific leave
        else if (leaveId || selectedLeaveId) {
          const id = leaveId || selectedLeaveId;
          const response = await fetch(API_ENDPOINTS.leaves.byId(id!), {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error('Failed to fetch leave details');
          }

          const data = await response.json();

          if (data.success) {
            setLeave(data.data);
          } else {
            setError(data.message || 'Failed to load leave details');
          }
        }
      } catch (err) {
        console.error('Fetch leave error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load leave details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaveData();
  }, [open, leaveId, userId, selectedLeaveId]);

  // ============================================================================
  // LEAVE SELECTION (when showing user's all leaves)
  // ============================================================================

  const handleLeaveSelect = (id: number) => {
    const selectedLeave = leaves.find(l => l.id === id);
    if (selectedLeave) {
      setLeave(selectedLeave);
      setSelectedLeaveId(id);
      setShowRejectForm(false);
      setRejectionComments('');
    }
  };

  // ============================================================================
  // APPROVE LEAVE
  // ============================================================================

  const handleApprove = async () => {
    if (!leave) return;

    const confirmed = confirm(`Are you sure you want to approve this leave request for ${leave.user.name}?`);
    if (!confirmed) return;

    setIsApproving(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINTS.leaves.approve(leave.id), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comments: 'Approved',
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to approve leave');
      }

      // Update local state
      if (leaves.length > 0) {
        setLeaves(leaves.map(l => l.id === leave.id ? { ...l, status: 'approved' as const } : l));
      }
      setLeave({ ...leave, status: 'approved' });

      alert('Leave approved successfully!');
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error approving leave:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve leave');
    } finally {
      setIsApproving(false);
    }
  };

  // ============================================================================
  // REJECT LEAVE
  // ============================================================================

  const handleRejectClick = () => {
    setShowRejectForm(true);
  };

  const handleRejectSubmit = async () => {
    if (!leave) return;

    if (!rejectionComments.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }

    setIsRejecting(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINTS.leaves.reject(leave.id), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comments: rejectionComments,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to reject leave');
      }

      // Update local state
      if (leaves.length > 0) {
        setLeaves(leaves.map(l => 
          l.id === leave.id 
            ? { ...l, status: 'rejected' as const, reviewerComments: rejectionComments } 
            : l
        ));
      }
      setLeave({ ...leave, status: 'rejected', reviewerComments: rejectionComments });
      setShowRejectForm(false);
      setRejectionComments('');

      alert('Leave rejected successfully!');
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error rejecting leave:', err);
      setError(err instanceof Error ? err.message : 'Failed to reject leave');
    } finally {
      setIsRejecting(false);
    }
  };

  // ============================================================================
  // EDIT LEAVE
  // ============================================================================

  const handleEditClick = () => {
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = async () => {
    setIsEditDialogOpen(false);
    // Refetch leave data
    if (leave) {
      try {
        const response = await fetch(API_ENDPOINTS.leaves.byId(leave.id), {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setLeave(data.data);
            // Update in leaves array if it exists
            if (leaves.length > 0) {
              setLeaves(leaves.map(l => l.id === data.data.id ? data.data : l));
            }
          }
        }
      } catch (err) {
        console.error('Error refetching leave:', err);
      }
    }
    if (onSuccess) onSuccess();
  };

  // ============================================================================
  // DELETE LEAVE
  // ============================================================================

  const handleDeleteClick = async () => {
    if (!leave) return;

    const confirmed = confirm(`Are you sure you want to delete this leave request?\n\nThis action cannot be undone.`);
    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINTS.leaves.delete(leave.id), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete leave');
      }

      alert('Leave request deleted successfully!');
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error deleting leave:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete leave');
    } finally {
      setIsDeleting(false);
    }
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const getLeaveTypeLabel = (type: string): string => {
    const labels: { [key: string]: string } = {
      regular: 'Privilege Leave',
      maternity: 'Maternity Leave',
      paternity: 'Paternity Leave',
      sick: 'Sick Leave',
      casual: 'Casual Leave',
      earned: 'Earned Leave',
      unpaid: 'Unpaid Leave',
    };
    return labels[type] || type.charAt(0).toUpperCase() + type.slice(1) + ' Leave';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
            <CheckCircle size={16} />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
            <XCircle size={16} />
            Rejected
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700">
            <Clock size={16} />
            Pending
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
            <AlertCircle size={16} />
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  // ============================================================================
  // CHECK IF CURRENT USER CAN EDIT/DELETE
  // ============================================================================

  const canEditDelete = currentUserId && leave && leave.userId === currentUserId && leave.status === 'pending';

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      {/* EDIT LEAVE DIALOG */}
      {leave && (
        <LeaveDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          mode="edit"
          leaveId={leave.id}
          initialData={{
            leaveType: leave.leaveType,
            startDate: leave.startDate,
            endDate: leave.endDate,
            totalDays: leave.totalDays,
            reason: leave.reason,
          }}
          onSuccess={handleEditSuccess}
        />
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Leave Request Details</DialogTitle>
          <DialogDescription>
            {userId ? 'View and manage leave requests' : 'View leave request details'}
          </DialogDescription>
        </DialogHeader>

        {/* LOADING STATE */}
        {isLoading && (
          <div className="py-12 text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="text-gray-500">Loading leave details...</p>
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {!isLoading && error && !leave && (
          <div className="py-12 text-center">
            <div className="flex flex-col items-center gap-2">
              <AlertCircle size={48} className="text-red-500" />
              <p className="text-red-600">{error}</p>
            </div>
          </div>
        )}

        {/* LEAVE DETAILS */}
        {!isLoading && leave && (
          <div className="space-y-6">
            {/* ERROR MESSAGE */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* LEAVE SELECTOR (if showing user's all leaves) */}
            {leaves.length > 1 && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Select Leave Request
                </Label>
                <select
                  value={selectedLeaveId}
                  onChange={(e) => handleLeaveSelect(parseInt(e.target.value))}
                  className="w-full px-3 py-2 text-sm text-gray-800 bg-white border border-gray-300 rounded-md cursor-pointer focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                >
                  {leaves.map((l) => (
                    <option key={l.id} value={l.id}>
                      {getLeaveTypeLabel(l.leaveType)} - {formatDate(l.startDate)} ({l.status})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* STATUS BADGE */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {getLeaveTypeLabel(leave.leaveType)}
              </h3>
              {getStatusBadge(leave.status)}
            </div>

            {/* Lawyer INFO */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <User size={20} className="text-blue-600" />
                <span className="text-sm font-medium text-gray-600">Lawyer Information</span>
              </div>
              <div className="ml-8">
                <p className="text-base font-semibold text-gray-900">{leave.user.name}</p>
                <p className="text-sm text-gray-600">{leave.user.email}</p>
                <p className="text-sm text-gray-600">{formatRoleDisplay(leave.user.role)}</p>
              </div>
            </div>

            {/* LEAVE DURATION */}
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <Calendar size={20} className="text-green-600" />
                <span className="text-sm font-medium text-gray-600">Leave Duration</span>
              </div>
              <div className="ml-8 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Start Date:</span>
                  <span className="text-sm font-medium text-gray-900">{formatDate(leave.startDate)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">End Date:</span>
                  <span className="text-sm font-medium text-gray-900">{formatDate(leave.endDate)}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-green-200">
                  <span className="text-sm font-semibold text-gray-700">Working Days:</span>
                  <span className="text-lg font-bold text-green-700">{leave.totalDays} {leave.totalDays === 1 ? 'day' : 'days'}</span>
                </div>
                <p className="text-xs text-green-600 pt-1">
                  (Excluding weekends and holidays)
                </p>
              </div>
            </div>

            {/* REASON */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <FileText size={20} className="text-gray-600" />
                <span className="text-sm font-medium text-gray-600">Reason for Leave</span>
              </div>
              <p className="ml-8 text-sm text-gray-900 whitespace-pre-wrap">{leave.reason}</p>
            </div>

            {/* REVIEWER COMMENTS (if any) */}
            {leave.reviewerComments && (
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                <div className="flex items-center gap-3 mb-3">
                  <FileText size={20} className="text-yellow-600" />
                  <span className="text-sm font-medium text-gray-600">Reviewer Comments</span>
                </div>
                <p className="ml-8 text-sm text-gray-900 whitespace-pre-wrap">{leave.reviewerComments}</p>
                {leave.reviewer && (
                  <p className="ml-8 text-xs text-gray-500 mt-2">- {leave.reviewer.name}</p>
                )}
              </div>
            )}

            {/* REJECTION FORM */}
            {showRejectForm && leave.status === 'pending' && (
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <Label htmlFor="rejection-comments" className="text-sm font-medium text-gray-700 mb-2 block">
                  Rejection Reason <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="rejection-comments"
                  value={rejectionComments}
                  onChange={(e) => setRejectionComments(e.target.value)}
                  placeholder="Please provide a reason for rejecting this leave request..."
                  rows={4}
                  className="mb-3"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleRejectSubmit}
                    disabled={isRejecting || !rejectionComments.trim()}
                    variant="destructive"
                    className="flex-1"
                  >
                    {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowRejectForm(false);
                      setRejectionComments('');
                      setError(null);
                    }}
                    disabled={isRejecting}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FOOTER */}
        {!isLoading && leave && (
          <DialogFooter>
            <div className="flex items-center justify-between w-full">
              {/* LEFT SIDE: Edit/Delete buttons for own leaves */}
              <div className="flex gap-2">
                {canEditDelete && (
                  <>
                    <Button
                      onClick={handleEditClick}
                      disabled={isDeleting}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Pencil size={16} />
                      Edit
                    </Button>
                    <Button
                      onClick={handleDeleteClick}
                      disabled={isDeleting}
                      variant="outline"
                      className="flex items-center gap-2 text-red-600 border-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </Button>
                  </>
                )}
              </div>

              {/* RIGHT SIDE: Approve/Reject/Close buttons */}
              <div className="flex gap-2">
                {/* Only show approve/reject buttons to authorized roles */}
                {leave.status === 'pending' && !showRejectForm && !canEditDelete && canApproveLeaves() && (
                  <>
                    <Button
                      onClick={handleApprove}
                      disabled={isApproving}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isApproving ? 'Approving...' : 'Approve Leave'}
                    </Button>
                    <Button
                      onClick={handleRejectClick}
                      disabled={isApproving}
                      variant="destructive"
                    >
                      Reject Leave
                    </Button>
                  </>
                )}
                <Button
                  onClick={() => onOpenChange(false)}
                  variant="outline"
                  disabled={isApproving || isRejecting || isDeleting}
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

