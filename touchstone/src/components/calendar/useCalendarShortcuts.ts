import { useEffect, useCallback } from 'react';
import type { CalendarView } from './ViewToggle';

interface UseCalendarShortcutsProps {
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: CalendarView) => void;
  currentView: CalendarView;
  onCloseModal?: () => void;
}

export function useCalendarShortcuts({
  onPrevious,
  onNext,
  onToday,
  onViewChange,
  currentView,
  onCloseModal,
}: UseCalendarShortcutsProps) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Handle keyboard shortcuts
      switch (event.key) {
        case 'ArrowLeft':
          if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            onPrevious();
          }
          break;

        case 'ArrowRight':
          if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            onNext();
          }
          break;

        case 't':
        case 'T':
          if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            onToday();
          }
          break;

        case 'm':
        case 'M':
          if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            onViewChange('month');
          }
          break;

        case 'w':
        case 'W':
          if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            onViewChange('week');
          }
          break;

        case 'd':
        case 'D':
          if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            onViewChange('day');
          }
          break;

        case 'Escape':
          if (onCloseModal) {
            event.preventDefault();
            onCloseModal();
          }
          break;

        default:
          break;
      }
    },
    [onPrevious, onNext, onToday, onViewChange, onCloseModal]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}

