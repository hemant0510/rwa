-- ═══════════════════════════════════════════════════════
-- Flip default for show_in_directory from FALSE to TRUE
-- ═══════════════════════════════════════════════════════
-- Rationale: residents expect to appear in the society directory
-- by default. They can opt out from Profile → Directory Settings.
-- Phone visibility remains opt-in (showPhoneInDirectory stays FALSE
-- by default — masked display in the directory is used until then).

ALTER TABLE users
  ALTER COLUMN show_in_directory SET DEFAULT TRUE;

-- Backfill existing residents who are currently opted-out but never
-- explicitly toggled it (only flip the ones set to false — preserves
-- any user who deliberately opted out via the toggle, on the
-- assumption that deliberate opt-outs are uncommon at this stage).
UPDATE users
SET show_in_directory = TRUE
WHERE show_in_directory = FALSE
  AND role = 'RESIDENT';
