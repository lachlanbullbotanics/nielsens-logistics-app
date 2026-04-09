import { clsx, type ClassValue } from 'clsx';
import { type UserRole } from '@/types';

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Format currency AUD */
export function formatAUD(amount: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
}

/** Format a date for display */
export function formatDate(d: string | Date, style: 'short' | 'long' = 'short'): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (style === 'long') {
    return date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  return date.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Role-based home path */
export function homePathForRole(role: UserRole): string {
  switch (role) {
    case 'ADMIN': return '/admin';
    case 'DRIVER': return '/driver';
    case 'CUSTOMER': return '/customer';
    default: return '/';
  }
}

/** Colour palette for customer colour-coding (truck visualiser) */
const CUSTOMER_COLOURS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#84CC16', '#6366F1',
  '#14B8A6', '#E11D48', '#A855F7', '#0EA5E9', '#D946EF',
];

export function customerColour(index: number): string {
  return CUSTOMER_COLOURS[index % CUSTOMER_COLOURS.length];
}

/** Calculate distance between two lat/lng points using Haversine formula (km) */
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Status badge colour mapping */
export function statusColour(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    PLANNED: 'bg-blue-100 text-blue-700',
    LOCKED: 'bg-indigo-100 text-indigo-700',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    COMPLETED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
    CONFIRMED: 'bg-blue-100 text-blue-700',
    PICKED_UP: 'bg-cyan-100 text-cyan-700',
    IN_TRANSIT: 'bg-amber-100 text-amber-700',
    DELIVERED: 'bg-green-100 text-green-700',
    PENDING: 'bg-gray-100 text-gray-600',
    ARRIVED: 'bg-blue-100 text-blue-700',
    LOADING: 'bg-yellow-100 text-yellow-800',
    UNLOADING: 'bg-orange-100 text-orange-700',
    SKIPPED: 'bg-gray-200 text-gray-500',
    PARSED: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
    PROCESSING: 'bg-yellow-100 text-yellow-700',
    MANUALLY_REVIEWED: 'bg-purple-100 text-purple-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}
