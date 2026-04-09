'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { formatAUD, formatDate } from '@/lib/utils';

interface Booking {
  id: string;
  customer: { id: string; name: string };
  run: { id: string; name: string } | null;
  status: string;
  freightCharge: number;
  invoiceValue: number;
  predictedTrolleys: number | null;
  lines: Array<{ species: string; potSize: string; quantity: number }>;
  invoice: { ocrStatus: string } | null;
  createdAt: string;
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/bookings?${params}`);
      const json = await res.json();
      setBookings(json.data ?? []);
      setLoading(false);
    }
    load();
  }, [statusFilter]);

  const columns = [
    { key: 'customer', header: 'Customer', render: (r: Booking) => r.customer?.name ?? '—' },
    { key: 'run', header: 'Run', render: (r: Booking) => r.run?.name ?? 'Unassigned' },
    {
      key: 'status',
      header: 'Status',
      render: (r: Booking) => <StatusBadge status={r.status} />,
    },
    {
      key: 'freightCharge',
      header: 'Freight',
      render: (r: Booking) => formatAUD(r.freightCharge),
      className: 'text-right',
    },
    {
      key: 'invoiceValue',
      header: 'Invoice',
      render: (r: Booking) => formatAUD(r.invoiceValue),
      className: 'text-right',
    },
    {
      key: 'lines',
      header: 'Lines',
      render: (r: Booking) => r.lines?.length ?? 0,
      className: 'text-center',
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (r: Booking) => formatDate(r.createdAt),
    },
  ];

  const statuses = ['', 'DRAFT', 'CONFIRMED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="mt-1 text-sm text-gray-500">Manage freight bookings across all customers</p>
        </div>
        <Button>New Booking</Button>
      </div>

      <Card className="mt-6">
        <div className="mb-4 flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Filter:</label>
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-8 text-center text-gray-400">Loading bookings...</div>
        ) : (
          <DataTable<Booking> columns={columns} data={bookings} />
        )}
      </Card>
    </div>
  );
}
