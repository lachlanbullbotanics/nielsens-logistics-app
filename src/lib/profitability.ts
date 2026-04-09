/**
 * Profitability Calculator
 *
 * Calculates per-run profitability and flags anomalies.
 * Stores a running baseline of L/km for fleet-wide comparison.
 */

import prisma from './prisma';

export interface ProfitabilityResult {
  totalRevenue: number;
  fuelCost: number;
  labourCost: number;
  otherCosts: number;
  netMargin: number;
  litresPerKm: number | null;
  totalKm: number | null;
  flagged: boolean;
}

/**
 * Calculate and persist profitability for a completed run.
 */
export async function calculateRunProfitability(runId: string): Promise<ProfitabilityResult> {
  const run = await prisma.run.findUniqueOrThrow({
    where: { id: runId },
    include: {
      bookings: { select: { freightCharge: true } },
      fuelLogs: { select: { litres: true, pricePerLitre: true, odoReading: true } },
    },
  });

  // Revenue: sum of freight charges
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalRevenue = run.bookings.reduce((sum: number, b: any) => sum + b.freightCharge, 0);

  // Fuel cost: sum of litres × price
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fuelCost = run.fuelLogs.reduce((sum: number, f: any) => sum + f.litres * f.pricePerLitre, 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalLitres = run.fuelLogs.reduce((sum: number, f: any) => sum + f.litres, 0);

  // Distance from ODO readings
  let totalKm: number | null = null;
  let litresPerKm: number | null = null;
  if (run.odoStart && run.odoEnd && run.odoEnd > run.odoStart) {
    totalKm = run.odoEnd - run.odoStart;
    litresPerKm = totalLitres / totalKm;
  }

  // Labour cost
  const driverHours = run.driverHours ?? 0;
  const driverRate = run.driverRate ?? 35; // Default $35/hr
  const labourCost = driverHours * driverRate;

  // Net margin
  const netMargin = totalRevenue - fuelCost - labourCost;

  // Flag if L/km > 15% above fleet baseline
  const baseline = await getBaselineLitresPerKm();
  const flagged = litresPerKm != null && baseline != null && litresPerKm > baseline * 1.15;

  // Upsert profitability record
  await prisma.runProfitability.upsert({
    where: { runId },
    create: {
      runId,
      totalRevenue,
      fuelCost,
      labourCost,
      otherCosts: 0,
      netMargin,
      litresPerKm,
      totalKm,
      flagged,
    },
    update: {
      totalRevenue,
      fuelCost,
      labourCost,
      netMargin,
      litresPerKm,
      totalKm,
      flagged,
      calculatedAt: new Date(),
    },
  });

  return { totalRevenue, fuelCost, labourCost, otherCosts: 0, netMargin, litresPerKm, totalKm, flagged };
}

/**
 * Fleet-wide baseline L/km from all completed runs with ODO data.
 * Cached for 1 hour.
 */
let baselineCache: { value: number | null; cachedAt: number } = { value: null, cachedAt: 0 };

async function getBaselineLitresPerKm(): Promise<number | null> {
  if (Date.now() - baselineCache.cachedAt < 60 * 60 * 1000 && baselineCache.value != null) {
    return baselineCache.value;
  }

  const result = await prisma.runProfitability.aggregate({
    _avg: { litresPerKm: true },
    where: { litresPerKm: { not: null } },
  });

  baselineCache = { value: result._avg.litresPerKm, cachedAt: Date.now() };
  return baselineCache.value;
}

/**
 * Get weekly/monthly profitability trends.
 */
export async function getProfitabilityTrend(period: 'week' | 'month', count: number = 12) {
  const runs = await prisma.runProfitability.findMany({
    include: { run: { select: { scheduledDate: true, name: true } } },
    orderBy: { calculatedAt: 'desc' },
    take: count * 5, // Over-fetch to cover the period
  });

  // Group by period
  const groups = new Map<string, { revenue: number; cost: number; margin: number; count: number }>();

  for (const r of runs) {
    const date = r.run.scheduledDate;
    const key =
      period === 'week'
        ? `${date.getFullYear()}-W${String(getWeekNumber(date)).padStart(2, '0')}`
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const group = groups.get(key) ?? { revenue: 0, cost: 0, margin: 0, count: 0 };
    group.revenue += r.totalRevenue;
    group.cost += r.fuelCost + r.labourCost + r.otherCosts;
    group.margin += r.netMargin;
    group.count += 1;
    groups.set(key, group);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-count)
    .map(([period, data]) => ({ period, ...data }));
}

function getWeekNumber(d: Date): number {
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
}
