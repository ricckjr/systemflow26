-- Migration: Add Corporate Fields to Profiles
-- Description: Adds email_corporativo, telefone, ramal columns to public.profiles table

BEGIN;

-- Add columns if they don't exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email_corporativo text,
ADD COLUMN IF NOT EXISTS telefone text,
ADD COLUMN IF NOT EXISTS ramal text;

-- Add comments for clarity
COMMENT ON COLUMN public.profiles.email_corporativo IS 'Corporate email address for business communication';
COMMENT ON COLUMN public.profiles.telefone IS 'Business phone number';
COMMENT ON COLUMN public.profiles.ramal IS 'Internal phone extension';

COMMIT;
