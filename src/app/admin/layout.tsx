'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Package, Route, DollarSign, ShoppingCart,
  ScanSearch, LogOut, Truck,
} from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/bookings', label: 'Bookings', icon: Package },
  { href: '/admin/runs/planner', label: 'Run Planner', icon: Route },
  { href: '/admin/profitability', label: 'Profitability', icon: DollarSign },
  { href: '/admin/trolleys', label: 'Trolley Inventory', icon: ShoppingCart },
  { href: '/admin/ocr-review', label: 'OCR Review', icon: ScanSearch },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 w-64 border-r border-gray-200 bg-white">
        <div className="flex h-16 items-center gap-3 border-b border-gray-100 px-6">
          <Truck className="h-6 w-6 text-blue-600" />
          <span className="text-lg font-bold text-gray-900">Nielsen&apos;s</span>
        </div>

        <nav className="mt-4 space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn('sidebar-link', isActive && 'active')}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
              {session?.user?.name?.[0] ?? 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{session?.user?.name}</p>
              <p className="truncate text-xs text-gray-500">{session?.user?.email}</p>
            </div>
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-gray-400 hover:text-gray-600">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 pl-64">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
