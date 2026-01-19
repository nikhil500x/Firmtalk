'use client';

import React, { ReactNode } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface WidgetContainerProps {
  title: string;
  icon: ReactNode;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onRetry?: () => void;
  lastUpdated?: Date | null;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  onClick?: () => void;
  'aria-label'?: string;
}

export default function WidgetContainer({
  title,
  icon,
  loading = false,
  error = null,
  onRefresh,
  onRetry,
  lastUpdated,
  children,
  footer,
  className = '',
  onClick,
  'aria-label': ariaLabel,
}: WidgetContainerProps) {
  const formatTimeAgo = (date: Date | null) => {
    if (!date) return null;
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <Card
      className={`
        group relative overflow-hidden
        transition-all duration-200
        ${onClick ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:border-blue-300' : ''}
        ${className}
      `}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel || title}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 group-hover:bg-blue-100 transition-colors">
              {icon}
            </div>
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
          </div>
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Refresh widget"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        {lastUpdated && (
          <p className="text-xs text-gray-500 mt-1">
            Updated {formatTimeAgo(lastUpdated)}
          </p>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-6 gap-3">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <p className="text-sm text-red-600 text-center">{error}</p>
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry();
                }}
              >
                Retry
              </Button>
            )}
          </div>
        ) : (
          children
        )}
      </CardContent>

      {footer && <CardFooter className="pt-0">{footer}</CardFooter>}
    </Card>
  );
}

