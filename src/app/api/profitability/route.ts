import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import type { ProfitabilityReport } from '@/types';

// GET /api/profitability — profitability reports (admin only)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 });
  }

  const reports = await prisma.runProfitability.findMany({
    include: {
      run: { select: { id: true, name: true, scheduledDate: true } },
    },
    orderBy: { calculatedAt: 'desc' },
    take: 50,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: ProfitabilityReport[] = reports.map((r: any) => ({
    runId: r.runId,
    runName: r.run.name,
    scheduledDate: r.run.scheduledDate.toISOString(),
    totalRevenue: r.totalRevenue,
    fuelCost: r.fuelCost,
    labourCost: r.labourCost,
    otherCosts: r.otherCosts,
    netMargin: r.netMargin,
    marginPercent: r.totalRevenue > 0 ? (r.netMargin / r.totalRevenue) * 100 : 0,
    litresPerKm: r.litresPerKm,
    flagged: r.flagged,
  }));

  return NextResponse.json({ ok: true, data });
}
