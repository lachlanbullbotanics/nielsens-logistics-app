import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { optimiseRoute } from '@/lib/route-optimizer';

// POST /api/runs/:id/optimize — reorder stops for optimal drive time
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 });
  }

  const run = await prisma.run.findUnique({
    where: { id: params.id },
    include: { stops: { include: { customer: true } } },
  });

  if (!run) return NextResponse.json({ ok: false, error: 'Run not found' }, { status: 404 });
  if (run.status === 'LOCKED' || run.status === 'IN_PROGRESS' || run.status === 'COMPLETED') {
    return NextResponse.json({ ok: false, error: 'Cannot optimise a locked/active/completed run' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const points = run.stops
    .filter((s: any) => s.customer.lat != null && s.customer.lng != null)
    .map((s: any) => ({
      stopId: s.id,
      lat: s.customer.lat!,
      lng: s.customer.lng!,
      customerName: s.customer.name,
    }));

  if (points.length < 2) {
    return NextResponse.json({ ok: false, error: 'Need ≥ 2 geocoded stops to optimise' }, { status: 400 });
  }

  const optimised = optimiseRoute(points);

  // Update stop order in a transaction
  await prisma.$transaction(
    optimised.map((item, idx) =>
      prisma.stop.update({
        where: { id: item.stopId },
        data: { stopOrder: idx + 1, distanceFromPrev: item.distFromPrev },
      })
    )
  );

  return NextResponse.json({
    ok: true,
    data: { totalDistanceKm: optimised.reduce((a, b) => a + (b.distFromPrev ?? 0), 0), stops: optimised },
  });
}
