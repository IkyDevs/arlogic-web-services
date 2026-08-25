"use client";

import { use, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { Watch, AlertCircle } from "lucide-react";
import { TrackingContent } from "@/app/tracking/[[...slug]]/page";
import "@/app/tracking/[[...slug]]/glacier.css";

const supabase = createClient();

type LoadState = "loading" | "invalid" | "ready";

export default function MagicTrackPage({
  params,
}: {
  params: Promise<{ invoice: string; code: string }>;
}) {
  const { invoice, code } = use(params);
  const [state, setState] = useState<LoadState>("loading");
  const [service, setService] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const decodedInvoice = decodeURIComponent(invoice || "").trim();
        const accessCode = decodeURIComponent(code || "").trim().toUpperCase();
        if (!decodedInvoice || !accessCode) {
          if (alive) setState("invalid");
          return;
        }

        const { data, error } = await supabase
          .from("service_orders")
          .select("*")
          .eq("invoice_number", decodedInvoice)
          .eq("access_code", accessCode)
          .maybeSingle();

        if (!alive) return;
        if (error || !data) {
          setState("invalid");
          return;
        }
        setService(data);
        setState("ready");
      } catch {
        if (alive) setState("invalid");
      }
    })();
    return () => {
      alive = false;
    };
  }, [invoice, code]);

  if (state === "loading") {
    return (
      <div className="glacier min-h-screen flex items-center justify-center p-4">
        <div className="w-8 h-8 border-2 border-[#7dd3fc] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state === "invalid" || !service) {
    return (
      <div className="glacier min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="gl-card w-full max-w-md p-8 text-center"
        >
          <div className="w-16 h-16 bg-red-400/10 border border-red-400/25 rounded-xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-[color:var(--gl-text)]">Link Tidak Valid</h1>
          <p className="text-sm text-[color:var(--gl-text-secondary)] mt-2">
            Link tracking ini tidak dikenali atau sudah tidak berlaku.
            Pastikan Anda membuka link persis seperti yang dikirimkan admin,
            atau hubungi admin cabang untuk mendapatkan link terbaru.
          </p>
          <div className="mt-6 gl-inset p-4 flex items-center justify-center gap-2">
            <Watch className="w-4 h-4 gl-ice" />
            <span className="text-xs font-semibold gl-ice">ARLOGIC SERVICE TRACKER</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return <TrackingContent presetService={service} />;
}
