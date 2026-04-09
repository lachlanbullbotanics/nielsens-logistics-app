'use client';

import { useEffect, useState } from 'react';
import { StatCard, Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatAUD, formatDate } from '@/lib/utils';
import { Package, Route, DollarSign, ShoppingCart } from 'lucide-react';

interface DashboardData {
  bookings: { total: number; draft: number; inTransit: number };
  runs: { upcoming: number; inProgress: number };
  revenue: { thisWeek: number; lastWeek: number };
  trolleys: { outstanding: number; overdue: number };
  recentBookings: Array<{
    id: string;
    customer: { name: string };
    status: string;
    freightCharge: number;
    createdAt: string;
  }>;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    // In a real app these would be separate API calls.
    // For now, we fetch bookings + runs and compute stats client-side.
    async function load() {
      const [bookingsRes, runsRes, trolleysRes] = await Promise.all([
        fetch('/api/bookings?limit=10').then((r) => r.json()),
        fetch('/api/runs').then((r) => r.json()),
        fetch('/api/trolleys').then((r) => r.json()),
      ]);

      const allBookings = bookingsRes.data ?? [];
      const allRuns = runsRes.data ?? [];
      const allTrolleys = trolleysRes.data ?? [];

      setData({
        bookings: {
          total: bookingsRes.meta?.total ?? allBookings.length,
          draft: allBookings.filter((b: { status: string }) => b.status === 'DRAFT').length,
          inTransit: allBookings.filter((b: { status: string }) => b.status === 'IN_TRANSIT').length,
        },
        runs: {
          upcoming: allRuns.filter((r: { status: string }) => ['DRAFT', 'PLANNED', 'LOCKED'].includes(r.status)).length,
          inProgress: allRuns.filter((r: { status: string }) => r.status === 'IN_PROGRESS').length,
        },
        revenue: {
          thisWeek: allBookings.reduce((s: number, b: { freightCharge: number }) => s + b.freightCharge, 0),
          lastWeek: 0,
        },
        trolleys: {
          outstanding: allTrolleys.reduce((s: number, t: { qtyOutstanding: number }) => s + t.qtyOutstanding, 0),
          overdue: allTrolleys.filter((t: { overdue: boolean }) => t.overdue).length,
        },
        recentBookings: allBookings.slice(0, 5),
      });
    }
    load();
  }, []);

  if (!data) {
    return <div className="animate-pulse text-gray-400">Loading dashboard...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">Overview of your logistics operations</p>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Bookings"
          value={data.bookings.total}
          icon={<Package className="h-5 w-5" />}
        />
        <StatCard
          label="Upcoming Runs"
          value={data.runs.upcoming}
          icon={<Route className="h-5 w-5" />}
        />
        <StatCard
          label="Freight Revenue"
          value={formatAUD(data.revenue.thisWeek)}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          label="Trolleys Outstanding"
          value={data.trolleys.outstanding}
          change={
            data.trolleys.overdue > 0
              ? { value: `${data.trolleys.overdue} overdue`, positive: false }
              : undefined
          }
          icon={<ShoppingCart className="h-5 w-5" />}
        />
      </div>

      {/* Recent bookings */}
      <Card title="Recent Bookings" className="mt-8">
        <div className="divide-y divide-gray-100">
          {data.recentBookings.map((booking) => (
            <div key={booking.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{booking.customer?.name ?? 'Unknown'}</p>
                <p className="text-xs text-gray-500">{formatDate(booking.createdAt)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-900">
                  {formatAUD(booking.freightCharge)}
                </span>
                <StatusBadge status={booking.status} />
              </div>
            </div>
          ))}
          {data.recentBookings.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-500">No bookings yet. Seed the database to get started.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
