"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useBranchScope } from "@/lib/context/useBranchScope";
import { useAuthStore } from "@/stores/authStore";
import { ServiceOrder } from "@/types";
import toast from "react-hot-toast";
import { useCentralUpload } from "@/hooks/useCentralUpload";
import { buildTelegramMetadata } from "@/lib/telegram-metadata";
import { mediaTypeFromFile, isPlayableVideo } from "@/lib/media-utils";
import SmartMedia from "@/components/ui/SmartMedia";
import VideoThumb from "@/components/ui/VideoThumb";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  Undo2,
  Clock,
  Wrench,
  Calendar,
  User,
  Watch,
  Eye,
  Package,
  AlertCircle,
  Phone,
  MessageSquare,
  ShoppingCart,
  Truck,
  X,
  ChevronRight,
  RefreshCw,
  Search,
  FileText,
  Box,
  Bell,
  Camera,
  Check,
  Trash2,
  Loader,
  Loader2,
  ImageIcon,
} from "lucide-react";
import ServiceDetailModal from "./ServiceDetailModal";
import ServiceTimeline from "./ServiceTimeline";
import ProgressUpdate from "./ProgressUpdate";

import AddJasaModal from "./AddJasaModal";
import AddSparepartModal from "./AddSparepartModal";
import RequestSparepartModal from "./RequestSparepartModal";
import SubmitQCModal from "./SubmitQCModal";
import { Skeleton } from "@/components/ui/Skeleton";

interface QueueListProps {
  teknisiId: string;
  onTakeProject: (project: ServiceOrder) => void;
  forcedTab?: "available" | "my" | "pending";
}

interface ExtendedServiceOrder extends ServiceOrder {
  teknisi_pending_reason?: string;
  pending_teknisi_approved?: boolean | null;
  last_update?: {
    id: string;
    message: string;
    status: string;
    created_at: string;
    photo_url?: string;
    details?: any;
  };
}

function getTransferBadge(service: ExtendedServiceOrder) {
  const lu = service.last_update;
  if (!lu || lu.status !== "transferred") return null;
  const fromName = lu.details?.from_branch_name || lu.details?.from_branch || null;
  return fromName ? `Transfer dari ${fromName}` : "Transfer dari cabang lain";
}

const MAX_FILES = 10;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_TOTAL_SIZE = 4 * 1024 * 1024; // 4MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
];

const INITIAL_CONDITION_STAGE = "initial_condition";
const FRONT_PHOTO_LABEL = "depan";

const DARK_BADGE: Record<string, string> = {
  assigned: "dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/25",
  in_progress:
    "dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25",
  req_sparepart_admin:
    "dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/25",
  po_pending:
    "dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/25",
  sparepart_ready:
    "dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25",
  qc_pending:
    "dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/25",
  revision_required:
    "dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/25",
  pending: "dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
  completed:
    "dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25",
};

