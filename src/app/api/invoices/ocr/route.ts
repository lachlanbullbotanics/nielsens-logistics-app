import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { processInvoicePdf } from '@/lib/ocr';

// POST /api/invoices/ocr — upload a PDF invoice for OCR processing
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const bookingId = formData.get('bookingId') as string | null;

  if (!file) return NextResponse.json({ ok: false, error: 'No file uploaded' }, { status: 400 });
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ ok: false, error: 'Only PDF files accepted' }, { status: 400 });
  }

  // Read file buffer
  const buffer = Buffer.from(await file.arrayBuffer());

  // If no booking exists, create a draft
  let targetBookingId = bookingId;
  if (!targetBookingId) {
    // Find or create a customer linked to this user
    let customer = await prisma.customer.findUnique({ where: { userId: session.user.id } });
    if (!customer && session.user.role === 'ADMIN') {
      // Admin uploading on behalf — create an unlinked booking
      customer = await prisma.customer.findFirst();
    }
    if (!customer) {
      return NextResponse.json({ ok: false, error: 'No customer profile found' }, { status: 400 });
    }

    const booking = await prisma.booking.create({
      data: { customerId: customer.id, status: 'DRAFT' },
    });
    targetBookingId = booking.id;
  }

  // Process through OCR pipeline
  const result = await processInvoicePdf(buffer);

  // Store invoice record
  const invoice = await prisma.invoice.upsert({
    where: { bookingId: targetBookingId },
    create: {
      bookingId: targetBookingId,
      rawOcrOutput: result.rawText,
      parsedJson: result.lines as any,
      ocrStatus: result.status,
      errorMessage: result.error ?? null,
    },
    update: {
      rawOcrOutput: result.rawText,
      parsedJson: result.lines as any,
      ocrStatus: result.status,
      errorMessage: result.error ?? null,
      updatedAt: new Date(),
    },
  });

  // If parsed successfully, create booking lines
  if (result.status === 'PARSED' && result.lines.length > 0) {
    // Clear existing lines
    await prisma.bookingLine.deleteMany({ where: { bookingId: targetBookingId } });

    await prisma.bookingLine.createMany({
      data: result.lines.map((line) => ({
        bookingId: targetBookingId!,
        species: line.species,
        potSize: line.potSize,
        quantity: line.quantity,
        packType: line.packType,
      })),
    });
  }

  return NextResponse.json({
    ok: true,
    data: {
      invoiceId: invoice.id,
      bookingId: targetBookingId,
      ocrStatus: result.status,
      confidence: result.confidence,
      lineCount: result.lines.length,
      lines: result.lines,
      error: result.error,
    },
  });
}
