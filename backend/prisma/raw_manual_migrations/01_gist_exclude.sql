-- ==============================================================================
-- Maydon.uz - Phase 1 Final Protection
-- Raw SQL Migration for Booking Conflict Prevention (GiST Exclusion Constraint)
-- ==============================================================================

-- 1. Enable btree_gist extension (required for EXCLUDE using GiST on standard types like INT/DATE)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Create IMMUTABLE function to cast string to time (Postgres requires index functions to be immutable)
CREATE OR REPLACE FUNCTION parse_time_immutable(t varchar) RETURNS time AS $$
  BEGIN
    RETURN t::time;
  END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- 3. Backfill buffer_minutes for existing bookings (Safety measure for existing data)
UPDATE bookings
SET buffer_minutes = 15
WHERE buffer_minutes IS NULL;

-- 3. In case constraint already exists, drop it to recreate
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS no_overlapping_bookings;

-- 4. Apply Partial EXCLUDE USING gist constraint
-- This constraint checks field_id, date, and a tsrange calculated dynamically using the denormalized buffer_minutes.
-- It strictly applies only to CONFIRMED and COMPLETED bookings. HOLD and CANCELLED are ignored.
ALTER TABLE bookings
ADD CONSTRAINT no_overlapping_bookings
EXCLUDE USING gist (
  field_id WITH =,
  date WITH =,
  tsrange(
    date + parse_time_immutable(start_time),
    date + parse_time_immutable(end_time) + (buffer_minutes * interval '1 minute'),
    '[)'
  ) WITH &&
)
WHERE (status IN ('CONFIRMED', 'COMPLETED'));
