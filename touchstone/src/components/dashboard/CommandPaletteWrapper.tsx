'use client';

import React, { useState } from 'react';
import CommandPalette from '@/components/ui/command-palette';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export default function CommandPaletteWrapper() {
  const [isOpen, setIsOpen] = useState(false);

  useKeyboardShortcuts([
    {
      key: 'k',
      metaKey: true,
      handler: () => setIsOpen(true),
    },
    {
      key: 'Escape',
      handler: () => setIsOpen(false),
    },
  ]);

  return <CommandPalette open={isOpen} onOpenChange={setIsOpen} />;
}

