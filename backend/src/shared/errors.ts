export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  NotFound: (resource: string) =>
    new AppError(404, `${resource} not found`, 'NOT_FOUND'),

  Conflict: (message: string) =>
    new AppError(409, message, 'CONFLICT'),

  Forbidden: (message = 'Access denied') =>
    new AppError(403, message, 'FORBIDDEN'),

  Unauthorized: () =>
    new AppError(401, 'Unauthorized', 'UNAUTHORIZED'),

  BadRequest: (message: string) =>
    new AppError(400, message, 'BAD_REQUEST'),

  // Booking-specific
  SlotTaken: () =>
    new AppError(409, 'This time slot is already booked', 'SLOT_TAKEN'),

  SlotOutsideSchedule: () =>
    new AppError(422, 'Requested time is outside field working hours', 'SLOT_OUTSIDE_SCHEDULE'),

  SlotInBlackout: () =>
    new AppError(422, 'Field is unavailable during this period', 'SLOT_BLACKOUT'),

  BookingHorizon: () =>
    new AppError(422, 'Booking must be at least 30 minutes ahead and up to 14 days in advance', 'BOOKING_HORIZON'),

  CancelNotAllowed: () =>
    new AppError(422, 'Booking cannot be cancelled in its current status', 'CANCEL_NOT_ALLOWED'),
};
