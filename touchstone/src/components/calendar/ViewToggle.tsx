'use client';

export type CalendarView = 'day' | 'work-week' | 'week' | 'month';

interface ViewToggleProps {
  currentView: CalendarView;
  onViewChange: (view: CalendarView) => void;
}

export default function ViewToggle({ currentView, onViewChange }: ViewToggleProps) {
  const views: { value: CalendarView; label: string }[] = [
    { value: 'day', label: 'Day' },
    { value: 'work-week', label: 'Work week' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
  ];

  return (
    <div className="flex gap-1 border border-gray-300 rounded-md overflow-hidden">
      {views.map((view) => (
        <button
          key={view.value}
          onClick={() => onViewChange(view.value)}
          className={`
            px-4 py-2 text-sm font-medium transition-colors
            ${currentView === view.value
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50 border-r border-gray-300 last:border-r-0'
            }
          `}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}

