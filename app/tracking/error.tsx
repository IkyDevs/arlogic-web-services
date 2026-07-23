"use client";

export default function TrackingError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl text-red-400">!</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Gagal Memuat Tracking</h1>
        <p className="text-sm text-gray-500 mb-6">Terjadi kesalahan saat memuat data tracking. Silakan coba lagi.</p>
        <button onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-all text-sm">
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
