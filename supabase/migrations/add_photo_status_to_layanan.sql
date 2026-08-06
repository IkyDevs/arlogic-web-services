-- Migration: Add photo_status field to layanan table for tracking photo upload status
-- This field tracks the photo upload lifecycle: 'pending' -> 'completed' or 'failed'
-- Date: 2026-08-05

-- Add photo_status column if it doesn't exist
ALTER TABLE public.layanan
ADD COLUMN IF NOT EXISTS photo_status TEXT DEFAULT 'no_photo';

-- Add comment to explain the field
COMMENT ON COLUMN public.layanan.photo_status IS 'Photo upload status: no_photo (no photos to upload), pending (upload in progress), completed (upload finished), failed (upload failed)';

-- Create index for better query performance when filtering by photo_status
CREATE INDEX IF NOT EXISTS idx_layanan_photo_status ON public.layanan(photo_status);

-- Create index for finding stuck uploads (created_at + photo_status)
CREATE INDEX IF NOT EXISTS idx_layanan_photo_status_created_at ON public.layanan(photo_status, created_at DESC)
WHERE photo_status = 'pending';
