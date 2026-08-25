/**
 * Kompresi video di sisi browser untuk memenuhi batas upload Telegram (50MB).
 * Strategi: decode via <video> → gambar ke <canvas> (resolusi diturunkan) →
 * re-encode via MediaRecorder dengan bitrate dihitung dari durasi agar hasil
 * <= target. Audio ikut via WebAudio tap ke MediaStreamDestination.
 *
 * Keterbatasan yang diketahui:
 * - Proses berjalan real-time (video diputar ulang), makan waktu ± durasi asli.
 * - Format output mengikuti dukungan browser (MP4/H264 di Safari modern,
 *   WebM/VP9-VP8 di Chrome/Firefox/Edge).
 */

export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const COMPRESS_TARGET_BYTES = 48 * 1024 * 1024;
const AUDIO_BITS_PER_SECOND = 128_000;
const MIN_VIDEO_BITS_PER_SECOND = 500_000;
const MAX_VIDEO_BITS_PER_SECOND = 8_000_000;
const MAX_DIMENSION = 1280;

export function isVideoFileByName(file: File): boolean {
  return (
    file.type.startsWith("video/") ||
    /\.(mp4|mov|webm|3gp|3gpp|avi|mkv)$/i.test(file.name)
  );
}

export function needsVideoCompression(file: File): boolean {
  return isVideoFileByName(file) && file.size > VIDEO_MAX_BYTES;
}

function pickRecorderMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) || null;
}

export function canCompressVideos(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    !!HTMLCanvasElement.prototype.captureStream &&
    !!pickRecorderMime()
  );
}

function extFromMime(mime: string): string {
  return mime.includes("mp4") ? ".mp4" : ".webm";
}

function baseName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

/**
 * Kompres video hingga <= ~48MB. Melempar Error dengan pesan siap-tampil
 * (Bahasa Indonesia) bila browser tidak mendukung atau proses gagal.
 */
export async function compressVideo(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<File> {
  const mimeType = pickRecorderMime();
  if (!mimeType || !canCompressVideos()) {
    throw new Error(
      "Browser ini tidak mendukung kompresi video. Potong ukuran video di galeri/kamera, lalu coba lagi.",
    );
  }

  const sourceUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  let audioCtx: AudioContext | null = null;
  video.src = sourceUrl;
  video.muted = false;
  video.playsInline = true;
  video.preload = "auto";

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () =>
        reject(new Error("Gagal membaca video — format mungkin tidak didukung browser."));
    });

    const duration = video.duration;
    if (!isFinite(duration) || duration <= 0) {
      throw new Error("Durasi video tidak terbaca — tidak bisa dikompres.");
    }

    // Skala resolusi: maksimal MAX_DIMENSION pada sisi terpanjang
    const scale = Math.min(1, MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(2, Math.round(video.videoWidth * scale / 2) * 2);
    canvas.height = Math.max(2, Math.round(video.videoHeight * scale / 2) * 2);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas tidak tersedia di browser ini.");

    const stream = canvas.captureStream(30);

    // Tap audio dari elemen video (fallback: tanpa audio bila gagal)
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioCtx = new AudioCtx();
        const srcNode = audioCtx.createMediaElementSource(video);
        const dest = audioCtx.createMediaStreamDestination();
        srcNode.connect(dest);
        srcNode.connect(audioCtx.destination);
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      }
    } catch {
      /* lanjut tanpa audio */
    }

    const totalBits = COMPRESS_TARGET_BYTES * 8;
    const videoBitsPerSecond = Math.min(
      MAX_VIDEO_BITS_PER_SECOND,
      Math.max(MIN_VIDEO_BITS_PER_SECOND, Math.floor(totalBits / duration) - AUDIO_BITS_PER_SECOND),
    );

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond,
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const finished = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      recorder.onerror = () => reject(new Error("Perekaman kompresi gagal."));
      video.onended = () => {
        if (recorder.state !== "inactive") recorder.stop();
      };
    });

    // Gambar frame ke canvas selama pemutaran
    const draw = () => {
      if (video.ended || video.paused) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (onProgress) {
        onProgress(Math.min(99, Math.round((video.currentTime / duration) * 100)));
      }
      requestAnimationFrame(draw);
    };

    recorder.start(1000);
    await video.play().catch(() => undefined);
    requestAnimationFrame(draw);

    const blob = await finished;

    if (!blob || blob.size === 0) {
      throw new Error("Hasil kompresi kosong — coba lagi.");
    }
    if (blob.size > VIDEO_MAX_BYTES) {
      throw new Error(
        `Setelah dikompres masih ${(blob.size / 1024 / 1024).toFixed(1)}MB (>50MB). Potong durasi video lalu coba lagi.`,
      );
    }

    const compressed = new File([blob], baseName(file.name) + extFromMime(mimeType), {
      type: mimeType,
      lastModified: Date.now(),
    });
    onProgress?.(100);
    return compressed;
  } finally {
    URL.revokeObjectURL(sourceUrl);
    video.pause?.();
    video.removeAttribute("src");
    audioCtx?.close().catch(() => undefined);
  }
}

/** Pastikan file video <= batas; kompres bila perlu. File non-video dilewati. */
export async function ensureVideoUnderLimit(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<File> {
  if (!needsVideoCompression(file)) return file;
  return compressVideo(file, onProgress);
}
