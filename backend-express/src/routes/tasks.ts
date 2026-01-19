import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import prisma from '../prisma-client';
import { ActivityService, ActivityActionType, ActivityEntityType } from '../services/activity.service';
import { InteractionService } from '../services/interaction.service';

const router = Router();

/**
 * POST /api/tasks
 * Create a new task
 * Requires authentication
 */
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      client_id,
      matter_id,
      task_name,
      description,
      assigned_by,
      assigned_to,
      priority,
      due_date,
      status,
      comments,
    } = req.body;

    // Convert IDs to numbers (handle null/undefined)
    const clientId = client_id ? Number(client_id) : null;
    const matterId = matter_id ? Number(matter_id) : null;
    const assignedBy = assigned_by === null || assigned_by === undefined ? null : Number(assigned_by);

    // Validate assigned_to is an array
    if (!Array.isArray(assigned_to) || assigned_to.length === 0) {
      res.status(400).json({
        success: false,
        message: 'assigned_to must be a non-empty array of user IDs',
      });
      return;
    }

    // Validate ONLY required fields (removed client_id and matter_id)
    if (!task_name || !due_date) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: task_name, due_date',
      });
      return;
    }

    // Check if matter is closed (if matter_id is provided)
    if (matterId) {
      const matter = await prisma.matters.findUnique({
        where: { matter_id: matterId },
        select: { matter_id: true, status: true },
      });

      if (matter && matter.status === 'closed') {
        res.status(400).json({
          success: false,
          message: 'Cannot create task for closed matter',
        });
        return;
      }
    }

    const dueDate = new Date(due_date);
    if (Number.isNaN(dueDate.getTime())) {
      res.status(400).json({ success: false, message: 'Invalid due_date format' });
      return;
    }

    const priorityNorm = (priority ?? 'medium').toLowerCase();
    const statusNorm = (status ?? 'todo').toLowerCase();
    const allowedPriority = new Set(['low', 'medium', 'high']);
    const allowedStatus = new Set(['todo', 'in_progress', 'completed', 'overdue']);
    
    if (!allowedPriority.has(priorityNorm)) {
      res.status(400).json({ success: false, message: `Invalid priority: ${priority}` });
      return;
    }
    if (!allowedStatus.has(statusNorm)) {
      res.status(400).json({ success: false, message: `Invalid status: ${status}` });
      return;
    }

    // Verify FKs exist ONLY if they are provided
    if (clientId) {
      const clientExists = await prisma.clients.findUnique({ 
        where: { client_id: clientId }, 
        select: { client_id: true } 
      });
      if (!clientExists) {
        res.status(400).json({ success: false, message: `client_id ${clientId} does not exist` });
        return;
      }
    }

    if (matterId) {
      const matterExists = await prisma.matters.findUnique({ 
        where: { matter_id: matterId }, 
        select: { matter_id: true } 
      });
      if (!matterExists) {
        res.status(400).json({ success: false, message: `matter_id ${matterId} does not exist` });
        return;
      }
    }

    if (assignedBy) {
      const assignerExists = await prisma.users.findUnique({ 
        where: { user_id: assignedBy }, 
        select: { user_id: true } 
      });
      if (!assignerExists) {
        res.status(400).json({ success: false, message: `assigned_by user ${assignedBy} does not exist` });
        return;
      }
    }

    // Verify all assigned users exist
    const assignedUserIds = assigned_to.map((id: any) => Number(id));
    const usersExist = await prisma.users.findMany({
      where: { user_id: { in: assignedUserIds } },
      select: { user_id: true }
    });
    if (usersExist.length !== assignedUserIds.length) {
      res.status(400).json({ success: false, message: 'One or more assigned users do not exist' });
      return;
    }

    // Create task with assignments (client_id and matter_id can be null now)
    const task = await prisma.tasks.create({
      data: {
        client_id: clientId,
        matter_id: matterId,
        task_name,
        description: description ?? null,
        assigned_by: assignedBy,
        priority: priorityNorm,
        due_date: dueDate,
        status: statusNorm,
        comments: comments ?? null,
        active_status: true,
        task_assignments: {
          create: assignedUserIds.map((userId: number) => ({
            user_id: userId,
            status: 'todo',
          }))
        }
      },
      include: {
        client: {
          select: { client_id: true, client_name: true },
        },
        matter: {
          select: { matter_id: true, matter_title: true, practice_area: true },
        },
        assigner: { select: { user_id: true, name: true, email: true } },
        task_assignments: {
          include: {
            user: { select: { user_id: true, name: true, email: true } },
            completer: { select: { user_id: true, name: true, email: true } }
          }
        }
      },
    });

    // Log activity for each assigned user
    try {
      await ActivityService.createActivity({
        actionType: ActivityActionType.TASK_ASSIGNED,
        actorId: req.session.userId!,
        entityType: ActivityEntityType.TASK,
        entityId: task.task_id,
        metadata: {
          taskName: task_name,
          matterTitle: task.matter?.matter_title || 'No matter assigned',
          priority: priorityNorm,
          dueDate: dueDate.toISOString(),
        },
        notifyUserIds: assignedUserIds,
      });
    } catch (activityError) {
      console.error('Failed to log task activity:', activityError);
    }

    // Auto-link task to contacts (only if both client_id and matter_id exist)
    if (req.session.userId && clientId && matterId) {
      InteractionService.linkTask(req.session.userId, {
        task_id: task.task_id,
        task_name: task_name,
        client_id: clientId,
        matter_id: matterId,
        due_date: dueDate,
        description: description ?? null,
      }).catch(error => {
        console.error('Failed to auto-link task to contacts:', error);
      });
    }

    res.status(201).json({ success: true, message: 'Task created successfully', data: task });
  } catch (error: any) {
    const code = error?.code;
    console.error('Error creating task:', { code, message: error?.message, meta: error?.meta });
    if (code === 'P2003') {
      res.status(400).json({ success: false, message: 'Foreign key constraint failed.' });
      return;
    }
    res.status(500).json({ success: false, message: 'Failed to create task', error: error?.message });
  }
});

