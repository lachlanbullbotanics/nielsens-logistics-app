'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">403</h1>
        <p className="mt-2 text-lg text-gray-600">You don&apos;t have access to this page.</p>
        <Link href="/">
          <Button variant="secondary" className="mt-6">Go Home</Button>
        </Link>
      </div>
    </div>
  );
}
