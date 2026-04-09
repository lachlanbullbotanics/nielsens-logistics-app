import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

/**
 * POST /api/upload — upload a photo (base64)
 * Stores as base64 data URL for now. In production, use S3/Cloud Storage.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const { image, filename } = await req.json();

  if (!image || typeof image !== 'string') {
    return NextResponse.json({ ok: false, error: 'image (base64 data URL) required' }, { status: 400 });
  }

  // Validate it's a data URL or base64 image
  if (!image.startsWith('data:image/')) {
    return NextResponse.json({ ok: false, error: 'Invalid image format — must be a data URL' }, { status: 400 });
  }

  // Limit size (~5MB base64)
  if (image.length > 7_000_000) {
    return NextResponse.json({ ok: false, error: 'Image too large (max 5MB)' }, { status: 400 });
  }

  // For now, store as base64 data URL (returned directly)
  // In production: decode and upload to cloud storage, return URL
  const photoId = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return NextResponse.json({
    ok: true,
    data: {
      id: photoId,
      url: image, // base64 data URL — stored inline
      filename: filename ?? `${photoId}.jpg`,
    },
  }, { status: 201 });
}
