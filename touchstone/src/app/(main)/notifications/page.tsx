'use client';

import React, { useEffect, useState } from 'react';
import { useNotifications, Notification } from '@/contexts/NotificationContext';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck, Trash2, Filter } from 'lucide-react';

// ============================================================================
// NOTIFICATIONS PAGE
// Full page view for all notifications with filtering
// ============================================================================

export default function NotificationsPage() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    fetchNotifications,
  } = useNotifications();

  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  useEffect(() => {
    // Fetch notifications on mount
    fetchNotifications();
  }, [fetchNotifications]);

  /**
   * Filter notifications based on selected filter
   */
  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return !notification.is_read;
    if (filter === 'read') return notification.is_read;
    return true;
  });

  /**
   * Handle notification click - navigate to entity
   */
  const handleNotificationClick = async (notification: Notification) => {
    try {
      if (!notification.is_read) {
        await markAsRead(notification.notification_id);
      }

      const { entity_type, entity_id } = notification.activity;
      
      switch (entity_type) {
        case 'matter':
          router.push(`/matter/${entity_id}`);
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
      }
    } catch (error) {
      console.error('Error handling notification click:', error);
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
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg">
                <Bell size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
                <p className="text-sm text-gray-500">
                  {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
                </p>
              </div>
            </div>

            {/* Actions */}
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
              >
                <CheckCheck size={18} />
                <span className="font-medium">Mark all as read</span>
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mt-4">
            <Filter size={18} className="text-gray-500" />
            <div className="flex gap-2">
              {(['all', 'unread', 'read'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`
                    px-4 py-2 rounded-lg text-sm font-medium transition-all
                    ${filter === f 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                    }
                  `}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  {f === 'unread' && unreadCount > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                      {unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {loading && filteredNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <Check size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-lg font-medium text-gray-900">No {filter !== 'all' && filter} notifications</p>
              <p className="text-sm text-gray-500 mt-1">
                {filter === 'unread' ? "You're all caught up!" : 'No notifications to display'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.notification_id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`
                    p-6 cursor-pointer transition-all hover:bg-gray-50 relative group
                    ${!notification.is_read ? 'bg-blue-50/30' : ''}
                  `}
                >
                  {/* Unread indicator */}
                  {!notification.is_read && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-blue-600 rounded-full ring-4 ring-blue-100"></div>
                  )}

                  <div className="flex items-start gap-4 pl-4">
                    {/* Actor Avatar */}
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-base flex-shrink-0 ring-4 ring-white shadow-md">
                      {notification.activity.actor.name
                        ? notification.activity.actor.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                        : notification.activity.actor.email[0].toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Message */}
                      <p className={`text-base ${!notification.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                        {notification.message}
                      </p>

                      {/* Metadata */}
                      <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                        <span>{formatTimeAgo(notification.created_at)}</span>
                        <span>•</span>
                        <span className="capitalize">{notification.activity.entity_type}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!notification.is_read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.notification_id);
                          }}
                          className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                          title="Mark as read"
                        >
                          <Check size={18} className="text-green-600" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.notification_id);
                        }}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={18} className="text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