export default function QueueList({
  teknisiId,
  onTakeProject,
  forcedTab,
}: QueueListProps) {
  const [pendingServices, setPendingServices] = useState<
    ExtendedServiceOrder[]
  >([]);
  const [myServices, setMyServices] = useState<ExtendedServiceOrder[]>([]);
  const [teknisiPendingServices, setTeknisiPendingServices] = useState<
    ExtendedServiceOrder[]
  >([]);
  const [selectedService, setSelectedService] =
    useState<ExtendedServiceOrder | null>(null);
  const [queueTab, setQueueTab] = useState<"available" | "my" | "pending">(
    forcedTab ?? "available",
  );
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showPendingReasonModal, setShowPendingReasonModal] = useState(false);
  const [pendingReason, setPendingReason] = useState("");
  const [submittingPending, setSubmittingPending] = useState(false);
  const [pendingTargetService, setPendingTargetService] =
    useState<ExtendedServiceOrder | null>(null);

  const [showAddJasa, setShowAddJasa] = useState(false);
  const [showAddSparepart, setShowAddSparepart] = useState(false);
  const [showRequestSparepart, setShowRequestSparepart] = useState(false);
  const [requestSparepartQuery, setRequestSparepartQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [serviceSearch, setServiceSearch] = useState("");

  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showSubmitQCModal, setShowSubmitQCModal] = useState(false);
  const [showServiceInfoModal, setShowServiceInfoModal] = useState(false);
  const [qcPhotos, setQCPhotos] = useState<File[]>([]);
  const [qcPhotoPreviews, setQCPhotoPreviews] = useState<string[]>([]);
  const [qcItems, setQCItems] = useState<any[]>([]);
  const [qcTotalCost, setQCTotalCost] = useState(0);
  const [qcSubmitting, setQCSubmitting] = useState(false);
  const [qcNotes, setQCNotes] = useState("");
  const qcFileInputRef = useRef<HTMLInputElement>(null);
  const [editingPrice, setEditingPrice] = useState<{ [key: number]: number }>(
    {},
  );
  const qcInitialItemsRef = useRef<any[]>([]);
  const [serviceInfoPhotos, setServiceInfoPhotos] = useState<string[]>([]);
  const [serviceInfoPhotoTypes, setServiceInfoPhotoTypes] = useState<
    Array<"image" | "video">
  >([]);
  const [serviceInfoPhotosLoading, setServiceInfoPhotosLoading] =
    useState(false);

  const supabase = createClient();
  const { branchId } = useBranchScope();
  const { user } = useAuthStore();
  const [sessionKey] = useState(
    () => `qc_queue_${user?.id || "anon"}_${Date.now()}`,
  );
  const upload = useCentralUpload(sessionKey);
  const [localProgress, setLocalProgress] = useState(0);

  useEffect(() => {
    fetchQueues();

    const channel = supabase
      .channel("teknisi_queue_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_orders" },
        () => {
          fetchQueues();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "service_timeline" },
        () => {
          fetchQueues();
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [teknisiId]);

  const fetchQueues = async () => {
    setLoading(true);

    const [pendingRes, assignedRes] = await Promise.all([
      supabase
        .from("service_orders")
        .select("*")
        .eq("status", "pending")
        .match(branchId ? { branch_id: branchId } : {})
        .order("created_at", { ascending: true }),
      supabase
        .from("service_orders")
        .select("*")
        .eq("assigned_teknisi_id", teknisiId)
        .in("status", [
          "assigned",
          "in_progress",
          "req_sparepart_admin",
          "po_pending",
          "sparepart_ready",
          "revision_required",
        ])
        .order("created_at", { ascending: false }),
    ]);

    const assigned = assignedRes.data || [];

    // Fetch latest timeline for all assigned services
    if (assigned.length > 0) {
      const ids = assigned.map((s) => s.id);
      const { data: timelines } = await supabase
        .from("service_timeline")
        .select("service_order_id, status, created_at, details, message")
        .in("service_order_id", ids)
        .order("created_at", { ascending: false });

      if (timelines) {
        const latestTimeline: Record<string, any> = {};
        for (const t of timelines) {
          if (!latestTimeline[t.service_order_id]) {
            latestTimeline[t.service_order_id] = t;
          }
        }
        for (const s of assigned) {
          (s as any).last_update = latestTimeline[s.id] || null;
        }
      }
    }

    // Split assigned into active vs pending by checking last_update (latest timeline)
    let active: ExtendedServiceOrder[] = [];
    let pendingTek: ExtendedServiceOrder[] = [];

    for (const s of assigned) {
      const tlStatus = (s as any).last_update?.status || "";

      if (tlStatus === "pending_teknisi" || tlStatus === "pending_approved") {
        (s as any)._pendingStatus = tlStatus;
        (s as any)._pendingReason =
          (s as any).last_update?.details?.reason ||
          (s as any).last_update?.message ||
          "";
        pendingTek.push(s as ExtendedServiceOrder);
      } else {
        active.push(s as ExtendedServiceOrder);
      }
    }

    if (pendingRes.data && pendingRes.data.length > 0) {
      const pendingIds = pendingRes.data.map((s) => s.id);
      const { data: frontPhotos } = await supabase
        .from("service_documentation")
        .select("service_order_id, photo_url, media_type")
        .in("service_order_id", pendingIds)
        .eq("stage", INITIAL_CONDITION_STAGE)
        .eq("label", FRONT_PHOTO_LABEL)
        .order("created_at", { ascending: true });

      if (frontPhotos) {
        const frontPhotoMap: Record<
          string,
          { url: string; isVideo: boolean }
        > = {};
        for (const p of frontPhotos) {
          if (!p.photo_url || frontPhotoMap[p.service_order_id]) continue;
          frontPhotoMap[p.service_order_id] = {
            url: p.photo_url,
            isVideo: isPlayableVideo(p.media_type, p.photo_url),
          };
        }
        for (const s of pendingRes.data) {
          (s as any)._frontPhoto = frontPhotoMap[s.id] || null;
        }
      }
    }

    if (pendingRes.data)
      setPendingServices(pendingRes.data as ExtendedServiceOrder[]);
    if (active) setMyServices(active);
    if (pendingTek) setTeknisiPendingServices(pendingTek);
    setLoading(false);
  };

  const [showTakeConfirm, setShowTakeConfirm] = useState(false);
  const [pendingTakeService, setPendingTakeService] =
    useState<ExtendedServiceOrder | null>(null);
  const [takingProject, setTakingProject] = useState(false);

  const requestTakeProject = async (service: ExtendedServiceOrder) => {
    setPendingTakeService(service);
    setShowTakeConfirm(true);
  };

  const confirmTakeProject = async () => {
    if (!pendingTakeService) return;
    if (takingProject) return;
    setTakingProject(true);

    const serviceToTake = pendingTakeService;

    setPendingServices((prev) => prev.filter((s) => s.id !== serviceToTake.id));
    setMyServices((prev) => [{ ...serviceToTake, status: "assigned", assigned_teknisi_id: teknisiId } as any, ...prev]);
    setShowTakeConfirm(false);
    setPendingTakeService(null);
    setShowDetailModal(false);

    const activeUser = (await supabase.auth.getUser()).data.user;
    const activeTeknisiId = activeUser?.id || teknisiId;

    if (!activeTeknisiId) {
      toast.error("Gagal memverifikasi identitas teknisi. Silakan refresh.");
      fetchQueues();
      setTakingProject(false);
      return;
    }

    const { data: updatedRows, error } = await supabase
      .from("service_orders")
      .update({
        assigned_teknisi_id: activeTeknisiId,
        status: "assigned",
        start_date: new Date().toISOString(),
      })
      .eq("id", serviceToTake.id)
      .is("assigned_teknisi_id", null)
      .select();

    if (error) {
      toast.error("Gagal mengambil proyek: " + error.message);
      fetchQueues();
    } else if (!updatedRows || updatedRows.length === 0) {
      toast.error("Proyek ini baru saja diambil oleh teknisi lain!");
      fetchQueues();
    } else {
      await supabase.from("service_timeline").insert({
        service_order_id: serviceToTake.id,
        teknisi_id: activeTeknisiId,
        status: "assigned",
        message: `Service diambil oleh teknisi`,
        details: { action: "take_project" },
      });
      toast.success("Proyek berhasil diambil!");
    }
    setTakingProject(false);
  };

  const cancelTakeProject = () => {
    setShowTakeConfirm(false);
    setPendingTakeService(null);
  };

  const returnServiceToQueue = async (service: ExtendedServiceOrder) => {
    if (!confirm(`Kembalikan "${service.customer_name}" ke list service?`))
      return;
    try {
      const { error } = await supabase
        .from("service_orders")
        .update({
          assigned_teknisi_id: null,
          status: "pending",
        })
        .eq("id", service.id);

      if (error) throw error;

      await supabase.from("service_timeline").insert({
        service_order_id: service.id,
        teknisi_id: teknisiId,
        status: "returned_to_queue",
        message: "Service dikembalikan ke antrian oleh teknisi",
        details: { action: "return_to_queue" },
      });

      toast.success("Service berhasil dikembalikan ke list!");
      fetchQueues();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const takeWithPending = async (service: ExtendedServiceOrder) => {
    setPendingTargetService(service);
    setPendingReason("");
    setShowPendingReasonModal(true);
  };

  const submitPending = async () => {
    if (!pendingTargetService || !pendingReason.trim()) {
      toast.error("Alasan pending harus diisi");
      return;
    }
    if (submittingPending) return;
    setSubmittingPending(true);

    try {
      const activeUser = (await supabase.auth.getUser()).data.user;
      const activeTeknisiId = activeUser?.id || teknisiId;

      const { data: updatedRows, error: updateErr } = await supabase
        .from("service_orders")
        .update({ assigned_teknisi_id: activeTeknisiId, status: "assigned" })
        .eq("id", pendingTargetService.id)
        .is("assigned_teknisi_id", null)
        .select();

      if (updateErr) {
        toast.error("Gagal update: " + updateErr.message);
        return;
      }

      if (!updatedRows || updatedRows.length === 0) {
        // Guard atomic menolak — cek apakah pemiliknya justru diri sendiri
        // (dobel-klik). Kalau iya, anggap sukses tanpa timeline dobel.
        const { data: current } = await supabase
          .from("service_orders")
          .select("assigned_teknisi_id")
          .eq("id", pendingTargetService.id)
          .maybeSingle();

        if (current?.assigned_teknisi_id === activeTeknisiId) {
          toast.success("Proyek ini sudah kamu pending-kan — menunggu persetujuan QC");
          setShowPendingReasonModal(false);
          setPendingTargetService(null);
          fetchQueues();
          return;
        }
        toast.error("Proyek ini baru saja diambil oleh teknisi lain!");
        fetchQueues();
        setShowPendingReasonModal(false);
        setPendingTargetService(null);
        return;
      }

      const { error: tlErr } = await supabase.from("service_timeline").insert({
        service_order_id: pendingTargetService.id,
        teknisi_id: activeTeknisiId,
        status: "pending_teknisi",
        message: `Ditunda oleh teknisi: ${pendingReason.trim()}`,
        details: { action: "take_pending", reason: pendingReason.trim() },
      });
      if (tlErr) {
        toast.error("Gagal simpan alasan: " + tlErr.message);
        return;
      }

      toast.success("Proyek ditunda, menunggu persetujuan QC.");
      setShowPendingReasonModal(false);
      setPendingReason("");
      setPendingTargetService(null);
      fetchQueues();
    } finally {
      setSubmittingPending(false);
    }
  };

  const resumeProject = async (service: ExtendedServiceOrder) => {
    const { error } = await supabase.from("service_timeline").insert({
      service_order_id: service.id,
      teknisi_id: teknisiId,
      status: "pending_resumed",
      message: `Service dilanjutkan oleh teknisi`,
      details: { action: "pending_resumed" },
    });
    if (error) {
      toast.error("Gagal: " + error.message);
      return;
    }
    toast.success("Service dilanjutkan!");
    fetchQueues();
  };

  const sendReminderToAdmin = async (service: ExtendedServiceOrder) => {
    try {
      const { data: admins } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin");

      if (admins && admins.length > 0) {
        const notifications: any[] = [];
        for (const admin of admins) {
          notifications.push({
            user_id: admin.id,
            title: "⏰ Reminder: PO Belum Direspon",
            message: `PO untuk ${service.invoice_number} (${service.po_sparepart}) belum direspon oleh admin.`,
            type: "warning",
            link: "/admin",
            is_read: false,
          });
        }
        if (notifications.length > 0) {
          await supabase.from("notifications").insert(notifications);
        }
      }
      toast.success("Peringatan terkirim ke admin!");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const openAddJasa = (service: ExtendedServiceOrder) => {
    setSelectedService(service);
    setShowAddJasa(true);
  };

  const openAddSparepart = (service: ExtendedServiceOrder) => {
    setSelectedService(service);
    setShowAddSparepart(true);
  };

  const openRequestSparepart = (
    service: ExtendedServiceOrder,
    query?: string,
  ) => {
    setSelectedService(service);
    setRequestSparepartQuery(query || "");
    setShowRequestSparepart(true);
  };

  const openProgressUpdate = (service: ExtendedServiceOrder) => {
    setSelectedService(service);
    setShowProgressModal(true);
  };

  const openUpdate = (service: ExtendedServiceOrder) => {
    setSelectedService(service);
    setShowUpdateModal(true);
  };

  const openSubmitQC = async (service: ExtendedServiceOrder) => {
    setSelectedService(service);
    setShowSubmitQCModal(true);
  };

  const fetchQCItems = async (serviceId: string) => {
    const { data } = await supabase
      .from("service_items")
      .select("*")
      .eq("service_order_id", serviceId);
    if (data) {
      setQCItems(data);
      qcInitialItemsRef.current = JSON.parse(JSON.stringify(data));
      setQCTotalCost(
        data.reduce(
          (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
          0,
        ),
      );
    } else {
      setQCItems([]);
      setQCTotalCost(0);
    }
  };

  const handleQCPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("handleQCPhotoUpload triggered", {
      event: e,
      filesSelected: e.target.files?.length,
    });
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // Clear input to allow re-uploading same file after removal

    const validFiles: File[] = [];
    const validPreviews: string[] = [];
    let currentTotalSize = qcPhotos.reduce((sum, file) => sum + file.size, 0);
    console.log(
      "Initial qcPhotos count:",
      qcPhotos.length,
      "currentTotalSize:",
      currentTotalSize,
    );

    // Validate each new file
    for (const file of files) {
      console.log(
        `Validating file: ${file.name}, size: ${file.size}, type: ${file.type}`,
      );

      if (qcPhotos.length + validFiles.length >= MAX_FILES) {
        toast.error(
          `Maksimal ${MAX_FILES} foto diizinkan. ${file.name} tidak ditambahkan.`,
        );
        console.warn(`File ${file.name} rejected: Max files reached.`);
        break; // Stop adding more files if max is reached
      }

      if (file.size > MAX_FILE_SIZE) {
        toast.error(
          `"${file.name}" terlalu besar (maksimal ${MAX_FILE_SIZE / (1024 * 1024)}MB).`,
        );
        console.warn(`File ${file.name} rejected: Size too large.`);
        continue; // Skip this file
      }

      if (
        !ALLOWED_TYPES.includes(file.type) &&
        !file.name.match(/\.(jpg|jpeg|png|webp|heic|heif|avif)$/i)
      ) {
        toast.error(`"${file.name}" bukan format gambar yang didukung.`);
        console.warn(`File ${file.name} rejected: Invalid type.`);
        continue; // Skip this file
      }

      // Check total size with existing and valid new files
      if (currentTotalSize + file.size > MAX_TOTAL_SIZE) {
        toast.error(
          `Menambahkan "${file.name}" akan melebihi total ukuran maksimal ${MAX_TOTAL_SIZE / (1024 * 1024)}MB.`,
        );
        console.warn(`File ${file.name} rejected: Total size limit reached.`);
        continue; // Skip this file
      }

      validFiles.push(file);
      validPreviews.push(URL.createObjectURL(file));
      currentTotalSize += file.size;
      console.log(
        `File ${file.name} accepted. New currentTotalSize: ${currentTotalSize}`,
      );
    }

    if (validFiles.length > 0) {
      setQCPhotos((prev) => [...prev, ...validFiles]);
      setQCPhotoPreviews((prev) => [...prev, ...validPreviews]);
      console.log(
        `Added ${validFiles.length} new valid files. Total qcPhotos now: ${qcPhotos.length + validFiles.length}`,
      );
    } else {
      console.log("No valid files to add.");
    }
  };

  const removeQCPhoto = (index: number) => {
    URL.revokeObjectURL(qcPhotoPreviews[index]);
    setQCPhotos(qcPhotos.filter((_, i) => i !== index));
    setQCPhotoPreviews(qcPhotoPreviews.filter((_, i) => i !== index));
  };

  const deleteQCItem = (index: number) => {
    const updated = qcItems.filter((_, i) => i !== index);
    setQCItems(updated);
    setQCTotalCost(
      updated.reduce(
        (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
        0,
      ),
    );
  };

  const startEditPrice = (index: number, currentPrice: number) => {
    setEditingPrice({ ...editingPrice, [index]: currentPrice });
  };

  const savePrice = (index: number) => {
    const newPrice = editingPrice[index];
    if (newPrice === undefined || newPrice < 0) return;
    const updated = qcItems.map((item, i) =>
      i === index ? { ...item, price: newPrice } : item,
    );
    setQCItems(updated);
    setQCTotalCost(
      updated.reduce(
        (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
        0,
      ),
    );
    const { [index]: _, ...rest } = editingPrice;
    setEditingPrice(rest);
  };

  const handleSubmitQC = async () => {
    if (!selectedService || !user) return;
    setQCSubmitting(true);
    try {
      // Validasi client-side sudah dilakukan di handleQCPhotoUpload
      // if (qcPhotos.length === 0) {
      //   toast.error("Setidaknya harus ada 1 foto untuk submit QC.");
      //   setQCSubmitting(false);
      //   return;
      // }
      // if (qcPhotos.length > 10) {
      //   toast.error("Maksimal 10 foto untuk submit QC");
      //   setQCSubmitting(false);
      //   return;
      // }

      // const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
      // const MAX_TOTAL_SIZE = 4 * 1024 * 1024; // 4MB
      // const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif'];

      // let totalSize = 0;
      // for (const file of qcPhotos) {
      //   if (file.size > MAX_FILE_SIZE) {
      //     toast.error(`"${file.name}" terlalu besar (maksimal 20MB).`);
      //     setQCSubmitting(false);
      //     return;
      //   }
      //   if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|heic|heif|avif)$/i)) {
      //     toast.error(`"${file.name}" bukan format gambar yang didukung.`);
      //     setQCSubmitting(false);
      //     return;
      //   }
      //   totalSize += file.size;
      // }

      // if (totalSize > MAX_TOTAL_SIZE) {
      //   toast.error(`Ukuran total foto terlalu besar (${(totalSize / (1024 * 1024)).toFixed(1)}MB). Maksimal ${MAX_TOTAL_SIZE / (1024 * 1024)}MB.`);
      //   setQCSubmitting(false);
      //   return;
      // }

      if (qcPhotos.length === 0) {
        toast.error("Setidaknya harus ada 1 foto untuk submit QC.");
        setQCSubmitting(false);
        return;
      }

      // Build caption
      const now = new Date();
      const formatTanggal = (dateString: string | null | undefined) => {
        if (!dateString) return "-";
        const d = new Date(dateString);
        const days = [
          "Minggu",
          "Senin",
          "Selasa",
          "Rabu",
          "Kamis",
          "Jumat",
          "Sabtu",
        ];
        const months = [
          "Januari",
          "Februari",
          "Maret",
          "April",
          "Mei",
          "Juni",
          "Juli",
          "Agustus",
          "September",
          "Oktober",
          "November",
          "Desember",
        ];
        return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} (${String(d.getMonth() + 1).padStart(2, "0")}), ${d.getFullYear()}`;
      };

      const startDateFormatted = formatTanggal(selectedService.start_date);
      const doneDateFormatted = formatTanggal(now.toISOString());

      const qcSubmittedItems = qcItems.map((item) => ({
        ...item,
        price: editingPrice[qcItems.indexOf(item)] ?? item.price,
        quantity: item.quantity,
      }));

      const barangItems = qcSubmittedItems.filter(
        (i) => i.item_type === "sparepart",
      );
      const jasaItems = qcSubmittedItems.filter((i) => i.item_type === "jasa");

      const barangList =
        barangItems.length > 0
          ? barangItems
              .map(
                (i) =>
                  `- ${i.name} (${i.quantity}x) @Rp${(i.price || 0).toLocaleString("id-ID")}`,
              )
              .join("\n")
          : "";

      const jasaList =
        jasaItems.length > 0
          ? jasaItems
              .map(
                (i) =>
                  `- ${i.name} (${i.quantity}x) @Rp${(i.price || 0).toLocaleString("id-ID")}`,
              )
              .join("\n")
          : "";

      const sections: string[] = [];
      sections.push(
        `${selectedService.status === "revision_required" ? "UPDATE QC AFTER REJECT QC" : "UPDATE QC"}`,
      );
      sections.push(`Status : Menunggu QC`);
      sections.push(`Nama : ${selectedService.customer_name || "-"}`);
      sections.push(`No. hp : ${selectedService.customer_phone || "-"}`);
      sections.push(`Brand : ${selectedService.watch_brand || "-"}`);
      if (selectedService.watch_model) {
        sections.push(`Tipe : ${selectedService.watch_model}`);
      }
      if (
        selectedService.estimated_cost &&
        selectedService.estimated_cost > 0
      ) {
        sections.push(
          `Estimasi : Rp${selectedService.estimated_cost.toLocaleString("id-ID")}`,
        );
      }
      sections.push(`Teknisi : ${user?.full_name || "-"}`);
      sections.push(`Start : ${startDateFormatted}`);
      sections.push(`Done : ${doneDateFormatted}`);
      sections.push(`Rincian Item`);

      if (barangItems.length > 0) {
        sections.push(`Barang:\n${barangList}`);
      }
      if (jasaItems.length > 0) {
        sections.push(`Jasa:\n${jasaList}`);
      }

      let dpNominal = 0;
      try {
        const { data: dpData } = await supabase
          .from("layanan")
          .select("nominal")
          .eq("detail_sku", `DP - Invoice ${selectedService.invoice_number}`)
          .maybeSingle();
        if (dpData && dpData.nominal) {
          dpNominal = dpData.nominal;
        }
      } catch (e) {
        console.error("Error fetching DP for caption:", e);
      }
      if (dpNominal > 0) {
        sections.push(`Dp : Rp${dpNominal.toLocaleString("id-ID")}`);
      }
      // Discount is handled in QC review, not initial teknisi submit.
      // Total will be shown in QCReviewModal as it can be modified.
      sections.push(`Total : Rp${qcTotalCost.toLocaleString("id-ID")}`);

      if (qcNotes.trim()) {
        sections.push(`Keterangan Teknisi :\n${qcNotes.trim()}`);
      }
      // Keterangan QC is handled in QC review, not initial teknisi submit.

      const caption = sections.filter(Boolean).join("\n\n");

      const uploadedUrls: string[] = [];

      setLocalProgress(10);
      const timer = setInterval(() => {
        setLocalProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + 15;
        });
      }, 500);

      const results = await upload.legacyUpload(
        qcPhotos,
        "qc_update",
        caption,
        undefined,
        (selectedService as any)?.branch_code || undefined,
        (p) => setLocalProgress(Math.min(85, 10 + Math.round(p * 0.75))),
      );

      clearInterval(timer);
      setLocalProgress(100);
      if (results.length > 0) {
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          uploadedUrls.push(r.url);
          await supabase.from("service_documentation").insert({
            service_order_id: selectedService.id,
            photo_url: r.url,
            stage: "qc",
            uploaded_by: user.id,
            media_type: qcPhotos[i] ? mediaTypeFromFile(qcPhotos[i]) : "image",
            ...buildTelegramMetadata(results),
          });
        }
      }

      const { error } = await supabase
        .from("service_orders")
        .update({
          status: "qc_pending",
          done_date: new Date().toISOString(),
          work_duration: selectedService.start_date
            ? Math.ceil(
                (new Date().getTime() -
                  new Date(selectedService.start_date).getTime()) /
                  (1000 * 60 * 60 * 24),
              )
            : null,
          qc_submit_notes: qcNotes || null,
        })
        .eq("id", selectedService.id);

      if (error) throw error;

      // Detect changes from initial items
      const initialItems = qcInitialItemsRef.current;
      const deletedItems: string[] = [];
      const priceChanges: string[] = [];

      for (const orig of initialItems) {
        const stillExists = qcItems.some(
          (item) => item.id === orig.id && item.name === orig.name,
        );
        if (!stillExists) {
          deletedItems.push(
            `${orig.item_type === "jasa" ? "jasa" : "sparepart"} ${orig.name}`,
          );
        }
      }

      for (const curr of qcItems) {
        const orig = initialItems.find(
          (o: any) => o.id === curr.id && o.name === curr.name,
        );
        if (orig && orig.price !== curr.price) {
          priceChanges.push(
            `${curr.name}: Rp ${(orig.price || 0).toLocaleString()} → Rp ${(curr.price || 0).toLocaleString()}`,
          );
        }
      }

      let changeMsg = "";
      if (deletedItems.length > 0)
        changeMsg += `menghapus ${deletedItems.join(", ")}. `;
      if (priceChanges.length > 0)
        changeMsg += `mengubah harga ${priceChanges.join(", ")}. `;
      if (changeMsg) changeMsg = changeMsg.trim() + " ";

      await supabase.from("service_timeline").insert({
        service_order_id: selectedService.id,
        teknisi_id: teknisiId,
        status: "qc_pending",
        message: `${changeMsg}Service telah selesai dan dikirim ke QC oleh teknisi${
          uploadedUrls.length > 0 ? ` (${uploadedUrls.length} foto)` : ""
        }`,
        details: {
          action: "submit_to_qc",
          photos_count: uploadedUrls.length,
          total_cost: qcTotalCost,
        },
      });

      toast.success("Service berhasil dikirim ke QC!");
      setShowSubmitQCModal(false);
      setQCPhotos([]);
      setQCPhotoPreviews([]);
      setQCNotes("");
      fetchQueues();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setQCSubmitting(false);
    }
  };

  const viewMyServiceInfo = async (service: ExtendedServiceOrder) => {
    setSelectedService(service);
    setServiceInfoPhotosLoading(true);
    setShowServiceInfoModal(true);

    const { data } = await supabase
      .from("service_documentation")
      .select("photo_url, media_type")
      .eq("service_order_id", service.id)
      .order("created_at", { ascending: true });

    if (data) {
      setServiceInfoPhotos(data.map((p) => p.photo_url));
      setServiceInfoPhotoTypes(
        data.map((p) => (p.media_type === "video" ? "video" : "image")),
      );
    }
    setServiceInfoPhotosLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      assigned: {
        label: "DITUGASKAN",
        color: "bg-blue-100 text-blue-700 border-blue-200",
      },
      in_progress: {
        label: "DALAM PENGERJAAN",
        color: "bg-yellow-100 text-yellow-700 border-yellow-200",
      },
      req_sparepart_admin: {
        label: "REQUEST PO",
        color: "bg-orange-100 text-orange-700 border-orange-200",
      },
      po_pending: {
        label: "PO PENDING",
        color: "bg-purple-100 text-purple-700 border-purple-200",
      },
      sparepart_ready: {
        label: "SPAREPART READY",
        color: "bg-green-100 text-green-700 border-green-200",
      },
      qc_pending: {
        label: "SIAP QC",
        color: "bg-indigo-100 text-indigo-700 border-indigo-200",
      },
      revision_required: {
        label: "PERLU REVISI",
        color: "bg-red-100 text-red-700 border-red-200",
      },
      pending: {
        label: "MENUNGGU",
        color: "bg-gray-100 text-gray-700 border-gray-200",
      },
      completed: {
        label: "SELESAI",
        color: "bg-green-100 text-green-700 border-green-200",
      },
    };
    return (
      badges[status] || {
        label: status.toUpperCase(),
        color: "bg-slate-100 text-slate-700",
      }
    );
  };

  const viewServiceDetails = (service: ExtendedServiceOrder) => {
    setSelectedService(service);
    setShowDetailModal(true);
  };

  const openTimeline = (service: ExtendedServiceOrder) => {
    setSelectedService(service);
    setShowTimelineModal(true);
  };

  const handleSubmitToQC = async (service: ExtendedServiceOrder) => {
    try {
      const { error } = await supabase
        .from("service_orders")
        .update({ status: "qc_pending" })
        .eq("id", service.id);

      if (error) throw error;

      await supabase.from("service_timeline").insert({
        service_order_id: service.id,
        teknisi_id: teknisiId,
        status: "qc_pending",
        message: `Service telah selesai dan dikirim ke QC oleh teknisi`,
        details: { action: "submit_to_qc" },
      });

      toast.success("Service berhasil dikirim ke QC!");
      setShowProgressModal(false);
      fetchQueues();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton variant="card" height="4rem" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <Skeleton variant="text" width="30%" />
                <Skeleton variant="text" width="20%" />
              </div>
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="text" width="40%" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const activeCount = myServices.length;
  const tabs = [
    {
      id: "available" as const,
      label: "List Service",
      count: pendingServices.length,
    },
    { id: "my" as const, label: "Proyek Saya", count: activeCount },
  ];
  const groupedByCategory = (services: ExtendedServiceOrder[]) => {
    const groups: Record<string, ExtendedServiceOrder[]> = {};
    for (const s of services) {
      const key = s.category || s.watch_movement || "Lainnya";
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
    return groups;
  };

  const normalizedSearch = serviceSearch.trim().toLowerCase();
  const filteredPendingServices = normalizedSearch
    ? pendingServices.filter((s) => {
        const haystack = [
          s.invoice_number,
          s.customer_name,
          s.customer_phone,
          s.watch_brand || s.device_brand,
          s.watch_model || s.device_model,
          s.issue_description,
          s.category,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedSearch);
      })
    : pendingServices;

  return (
    <div className="space-y-6 min-w-0">
      {!forcedTab && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-1 rounded-xl flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setQueueTab(tab.id)}
              className={`flex-1 h-10 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                queueTab === tab.id
                  ? "bg-[var(--color-elevated)] text-[var(--color-text)] shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)]/50"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`inline-flex items-center justify-center min-w-[20px] px-1.5 h-5 rounded-full text-[11px] font-semibold ${
                    queueTab === tab.id
                      ? "bg-[var(--color-accent-teal-soft)] text-[var(--color-accent-teal)]"
                      : "bg-[var(--color-elevated)] text-[var(--color-text-tertiary)]"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {queueTab === "my" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-[var(--color-accent-teal-soft)] text-[var(--color-accent-teal)] rounded-xl flex items-center justify-center flex-shrink-0">
              <Wrench className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-bold text-[var(--color-text)]">
              Proyek Saya ({activeCount})
            </h3>
          </div>

          {myServices.length === 0 ? (
            <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-8 text-center">
              <Package className="w-12 h-12 mx-auto mb-2 text-[var(--color-text-tertiary)]" />
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                Belum ada proyek yang diambil
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                Ambil proyek dari daftar di bawah
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
              {myServices.map((service, index) => {
                const statusBadge = getStatusBadge(service.status);
                const lastUpdateMessage =
                  service.last_update?.message || "Belum ada update";
                const transferBadge = getTransferBadge(service);

                return (
                  <motion.div
                    key={service.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => viewMyServiceInfo(service)}
                    className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-colors overflow-hidden cursor-pointer"
                  >
                    <div className="p-4 sm:p-5 space-y-3">
                      {/* Row 1: Invoice + Status badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-1 bg-[var(--color-elevated)] text-[var(--color-accent-teal)] border border-[var(--color-border)] text-xs font-mono font-semibold rounded-md">
                          {service.invoice_number}
                        </span>
                        <span
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border ${statusBadge.color} ${DARK_BADGE[service.status] || ""}`}
                        >
                          {statusBadge.label}
                        </span>
                        {transferBadge && (
                          <span className="px-2.5 py-1 text-[11px] font-semibold rounded-full border bg-purple-50 text-purple-700 border-purple-200">
                            🔄 {transferBadge}
                          </span>
                        )}
                        {service.status === "revision_required" && (
                          <span className="px-2.5 py-1 text-[11px] bg-[var(--color-danger-bg)] text-[var(--color-danger)] font-bold rounded-full border border-[var(--color-danger)]/25">
                            REJECT QC
                          </span>
                        )}
                        {service.status === "req_sparepart_admin" && (
                          <span className="px-2.5 py-1 text-[11px] bg-[var(--color-warning-bg)] text-[var(--color-warning)] font-medium rounded-full border border-[var(--color-warning)]/25">
                            ⏳ Menunggu Admin
                          </span>
                        )}
                        {service.status === "po_pending" && (
                          <span className="px-2.5 py-1 text-[11px] bg-[var(--color-info-bg)] text-[var(--color-info)] font-medium rounded-full border border-[var(--color-info)]/25">
                            📦 PO Diproses
                          </span>
                        )}
                        {service.status === "sparepart_ready" && (
                          <span className="px-2.5 py-1 text-[11px] bg-[var(--color-success-bg)] text-[var(--color-success)] font-medium rounded-full border border-[var(--color-success)]/25">
                            ✅ Siap Diambil
                          </span>
                        )}                        {service.last_update && (
                          <span className="text-[11px] text-[var(--color-text-tertiary)] ml-auto">
                            {new Date(
                              service.last_update.created_at,
                            ).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {/* Row 2: Customer + Device metadata */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <User className="w-4 h-4 text-[var(--color-text-tertiary)] flex-shrink-0" />
                          <span className="text-[11px] uppercase tracking-wide text-[var(--color-text-tertiary)] flex-shrink-0">
                            Customer
                          </span>
                          <span className="text-sm font-medium text-[var(--color-text)] truncate">
                            {service.customer_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <Watch className="w-4 h-4 text-[var(--color-text-tertiary)] flex-shrink-0" />
                          <span className="text-[11px] uppercase tracking-wide text-[var(--color-text-tertiary)] flex-shrink-0">
                            Device
                          </span>
                          <span className="text-sm font-medium text-[var(--color-text)] truncate">
                            {service.watch_brand || service.device_brand}{" "}
                            {service.watch_model || service.device_model}
                          </span>
                        </div>
                      </div>

                      {/* Row 3: Issue description */}
                      <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">
                        {service.issue_description}
                      </p>

                      {service.last_update && (
                        <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                          <Clock className="w-3 h-3" />
                          <span className="truncate">
                            Terakhir: {lastUpdateMessage}
                          </span>
                        </div>
                      )}

                      {/* Row 4: Action buttons — always at bottom */}
                      <div className="flex gap-2 flex-wrap pt-3 border-t border-[var(--color-border)]">
                        {(service.status === "assigned" ||
                          service.status === "in_progress" ||
                          service.status === "revision_required") && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openUpdate(service);
                              }}
                              className="h-9 px-3.5 text-xs bg-[var(--color-elevated)] text-[var(--color-text)] border border-[var(--color-border)] font-semibold rounded-lg hover:bg-[var(--color-surface)] transition-colors flex items-center gap-1.5"
                            >
                              <Wrench className="w-3.5 h-3.5" /> UPDATE
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openSubmitQC(service);
                              }}
                              className="h-9 px-3.5 text-xs bg-[var(--color-accent-teal-strong)] text-white font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> SUBMIT QC
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                takeWithPending(service);
                              }}
                              className="h-9 px-3.5 text-xs bg-[var(--color-warning-bg)] text-[var(--color-warning)] font-semibold rounded-lg hover:opacity-80 transition-opacity flex items-center gap-1.5"
                            >
                              <Clock className="w-3.5 h-3.5" /> PENDING
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                returnServiceToQueue(service);
                              }}
                              className="h-9 px-3.5 text-xs bg-[var(--color-danger-bg)] text-[var(--color-danger)] font-semibold rounded-lg hover:opacity-80 transition-opacity flex items-center gap-1.5"
                            >
                              <Undo2 className="w-3.5 h-3.5" /> KEMBALIKAN
                            </button>
                          </>
                        )}
                        {(service.status === "req_sparepart_admin" ||
                          service.status === "po_pending") && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              sendReminderToAdmin(service);
                            }}
                            className="h-9 px-3.5 text-xs bg-[var(--color-warning-bg)] text-[var(--color-warning)] font-semibold rounded-lg hover:opacity-80 transition-opacity flex items-center gap-1.5"
                          >
                            <Bell className="w-3.5 h-3.5" /> REMINDER
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {queueTab === "available" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-[var(--color-accent-teal-soft)] text-[var(--color-accent-teal)] rounded-xl flex items-center justify-center flex-shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-bold text-[var(--color-text)]">
              List Service (
                {serviceSearch.trim()
                  ? filteredPendingServices.length
                  : pendingServices.length}
              )
            </h3>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)] pointer-events-none" />
            <input
              type="text"
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
              placeholder="Cari nomor service, nama customer..."
              className="w-full h-11 pl-10 pr-10 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent-teal)] focus:ring-2 focus:ring-[var(--color-accent-teal)]/20 transition-all"
            />
            {serviceSearch && (
              <button
                onClick={() => setServiceSearch("")}
                aria-label="Hapus pencarian"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-[var(--color-surface)] transition-colors"
              >
                <X className="w-4 h-4 text-[var(--color-text-tertiary)]" />
              </button>
            )}
          </div>

          {pendingServices.length === 0 ? (
            <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-8 text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-[var(--color-success)]" />
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                Tidak ada service baru
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                Semua service sudah diambil
              </p>
            </div>
          ) : filteredPendingServices.length === 0 ? (
            <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-8 text-center">
              <Search className="w-12 h-12 mx-auto mb-2 text-[var(--color-text-tertiary)]" />
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                Service tidak ditemukan
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                Coba gunakan kata kunci lain.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
              {filteredPendingServices.map((service, index) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-colors cursor-pointer"
                  onClick={() => viewServiceDetails(service)}
                >
                  <div className="p-4 sm:p-5">
                    <div className="flex flex-col gap-4">
                      <div className="flex gap-3">
                        {(service as any)._frontPhoto ? (
                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] flex-shrink-0">
                            {(service as any)._frontPhoto.isVideo ? (
                              <VideoThumb
                                src={(service as any)._frontPhoto.url}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <SmartMedia
                                src={(service as any)._frontPhoto.url}
                                mediaType="image"
                                imgClassName="w-full h-full object-cover"
                              />
                            )}
                          </div>
                        ) : (
                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col items-center justify-center gap-0.5 flex-shrink-0">
                            <Watch className="w-5 h-5 text-[var(--color-text-tertiary)]" />
                            <span className="text-[9px] text-[var(--color-text-tertiary)]">
                              No Foto
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0 space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-1 bg-[var(--color-elevated)] text-[var(--color-accent-teal)] border border-[var(--color-border)] text-xs font-mono font-semibold rounded-md">
                            {service.invoice_number}
                          </span>
                          <span className="px-2.5 py-1 bg-[var(--color-success-bg)] text-[var(--color-success)] text-[11px] font-semibold rounded-full border border-[var(--color-success)]/25">
                            BARU
                          </span>
                          {getTransferBadge(service) && (
                            <span className="px-2.5 py-1 text-[11px] font-semibold rounded-full border bg-purple-50 text-purple-700 border-purple-200">
                              🔄 {getTransferBadge(service)}
                            </span>
                          )}
                          {service.category && (
                            <span className="px-2.5 py-1 bg-[var(--color-info-bg)] text-[var(--color-info)] text-[11px] font-medium rounded-full border border-[var(--color-info)]/25">
                              {service.category}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <User className="w-4 h-4 text-[var(--color-text-tertiary)] flex-shrink-0" />
                            <span className="font-semibold text-[var(--color-text)] truncate">
                              {service.customer_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 min-w-0">
                            <Watch className="w-4 h-4 text-[var(--color-text-tertiary)] flex-shrink-0" />
                            <span className="text-[var(--color-text-secondary)] truncate">
                              {service.watch_brand || service.device_brand}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface)] rounded-lg px-3 py-2.5">
                          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-[var(--color-text-tertiary)]" />
                          <p className="line-clamp-2">
                            {service.issue_description}
                          </p>
                        </div>
                      </div>
                      </div>

                      <div className="flex gap-3 pt-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            viewServiceDetails(service);
                          }}
                          className="flex-1 h-11 px-5 text-sm bg-[var(--color-elevated)] text-[var(--color-text)] border border-[var(--color-border)] font-semibold rounded-xl hover:bg-[var(--color-surface)] transition-colors flex items-center justify-center gap-2"
                        >
                          <Eye className="w-4 h-4" /> DETAIL
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {queueTab === "pending" && (
        <div>
          {teknisiPendingServices.length === 0 ? (
            <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-8 text-center">
              <Clock className="w-12 h-12 mx-auto mb-2 text-[var(--color-text-tertiary)]" />
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                Tidak ada service pending
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                Service pending menunggu persetujuan QC
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
              {teknisiPendingServices.map((service, index) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-warning)]/25 p-4 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="px-2 py-1 bg-[var(--color-elevated)] text-[var(--color-accent-teal)] border border-[var(--color-border)] text-xs font-mono font-semibold rounded-md">
                          {service.invoice_number}
                        </span>
                        <span
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-full flex items-center gap-1 border ${(service as any)._pendingStatus === "pending_approved" ? "bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success)]/25" : "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning)]/25"}`}
                        >
                          {(service as any)._pendingStatus ===
                          "pending_approved" ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          {(service as any)._pendingStatus ===
                          "pending_approved"
                            ? "DISETUJUI"
                            : "PENDING"}
                        </span>
                        {getTransferBadge(service) && (
                          <span className="px-2.5 py-1 text-[11px] font-semibold rounded-full border bg-purple-50 text-purple-700 border-purple-200">
                            🔄 {getTransferBadge(service)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="text-sm font-medium text-[var(--color-text)]">
                          {service.customer_name}
                        </span>
                        <span className="text-sm text-[var(--color-text-secondary)]">
                          {service.watch_brand || service.device_brand}
                        </span>
                      </div>
                      <div className="bg-[var(--color-warning-bg)] rounded-lg p-2.5 border border-[var(--color-warning)]/20 mt-2">
                        <p className="text-xs font-medium text-[var(--color-warning)]">
                          Alasan Pending:
                        </p>
                        <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                          {(service as any)._pendingReason}
                        </p>
                      </div>
                      {(service as any)._pendingStatus ===
                        "pending_approved" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            resumeProject(service);
                          }}
                          className="mt-3 h-9 px-3.5 text-xs bg-[var(--color-accent-teal-strong)] text-white font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> LANJUTKAN
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PENDING REASON MODAL */}
      {showPendingReasonModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
          onClick={() => setShowPendingReasonModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[var(--color-card)] rounded-2xl shadow-2xl w-full max-w-md border border-[var(--color-border)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-[var(--color-warning-bg)] text-[var(--color-warning)] rounded-xl flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--color-text)]">
                  Alasan Pending
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {pendingTargetService?.invoice_number}
                </p>
              </div>
            </div>
            <textarea
              value={pendingReason}
              onChange={(e) => setPendingReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-warning)] focus:ring-2 focus:ring-[var(--color-warning)]/20 transition-all resize-none mb-4"
              placeholder="Jelaskan alasan pending..."
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowPendingReasonModal(false)}
                className="flex-1 h-11 border border-[var(--color-border)] rounded-xl text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors"
              >
                Batal
              </button>
              <button
                onClick={submitPending}
                disabled={submittingPending}
                className="flex-1 h-11 bg-[var(--color-warning)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {submittingPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {submittingPending ? "Memproses..." : "Kirim"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* All Modals */}
      {selectedService && (
        <>
          <ServiceDetailModal
            isOpen={showDetailModal}
            onClose={() => setShowDetailModal(false)}
            service={selectedService}
            onTake={() => {
              setPendingServices((prev) => prev.filter((s) => s.id !== selectedService.id));
              setMyServices((prev) => [{ ...selectedService, status: "assigned", assigned_teknisi_id: teknisiId } as any, ...prev]);
              setShowDetailModal(false);
            }}
            onSkip={() => setShowDetailModal(false)}
          />

          {/* UPDATE MODAL — combines Timeline + Add Jasa + Add Sparepart */}
          {showUpdateModal && (
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
              onClick={() => setShowUpdateModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[var(--color-card)] rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col border border-[var(--color-border)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sticky top-0 bg-[var(--color-card)] z-20 flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-[var(--color-accent-teal-soft)] rounded-xl flex items-center justify-center">
                      <Wrench className="w-4 h-4 text-[var(--color-accent-teal)]" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-[var(--color-text)]">
                        Update Service
                      </h2>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {selectedService.invoice_number}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowUpdateModal(false)}
                    className="p-1.5 hover:bg-[var(--color-surface)] rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <ServiceTimeline
                    serviceId={selectedService.id}
                    customerPhone={selectedService.customer_phone}
                    customerName={selectedService.customer_name}
                    invoiceNumber={selectedService.invoice_number}
                    onUpdate={() => fetchQueues()}
                  />

                  <div className="grid grid-cols-2 gap-3 mt-6 pt-6 border-t border-[var(--color-border)]">
                    <button
                      onClick={() => {
                        setShowUpdateModal(false);
                        openAddJasa(selectedService);
                      }}
                      className="flex items-center justify-center gap-2 h-11 bg-[var(--color-accent-teal-strong)] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity text-sm"
                    >
                      <Wrench className="w-4 h-4" /> TAMBAH JASA
                    </button>
                    <button
                      onClick={() => {
                        setShowUpdateModal(false);
                        openAddSparepart(selectedService);
                      }}
                      className="flex items-center justify-center gap-2 h-11 bg-[var(--color-elevated)] text-[var(--color-text)] border border-[var(--color-border)] font-semibold rounded-xl hover:bg-[var(--color-surface)] transition-colors text-sm"
                    >
                      <Package className="w-4 h-4" /> TAMBAH SPAREPART
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* PROGRESS (legacy) MODAL */}
          {showProgressModal && (
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
              onClick={() => setShowProgressModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[var(--color-card)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-[var(--color-border)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sticky top-0 bg-[var(--color-card)] z-20 flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-[var(--color-accent-teal-soft)] rounded-xl flex items-center justify-center">
                      <Wrench className="w-4 h-4 text-[var(--color-accent-teal)]" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-[var(--color-text)]">
                        Detail Update
                      </h2>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {selectedService.invoice_number}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowProgressModal(false)}
                    className="p-1.5 hover:bg-[var(--color-surface)] rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <ProgressUpdate
                    service={selectedService}
                    onUpdate={() => fetchQueues()}
                    onAddJasa={() => {
                      setShowProgressModal(false);
                      openAddJasa(selectedService);
                    }}
                    onSubmitToQC={() => handleSubmitToQC(selectedService)}
                  />
                </div>
              </motion.div>
            </div>
          )}

          {/* SUBMIT QC MODAL */}
          {showSubmitQCModal && selectedService && (
            <SubmitQCModal
              service={selectedService}
              teknisiId={teknisiId}
              onClose={() => setShowSubmitQCModal(false)}
              onSuccess={() => {
                setShowSubmitQCModal(false);
                fetchQueues();
              }}
            />
          )}

          {/* SERVICE INFO MODAL — card click on my services */}
          {showServiceInfoModal && (
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
              onClick={() => {
                setShowServiceInfoModal(false);
                setServiceInfoPhotos([]);
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[var(--color-card)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col border border-[var(--color-border)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sticky top-0 bg-[var(--color-card)] z-20 flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-[var(--color-accent-teal-soft)] rounded-xl flex items-center justify-center">
                      <Watch className="w-4 h-4 text-[var(--color-accent-teal)]" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-[var(--color-text)]">
                        Detail Service
                      </h2>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {selectedService.invoice_number}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowServiceInfoModal(false);
                      setServiceInfoPhotos([]);
                    }}
                    className="p-1.5 hover:bg-[var(--color-surface)] rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  {/* Photos */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Camera className="w-4 h-4 text-[var(--color-text-secondary)]" />
                      <h4 className="text-sm font-semibold text-[var(--color-text)]">
                        Dokumentasi Service
                      </h4>
                      {serviceInfoPhotos.length > 0 && (
                        <span className="text-xs text-[var(--color-text-tertiary)] bg-[var(--color-surface)] px-2 py-0.5 rounded-full">
                          {serviceInfoPhotos.length} foto
                        </span>
                      )}
                    </div>
                    {serviceInfoPhotosLoading ? (
                      <div className="bg-[var(--color-surface)] rounded-xl p-6 text-center border border-[var(--color-border)]">
                        <div className="w-6 h-6 border-2 border-[var(--color-border)] border-t-[var(--color-accent-teal)] rounded-full animate-spin mx-auto" />
                        <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
                          Memuat foto...
                        </p>
                      </div>
                    ) : serviceInfoPhotos.length === 0 ? (
                      <div className="bg-[var(--color-surface)] rounded-xl p-6 text-center border border-dashed border-[var(--color-border)]">
                        <ImageIcon className="w-8 h-8 text-[var(--color-text-tertiary)] mx-auto mb-1" />
                        <p className="text-xs text-[var(--color-text-tertiary)]">
                          Belum ada foto dokumentasi
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {serviceInfoPhotos.map((photo, i) => (
                          <div
                            key={i}
                            className="aspect-square rounded-lg overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(photo, "_blank")}
                          >
                            {serviceInfoPhotoTypes[i] === "video" ? (
                              <video
                                src={photo}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <img
                                src={photo}
                                alt={`Foto ${i + 1}`}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)] space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        Invoice
                      </span>
                      <span className="text-xs font-mono font-medium text-[var(--color-text)]">
                        {selectedService.invoice_number}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        Status
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getStatusBadge(selectedService.status).color}`}
                      >
                        {getStatusBadge(selectedService.status).label}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        Customer
                      </span>
                      <span className="text-sm font-medium text-[var(--color-text)]">
                        {selectedService.customer_name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        Phone
                      </span>
                      <span className="text-sm text-[var(--color-text)]">
                        {selectedService.customer_phone}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        Device
                      </span>
                      <span className="text-sm text-[var(--color-text)]">
                        {selectedService.watch_brand ||
                          selectedService.device_brand}{" "}
                        {selectedService.watch_model ||
                          selectedService.device_model}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        Tanggal Masuk
                      </span>
                      <span className="text-sm text-[var(--color-text)]">
                        {new Date(
                          selectedService.created_at,
                        ).toLocaleDateString("id-ID")}
                      </span>
                    </div>
                  </div>

                  <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)]">
                    <h4 className="text-xs font-semibold text-[var(--color-text)] mb-1">
                      Deskripsi Kerusakan
                    </h4>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {selectedService.issue_description}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* LEGACY TIMELINE MODAL */}
          {showTimelineModal && (
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
              onClick={() => setShowTimelineModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[var(--color-card)] rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] overflow-hidden flex flex-col border border-[var(--color-border)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sticky top-0 bg-[var(--color-card)] z-20 flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] rounded-t-2xl">
                  <div>
                    <h2 className="text-base font-bold text-[var(--color-text)]">
                      Timeline Service
                    </h2>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {selectedService.invoice_number}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowTimelineModal(false)}
                    className="p-1.5 hover:bg-[var(--color-surface)] rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <ServiceTimeline
                    serviceId={selectedService.id}
                    customerPhone={selectedService.customer_phone}
                    customerName={selectedService.customer_name}
                    invoiceNumber={selectedService.invoice_number}
                    onUpdate={() => fetchQueues()}
                  />
                </div>
              </motion.div>
            </div>
          )}

          {showAddJasa && (
            <AddJasaModal
              isOpen={showAddJasa}
              onClose={() => {
                setShowAddJasa(false);
                setSelectedService(null);
              }}
              service={selectedService}
              onSuccess={() => {
                setShowAddJasa(false);
                setSelectedService(null);
                fetchQueues();
                toast.success("Jasa berhasil ditambahkan ke service");
              }}
            />
          )}

          {showAddSparepart && (
            <AddSparepartModal
              isOpen={showAddSparepart}
              onClose={() => {
                setShowAddSparepart(false);
                setSelectedService(null);
              }}
              service={selectedService}
              onSuccess={() => {
                setShowAddSparepart(false);
                setSelectedService(null);
                fetchQueues();
              }}
            />
          )}

          {showRequestSparepart && (
            <RequestSparepartModal
              isOpen={showRequestSparepart}
              onClose={() => {
                setShowRequestSparepart(false);
                setSelectedService(null);
              }}
              service={selectedService}
              onSuccess={() => {
                setShowRequestSparepart(false);
                setSelectedService(null);
                fetchQueues();
                toast.success("Request sparepart terkirim!");
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
