import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// GET /api/runs — list runs
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const driverId = url.searchParams.get('driverId');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  const where: Record<string, unknown> = {};
  if (session.user.role === 'DRIVER') where.driverId = session.user.id;
  if (status) where.status = status;
  if (driverId && session.user.role === 'ADMIN') where.driverId = driverId;
  if (from || to) {
    where.scheduledDate = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const runs = await prisma.run.findMany({
    where,
    include: {
      driver: { select: { id: true, name: true } },
      _count: { select: { stops: true, bookings: true } },
    },
    orderBy: { scheduledDate: 'desc' },
    take: 50,
  });

  return NextResponse.json({ ok: true, data: runs });
}

// POST /api/runs — create a new run (admin only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 });
  }

  const body = await req.json();
  const { name, routeType, scheduledDate, driverId, notes } = body;

  if (!name || !routeType || !scheduledDate) {
    return NextResponse.json({ ok: false, error: 'name, routeType, scheduledDate required' }, { status: 400 });
  }

  const run = await prisma.run.create({
    data: {
      name,
      routeType,
      scheduledDate: new Date(scheduledDate),
      driverId: driverId ?? null,
      notes: notes ?? null,
      status: 'DRAFT',
    },
  });

  return NextResponse.json({ ok: true, data: run }, { status: 201 });
}
