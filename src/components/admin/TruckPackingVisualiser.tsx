'use client';

import { useMemo } from 'react';
import { customerColour } from '@/lib/utils';
import type { TruckPackingSlot } from '@/types';

interface TruckConfig {
  lengthMetres: number;
  widthMetres: number;
  trolleyLength: number;
  trolleyWidth: number;
}

interface StopAllocation {
  stopOrder: number;
  customerId: string;
  customerName: string;
  trolleyCount: number;
}

interface Props {
  truck: TruckConfig;
  allocations: StopAllocation[];
  className?: string;
}

/**
 * 2D top-down SVG visualiser of truck bed with trolley placements.
 *
 * Layout logic:
 *   - Trolleys packed in rows (across truck width)
 *   - Back-to-front by stop order (last stop = front = loaded last)
 *   - Colour-coded by customer
 */
export function TruckPackingVisualiser({ truck, allocations, className }: Props) {
  const SCALE = 60; // pixels per metre
  const PADDING = 20;

  const svgWidth = truck.widthMetres * SCALE + PADDING * 2;
  const svgHeight = truck.lengthMetres * SCALE + PADDING * 2;

  const trolleysPerRow = Math.floor(truck.widthMetres / truck.trolleyWidth);
  const trolleyW = truck.trolleyWidth * SCALE;
  const trolleyH = truck.trolleyLength * SCALE;

  // Sort allocations: first stop (delivered first) at the back (bottom of SVG)
  // Last stop at the front (top of SVG) — loaded last, unloaded first
  const sortedAllocations = useMemo(
    () => [...allocations].sort((a, b) => b.stopOrder - a.stopOrder),
    [allocations]
  );

  // Build slot positions
  const slots = useMemo(() => {
    const result: TruckPackingSlot[] = [];
    let currentRow = 0;
    let currentCol = 0;

    for (let i = 0; i < sortedAllocations.length; i++) {
      const alloc = sortedAllocations[i];
      const colour = customerColour(i);

      for (let t = 0; t < alloc.trolleyCount; t++) {
        if (currentCol >= trolleysPerRow) {
          currentCol = 0;
          currentRow++;
        }

        result.push({
          x: PADDING + currentCol * trolleyW,
          y: PADDING + currentRow * trolleyH,
          width: trolleyW - 2,
          height: trolleyH - 2,
          customerId: alloc.customerId,
          customerName: alloc.customerName,
          colour,
          stopOrder: alloc.stopOrder,
        });

        currentCol++;
      }
    }

    return result;
  }, [sortedAllocations, trolleysPerRow, trolleyW, trolleyH]);

  const totalTrolleys = allocations.reduce((s, a) => s + a.trolleyCount, 0);

  return (
    <div className={className}>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium text-gray-700">
          {totalTrolleys} trolleys · {truck.lengthMetres}m × {truck.widthMetres}m truck
        </span>
        {/* Legend */}
        {sortedAllocations.map((alloc, i) => (
          <div key={alloc.customerId} className="flex items-center gap-1.5">
            <div
              className="h-3 w-3 rounded"
              style={{ backgroundColor: customerColour(i) }}
            />
            <span className="text-xs text-gray-600">
              Stop {alloc.stopOrder}: {alloc.customerName} ({alloc.trolleyCount})
            </span>
          </div>
        ))}
      </div>

      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="rounded-lg border border-gray-300 bg-gray-50"
      >
        {/* Truck outline */}
        <rect
          x={PADDING}
          y={PADDING}
          width={truck.widthMetres * SCALE}
          height={truck.lengthMetres * SCALE}
          fill="none"
          stroke="#94a3b8"
          strokeWidth="2"
          strokeDasharray="8 4"
          rx="4"
        />

        {/* Front label */}
        <text
          x={svgWidth / 2}
          y={PADDING - 6}
          textAnchor="middle"
          className="text-[10px] fill-gray-400 font-medium"
        >
          FRONT (CAB)
        </text>

        {/* Back label */}
        <text
          x={svgWidth / 2}
          y={svgHeight - 4}
          textAnchor="middle"
          className="text-[10px] fill-gray-400 font-medium"
        >
          REAR (DOOR)
        </text>

        {/* Trolley slots */}
        {slots.map((slot, idx) => (
          <g key={idx}>
            <rect
              x={slot.x}
              y={slot.y}
              width={slot.width}
              height={slot.height}
              fill={slot.colour}
              opacity={0.8}
              rx="3"
            />
            <text
              x={slot.x + slot.width / 2}
              y={slot.y + slot.height / 2 + 4}
              textAnchor="middle"
              className="text-[9px] fill-white font-bold"
            >
              S{slot.stopOrder}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
