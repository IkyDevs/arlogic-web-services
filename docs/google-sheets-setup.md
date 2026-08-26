# Setup Google Spreadsheet Integration (Opsional)

Integrasi memakai **Apps Script Web App** milik spreadsheet Anda sendiri — tanpa OAuth global dan tanpa memberi akses database ke pihak luar. Database tetap **Source of Truth**; sheet memakai model **adjustment** (+/- dengan alasan), bukan overwrite.

## 1. Buat Spreadsheet

Buat 2 sheet/tab:

### Tab `Adjustments` (input admin gudang)

| Timestamp | SKU       | BranchID                             | Adjustment | Reason   | Status |
|-----------|-----------|--------------------------------------|-----------:|----------|--------|
| *(auto)*  | SP001     | 55401f0e-…                           |         +5 | Restock  |        |
| *(auto)*  | SP002     | 55401f0e-…                           |         -2 | Rusak    | OK     |

- **Adjustment** & **Reason**: diisi admin (wajib).
- **Status**: ditulis otomatis oleh sistem (`OK` / pesan error).
- Kolom lain jangan diedit manual.

### Tab `Snapshot` (read-only, hasil push)

Diisi ulang penuh setiap sync: `SKU, Nama, Kelas, BranchID, Quantity`.

## 2. Pasang Apps Script

Extensions → Apps Script → tempel kode berikut → Deploy → **Web App** → Execute as: *Me* → Who has access: *Anyone* → copy URL.

```javascript
const TOKEN = 'GANTI_DENGAN_TOKEN_RAHASIA_ANDA';

function doGet(e) {
  const t = e.parameter.token;
  if (t !== TOKEN) return json({ error: 'unauthorized' });
  if (e.parameter.action === 'snapshot_check') return json({ ok: true });

  const sh = SpreadsheetApp.getActive().getSheetByName('Adjustments');
  const rows = sh.getDataRange().getValues().slice(1);
  const pending = [];
  rows.forEach((r, i) => {
    if (!r[5]) pending.push({ row_id: i + 2, sku: String(r[1]), branch_id: String(r[2]), adjustment: Number(r[3]), reason: String(r[4] || '') });
  });
  return json({ rows: pending });
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (body.token !== TOKEN) return json({ error: 'unauthorized' });

  const ss = SpreadsheetApp.getActive();

  if (body.action === 'mark') {
    const sh = ss.getSheetByName('Adjustments');
    sh.getRange('F' + body.row_id).setValue(body.status);
    return json({ ok: true });
  }

  if (body.action === 'snapshot') {
    let sh = ss.getSheetByName('Snapshot') || ss.insertSheet('Snapshot');
    sh.clear();
    sh.appendRow(['SKU', 'Nama', 'Kelas', 'BranchID', 'Quantity']);
    body.rows.forEach((r) => sh.appendRow([r.sku, r.item_name, r.item_class, r.branch_id, r.quantity]));
    return json({ ok: true, count: body.rows.length });
  }

  return json({ error: 'unknown action' });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
```

## 3. Hubungkan di Aplikasi

Admin Gudang → **Inventaris → Gudang → Integrasi Google Spreadsheet**:
1. Tempel **URL Web App** & **Secret token**.
2. Centang **Enable** (+ **Auto sync** untuk polling ±60 detik saat halaman terbuka).
3. Simpan → **Sync Sekarang**.

## Jaminan Perilaku (sesuai keputusan final)

- Sheet **tidak bisa menulis langsung ke DB** — semua adjustment lewat RPC atomik yang sama dengan aplikasi (otorisasi + anti-minus tetap berlaku).
- Setiap adjustment tercatat di `stock_movements` dengan `source='google_sheets'`.
- Sync gagal ≠ inventory gagal: transaksi bisnis aman, sync tinggal diulang.
- Konflik diselesaikan sebagai akumulasi adjustment (20 +5 −2 = 23), bukan last-write-wins.
- Disable/disconnect → inventory berjalan normal 100%.