/**
 * GET /api/tasks
 * Get all tasks with optional filters
 * Non-admin users only see tasks assigned to them or created by them
 */
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      status,
      priority,
      client_id,
      matter_id,
      assigned_to,
      active_status
    } = req.query;
    
    const sessionUserId = req.session.userId;
    const userRole = req.session.role?.name;

    const canSeeAllTasks = ['superadmin','partner', 'admin', 'sr-associate'].includes(userRole || '');
    
    // Build where clause for task_assignments
    const assignmentWhere: any = {};
    
    if (!canSeeAllTasks) {
      // Non-admin users only see tasks assigned to them
      assignmentWhere.user_id = sessionUserId;
    } else if (assigned_to) {
      assignmentWhere.user_id = parseInt(assigned_to as string);
    }

    if (status) {
      assignmentWhere.status = status as string;
    }

    // Build where clause for tasks
    const taskWhere: any = {};
    if (priority) taskWhere.priority = priority as string;
    if (client_id) taskWhere.client_id = parseInt(client_id as string);
    if (matter_id) taskWhere.matter_id = parseInt(matter_id as string);
    if (active_status !== undefined) {
      taskWhere.active_status = active_status === 'true';
    }

    // FOR PARTNERS/ADMINS: Always fetch all tasks with their assignments
    if (canSeeAllTasks && !assigned_to && !status) {
      const tasks = await prisma.tasks.findMany({
        where: taskWhere,
        include: {
          client: { select: { client_id: true, client_name: true } },
          matter: { select: { matter_id: true, matter_title: true, practice_area: true } },
          assigner: { select: { user_id: true, name: true, email: true } },
          task_assignments: {
            include: {
              user: { select: { user_id: true, name: true, email: true } },
              completer: { select: { user_id: true, name: true, email: true } }
            }
          }
        },
        orderBy: { due_date: 'asc' }
      });

      // For each task, set the status based on the most common status among assignments
      const tasksWithStatus = tasks.map(task => {
        // Get the first assignment's status (they should all be the same now)
        const primaryStatus = task.task_assignments[0]?.status || task.status;
        return {
          ...task,
          status: primaryStatus,
          user_status: primaryStatus
        };
      });

      res.status(200).json({
        success: true,
        count: tasksWithStatus.length,
        data: tasksWithStatus
      });
      return;
    }

    // For filtered queries or non-admin users
    if (!canSeeAllTasks || assigned_to || status) {
      const assignments = await prisma.task_assignments.findMany({
        where: assignmentWhere,
        include: {
          task: {
            include: {
              client: { select: { client_id: true, client_name: true } },
              matter: { select: { matter_id: true, matter_title: true, practice_area: true } },
              assigner: { select: { user_id: true, name: true, email: true } },
              task_assignments: {
                include: {
                  user: { select: { user_id: true, name: true, email: true } },
                  completer: { select: { user_id: true, name: true, email: true } }
                }
              }
            }
          }
        }
      });

      // Filter out assignments where task doesn't match taskWhere criteria
      const filteredAssignments = assignments.filter(assignment => {
        const task = assignment.task;
        
        // Apply taskWhere filters manually
        if (priority && task.priority !== priority) return false;
        if (client_id && task.client_id !== parseInt(client_id as string)) return false;
        if (matter_id && task.matter_id !== parseInt(matter_id as string)) return false;
        if (active_status !== undefined && task.active_status !== (active_status === 'true')) return false;
        
        return true;
      });

      // Transform to include user's specific status
      const tasks = filteredAssignments.map(assignment => {
        const task = assignment.task;

        // ensure completed assignment is preserved
        const taskAssignments = task.task_assignments.map(a => {
          if (a.user_id === assignment.user_id && assignment.status === 'completed') {
            return {
              ...a,
              status: 'completed',
              completed_at: assignment.completed_at,
              completed_by: assignment.completed_by,
              completer: a.completer ?? null
            };
          }
          return a;
        });

        return {
          ...task,
          task_assignments: taskAssignments,
          user_status: assignment.status,
          user_completed_at: assignment.completed_at,
        };
      });


      // Sort by due date
      tasks.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

      res.status(200).json({
        success: true,
        count: tasks.length,
        data: tasks
      });
    }
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks',
      error: error.message
    });
  }
});

