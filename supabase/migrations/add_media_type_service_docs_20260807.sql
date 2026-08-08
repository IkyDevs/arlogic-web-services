-- Optional media_type for service_documentation (image | video).
-- Default image so existing rows remain valid; new uploads set explicitly.

BEGIN;

ALTER TABLE public.service_documentation
  ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'image';

COMMENT ON COLUMN public.service_documentation.media_type IS
  'image | video — for correct gallery/timeline playback (Telegram proxy URLs have no extension)';

COMMIT;
