import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { predictTrolleys } from '@/lib/trolley-predictor';

// POST /api/ml/predict-trolleys — predict trolley count for a booking
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  // Only admin and drivers need predictions
  if (session.user.role === 'CUSTOMER') {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { invoiceValue, lineCount, potSizeMix, bookingId } = body;

  // Validate inputs to prevent model poisoning
  if (invoiceValue !== undefined) {
    if (typeof invoiceValue !== 'number' || invoiceValue < 0 || invoiceValue > 1_000_000) {
      return NextResponse.json({ ok: false, error: 'invoiceValue must be 0-1000000' }, { status: 400 });
    }
  }
  if (lineCount !== undefined) {
    if (typeof lineCount !== 'number' || lineCount < 0 || lineCount > 500 || !Number.isInteger(lineCount)) {
      return NextResponse.json({ ok: false, error: 'lineCount must be integer 0-500' }, { status: 400 });
    }
  }
  if (potSizeMix !== undefined) {
    if (typeof potSizeMix !== 'object' || potSizeMix === null || Array.isArray(potSizeMix)) {
      return NextResponse.json({ ok: false, error: 'potSizeMix must be an object' }, { status: 400 });
    }
    // Validate each key-value pair
    const allowedSizes = ['50mm', '75mm', '100mm', '140mm', '170mm', '200mm', '250mm', '300mm'];
    for (const [key, val] of Object.entries(potSizeMix as Record<string, unknown>)) {
      if (!allowedSizes.includes(key)) {
        return NextResponse.json({ ok: false, error: `Invalid pot size: ${key}` }, { status: 400 });
      }
      if (typeof val !== 'number' || val < 0 || val > 10000) {
        return NextResponse.json({ ok: false, error: `Invalid quantity for ${key}` }, { status: 400 });
      }
    }
  }

  // Fetch training data — only use validated/admin-approved records
  const trainingData = await prisma.trolleyTrainingData.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  // Filter out outliers from training data to resist poisoning
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = trainingData
    .map((t: any) => ({
      invoiceValue: t.invoiceValue,
      lineCount: t.lineCount,
      potSizeMix: t.potSizeMix as Record<string, number>,
      actualTrolleys: t.actualTrolleys,
    }))
    .filter((r: { invoiceValue: number; lineCount: number; actualTrolleys: number }) =>
      r.invoiceValue >= 0 && r.invoiceValue <= 500_000 &&
      r.lineCount >= 0 && r.lineCount <= 200 &&
      r.actualTrolleys >= 0 && r.actualTrolleys <= 100
    );

  const prediction = await predictTrolleys(
    invoiceValue ?? 0,
    lineCount ?? 0,
    potSizeMix ?? {},
    rows
  );

  // Optionally update the booking with the prediction (admin only for write)
  if (bookingId && session.user.role === 'ADMIN') {
    // Validate bookingId is a string
    if (typeof bookingId !== 'string' || bookingId.length > 100) {
      return NextResponse.json({ ok: false, error: 'Invalid bookingId' }, { status: 400 });
    }
    await prisma.booking.update({
      where: { id: bookingId },
      data: { predictedTrolleys: prediction.predicted },
    });
  }

  return NextResponse.json({
    ok: true,
    data: {
      ...prediction,
      trainingRows: rows.length,
      modelPhase: rows.length >= 200 ? 3 : rows.length >= 50 ? 2 : 1,
    },
  });
}
