"use client";

import "@/app/tracking/[[...slug]]/glacier.css";

export default function TrackingError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="glacier min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-red-400/10 border border-red-400/25 rounded-xl flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl text-red-400">!</span>
        </div>
        <h1 className="text-2xl font-bold text-[color:var(--gl-text)] mb-2">Gagal Memuat Tracking</h1>
        <p className="text-sm text-[color:var(--gl-text-secondary)] mb-6">Terjadi kesalahan saat memuat data tracking. Silakan coba lagi.</p>
        <button onClick={reset}
          className="gl-btn-primary inline-flex items-center gap-2 px-5 py-2.5 font-medium rounded-xl text-sm">
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
