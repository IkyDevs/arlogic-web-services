-- =====================================================
-- SPLIT PAYMENT MIGRATION
-- Adds support for split payment (2 payment methods)
-- =====================================================

DO $$
BEGIN
  -- Add split_payment boolean flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'split_payment'
  ) THEN
    ALTER TABLE layanan ADD COLUMN split_payment BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add metode_pembayaran_1
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'metode_pembayaran_1'
  ) THEN
    ALTER TABLE layanan ADD COLUMN metode_pembayaran_1 TEXT;
  END IF;

  -- Add nominal_1
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'nominal_1'
  ) THEN
    ALTER TABLE layanan ADD COLUMN nominal_1 NUMERIC DEFAULT 0;
  END IF;

  -- Add metode_pembayaran_2
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'metode_pembayaran_2'
  ) THEN
    ALTER TABLE layanan ADD COLUMN metode_pembayaran_2 TEXT;
  END IF;

  -- Add nominal_2
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'layanan' AND column_name = 'nominal_2'
  ) THEN
    ALTER TABLE layanan ADD COLUMN nominal_2 NUMERIC DEFAULT 0;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
