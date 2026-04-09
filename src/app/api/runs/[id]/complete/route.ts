import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { calculateRunProfitability } from '@/lib/profitability';

// POST /api/runs/:id/complete — mark run complete + calculate profitability
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'DRIVER')) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const run = await prisma.run.findUnique({
    where: { id: params.id },
    include: { bookings: true, fuelLogs: true },
  });

  if (!run) return NextResponse.json({ ok: false, error: 'Run not found' }, { status: 404 });

  // IDOR: drivers can only complete their own runs
  if (session.user.role === 'DRIVER' && run.driverId !== session.user.id) {
    return NextResponse.json({ ok: false, error: 'Forbidden — not your run' }, { status: 403 });
  }

  // Prevent completing already-completed runs
  if (run.status === 'COMPLETED') {
    return NextResponse.json({ ok: false, error: 'Run is already completed' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { odoEnd, driverHours } = body as { odoEnd?: number; driverHours?: number };

  // Validate numeric inputs
  if (odoEnd !== undefined && (typeof odoEnd !== 'number' || odoEnd < 0 || odoEnd > 9999999)) {
    return NextResponse.json({ ok: false, error: 'Invalid odoEnd value' }, { status: 400 });
  }
  if (driverHours !== undefined && (typeof driverHours !== 'number' || driverHours < 0 || driverHours > 24)) {
    return NextResponse.json({ ok: false, error: 'Invalid driverHours value' }, { status: 400 });
  }

  const updated = await prisma.run.update({
    where: { id: params.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      odoEnd: odoEnd ?? run.odoEnd,
      driverHours: driverHours ?? run.driverHours,
    },
  });

  // Calculate and store profitability
  const profit = await calculateRunProfitability(params.id);

  // Mark all bookings delivered
  await prisma.booking.updateMany({
    where: { runId: params.id, status: { not: 'CANCELLED' } },
    data: { status: 'DELIVERED' },
  });

  return NextResponse.json({ ok: true, data: { run: updated, profitability: profit } });
}