/**
 * GET /api/tasks/user/:userId
 * Get tasks assigned to a specific user
 * Requires authentication
 */
router.get('/user/:userId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { status, priority, active_status } = req.query;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
      return;
    }

    const assignmentWhere: any = {
      user_id: parseInt(userId)
    };

    if (status) assignmentWhere.status = status as string;

    const taskWhere: any = {};
    if (priority) taskWhere.priority = priority as string;
    if (active_status !== undefined) {
      taskWhere.active_status = active_status === 'true';
    }

    const assignments = await prisma.task_assignments.findMany({
      where: assignmentWhere,
      include: {
        task: {
          include: {
            client: {
              select: {
                client_id: true,
                client_name: true
              }
            },
            matter: {
              select: {
                matter_id: true,
                matter_title: true,
                practice_area: true
              }
            },
            assigner: {
              select: {
                user_id: true,
                name: true,
                email: true
              }
            },
            task_assignments: {
              include: {
                user: { select: { user_id: true, name: true, email: true } },
                completer: { select: { user_id: true, name: true, email: true } }  // ADD THIS LINE
              }
            }
          }
        }
      }
    });

    // Filter and transform
    const filteredAssignments = assignments.filter(assignment => {
      const task = assignment.task;
      if (priority && task.priority !== priority) return false;
      if (active_status !== undefined && task.active_status !== (active_status === 'true')) return false;
      return true;
    });

    const tasks = filteredAssignments.map(assignment => ({
      ...assignment.task,
      user_status: assignment.status,
      user_completed_at: assignment.completed_at,
    }));

    tasks.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks
    });
  } catch (error: any) {
    console.error('Error fetching user tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user tasks',
      error: error.message
    });
  }
});

/**
 * GET /api/tasks/created-by/:userId
 * Get tasks created by a specific user (assigned_by)
 * Requires authentication
 */
