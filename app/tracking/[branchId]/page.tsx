"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BranchTrackingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/tracking");
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
