'use client';

import { useEffect, useCallback } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  handler: () => void;
  description?: string;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        (target as HTMLElement).closest('[role="textbox"]')
      ) {
        return;
      }

      // Check each shortcut
      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrlKey === undefined ? true : (shortcut.ctrlKey ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey);
        const metaMatch = shortcut.metaKey === undefined ? true : (shortcut.metaKey ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey);
        const shiftMatch = shortcut.shiftKey === undefined ? true : (shortcut.shiftKey === event.shiftKey);
        const altMatch = shortcut.altKey === undefined ? true : (shortcut.altKey === event.altKey);

        if (keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch) {
          event.preventDefault();
          shortcut.handler();
          break;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}

// Global keyboard shortcuts registry
const globalShortcuts: Map<string, () => void> = new Map();

export function registerGlobalShortcut(key: string, handler: () => void) {
  globalShortcuts.set(key, handler);
}

export function unregisterGlobalShortcut(key: string) {
  globalShortcuts.delete(key);
}

export function useGlobalKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        (target as HTMLElement).closest('[role="textbox"]')
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      const handler = globalShortcuts.get(key);
      if (handler) {
        event.preventDefault();
        handler();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}

