'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS } from '@/lib/api';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isSameMonth, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Task {
  task_id: number;
  task_name: string;
  due_date: string;
  status: string;
  priority: string;
  matter: {
    matter_title: string;
  };
  client: {
    client_name: string;
  };
  assignee: {
    user_id: number;
    name: string;
  } | null;
}

interface TaskCalendarProps {
  refreshTrigger?: number;
  onTaskClick?: (taskId: number) => void;
}

export default function TaskCalendar({ refreshTrigger = 0, onTaskClick }: TaskCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'week' | 'month'>('month');

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(API_ENDPOINTS.tasks.list, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }

      const data = await response.json();
      if (data.success) {
        setTasks(data.data || []);
      } else {
        throw new Error(data.message || 'Failed to fetch tasks');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks, refreshTrigger]);

  const getTasksForDay = (date: Date): Task[] => {
    return tasks.filter((task) => {
      const taskDate = new Date(task.due_date);
      return isSameDay(taskDate, date);
    });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'done':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'in_progress':
      case 'in progress':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'cancelled':
      case 'canceled':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'border-l-4 border-l-red-500';
      case 'medium':
        return 'border-l-4 border-l-yellow-500';
      case 'low':
        return 'border-l-4 border-l-green-500';
      default:
        return '';
    }
  };

  // Calculate days based on view mode
  let allDays: Date[] = [];

  if (viewMode === 'week') {
    // Get current week (Sunday to Saturday) based on currentDate
    const dayOfWeek = currentDate.getDay();
    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() - dayOfWeek);
    
    // Generate 7 days for the week
    allDays = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      return date;
    });
  } else {
    // Month view
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Add days from previous/next month to fill the grid
    const firstDayOfWeek = monthStart.getDay();
    const lastDayOfWeek = monthEnd.getDay();
    const daysBefore = Array.from({ length: firstDayOfWeek }, (_, i) => {
      const date = new Date(monthStart);
      date.setDate(date.getDate() - firstDayOfWeek + i);
      return date;
    });
    const daysAfter = Array.from({ length: 6 - lastDayOfWeek }, (_, i) => {
      const date = new Date(monthEnd);
      date.setDate(date.getDate() + i + 1);
      return date;
    });
    allDays = [...daysBefore, ...days, ...daysAfter];
  }

  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const goToPrevious = () => {
    if (viewMode === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      // Week view - go back one week
      const newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() - 7);
      setCurrentDate(newDate);
    }
  };

  const goToNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      // Week view - go forward one week
      const newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() + 7);
      setCurrentDate(newDate);
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const toggleViewMode = () => {
    setViewMode((prev) => prev === 'week' ? 'month' : 'week');
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-gray-500">Loading calendar...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Calendar Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          {viewMode === 'month' && (
            <>
              <button
                onClick={goToPrevious}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex items-center space-x-2 min-w-[200px] justify-center">
                <h2 className="text-xl font-semibold">
                  {format(currentDate, 'MMMM yyyy')}
                </h2>
              </div>
              <button
                onClick={goToNext}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </>
          )}
          {viewMode === 'week' && (
            <>
              <button
                onClick={goToPrevious}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Previous week"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex items-center space-x-2 min-w-[200px] justify-center">
                <h2 className="text-xl font-semibold">
                  {format(allDays[0], 'MMM d')} - {format(allDays[6], 'MMM d, yyyy')}
                </h2>
              </div>
              <button
                onClick={goToNext}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Next week"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </>
          )}
          <button
            onClick={goToToday}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Today
          </button>
          <button
            onClick={toggleViewMode}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {viewMode === 'week' ? 'Month View' : 'Week View'}
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {dayHeaders.map((day) => (
            <div
              key={day}
              className="px-4 py-3 text-sm font-semibold text-gray-700 text-center border-r border-gray-200 last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {allDays.map((day, index) => {
            const dayTasks = getTasksForDay(day);
            const isDayToday = isToday(day);
            const isDayInCurrentMonth = viewMode === 'week' ? true : isSameMonth(day, startOfMonth(currentDate));
            return (
              <div
                key={index}
                className={`
                  border-r border-b border-gray-200 p-2 min-h-[120px] transition-colors
                  ${isDayInCurrentMonth ? 'bg-white' : 'bg-gray-50'}
                  ${isDayToday ? 'bg-blue-50' : ''}
                `}
              >
                {/* Date Number */}
                <div
                  className={`
                    flex items-center justify-center w-8 h-8 mb-2 rounded-full text-sm font-medium
                    ${isDayToday
                      ? 'bg-blue-600 text-white'
                      : isDayInCurrentMonth
                      ? 'text-gray-900'
                      : 'text-gray-400'
                    }
                  `}
                >
                  {format(day, 'd')}
                </div>

                {/* Task Entries */}
                <div className="space-y-1">
                  {dayTasks.length > 0 ? (
                    <>
                      {dayTasks.slice(0, 3).map((task) => (
                        <div
                          key={task.task_id}
                          className={`text-xs p-1.5 rounded border ${getStatusColor(task.status)} ${getPriorityColor(task.priority)} cursor-pointer hover:opacity-80 transition-opacity`}
                          title={`${task.task_name} - ${task.status} (${task.priority} priority)`}
                          onClick={() => onTaskClick?.(task.task_id)}
                        >
                          <div className="font-medium truncate">{task.task_name}</div>
                          <div className="text-xs opacity-75 truncate">
                            {task.matter?.matter_title || task.client?.client_name || 'No matter'}
                          </div>
                          {task.assignee && (
                            <div className="text-xs opacity-60 truncate">
                              {task.assignee.name}
                            </div>
                          )}
                        </div>
                      ))}
                      {dayTasks.length > 3 && (
                        <div className="text-xs text-gray-500 px-1">
                          +{dayTasks.length - 3} more
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-xs text-gray-400 text-center py-2">
                      No tasks
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

