import prisma from '../prisma-client';
import { NotificationService } from './notification.service';

/**
 * ActivityService - Centralized service for logging user activities
 * All important actions in the system should be logged through this service
 */

// Enum of all possible action types
export enum ActivityActionType {
  // Matter actions
  MATTER_CREATED = 'MATTER_CREATED',
  MATTER_DELETED = 'MATTER_DELETED',
  MATTER_STATUS_CHANGED = 'MATTER_STATUS_CHANGED',
  TEAM_MEMBER_ADDED = 'TEAM_MEMBER_ADDED',
  TEAM_MEMBER_REMOVED = 'TEAM_MEMBER_REMOVED',
  TEAM_MEMBER_ROLE_CHANGED = 'TEAM_MEMBER_ROLE_CHANGED',
  
  // Conflict actions
  CONFLICT_RAISED = 'CONFLICT_RAISED',
  CONFLICT_RESOLVED = 'CONFLICT_RESOLVED',
  CONFLICT_DISMISSED = 'CONFLICT_DISMISSED',
  
  // Task actions
  TASK_CREATED = 'TASK_CREATED',
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_STATUS_CHANGED = 'TASK_STATUS_CHANGED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  
  // Timesheet actions
  TIMESHEET_SUBMITTED = 'TIMESHEET_SUBMITTED',
  TIMESHEET_APPROVED = 'TIMESHEET_APPROVED',
  TIMESHEET_REJECTED = 'TIMESHEET_REJECTED',
  
  // Leave actions
  LEAVE_REQUESTED = 'LEAVE_REQUESTED',
  LEAVE_APPROVED = 'LEAVE_APPROVED',
  LEAVE_REJECTED = 'LEAVE_REJECTED',
  LEAVE_CANCELLED = 'LEAVE_CANCELLED',
  
  // User/Invitation actions
  USER_INVITED = 'USER_INVITED',
  USER_ONBOARDED = 'USER_ONBOARDED',
  
  // Client actions
  CLIENT_CREATED = 'CLIENT_CREATED',
  
  // Invoice actions
  INVOICE_GENERATED = 'INVOICE_GENERATED',
  INVOICE_SENT = 'INVOICE_SENT',
  INVOICE_PAID = 'INVOICE_PAID',
  
  // Support ticket actions
  TICKET_ASSIGNED = 'TICKET_ASSIGNED',
  TICKET_RESOLVED = 'TICKET_RESOLVED',
}

// Entity types in the system
export enum ActivityEntityType {
  MATTER = 'matter',
  TASK = 'task',
  TIMESHEET = 'timesheet',
  LEAVE = 'leave',
  USER = 'user',
  CLIENT = 'client',
  INVOICE = 'invoice',
  TICKET = 'ticket',
}

// Interface for activity metadata
export interface ActivityMetadata {
  [key: string]: any;
}

// Interface for creating an activity
export interface CreateActivityParams {
  actionType: ActivityActionType;
  actorId: number;
  entityType: ActivityEntityType;
  entityId: number;
  metadata?: ActivityMetadata;
  notifyUserIds?: number[]; // Optional: specific users to notify
}

