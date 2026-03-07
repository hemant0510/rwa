-- Migration: Allow same authUserId across multiple societies
-- This drops the unique constraint on auth_user_id in the users table
-- so the same Supabase auth account can be linked to users in different societies.
--
-- Run this in Supabase SQL Editor before deploying the updated code.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_auth_user_id_key;
