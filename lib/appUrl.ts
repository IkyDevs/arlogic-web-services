/**
 * Base URL aplikasi untuk membangun link eksternal (tracking, QR, WhatsApp).
 * Sumber: NEXT_PUBLIC_APP_URL, fallback ke window.location.origin di client.
 *
 * Normalisasi: trim, tambahkan "https://" bila protokol hilang,
 * buang trailing slash agar concat path tidak menghasilkan "//".
 */
export function getAppUrl(): string {
  const raw = (
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "")
  ).trim();

  if (!raw) return "";

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  return withProtocol.replace(/\/+$/, "");
}

/**
 * URL tracking permanen satu service: /track/{invoice}/{accessCode}.
 * Fallback ke halaman generik /tracking bila access_code belum ada
 * (service lama yang belum kena backfill migration).
 */
export function buildServiceTrackingUrl(
  invoiceNumber: string | null | undefined,
  accessCode: string | null | undefined,
): string {
  const base = getAppUrl();
  if (invoiceNumber && accessCode) {
    return `${base}/track/${encodeURIComponent(invoiceNumber)}/${accessCode}`;
  }
  return `${base}/tracking`;
}
