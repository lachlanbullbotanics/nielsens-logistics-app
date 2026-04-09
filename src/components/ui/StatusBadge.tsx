'use client';

import { statusColour, cn } from '@/lib/utils';

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        statusColour(status),
        className
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
