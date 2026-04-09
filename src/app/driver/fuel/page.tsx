'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Fuel, Plus, Check } from 'lucide-react';

interface FuelEntry {
  id: string;
  runId: string;
  litres: number;
  pricePerLitre: number;
  odoReading: number;
  timestamp: string;
}

interface Run {
  id: string;
  name: string;
  status: string;
}

export default function FuelLogPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [logs, setLogs] = useState<FuelEntry[]>([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [litres, setLitres] = useState('');
  const [price, setPrice] = useState('');
  const [odo, setOdo] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/runs')
      .then((r) => r.json())
      .then((j) => {
        const data = j.data ?? [];
        setRuns(data);
        const active = data.find((r: Run) => r.status === 'IN_PROGRESS' || r.status === 'LOCKED');
        if (active) setSelectedRunId(active.id);
      });
    fetch('/api/fuel')
      .then((r) => r.json())
      .then((j) => setLogs(j.data ?? []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRunId) return;
    setSaving(true);
    setSuccess(false);

    await fetch('/api/fuel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runId: selectedRunId,
        litres: parseFloat(litres),
        pricePerLitre: parseFloat(price),
        odoReading: parseInt(odo),
      }),
    });

    // Refresh logs
    const res = await fetch('/api/fuel');
    const json = await res.json();
    setLogs(json.data ?? []);

    // Reset form
    setLitres('');
    setPrice('');
    setOdo('');
    setSaving(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Fuel className="h-5 w-5 text-blue-600" /> Log Fuel Entry
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="label">Run</label>
            <select
              value={selectedRunId}
              onChange={(e) => setSelectedRunId(e.target.value)}
              className="input-field"
              required
            >
              <option value="">Select run...</option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Litres</label>
              <input
                type="number"
                step="0.1"
                value={litres}
                onChange={(e) => setLitres(e.target.value)}
                className="input-field"
                placeholder="e.g. 85.5"
                required
              />
            </div>
            <div>
              <label className="label">Price per litre ($)</label>
              <input
                type="number"
                step="0.001"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="input-field"
                placeholder="e.g. 1.899"
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Odometer Reading (km)</label>
            <input
              type="number"
              value={odo}
              onChange={(e) => setOdo(e.target.value)}
              className="input-field"
              placeholder="e.g. 245830"
              required
            />
          </div>

          <Button type="submit" loading={saving} className="w-full" size="lg">
            <Plus className="h-4 w-4" /> Log Fuel
          </Button>

          {success && (
            <p className="flex items-center justify-center gap-1 text-sm text-green-600">
              <Check className="h-4 w-4" /> Fuel entry saved
            </p>
          )}
        </form>
      </div>

      {/* Recent entries */}
      <Card title="Recent Entries">
        <div className="space-y-2">
          {logs.slice(0, 10).map((log) => (
            <div key={log.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{log.litres}L @ ${log.pricePerLitre.toFixed(3)}/L</p>
                <p className="text-xs text-gray-500">ODO: {log.odoReading.toLocaleString()} km</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  ${(log.litres * log.pricePerLitre).toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(log.timestamp).toLocaleDateString('en-AU')}
                </p>
              </div>
            </div>
          ))}
          {logs.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-400">No fuel entries yet</p>
          )}
        </div>
      </Card>
    </div>
  );
}