router.get('/created-by/:userId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { status, priority } = req.query;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
      return;
    }

    const where: any = {
      assigned_by: parseInt(userId)
    };

    if (priority) where.priority = priority as string;

    const tasks = await prisma.tasks.findMany({
      where,
      include: {
        client: {
          select: {
            client_id: true,
            client_name: true
          }
        },
        matter: {
          select: {
            matter_id: true,
            matter_title: true
          }
        },
        task_assignments: {
          include: {
            user: {
              select: {
                user_id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // If status filter is provided, filter by assignment status
    let filteredTasks = tasks;
    if (status) {
      filteredTasks = tasks.filter(task => 
        task.task_assignments.some(a => a.status === status)
      );
    }

    res.status(200).json({
      success: true,
      count: filteredTasks.length,
      data: filteredTasks
    });
  } catch (error: any) {
    console.error('Error fetching created tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch created tasks',
      error: error.message
    });
  }
});

/**
 * GET /api/tasks/:taskId
 * Get a specific task by ID
 * Requires authentication
 */
router.get('/:taskId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params;
    const sessionUserId = req.session.userId;

    if (!taskId) {
      res.status(400).json({
        success: false,
        message: 'Task ID is required'
      });
      return;
    }

    const task = await prisma.tasks.findUnique({
      where: {
        task_id: parseInt(taskId)
      },
      include: {
        client: true,
        matter: true,
        assigner: {
          select: {
            user_id: true,
            name: true,
            email: true,
            role: true
          }
        },
        task_assignments: {
          include: {
            user: {
              select: {
                user_id: true,
                name: true,
                email: true,
                role: true
              }
            }
          }
        }
      }
    });

    if (!task) {
      res.status(404).json({
        success: false,
        message: 'Task not found'
      });
      return;
    }

    // Find user's specific assignment if exists
    const userAssignment = task.task_assignments.find(a => a.user_id === sessionUserId);

    res.status(200).json({
      success: true,
      data: {
        ...task,
        user_status: userAssignment?.status || null,
        user_completed_at: userAssignment?.completed_at || null,
      }
    });
  } catch (error: any) {
    console.error('Error fetching task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch task',
      error: error.message
    });
  }
});

/**
 * PUT /api/tasks/:taskId
 * Update a task
 * Requires authentication
 */
