'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

const DEMO_ACCOUNTS = [
  { label: 'Admin', desc: 'Dave Nielsen', email: 'admin@nielsens.com.au', color: 'bg-indigo-600 hover:bg-indigo-700' },
  { label: 'Driver', desc: 'Mark Thompson', email: 'driver@nielsens.com.au', color: 'bg-emerald-600 hover:bg-emerald-700' },
  { label: 'Customer', desc: 'Sarah Green', email: 'customer@greenthumb.com.au', color: 'bg-amber-600 hover:bg-amber-700' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('Invalid email or password');
    } else {
      router.push('/');
      router.refresh();
    }
  }

  async function handleDemoLogin(account: typeof DEMO_ACCOUNTS[number]) {
    setError('');
    setDemoLoading(account.email);

    try {
      // Ensure demo data is seeded
      await fetch('/api/seed', { method: 'POST' });

      const result = await signIn('credentials', {
        email: account.email,
        password: 'password123',
        redirect: false,
      });

      if (result?.error) {
        setError('Demo login failed — seed may not have completed');
        setDemoLoading(null);
      } else {
        router.push('/');
        router.refresh();
      }
    } catch {
      setError('Failed to set up demo data');
      setDemoLoading(null);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Nielsen&apos;s Transport</h1>
          <p className="mt-2 text-gray-500">Logistics Management Platform</p>
        </div>

        {/* Demo quick-login buttons */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
          <p className="mb-4 text-center text-sm font-medium text-gray-700">Quick Demo Login</p>
          <div className="grid grid-cols-3 gap-3">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                onClick={() => handleDemoLogin(account)}
                disabled={!!demoLoading}
                className={`${account.color} rounded-lg px-3 py-3 text-center text-white transition-colors disabled:opacity-50`}
              >
                <span className="block text-sm font-semibold">
                  {demoLoading === account.email ? '...' : account.label}
                </span>
                <span className="block text-xs opacity-80">{account.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-8 shadow-lg">
          <p className="mb-4 text-center text-xs text-gray-400">Or sign in with credentials</p>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="label">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="label">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
          )}

          <Button type="submit" loading={loading} className="mt-6 w-full">
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
}
