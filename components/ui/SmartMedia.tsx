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
  if (!src) return null;

  const isVideoKnown = mediaType === "video";
  const isImageKnown = mediaType === "image";
  const showVideo = preferVideo || isVideoKnown || (mediaType == null && imgFailed);

  if (showVideo) {
    return (
      <video
        src={src}
        controls
        playsInline
        preload="metadata"
        className={videoClassName || "max-w-full rounded-lg bg-black"}
      />
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