'use client';

import { useEffect, useState } from 'react';
import { Card, StatCard } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { formatDate } from '@/lib/utils';
import { ShoppingCart, AlertTriangle } from 'lucide-react';
import type { TrolleyInventoryRow } from '@/types';

export default function TrolleyInventoryPage() {
  const [data, setData] = useState<TrolleyInventoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/trolleys')
      .then((r) => r.json())
      .then((j) => {
        setData(j.data ?? []);
        setLoading(false);
      });
  }, []);

  const totalOutstanding = data.reduce((s, d) => s + d.qtyOutstanding, 0);
  const overdueCount = data.filter((d) => d.overdue).length;

  const columns = [
    { key: 'customerName', header: 'Customer' },
    {
      key: 'qtyOutstanding',
      header: 'Trolleys Out',
      render: (r: TrolleyInventoryRow) => (
        <span className={r.qtyOutstanding > 5 ? 'font-bold text-amber-600' : ''}>{r.qtyOutstanding}</span>
      ),
      className: 'text-center',
    },
    {
      key: 'daysOutstanding',
      header: 'Days',
      render: (r: TrolleyInventoryRow) => (
        <span className={r.overdue ? 'font-bold text-red-600' : ''}>{r.daysOutstanding}</span>
      ),
      className: 'text-center',
    },
    {
      key: 'overdue',
      header: 'Status',
      render: (r: TrolleyInventoryRow) =>
        r.overdue ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            <AlertTriangle className="h-3 w-3" /> Overdue
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            OK
          </span>
        ),
    },
    {
      key: 'lastUpdated',
      header: 'Last Updated',
      render: (r: TrolleyInventoryRow) => formatDate(r.lastUpdated),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Trolley Inventory</h1>
      <p className="mt-1 text-sm text-gray-500">Track trolleys outstanding per customer. Overdue = 3+ weeks.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Outstanding" value={totalOutstanding} icon={<ShoppingCart className="h-5 w-5" />} />
        <StatCard label="Customers With Trolleys" value={data.filter((d) => d.qtyOutstanding > 0).length} />
        <StatCard
          label="Overdue"
          value={overdueCount}
          change={overdueCount > 0 ? { value: '3+ weeks outstanding', positive: false } : undefined}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      <Card title="Trolley Balances by Customer" className="mt-8">
        {loading ? (
          <div className="py-8 text-center text-gray-400">Loading trolley data...</div>
        ) : (
          <DataTable
            columns={columns}
            data={data}
            emptyMessage="No trolley balances recorded yet."
          />
        )}
      </Card>
    </div>
  );
}
