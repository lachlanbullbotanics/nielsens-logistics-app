'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { Route, Fuel, LogOut, Truck } from 'lucide-react';

const navItems = [
  { href: '/driver', label: 'My Run', icon: Route },
  { href: '/driver/fuel', label: 'Fuel Log', icon: Fuel },
];

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar (mobile-first) */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            <span className="font-bold text-gray-900">Nielsen&apos;s Driver</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{session?.user?.name}</span>
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-gray-400 hover:text-gray-600">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Bottom nav tabs */}
        <nav className="flex border-t border-gray-100">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-lg p-4">{children}</main>
    </div>
  );
}
