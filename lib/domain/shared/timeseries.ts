// ─── Time Series Bucketing ─────────────────────────────────────────
// Membagi timestamp mentah menjadi bucket harian/mingguan/bulanan.
// Zona waktu mengikuti konvensi project (Asia/Jakarta, lihat
// lib/domain/shared/formatters.ts).

export type TrendBucket = "harian" | "mingguan" | "bulanan";

export interface SeriesPoint {
  label: string;
  value: number;
}

const WIB = "Asia/Jakarta";
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const MONTH_MS = 30 * DAY_MS;
const MAX_BUCKETS = 120;

function dayStartWIB(t: number): number {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(t));
  return new Date(`${ymd}T00:00:00+07:00`).getTime();
}

function monthStartWIB(t: number): number {
  const d = new Date(t);
  d.setDate(1);
  return dayStartWIB(d.getTime());
}

function labelFor(bucketStartMs: number, bucketMs: number): string {
  const d = new Date(bucketStartMs);
  if (bucketMs === HOUR_MS) {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: WIB,
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }
  if (bucketMs === MONTH_MS) {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: WIB,
      month: "short",
      year: "2-digit",
    }).format(d);
  }
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB,
    day: "numeric",
    month: "short",
  }).format(d);
}

interface BucketLayout {
  starts: number[];
  bucketMs: number;
}

function layout(
  range: { start: number; end: number },
  requested: TrendBucket,
): BucketLayout {
  const span = Math.max(range.end - range.start, DAY_MS);

  // Rentang ≤ 36 jam + harian → per jam supaya tren hari ini tetap terbaca.
  if (requested === "harian" && span <= 36 * HOUR_MS) {
    const first = Math.floor(range.start / HOUR_MS) * HOUR_MS;
    const count = Math.min(Math.ceil((range.end - first) / HOUR_MS) + 1, MAX_BUCKETS);
    return {
      starts: Array.from({ length: count }, (_, i) => first + i * HOUR_MS),
      bucketMs: HOUR_MS,
    };
  }

  // Bulanan kalender; juga eskalasi otomatis bila titik terlalu banyak.
  if (requested === "bulanan" || span / DAY_MS > MAX_BUCKETS) {
    const first = monthStartWIB(range.start);
    const starts: number[] = [];
    const cursor = new Date(first);
    while (cursor.getTime() <= range.end && starts.length < MAX_BUCKETS) {
      starts.push(cursor.getTime());
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return { starts, bucketMs: MONTH_MS };
  }

  const bucketMs = requested === "mingguan" ? 7 * DAY_MS : DAY_MS;
  const first = dayStartWIB(range.start);
  const count = Math.ceil((range.end - first) / bucketMs) + 1;
  return {
    starts: Array.from({ length: count }, (_, i) => first + i * bucketMs),
    bucketMs,
  };
}

/** Menghitung jumlah kejadian per bucket dari daftar epoch-ms. */
export function buildSeries(
  timestamps: number[],
  range: { start: number; end: number },
  bucket: TrendBucket,
): SeriesPoint[] {
  const { starts, bucketMs } = layout(range, bucket);
  const values = new Array<number>(starts.length).fill(0);

  for (const ts of timestamps) {
    if (ts < range.start || ts > range.end) continue;
    for (let i = starts.length - 1; i >= 0; i--) {
      if (starts[i] <= ts) {
        values[i] += 1;
        break;
      }
    }
  }

  return starts.map((s, i) => ({ label: labelFor(s, bucketMs), value: values[i] }));
}
