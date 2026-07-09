import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-gray-100 dark:bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl font-bold text-gray-300 dark:text-gray-600">404</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Halaman Tidak Ditemukan</h1>
        <p className="text-sm text-gray-500 mb-6">Halaman yang Anda cari tidak ada atau telah dipindahkan.</p>
        <Link href="/" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-all text-sm">
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