export class ActivityService {
  /**
   * Create a new activity and optionally notify users
   * @param params - Activity creation parameters
   * @returns Created activity with notification count
   */
  static async createActivity(params: CreateActivityParams) {
    try {
      const { actionType, actorId, entityType, entityId, metadata, notifyUserIds } = params;

      // Create the activity record
      const activity = await prisma.user_activities.create({
        data: {
          action_type: actionType,
          actor_id: actorId,
          entity_type: entityType,
          entity_id: entityId,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
        include: {
          actor: {
            select: {
              user_id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Create notifications for specified users
      let notificationCount = 0;
      if (notifyUserIds && notifyUserIds.length > 0) {
        notificationCount = await NotificationService.notifyUsers(
          activity.activity_id,
          notifyUserIds
        );
      }

      console.log(`✅ Activity created: ${actionType} by ${activity.actor.name} (${notificationCount} notifications)`);

      return {
        success: true,
        activity,
        notificationCount,
      };
    } catch (error) {
      console.error('❌ Error creating activity:', error);
      throw error;
    }
  }

  /**
   * Get recent activities (for activity feed/audit log)
   * @param limit - Number of activities to fetch
   * @param offset - Pagination offset
   */
  static async getRecentActivities(limit: number = 50, offset: number = 0) {
    try {
      const activities = await prisma.user_activities.findMany({
        take: limit,
        skip: offset,
        orderBy: { created_at: 'desc' },
        include: {
          actor: {
            select: {
              user_id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Parse metadata for each activity
      const parsedActivities = activities.map(activity => ({
        ...activity,
        metadata: activity.metadata ? JSON.parse(activity.metadata) : null,
      }));

      return {
        success: true,
        activities: parsedActivities,
      };
    } catch (error) {
      console.error('❌ Error fetching activities:', error);
      throw error;
    }
  }

  /**
   * Get activities for a specific entity
   * @param entityType - Type of entity
   * @param entityId - ID of entity
   */
  static async getEntityActivities(entityType: ActivityEntityType, entityId: number) {
    try {
      const activities = await prisma.user_activities.findMany({
        where: {
          entity_type: entityType,
          entity_id: entityId,
        },
        orderBy: { created_at: 'desc' },
        include: {
          actor: {
            select: {
              user_id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Parse metadata
      const parsedActivities = activities.map(activity => ({
        ...activity,
        metadata: activity.metadata ? JSON.parse(activity.metadata) : null,
      }));

      return {
        success: true,
        activities: parsedActivities,
      };
    } catch (error) {
      console.error('❌ Error fetching entity activities:', error);
      throw error;
    }
  }

  /**
   * Get activities performed by a specific user
   * @param userId - User ID
   * @param limit - Number of activities
   */
  static async getUserActivities(userId: number, limit: number = 50) {
    try {
      const activities = await prisma.user_activities.findMany({
        where: { actor_id: userId },
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          actor: {
            select: {
              user_id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Parse metadata
      const parsedActivities = activities.map(activity => ({
        ...activity,
        metadata: activity.metadata ? JSON.parse(activity.metadata) : null,
      }));

      return {
        success: true,
        activities: parsedActivities,
      };
    } catch (error) {
      console.error('❌ Error fetching user activities:', error);
      throw error;
    }
  }

  /**
   * Helper: Determine which users should be notified for a matter action
   * @param matterId - Matter ID
   * @param excludeUserId - Optional: user to exclude (e.g., the actor)
   */
  static async getMatterNotificationRecipients(
    matterId: number,
    excludeUserId?: number
  ): Promise<number[]> {
    try {
      const matter = await prisma.matters.findUnique({
        where: { matter_id: matterId },
        include: {
          matter_users: {
            select: { user_id: true },
          },
        },
      });

      if (!matter) return [];

      // Get all team member IDs
      const userIds = matter.matter_users.map(mu => mu.user_id);

      // Add assigned lawyer if exists
      if (matter.assigned_lawyer && !userIds.includes(matter.assigned_lawyer)) {
        userIds.push(matter.assigned_lawyer);
      }

      // Exclude the actor if specified
      if (excludeUserId) {
        return userIds.filter(id => id !== excludeUserId);
      }

      return userIds;
    } catch (error) {
      console.error('❌ Error getting matter recipients:', error);
      return [];
    }
  }

  /**
   * Helper: Get notification recipients for task actions
   * @param taskId - Task ID
   */
  static async getTaskNotificationRecipients(taskId: number): Promise<number[]> {
    try {
      const task = await prisma.tasks.findUnique({
        where: { task_id: taskId },
        select: {
          assigned_to: true,
          assigned_by: true,
        },
      });

      if (!task) return [];

      const userIds: number[] = [];
      
      if (task.assigned_to) userIds.push(task.assigned_to);
      if (task.assigned_by && !userIds.includes(task.assigned_by)) {
        userIds.push(task.assigned_by);
      }

      return userIds;
    } catch (error) {
      console.error('❌ Error getting task recipients:', error);
      return [];
    }
  }
}

export default ActivityService;

