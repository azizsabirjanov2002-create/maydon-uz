/**
 * Slot availability utilities for Maydon.uz
 *
 * Source of truth: our PostgreSQL database.
 * The map (Yandex) is only a geo layer.
 */

export interface TimeSlot {
  startTime: string; // "HH:MM"
  endTime: string;
  durationMinutes: number;
  isAvailable: boolean;
}

/**
 * Parse "HH:MM" to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Minutes since midnight to "HH:MM" string
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Check if two time ranges overlap (including buffer)
 *
 * Range A: [aStart, aEnd)
 * Range B: [bStart, bEnd)
 * Buffer applied to both sides of B (existing booking)
 */
export function timesOverlap(
  newStart: number,
  newEnd: number,
  existingStart: number,
  existingEnd: number,
  bufferMinutes: number,
): boolean {
  const bufferedStart = existingStart - bufferMinutes;
  const bufferedEnd = existingEnd + bufferMinutes;
  return newStart < bufferedEnd && newEnd > bufferedStart;
}

/**
 * Generate all possible 30-minute slots within working hours,
 * filtered by existing bookings and blackouts.
 *
 * Used by Search API to show "available slots" for a field on a given date.
 */
export function computeFreeSlots(params: {
  openTime: string;        // "08:00"
  closeTime: string;       // "22:00"
  bufferMinutes: number;
  minBookingMinutes: number;  // 60
  slotStepMinutes: number;    // 30
  maxBookingHours: number;    // e.g. 3
  existingBookings: Array<{ startTime: string; endTime: string }>;
  blackouts: Array<{ startMinutes: number; endMinutes: number }>;
  requestDate: Date;
}): TimeSlot[] {
  const {
    openTime, closeTime, bufferMinutes, minBookingMinutes,
    slotStepMinutes, existingBookings, blackouts, requestDate
  } = params;

  const openMinutes = timeToMinutes(openTime);
  const closeMinutes = timeToMinutes(closeTime);
  const now = new Date();
  const isToday = requestDate.toDateString() === now.toDateString();

  const slots: TimeSlot[] = [];

  // Iterate possible start times (30-min steps)
  for (let start = openMinutes; start + minBookingMinutes <= closeMinutes; start += slotStepMinutes) {
    const end = start + minBookingMinutes; // minimum 1 hour slot

    // If today, skip past slots (need at least 30 min buffer from now)
    if (isToday) {
      const nowMinutes = now.getHours() * 60 + now.getMinutes() + 30;
      if (start < nowMinutes) continue;
    }

    // Check against existing bookings
    const conflictsWithBooking = existingBookings.some((b) => {
      const bStart = timeToMinutes(b.startTime);
      const bEnd = timeToMinutes(b.endTime);
      return timesOverlap(start, end, bStart, bEnd, bufferMinutes);
    });

    // Check against blackouts
    const conflictsWithBlackout = blackouts.some((bl) =>
      timesOverlap(start, end, bl.startMinutes, bl.endMinutes, 0)
    );

    slots.push({
      startTime: minutesToTime(start),
      endTime: minutesToTime(end),
      durationMinutes: minBookingMinutes,
      isAvailable: !conflictsWithBooking && !conflictsWithBlackout,
    });
  }

  return slots;
}

/**
 * Haversine distance between two lat/lng points — returns km
 */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Approximate travel time in minutes.
 * Phase 1: distance / 40 km/h (city traffic approximation)
 * Phase 2: replace with Yandex Routes API
 */
export function approxTravelMinutes(distanceKm: number): number {
  const avgSpeedKmPerH = 40;
  return Math.ceil((distanceKm / avgSpeedKmPerH) * 60);
}
