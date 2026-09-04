/**
 * WhatsApp sharing utilities for Service Timeline.
 *
 * Centralizes phone normalization, URL construction, and message formatting
 * so that WhatsApp sharing logic is NOT duplicated across components.
 */

/**
 * Normalize an Indonesian phone number to the format expected by wa.me.
 *
 * Handles:
 *   081234567890  → 6281234567890
 *   +6281234567890 → 6281234567890
 *   6281234567890  → 6281234567890
 *   08 1234-5678-90 → 6281234567890
 *
 * Returns null if the phone is empty, too short, or not a valid Indonesian number.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;

  const digits = phone.replace(/\D/g, '');

  if (digits.length < 10 || digits.length > 15) return null;

  if (digits.startsWith('0')) return '62' + digits.substring(1);
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('+62')) return digits.substring(1);

  return null;
}

/**
 * Build a WhatsApp wa.me URL with a pre-filled text message.
 */
export function buildWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * Build a WhatsApp message from a Service Timeline update caption.
 *
 * Preserves the original caption text and wraps it with a friendly greeting/closing.
 */
export function buildTimelineUpdateMessage(caption: string): string {
  const trimmed = caption.trim();
  return `Halo Kak, berikut update service jam Kakak 😊🙏🏻\n\n${trimmed}\n\nTerima kasih sudah menunggu 🙏🏻`;
}

/**
 * Validate whether a phone number can be used for WhatsApp sharing.
 */
export function isValidWhatsAppPhone(phone: string | null | undefined): boolean {
  return normalizePhone(phone) !== null;
}
