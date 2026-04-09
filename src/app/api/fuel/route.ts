import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// GET /api/fuel?runId=xxx
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const runId = new URL(req.url).searchParams.get('runId');
  const where: Record<string, unknown> = {};
  if (runId) where.runId = runId;

  // IDOR: drivers only see their own fuel logs
  if (session.user.role === 'DRIVER') where.driverId = session.user.id;

  // Customers cannot access fuel logs
  if (session.user.role === 'CUSTOMER') {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const logs = await prisma.fuelLog.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: 100,
  });

  return NextResponse.json({ ok: true, data: logs });
}

// POST /api/fuel — log a fuel entry
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  // Only drivers and admins can log fuel
  if (session.user.role === 'CUSTOMER') {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const { runId, litres, pricePerLitre, odoReading } = await req.json();
  if (!runId || litres == null || pricePerLitre == null || odoReading == null) {
    return NextResponse.json({ ok: false, error: 'runId, litres, pricePerLitre, odoReading required' }, { status: 400 });
  }

  // Input validation on financial fields
  if (typeof litres !== 'number' || litres <= 0 || litres > 10000) {
    return NextResponse.json({ ok: false, error: 'litres must be between 0 and 10000' }, { status: 400 });
  }
  if (typeof pricePerLitre !== 'number' || pricePerLitre <= 0 || pricePerLitre > 50) {
    return NextResponse.json({ ok: false, error: 'pricePerLitre must be between 0 and 50' }, { status: 400 });
  }
  if (typeof odoReading !== 'number' || odoReading < 0 || odoReading > 9999999) {
    return NextResponse.json({ ok: false, error: 'Invalid odoReading' }, { status: 400 });
  }

  // IDOR: verify driver is assigned to this run
  if (session.user.role === 'DRIVER') {
    const run = await prisma.run.findUnique({ where: { id: runId }, select: { driverId: true } });
    if (!run || run.driverId !== session.user.id) {
      return NextResponse.json({ ok: false, error: 'Forbidden — not your run' }, { status: 403 });
    }
  }

  const log = await prisma.fuelLog.create({
    data: {
      runId,
      driverId: session.user.id,
      litres,
      pricePerLitre,
      odoReading,
    },
  });

  return NextResponse.json({ ok: true, data: log }, { status: 201 });
}
