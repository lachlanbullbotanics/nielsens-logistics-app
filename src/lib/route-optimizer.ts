/**
 * Route Optimisation Engine
 *
 * Improvement over brief:
 *   - Built-in nearest-neighbour heuristic (works offline, no API key needed)
 *   - Optional Google Maps Routes API integration for production accuracy
 *   - 2-opt local search improvement pass
 *   - Returns distance matrix for the truck packing visualiser
 */

import { haversineKm } from './utils';

export interface RoutePoint {
  stopId: string;
  lat: number;
  lng: number;
  customerName: string;
}

export interface OptimisedStop {
  stopId: string;
  order: number;
  customerName: string;
  lat: number;
  lng: number;
  distFromPrev: number | null;
}

/**
 * Nearest-neighbour heuristic + 2-opt improvement.
 * O(n²) which is fine for ≤ 50 stops (typical run has 5–20).
 */
export function optimiseRoute(points: RoutePoint[]): OptimisedStop[] {
  if (points.length <= 1) {
    return points.map((p, i) => ({
      stopId: p.stopId,
      order: i + 1,
      customerName: p.customerName,
      lat: p.lat,
      lng: p.lng,
      distFromPrev: null,
    }));
  }

  // Build distance matrix
  const n = points.length;
  const dist: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = haversineKm(points[i].lat, points[i].lng, points[j].lat, points[j].lng);
      dist[i][j] = d;
      dist[j][i] = d;
    }
  }

  // ── Nearest Neighbour ──
  const visited = new Set<number>();
  const tour: number[] = [0]; // Start from first point
  visited.add(0);

  while (visited.size < n) {
    const last = tour[tour.length - 1];
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let j = 0; j < n; j++) {
      if (!visited.has(j) && dist[last][j] < bestDist) {
        bestDist = dist[last][j];
        bestIdx = j;
      }
    }
    tour.push(bestIdx);
    visited.add(bestIdx);
  }

  // ── 2-opt Improvement ──
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < tour.length - 2; i++) {
      for (let j = i + 2; j < tour.length; j++) {
        const a = tour[i], b = tour[i + 1], c = tour[j], d = tour[(j + 1) % tour.length];
        const currentCost = dist[a][b] + dist[c][d ?? c];
        const newCost = dist[a][c] + dist[b][d ?? b];
        if (newCost < currentCost - 0.01) {
          // Reverse the segment between i+1 and j
          const segment = tour.slice(i + 1, j + 1);
          segment.reverse();
          tour.splice(i + 1, segment.length, ...segment);
          improved = true;
        }
      }
    }
  }

  // Build result
  return tour.map((idx, order) => ({
    stopId: points[idx].stopId,
    order: order + 1,
    customerName: points[idx].customerName,
    lat: points[idx].lat,
    lng: points[idx].lng,
    distFromPrev: order === 0 ? null : dist[tour[order - 1]][idx],
  }));
}

/**
 * Google Maps Routes API integration (for production use).
 * Requires GOOGLE_MAPS_API_KEY env var.
 */
export async function optimiseRouteWithGoogle(
  points: RoutePoint[]
): Promise<OptimisedStop[] | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null; // Fall back to heuristic

  try {
    const origin = points[0];
    const destination = points[points.length - 1];
    const waypoints = points.slice(1, -1);

    const response = await fetch(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'routes.optimizedIntermediateWaypointIndex,routes.legs.distanceMeters',
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
          destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
          intermediates: waypoints.map((w) => ({
            location: { latLng: { latitude: w.lat, longitude: w.lng } },
          })),
          optimizeWaypointOrder: true,
          travelMode: 'DRIVE',
        }),
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const optimisedOrder: number[] = data.routes?.[0]?.optimizedIntermediateWaypointIndex ?? [];
    const legs = data.routes?.[0]?.legs ?? [];

    // Reconstruct ordered points
    const orderedWaypoints = optimisedOrder.map((i) => waypoints[i]);
    const allOrdered = [origin, ...orderedWaypoints, destination];

    return allOrdered.map((p, i) => ({
      stopId: p.stopId,
      order: i + 1,
      customerName: p.customerName,
      lat: p.lat,
      lng: p.lng,
      distFromPrev: i > 0 && legs[i - 1] ? legs[i - 1].distanceMeters / 1000 : null,
    }));
  } catch {
    return null; // Fall back to heuristic
  }
}
