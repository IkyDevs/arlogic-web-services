"use client";

import { useRef } from "react";

interface VideoThumbProps {
  src: string;
  className?: string;
}

/**
 * Thumbnail video tanpa poster: minta browser seek ke frame awal (#t=0.1)
 * sehingga frame pertama muncul tanpa mengunduh seluruh file.
 */
export default function VideoThumb({ src, className }: VideoThumbProps) {
  const ref = useRef<HTMLVideoElement>(null);
  return (
    <video
      ref={ref}
      src={`${src}#t=0.1`}
      preload="metadata"
      muted
      playsInline
      onLoadedMetadata={() => {
        try {
          if (ref.current) ref.current.currentTime = 0.1;
        } catch {
          /* seek gagal di sebagian browser — tetap tampilkan overlay ▶ */
        }
      }}
      className={
        className || "w-full h-full object-contain bg-black"
      }
    />
  );
}