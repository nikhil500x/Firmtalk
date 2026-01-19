'use client';

import { Suspense } from 'react';
import CalendarView from './CalendarView';

export default function CalendarViewWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading calendar...</div>}>
      <CalendarView />
    </Suspense>
  );
}

