'use client';

import { useEffect, useState } from 'react';
import { Card, StatCard } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { formatAUD, formatDate } from '@/lib/utils';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import type { ProfitabilityReport } from '@/types';

export default function ProfitabilityPage() {
  const [reports, setReports] = useState<ProfitabilityReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/profitability')
      .then((r) => r.json())
      .then((j) => {
        setReports(j.data ?? []);
        setLoading(false);
      });
  }, []);

  const totalRevenue = reports.reduce((s, r) => s + r.totalRevenue, 0);
  const totalMargin = reports.reduce((s, r) => s + r.netMargin, 0);
  const avgMarginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;
  const flaggedCount = reports.filter((r) => r.flagged).length;

  const columns = [
    { key: 'runName', header: 'Run' },
    { key: 'scheduledDate', header: 'Date', render: (r: ProfitabilityReport) => formatDate(r.scheduledDate) },
    {
      key: 'totalRevenue',
      header: 'Revenue',
      render: (r: ProfitabilityReport) => formatAUD(r.totalRevenue),
      className: 'text-right',
    },
    {
      key: 'fuelCost',
      header: 'Fuel',
      render: (r: ProfitabilityReport) => formatAUD(r.fuelCost),
      className: 'text-right',
    },
    {
      key: 'labourCost',
      header: 'Labour',
      render: (r: ProfitabilityReport) => formatAUD(r.labourCost),
      className: 'text-right',
    },
    {
      key: 'netMargin',
      header: 'Net Margin',
      render: (r: ProfitabilityReport) => (
        <span className={r.netMargin < 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
          {formatAUD(r.netMargin)}
        </span>
      ),
      className: 'text-right',
    },
    {
      key: 'marginPercent',
      header: 'Margin %',
      render: (r: ProfitabilityReport) => `${r.marginPercent.toFixed(1)}%`,
      className: 'text-right',
    },
    {
      key: 'litresPerKm',
      header: 'L/km',
      render: (r: ProfitabilityReport) => (
        <span className={r.flagged ? 'text-red-600 font-medium' : ''}>
          {r.litresPerKm?.toFixed(2) ?? '—'}
          {r.flagged && <AlertTriangle className="ml-1 inline h-3 w-3" />}
        </span>
      ),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Profitability</h1>
      <p className="mt-1 text-sm text-gray-500">Per-run margins, fuel efficiency, and cost analysis</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Revenue" value={formatAUD(totalRevenue)} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard label="Total Margin" value={formatAUD(totalMargin)} />
        <StatCard label="Avg Margin %" value={`${avgMarginPct.toFixed(1)}%`} />
        <StatCard
          label="Flagged Runs"
          value={flaggedCount}
          change={flaggedCount > 0 ? { value: '>15% above baseline L/km', positive: false } : undefined}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      <Card title="Run Profitability" className="mt-8">
        {loading ? (
          <div className="py-8 text-center text-gray-400">Loading profitability data...</div>
        ) : (
          <DataTable
            columns={columns}
            data={reports}
            emptyMessage="No profitability data yet. Complete runs to see reports."
          />
        )}
      </Card>
    </div>
  );
}
