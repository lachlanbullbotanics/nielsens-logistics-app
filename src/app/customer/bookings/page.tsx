'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Upload, FileText, CheckCircle, AlertCircle, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface BookingLine {
  species: string;
  potSize: string;
  quantity: number;
  packType: string;
}

export default function CustomerBookingsPage() {
  // OCR upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    lines?: Array<{ species: string; potSize: string; quantity: number }>;
    bookingId?: string;
    error?: string;
  } | null>(null);

  // Manual booking state
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualLines, setManualLines] = useState<BookingLine[]>([
    { species: '', potSize: '', quantity: 0, packType: 'TRAY' },
  ]);
  const [bookingNotes, setBookingNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/invoices/ocr', {
      method: 'POST',
      body: formData,
    });

    const json = await res.json();
    setResult({
      ok: json.ok,
      lines: json.data?.lines,
      bookingId: json.data?.bookingId,
      error: json.error ?? json.data?.error,
    });

    setUploading(false);
  }

  function addLine() {
    setManualLines([...manualLines, { species: '', potSize: '', quantity: 0, packType: 'TRAY' }]);
  }

  function updateLine(index: number, field: keyof BookingLine, value: string | number) {
    const updated = [...manualLines];
    updated[index] = { ...updated[index], [field]: value };
    setManualLines(updated);
  }

  function removeLine(index: number) {
    if (manualLines.length <= 1) return;
    setManualLines(manualLines.filter((_, i) => i !== index));
  }

  async function handleManualSubmit() {
    const validLines = manualLines.filter((l) => l.species.trim() && l.quantity > 0);
    if (validLines.length === 0) {
      toast.error('Please add at least one line item with a species and quantity');
      return;
    }

    setSubmitting(true);

    // We need the customer's own ID — the API will verify from session
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: '_self', // The API will resolve from session for CUSTOMER role
        notes: bookingNotes || null,
        lines: validLines.map((l) => ({
          species: l.species.trim(),
          potSize: l.potSize.trim() || 'Standard',
          quantity: l.quantity,
          packType: l.packType,
        })),
      }),
    });

    const json = await res.json();

    if (json.ok) {
      toast.success('Booking submitted! Nielsen\'s will review and confirm.');
      setManualLines([{ species: '', potSize: '', quantity: 0, packType: 'TRAY' }]);
      setBookingNotes('');
      setShowManualForm(false);
    } else {
      toast.error(json.error ?? 'Failed to create booking');
    }

    setSubmitting(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Submit a Booking</h1>
        <p className="text-sm text-gray-500">Upload your invoice PDF or create a booking manually</p>
      </div>

      {/* Upload area */}
      <Card title="Upload Invoice">
        <div className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 p-8 transition-colors hover:border-blue-300">
            <Upload className="h-10 w-10 text-gray-400" />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">
                {file ? file.name : 'Drop your invoice PDF here'}
              </p>
              <p className="text-xs text-gray-500">PDF files up to 10MB</p>
            </div>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>

          <Button onClick={handleUpload} loading={uploading} disabled={!file} className="w-full">
            <FileText className="h-4 w-4" /> Process Invoice
          </Button>
        </div>
      </Card>

      {/* Upload result */}
      {result && (
        <Card title="Processing Result">
          {result.ok && result.lines && result.lines.length > 0 ? (
            <div>
              <div className="mb-4 flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Invoice parsed successfully — {result.lines.length} line items extracted</span>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Species</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Pot Size</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.lines.map((line, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 text-sm text-gray-900">{line.species}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{line.potSize}</td>
                        <td className="px-4 py-2 text-right text-sm font-medium text-gray-900">{line.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-4 text-sm text-gray-500">
                Booking ID: <code className="rounded bg-gray-100 px-1">{result.bookingId}</code> — your booking has been created as a draft. Nielsen&apos;s will review and confirm.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">{result.error ?? 'Failed to parse invoice. It has been queued for manual review.'}</span>
            </div>
          )}
        </Card>
      )}

      {/* Manual booking form */}
      <Card title="Or Book Manually">
        {!showManualForm ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Create a booking by entering your line items directly, or email your invoice to{' '}
              <strong>bookings@nielsens-app.com</strong>.
            </p>
            <Button variant="secondary" onClick={() => setShowManualForm(true)} className="w-full">
              <Plus className="h-4 w-4" /> Create Manual Booking
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">Line Items</p>

            <div className="space-y-3">
              {manualLines.map((line, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Species (e.g. Grevillea)"
                      value={line.species}
                      onChange={(e) => updateLine(i, 'species', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="w-28">
                    <input
                      type="text"
                      placeholder="Pot size"
                      value={line.potSize}
                      onChange={(e) => updateLine(i, 'potSize', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="w-20">
                    <input
                      type="number"
                      placeholder="Qty"
                      min="1"
                      value={line.quantity || ''}
                      onChange={(e) => updateLine(i, 'quantity', parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-right focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <select
                    value={line.packType}
                    onChange={(e) => updateLine(i, 'packType', e.target.value)}
                    className="w-24 rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="TRAY">Tray</option>
                    <option value="LOOSE">Loose</option>
                    <option value="PALLET">Pallet</option>
                  </select>
                  <button
                    onClick={() => removeLine(i)}
                    disabled={manualLines.length <= 1}
                    className="mt-2 text-gray-400 hover:text-red-500 disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addLine}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
            >
              <Plus className="h-3 w-3" /> Add another line
            </button>

            <div>
              <label className="text-sm font-medium text-gray-700">Notes (optional)</label>
              <textarea
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                placeholder="Any special instructions..."
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleManualSubmit} loading={submitting} className="flex-1">
                Submit Booking
              </Button>
              <Button variant="secondary" onClick={() => setShowManualForm(false)} disabled={submitting}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
