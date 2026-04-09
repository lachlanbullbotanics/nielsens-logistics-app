import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { authOptions } from '@/lib/auth';

// POST /api/seed — seed the database with demo data
// SECURITY: Requires admin auth + SEED_ENABLED=true env var
export async function POST() {
  // Guard 1: Must explicitly opt-in via environment variable
  if (process.env.SEED_ENABLED !== 'true') {
    return NextResponse.json({ ok: false, error: 'Seed endpoint is disabled' }, { status: 403 });
  }

  // Guard 2: Must be authenticated as admin
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Admin authentication required' }, { status: 403 });
  }

  const hash = await bcrypt.hash('password123', 12);

  // Create users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@nielsens.com.au' },
    update: {},
    create: { email: 'admin@nielsens.com.au', name: 'Dave Nielsen', passwordHash: hash, role: 'ADMIN' },
  });

  const driver = await prisma.user.upsert({
    where: { email: 'driver@nielsens.com.au' },
    update: {},
    create: { email: 'driver@nielsens.com.au', name: 'Mark Thompson', passwordHash: hash, role: 'DRIVER' },
  });

  const custUser = await prisma.user.upsert({
    where: { email: 'customer@greenthumb.com.au' },
    update: {},
    create: { email: 'customer@greenthumb.com.au', name: 'Sarah Green', passwordHash: hash, role: 'CUSTOMER' },
  });

  // Create customers (nurseries)
  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { userId: custUser.id },
      update: {},
      create: {
        userId: custUser.id, name: 'Green Thumb Nursery', address: '45 Main St, Bairnsdale VIC 3875',
        lat: -37.8228, lng: 147.6111, contactName: 'Sarah Green', contactEmail: 'customer@greenthumb.com.au',
      },
    }),
    prisma.customer.create({
      data: {
        name: 'Alpine Nursery', address: '12 Mountain Rd, Bright VIC 3741',
        lat: -36.7308, lng: 146.9594, contactName: 'Tom Alpine', contactEmail: 'tom@alpinenursery.com.au',
      },
    }),
    prisma.customer.create({
      data: {
        name: 'Coastal Plants', address: '88 Beach Rd, Lakes Entrance VIC 3909',
        lat: -37.8801, lng: 148.0014, contactName: 'Lisa Coast', contactEmail: 'lisa@coastalplants.com.au',
      },
    }),
    prisma.customer.create({
      data: {
        name: 'Valley Garden Centre', address: '200 Valley Hwy, Traralgon VIC 3844',
        lat: -38.1958, lng: 146.5342, contactName: 'Mike Valley', contactEmail: 'mike@valleygarden.com.au',
      },
    }),
    prisma.customer.create({
      data: {
        name: 'Metro Wholesale Plants', address: '5/120 Industrial Dr, Dandenong VIC 3175',
        lat: -37.9874, lng: 145.2150, contactName: 'James Metro', contactEmail: 'james@metrowholesale.com.au',
      },
    }),
  ]);

  // Create truck settings
  await prisma.truckSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default', name: 'Primary Truck', lengthMetres: 12.5, widthMetres: 2.4, heightMetres: 4.3,
      trolleyLength: 1.35, trolleyWidth: 0.565, maxTrolleys: 26, isDefault: true,
    },
  });

  // Create a demo run
  const run = await prisma.run.create({
    data: {
      name: 'Bairnsdale → Melbourne Run #42',
      routeType: 'MELB_TO_BAIRNSDALE',
      scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      driverId: driver.id,
      status: 'PLANNED',
    },
  });

  // Add stops
  for (let i = 0; i < customers.length; i++) {
    await prisma.stop.create({
      data: { runId: run.id, customerId: customers[i].id, stopOrder: i + 1 },
    });
  }

  // Create bookings with lines
  const speciesList = ['Grevillea', 'Banksia', 'Callistemon', 'Eucalyptus', 'Melaleuca', 'Acacia', 'Westringia'];
  for (const customer of customers) {
    const numLines = Math.floor(Math.random() * 4) + 1;
    const lines = Array.from({ length: numLines }, () => ({
      species: speciesList[Math.floor(Math.random() * speciesList.length)],
      potSize: ['140mm', '170mm', '200mm'][Math.floor(Math.random() * 3)],
      quantity: Math.floor(Math.random() * 200) + 20,
      packType: 'TRAY' as const,
    }));

    const invoiceValue = lines.reduce((sum, l) => sum + l.quantity * (parseInt(l.potSize) / 10), 0);

    await prisma.booking.create({
      data: {
        customerId: customer.id,
        runId: run.id,
        status: 'CONFIRMED',
        freightCharge: Math.round(invoiceValue * 0.15 * 100) / 100,
        invoiceValue: Math.round(invoiceValue * 100) / 100,
        lines: { createMany: { data: lines } },
      },
    });
  }

  // Init trolley balances
  for (const customer of customers) {
    await prisma.trolleyBalance.upsert({
      where: { customerId: customer.id },
      update: {},
      create: { customerId: customer.id, qtyOutstanding: Math.floor(Math.random() * 8) },
    });
  }

  return NextResponse.json({
    ok: true,
    data: { admin: admin.email, driver: driver.email, customer: custUser.email, run: run.name },
  });
}
