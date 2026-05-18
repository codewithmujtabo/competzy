-- Migration: competition-logo
-- Adds competitions.logo_url — an uploaded competition logo image, managed by
-- admins and organizers via POST /api/{admin,organizers}/competitions/:id/logo.
-- Distinct from image_url (catalog thumbnail) and poster_url (promo poster).

ALTER TABLE competitions ADD COLUMN IF NOT EXISTS logo_url TEXT;
