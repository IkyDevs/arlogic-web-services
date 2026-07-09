"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Server Error</h1>
            <p className="text-sm text-gray-500 mb-4">Terjadi kesalahan server. Silakan refresh halaman.</p>
            <p className="text-xs text-gray-400 mb-6 font-mono">{error.message}</p>
            <button onClick={reset}
              className="px-5 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-all text-sm">
              Refresh Halaman
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
