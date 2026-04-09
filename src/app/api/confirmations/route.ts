import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

/**
 * POST /api/confirmations — create delivery or pickup confirmation
 *
 * Body:
 *   { type: 'delivery' | 'pickup', stopId, photos?: string[], notes?: string,
 *     bookingId?: string, linesChecked?: string[], trolleysLoaded?: number }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  if (session.user.role === 'CUSTOMER') {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const { type, stopId, photos, notes, bookingId, linesChecked, trolleysLoaded } = await req.json();

  if (!type || !stopId) {
    return NextResponse.json({ ok: false, error: 'type and stopId required' }, { status: 400 });
  }

  // Verify stop exists and driver has access
  const stop = await prisma.stop.findUnique({
    where: { id: stopId },
    include: { run: { select: { driverId: true } } },
  });

  if (!stop) return NextResponse.json({ ok: false, error: 'Stop not found' }, { status: 404 });

  if (session.user.role === 'DRIVER' && stop.run.driverId !== session.user.id) {
    return NextResponse.json({ ok: false, error: 'Forbidden — not your run' }, { status: 403 });
  }

  if (type === 'delivery') {
    const confirmation = await prisma.deliveryConfirmation.create({
      data: {
        stopId,
        driverId: session.user.id,
        photos: photos ?? [],
        notes: notes ? String(notes).substring(0, 2000) : null,
      },
    });
    return NextResponse.json({ ok: true, data: confirmation }, { status: 201 });
  }

  if (type === 'pickup') {
    if (!bookingId) {
      return NextResponse.json({ ok: false, error: 'bookingId required for pickup confirmation' }, { status: 400 });
    }

    const confirmation = await prisma.pickupConfirmation.create({
      data: {
        stopId,
        bookingId,
        driverId: session.user.id,
        linesChecked: linesChecked ?? [],
        trolleysLoaded: trolleysLoaded ?? 0,
      },
    });
    return NextResponse.json({ ok: true, data: confirmation }, { status: 201 });
  }

  return NextResponse.json({ ok: false, error: 'type must be delivery or pickup' }, { status: 400 });
}
