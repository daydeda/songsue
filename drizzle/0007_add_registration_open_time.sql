-- Registration open date/time for events
-- Pairs with the existing registration_close_time to define a registration window.
-- An event with no open time is treated as already open (NULL = no lower bound).

ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_open_time timestamp;
