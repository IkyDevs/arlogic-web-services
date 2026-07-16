"use client";

import { motion } from "framer-motion";

type SkeletonVariant = "text" | "card" | "avatar" | "table-row" | "chart";

interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string;
  height?: string;
  className?: string;
  count?: number;
}

const variants: Record<SkeletonVariant, { width: string; height: string; className: string }> = {
  text: { width: "100%", height: "0.875rem", className: "rounded" },
  card: { width: "100%", height: "6rem", className: "rounded-2xl" },
  avatar: { width: "2.5rem", height: "2.5rem", className: "rounded-full" },
  "table-row": { width: "100%", height: "1rem", className: "rounded" },
  chart: { width: "100%", height: "12rem", className: "rounded-2xl" },
};

function SkeletonItem({ variant = "text", width, height, className = "" }: SkeletonProps) {
  const v = variants[variant];
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-white/5 ${v.className} ${className}`}
      style={{
        width: width || v.width,
        height: height || v.height,
      }}
      aria-hidden="true"
    />
  );
}

export function Skeleton({ variant = "text", width, height, className, count = 1 }: SkeletonProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-3"
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonItem key={i} variant={variant} width={width} height={height} className={className} />
      ))}
      <span className="sr-only">Memuat...</span>
    </motion.div>
  );
}

export function CardSkeleton() {
  return (
    <div className="card p-4 space-y-3">
      <Skeleton variant="text" width="40%" />
      <Skeleton variant="text" width="60%" />
      <Skeleton variant="card" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="table-container p-4 space-y-4">
      <div className="flex gap-4">
        <Skeleton variant="text" width="25%" />
        <Skeleton variant="text" width="30%" />
        <Skeleton variant="text" width="20%" />
        <Skeleton variant="text" width="15%" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton variant="table-row" width="25%" />
          <Skeleton variant="table-row" width="30%" />
          <Skeleton variant="table-row" width="20%" />
          <Skeleton variant="table-row" width="15%" />
        </div>
      ))}
    </div>
  );
}
