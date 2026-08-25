"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Circle, Square, RefreshCcw, Check } from "lucide-react";

interface VideoRecorderModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (file: File) => void;
}

const MAX_DURATION_SECONDS = 600; // 10 menit — pengaman ukuran file

function pickMime(): string | null {
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

export default function VideoRecorderModal({ open, onClose, onConfirm }: VideoRecorderModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<"idle" | "camera" | "recording" | "review">("idle");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blobSize, setBlobSize] = useState(0);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    const mime = pickMime();
    if (!mime) {
      setError("Browser tidak mendukung perekaman video. Gunakan tombol pilih file sebagai alternatif.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setPhase("camera");
    } catch (e: any) {
      setError(
        e?.name === "NotAllowedError"
          ? "Akses kamera ditolak. Izinkan kamera di pengaturan browser."
          : "Kamera tidak tersedia: " + (e?.message || e?.name || ""),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = () => {
    const mime = pickMime();
    const stream = streamRef.current;
    if (!mime || !stream) return;

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 6_000_000,
      audioBitsPerSecond: 128_000,
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setBlobUrl(URL.createObjectURL(blob));
      setBlobSize(blob.size);
      setPhase("review");
      stopStream();
    };
    recorderRef.current = recorder;
    recorder.start(1000);
    setSeconds(0);
    timerRef.current = window.setInterval(() => {
      setSeconds((prev) => {
        if (prev + 1 >= MAX_DURATION_SECONDS) stopRecording();
        return prev + 1;
      });
    }, 1000);
    setPhase("recording");
  };

  function stopRecording() {
    recorderRef.current?.state === "recording" && recorderRef.current.stop();
  }

  // Mulai kamera otomatis saat modal dibuka
  useEffect(() => {
    if (open) void startCamera();
    else {
      stopStream();
      setPhase("idle");
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[90] p-4" onClick={() => { onClose(); stopStream(); }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-[#1c1c1c] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-gray-100">Rekam Video</h3>
          <button
            onClick={() => { onClose(); stopStream(); }}
            className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {error ? (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
              <video
                ref={videoRef}
                muted
                playsInline
                className={`w-full h-full object-cover ${phase === "camera" || phase === "recording" ? "" : "hidden"}`}
              />
              {phase === "review" && blobUrl && (
                <video ref={previewRef} src={blobUrl} controls playsInline className="w-full h-full" />
              )}
              {phase === "recording" && (
                <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 bg-black/60 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs font-mono font-bold text-white">{mmss}</span>
                </div>
              )}
            </div>
          )}

          {!error && phase === "recording" && (
            <button
              onClick={stopRecording}
              className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Square className="w-4 h-4 fill-current" /> Stop ({mmss})
            </button>
          )}

          {error ? null : phase === "review" && blobUrl ? (
            <div className="space-y-2">
              <p className="text-xs text-center text-slate-500">
                Ukuran: {(blobSize / 1024 / 1024).toFixed(1)}MB — otomatis dikompres bila melebihi 50MB
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (blobUrl) URL.revokeObjectURL(blobUrl);
                    setBlobUrl(null);
                    void startCamera();
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/5 inline-flex items-center justify-center gap-1.5"
                >
                  <RefreshCcw className="w-4 h-4" /> Ulangi
                </button>
                <button
                  onClick={() => {
                    fetch(blobUrl)
                      .then((r) => r.blob())
                      .then((b) => {
                        onConfirm(new File([b], `video_${Date.now()}${pickMime()?.includes("mp4") ? ".mp4" : ".webm"}`, { type: b.type || "video/webm" }));
                        onClose();
                      });
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Gunakan Video
                </button>
              </div>
            </div>
          ) : !error ? (
            <button
              onClick={startRecording}
              className="w-full py-3 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-semibold text-sm inline-flex items-center justify-center gap-2"
            >
              <Circle className="w-4 h-4 fill-current" /> Mulai Rekam
            </button>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
