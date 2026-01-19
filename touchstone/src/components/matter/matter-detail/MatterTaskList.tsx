'use client';

import { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '@/lib/api';
import { Search, Eye, Edit, Trash2, Plus, Briefcase, ArrowLeft } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import MoreActionsMenu, { MenuItem } from '@/components/MoreActionsMenu';
import TaskDialog from '@/components/task/TaskDialog';

interface Matter {
  id: number;
  matterTitle: string;
  matterNumber?: string;
  matterCode?: string;
  client: {
    id: number;
    name: string;
  };
  status: string;
}

interface Task {
  task_id: number;
  task_name: string;
  matter: {
    matter_id: number;
    matter_title: string;
    practice_area: string;
  };
  client: {
    client_id: number;
    client_name: string;
  };
  assignee: {
    user_id: number;
    name: string;
    email: string;
  } | null;
  assigner: {
    user_id: number;
    name: string;
    email: string;
  } | null;
  due_date: string;
  status: string;
  priority: string;
  comments: string | null;
  active_status: boolean;
}

interface TaskStats {
  total: number;
  todo: number;
  in_progress: number;
  completed: number;
  overdue: number;
}

export default function MatterTasksPage() {
  const router = useRouter();
  const params = useParams();
  
  // The parameter name is matter_id (with underscore)
  const matterId = params?.matter_id ? Number(params.matter_id) : null;
  
  console.log('Extracted matterId:', matterId);

  const [matter, setMatter] = useState<Matter | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats>({
    total: 0,
    todo: 0,
    in_progress: 0,
    completed: 0,
    overdue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('All Time');
  const [statusFilter, setStatusFilter] = useState('All');
  const [error, setError] = useState<string | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskDialogMode, setTaskDialogMode] = useState<'add' | 'edit' | 'view'>('view');
  const [selectedTaskId, setSelectedTaskId] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (matterId) {
      fetchMatterDetails();
      fetchMatterTasks();
    }
  }, [matterId]);

  useEffect(() => {
    calculateStats();
  }, [tasks]);

  const fetchMatterDetails = async () => {
    if (!matterId) return;

    try {
      const response = await fetch(API_ENDPOINTS.matters.byId(matterId), {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch matter details');
      }

      const data = await response.json();
      console.log('Matter details:', data);
      
      if (data.success && data.data) {
        setMatter(data.data);
      }
    } catch (error) {
      console.error('Error fetching matter:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load matter details';
      setError(errorMessage);
    }
  };

  const fetchMatterTasks = async () => {
    if (!matterId) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        matter_id: matterId.toString(),
        active_status: 'true',
      });

      if (statusFilter !== 'All') {
        params.append('status', statusFilter.toLowerCase());
      }

      const response = await fetch(`${API_ENDPOINTS.tasks.list}?${params.toString()}`, {
        credentials: 'include',
      });

      console.log('Tasks response status:', response.status);

      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.status}`);
      }

      const data = await response.json();
      console.log('Tasks data:', data);

      if (data.success && data.data) {
        setTasks(data.data);
      } else {
        setTasks([]);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load tasks';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const now = new Date();
    const newStats: TaskStats = {
      total: tasks.length,
      todo: 0,
      in_progress: 0,
      completed: 0,
      overdue: 0,
    };

    tasks.forEach(task => {
      const dueDate = new Date(task.due_date);
      const isOverdue = dueDate < now && task.status.toLowerCase() !== 'completed';

      if (isOverdue) {
        newStats.overdue++;
      } else {
        const status = task.status.toLowerCase();
        if (status === 'todo' || status === 'to_do') {
          newStats.todo++;
        } else if (status === 'in_progress') {
          newStats.in_progress++;
        } else if (status === 'completed') {
          newStats.completed++;
        }
      }
    });

    setStats(newStats);
  };

  const handleViewTask = (taskId: number) => {
    setSelectedTaskId(taskId);
    setTaskDialogMode('view');
    setTaskDialogOpen(true);
  };

  const handleEditTask = (taskId: number) => {
    setSelectedTaskId(taskId);
    setTaskDialogMode('edit');
    setTaskDialogOpen(true);
  };

  const handleAddTask = () => {
    setSelectedTaskId(undefined);
    setTaskDialogMode('add');
    setTaskDialogOpen(true);
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      const response = await fetch(API_ENDPOINTS.tasks.delete(taskId), {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json();

      if (data.success) {
        fetchMatterTasks();
      }
    } catch (error) {
      console.error('Error deleting task:', error);
    }
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch =
      task.task_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.assignee?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.comments || '').toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  // Calculate percentages for pie chart
  const todoPercent = stats.total > 0 ? Math.round((stats.todo / stats.total) * 100) : 0;
  const progressPercent = stats.total > 0 ? Math.round((stats.in_progress / stats.total) * 100) : 0;
  const completedPercent = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  const overduePercent = stats.total > 0 ? Math.round((stats.overdue / stats.total) * 100) : 0;

  // SVG circle calculations
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  
  const completedLength = (completedPercent / 100) * circumference;
  const progressLength = (progressPercent / 100) * circumference;
  const todoLength = (todoPercent / 100) * circumference;
  const overdueLength = (overduePercent / 100) * circumference;

  return (
    <div className="p-4">

      {/* Matter Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Briefcase className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {matter?.matterTitle || 'Loading...'}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {matter?.matterCode || `M${matterId}`}
              </p>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Client:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {matter?.client?.name || 'Loading...'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Activity status:</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    {matter?.status || 'In Progress'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-5 gap-6 mb-6">
        {/* Total Tasks Card with Pie Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Task Assigned</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <svg width="80" height="80" viewBox="0 0 80 80" className="transform -rotate-90">
              {stats.total > 0 ? (
                <>
                  {/* Green - Completed */}
                  <circle
                    cx="40"
                    cy="40"
                    r={radius}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="20"
                    strokeDasharray={`${completedLength} ${circumference}`}
                  />
                  {/* Yellow - In Progress */}
                  <circle
                    cx="40"
                    cy="40"
                    r={radius}
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="20"
                    strokeDasharray={`${progressLength} ${circumference}`}
                    strokeDashoffset={-completedLength}
                  />
                  {/* Blue - To Do */}
                  <circle
                    cx="40"
                    cy="40"
                    r={radius}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="20"
                    strokeDasharray={`${todoLength} ${circumference}`}
                    strokeDashoffset={-(completedLength + progressLength)}
                  />
                  {/* Red - Overdue */}
                  <circle
                    cx="40"
                    cy="40"
                    r={radius}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="20"
                    strokeDasharray={`${overdueLength} ${circumference}`}
                    strokeDashoffset={-(completedLength + progressLength + todoLength)}
                  />
                  {/* White center */}
                  <circle cx="40" cy="40" r="20" fill="white" />
                </>
              ) : (
                <>
                  <circle cx="40" cy="40" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="20" />
                  <circle cx="40" cy="40" r="20" fill="white" />
                </>
              )}
            </svg>
          </div>
        </div>

        {/* To Do */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">To Do</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-blue-600">{stats.todo}</p>
            <span className="text-gray-400">→</span>
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Completed</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
            <span className="text-gray-400">→</span>
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">In Progress</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-yellow-600">{stats.in_progress}</p>
            <span className="text-gray-400">→</span>
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Overdue</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-red-600">{stats.overdue}</p>
            <span className="text-gray-400">→</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
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
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 whitespace-nowrap">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              fetchMatterTasks();
            }}
            className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option>All</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="overdue">Over Due</option>
          </select>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Loading tasks...</div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-red-500 mb-2">{error}</div>
            <button
              onClick={fetchMatterTasks}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Retry
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Task Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned To
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
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
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No tasks found for this matter
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => {
                  const dueDate = new Date(task.due_date);
                  const now = new Date();
                  const isOverdue = dueDate < now && task.status.toLowerCase() !== 'completed';
                  const displayStatus = isOverdue ? 'overdue' : task.status;

                  return (
                    <tr key={task.task_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {task.task_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {task.assignee?.name || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {formatDate(task.due_date)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            displayStatus
                          )}`}
                        >
                          {getStatusLabel(displayStatus)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">
                        {task.comments || '-'}
                      </td>
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
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      <TaskDialog
        isOpen={taskDialogOpen}
        onClose={() => setTaskDialogOpen(false)}
        mode={taskDialogMode}
        taskId={selectedTaskId}
        onSuccess={fetchMatterTasks}
      />
    </div>
  );
}