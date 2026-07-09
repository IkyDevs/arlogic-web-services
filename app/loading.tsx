export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0a0a0a]">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-sm text-gray-500 font-medium">Memuat...</p>
      </div>
    </div>
  );
}
