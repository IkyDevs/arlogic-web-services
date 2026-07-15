# Supabase Schema

## Migration Log

### 2026-07-15 — GRANT layanan_items

**Masalah**: Error `permission denied for table layanan_items` saat insert extra items dari LayananForm. Tabel `layanan_items` dibuat setelah `GRANT ALL ON ALL TABLES` dijalankan, sehingga role `authenticated` tidak punya akses.

**Fix**: Tambah GRANT eksplisit:

```sql
GRANT ALL ON TABLE layanan_items TO authenticated;
GRANT ALL ON TABLE layanan_items TO service_role;
```
