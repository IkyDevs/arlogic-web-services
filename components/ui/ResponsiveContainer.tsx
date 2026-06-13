"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
}

const maxWidths = {
  sm: "max-w-screen-sm",
  md: "max-w-screen-md",
  lg: "max-w-screen-lg",
  xl: "max-w-screen-xl",
  "2xl": "max-w-screen-2xl",
  full: "max-w-full",
};

export default function ResponsiveContainer({
  children,
  className = "",
  maxWidth = "xl",
}: ResponsiveContainerProps) {
  return (
    <div
      className={`w-full px-4 sm:px-6 lg:px-8 mx-auto ${maxWidths[maxWidth]} ${className}`}
    >
      {children}
    </div>
  );
}
