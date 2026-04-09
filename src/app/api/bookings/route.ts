import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import type { ApiResponse } from '@/types';

// GET /api/bookings — list bookings (admin: all, customer: own, driver: assigned run)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const runId = url.searchParams.get('runId');
  const status = url.searchParams.get('status');
  const customerId = url.searchParams.get('customerId');
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') ?? '25'));

  // Build where clause based on role
  const where: Record<string, unknown> = {};
  if (session.user.role === 'CUSTOMER') {
    const customer = await prisma.customer.findUnique({ where: { userId: session.user.id } });
    if (!customer) return NextResponse.json({ ok: false, error: 'No customer profile' }, { status: 403 });
    where.customerId = customer.id;
  }
  if (runId) where.runId = runId;
  if (status) where.status = status;
  if (customerId && session.user.role === 'ADMIN') where.customerId = customerId;

  const [total, bookings] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        run: { select: { id: true, name: true } },
        lines: true,
        invoice: { select: { ocrStatus: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const res: ApiResponse = { ok: true, data: bookings, meta: { total, page, limit } };
  return NextResponse.json(res);
}

// POST /api/bookings — create a new booking
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { customerId, runId, freightCharge, invoiceValue, lines, isNielsensOwn, notes } = body;

  // Resolve customerId — for CUSTOMER role, '_self' resolves to their own profile
  let resolvedCustomerId = customerId;
  if (session.user.role === 'CUSTOMER' && customerId === '_self') {
    const cust = await prisma.customer.findUnique({ where: { userId: session.user.id } });
    if (!cust) return NextResponse.json({ ok: false, error: 'No customer profile' }, { status: 403 });
    resolvedCustomerId = cust.id;
  }

  if (!resolvedCustomerId || typeof resolvedCustomerId !== 'string') {
    return NextResponse.json({ ok: false, error: 'customerId is required' }, { status: 400 });
  }

  // Validate financial fields
  if (freightCharge !== undefined && freightCharge !== null) {
    if (typeof freightCharge !== 'number' || freightCharge < 0 || freightCharge > 1_000_000) {
      return NextResponse.json({ ok: false, error: 'freightCharge must be 0-1000000' }, { status: 400 });
    }
  }
  if (invoiceValue !== undefined && invoiceValue !== null) {
    if (typeof invoiceValue !== 'number' || invoiceValue < 0 || invoiceValue > 10_000_000) {
      return NextResponse.json({ ok: false, error: 'invoiceValue must be 0-10000000' }, { status: 400 });
    }
  }

  // Validate booking lines
  if (lines && Array.isArray(lines)) {
    if (lines.length > 100) {
      return NextResponse.json({ ok: false, error: 'Max 100 booking lines' }, { status: 400 });
    }
    for (const l of lines) {
      if (!l.species || typeof l.species !== 'string' || l.species.length > 200) {
        return NextResponse.json({ ok: false, error: 'Invalid species in booking lines' }, { status: 400 });
      }
      if (typeof l.quantity !== 'number' || l.quantity <= 0 || l.quantity > 100000) {
        return NextResponse.json({ ok: false, error: 'Invalid quantity in booking lines' }, { status: 400 });
      }
    }
  }

  // Sanitize notes
  const sanitizedNotes = notes ? String(notes).substring(0, 2000) : null;

  // If customer role, verify they own this customer
  if (session.user.role === 'CUSTOMER') {
    const cust = await prisma.customer.findUnique({ where: { userId: session.user.id } });
    if (!cust || cust.id !== resolvedCustomerId) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }
  }

  const booking = await prisma.booking.create({
    data: {
      customerId: resolvedCustomerId,
      runId: runId ?? null,
      freightCharge: freightCharge ?? 0,
      invoiceValue: invoiceValue ?? 0,
      isNielsensOwn: isNielsensOwn ?? false,
      notes: sanitizedNotes,
      status: 'DRAFT',
      lines: lines?.length
        ? { createMany: { data: lines.map((l: { species: string; potSize: string; quantity: number; packType?: string }) => ({
            species: l.species,
            potSize: l.potSize,
            quantity: l.quantity,
            packType: l.packType ?? 'TRAY',
          })) } }
        : undefined,
    },
    include: { lines: true, customer: { select: { name: true } } },
  });

  return NextResponse.json({ ok: true, data: booking }, { status: 201 });
}
