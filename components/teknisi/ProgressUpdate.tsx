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
  Trash2, Edit2
} from 'lucide-react'
import { useUpload } from '@/hooks/useUpload'
import NeonButton from '@/components/ui/NeonButton'
import GlassCard from '@/components/ui/GlassCard'

interface ProgressUpdateProps {
  service: ServiceOrder
  onUpdate: () => void
}

export default function ProgressUpdate({ service, onUpdate }: ProgressUpdateProps) {
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
      toast.warning('No items added. You can skip this step.')
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

      // Save service items
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
          status: 'qc_pending',
          start_date: startDate.toISOString(),
          done_date: (doneDate || new Date()).toISOString(),
          work_duration: workDuration,
          completion_notes: completionNotes
        })
        .eq('id', service.id)

      if (updateError) throw updateError

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'UPDATE_PROGRESS',
        details: {
          service_id: service.id,
          items_count: items.length,
          photos_count: photoUrls.length,
          final_cost: finalCost
        }
      })

      toast.success('Progress updated and submitted for QC review!')
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
              step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
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
          >
            <GlassCard className="p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Service Photos</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {photoPreviews.map((preview, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={preview}
                      alt={`Service ${index + 1}`}
                      className="w-full h-32 object-cover rounded-xl"
                    />
                    <button
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-blue-500 transition-colors"
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
            </GlassCard>
          </motion.div>
        )}

        {/* Step 2: Items */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <GlassCard className="p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Service Items</h3>

              {/* Items List */}
              {items.length > 0 && (
                <div className="mb-4 space-y-2 max-h-60 overflow-y-auto">
                  {items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            item.item_type === 'jasa' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}>
                            {item.item_type === 'jasa' ? 'Jasa' : 'Sparepart'}
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
                  className="px-3 py-2 border rounded-xl"
                >
                  <option value="jasa">Jasa Service</option>
                  <option value="sparepart">Sparepart</option>
                </select>
                <input
                  type="text"
                  placeholder="Item name"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="md:col-span-2 px-3 py-2 border rounded-xl"
                />
                <input
                  type="number"
                  placeholder="Price"
                  value={newItem.price || ''}
                  onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value) })}
                  className="px-3 py-2 border rounded-xl"
                />
                <button
                  onClick={addItem}
                  className="bg-blue-600 text-white py-2 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* Step 3: Summary */}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <GlassCard className="p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Service Summary</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate.toISOString().split('T')[0]}
                    onChange={(e) => setStartDate(new Date(e.target.value))}
                    className="w-full px-4 py-2 border rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Done Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={doneDate?.toISOString().split('T')[0] || ''}
                    onChange={(e) => setDoneDate(e.target.value ? new Date(e.target.value) : null)}
                    className="w-full px-4 py-2 border rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Completion Notes
                  </label>
                  <textarea
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border rounded-xl resize-none"
                    placeholder="Add notes about the service completion..."
                  />
                </div>

                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Total Cost</span>
                    <span className="text-2xl text-blue-600">Rp {finalCost.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="flex justify-between gap-3">
        {step > 1 && (
          <NeonButton variant="secondary" onClick={prevStep}>
            Back
          </NeonButton>
        )}
        {step < 3 ? (
          <NeonButton onClick={nextStep} className={step === 1 ? 'w-full' : ''}>
            Continue
          </NeonButton>
        ) : (
          <NeonButton onClick={submitProgress} loading={loading} className="w-full">
            {loading ? 'Submitting...' : 'Submit to QC'}
          </NeonButton>
        )}
      </div>

      {/* Upload Progress */}
      {uploading && (
        <div className="fixed bottom-4 right-4 bg-white rounded-xl shadow-lg p-4 w-64">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
            <div className="flex-1">
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-gray-500 mt-1">Uploading photos... {progress}%</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
