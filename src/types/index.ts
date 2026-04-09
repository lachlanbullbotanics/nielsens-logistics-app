// ─── Nielsen's Logistics — Shared Types ─────────────────
// These mirror the Prisma schema but are safe for client-side use.

export type UserRole = 'ADMIN' | 'DRIVER' | 'CUSTOMER';
export type RouteType = 'MELB_TO_BAIRNSDALE' | 'BAIRNSDALE_TO_NSW' | 'CUSTOM';
export type RunStatus = 'DRAFT' | 'PLANNED' | 'LOCKED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type BookingStatus = 'DRAFT' | 'CONFIRMED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
export type StopStatus = 'PENDING' | 'ARRIVED' | 'LOADING' | 'UNLOADING' | 'COMPLETED' | 'SKIPPED';
export type TrolleyEventType = 'DROP' | 'PICKUP' | 'ADJUSTMENT';
export type OcrStatus = 'PENDING' | 'PROCESSING' | 'PARSED' | 'FAILED' | 'MANUALLY_REVIEWED';
export type PackingUnit = 'TRAY' | 'LOOSE' | 'PALLET';

// ─── API Response Wrapper ────────────────────────────────

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  meta?: { total?: number; page?: number; limit?: number };
}

// ─── Domain Types ────────────────────────────────────────

export interface CustomerSummary {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  contactName: string | null;
  trolleysOutstanding: number;
}

export interface RunSummary {
  id: string;
  name: string;
  routeType: RouteType;
  scheduledDate: string;
  driverName: string | null;
  status: RunStatus;
  stopCount: number;
  bookingCount: number;
}

export interface BookingSummary {
  id: string;
  customerName: string;
  runName: string | null;
  status: BookingStatus;
  freightCharge: number;
  invoiceValue: number;
  predictedTrolleys: number | null;
  lineCount: number;
  createdAt: string;
}

export interface StopDetail {
  id: string;
  stopOrder: number;
  customerName: string;
  customerId: string;
  address: string;
  status: StopStatus;
  estimatedArrival: string | null;
  bookings: BookingSummary[];
  trolleyEvents: { eventType: TrolleyEventType; qty: number }[];
}

export interface ProfitabilityReport {
  runId: string;
  runName: string;
  scheduledDate: string;
  totalRevenue: number;
  fuelCost: number;
  labourCost: number;
  otherCosts: number;
  netMargin: number;
  marginPercent: number;
  litresPerKm: number | null;
  flagged: boolean;
}

export interface TrolleyInventoryRow {
  customerId: string;
  customerName: string;
  qtyOutstanding: number;
  lastUpdated: string;
  daysOutstanding: number;
  overdue: boolean;
}

export interface OcrQueueItem {
  invoiceId: string;
  bookingId: string;
  customerName: string | null;
  senderEmail: string | null;
  ocrStatus: OcrStatus;
  errorMessage: string | null;
  rawPdfUrl: string | null;
  parsedJson: unknown;
  createdAt: string;
}

export interface TruckPackingSlot {
  x: number;
  y: number;
  width: number;
  height: number;
  customerId: string;
  customerName: string;
  colour: string;
  stopOrder: number;
}

export interface FuelLogEntry {
  id?: string;
  runId: string;
  litres: number;
  pricePerLitre: number;
  odoReading: number;
}

export interface ParsedInvoiceLine {
  species: string;
  potSize: string;
  quantity: number;
  packType: PackingUnit;
}

// ─── Session Extension ───────────────────────────────────

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
    };
  }
  interface User {
    id: string;
    role: UserRole;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
  }
}
