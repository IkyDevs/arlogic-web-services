export function Loading({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-3 text-sm text-gray-500 font-medium">{text}</p>
      </div>
    </div>
  );
}
