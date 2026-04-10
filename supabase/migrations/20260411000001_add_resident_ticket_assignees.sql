-- Migration: 20260411000001_add_resident_ticket_assignees
-- Adds resident_ticket_assignees table for assigning governing body members to tickets.
-- The author relation on resident_ticket_messages is a virtual Prisma relation only
-- (author_id column already exists) — no DDL change needed for that.

CREATE TABLE IF NOT EXISTS resident_ticket_assignees (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES resident_tickets(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  assigned_by UUID NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_resident_ticket_assignee UNIQUE (ticket_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rta_ticket_id ON resident_ticket_assignees(ticket_id);
