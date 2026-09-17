-- Add is_active column to profiles for soft-delete support
-- Default true: all existing users are active
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.profiles.is_active IS 'Soft delete. false = user deactivated, hidden from UI.';
