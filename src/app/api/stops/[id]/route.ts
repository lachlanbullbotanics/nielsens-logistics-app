import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// GET /api/stops/:id — fetch a single stop with full details
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  if (session.user.role === 'CUSTOMER') {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const stop = await prisma.stop.findUnique({
    where: { id: params.id },
    include: {
      customer: { select: { id: true, name: true, address: true, lat: true, lng: true } },
      run: {
        select: {
          id: true,
          name: true,
          driverId: true,
          status: true,
          bookings: {
            include: {
              lines: true,
              customer: { select: { id: true, name: true } },
            },
          },
        },
      },
      trolleyEvents: { orderBy: { timestamp: 'desc' } },
      deliveryConfs: { orderBy: { timestamp: 'desc' } },
      pickupConfs: { orderBy: { timestamp: 'desc' } },
    },
  });

  if (!stop) return NextResponse.json({ ok: false, error: 'Stop not found' }, { status: 404 });

  // IDOR: drivers can only see stops on their own runs
  if (session.user.role === 'DRIVER' && stop.run.driverId !== session.user.id) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  // Filter bookings to only those for this stop's customer
  const customerBookings = stop.run.bookings.filter((b: { customer: { id: string } }) => b.customer.id === stop.customer.id);

  return NextResponse.json({
    ok: true,
    data: {
      ...stop,
      bookings: customerBookings,
    },
  });
}

// PATCH /api/stops/:id — update a stop (status, arrival, etc)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  // Fetch the stop with its run to verify ownership
  const stop = await prisma.stop.findUnique({
    where: { id: params.id },
    include: { run: { select: { driverId: true } }, customer: { select: { name: true } } },
  });

  if (!stop) return NextResponse.json({ ok: false, error: 'Stop not found' }, { status: 404 });

  // IDOR protection: drivers can only update stops on their own runs
  if (session.user.role === 'DRIVER' && stop.run.driverId !== session.user.id) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  // Customers cannot update stops
  if (session.user.role === 'CUSTOMER') {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { status, actualArrival, stopOrder } = body;

  // Validate allowed status values
  const allowedStatuses = ['PENDING', 'ARRIVED', 'COMPLETED', 'SKIPPED'];
  if (status && !allowedStatuses.includes(status)) {
    return NextResponse.json({ ok: false, error: 'Invalid status value' }, { status: 400 });
  }

  // Drivers can only update status and actualArrival, not stopOrder
  const data: Record<string, unknown> = {};
  if (status) data.status = status;
  if (actualArrival) data.actualArrival = new Date(actualArrival);
  if (stopOrder !== undefined && session.user.role === 'ADMIN') data.stopOrder = stopOrder;

  const updated = await prisma.stop.update({
    where: { id: params.id },
    data,
    include: { customer: { select: { name: true } } },
  });

  return NextResponse.json({ ok: true, data: updated });
}

// DELETE /api/stops/:id
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 });
  }

  await prisma.stop.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