router.put('/:taskId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params;
    const {
      task_name,
      description,
      assigned_to,  // Now expects an array
      priority,
      due_date,
      status,  // This updates the user's individual status
      comments,
      active_status
    } = req.body;

    const sessionUserId = req.session.userId;

    if (!taskId) {
      res.status(400).json({
        success: false,
        message: 'Task ID is required'
      });
      return;
    }

    const existingTask = await prisma.tasks.findUnique({
      where: { task_id: parseInt(taskId) },
      include: { task_assignments: true }
    });

    if (!existingTask) {
      res.status(404).json({
        success: false,
        message: 'Task not found'
      });
      return;
    }

    // Build update data for the task itself
    const updateData: any = {
      updated_at: new Date()
    };

    if (task_name !== undefined) updateData.task_name = task_name;
    if (description !== undefined) updateData.description = description;
    if (priority !== undefined) updateData.priority = priority;
    if (due_date !== undefined) updateData.due_date = new Date(due_date);
    if (comments !== undefined) updateData.comments = comments;
    if (active_status !== undefined) updateData.active_status = active_status;

    // Handle assignment changes
    if (assigned_to !== undefined && Array.isArray(assigned_to)) {
      const newUserIds = assigned_to.map((id: any) => Number(id));
      const existingUserIds = existingTask.task_assignments.map(a => a.user_id);
      
      // Users to add
      const toAdd = newUserIds.filter((id: number) => !existingUserIds.includes(id));
      // Users to remove
      const toRemove = existingUserIds.filter(id => !newUserIds.includes(id));

      updateData.task_assignments = {
        deleteMany: toRemove.length > 0 ? {
          user_id: { in: toRemove }
        } : undefined,
        create: toAdd.map((userId: number) => ({
          user_id: userId,
          status: 'todo',
        }))
      };
    }

    // Handle status update for current user
    // Handle status update for current user
    if (status !== undefined) {
      // Check if ANY assignment is already completed
      const isTaskCompleted = existingTask.task_assignments.some(a => a.status === 'completed');
      
      // If task is completed by ANYONE, prevent ANY status changes (task is locked)
      if (isTaskCompleted) {
        res.status(400).json({
          success: false,
          message: 'Cannot change status of a completed task. This task has been marked as completed and is now locked.'
        });
        return;
      }

      // Task is NOT completed, so allow status changes
      
      // If status is being changed TO completed, mark as completed for ALL assigned users
      if (status === 'completed') {
        await prisma.task_assignments.updateMany({
          where: {
            task_id: parseInt(taskId),
          },
          data: {
            status: 'completed',
            completed_at: new Date(),
            completed_by: sessionUserId,
            updated_at: new Date()
          }
        });
      } 
      // For any other status change (todo, in_progress, overdue), update ALL assignments
      else {
        await prisma.task_assignments.updateMany({
          where: {
            task_id: parseInt(taskId),
          },
          data: {
            status,
            updated_at: new Date()
          }
        });
      }
    }

    const updatedTask = await prisma.tasks.update({
      where: {
        task_id: parseInt(taskId)
      },
      data: updateData,
      include: {
        client: true,
        matter: true,
        assigner: {
          select: {
            user_id: true,
            name: true,
            email: true
          }
        },
        task_assignments: {
          include: {
            user: {
              select: {
                user_id: true,
                name: true,
                email: true
              }
            },
            completer: {
              select: {
                user_id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    // Log activity for status change
    if (status !== undefined) {
      try {
        const userAssignment = existingTask.task_assignments.find(a => a.user_id === sessionUserId);
        const notifyUsers: number[] = [];
        if (updatedTask.assigned_by && updatedTask.assigned_by !== sessionUserId) {
          notifyUsers.push(updatedTask.assigned_by);
        }

        const actionType = status === 'completed' 
          ? ActivityActionType.TASK_COMPLETED 
          : ActivityActionType.TASK_STATUS_CHANGED;

        await ActivityService.createActivity({
          actionType,
          actorId: sessionUserId!,
          entityType: ActivityEntityType.TASK,
          entityId: updatedTask.task_id,
          metadata: {
            taskName: updatedTask.task_name,
            matterTitle: updatedTask.matter?.matter_title || 'No matter assigned',  // CHANGE: Use optional chaining
            oldStatus: userAssignment?.status || 'unknown',
            newStatus: status,
          },
          notifyUserIds: notifyUsers,
        });
      } catch (activityError) {
        console.error('Failed to log task status activity:', activityError);
      }
    }

    // Log activity if assignees changed
    if (assigned_to !== undefined && Array.isArray(assigned_to)) {
      try {
        const newUserIds = assigned_to.map((id: any) => Number(id));
        const existingUserIds = existingTask.task_assignments.map(a => a.user_id);
        const addedUsers = newUserIds.filter((id: number) => !existingUserIds.includes(id));

        if (addedUsers.length > 0) {
          await ActivityService.createActivity({
            actionType: ActivityActionType.TASK_ASSIGNED,
            actorId: sessionUserId!,
            entityType: ActivityEntityType.TASK,
            entityId: updatedTask.task_id,
            metadata: {
              taskName: updatedTask.task_name,
              matterTitle: updatedTask.matter?.matter_title || 'No matter assigned',  // CHANGE: Use optional chaining
              priority: updatedTask.priority,
            },
            notifyUserIds: addedUsers,
          });
        }
      } catch (activityError) {
        console.error('Failed to log task assignment activity:', activityError);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: updatedTask
    });
  } catch (error: any) {
    console.error('Error updating task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update task',
      error: error.message
    });
  }
});

/**
 * DELETE /api/tasks/:taskId
 * Delete a task (soft delete by setting active_status to false)
 * Requires authentication
 */
router.delete('/:taskId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params;
    const { hardDelete } = req.query;

    if (!taskId) {
      res.status(400).json({
        success: false,
        message: 'Task ID is required'
      });
      return;
    }

    // Check if task exists
    const existingTask = await prisma.tasks.findUnique({
      where: { task_id: parseInt(taskId) }
    });

    if (!existingTask) {
      res.status(404).json({
        success: false,
        message: 'Task not found'
      });
      return;
    }

    if (hardDelete === 'true') {
      // Hard delete - permanently remove from database
      await prisma.tasks.delete({
        where: {
          task_id: parseInt(taskId)
        }
      });

      res.status(200).json({
        success: true,
        message: 'Task permanently deleted'
      });
      return;
    } else {
      // Soft delete - set active_status to false
      const deletedTask = await prisma.tasks.update({
        where: {
          task_id: parseInt(taskId)
        },
        data: {
          active_status: false,
          updated_at: new Date()
        }
      });

      res.status(200).json({
        success: true,
        message: 'Task deactivated successfully',
        data: deletedTask
      });
    }
  } catch (error: any) {
    console.error('Error deleting task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete task',
      error: error.message
    });
  }
});

export default router;