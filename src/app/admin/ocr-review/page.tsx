'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import { ScanSearch, CheckCircle, XCircle, Edit3 } from 'lucide-react';
import toast from 'react-hot-toast';

interface BookingLine {
  id: string;
  species: string;
  potSize: string;
  quantity: number;
  packType: string;
}

interface OcrItem {
  id: string;
  bookingId: string;
  ocrStatus: string;
  senderEmail: string | null;
  errorMessage: string | null;
  rawOcrOutput: string | null;
  parsedJson: unknown;
  createdAt: string;
  booking: {
    id: string;
    status: string;
    customer: { id: string; name: string } | null;
    lines: BookingLine[];
  };
}

interface EditLine {
  species: string;
  potSize: string;
  quantity: number;
  packType: string;
}

export default function OcrReviewPage() {
  const [items, setItems] = useState<OcrItem[]>([]);
  const [selected, setSelected] = useState<OcrItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editLines, setEditLines] = useState<EditLine[]>([]);

  async function loadItems() {
    setLoading(true);
    const res = await fetch('/api/invoices/review');
    const json = await res.json();
    setItems(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadItems();
  }, []);

  async function handleApprove() {
    if (!selected) return;
    setActionLoading('approve');

    // Use existing parsed lines or booking lines
    const lines = selected.booking.lines.length > 0
      ? selected.booking.lines
      : Array.isArray(selected.parsedJson)
        ? selected.parsedJson
        : [];

    const res = await fetch('/api/invoices/review', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: selected.id, action: 'approve', lines }),
    });
    const json = await res.json();

    if (json.ok) {
      toast.success('Invoice approved and booking confirmed');
      setSelected(null);
      await loadItems();
    } else {
      toast.error(json.error ?? 'Failed to approve');
    }
    setActionLoading(null);
  }

  async function handleReject() {
    if (!selected) return;
    setActionLoading('reject');

    const res = await fetch('/api/invoices/review', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: selected.id, action: 'reject' }),
    });
    const json = await res.json();

    if (json.ok) {
      toast.success('Invoice rejected and booking cancelled');
      setSelected(null);
      await loadItems();
    } else {
      toast.error(json.error ?? 'Failed to reject');
    }
    setActionLoading(null);
  }

  function startEditing() {
    if (!selected) return;
    // Pre-fill from existing lines or parsed JSON
    const existingLines = selected.booking.lines.length > 0
      ? selected.booking.lines.map((l) => ({
          species: l.species,
          potSize: l.potSize,
          quantity: l.quantity,
          packType: l.packType,
        }))
      : Array.isArray(selected.parsedJson)
        ? (selected.parsedJson as EditLine[])
        : [];
    setEditLines(existingLines.length > 0 ? existingLines : [{ species: '', potSize: '', quantity: 0, packType: 'TRAY' }]);
    setEditing(true);
  }

  async function handleSaveEdit() {
    if (!selected || editLines.length === 0) return;
    setActionLoading('edit');

    const validLines = editLines.filter((l) => l.species && l.quantity > 0);
    if (validLines.length === 0) {
      toast.error('At least one valid line is required');
      setActionLoading(null);
      return;
    }

    const res = await fetch('/api/invoices/review', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: selected.id, action: 'edit', lines: validLines }),
    });
    const json = await res.json();

    if (json.ok) {
      toast.success(`Saved ${validLines.length} line items`);
      setEditing(false);
      setSelected(null);
      await loadItems();
    } else {
      toast.error(json.error ?? 'Failed to save edits');
    }
    setActionLoading(null);
  }

  function addEditLine() {
    setEditLines([...editLines, { species: '', potSize: '', quantity: 0, packType: 'TRAY' }]);
  }

  function updateEditLine(index: number, field: keyof EditLine, value: string | number) {
    const updated = [...editLines];
    updated[index] = { ...updated[index], [field]: value };
    setEditLines(updated);
  }

  function removeEditLine(index: number) {
    setEditLines(editLines.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">OCR Review Queue</h1>
          <p className="mt-1 text-sm text-gray-500">Invoices that failed automatic parsing and need manual review</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">
          <ScanSearch className="h-4 w-4" />
          {items.length} items need review
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Queue list */}
        <Card title="Pending Reviews">
          {loading ? (
            <div className="py-8 text-center text-gray-400">Loading...</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
              <CheckCircle className="h-10 w-10 text-green-400" />
              <p className="text-sm font-medium text-green-600">All caught up! No invoices need review.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setSelected(item); setEditing(false); }}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selected?.id === item.id
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">
                      {item.booking?.customer?.name ?? 'Unknown Customer'}
                    </p>
                    <StatusBadge status={item.ocrStatus} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {item.senderEmail ? `From: ${item.senderEmail}` : `Created: ${formatDate(item.createdAt)}`}
                  </p>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Review panel */}
        <Card title="Review Details">
          {selected ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Customer</p>
                  <p className="text-sm text-gray-500">{selected.booking?.customer?.name ?? 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Booking ID</p>
                  <p className="text-sm text-gray-500 font-mono">{selected.bookingId.slice(0, 12)}...</p>
                </div>
              </div>

              {selected.senderEmail && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Sender Email</p>
                  <p className="text-sm text-gray-500">{selected.senderEmail}</p>
                </div>
              )}

              {selected.errorMessage && (
                <div className="rounded-lg bg-red-50 p-3">
                  <p className="flex items-center gap-1 text-sm font-medium text-red-700">
                    <XCircle className="h-4 w-4" /> Parse Error
                  </p>
                  <p className="mt-1 text-sm text-red-600">{selected.errorMessage}</p>
                </div>
              )}

              {selected.rawOcrOutput && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Raw OCR Text</p>
                  <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-gray-100 p-3 text-xs text-gray-600">
                    {selected.rawOcrOutput}
                  </pre>
                </div>
              )}

              {/* Existing parsed lines */}
              {selected.booking.lines.length > 0 && !editing && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Parsed Line Items</p>
                  <div className="rounded-lg border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500">Species</th>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500">Pot Size</th>
                          <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500">Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selected.booking.lines.map((l) => (
                          <tr key={l.id}>
                            <td className="px-3 py-1.5">{l.species}</td>
                            <td className="px-3 py-1.5 text-gray-500">{l.potSize}</td>
                            <td className="px-3 py-1.5 text-right font-medium">{l.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Edit mode */}
              {editing && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Edit Line Items</p>
                  <div className="space-y-2">
                    {editLines.map((line, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Species"
                          value={line.species}
                          onChange={(e) => updateEditLine(i, 'species', e.target.value)}
                          className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                        />
                        <input
                          type="text"
                          placeholder="Pot size"
                          value={line.potSize}
                          onChange={(e) => updateEditLine(i, 'potSize', e.target.value)}
                          className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                        />
                        <input
                          type="number"
                          placeholder="Qty"
                          value={line.quantity || ''}
                          onChange={(e) => updateEditLine(i, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-right"
                        />
                        <button onClick={() => removeEditLine(i)} className="text-red-400 hover:text-red-600">
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={addEditLine}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      + Add line
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-4">
                {editing ? (
                  <>
                    <Button
                      variant="primary"
                      onClick={handleSaveEdit}
                      loading={actionLoading === 'edit'}
                      disabled={!!actionLoading}
                    >
                      Save & Approve
                    </Button>
                    <Button variant="secondary" onClick={() => setEditing(false)} disabled={!!actionLoading}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="primary"
                      onClick={handleApprove}
                      loading={actionLoading === 'approve'}
                      disabled={!!actionLoading}
                    >
                      <CheckCircle className="h-4 w-4" /> Approve
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={startEditing}
                      disabled={!!actionLoading}
                    >
                      <Edit3 className="h-4 w-4" /> Edit Manually
                    </Button>
                    <Button
                      variant="danger"
                      onClick={handleReject}
                      loading={actionLoading === 'reject'}
                      disabled={!!actionLoading}
                    >
                      <XCircle className="h-4 w-4" /> Reject
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center text-gray-400">
              Select an item to review
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
