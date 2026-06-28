'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Send, Package, Warehouse, CheckCircle, XCircle,
  MessageSquare, Clock, User, Check, AlertCircle,
  Search, Box, Truck, Edit, Save, Eye
} from 'lucide-react'
import toast from 'react-hot-toast'

interface SparepartChatProps {
  isOpen: boolean
  onClose: () => void
  request: any
  onUpdate: () => void
}

export default function SparepartChat({ isOpen, onClose, request, onUpdate }: SparepartChatProps) {
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [approving, setApproving] = useState(false)
  const [showStockCheck, setShowStockCheck] = useState(false)
  const [stockData, setStockData] = useState<any>(null)
  const [checkingStock, setCheckingStock] = useState(false)
  const [adminResponse, setAdminResponse] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const { user } = useAuthStore()

  useEffect(() => {
    if (isOpen && request) {
      fetchMessages()
      checkStock()

      const subscription = supabase
        .channel(`sparepart_chat_${request.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'sparepart_conversations',
            filter: `sparepart_request_id=eq.${request.id}`
          },
          () => {
            fetchMessages()
          }
        )
        .subscribe()

      return () => {
        subscription.unsubscribe()
      }
    }
  }, [isOpen, request])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('sparepart_conversations')
      .select('*')
      .eq('sparepart_request_id', request.id)
      .order('created_at', { ascending: true })

    if (data) setMessages(data)
  }

  const checkStock = async () => {
    setCheckingStock(true)
    try {
      const { data } = await supabase
        .from('inventory')
        .select('*')
        .eq('sku', request.sparepart_sku)
        .single()

      if (data) {
        setStockData(data)
      } else {
        // If not found by SKU, search by name
        const { data: byName } = await supabase
          .from('inventory')
          .select('*')
          .ilike('item_name', `%${request.sparepart_name}%`)
          .single()
        setStockData(byName)
      }
    } catch (error) {
      console.error('Error checking stock:', error)
    } finally {
      setCheckingStock(false)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim()) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('sparepart_conversations')
        .insert({
          sparepart_request_id: request.id,
          sender_id: user?.id,
          sender_name: user?.full_name,
          sender_role: user?.role,
          message: newMessage,
          is_read: false
        })

      if (error) throw error
      setNewMessage('')
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const approveRequest = async () => {
    setApproving(true)

    try {
      // Check stock again before approve
      if (request.source_type === 'store') {
        const currentStock = stockData?.store_stock || 0
        if (currentStock < request.quantity) {
          toast.error(`Stock tidak mencukupi! Stock toko: ${currentStock}, diminta: ${request.quantity}`)
          setApproving(false)
          return
        }
      } else {
        const currentStock = stockData?.warehouse_stock || 0
        if (currentStock < request.quantity) {
          toast.error(`Stock gudang tidak mencukupi! Stock gudang: ${currentStock}, diminta: ${request.quantity}`)
          setApproving(false)
          return
        }
      }

      // Update sparepart request
      const { error } = await supabase
        .from('sparepart_requests')
        .update({
          status: 'approved',
          admin_response: adminResponse || 'Disetujui, silakan ambil sparepart',
          responded_at: new Date().toISOString()
        })
        .eq('id', request.id)

      if (error) throw error

      // Add to timeline
      await supabase.from('service_timeline').insert({
        service_order_id: request.service_order_id,
        status: 'in_progress',
        message: `Permintaan sparepart ${request.sparepart_name} (x${request.quantity}) telah DISETUJUI oleh admin. Silakan ambil sparepart di ${request.source_type === 'store' ? 'toko' : 'gudang'}.`,
        details: {
          action: 'sparepart_approved',
          admin: user?.full_name,
          response: adminResponse
        }
      })

      // Kirim notifikasi ke teknisi
      await supabase.from('notifications').insert({
        user_id: request.teknisi_id,
        title: '✅ Request Sparepart Disetujui',
        message: `Request sparepart ${request.sparepart_name} (x${request.quantity}) telah disetujui. ${adminResponse || 'Silakan ambil sparepart di gudang.'}`,
        type: 'success',
        link: '/teknisi',
        is_read: false
      })

      toast.success('Request sparepart disetujui! Stock akan otomatis berkurang.')
      onUpdate()
      onClose()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setApproving(false)
    }
  }

  const rejectRequest = async () => {
    if (!adminResponse.trim()) {
      toast.error('Harap berikan alasan penolakan')
      return
    }

    setApproving(true)

    try {
      // Update sparepart request
      const { error } = await supabase
        .from('sparepart_requests')
        .update({
          status: 'rejected',
          admin_response: adminResponse,
          responded_at: new Date().toISOString()
        })
        .eq('id', request.id)

      if (error) throw error

      // Add to timeline
      await supabase.from('service_timeline').insert({
        service_order_id: request.service_order_id,
        status: 'waiting_sparepart',
        message: `Permintaan sparepart ${request.sparepart_name} (x${request.quantity}) DITOLAK oleh admin. Alasan: ${adminResponse}`,
        details: { action: 'sparepart_rejected', admin: user?.full_name }
      })

      // Kirim notifikasi ke teknisi
      await supabase.from('notifications').insert({
        user_id: request.teknisi_id,
        title: '❌ Request Sparepart Ditolak',
        message: `Request sparepart ${request.sparepart_name} (x${request.quantity}) ditolak. Alasan: ${adminResponse}`,
        type: 'error',
        link: '/teknisi',
        is_read: false
      })

      toast.success('Request sparepart ditolak')
      onUpdate()
      onClose()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setApproving(false)
    }
  }

  const formatRupiah = (nominal: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(nominal)
  }

  if (!isOpen) return null

  const currentStock = request.source_type === 'store'
    ? (stockData?.store_stock || 0)
    : (stockData?.warehouse_stock || 0)

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white border border-slate-200 shadow-sm w-full max-w-2xl max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-pink-600" />
              <h3 className="text-lg font-black">DETAIL REQUEST SPAREPART</h3>
            </div>
            <p className="text-xs font-mono text-slate-500">ID: {request.id?.slice(0, 8)}...</p>
          </div>
          <button onClick={onClose} className="p-1 border border-slate-200 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Request Details */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-slate-500">Sparepart:</span> <span className="font-bold">{request.sparepart_name}</span></div>
            <div><span className="text-slate-500">SKU:</span> <span className="font-mono">{request.sparepart_sku || '-'}</span></div>
            <div><span className="text-slate-500">Jumlah:</span> <span className="font-bold text-pink-600">x{request.quantity}</span></div>
            <div>
              <span className="text-slate-500">Sumber:</span>
              <span className={`ml-1 px-2 py-0.5 text-xs font-bold border ${
                request.source_type === 'store' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-100 text-orange-700 border-orange-200'
              }`}>
                {request.source_type === 'store' ? 'STOK TOKO' : 'STOK GUDANG'}
              </span>
            </div>
            <div className="col-span-2"><span className="text-slate-500">Teknisi:</span> {request.teknisi?.full_name || request.teknisi_name}</div>
            <div className="col-span-2"><span className="text-slate-500">Service:</span> {request.service?.invoice_number} - {request.service?.customer_name}</div>
            <div className="col-span-2"><span className="text-slate-500">Device:</span> {request.service?.watch_brand || request.service?.device_brand}</div>
            {request.admin_notes && (
              <div className="col-span-2"><span className="text-slate-500">Catatan Teknisi:</span> {request.admin_notes}</div>
            )}
          </div>
        </div>

        {/* Stock Check Section */}
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-[#3B82F6]" />
              <span className="font-bold">CEK STOCK</span>
            </div>
            <button
              onClick={() => setShowStockCheck(!showStockCheck)}
              className="text-xs text-[#3B82F6] hover:underline flex items-center gap-1"
            >
              {showStockCheck ? 'Sembunyikan' : 'Lihat Detail Stock'}
              <Eye className="w-3 h-3" />
            </button>
          </div>

          {showStockCheck && (
            <div className="bg-slate-50 p-3 border border-slate-200">
              {checkingStock ? (
                <div className="text-center py-4">
                  <div className="inline-block w-5 h-5 border border-slate-200 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs mt-1">Mengecek stock...</p>
                </div>
              ) : stockData ? (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Item:</span>
                    <span className="font-bold">{stockData.item_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">SKU:</span>
                    <span className="font-mono">{stockData.sku}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Stock Toko:</span>
                    <span className={`font-bold ${stockData.store_stock >= request.quantity ? 'text-green-600' : 'text-red-600'}`}>
                      {stockData.store_stock} {stockData.unit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Stock Gudang:</span>
                    <span className={`font-bold ${stockData.warehouse_stock >= request.quantity ? 'text-green-600' : 'text-red-600'}`}>
                      {stockData.warehouse_stock} {stockData.unit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Min Stock:</span>
                    <span>{stockData.min_stock} {stockData.unit}</span>
                  </div>
                  {request.source_type === 'store' && stockData.store_stock < request.quantity && (
                    <div className="mt-2 p-2 bg-red-100 border border-red-300 text-red-700 text-xs flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Stock toko tidak mencukupi! Tersedia {stockData.store_stock} {stockData.unit}
                    </div>
                  )}
                  {request.source_type === 'warehouse' && stockData.warehouse_stock < request.quantity && (
                    <div className="mt-2 p-2 bg-red-100 border border-red-300 text-red-700 text-xs flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Stock gudang tidak mencukupi! Tersedia {stockData.warehouse_stock} {stockData.unit}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 text-slate-500">
                  <AlertCircle className="w-8 h-8 mx-auto mb-1 opacity-30" />
                  <p className="text-sm">Stock tidak ditemukan</p>
                  <p className="text-xs">Silakan cek inventory atau input SKU yang benar</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
          {messages.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Belum ada pesan</p>
              <p className="text-xs">Ketik pesan untuk konfirmasi ke teknisi</p>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] ${msg.sender_id === user?.id ? 'bg-teal-600' : 'bg-slate-100'} border border-slate-200 p-2`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold">{msg.sender_name}</span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm">{msg.message}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 border-t border-slate-200 flex gap-2 bg-white">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Tulis pesan ke teknisi..."
            className="flex-1 px-3 py-2 border border-slate-200 font-mono focus:outline-none   transition-all"
          />
<button
               onClick={sendMessage}
               disabled={loading}
               className="px-3 bg-teal-600 text-white font-bold border border-slate-200 shadow-sm hover:shadow-md transition-all disabled:opacity-50"
             >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Admin Response & Action Buttons */}
        {request.status === 'pending' && (
          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <div className="mb-3">
              <label className="block text-xs font-black uppercase mb-1">
                RESPON ADMIN (WAJIB UNTUK PENOLAKAN)
              </label>
              <textarea
                value={adminResponse}
                onChange={(e) => setAdminResponse(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-200 font-mono focus:outline-none   transition-all resize-none"
                placeholder="Berikan alasan atau instruksi untuk teknisi..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={rejectRequest}
                disabled={approving}
                className="flex-1 bg-red-500 text-white font-bold py-2 border border-slate-200   transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {approving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                TOLAK
              </button>
              <button
                onClick={approveRequest}
                disabled={approving}
                className="flex-1 bg-green-500 text-white font-bold py-2 border border-slate-200 shadow-sm   transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {approving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                SETUJU & APPROVE
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center">
              *Jika disetujui, stock akan otomatis berkurang dan teknisi akan diberi tahu
            </p>
          </div>
        )}

        {/* Approved Status */}
        {request.status === 'approved' && (
          <div className="p-4 border-t border-slate-200 bg-green-50">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              <span className="font-bold">REQUEST TELAH DISETUJUI</span>
            </div>
            <p className="text-sm text-green-600 mt-1">{request.admin_response || 'Silakan ambil sparepart di gudang'}</p>
            <p className="text-xs text-slate-500 mt-1">Direspon pada: {new Date(request.responded_at).toLocaleString()}</p>
          </div>
        )}

        {/* Rejected Status */}
        {request.status === 'rejected' && (
          <div className="p-4 border-t border-slate-200 bg-red-50">
            <div className="flex items-center gap-2 text-red-700">
              <XCircle className="w-5 h-5" />
              <span className="font-bold">REQUEST DITOLAK</span>
            </div>
            <p className="text-sm text-red-600 mt-1">Alasan: {request.admin_response || '-'}</p>
            <p className="text-xs text-slate-500 mt-1">Direspon pada: {new Date(request.responded_at).toLocaleString()}</p>
          </div>
        )}
      </motion.div>
    </div>
  )
}
