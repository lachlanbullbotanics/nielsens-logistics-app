'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Camera, Check, ShoppingCart, ArrowLeft } from 'lucide-react';

interface BookingLine {
  id: string;
  species: string;
  potSize: string;
  quantity: number;
  packType: string;
}

interface StopBooking {
  id: string;
  status: string;
  lines: BookingLine[];
  customer: { id: string; name: string };
}

interface StopDetail {
  id: string;
  stopOrder: number;
  status: string;
  customer: { id: string; name: string; address: string };
  trolleyEvents: Array<{ eventType: string; qty: number }>;
  deliveryConfs: Array<{ id: string; photos: string[]; notes: string }>;
  pickupConfs: Array<{ id: string }>;
  runId: string;
  bookings: StopBooking[];
  run: { id: string; name: string; driverId: string; status: string };
}

export default function StopDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [stop, setStop] = useState<StopDetail | null>(null);
  const [trolleyDrop, setTrolleyDrop] = useState(0);
  const [trolleyPickup, setTrolleyPickup] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Fetch stop details via dedicated endpoint (single query, no N+1)
    async function load() {
      const res = await fetch(`/api/stops/${params.id}`);
      const json = await res.json();
      if (json.ok && json.data) {
        setStop(json.data);
      }
    }
    load();
  }, [params.id]);

  async function markArrived() {
    if (!stop) return;
    await fetch(`/api/stops/${stop.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ARRIVED', actualArrival: new Date().toISOString() }),
    });
    setStop({ ...stop, status: 'ARRIVED' });
  }

  async function confirmDelivery() {
    if (!stop) return;
    setSaving(true);

    // Log trolley events
    if (trolleyDrop > 0) {
      await fetch('/api/trolleys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stopId: stop.id, eventType: 'DROP', qty: trolleyDrop }),
      });
    }
    if (trolleyPickup > 0) {
      await fetch('/api/trolleys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stopId: stop.id, eventType: 'PICKUP', qty: trolleyPickup }),
      });
    }

    // Create delivery confirmation record with photos and notes
    await fetch('/api/confirmations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'delivery',
        stopId: stop.id,
        photos,
        notes: notes || null,
      }),
    });

    // Create pickup confirmation records for each booking at this stop
    const checkedLineIds = Object.entries(checklist)
      .filter(([, checked]) => checked)
      .map(([key]) => key.split('-')[1]); // Extract line IDs

    for (const booking of stop.bookings ?? []) {
      await fetch('/api/confirmations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'pickup',
          stopId: stop.id,
          bookingId: booking.id,
          linesChecked: checkedLineIds,
          trolleysLoaded: trolleyDrop,
        }),
      });
    }

    // Mark stop completed
    await fetch(`/api/stops/${stop.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COMPLETED' }),
    });

    setSaving(false);
    router.push('/driver');
  }

  if (!stop) {
    return <div className="py-12 text-center text-gray-400">Loading stop details...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button onClick={() => router.push('/driver')} className="flex items-center gap-1 text-sm text-gray-500">
        <ArrowLeft className="h-4 w-4" /> Back to run
      </button>

      {/* Stop header */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              {stop.stopOrder}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{stop.customer.name}</h2>
              <p className="text-sm text-gray-500">{stop.customer.address}</p>
            </div>
          </div>
          <StatusBadge status={stop.status} />
        </div>

        {stop.status === 'PENDING' && (
          <Button onClick={markArrived} className="mt-4 w-full">
            Mark Arrived
          </Button>
        )}
      </div>

      {/* Loading checklist — built from actual booking lines */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-semibold text-gray-900">Loading Checklist</h3>
        <div className="space-y-2">
          {(stop.bookings ?? []).flatMap((booking) =>
            booking.lines.map((line) => {
              const key = `${booking.id}-${line.id}`;
              const label = `${line.species} — ${line.potSize} × ${line.quantity} (${line.packType})`;
              return (
                <label
                  key={key}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={checklist[key] ?? false}
                    onChange={(e) => setChecklist({ ...checklist, [key]: e.target.checked })}
                    className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={`text-sm ${checklist[key] ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                    {label}
                  </span>
                </label>
              );
            })
          )}
          {(stop.bookings ?? []).length === 0 && (
            <p className="text-sm text-gray-400 text-center py-2">No booking lines for this stop</p>
          )}
        </div>
      </div>

      {/* Trolley counts */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
          <ShoppingCart className="h-4 w-4" /> Trolley Count
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Dropped Off</label>
            <input
              type="number"
              min="0"
              value={trolleyDrop}
              onChange={(e) => setTrolleyDrop(parseInt(e.target.value) || 0)}
              className="input-field text-center text-lg"
            />
          </div>
          <div>
            <label className="label">Picked Up</label>
            <input
              type="number"
              min="0"
              value={trolleyPickup}
              onChange={(e) => setTrolleyPickup(parseInt(e.target.value) || 0)}
              className="input-field text-center text-lg"
            />
          </div>
        </div>
      </div>

      {/* Photo upload */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
          <Camera className="h-4 w-4" /> Photos ({photos.length} attached)
        </h3>

        {/* Photo previews */}
        {photos.length > 0 && (
          <div className="mb-3 grid grid-cols-3 gap-2">
            {photos.map((photo, i) => (
              <div key={i} className="relative">
                <img src={photo} alt={`Photo ${i + 1}`} className="h-20 w-full rounded-lg object-cover" />
                <button
                  onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                  className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-6 text-gray-400 transition-colors hover:border-blue-300 hover:text-blue-500">
          <Camera className="h-8 w-8" />
          <span className="text-sm">Tap to take or upload photos</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={async (e) => {
              const files = Array.from(e.target.files ?? []);
              for (const file of files) {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const dataUrl = reader.result as string;
                  setPhotos((prev) => [...prev, dataUrl]);
                };
                reader.readAsDataURL(file);
              }
              // Reset input so same file can be re-selected
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {/* Notes */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-semibold text-gray-900">Notes</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any issues or comments..."
          className="input-field min-h-[80px] resize-none"
        />
      </div>

      {/* Confirm delivery */}
      <Button
        onClick={confirmDelivery}
        loading={saving}
        disabled={stop.status === 'COMPLETED'}
        className="w-full"
        size="lg"
      >
        <Check className="h-5 w-5" /> Confirm Delivery
      </Button>
    </div>
  );
}
