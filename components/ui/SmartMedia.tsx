"use client";

import { useState } from "react";

interface SmartMediaProps {
  src: string | null | undefined;
  mediaType?: string | null;
  imgClassName?: string;
  videoClassName?: string;
  imgOnClick?: () => void;
  /** Jika true, video ditampilkan inline (bukan thumbnail yang diklik). */
  preferVideo?: boolean;
}

/**
 * Renderer media hasil upload: menggunakan media_type bila diketahui;
 * bila tidak (data lama sebelum media_type), coba deploy <img> dulu,
 * kalau gagal load (video lama tanpa media_type) otomatis beralih ke <video>.
 */
export default function SmartMedia({
  src,
  mediaType,
  imgClassName,
  videoClassName,
  imgOnClick,
  preferVideo,
}: SmartMediaProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  if (!src) return null;

  const isVideoKnown = mediaType === "video";
  const isImageKnown = mediaType === "image";
  const showVideo = preferVideo || isVideoKnown || (mediaType == null && imgFailed);

  if (showVideo) {
    if (videoFailed) {
      return (
        <div className="flex items-center justify-center bg-gray-100 border border-gray-200 rounded-lg p-4 text-center">
          <div>
            <p className="text-sm text-gray-500">Video tidak dapat diputar</p>
            <a href={src} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline mt-1 inline-block">Buka di tab baru</a>
          </div>
        </div>
      )
    }
    return (
      <video
        controls
        playsInline
        preload="metadata"
        onError={() => setVideoFailed(true)}
        className={videoClassName || "max-w-full rounded-lg bg-black"}
      >
        <source src={src} type="video/mp4" />
      </video>
    );
  }

  return (
    <img
      src={src}
      alt="Media"
      loading="lazy"
      onClick={imgOnClick}
      onError={() => setImgFailed(true)}
      className={imgClassName || "max-w-full h-auto"}
    />
  );
}