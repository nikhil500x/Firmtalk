import React from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications, Notification } from '@/contexts/NotificationContext';
import { X, Check, CheckCheck, Trash2 } from 'lucide-react';

// ============================================================================
// NOTIFICATION PANEL COMPONENT
// Shows a dropdown panel with recent notifications
// ============================================================================

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  if (!isOpen) return null;

  /**
   * Handle notification click - mark as read and navigate
   */
  const handleNotificationClick = async (notification: Notification) => {
    try {
      // Mark as read if unread
      if (!notification.is_read) {
        await markAsRead(notification.notification_id);
      }

      // Navigate to the relevant page based on entity type
      const { entity_type, entity_id } = notification.activity;

      switch (entity_type) {
        case 'matter':
          router.push(`/matter/matter-master/${entity_id}`);
          break;
        case 'task':
          router.push('/task');
          break;
        case 'leave':
          router.push('/leave');
          break;
        case 'timesheet':
          router.push('/timesheet');
          break;
        default:
          console.log('Unknown entity type:', entity_type);
      }

      onClose();
    } catch (error) {
      console.error('Error handling notification click:', error);
    }
  };

  /**
   * Handle mark all as read
   */
  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  /**
   * Handle delete notification
   */
  const handleDelete = async (e: React.MouseEvent, notificationId: number) => {
    e.stopPropagation();
    try {
      await deleteNotification(notificationId);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  /**
   * Format time ago
   */
  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute right-0 mt-2 w-96 max-h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
        
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white rounded-t-2xl">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <p className="text-xs text-gray-500">{unreadCount} unread</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors group"
                title="Mark all as read"
              >
                <CheckCheck size={18} className="text-gray-600 group-hover:text-blue-600" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close"
            >
              <X size={18} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="overflow-y-auto flex-1">
          {loading && notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Check size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-medium">No notifications</p>
              <p className="text-xs text-gray-400 mt-1">You&apos;re all caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((notification) => (
                <div
                  key={notification.notification_id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`
                    p-4 cursor-pointer transition-all duration-200 hover:bg-gray-50 relative group
                    ${!notification.is_read ? 'bg-blue-50/30' : ''}
                  `}
                >
                  {/* Unread indicator */}
                  {!notification.is_read && (
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-600 rounded-full"></div>
                  )}

                  <div className="flex items-start gap-3 pl-3">
                    {/* Actor Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ring-2 ring-white shadow-sm">
                      {notification.activity.actor.name
                        ? notification.activity.actor.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                        : notification.activity.actor.email[0].toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Message */}
                      <p className={`text-sm ${!notification.is_read ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                        {notification.message}
                      </p>

                      {/* Time */}
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTimeAgo(notification.created_at)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!notification.is_read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.notification_id);
                          }}
                          className="p-1.5 hover:bg-green-100 rounded-lg transition-colors"
                          title="Mark as read"
                        >
                          <Check size={14} className="text-green-600" />
                        </button>
                      )}
                      <button
                        onClick={(e) => handleDelete(e, notification.notification_id)}
                        className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} className="text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
            <button
              onClick={() => {
                router.push('/notifications');
                onClose();
              }}
              className="w-full text-center text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              View all notifications
            </button>
          </div>
        )}
      </div>
    </>
  );
}

