'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatCard } from '@/components/ui/Card';
import { formatAUD, formatDate } from '@/lib/utils';
import { Package, Truck, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Booking {
  id: string;
  status: string;
  freightCharge: number;
  invoiceValue: number;
  run: { name: string; scheduledDate: string } | null;
  lines: Array<{ species: string; quantity: number }>;
  createdAt: string;
}

export default function CustomerDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    fetch('/api/bookings?limit=10')
      .then((r) => r.json())
      .then((j) => setBookings(j.data ?? []));
  }, []);

  const activeBookings = bookings.filter((b) => !['DELIVERED', 'CANCELLED'].includes(b.status));
  const totalSpent = bookings.reduce((s, b) => s + b.freightCharge, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-sm text-gray-500">Track your freight bookings and upload invoices</p>
        </div>
        <Link href="/customer/bookings">
          <Button>
            <Upload className="h-4 w-4" /> New Booking
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active Bookings" value={activeBookings.length} icon={<Package className="h-5 w-5" />} />
        <StatCard label="Total Bookings" value={bookings.length} icon={<Truck className="h-5 w-5" />} />
        <StatCard label="Total Freight" value={formatAUD(totalSpent)} />
      </div>

      {/* Recent bookings */}
      <div className="rounded-xl bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="font-semibold text-gray-900">Recent Bookings</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {bookings.map((booking) => (
            <div key={booking.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {booking.run?.name ?? 'Unassigned'}
                </p>
                <p className="text-xs text-gray-500">
                  {booking.lines?.length ?? 0} line items · {formatDate(booking.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{formatAUD(booking.freightCharge)}</span>
                <StatusBadge status={booking.status} />
              </div>
            </div>
          ))}
          {bookings.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">
              No bookings yet. Upload an invoice or create a booking to get started.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
