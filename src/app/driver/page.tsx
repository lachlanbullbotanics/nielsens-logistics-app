'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDate } from '@/lib/utils';
import { MapPin, ChevronRight, Package } from 'lucide-react';

interface Run {
  id: string;
  name: string;
  routeType: string;
  scheduledDate: string;
  status: string;
  _count: { stops: number; bookings: number };
}

interface Stop {
  id: string;
  stopOrder: number;
  status: string;
  customer: { id: string; name: string; address: string };
  deliveryConfs: Array<{ id: string }>;
}

export default function DriverRunPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [activeRun, setActiveRun] = useState<Run | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);

  useEffect(() => {
    fetch('/api/runs')
      .then((r) => r.json())
      .then((json) => {
        const allRuns = json.data ?? [];
        setRuns(allRuns);
        // Auto-select the first active/locked run
        const active = allRuns.find(
          (r: Run) => r.status === 'IN_PROGRESS' || r.status === 'LOCKED'
        );
        if (active) {
          setActiveRun(active);
          loadStops(active.id);
        } else if (allRuns.length > 0) {
          setActiveRun(allRuns[0]);
          loadStops(allRuns[0].id);
        }
      });
  }, []);

  async function loadStops(runId: string) {
    const res = await fetch(`/api/stops?runId=${runId}`);
    const json = await res.json();
    setStops(json.data ?? []);
  }

  if (!activeRun) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Package className="h-12 w-12" />
        <p className="mt-4 text-lg font-medium">No runs assigned</p>
        <p className="text-sm">Check back later for your next run.</p>
      </div>
    );
  }

  const completedStops = stops.filter((s) => s.status === 'COMPLETED').length;

  return (
    <div className="space-y-4">
      {/* Run header */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{activeRun.name}</h2>
            <p className="text-sm text-gray-500">{formatDate(activeRun.scheduledDate, 'long')}</p>
          </div>
          <StatusBadge status={activeRun.status} />
        </div>
        <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
          <span>{stops.length} stops</span>
          <span>·</span>
          <span>{completedStops}/{stops.length} completed</span>
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${stops.length > 0 ? (completedStops / stops.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Stop list */}
      <div className="space-y-2">
        {stops.map((stop) => (
          <Link
            key={stop.id}
            href={`/driver/stop/${stop.id}`}
            className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm transition-colors active:bg-gray-50"
          >
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                stop.status === 'COMPLETED'
                  ? 'bg-green-100 text-green-700'
                  : stop.status === 'PENDING'
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-blue-100 text-blue-700'
              )}
            >
              {stop.stopOrder}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900">{stop.customer.name}</p>
              <p className="flex items-center gap-1 truncate text-xs text-gray-500">
                <MapPin className="h-3 w-3" />
                {stop.customer.address}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={stop.status} />
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
