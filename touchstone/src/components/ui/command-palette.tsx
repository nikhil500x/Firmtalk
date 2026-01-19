'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Clock, FileText, ClipboardList, Calendar, Receipt, Wallet, Users, HelpCircle } from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CommandAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  keywords: string[];
  category: string;
}

export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const commands: CommandAction[] = [
    {
      id: 'timesheet',
      label: 'Go to Timesheets',
      icon: Clock,
      action: () => {
        router.push('/timesheet');
        onOpenChange(false);
      },
      keywords: ['timesheet', 'time', 'hours', 'log'],
      category: 'Navigation',
    },
    {
      id: 'tasks',
      label: 'Go to Tasks',
      icon: ClipboardList,
      action: () => {
        router.push('/task');
        onOpenChange(false);
      },
      keywords: ['task', 'todo', 'assignments'],
      category: 'Navigation',
    },
    {
      id: 'matters',
      label: 'Go to Matters',
      icon: FileText,
      action: () => {
        router.push('/matter');
        onOpenChange(false);
      },
      keywords: ['matter', 'case', 'client'],
      category: 'Navigation',
    },
    {
      id: 'calendar',
      label: 'Go to Calendar',
      icon: Calendar,
      action: () => {
        router.push('/calendar');
        onOpenChange(false);
      },
      keywords: ['calendar', 'events', 'schedule'],
      category: 'Navigation',
    },
    {
      id: 'invoices',
      label: 'Go to Invoices',
      icon: Receipt,
      action: () => {
        router.push('/invoice');
        onOpenChange(false);
      },
      keywords: ['invoice', 'billing', 'payment'],
      category: 'Navigation',
    },
    {
      id: 'finance',
      label: 'Go to Finance',
      icon: Wallet,
      action: () => {
        router.push('/finance');
        onOpenChange(false);
      },
      keywords: ['finance', 'expense', 'vendor'],
      category: 'Navigation',
    },
    {
      id: 'users',
      label: 'Go to Users',
      icon: Users,
      action: () => {
        router.push('/user');
        onOpenChange(false);
      },
      keywords: ['user', 'people', 'team'],
      category: 'Navigation',
    },
  ];

  const filteredCommands = commands.filter((cmd) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(searchLower) ||
      cmd.keywords.some((kw) => kw.toLowerCase().includes(searchLower))
    );
  });

  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) {
      acc[cmd.category] = [];
    }
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, CommandAction[]>);

  const handleSelect = (command: CommandAction) => {
    command.action();
  };

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
        <Command className="rounded-lg border-none">
          <CommandInput
            placeholder="Type a command or search..."
            value={search}
            onValueChange={setSearch}
            className="h-12"
          />
          <CommandList className="max-h-[400px]">
            <CommandEmpty>No results found.</CommandEmpty>
            {Object.entries(groupedCommands).map(([category, items]) => (
              <CommandGroup key={category} heading={category}>
                {items.map((cmd) => {
                  const Icon = cmd.icon;
                  return (
                    <CommandItem
                      key={cmd.id}
                      value={cmd.label}
                      onSelect={() => handleSelect(cmd)}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <Icon className="w-4 h-4 text-gray-500" />
                      <span>{cmd.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
        <div className="border-t px-4 py-2 text-xs text-gray-500 flex items-center justify-between">
          <span>Press Esc to close</span>
          <span>Use ↑↓ to navigate, Enter to select</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

