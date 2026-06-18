'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { ServiceOrder, ServiceItem } from '@/types'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, Upload, Plus, X, Save,
  Calendar, Clock, User, Package,
  DollarSign, CheckCircle, AlertCircle,
  Trash2, Edit2, Send, Loader, Wrench
} from 'lucide-react'
import { useUpload } from '@/hooks/useUpload'

interface ProgressUpdateProps {
  service: ServiceOrder
  onUpdate: () => void
  onAddSparepart?: () => void
  onAddJasa?: () => void
  onSubmitToQC?: () => void
}

export default function ProgressUpdate({
  service,
  onUpdate,
  onAddSparepart,
  onAddJasa,
  onSubmitToQC
}: ProgressUpdateProps) {
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [items, setItems] = useState<ServiceItem[]>([])
  const [newItem, setNewItem] = useState({
    name: '',
    price: 0,
    quantity: 1,
    item_type: 'jasa' as 'jasa' | 'sparepart'
  })
  const [startDate, setStartDate] = useState(service.start_date ? new Date(service.start_date) : new Date())
  const [doneDate, setDoneDate] = useState<Date | null>(null)
  const [completionNotes, setCompletionNotes] = useState('')
  const [finalCost, setFinalCost] = useState(service.final_cost || service.estimated_cost || 0)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const { user } = useAuthStore()
  const { uploadFile, uploading, progress } = useUpload()

  const calculateTotal = (itemsList: ServiceItem[]) => {
    return itemsList.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setPhotos([...photos, ...files])

    const newPreviews = files.map(file => URL.createObjectURL(file))
    setPhotoPreviews([...photoPreviews, ...newPreviews])
  }

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index))
    URL.revokeObjectURL(photoPreviews[index])
    setPhotoPreviews(photoPreviews.filter((_, i) => i !== index))
  }

  const addItem = () => {
    if (!newItem.name || newItem.price <= 0) {
      toast.error('Please fill item name and price')
      return
    }

    const newItemObj: ServiceItem = {
      ...newItem,
      id: Date.now().toString(),
      service_order_id: service.id,
      created_at: new Date().toISOString()
    }

    const newItems = [...items, newItemObj]
    setItems(newItems)
    setFinalCost(calculateTotal(newItems))
    setNewItem({ name: '', price: 0, quantity: 1, item_type: 'jasa' })
  }

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index)
    setItems(newItems)
    setFinalCost(calculateTotal(newItems))
  }

  const nextStep = () => {
    if (step === 1 && photoPreviews.length === 0) {
      toast.error('Please upload service photos')
      return
    }
    if (step === 2 && items.length === 0) {
      // Ganti toast.warning dengan toast.custom atau toast.success
      toast.custom((t) => (
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white border-2 border-yellow-400 shadow-lg rounded-lg pointer-events-auto`}>
          <div className="p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-yellow-800">No items added</p>
                <p className="text-xs text-yellow-600 mt-1">You can skip this step and continue.</p>
              </div>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="ml-4 inline-flex text-yellow-400 hover:text-yellow-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ), { duration: 3000 })
    }
    setStep(step + 1)
  }

  const prevStep = () => {
    setStep(step - 1)
  }

  const submitProgress = async () => {
    setLoading(true)

    try {
      // Upload photos
      const photoUrls = []
      for (const photo of photos) {
        const photoUrl = await uploadFile(photo, { type: 'service' })
        if (photoUrl) {
          photoUrls.push(photoUrl)
        }
      }

      // Save service documentation
      for (const photoUrl of photoUrls) {
        await supabase
          .from('service_documentation')
          .insert({
            service_order_id: service.id,
            photo_url: photoUrl,
            stage: 'progress',
            uploaded_by: user?.id
          })
      }

      // Save service items (jasa & sparepart)
      for (const item of items) {
        await supabase
          .from('service_items')
          .insert({
            service_order_id: service.id,
            item_type: item.item_type,
            name: item.name,
            quantity: item.quantity,
            price: item.price
          })
      }

      // Calculate work duration
      const start = new Date(startDate)
      const done = doneDate || new Date()
      const diffDays = Math.ceil((done.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      const workDuration = `${diffDays} day${diffDays > 1 ? 's' : ''}`

      // Update service order
      const { error: updateError } = await supabase
        .from('service_orders')
        .update({
          final_cost: finalCost,
          status: 'in_progress',
          start_date: startDate.toISOString(),
          done_date: (doneDate || new Date()).toISOString(),
          work_duration: workDuration,
          completion_notes: completionNotes
        })
        .eq('id', service.id)

      if (updateError) throw updateError

      // Add to timeline
      await supabase.from('service_timeline').insert({
        service_order_id: service.id,
        teknisi_id: user?.id,
        status: 'in_progress',
        message: `Progress service diupdate oleh teknisi ${user?.full_name}`,
        details: {
          action: 'update_progress',
          items_count: items.length,
          photos_count: photoUrls.length,
          final_cost: finalCost
        }
      })

      toast.success('Progress updated successfully!')
      onUpdate()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex-1 text-center">
            <div className={`w-8 h-8 rounded-full mx-auto flex items-center justify-center text-sm font-semibold ${
              step >= s ? 'bg-[#1A1A2E] text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {s}
            </div>
            <p className="text-xs mt-1 text-gray-500">
              {s === 1 ? 'Photos' : s === 2 ? 'Items' : 'Summary'}
            </p>
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Photos */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-[#F8F9FA] rounded-xl p-4 border border-[#E9ECEF]"
          >
            <h3 className="font-semibold text-[#1A1A2E] mb-4">Service Photos</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {photoPreviews.map((preview, index) => (
                <div key={index} className="relative group">
                  <img
                    src={preview}
                    alt={`Service ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg border border-[#E9ECEF]"
                  />
                  <button
                    onClick={() => removePhoto(index)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#E9ECEF] rounded-lg p-4 text-center hover:border-[#E94560] transition-colors"
              >
                <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <span className="text-xs text-gray-500">Add Photo</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
            <p className="text-xs text-gray-400">Upload photos of the service progress</p>
          </motion.div>
        )}

        {/* Step 2: Items (Jasa & Sparepart) */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-[#F8F9FA] rounded-xl p-4 border border-[#E9ECEF]"
          >
            <h3 className="font-semibold text-[#1A1A2E] mb-4">Service Items</h3>

            {/* Items List */}
            {items.length > 0 && (
              <div className="mb-4 space-y-2 max-h-60 overflow-y-auto">
                {items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-white rounded-lg border border-[#E9ECEF]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          item.item_type === 'jasa' ? 'bg-pink-100 text-pink-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {item.item_type === 'jasa' ? 'JASA' : 'SPAREPART'}
                        </span>
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {item.quantity} x Rp {item.price.toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">Rp {(item.price * item.quantity).toLocaleString()}</span>
                      <button onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Item */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <select
                value={newItem.item_type}
                onChange={(e) => setNewItem({ ...newItem, item_type: e.target.value as 'jasa' | 'sparepart' })}
                className="px-3 py-2 border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#E94560]"
              >
                <option value="jasa">Jasa Service</option>
                <option value="sparepart">Sparepart</option>
              </select>
              <input
                type="text"
                placeholder="Item name"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                className="md:col-span-2 px-3 py-2 border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#E94560]"
              />
              <input
                type="number"
                placeholder="Price"
                value={newItem.price || ''}
                onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value) })}
                className="px-3 py-2 border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#E94560]"
              />
              <button
                onClick={addItem}
                className="bg-[#1A1A2E] text-white py-2 rounded-lg hover:bg-[#0F3460] transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Summary */}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-[#F8F9FA] rounded-xl p-4 border border-[#E9ECEF]"
          >
            <h3 className="font-semibold text-[#1A1A2E] mb-4">Service Summary</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1A1A2E] mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate.toISOString().split('T')[0]}
                  onChange={(e) => setStartDate(new Date(e.target.value))}
                  className="w-full px-3 py-2 border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#E94560]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1A1A2E] mb-1">
                  Done Date (Optional)
                </label>
                <input
                  type="date"
                  value={doneDate?.toISOString().split('T')[0] || ''}
                  onChange={(e) => setDoneDate(e.target.value ? new Date(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#E94560]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1A1A2E] mb-1">
                  Completion Notes
                </label>
                <textarea
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#E94560] resize-none"
                  placeholder="Add notes about the service completion..."
                />
              </div>

              <div className="pt-4 border-t border-[#E9ECEF]">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total Cost</span>
                  <span className="text-2xl text-[#E94560]">Rp {finalCost.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="flex justify-between gap-3">
        {step > 1 && (
          <button
            onClick={prevStep}
            className="px-4 py-2 bg-white text-[#1A1A2E] border border-[#E9ECEF] rounded-lg hover:bg-gray-50 transition-all"
          >
            Back
          </button>
        )}
        {step < 3 ? (
          <button
            onClick={nextStep}
            className={`flex-1 bg-[#1A1A2E] text-white font-medium py-2.5 rounded-lg hover:bg-[#0F3460] transition-all ${step === 1 ? 'w-full' : ''}`}
          >
            Continue
          </button>
        ) : (
          <button
            onClick={submitProgress}
            disabled={loading}
            className="w-full bg-[#1A1A2E] text-white font-medium py-2.5 rounded-lg hover:bg-[#0F3460] transition-all disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Progress'}
          </button>
        )}
      </div>

      {/* Action Buttons - Add Jasa, Add Sparepart, Submit to QC */}
      <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-4 border-t border-[#E9ECEF]">
        <button
          onClick={onAddJasa}
          className="flex-1 bg-[#E94560] text-white font-medium py-2.5 rounded-lg hover:bg-[#c73d54] transition-all flex items-center justify-center gap-2"
        >
          <Wrench className="w-4 h-4" />
          TAMBAH JASA
        </button>
        <button
          onClick={onAddSparepart}
          className="flex-1 bg-[#F8F9FA] text-[#1A1A2E] font-medium py-2.5 rounded-lg border border-[#E9ECEF] hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
        >
          <Package className="w-4 h-4" />
          TAMBAH SPAREPART
        </button>
        <button
          onClick={onSubmitToQC}
          className="flex-1 bg-[#1A1A2E] text-white font-medium py-2.5 rounded-lg hover:bg-[#0F3460] transition-all flex items-center justify-center gap-2"
        >
          <CheckCircle className="w-4 h-4" />
          SUBMIT TO QC
        </button>
      </div>

      {/* Upload Progress */}
      {uploading && (
        <div className="fixed bottom-4 right-4 bg-white rounded-xl shadow-lg p-4 w-64 border border-[#E9ECEF]">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-3 border-[#E94560] border-t-transparent" />
            <div className="flex-1">
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#E94560] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-gray-500 mt-1">Uploading photos... {progress}%</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
