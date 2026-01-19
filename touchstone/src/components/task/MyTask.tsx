'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useMemo } from 'react';
import { API_ENDPOINTS } from '@/lib/api';
import { Search, Edit, Trash2, LayoutGrid, Table, Calendar as CalendarIcon, ChevronsUpDown, Check, X, ArrowUp,ArrowDown,ArrowUpDown } from 'lucide-react';
import MoreActionsMenu, { MenuItem } from '@/components/MoreActionsMenu';
import TaskDialog from '@/components/task/TaskDialog';
import Pagination, { usePagination } from '@/components/Pagination';
import {
  Popover,
  PopoverTrigger,
  PopoverContent
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { toast } from 'react-toastify';

interface Task {
  task_id: number;
  task_name: string;
  matter: {
    matter_id: number;
    matter_title: string;
  } | null;  // Make nullable
  client: {
    client_id: number;
    client_name: string;
  } | null;  // Make nullable
  task_assignments?: Array<{
    user_id: number;
    status: string;
    completed_by: number | null;
    completed_at: string | null;
    user: {
      user_id: number;
      name: string;
      email: string;
    };
    completer?: {
      user_id: number;
      name: string;
      email: string;
    } | null;
  }>;
  assignee?: {
    user_id: number;
    name: string;
  } | null;
  assigner: {
    name: string;
  } | null;
  due_date: string;
  status: string;
  priority: string;
  comments: string | null;
  user_status?: string;
  completed_by_name?: string;
}

interface User {
  user_id: number;
  name: string;
  email: string;
}

interface MyTaskPageProps {
  onEditTask?: (taskId: number) => void;
  onViewTask?: (taskId: number) => void;
  viewMode?: 'table' | 'board';
  onViewModeChange?: (mode: 'table' | 'board') => void;
  userId?: number; // ADD THIS LINE
}

export default function MyTaskPage({ 
  onEditTask: externalEditTask, 
  onViewTask: externalViewTask, 
  viewMode: externalViewMode, 
  onViewModeChange,
  userId: propUserId // ADD THIS LINE
}: MyTaskPageProps = {}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('All Time'); // ADD THIS LINE
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]); // CHANGE: Make it an array
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskDialogMode, setTaskDialogMode] = useState<'add' | 'edit' | 'view'>('view');
  const [selectedTaskId, setSelectedTaskId] = useState<number | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'table' | 'board'>(externalViewMode || 'table');
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false); // ADD THIS LINE
  const [sortConfig, setSortConfig] = useState<{
    key: 'task_name' | 'matter_title' | 'client_name' | 'assigned_by' | 'due_date' | null;
    direction: 'asc' | 'desc' | null;
  }>({ key: null, direction: null });


  // Inline editing state
  const [editingCell, setEditingCell] = useState<{
    taskId: number;
    field: 'task_name' | 'comments' | 'status' | 'priority' | 'due_date' | 'assignee';
  } | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [editingDropdownOpen, setEditingDropdownOpen] = useState(false);
  const [editingDate, setEditingDate] = useState<Date | undefined>(undefined);

  // Initialize pagination hook
  const {
    currentPage,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    resetToFirstPage,
    getPaginatedData,
  } = usePagination(10);

  useEffect(() => {
    if (externalViewMode) {
      setViewMode(externalViewMode);
    }
  }, [externalViewMode]);

  useEffect(() => {
    fetchCurrentUser();
    fetchAllUsers();
  }, []);

  useEffect(() => {
    if (currentUser || propUserId) {
      fetchMyTasks();
    }
  }, [currentUser, propUserId]); // ADD propUserId to dependencies

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.auth.session, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch user session');
      }
      
      const data = await response.json();
      
      if (data.success && data.data && data.data.user) {
        setCurrentUser({
          user_id: data.data.user.id,
          name: data.data.user.name,
          email: data.data.user.email,
        });
      } else {
        setError('Unable to fetch user session');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setError('Failed to load user session. Please login again.');
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.users.list, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const data = await response.json();
      
      if (data.success && data.data) {
        setAllUsers(data.data.map((u: any) => ({
          user_id: u.id,
          name: u.name,
          email: u.email,
        })));
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchMyTasks = async () => {
    // Use propUserId if provided, otherwise use currentUser
    const targetUserId = propUserId || currentUser?.user_id;
    
    if (!targetUserId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_ENDPOINTS.tasks.byUser(targetUserId)}?active_status=true`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data) {
        setTasks(data.data);
      } else {
        setError('No tasks found');
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load tasks';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Filter tasks with useMemo
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = 
        task.task_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.client?.client_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.matter?.matter_title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.assigner?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || task.status === statusFilter;
      const matchesPriority = priorityFilter.length === 0 || priorityFilter.includes(task.priority);
      
      let matchesDate = true;
      if (dateFilter !== 'All Time') {
        const taskDueDate = new Date(task.due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (dateFilter === 'Today') {
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          matchesDate = taskDueDate >= today && taskDueDate < tomorrow;
        } else if (dateFilter === 'This Week') {
          const weekEnd = new Date(today);
          weekEnd.setDate(today.getDate() + 7);
          matchesDate = taskDueDate >= today && taskDueDate <= weekEnd;
        } else if (dateFilter === 'This Month') {
          const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          matchesDate = taskDueDate >= today && taskDueDate <= monthEnd;
        }
      }
      
      return matchesSearch && matchesStatus && matchesPriority && matchesDate;
    });
  }, [tasks, searchQuery, statusFilter, priorityFilter, dateFilter]);

  const sortedTasks = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return filteredTasks;
    }

    const sorted = [...filteredTasks].sort((a, b) => {
      if (sortConfig.key === 'task_name') {
        return a.task_name.localeCompare(b.task_name);
      } else if (sortConfig.key === 'matter_title') {
        const aMatter = a.matter?.matter_title || '';
        const bMatter = b.matter?.matter_title || '';
        return aMatter.localeCompare(bMatter);
      } else if (sortConfig.key === 'client_name') {
        const aClient = a.client?.client_name || '';
        const bClient = b.client?.client_name || '';
        return aClient.localeCompare(bClient);
      } else if (sortConfig.key === 'assigned_by') {
        const aAssigner = a.assigner?.name || '';
        const bAssigner = b.assigner?.name || '';
        return aAssigner.localeCompare(bAssigner);
      } else if (sortConfig.key === 'due_date') {
        const aDate = new Date(a.due_date);
        const bDate = new Date(b.due_date);
        return aDate.getTime() - bDate.getTime();
      }
      return 0;
    });

    return sortConfig.direction === 'desc' ? sorted.reverse() : sorted;
  }, [filteredTasks, sortConfig]);

  // Paginate filtered tasks
  const paginatedTasks = useMemo(() => {
    if (viewMode === 'board') {
      return sortedTasks;
    }
    return getPaginatedData(sortedTasks);
  }, [sortedTasks, currentPage, itemsPerPage, viewMode, getPaginatedData]);

  // Reset to page 1 when filters change
  // Reset to page 1 when filters change
  useEffect(() => {
    resetToFirstPage();
  }, [searchQuery, statusFilter, priorityFilter, dateFilter, resetToFirstPage]); // ADD priorityFilter

  const handleViewTask = (taskId: number) => {
    if (externalViewTask) {
      externalViewTask(taskId);
    } else {
      setSelectedTaskId(taskId);
      setTaskDialogMode('view');
      setTaskDialogOpen(true);
    }
  };

  const handleEditTask = (taskId: number) => {
    if (externalEditTask) {
      externalEditTask(taskId);
    } else {
      setSelectedTaskId(taskId);
      setTaskDialogMode('edit');
      setTaskDialogOpen(true);
    }
  };

  const handleViewModeChange = (mode: 'table' | 'board') => {
    setViewMode(mode);
    if (onViewModeChange) {
      onViewModeChange(mode);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task? This action cannot be undone.')) return;
    
    try {
      const response = await fetch(`${API_ENDPOINTS.tasks.delete(taskId)}?hardDelete=true`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json();
      
      if (data.success) {
        fetchMyTasks();
        toast.success('Task deleted successfully');
      } else {
        toast.error(data.message || 'Failed to delete task');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task. Please try again.');
    }
  };

  const handleUpdateTaskStatus = async (taskId: number, newStatus: string) => {
    try {
      // Find the task to check if it's completed
      const task = tasks.find(t => t.task_id === taskId);
      
      // Check if ANY assignment is completed (not just current user)
      const isTaskCompleted = task?.task_assignments?.some(a => a.status === 'completed');
      
      // ONLY prevent if task is completed (locked state)
      if (isTaskCompleted) {
        // alert('This task has been completed and cannot be changed. Completed tasks are locked.');
        toast.error('This task has been completed and cannot be changed. Completed tasks are locked.');
        return;
      }

      console.log('🔄 Updating task status:', { taskId, newStatus, currentStatus: task?.status });

      const response = await fetch(API_ENDPOINTS.tasks.update(taskId), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      
      const data = await response.json();
      
      console.log('✅ Update response:', data);
      
      if (data.success) {
        // Update all assignments in local state immediately for ALL users
        if (newStatus === 'completed') {
          setTasks(prevTasks => 
            prevTasks.map(task => {
              if (task.task_id === taskId) {
                return {
                  ...task,
                  status: newStatus,
                  user_status: newStatus,
                  task_assignments: task.task_assignments?.map(a => ({
                    ...a,
                    status: 'completed',
                    completed_by: currentUser?.user_id || null,
                    completed_at: new Date().toISOString(),
                    completer: currentUser ? {
                      user_id: currentUser.user_id,
                      name: currentUser.name,
                      email: currentUser.email
                    } : null
                  }))
                };
              }
              return task;
            })
          );
        } else {
          // For any other status change (including back to todo), update ALL assignments
          setTasks(prevTasks => 
            prevTasks.map(task => {
              if (task.task_id === taskId) {
                return {
                  ...task,
                  status: newStatus,
                  user_status: newStatus,
                  task_assignments: task.task_assignments?.map(a => ({
                    ...a,
                    status: newStatus
                  }))
                };
              }
              return task;
            })
          );
        }
        
        // Then fetch fresh data from server
        await fetchMyTasks();
      } else {
        console.error('❌ Failed to update:', data.message);
        // alert(data.message || 'Failed to update task status');
        toast.error(data.message || 'Failed to update task status');
      }
    } catch (error) {
      console.error('❌ Error updating task status:', error);
      // alert('Failed to update task status. Please try again.');
      toast.error('Failed to update task status. Please try again.');
    }
  };

  // ============================================================================
  // INLINE EDITING HANDLERS
  // ============================================================================
  
  const startEditing = (task: Task, field: 'task_name' | 'comments' | 'status' | 'priority' | 'due_date' | 'assignee') => {
    setEditingCell({ taskId: task.task_id, field });
    
    if (field === 'task_name') {
      setEditingValue(task.task_name);
    } else if (field === 'comments') {
      setEditingValue(task.comments || '');
    } else if (field === 'status') {
      setEditingValue(task.status);
      setEditingDropdownOpen(true);
    } else if (field === 'priority') {
      setEditingValue(task.priority);
      setEditingDropdownOpen(true);
    } else if (field === 'due_date') {
      setEditingDate(new Date(task.due_date));
      setEditingDropdownOpen(true);
    } else if (field === 'assignee') {
      setEditingValue(task.assignee?.name || '');
      setEditingDropdownOpen(true);
    }
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setEditingValue('');
    setEditingDropdownOpen(false);
    setEditingDate(undefined);
  };

  const saveEdit = async (task: Task, field: string, newValue: any) => {
    try {
      const updatePayload: Record<string, unknown> = {};

      if (field === 'task_name') {
        updatePayload.task_name = newValue;
      } else if (field === 'comments') {
        updatePayload.comments = newValue;
      } else if (field === 'status') {
        updatePayload.status = newValue;
      } else if (field === 'priority') {
        updatePayload.priority = newValue;
      } else if (field === 'due_date') {
        updatePayload.due_date = newValue instanceof Date ? newValue.toISOString() : newValue;
      } else if (field === 'assignee') {
        updatePayload.assigned_to = Number(newValue);
      }

      console.log('Updating task with payload:', updatePayload);

      const response = await fetch(API_ENDPOINTS.tasks.update(task.task_id), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Update failed');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to update task');
      }

      await fetchMyTasks();
      cancelEditing();
    } catch (err) {
      console.error('Update error:', err);
      // alert(err instanceof Error ? err.message : 'Failed to update');
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (newStatus: string) => {
    if (draggedTask) {
      // Check if ANY assignment is completed (task is locked)
      const isTaskCompleted = draggedTask.task_assignments?.some(a => a.status === 'completed');
      
      console.log('🎯 Drop event:', {
        taskId: draggedTask.task_id,
        currentStatus: draggedTask.status,
        newStatus,
        isTaskCompleted,
        assignments: draggedTask.task_assignments
      });
      
      // ONLY prevent dropping completed tasks
      if (isTaskCompleted) {
        // alert('This task has been completed and cannot be moved. Completed tasks are locked.');
        toast.error('This task has been completed and cannot be moved. Completed tasks are locked.');
        setDraggedTask(null);
        return;
      }

      // Allow any status change for non-completed tasks
      const currentStatus = draggedTask.user_status || draggedTask.status;
      if (currentStatus !== newStatus) {
        handleUpdateTaskStatus(draggedTask.task_id, newStatus);
      }
    }
    setDraggedTask(null);
  };

  const getTaskActions = (task: Task): MenuItem[] => [
    {
      icon: Edit,
      label: 'Edit Task',
      onClick: () => handleEditTask(task.task_id),
    },
    {
      icon: Trash2,
      label: 'Delete Task',
      onClick: () => handleDeleteTask(task.task_id),
      danger: true,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-700';
      case 'to_do':
      case 'todo':
        return 'bg-blue-100 text-blue-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'overdue':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'in_progress':
        return 'In Progress';
      case 'to_do':
      case 'todo':
        return 'To Do';
      case 'completed':
        return 'Completed';
      case 'overdue':
        return 'Over Due';
      default:
        return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'text-red-600 bg-red-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'low':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityLabel = (priority: string) => {
    return priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
  };


  const handleSort = (key: 'task_name' | 'matter_title' | 'client_name' | 'assigned_by' | 'due_date') => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        if (prev.direction === 'asc') {
          return { key, direction: 'desc' };
        } else if (prev.direction === 'desc') {
          return { key: null, direction: null };
        }
      }
      return { key, direction: 'asc' };
    });
  };

  const getSortIcon = (key: typeof sortConfig.key) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ArrowUp className="h-4 w-4 text-blue-600" />;
    }
    return <ArrowDown className="h-4 w-4 text-blue-600" />;
  };

  const getSortLabel = (key: typeof sortConfig.key) => {
    if (sortConfig.key !== key) {
      return 'Click to sort';
    }
    
    if (key === 'task_name') {
      return sortConfig.direction === 'asc' 
        ? 'Sorted: A to Z' 
        : 'Sorted: Z to A';
    }
    
    if (key === 'matter_title') {
      return sortConfig.direction === 'asc' 
        ? 'Sorted: Matter A to Z' 
        : 'Sorted: Matter Z to A';
    }
    
    if (key === 'client_name') {
      return sortConfig.direction === 'asc' 
        ? 'Sorted: Client A to Z' 
        : 'Sorted: Client Z to A';
    }
    
    if (key === 'assigned_by') {
      return sortConfig.direction === 'asc' 
        ? 'Sorted: A to Z' 
        : 'Sorted: Z to A';
    }
    
    if (key === 'due_date') {
      return sortConfig.direction === 'asc' 
        ? 'Sorted: Earliest to Latest' 
        : 'Sorted: Latest to Earliest';
    }
    
    return 'Click to sort';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const groupTasksByStatus = () => {
    return {
      todo: sortedTasks.filter(t => {
        const userStatus = t.user_status || t.status;
        return userStatus === 'todo';
      }),
      in_progress: sortedTasks.filter(t => {
        const userStatus = t.user_status || t.status;
        return userStatus === 'in_progress';
      }),
      completed: sortedTasks.filter(t => {
        const userStatus = t.user_status || t.status;
        return userStatus === 'completed';
      }),
      overdue: sortedTasks.filter(t => {
        const userStatus = t.user_status || t.status;
        return userStatus === 'overdue';
      })
    };
  };

  // ============================================================================
  // EDITABLE CELL COMPONENTS
  // ============================================================================

  const EditableTextCell = ({
    task,
    field,
    value,
    placeholder = ''
  }: {
    task: Task;
    field: 'task_name' | 'comments';
    value: string;
    placeholder?: string;
  }) => {
    const isEditing = editingCell?.taskId === task.task_id && editingCell.field === field;

    if (!isEditing) {
      return (
        <td
          className="px-6 py-4 cursor-pointer hover:bg-blue-50 transition-colors"
          onDoubleClick={() => startEditing(task, field)}
          title="Double-click to edit"
        >
          <div className={`text-sm ${field === 'task_name' ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
            {value || '-'}
          </div>
        </td>
      );
    }

    return (
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <input
            autoFocus
            type="text"
            className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                saveEdit(task, field, editingValue);
              } else if (e.key === 'Escape') {
                cancelEditing();
              }
            }}
            placeholder={placeholder}
          />
          <button
            onClick={() => saveEdit(task, field, editingValue)}
            className="p-1.5 text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
            title="Save (Enter)"
          >
            <Check size={16} />
          </button>
          <button
            onClick={cancelEditing}
            className="p-1.5 text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
            title="Cancel (Esc)"
          >
            <X size={16} />
          </button>
        </div>
      </td>
    );
  };

  const EditableDropdownCell = ({
    task,
    field,
    value,
    options,
    getLabel,
    getColor
  }: {
    task: Task;
    field: 'status' | 'priority';
    value: string;
    options: { value: string; label: string }[];
    getLabel: (value: string) => string;
    getColor: (value: string) => string;
  }) => {
    const isEditing = editingCell?.taskId === task.task_id && editingCell.field === field;

    if (!isEditing) {
      return (
        <td
          className="px-6 py-4 cursor-pointer hover:bg-blue-50 transition-colors"
          onDoubleClick={() => startEditing(task, field)}
          title="Double-click to edit"
        >
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getColor(value)}`}>
            {getLabel(value)}
          </span>
        </td>
      );
    }

    return (
      <td className="px-6 py-4 relative">
        <Popover open={editingDropdownOpen} onOpenChange={setEditingDropdownOpen}>
          <PopoverTrigger asChild>
            <div className="inline-flex items-center gap-2 border border-gray-300 px-3 py-1.5 rounded bg-white cursor-pointer hover:bg-gray-50">
              <span className="text-sm">{getLabel(editingValue)}</span>
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </div>
          </PopoverTrigger>

          <PopoverContent className="w-[200px] p-0" align="start">
            <Command>
              <CommandList>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => {
                        saveEdit(task, field, option.value);
                      }}
                    >
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getColor(option.value)}`}>
                        {option.label}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        
        <button
          onClick={cancelEditing}
          className="ml-2 p-1.5 text-white bg-red-600 hover:bg-red-700 rounded transition-colors inline-flex items-center"
          title="Cancel"
        >
          <X size={16} />
        </button>
      </td>
    );
  };

  const EditableDateCell = ({
    task,
    value
  }: {
    task: Task;
    value: string;
  }) => {
    const isEditing = editingCell?.taskId === task.task_id && editingCell.field === 'due_date';

    if (!isEditing) {
      return (
        <td
          className="px-6 py-4 cursor-pointer hover:bg-blue-50 transition-colors"
          onDoubleClick={() => startEditing(task, 'due_date')}
          title="Double-click to edit"
        >
          <div className="text-sm text-gray-700">{formatDate(value)}</div>
        </td>
      );
    }

    return (
      <td className="px-6 py-4 relative">
        <Popover open={editingDropdownOpen} onOpenChange={setEditingDropdownOpen}>
          <PopoverTrigger asChild>
            <div className="inline-flex items-center gap-2 border border-gray-300 px-3 py-1.5 rounded bg-white cursor-pointer hover:bg-gray-50">
              <CalendarIcon className="h-4 w-4 opacity-50" />
              <span className="text-sm">{editingDate ? formatDate(editingDate.toISOString()) : 'Select date'}</span>
            </div>
          </PopoverTrigger>

          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={editingDate}
              onSelect={(date) => {
                if (date) {
                  setEditingDate(date);
                  saveEdit(task, 'due_date', date);
                }
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        
        <button
          onClick={cancelEditing}
          className="ml-2 p-1.5 text-white bg-red-600 hover:bg-red-700 rounded transition-colors inline-flex items-center"
          title="Cancel"
        >
          <X size={16} />
        </button>
      </td>
    );
  };

  const statusOptions = [
    { value: 'todo', label: 'To Do' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'overdue', label: 'Over Due' }
  ];

  const priorityOptions = [
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ];

  const TaskCard = ({ task }: { task: Task }) => {
    const [isDragging, setIsDragging] = useState(false);
    
    // Get assigned users info
    const assignedUsers = task.task_assignments || [];
    
    // Check if task is completed
    const isCompleted = assignedUsers.some(a => a.status === 'completed') || 
                      task.status === 'completed' || 
                      task.user_status === 'completed';
    
    // Find who completed the task
    const completedByAssignment = assignedUsers.find(a => a.status === 'completed' && a.completer);
    const completedBy = completedByAssignment?.completer?.name;

    // console.log('TaskCard Debug:', {
    //   taskId: task.task_id,
    //   isCompleted,
    //   completedBy,
    //   completedByAssignment,
    //   assignments: assignedUsers
    // });

    return (
      <div 
        draggable={!isCompleted}
        onDragStart={(e) => {
          if (isCompleted) {
            e.preventDefault();
            return;
          }
          setIsDragging(true);
          handleDragStart(task);
        }}
        onDragEnd={() => setIsDragging(false)}
        className={`bg-white border border-gray-200 rounded-lg p-4 mb-3 hover:shadow-md transition-all ${
          isCompleted 
            ? 'cursor-not-allowed opacity-75' 
            : 'cursor-grab active:cursor-grabbing'
        } ${isDragging ? 'opacity-50 scale-95' : ''}`}
      >
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-semibold text-gray-900 text-sm">{task.task_name}</h4>
          <span className={`text-xs px-2 py-1 rounded-full capitalize ${getPriorityColor(task.priority)}`}>
            {task.priority}
          </span>
        </div>
        
        {/* CHANGE: Add optional chaining and fallback for client */}
        <p className="text-xs text-gray-600 mb-1">
          Client: {task.client?.client_name || 'No client assigned'}
        </p>
        
        {/* CHANGE: Add optional chaining and fallback for matter */}
        <p className="text-xs text-gray-600 mb-2">
          Matter: {task.matter?.matter_title || 'No matter assigned'}
        </p>
        
        {/* Show assigned lawyers */}
        {assignedUsers.length > 0 && (
          <div className="mb-2">
            <p className="text-xs text-gray-500 mb-1">Assigned to:</p>
            <div className="flex flex-wrap gap-1">
              {assignedUsers.slice(0, 3).map((assignment) => {
                const assignmentCompleted = assignment.status === 'completed';
                const isCurrentUser = assignment.user_id === currentUser?.user_id;
                return (
                  <div
                    key={assignment.user_id}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                      assignmentCompleted 
                        ? 'bg-green-50 text-green-700 border border-green-200' 
                        : isCurrentUser
                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                        : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] ${
                      assignmentCompleted ? 'bg-green-500' : 'bg-blue-500'
                    }`}>
                      {assignmentCompleted ? '✓' : assignment.user.name.charAt(0)}
                    </div>
                    <span className="truncate max-w-[80px]">
                      {assignment.user.name}
                      {isCurrentUser && ' (You)'}
                    </span>
                  </div>
                );
              })}
              {assignedUsers.length > 3 && (
                <span className="text-xs text-gray-500 px-2 py-0.5">
                  +{assignedUsers.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Show completed by info if task is completed */}
        {isCompleted && completedBy && (
          <div className="mb-2 px-2 py-1 bg-green-50 border border-green-200 rounded flex items-center gap-1">
            <span className="text-green-600 text-xs font-bold">✓</span>
            <span className="text-xs text-green-700 font-semibold">
              Completed by {completedBy}
            </span>
          </div>
        )}
        
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs">
              {task.assigner?.name.charAt(0) || 'U'}
            </div>
            <span className="text-xs text-gray-700">By: {task.assigner?.name || 'Unknown'}</span>
          </div>
          <span className="text-xs text-gray-500">{formatDate(task.due_date)}</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button 
            onClick={() => handleViewTask(task.task_id)}
            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
          >
            View
          </button>
          <button 
            onClick={() => handleEditTask(task.task_id)}
            className="text-gray-600 hover:text-gray-800 text-xs font-medium"
            disabled={isCompleted}
          >
            Edit
          </button>
          <button 
            onClick={() => handleDeleteTask(task.task_id)}
            className="text-red-600 hover:text-red-800 text-xs font-medium"
            disabled={isCompleted}
          >
            Delete
          </button>
        </div>
      </div>
    );
  };

  const BoardView = () => {
    const grouped = groupTasksByStatus();
    
    return (
      <div className="grid grid-cols-4 gap-4 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <div 
          className="bg-blue-50 rounded-lg p-4"
          onDragOver={handleDragOver}
          onDrop={() => handleDrop('todo')}
        >
          <h3 className="font-semibold text-gray-900 mb-4">To Do ({grouped.todo.length})</h3>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {grouped.todo.map(task => (
              <TaskCard key={task.task_id} task={task} />
            ))}
            {grouped.todo.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No tasks</p>
            )}
          </div>
        </div>

        <div 
          className="bg-yellow-50 rounded-lg p-4"
          onDragOver={handleDragOver}
          onDrop={() => handleDrop('in_progress')}
        >
          <h3 className="font-semibold text-gray-900 mb-4">In-Progress ({grouped.in_progress.length})</h3>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {grouped.in_progress.map(task => (
              <TaskCard key={task.task_id} task={task} />
            ))}
            {grouped.in_progress.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No tasks</p>
            )}
          </div>
        </div>

        <div 
          className="bg-green-50 rounded-lg p-4"
          onDragOver={handleDragOver}
          onDrop={() => handleDrop('completed')}
        >
          <h3 className="font-semibold text-gray-900 mb-4">Completed ({grouped.completed.length})</h3>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {grouped.completed.map(task => (
              <TaskCard key={task.task_id} task={task} />
            ))}
            {grouped.completed.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No tasks</p>
            )}
          </div>
        </div>

        <div 
          className="bg-red-50 rounded-lg p-4"
          onDragOver={handleDragOver}
          onDrop={() => handleDrop('overdue')}
        >
          <h3 className="font-semibold text-gray-900 mb-4">Over Due ({grouped.overdue.length})</h3>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {grouped.overdue.map(task => (
              <TaskCard key={task.task_id} task={task} />
            ))}
            {grouped.overdue.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No tasks</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const TableView = () => (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Loading tasks...</div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-red-500 mb-2">{error}</div>
          <button 
            onClick={fetchMyTasks}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Retry
          </button>
          <div className="mt-4 text-xs text-gray-400">
            Debug: User ID = {currentUser?.user_id || 'Not loaded'}
          </div>
        </div>
      ) : (
        <>
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('task_name')}
                  title={getSortLabel('task_name')}
                >
                  <div className="flex items-center gap-2">
                    Task Name
                    {getSortIcon('task_name')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('matter_title')}
                  title={getSortLabel('matter_title')}
                >
                  <div className="flex items-center gap-2">
                    Matter Title
                    {getSortIcon('matter_title')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('client_name')}
                  title={getSortLabel('client_name')}
                >
                  <div className="flex items-center gap-2">
                    Client Name
                    {getSortIcon('client_name')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('assigned_by')}
                  title={getSortLabel('assigned_by')}
                >
                  <div className="flex items-center gap-2">
                    Assigned By
                    {getSortIcon('assigned_by')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('due_date')}
                  title={getSortLabel('due_date')}
                >
                  <div className="flex items-center gap-2">
                    Due Date
                    {getSortIcon('due_date')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Remarks
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedTasks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    No tasks found
                  </td>
                </tr>
              ) : (
                paginatedTasks.map((task) => (
                  <tr key={task.task_id} className="hover:bg-gray-50 transition-colors">
                    <EditableTextCell
                      task={task}
                      field="task_name"
                      value={task.task_name}
                      placeholder="Enter task name"
                    />
                    
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {task.matter?.matter_title || 'No matter assigned'}
                    </td>
                    
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {task.client?.client_name || 'No client assigned'}
                    </td>
                    
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {task.assigner?.name || '-'}
                    </td>
                    
                    <EditableDropdownCell
                      task={task}
                      field="priority"
                      value={task.priority}
                      options={priorityOptions}
                      getLabel={getPriorityLabel}
                      getColor={getPriorityColor}
                    />
                    
                    <EditableDateCell
                      task={task}
                      value={task.due_date}
                    />
                    
                    <EditableDropdownCell
                      task={task}
                      field="status"
                      value={task.user_status || task.status}  
                      options={statusOptions}
                      getLabel={getStatusLabel}
                      getColor={getStatusColor}
                    />
                    
                    <EditableTextCell
                      task={task}
                      field="comments"
                      value={task.comments || ''}
                      placeholder="Enter remarks"
                    />
                    
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleViewTask(task.task_id)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          View Task
                        </button>
                        <MoreActionsMenu items={getTaskActions(task)} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {sortedTasks.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={sortedTasks.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
              showItemsPerPage={true}
              itemsPerPageOptions={[10, 25, 50, 100]}
            />
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="p-6">
      {/* Header with View Toggle */}
      <div className="mb-6 flex items-center justify-end">
        {/* <div>
          <h1 className="text-2xl font-semibold text-gray-900">My Tasks</h1>
        </div> */}
        
        {/* View Toggle */}
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => handleViewModeChange('board')}
            className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
              viewMode === 'board'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <LayoutGrid size={18} />
            <span className="text-sm font-medium">Board View</span>
          </button>
          <button
            onClick={() => handleViewModeChange('table')}
            className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
              viewMode === 'table'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Table size={18} />
            <span className="text-sm font-medium">Table View</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        {/* Search Bar */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Lawyer Name, Client Name, Matter Name, or Task Name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        {/* Date Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 whitespace-nowrap">Filter By Date:</span>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option>Today</option>
            <option>This Week</option>
            <option>This Month</option>
            <option>All Time</option>
          </select>
        </div>
        
        {/* Priority Filter - Multi-select with Checkboxes */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 whitespace-nowrap">Priority:</span>
          <Popover open={priorityDropdownOpen} onOpenChange={setPriorityDropdownOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:bg-gray-50 transition-colors min-w-[140px]">
                <span className="text-sm text-gray-700">
                  {priorityFilter.length === 0 
                    ? 'All' 
                    : priorityFilter.length === 1
                    ? priorityFilter[0].charAt(0).toUpperCase() + priorityFilter[0].slice(1)
                    : `${priorityFilter.length} selected`}
                </span>
                <ChevronsUpDown className="h-4 w-4 opacity-50 ml-auto" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
              <Command>
                <CommandList>
                  <CommandGroup>
                    {['high', 'medium', 'low'].map((priority) => {
                      const isSelected = priorityFilter.includes(priority);
                      return (
                        <CommandItem
                          key={priority}
                          value={priority}
                          onSelect={() => {
                            if (isSelected) {
                              setPriorityFilter(priorityFilter.filter(p => p !== priority));
                            } else {
                              setPriorityFilter([...priorityFilter, priority]);
                            }
                          }}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <div className={`w-4 h-4 border-2 rounded flex items-center justify-center flex-shrink-0 ${
                            isSelected 
                              ? 'bg-blue-600 border-blue-600' 
                              : 'border-gray-300'
                          }`}>
                            {isSelected && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </div>
                          
                          <span className="flex-1 text-sm capitalize">{priority}</span>
                          
                          <span className={`w-2 h-2 rounded-full ${
                            priority === 'high' ? 'bg-red-500' :
                            priority === 'medium' ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}></span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
                
                {priorityFilter.length > 0 && (
                  <div className="border-t border-gray-200 px-3 py-2 bg-gray-50">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>{priorityFilter.length} selected</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPriorityFilter([]);
                        }}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>
                )}
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        
        {/* Status Filter */}
        {/* <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 whitespace-nowrap">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option>All</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="overdue">Over Due</option>
          </select>
        </div> */}
      </div>

      {/* Content */}
      {viewMode === 'table' ? <TableView /> : <BoardView />}

      <TaskDialog
        isOpen={taskDialogOpen}
        onClose={() => setTaskDialogOpen(false)}
        mode={taskDialogMode}
        taskId={selectedTaskId}
        onSuccess={fetchMyTasks}
      />
    </div>
  );
}