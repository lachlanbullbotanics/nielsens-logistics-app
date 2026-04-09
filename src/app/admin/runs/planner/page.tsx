'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, StatCard } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import { Lock, Shuffle, Plus, Trash2, Truck } from 'lucide-react';
import { TruckPackingVisualiser } from '@/components/admin/TruckPackingVisualiser';

interface Run {
  id: string;
  name: string;
  routeType: string;
  scheduledDate: string;
  status: string;
  driver: { id: string; name: string } | null;
  _count: { stops: number; bookings: number };
}

interface Stop {
  id: string;
  stopOrder: number;
  status: string;
  distanceFromPrev: number | null;
  customer: { id: string; name: string; address: string };
}

interface TruckConfig {
  lengthMetres: number;
  widthMetres: number;
  trolleyLength: number;
  trolleyWidth: number;
}

interface Booking {
  id: string;
  customerId: string;
  predictedTrolleys: number | null;
  actualTrolleys: number | null;
  customer: { id: string; name: string };
}

export default function RunPlannerPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [optimising, setOptimising] = useState(false);
  const [locking, setLocking] = useState(false);
  const [showVisualiser, setShowVisualiser] = useState(false);
  const [runBookings, setRunBookings] = useState<Booking[]>([]);
  const [truckConfig] = useState<TruckConfig>({
    lengthMetres: 12.5,
    widthMetres: 2.4,
    trolleyLength: 1.2,
    trolleyWidth: 0.6,
  });

  useEffect(() => {
    fetch('/api/runs').then((r) => r.json()).then((j) => setRuns(j.data ?? []));
  }, []);

  const loadStops = useCallback(async (runId: string) => {
    const res = await fetch(`/api/stops?runId=${runId}`);
    const json = await res.json();
    setStops(json.data ?? []);
  }, []);

  async function selectRun(run: Run) {
    setSelectedRun(run);
    await loadStops(run.id);
    // Load bookings for this run (for visualiser)
    const bRes = await fetch(`/api/bookings?runId=${run.id}&limit=100`);
    const bJson = await bRes.json();
    setRunBookings(bJson.data ?? []);
  }

  async function optimiseRoute() {
    if (!selectedRun) return;
    setOptimising(true);
    await fetch(`/api/runs/${selectedRun.id}/optimize`, { method: 'POST' });
    await loadStops(selectedRun.id);
    setOptimising(false);
  }

  async function lockRun() {
    if (!selectedRun) return;
    setLocking(true);
    const res = await fetch(`/api/runs/${selectedRun.id}/lock`, { method: 'POST' });
    const json = await res.json();
    if (json.ok) {
      setSelectedRun({ ...selectedRun, status: 'LOCKED' });
      // Refresh runs list
      const runsRes = await fetch('/api/runs').then((r) => r.json());
      setRuns(runsRes.data ?? []);
    }
    setLocking(false);
  }

  async function removeStop(stopId: string) {
    await fetch(`/api/stops/${stopId}`, { method: 'DELETE' });
    if (selectedRun) await loadStops(selectedRun.id);
  }

  const totalDistance = stops.reduce((sum, s) => sum + (s.distanceFromPrev ?? 0), 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Run Planner</h1>
      <p className="mt-1 text-sm text-gray-500">Plan routes, optimise stop order, and lock runs for departure</p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Run list */}
        <Card title="Runs" className="lg:col-span-1">
          <div className="space-y-2">
            {runs.map((run) => (
              <button
                key={run.id}
                onClick={() => selectRun(run)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  selectedRun?.id === run.id
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">{run.name}</p>
                  <StatusBadge status={run.status} />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {formatDate(run.scheduledDate)} · {run._count.stops} stops · {run._count.bookings} bookings
                </p>
                <p className="text-xs text-gray-500">
                  Driver: {run.driver?.name ?? 'Unassigned'}
                </p>
              </button>
            ))}
            {runs.length === 0 && (
              <p className="text-center text-sm text-gray-400">No runs found</p>
            )}
          </div>
        </Card>

        {/* Stop order / route detail */}
        <div className="lg:col-span-2">
          {selectedRun ? (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{selectedRun.name}</h2>
                  <p className="text-sm text-gray-500">
                    {selectedRun.routeType.replace(/_/g, ' → ')} · {formatDate(selectedRun.scheduledDate, 'long')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={optimiseRoute}
                    loading={optimising}
                    disabled={selectedRun.status === 'LOCKED' || selectedRun.status === 'COMPLETED'}
                  >
                    <Shuffle className="h-4 w-4" /> Optimise
                  </Button>
                  <Button
                    onClick={lockRun}
                    loading={locking}
                    disabled={selectedRun.status === 'LOCKED' || selectedRun.status === 'COMPLETED'}
                  >
                    <Lock className="h-4 w-4" /> Lock Run
                  </Button>
                </div>
              </div>

              {totalDistance > 0 && (
                <div className="mb-4 grid grid-cols-2 gap-4">
                  <StatCard label="Total Distance" value={`${totalDistance.toFixed(1)} km`} />
                  <StatCard label="Stops" value={stops.length} />
                </div>
              )}

              <Card title="Stop Order">
                <div className="space-y-2">
                  {stops.map((stop, idx) => (
                    <div
                      key={stop.id}
                      className="flex items-center gap-3 rounded-lg border border-gray-200 p-3"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{stop.customer.name}</p>
                        <p className="truncate text-xs text-gray-500">{stop.customer.address}</p>
                      </div>
                      {stop.distanceFromPrev != null && (
                        <span className="text-xs text-gray-400">
                          {stop.distanceFromPrev.toFixed(1)} km
                        </span>
                      )}
                      <StatusBadge status={stop.status} />
                      {selectedRun.status !== 'LOCKED' && selectedRun.status !== 'COMPLETED' && (
                        <button
                          onClick={() => removeStop(stop.id)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {stops.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
                      <Plus className="h-8 w-8" />
                      <p className="text-sm">No stops added yet</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Truck Packing Visualiser */}
              {stops.length > 0 && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowVisualiser(!showVisualiser)}
                    className="mb-3 flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800"
                  >
                    <Truck className="h-4 w-4" />
                    {showVisualiser ? 'Hide' : 'Show'} Truck Packing View
                  </button>
                  {showVisualiser && (
                    <Card title="Truck Packing Layout">
                      <TruckPackingVisualiser
                        truck={truckConfig}
                        allocations={stops.map((stop) => {
                          // Find bookings for this stop's customer
                          const customerBookings = runBookings.filter(
                            (b) => b.customer?.id === stop.customer.id
                          );
                          const trolleyCount = customerBookings.reduce(
                            (sum, b) => sum + (b.predictedTrolleys ?? b.actualTrolleys ?? 1),
                            0
                          ) || 1;
                          return {
                            stopOrder: stop.stopOrder,
                            customerId: stop.customer.id,
                            customerName: stop.customer.name,
                            trolleyCount,
                          };
                        })}
                      />
                    </Card>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-300 text-gray-400">
              Select a run to view its stops
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
