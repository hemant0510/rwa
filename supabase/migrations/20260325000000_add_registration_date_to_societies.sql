-- Add registration_date column to societies table
-- Stores the official government registration date of the society (optional)
ALTER TABLE societies ADD COLUMN IF NOT EXISTS registration_date DATE;
