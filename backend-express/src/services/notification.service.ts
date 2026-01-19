import prisma from '../prisma-client';
import { CacheService } from './cache.service';

/**
 * NotificationService - Manages user notifications
 * Handles creating, reading, and managing notifications
 */

export interface NotificationWithActivity {
  notification_id: number;
  user_id: number;
  activity_id: number;
  is_read: boolean;
  read_at: Date | null;
  created_at: Date;
  activity: {
    activity_id: number;
    action_type: string;
    actor_id: number;
    entity_type: string;
    entity_id: number;
    metadata: string | null;
    created_at: Date;
    actor: {
      user_id: number;
      name: string | null;
      email: string;
    };
  };
}

export class NotificationService {
  /**
   * Create notifications for multiple users for a given activity
   * @param activityId - Activity ID
   * @param userIds - Array of user IDs to notify
   * @returns Number of notifications created
   */
  static async notifyUsers(activityId: number, userIds: number[]): Promise<number> {
    try {
      if (!userIds || userIds.length === 0) {
        return 0;
      }

      // Remove duplicates
      const uniqueUserIds = [...new Set(userIds)];

      // Create notification records for each user
      const notifications = await prisma.user_notifications.createMany({
        data: uniqueUserIds.map(userId => ({
          user_id: userId,
          activity_id: activityId,
          is_read: false,
        })),
      });

      // Invalidate cache for all notified users
      for (const userId of uniqueUserIds) {
        await this.invalidateUserCache(userId);
      }

      return notifications.count;
    } catch (error) {
      console.error('❌ Error creating notifications:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count for a user (with caching)
   * @param userId - User ID
   * @returns Unread count
   */
  static async getUnreadCount(userId: number): Promise<number> {
    const cacheKey = CacheService.keys.notificationUnreadCount(userId);

    return await CacheService.get(
      cacheKey,
      async () => {
        const count = await prisma.user_notifications.count({
          where: {
            user_id: userId,
            is_read: false,
          },
        });
        return count;
      },
      300 // Cache for 5 minutes
    );
  }

  /**
   * Get recent notifications for a user (with caching)
   * @param userId - User ID
   * @param limit - Number of notifications to fetch
   * @param includeRead - Include read notifications (default: true)
   */
  static async getUserNotifications(
    userId: number,
    limit: number = 20,
    includeRead: boolean = true
  ): Promise<NotificationWithActivity[]> {
    const cacheKey = CacheService.keys.notificationRecent(userId);

    const notifications = await CacheService.get(
      cacheKey,
      async () => {
        const whereClause: any = { user_id: userId };
        
        if (!includeRead) {
          whereClause.is_read = false;
        }

        const results = await prisma.user_notifications.findMany({
          where: whereClause,
          take: limit,
          orderBy: { created_at: 'desc' },
          include: {
            activity: {
              include: {
                actor: {
                  select: {
                    user_id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        });

        return results;
      },
      120 // Cache for 2 minutes (shorter TTL for lists)
    );

    // Parse metadata for each notification
    return notifications.map(notification => ({
      ...notification,
      activity: {
        ...notification.activity,
        metadata: notification.activity.metadata || null,
      },
    }));
  }

  /**
   * Mark a notification as read
   * @param notificationId - Notification ID
   * @param userId - User ID (for verification)
   */
  static async markAsRead(notificationId: number, userId: number): Promise<boolean> {
    try {
      // Verify the notification belongs to the user
      const notification = await prisma.user_notifications.findFirst({
        where: {
          notification_id: notificationId,
          user_id: userId,
        },
      });

      if (!notification) {
        return false;
      }

      // Update to mark as read
      await prisma.user_notifications.update({
        where: { notification_id: notificationId },
        data: {
          is_read: true,
          read_at: new Date(),
        },
      });

      // Invalidate user's cache
      await this.invalidateUserCache(userId);

      return true;
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   * @param userId - User ID
   */
  static async markAllAsRead(userId: number): Promise<number> {
    try {
      const result = await prisma.user_notifications.updateMany({
        where: {
          user_id: userId,
          is_read: false,
        },
        data: {
          is_read: true,
          read_at: new Date(),
        },
      });

      // Invalidate user's cache
      await this.invalidateUserCache(userId);

      return result.count;
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Delete old read notifications (cleanup)
   * @param daysOld - Delete notifications older than this many days (default: 90)
   */
  static async cleanupOldNotifications(daysOld: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await prisma.user_notifications.deleteMany({
        where: {
          is_read: true,
          read_at: {
            lt: cutoffDate,
          },
        },
      });

      console.log(`🧹 Cleaned up ${result.count} old notifications`);
      return result.count;
    } catch (error) {
      console.error('❌ Error cleaning up notifications:', error);
      throw error;
    }
  }

  /**
   * Get notification statistics for a user
   * @param userId - User ID
   */
  static async getUserStats(userId: number) {
    try {
      const [total, unread, readToday] = await Promise.all([
        // Total notifications
        prisma.user_notifications.count({
          where: { user_id: userId },
        }),
        // Unread notifications
        prisma.user_notifications.count({
          where: { user_id: userId, is_read: false },
        }),
        // Read today
        prisma.user_notifications.count({
          where: {
            user_id: userId,
            is_read: true,
            read_at: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
      ]);

      return {
        total,
        unread,
        read: total - unread,
        readToday,
      };
    } catch (error) {
      console.error('❌ Error fetching notification stats:', error);
      throw error;
    }
  }

  /**
   * Invalidate all cache keys for a user
   * @param userId - User ID
   */
  private static async invalidateUserCache(userId: number): Promise<void> {
    try {
      // Invalidate both unread count and recent notifications cache
      await CacheService.invalidate(CacheService.keys.notificationUnreadCount(userId));
      await CacheService.invalidate(CacheService.keys.notificationRecent(userId));
    } catch (error) {
      console.error('❌ Error invalidating cache:', error);
    }
  }

  /**
   * Format notification message from activity data
   * @param notification - Notification with activity data
   * @returns Formatted message string
   */
  static formatNotificationMessage(notification: NotificationWithActivity): string {
    const { action_type, actor, entity_type, metadata } = notification.activity;
    const actorName = actor.name || actor.email;
    
    let parsedMetadata: any = {};
    if (metadata) {
      try {
        parsedMetadata = JSON.parse(metadata);
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Format message based on action type
    switch (action_type) {
      case 'TEAM_MEMBER_ADDED':
        return `${actorName} added you to matter "${parsedMetadata.matterTitle || 'a matter'}"`;
      
      case 'TEAM_MEMBER_REMOVED':
        return `${actorName} removed you from matter "${parsedMetadata.matterTitle || 'a matter'}"`;
      
      case 'TASK_ASSIGNED':
        return `${actorName} assigned you a task: "${parsedMetadata.taskName || 'New task'}"`;
      
      case 'TASK_STATUS_CHANGED':
        return `Task "${parsedMetadata.taskName || 'Task'}" status changed to ${parsedMetadata.newStatus || 'updated'}`;
      
      case 'TIMESHEET_APPROVED':
        return `${actorName} approved your timesheet for ${parsedMetadata.date || 'a date'}`;
      
      case 'TIMESHEET_REJECTED':
        return `${actorName} rejected your timesheet for ${parsedMetadata.date || 'a date'}`;
      
      case 'LEAVE_APPROVED':
        return `${actorName} approved your leave request`;
      
      case 'LEAVE_REJECTED':
        return `${actorName} rejected your leave request`;
      
      case 'LEAVE_REQUESTED':
        return `${actorName} requested leave from ${parsedMetadata.startDate || ''} to ${parsedMetadata.endDate || ''}`;
      
      case 'MATTER_CREATED':
        return `${actorName} created a new matter: "${parsedMetadata.matterTitle || 'New matter'}"`;
      
      case 'MATTER_STATUS_CHANGED':
        return `Matter "${parsedMetadata.matterTitle || 'Matter'}" status changed to ${parsedMetadata.newStatus || 'updated'}`;
      
      case 'INVOICE_GENERATED':
        return `${actorName} generated invoice ${parsedMetadata.invoiceNumber || ''}`;
      
      case 'TICKET_ASSIGNED':
        return `${actorName} assigned you support ticket "${parsedMetadata.ticketNumber || ''}"`;
      
      default:
        return `${actorName} performed an action on ${entity_type}`;
    }
  }
}

export default NotificationService;

