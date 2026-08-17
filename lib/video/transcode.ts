import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import { getVideoDurationMs } from "@/lib/media-utils";

export type VideoCodec = "h264" | "hevc" | "other";

const HEVC_RE = /hvc1\.|hev1\./;
const H264_RE = /avc1\.|avc3\./;
const HEAD_BYTES = 4 * 1024 * 1024;
const MAX_INPUT_BYTES = 120 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 48 * 1024 * 1024;
const VIDEO_EXT_RE = /\.(mp4|mov|webm|3gp|3gpp|m4v)$/i;

let ffmpegPromise: Promise<FFmpeg> | null = null;

function loadFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    // Core single-threaded: tidak butuh SharedArrayBuffer/COOP-COEP headers
    ffmpegPromise = (async () => {
      const base = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(
          `${base}/ffmpeg-core.wasm`,
          "application/wasm",
        ),
        workerURL: await toBlobURL(
          `${base}/ffmpeg-core.worker.js`,
          "text/javascript",
        ),
      });
      return ffmpeg;
    })().catch((err) => {
      ffmpegPromise = null;
      throw err;
    });
  }
  return ffmpegPromise;
}

export function detectVideoCodec(bytes: Uint8Array): VideoCodec {
  const text = new TextDecoder("latin1").decode(bytes);
  if (HEVC_RE.test(text)) return "hevc";
  if (H264_RE.test(text)) return "h264";
  return "other";
}

function isVideoFile(file: File): boolean {
  return (
    file.type.startsWith("video/") || VIDEO_EXT_RE.test(file.name)
  );
}

type EncodeProfile = {
  maxSide: number;
  crf: number;
};

const FALLBACK_PROFILES: EncodeProfile[] = [
  { maxSide: 1920, crf: 23 },
  { maxSide: 1280, crf: 26 },
  { maxSide: 854, crf: 26 },
];

const AUDIO_KBPS = 96;
const MIN_VIDEO_KBPS = 350;
const MAX_VIDEO_KBPS = 12000;
const MAX_SIDE_BY_KBPS: Array<[number, number]> = [
  [4500, 1920],
  [2500, 1280],
  [1200, 854],
  [0, 640],
];

function resolutionForKbps(kbps: number): number {
  const entry = MAX_SIDE_BY_KBPS.find(([threshold]) => kbps >= threshold);
  return entry ? entry[1] : 640;
}

function clampKbps(kbps: number): number {
  return Math.max(MIN_VIDEO_KBPS, Math.min(MAX_VIDEO_KBPS, Math.floor(kbps)));
}

function targetKbpsForDuration(durationSec: number): number {
  const audioBits = AUDIO_KBPS * 1000 * durationSec;
  const videoBits = MAX_OUTPUT_BYTES * 8 - audioBits;
  return clampKbps(videoBits / durationSec / 1000);
}

async function encodeH264(
  ffmpeg: FFmpeg,
  file: File,
  profile: { maxSide: number; kbps: number },
  onProgress?: (percent: number) => void,
): Promise<Uint8Array> {
  const input = "input.bin";
  const output = "output.mp4";
  const onProgressCb = ({ progress }: { progress: number }) => {
    onProgress?.(Math.round(progress * 100));
  };
  ffmpeg.on("progress", onProgressCb);
  try {
    await ffmpeg.writeFile(input, new Uint8Array(await file.arrayBuffer()));
    const scale = `scale=w='if(gt(a,1),min(${profile.maxSide},iw),-2)':h='if(gt(a,1),-2,min(${profile.maxSide},ih))'`;
    const rateArgs =
      profile.kbps > 0
        ? ["-b:v", `${profile.kbps}k`, "-maxrate", `${Math.round(profile.kbps * 1.2)}k`, "-bufsize", `${profile.kbps * 2}k`]
        : [];
    await ffmpeg.exec([
      "-i",
      input,
      "-map",
      "0:v:0",
      "-vf",
      scale,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      ...rateArgs,
      "-pix_fmt",
      "yuv420p",
      "-map",
      "0:a?",
      "-c:a",
      "aac",
      "-b:a",
      "96k",
      "-movflags",
      "+faststart",
      output,
    ]);
    return (await ffmpeg.readFile(output)) as Uint8Array;
  } finally {
    ffmpeg.off("progress", onProgressCb);
    await ffmpeg.deleteFile(input).catch(() => {});
    await ffmpeg.deleteFile(output).catch(() => {});
  }
}

/**
 * Menjamin video yang dikirim bisa diputar + muat dalam 48MB (margin dari limit
 * 50MB Telegram) berapa pun durasi rekaman teknisi.
 * - Video HEVC/h.265 (iPhone) → transkode H.264.
 * - Video H.264 tapi >48MB → re-encode lebih kecil.
 * - Video normal (≤48MB, H.264/WebM) → tidak disentuh.
 * Gagal → throw pesan jelas agar upload tidak diam-diam menghasilkan video rusak.
 */
export async function ensureUploadableVideo(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<File> {
  if (!isVideoFile(file)) return file;
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error(
      "Video terlalu besar (>120MB). Potong videonya atau rekam dengan durasi lebih pendek.",
    );
  }

  let head: Uint8Array;
  try {
    head = new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer());
  } catch {
    return file;
  }

  const codec = detectVideoCodec(head);
  if (codec !== "hevc" && file.size <= MAX_OUTPUT_BYTES) return file;

  let ffmpeg: FFmpeg;
  try {
    ffmpeg = await loadFFmpeg();
  } catch {
    throw new Error(
      "Modul konversi video tidak dapat dimuat (periksa koneksi internet). Coba lagi.",
    );
  }

  let lastFailure = "ukuran tetap melebihi 48MB";
  const durationSec = (await getVideoDurationMs(file)) / 1000;

  if (Number.isFinite(durationSec) && durationSec > 0) {
    let kbps = targetKbpsForDuration(durationSec);
    let maxSide = resolutionForKbps(kbps);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const out = await encodeH264(ffmpeg, file, { maxSide, kbps }, onProgress);
        if (out.byteLength <= MAX_OUTPUT_BYTES) {
          const name = file.name.replace(/\.[^.]+$/, ".mp4");
          return new File([out as BlobPart], name, { type: "video/mp4" });
        }
        lastFailure = `ukuran tetap melebihi 48MB (${Math.round(out.byteLength / (1024 * 1024))}MB)`;
      } catch (e) {
        lastFailure =
          e instanceof Error ? `gagal dikonversi (${e.message})` : "gagal dikonversi";
      }
      kbps = clampKbps(kbps * 0.75);
      maxSide = resolutionForKbps(kbps);
    }
  }

  for (const profile of FALLBACK_PROFILES) {
    try {
      const out = await encodeH264(ffmpeg, file, { maxSide: profile.maxSide, kbps: 0 }, onProgress);
      if (out.byteLength <= MAX_OUTPUT_BYTES) {
        const name = file.name.replace(/\.[^.]+$/, ".mp4");
        return new File([out as BlobPart], name, { type: "video/mp4" });
      }
      lastFailure = `ukuran tetap melebihi 48MB (${Math.round(out.byteLength / (1024 * 1024))}MB)`;
    } catch (e) {
      lastFailure =
        e instanceof Error ? `gagal dikonversi (${e.message})` : "gagal dikonversi";
    }
  }

  throw new Error(
    `Video tidak dapat diproses: ${lastFailure}. Rekam ulang dengan durasi lebih pendek atau kualitas lebih rendah.`,
  );
}