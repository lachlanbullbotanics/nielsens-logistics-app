import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// GET /api/trolleys — trolley balances for all customers (admin only)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 });
  }

  const balances = await prisma.trolleyBalance.findMany({
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { qtyOutstanding: 'desc' },
  });

  const now = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = balances.map((b: any) => ({
    customerId: b.customerId,
    customerName: b.customer.name,
    qtyOutstanding: b.qtyOutstanding,
    lastUpdated: b.lastUpdated.toISOString(),
    daysOutstanding: Math.floor((now - b.lastUpdated.getTime()) / (1000 * 60 * 60 * 24)),
    overdue: (now - b.lastUpdated.getTime()) > 21 * 24 * 60 * 60 * 1000,
  }));

  return NextResponse.json({ ok: true, data: enriched });
}

// POST /api/trolleys — log a trolley event (driver)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  // Only drivers and admins can log trolley events
  if (session.user.role === 'CUSTOMER') {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const { stopId, eventType, qty, notes } = await req.json();
  if (!stopId || !eventType || qty == null) {
    return NextResponse.json({ ok: false, error: 'stopId, eventType, qty required' }, { status: 400 });
  }

  // Validate eventType
  const allowedEventTypes = ['DROP', 'PICKUP'];
  if (!allowedEventTypes.includes(eventType)) {
    return NextResponse.json({ ok: false, error: 'eventType must be DROP or PICKUP' }, { status: 400 });
  }

  // Validate qty
  if (typeof qty !== 'number' || qty <= 0 || qty > 100 || !Number.isInteger(qty)) {
    return NextResponse.json({ ok: false, error: 'qty must be a positive integer (max 100)' }, { status: 400 });
  }

  // Sanitize notes
  const sanitizedNotes = notes ? String(notes).substring(0, 500) : null;

  // IDOR: verify driver is assigned to this stop's run
  const stop = await prisma.stop.findUnique({
    where: { id: stopId },
    select: { customerId: true, run: { select: { driverId: true } } },
  });

  if (!stop) {
    return NextResponse.json({ ok: false, error: 'Stop not found' }, { status: 404 });
  }

  if (session.user.role === 'DRIVER' && stop.run.driverId !== session.user.id) {
    return NextResponse.json({ ok: false, error: 'Forbidden — not your run' }, { status: 403 });
  }

  // Create event
  const event = await prisma.trolleyEvent.create({
    data: {
      stopId,
      driverId: session.user.id,
      eventType,
      qty,
      notes: sanitizedNotes,
    },
  });

  // Update balance — clamp to zero minimum to prevent negative balances
  const delta = eventType === 'DROP' ? qty : -qty;

  // Use a transaction to read-then-write atomically, clamping at zero
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(async (tx: any) => {
    const existing = await tx.trolleyBalance.findUnique({
      where: { customerId: stop.customerId },
    });

    if (existing) {
      const newQty = Math.max(0, existing.qtyOutstanding + delta);
      await tx.trolleyBalance.update({
        where: { customerId: stop.customerId },
        data: { qtyOutstanding: newQty, lastUpdated: new Date() },
      });
    } else {
      await tx.trolleyBalance.create({
        data: {
          customerId: stop.customerId,
          qtyOutstanding: Math.max(0, delta),
          lastUpdated: new Date(),
        },
      });
    }
  });

  return NextResponse.json({ ok: true, data: event }, { status: 201 });
}
