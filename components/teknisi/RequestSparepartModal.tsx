"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { motion } from "framer-motion";
import {
  X,
  Send,
  Loader,
  CheckCircle,
  AlertCircle,
  Package,
  Clock,
} from "lucide-react";
import toast from "react-hot-toast";

interface RequestSparepartModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: any;
  onSuccess: () => void;
}

export default function RequestSparepartModal({
  isOpen,
  onClose,
  service,
  onSuccess,
}: RequestSparepartModalProps) {
  const [formData, setFormData] = useState({
    sparepart_name: "",
    sparepart_sku: "",
    quantity: 1,
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();
  const { user } = useAuthStore();

  const increaseQuantity = () => {
    setFormData({ ...formData, quantity: formData.quantity + 1 });
  };

  const decreaseQuantity = () => {
    if (formData.quantity > 1) {
      setFormData({ ...formData, quantity: formData.quantity - 1 });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.sparepart_name) {
      toast.error("Nama sparepart wajib diisi");
      return;
    }

    setLoading(true);

    try {
      // Update service order - status menjadi req_sparepart_admin
      const { error: updateError } = await supabase
        .from("service_orders")
        .update({
          status: "req_sparepart_admin",
          po_status: "pending",
          po_sparepart: formData.sparepart_name,
          po_requested_at: new Date().toISOString(),
          po_admin_response: formData.notes || "Menunggu konfirmasi admin",
        })
        .eq("id", service.id);

      if (updateError) throw updateError;

      // Add to timeline
      await supabase.from("service_timeline").insert({
        service_order_id: service.id,
        teknisi_id: user?.id,
        status: "req_sparepart_admin",
        message: `Request sparepart: ${formData.sparepart_name} (x${formData.quantity}) - Menunggu konfirmasi admin`,
        details: {
          action: "request_sparepart",
          sparepart_name: formData.sparepart_name,
          quantity: formData.quantity,
          notes: formData.notes,
        },
      });

      // Kirim notifikasi ke admin
      const { data: admins } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin");

      if (admins && admins.length > 0) {
        await supabase.from("notifications").insert(
          admins.map((admin: any) => ({
            user_id: admin.id,
            title: "📦 Request Sparepart (PO)",
            message: `${user?.full_name} membutuhkan ${formData.sparepart_name} (x${formData.quantity}) untuk service ${service.invoice_number}. ${formData.notes ? "Catatan: " + formData.notes : ""}`,
            type: "warning",
            link: "/admin",
            is_read: false,
          }))
        );
      }

      setSuccess(true);
      toast.success("Request sparepart terkirim! Menunggu konfirmasi admin.");

      setTimeout(() => {
        onSuccess();
        onClose();
        setSuccess(false);
      }, 3000);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-sm md:max-w-md lg:max-w-lg p-6 sm:p-8 text-center border border-slate-200"
        >
          <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">
            REQUEST TERKIRIM!
          </h3>
          <p className="text-slate-500 mb-4">
            Admin akan segera memproses permintaan sparepart.
          </p>
          <p className="text-sm text-yellow-600">Status: Request PO</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm md:max-w-md lg:max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200"
      >
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              REQUEST SPAREPART (PO)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-all"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>
                Sparepart tidak ditemukan di stock. Request akan dikirim ke
                admin untuk di-PO-kan.
              </span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1">
              Nama Sparepart <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.sparepart_name}
              onChange={(e) =>
                setFormData({ ...formData, sparepart_name: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 transition-all"
              placeholder="Contoh: Mesin A, Kaca Arloji..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1">
              SKU (Opsional)
            </label>
            <input
              type="text"
              value={formData.sparepart_sku}
              onChange={(e) =>
                setFormData({ ...formData, sparepart_sku: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 transition-all"
              placeholder="Kode SKU jika ada"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1">
              Jumlah
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={decreaseQuantity}
                className="w-9 h-9 border border-slate-200 rounded-lg font-bold hover:bg-slate-50 transition-all"
              >
                -
              </button>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    quantity: Math.max(1, parseInt(e.target.value) || 1),
                  })
                }
                min={1}
                className="w-20 text-center px-2 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
              <button
                type="button"
                onClick={increaseQuantity}
                className="w-9 h-9 border border-slate-200 rounded-lg font-bold hover:bg-slate-50 transition-all"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1">
              Catatan (Opsional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 transition-all resize-none"
              placeholder="Tambahan informasi untuk admin..."
            />
          </div>

          <div className="bg-[#F8F9FA] rounded-lg p-3 border border-slate-200">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
              Informasi Service
            </p>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-medium">{service.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice:</span>
                <span className="font-mono">{service.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Device:</span>
                <span>{service.watch_brand || service.device_brand}</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !formData.sparepart_name}
            className="w-full bg-yellow-500 text-white font-medium py-2.5 rounded-lg hover:bg-yellow-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            KIRIM REQUEST
          </button>
        </form>
      </motion.div>
    </div>
  );
}
