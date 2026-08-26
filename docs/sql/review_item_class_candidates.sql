-- ============================================================================
-- REVIEW KANDIDAT RETAG item_class (keputusan final #6)
--
-- JANGAN menjalankan UPDATE otomatis berbasis tebakan nama.
-- Langkah wajib:
--   1. Jalankan query kandidat di bawah → export hasil → review manual.
--   2. Retag yang PASTI benar via menu Inventaris (dropdown Jenis Stock)
--      atau UPDATE eksplisit per-ID (contoh di bagian bawah).
--   3. Item yang tidak dapat dipastikan = biarkan default 'sparepart'
--      dan tandai UNKNOWN di catatan migrasi.
-- ============================================================================

-- Kandidat JAM (indikator kuat): kategori/nama mengandung kata jam,
-- atau SKU berawalan 'JM'/'JAM' (sesuaikan dengan konvensi data Anda).
select id, sku, item_name, category, store_stock, warehouse_stock, item_class,
       case
         when lower(item_name) like '%jam %' or item_name ilike 'jam%'
              or lower(category) like '%jam%' then 'kandidat jam'
         else 'perlu review'
       end as hint
  from public.inventory
 where lower(item_name) like '%jam %'
    or item_name ilike 'jam%'
    or lower(category) like '%jam%'
 order by item_name;

-- Contoh retag EKSPLISIT setelah review (satu per satu, jadi jejak audit jelas):
-- update public.inventory set item_class = 'jam' where id = '<UUID_TERVERIFIKASI>';
