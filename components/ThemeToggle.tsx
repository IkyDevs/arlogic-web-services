"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

const subscribeNoop = () => () => {};

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // Hydration-safe "mounted" tanpa setState di effect
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  const isDark = resolvedTheme !== "light";
  const toggle = () => setTheme(isDark ? "light" : "dark");

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Aktifkan Light Mode" : "Aktifkan Dark Mode"}
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        color: "var(--color-text-secondary)",
      }}
      className="p-2 rounded-lg border transition-all duration-150 hover:opacity-80 flex-shrink-0"
      title={isDark ? "Aktifkan Light Mode" : "Aktifkan Dark Mode"}
    >
      {!mounted ? (
        <span className="w-4 h-4 block" />
      ) : isDark ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  );
}
