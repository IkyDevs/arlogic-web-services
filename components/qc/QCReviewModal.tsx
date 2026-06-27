'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import {
  X, User, Watch, Wrench, Package, FileText,
  Image as ImageIcon, Clock as ClockIcon,
  ThumbsUp, ThumbsDown, MessageSquare,
  ChevronDown, ChevronRight, Calendar, Phone,
  DollarSign, CheckCircle, XCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

interface QCReviewModalProps {
  service: any
  onClose: () => void
  onComplete: () => void
  reviewerId?: string
  reviewerName?: string
}

export default function QCReviewModal({
  service,
  onClose,
  onComplete,
  reviewerId,
  reviewerName
}: QCReviewModalProps) {
  const [timeline, setTimeline] = useState<any[]>([])
  const [serviceItems, setServiceItems] = useState<any[]>([])
  const [documentations, setDocumentations] = useState<any[]>([])
  const [reviewNotes, setReviewNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expandedSections, setExpandedSections] = useState({
    items: true,
    timeline: true,
    photos: true
  })
  const supabase = createClient()

  useEffect(() => {
    if (service) {
      fetchDetails()
    }
  }, [service])

  const fetchDetails = async () => {
    setLoading(true)

    const [timelineRes, itemsRes, photosRes] = await Promise.all([
      supabase.from('service_timeline').select('*').eq('service_order_id', service.id).order('created_at', { ascending: true }),
      supabase.from('service_items').select('*').eq('service_order_id', service.id),
      supabase.from('service_documentation').select('*').eq('service_order_id', service.id).order('created_at', { ascending: true }),
    ])

    if (timelineRes.data) setTimeline(timelineRes.data)
    if (itemsRes.data) setServiceItems(itemsRes.data)
    if (photosRes.data) setDocumentations(photosRes.data)

    setLoading(false)
  }

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!service) return

    if (status === 'rejected' && !reviewNotes.trim()) {
      toast.error('Harap berikan alasan penolakan')
      return
    }

    setProcessing(true)

    try {
      const newStatus = status === 'approved' ? 'completed' : 'revision_required'

      const { error: updateError } = await supabase
        .from('service_orders')
        .update({
          status: newStatus,
          completed_at: status === 'approved' ? new Date().toISOString() : null
        })
        .eq('id', service.id)

      if (updateError) throw updateError

      await supabase.from('qc_reviews').insert({
        service_order_id: service.id,
        reviewer_id: reviewerId,
        status: status,
        notes: reviewNotes
      })

      const message = status === 'approved'
        ? `Service telah disetujui oleh QC (${reviewerName})`
        : `Service memerlukan revisi. Alasan: ${reviewNotes}`

      await supabase.from('service_timeline').insert({
        service_order_id: service.id,
        status: newStatus,
        message: message,
        details: { action: 'qc_review', reviewer: reviewerName, revision: true }
      })

      await supabase.from('notifications').insert({
        user_id: service.assigned_teknisi_id,
        title: status === 'approved' ? '✅ Service Disetujui QC' : '🔄 Service Perlu Revisi',
        message: status === 'approved'
          ? `Service ${service.invoice_number} telah disetujui oleh QC`
          : `Service ${service.invoice_number} ditolak QC. Alasan: ${reviewNotes}. Silakan perbaiki dan kirim kembali.`,
        type: status === 'approved' ? 'success' : 'warning',
        link: '/teknisi',
        is_read: false
      })

      toast.success(`Service ${status === 'approved' ? 'disetujui' : 'ditolak'}`)
      onComplete()

    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setProcessing(false)
    }
  }

  const formatRupiah = (nominal: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(nominal)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
      assigned: { label: 'Assigned', color: 'bg-blue-100 text-blue-700' },
      in_progress: { label: 'In Progress', color: 'bg-purple-100 text-purple-700' },
      req_sparepart_admin: { label: 'Request PO', color: 'bg-orange-100 text-orange-700' },
      po_pending: { label: 'PO Pending', color: 'bg-indigo-100 text-indigo-700' },
      sparepart_ready: { label: 'Sparepart Ready', color: 'bg-green-100 text-green-700' },
      qc_pending: { label: 'QC Pending', color: 'bg-yellow-100 text-yellow-700' },
      completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
      cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' }
    }
    return badges[status] || { label: status, color: 'bg-gray-100 text-gray-700' }
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#E94560] border-t-transparent mx-auto" />
          <p className="mt-3 text-gray-500">Loading details...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E9ECEF] flex justify-between items-center sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-bold text-[#1A1A2E]">Review Service</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-400">{service.invoice_number}</span>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-gray-400">{service.teknisi_name}</span>
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">QC Pending</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-all">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Customer & Watch Info */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-[#F8F9FA] rounded-lg p-4 border border-[#E9ECEF]">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-[#E94560]" />
                <h4 className="text-sm font-semibold">Customer</h4>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Nama</span>
                  <span className="font-medium">{service.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">WhatsApp</span>
                  <span className="font-medium">{service.customer_phone || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Serial</span>
                  <span className="font-mono text-sm">{service.serial_number || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tanggal</span>
                  <span className="font-medium">{formatDate(service.created_at)}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#F8F9FA] rounded-lg p-4 border border-[#E9ECEF]">
              <div className="flex items-center gap-2 mb-3">
                <Watch className="w-4 h-4 text-[#E94560]" />
                <h4 className="text-sm font-semibold">Watch</h4>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Brand</span>
                  <span className="font-medium">{service.watch_brand || service.device_brand || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Model</span>
                  <span className="font-medium">{service.watch_model || service.device_model || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Movement</span>
                  <span className="font-medium capitalize">{service.watch_movement || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Condition</span>
                  <span className="font-medium capitalize">{service.watch_condition || '-'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Teknisi Info */}
          <div className="bg-[#F8F9FA] rounded-lg p-4 border border-[#E9ECEF]">
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-4 h-4 text-[#E94560]" />
              <h4 className="text-sm font-semibold">Teknisi</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-gray-500">Teknisi</p>
                <p className="font-medium">{service.teknisi_name || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">Start</p>
                <p className="font-medium">{service.start_date ? formatDate(service.start_date) : '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">Done</p>
                <p className="font-medium">{service.done_date ? formatDate(service.done_date) : '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">Duration</p>
                <p className="font-medium">{service.work_duration || '-'}</p>
              </div>
            </div>
          </div>

          {/* Service Details */}
          <div className="bg-[#F8F9FA] rounded-lg p-4 border border-[#E9ECEF]">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-[#E94560]" />
              <h4 className="text-sm font-semibold">Service Details</h4>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-500 mb-1">Issue</p>
                <p className="text-gray-800 bg-white p-2 rounded border border-[#E9ECEF]">{service.issue_description}</p>
              </div>
              {service.request && (
                <div>
                  <p className="text-gray-500 mb-1">Customer Request</p>
                  <p className="text-gray-800 bg-white p-2 rounded border border-[#E9ECEF]">{service.request}</p>
                </div>
              )}
              {service.completion_notes && (
                <div>
                  <p className="text-gray-500 mb-1">Completion Notes</p>
                  <p className="text-gray-800 bg-white p-2 rounded border border-[#E9ECEF]">{service.completion_notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Service Items */}
          {serviceItems.length > 0 && (
            <div className="bg-[#F8F9FA] rounded-lg p-4 border border-[#E9ECEF]">
              <button
                onClick={() => toggleSection('items')}
                className="w-full flex items-center justify-between mb-3"
              >
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#E94560]" />
                  <h4 className="text-sm font-semibold">Items ({serviceItems.length})</h4>
                </div>
                {expandedSections.items ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {expandedSections.items && (
                <div className="space-y-2">
                  {serviceItems.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-white rounded border border-[#E9ECEF]">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          item.item_type === 'jasa' ? 'bg-pink-100 text-pink-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {item.item_type === 'jasa' ? 'JASA' : 'SPAREPART'}
                        </span>
                        <span className="font-medium">{item.name}</span>
                        <span className="text-sm text-gray-500">x{item.quantity}</span>
                      </div>
                      <span className="font-semibold">{formatRupiah(item.price * item.quantity)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-3 bg-gradient-to-r from-[#1A1A2E] to-[#0F3460] text-white rounded-lg font-bold">
                    <span>Total</span>
                    <span className="text-xl">{formatRupiah(service.final_cost || 0)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Timeline */}
          {timeline.length > 0 && (
            <div className="bg-[#F8F9FA] rounded-lg p-4 border border-[#E9ECEF]">
              <button
                onClick={() => toggleSection('timeline')}
                className="w-full flex items-center justify-between mb-3"
              >
                <div className="flex items-center gap-2">
                  <ClockIcon className="w-4 h-4 text-[#E94560]" />
                  <h4 className="text-sm font-semibold">Timeline</h4>
                </div>
                {expandedSections.timeline ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {expandedSections.timeline && (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {timeline.map((item, index) => (
                    <div key={item.id} className="relative pl-6 pb-3 last:pb-0">
                      {index < timeline.length - 1 && (
                        <div className="absolute left-2 top-4 bottom-0 w-0.5 bg-gray-200" />
                      )}
                      <div className="absolute left-0 top-1 w-3 h-3 rounded-full bg-[#E94560]" />
                      <div className="bg-white p-3 rounded-lg border border-[#E9ECEF] ml-2">
                        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                          <span className="text-xs text-gray-500">{formatDate(item.created_at)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadge(item.status).color}`}>
                            {getStatusBadge(item.status).label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800">{item.message}</p>
                        {item.photo_url && (
                          <div className="mt-2">
                            <img
                              src={item.photo_url}
                              alt="Timeline"
                              className="max-h-32 rounded border border-[#E9ECEF] object-cover cursor-pointer"
                              onClick={() => window.open(item.photo_url, '_blank')}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Photos */}
          {documentations.length > 0 && (
            <div className="bg-[#F8F9FA] rounded-lg p-4 border border-[#E9ECEF]">
              <button
                onClick={() => toggleSection('photos')}
                className="w-full flex items-center justify-between mb-3"
              >
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[#E94560]" />
                  <h4 className="text-sm font-semibold">Photos ({documentations.length})</h4>
                </div>
                {expandedSections.photos ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {expandedSections.photos && (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {documentations.map((doc, index) => (
                    <div key={doc.id} className="relative group cursor-pointer">
                      <img
                        src={doc.photo_url}
                        alt={`Photo ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border border-[#E9ECEF] hover:shadow-md transition-all"
                        onClick={() => window.open(doc.photo_url, '_blank')}
                      />
                      <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">
                        {doc.stage || 'Progress'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Review Notes */}
          <div className="bg-[#F8F9FA] rounded-lg p-4 border border-[#E9ECEF]">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-[#E94560]" />
              <h4 className="text-sm font-semibold">
                Review Notes <span className="text-red-500 text-xs">*</span>
              </h4>
            </div>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#E94560] focus:ring-2 focus:ring-[#E94560]/10 transition-all resize-none"
              placeholder="Masukkan catatan review (wajib untuk penolakan)..."
            />
            <p className="text-xs text-gray-400 mt-1">Catatan akan dikirim ke teknisi</p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-[#E9ECEF] flex gap-3 bg-white">
          <button
            onClick={() => handleReview('rejected')}
            disabled={processing}
            className="flex-1 bg-red-50 text-red-600 font-medium px-4 py-2.5 rounded-lg border border-red-200 hover:bg-red-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {processing ? (
              <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <ThumbsDown className="w-4 h-4" />
            )}
            Reject
          </button>
          <button
            onClick={() => handleReview('approved')}
            disabled={processing}
            className="flex-1 bg-[#1A1A2E] text-white font-medium px-4 py-2.5 rounded-lg hover:bg-[#0F3460] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {processing ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <ThumbsUp className="w-4 h-4" />
            )}
            Approve
          </button>
        </div>
      </motion.div>
    </div>
  )
}
