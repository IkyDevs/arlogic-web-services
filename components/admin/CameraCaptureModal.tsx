"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Camera, Loader2, CheckCircle2 } from "lucide-react";

interface CameraCaptureModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (files: File[]) => void;
}

export default function CameraCaptureModal({ open, onClose, onCapture }: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState("");
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!open) return;
    setStarting(true);
    setError("");
    setCount(0);
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 2560 },
            height: { ideal: 1440 },
          },
          audio: false,
        });
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
      } catch {
        setError("Kamera tidak tersedia / izin ditolak. Pakai Upload from Gallery.");
      } finally {
        setStarting(false);
      }
    };
    start();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `camera_${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture([file]);
        setCount((c) => c + 1);
      },
      "image/jpeg",
      0.8,
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[95] p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-black rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-white" />
            <p className="text-sm font-semibold text-white">Take Photo</p>
            {count > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                <CheckCircle2 className="w-3 h-3" /> {count} foto
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg">
            <X className="w-4 h-4 text-gray-300" />
          </button>
        </div>

        <div className="relative aspect-[3/4] bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {starting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-xs">Menyiapkan kamera...</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}
        </div>

        <div className="p-4 space-y-3">
          <button
            onClick={capture}
            disabled={starting || !!error}
            className="w-full py-3 bg-white text-black rounded-xl text-sm font-bold hover:bg-gray-200 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Camera className="w-4 h-4" /> Ambil Foto
          </button>
          <p className="text-[11px] text-gray-400 text-center">
            Kamera tetap terbuka — ambil foto sebanyak yang dibutuhkan, lalu tutup.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
