import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// GET /api/stops?runId=xxx — list stops for a run
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const runId = new URL(req.url).searchParams.get('runId');
  if (!runId) return NextResponse.json({ ok: false, error: 'runId required' }, { status: 400 });

  const stops = await prisma.stop.findMany({
    where: { runId },
    include: {
      customer: { select: { id: true, name: true, address: true, lat: true, lng: true } },
      trolleyEvents: true,
      deliveryConfs: true,
    },
    orderBy: { stopOrder: 'asc' },
  });

  return NextResponse.json({ ok: true, data: stops });
}

// POST /api/stops — add a stop to a run
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 });
  }

  const { runId, customerId } = await req.json();
  if (!runId || !customerId) {
    return NextResponse.json({ ok: false, error: 'runId, customerId required' }, { status: 400 });
  }

  // Check run isn't locked
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) return NextResponse.json({ ok: false, error: 'Run not found' }, { status: 404 });
  if (run.status !== 'DRAFT' && run.status !== 'PLANNED') {
    return NextResponse.json({ ok: false, error: 'Run is locked' }, { status: 400 });
  }

  // Find next stop order
  const maxStop = await prisma.stop.findFirst({
    where: { runId },
    orderBy: { stopOrder: 'desc' },
    select: { stopOrder: true },
  });

  const stop = await prisma.stop.create({
    data: {
      runId,
      customerId,
      stopOrder: (maxStop?.stopOrder ?? 0) + 1,
    },
    include: { customer: { select: { name: true, address: true } } },
  });

  return NextResponse.json({ ok: true, data: stop }, { status: 201 });
}
