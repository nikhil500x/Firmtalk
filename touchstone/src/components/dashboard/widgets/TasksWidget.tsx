'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_ENDPOINTS } from '@/lib/api';
import { ClipboardList, AlertCircle, Plus, ExternalLink, CheckCircle2 } from 'lucide-react';
import WidgetContainer from './WidgetContainer';
import { Button } from '@/components/ui/button';
import TaskDialog from '@/components/task/TaskDialog';

interface Task {
  id: number;
  status: string;
  dueDate: string;
  priority?: string;
}

interface TasksSummary {
  pending: number;
  overdue: number;
  completed: number;
  highPriority?: number;
}

export default function TasksWidget() {
  const router = useRouter();
  const [summary, setSummary] = useState<TasksSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummary = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await fetch(API_ENDPOINTS.tasks.list, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }

      const data = await response.json();
      if (data.success) {
        const tasks: Task[] = data.data || [];
        const now = new Date();

        const pending = tasks.filter((task) => 
          task.status === 'todo' || task.status === 'in_progress'
        ).length;

        const overdue = tasks.filter((task) => {
          const dueDate = new Date(task.dueDate);
          return dueDate < now && task.status !== 'completed';
        }).length;

        const completed = tasks.filter((task) => task.status === 'completed').length;

        const highPriority = tasks.filter((task) => 
          task.priority === 'high' && task.status !== 'completed'
        ).length;

        setSummary({ pending, overdue, completed, highPriority });
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Error fetching tasks summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to load task data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleWidgetClick = () => {
    router.push('/task');
  };

  const handleAddTask = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsTaskDialogOpen(true);
  };

  const handleTaskSuccess = () => {
    setIsTaskDialogOpen(false);
    fetchSummary(true);
  };

  const handleOverdueClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push('/task?tab=alltasks&status=overdue');
  };

  const handleHighPriorityClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push('/task?tab=alltasks&priority=high');
  };

  const emptyState = !loading && !error && summary && 
    summary.pending === 0 && summary.overdue === 0 && summary.completed === 0;

  return (
    <>
      <WidgetContainer
        title="Tasks"
        icon={<ClipboardList className="w-5 h-5 text-blue-600" />}
        loading={loading}
        error={error}
        onRefresh={() => fetchSummary(true)}
        onRetry={() => fetchSummary()}
        lastUpdated={lastUpdated}
        onClick={handleWidgetClick}
        aria-label="Tasks Summary - Click to view all tasks"
        footer={
          <div className="flex items-center justify-between w-full">
            <Link
              href="/task"
              onClick={(e) => e.stopPropagation()}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              View All
              <ExternalLink className="w-3 h-3" />
            </Link>
            <Button
              size="sm"
              onClick={handleAddTask}
              className="h-8"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Task
            </Button>
          </div>
        }
      >
        {emptyState ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ClipboardList className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm text-gray-600 mb-2">No tasks yet</p>
            <p className="text-xs text-gray-500 mb-4">Create your first task to get started</p>
            <Button size="sm" onClick={handleAddTask} variant="outline">
              <Plus className="w-4 h-4 mr-1" />
              Create Task
            </Button>
          </div>
        ) : summary ? (
          <div className="space-y-4">
            {/* Status Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-blue-50 border border-blue-200">
                <div className="text-2xl font-bold text-blue-700">{summary.pending}</div>
                <div className="text-xs text-blue-600 font-medium">Pending</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-50 border border-red-200 relative">
                {summary.overdue > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                    {summary.overdue}
                  </span>
                )}
                <div className="text-2xl font-bold text-red-700">{summary.overdue}</div>
                <div className="text-xs text-red-600 font-medium">Overdue</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="text-2xl font-bold text-green-700">{summary.completed}</div>
                <div className="text-xs text-green-600 font-medium">Completed</div>
              </div>
            </div>

            {/* Alerts - Now Clickable */}
            {summary.overdue > 0 && (
              <button
                onClick={handleOverdueClick}
                className="w-full flex items-center gap-2 text-red-700 text-sm bg-red-50 border border-red-200 p-3 rounded-lg hover:bg-red-100 hover:border-red-300 transition-all cursor-pointer"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">{summary.overdue} overdue task{summary.overdue !== 1 ? 's' : ''} need attention</span>
              </button>
            )}

            {/* High Priority - Always show, clickable only if > 0 */}
            {summary.highPriority !== undefined && (
              summary.highPriority > 0 ? (
                <button
                  onClick={handleHighPriorityClick}
                  className="w-full flex items-center gap-2 text-orange-700 text-sm bg-orange-50 border border-orange-200 p-3 rounded-lg hover:bg-orange-100 hover:border-orange-300 transition-all cursor-pointer"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{summary.highPriority} high priority task{summary.highPriority !== 1 ? 's' : ''}</span>
                </button>
              ) : (
                <div className="w-full flex items-center gap-2 text-gray-600 text-sm bg-gray-50 border border-gray-200 p-3 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>0 high priority tasks</span>
                </div>
              )
            )}

            {/* Completion Progress */}
            {summary.completed > 0 && (
              <div className="pt-3 border-t">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-600 font-medium">Completion Rate</span>
                  <span className="text-xs text-gray-600">
                    {summary.completed + summary.pending + summary.overdue > 0
                      ? Math.round((summary.completed / (summary.completed + summary.pending + summary.overdue)) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${summary.completed + summary.pending + summary.overdue > 0
                        ? (summary.completed / (summary.completed + summary.pending + summary.overdue)) * 100
                        : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : null}
      </WidgetContainer>

      {/* Task Dialog */}
      <TaskDialog
        isOpen={isTaskDialogOpen}
        onClose={() => setIsTaskDialogOpen(false)}
        mode="add"
        onSuccess={handleTaskSuccess}
      />
    </>
  );
}