import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

/**
 * GET /api/invoices/review — fetch invoices needing manual review (admin only)
 * Returns invoices with FAILED, PENDING, or PROCESSING OCR status.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 });
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      ocrStatus: { in: ['FAILED', 'PENDING', 'PROCESSING'] },
    },
    include: {
      booking: {
        select: {
          id: true,
          status: true,
          customer: { select: { id: true, name: true } },
          lines: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({ ok: true, data: invoices });
}

/**
 * PATCH /api/invoices/review — approve, edit, or reject an invoice (admin only)
 *
 * Body:
 *   { invoiceId, action: 'approve' | 'reject' | 'edit', lines?: ParsedInvoiceLine[] }
 */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 });
  }

  const { invoiceId, action, lines } = await req.json();

  if (!invoiceId || !action) {
    return NextResponse.json({ ok: false, error: 'invoiceId and action required' }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { booking: true },
  });

  if (!invoice) {
    return NextResponse.json({ ok: false, error: 'Invoice not found' }, { status: 404 });
  }

  if (action === 'approve') {
    // Mark as manually reviewed
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { ocrStatus: 'MANUALLY_REVIEWED', reviewedAt: new Date() },
    });

    // If lines were provided (from parsed JSON), create booking lines
    if (lines && Array.isArray(lines) && lines.length > 0) {
      // Clear existing lines
      await prisma.bookingLine.deleteMany({ where: { bookingId: invoice.bookingId } });
      await prisma.bookingLine.createMany({
        data: lines.map((l: { species: string; potSize: string; quantity: number; packType?: string }) => ({
          bookingId: invoice.bookingId,
          species: l.species,
          potSize: l.potSize,
          quantity: l.quantity,
          packType: l.packType ?? 'TRAY',
        })),
      });
    }

    // Confirm the booking
    await prisma.booking.update({
      where: { id: invoice.bookingId },
      data: { status: 'CONFIRMED' },
    });

    return NextResponse.json({ ok: true, data: { invoiceId, action: 'approved' } });
  }

  if (action === 'edit') {
    // Update lines with manual edits
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ ok: false, error: 'lines required for edit action' }, { status: 400 });
    }

    // Clear and re-create booking lines
    await prisma.bookingLine.deleteMany({ where: { bookingId: invoice.bookingId } });
    await prisma.bookingLine.createMany({
      data: lines.map((l: { species: string; potSize: string; quantity: number; packType?: string }) => ({
        bookingId: invoice.bookingId,
        species: l.species,
        potSize: l.potSize,
        quantity: l.quantity,
        packType: l.packType ?? 'TRAY',
      })),
    });

    // Update invoice with new parsed data
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        ocrStatus: 'MANUALLY_REVIEWED',
        parsedJson: lines as any,
        reviewedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, data: { invoiceId, action: 'edited', lineCount: lines.length } });
  }

  if (action === 'reject') {
    // Mark invoice as rejected and cancel the booking
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { ocrStatus: 'FAILED', reviewedAt: new Date(), errorMessage: 'Manually rejected by admin' },
    });

    await prisma.booking.update({
      where: { id: invoice.bookingId },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json({ ok: true, data: { invoiceId, action: 'rejected' } });
  }

  return NextResponse.json({ ok: false, error: 'Invalid action. Use: approve, edit, reject' }, { status: 400 });
}
