DROP POLICY IF EXISTS "Insert settings owner admin" ON business_settings;
CREATE POLICY "Insert settings owner admin" ON business_settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
