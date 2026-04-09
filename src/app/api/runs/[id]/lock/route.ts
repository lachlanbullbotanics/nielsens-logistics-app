import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// POST /api/runs/:id/lock — lock run for departure
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 });
  }

  const run = await prisma.run.findUnique({ where: { id: params.id }, include: { stops: true } });
  if (!run) return NextResponse.json({ ok: false, error: 'Run not found' }, { status: 404 });

  if (run.stops.length === 0) {
    return NextResponse.json({ ok: false, error: 'Cannot lock a run with no stops' }, { status: 400 });
  }
  if (!run.driverId) {
    return NextResponse.json({ ok: false, error: 'Assign a driver before locking' }, { status: 400 });
  }

  const updated = await prisma.run.update({
    where: { id: params.id },
    data: { status: 'LOCKED', lockedAt: new Date() },
  });

  // Move all bookings on this run to CONFIRMED
  await prisma.booking.updateMany({
    where: { runId: params.id, status: 'DRAFT' },
    data: { status: 'CONFIRMED' },
  });

  return NextResponse.json({ ok: true, data: updated });
}
