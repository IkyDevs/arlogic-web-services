"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-red-50 dark:bg-red-950/30 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl text-red-400">!</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Terjadi Kesalahan</h1>
        <p className="text-sm text-gray-500 mb-6">Maaf, terjadi kesalahan yang tidak terduga. Silakan coba lagi.</p>
        <button onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-all text-sm">
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
