import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { processInvoicePdf } from '@/lib/ocr';

/**
 * POST /api/inbound-email
 *
 * Postmark inbound email webhook handler.
 * Receives emails at bookings@nielsens-app.com, extracts PDF attachments,
 * runs them through the OCR pipeline, and creates draft bookings.
 *
 * Security: Verified by Postmark webhook signature (or IP allowlist in production).
 */
export async function POST(req: NextRequest) {
  // SECURITY: Webhook signature verification is MANDATORY
  const webhookSecret = process.env.POSTMARK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[INBOUND EMAIL] POSTMARK_WEBHOOK_SECRET not configured — rejecting request');
    return NextResponse.json({ ok: false, error: 'Webhook not configured' }, { status: 503 });
  }

  const authHeader = req.headers.get('x-postmark-secret');
  if (!authHeader || authHeader !== webhookSecret) {
    console.warn('[INBOUND EMAIL] Invalid webhook secret — rejecting request');
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();

  // Postmark inbound email format
  const {
    From: senderEmail,
    FromName: senderName,
    Subject: subject,
    Attachments: attachments = [],
  } = body;

  if (!attachments.length) {
    return NextResponse.json({ ok: true, data: { message: 'No attachments — ignored' } });
  }

  // Find customer by email
  const customer = await prisma.customer.findFirst({
    where: {
      OR: [
        { contactEmail: senderEmail?.toLowerCase() },
        { user: { email: senderEmail?.toLowerCase() } },
      ],
    },
  });

  // If sender not recognised, skip booking creation and alert admin
  if (!customer) {
    console.warn(`[INBOUND EMAIL] Unrecognised sender: ${senderEmail} — cannot create booking without valid customer. Admin review required.`);
    // TODO: In production, send admin notification (e.g. Slack, email alert)
    return NextResponse.json({
      ok: true,
      data: {
        processed: 0,
        skipped: true,
        reason: 'unknown_sender',
        senderEmail: senderEmail ?? null,
        senderName: senderName ?? null,
        attachmentCount: attachments.filter(
          (a: { ContentType: string; Name?: string }) =>
            a.ContentType === 'application/pdf' || a.Name?.endsWith('.pdf')
        ).length,
        message: `Sender "${senderEmail}" not recognised. Attachments not processed. Admin review required.`,
      },
    });
  }

  const results = [];

  for (const attachment of attachments) {
    // Only process PDFs
    if (attachment.ContentType !== 'application/pdf' && !attachment.Name?.endsWith('.pdf')) {
      continue;
    }

    const pdfBuffer = Buffer.from(attachment.Content, 'base64');

    // Create draft booking linked to verified customer
    const booking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        status: 'DRAFT',
        notes: `Email from ${senderName ?? senderEmail} — Subject: ${subject ?? 'No subject'}`,
      },
    });

    // Run OCR
    const ocrResult = await processInvoicePdf(pdfBuffer);

    // Store invoice
    await prisma.invoice.create({
      data: {
        bookingId: booking.id,
        rawOcrOutput: ocrResult.rawText,
        parsedJson: JSON.parse(JSON.stringify(ocrResult.lines)),
        ocrStatus: ocrResult.status,
        senderEmail: senderEmail ?? null,
        errorMessage: ocrResult.error ?? null,
      },
    });

    // Create booking lines if parsed
    if (ocrResult.status === 'PARSED' && ocrResult.lines.length > 0) {
      await prisma.bookingLine.createMany({
        data: ocrResult.lines.map((line) => ({
          bookingId: booking.id,
          species: line.species,
          potSize: line.potSize,
          quantity: line.quantity,
          packType: line.packType,
        })),
      });
    }

    results.push({
      bookingId: booking.id,
      fileName: attachment.Name,
      status: ocrResult.status,
      linesParsed: ocrResult.lines.length,
    });
  }

  return NextResponse.json({ ok: true, data: { processed: results.length, results } });
}
