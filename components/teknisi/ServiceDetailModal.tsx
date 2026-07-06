"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  User,
  Phone,
  Watch,
  AlertCircle,
  FileText,
  Calendar,
  Hash,
  CheckCircle,
  ArrowRight,
  Camera,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  Download,
  Clock,
  Tag,
  Package,
  Award,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "@/stores/authStore";

interface ServiceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: any;
  onTake: () => void;
  onSkip: () => void;
}

export default function ServiceDetailModal({
  isOpen,
  onClose,
  service,
  onTake,
  onSkip,
}: ServiceDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const supabase = createClient();
  const { user } = useAuthStore();

  useEffect(() => {
    if (service && isOpen) {
      fetchPhotos();
    }
  }, [service, isOpen]);

  const fetchPhotos = async () => {
    setLoadingPhotos(true);
    const { data } = await supabase
      .from("service_documentation")
      .select("photo_url")
      .eq("service_order_id", service.id)
      .order("created_at", { ascending: true });

    if (data) {
      setPhotos(data.map((p) => p.photo_url));
    }
    setLoadingPhotos(false);
  };

  const handleTake = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("service_orders")
        .update({
          assigned_teknisi_id: user?.id,
          status: "assigned",
          start_date: new Date().toISOString(),
        })
        .eq("id", service.id);

      if (error) throw error;

      await supabase.from("service_timeline").insert({
        service_order_id: service.id,
        teknisi_id: user?.id,
        status: "assigned",
        message: `Service diambil oleh teknisi ${user?.full_name}`,
        details: { action: "take_project" },
      });

      toast.success("Service berhasil diambil!");
      onTake();
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const nextPhoto = () => {
    if (photos.length > 0) {
      setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
    }
  };

  const prevPhoto = () => {
    if (photos.length > 0) {
      setCurrentPhotoIndex(
        (prev) => (prev - 1 + photos.length) % photos.length,
      );
    }
  };

  const downloadPhoto = (url: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `service_${service.invoice_number}_photo.jpg`;
    link.click();
    toast.success("Foto didownload!");
  };

  if (!isOpen || !service) return null;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-700",
      assigned: "bg-blue-100 text-blue-700",
      in_progress: "bg-purple-100 text-purple-700",
      qc_pending: "bg-orange-100 text-orange-700",
      completed: "bg-green-100 text-green-700",
      cancelled: "bg-red-100 text-red-700",
    };
    return colors[status] || "bg-slate-100 text-slate-700";
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white/95 backdrop-blur-sm sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl flex items-center justify-center shadow-sm">
                  <Watch className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Detail Service
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">
                      {service.invoice_number}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${getStatusColor(service.status)}`}
                    >
                      {service.status}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Photos Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-blue-600" />
                    <h4 className="text-sm font-medium text-slate-900">
                      Dokumentasi Service
                    </h4>
                    {photos.length > 0 && (
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        {photos.length} foto
                      </span>
                    )}
                  </div>
                  {photos.length > 0 && (
                    <button
                      onClick={() => setShowFullscreen(true)}
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
                      Lihat semua
                    </button>
                  )}
                </div>

                {loadingPhotos ? (
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border border-blue-600 border-t-transparent mx-auto" />
                    <p className="text-xs text-slate-400 mt-2">
                      Memuat foto...
                    </p>
                  </div>
                ) : photos.length === 0 ? (
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center border-dashed">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <ImageIcon className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-sm text-slate-400">
                      Belum ada foto dokumentasi
                    </p>
                    <p className="text-xs text-slate-300">
                      Foto akan muncul setelah teknisi upload
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {photos.slice(0, 6).map((photo, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50 cursor-pointer hover:shadow-md transition-all"
                        onClick={() => {
                          setCurrentPhotoIndex(index);
                          setShowFullscreen(true);
                        }}
                      >
                        <img
                          src={photo}
                          alt={`Service ${index + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                          <span className="text-white text-[10px] font-medium bg-black/50 px-2 py-0.5 rounded-full">
                            Foto {index + 1}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                    {photos.length > 6 && (
                      <div
                        className="aspect-square rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-[#F8F9FA] cursor-pointer hover:bg-slate-50 transition-all"
                        onClick={() => setShowFullscreen(true)}
                      >
                        <div className="text-center">
                          <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                          <span className="text-sm font-medium text-slate-500">
                            +{photos.length - 6} lagi
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Info Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Customer Info */}
                <div className="bg-[#F8F9FA] rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-4 h-4 text-slate-900" />
                    <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                      Customer
                    </h4>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-slate-900">
                      {service.customer_name}
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {service.customer_phone}
                    </p>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(service.created_at)}
                    </p>
                  </div>
                </div>

                {/* Watch Info */}
                <div className="bg-[#F8F9FA] rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Watch className="w-4 h-4 text-slate-900" />
                    <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                      Jam Tangan
                    </h4>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-slate-900">
                      {service.watch_brand || service.device_brand || "-"}
                      {service.watch_model && ` ${service.watch_model}`}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {service.watch_movement && (
                        <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-slate-200">
                          {service.watch_movement}
                        </span>
                      )}
                      {service.watch_condition && (
                        <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-slate-200">
                          {service.watch_condition}
                        </span>
                      )}
                    </div>
                    {service.serial_number && (
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        {service.serial_number}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Issue Description */}
              <div className="bg-[#F8F9FA] rounded-xl p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                    Deskripsi Kerusakan
                  </h4>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {service.issue_description}
                </p>
                {service.request && (
                  <>
                    <div className="h-px bg-slate-200 my-3" />
                    <p className="text-xs font-medium text-slate-500">
                      Request Customer
                    </p>
                    <p className="text-sm text-slate-700">{service.request}</p>
                  </>
                )}
                {service.notes && (
                  <>
                    <div className="h-px bg-slate-200 my-3" />
                    <p className="text-xs font-medium text-slate-500">
                      Catatan Tambahan
                    </p>
                    <p className="text-sm text-slate-700">{service.notes}</p>
                  </>
                )}
              </div>

              {/* Estimated Cost */}
              {service.estimated_cost && (
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-4 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm font-medium">
                        Estimasi Biaya
                      </span>
                    </div>
                    <span className="text-xl font-bold">
                      {formatCurrency(service.estimated_cost)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-slate-200 flex gap-3 bg-white/95 backdrop-blur-sm">
              <button
                onClick={onSkip}
                className="flex-1 bg-white text-slate-900 font-medium px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all"
              >
                Skip
              </button>
              <button
                onClick={handleTake}
                disabled={loading}
                className="flex-1 bg-slate-900 text-white font-medium px-4 py-2.5 rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                Ambil Service Ini
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>

          {/* Fullscreen Photo Modal */}
          {showFullscreen && photos.length > 0 && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-[60]">
              <div className="relative w-full max-w-4xl mx-auto p-4">
                <button
                  onClick={() => setShowFullscreen(false)}
                  className="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all"
                >
                  <X className="w-6 h-6" />
                </button>

                <div className="relative w-full h-[70vh] flex items-center justify-center">
                  <img
                    src={photos[currentPhotoIndex]}
                    alt={`Service photo ${currentPhotoIndex + 1}`}
                    className="max-w-full max-h-full object-contain rounded-xl"
                  />
                </div>

                <button
                  onClick={() => downloadPhoto(photos[currentPhotoIndex])}
                  className="absolute bottom-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all"
                >
                  <Download className="w-5 h-5" />
                </button>

                {photos.length > 1 && (
                  <>
                    <button
                      onClick={prevPhoto}
                      className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                      onClick={nextPhoto}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>

                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-1">
                      {photos.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentPhotoIndex(index)}
                          className={`w-2 h-2 rounded-full transition-all ${
                            index === currentPhotoIndex
                              ? "bg-white w-4"
                              : "bg-white/40"
                          }`}
                        />
                      ))}
                    </div>

                    <div className="absolute bottom-20 right-4 text-white/60 text-xs font-mono">
                      {currentPhotoIndex + 1} / {photos.length}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}
