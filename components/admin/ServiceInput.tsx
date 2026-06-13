'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Smartphone, Laptop, Tablet, Watch, Headphones,
  User, Phone, Hash, Cpu, Wrench, DollarSign,
  Send, CheckCircle, AlertCircle, ArrowRight,
  Calendar, Clock, Package, FileText, Users,
  Briefcase, Settings, Battery, Shield, Star,
  Gift, Box, Tag, ChevronRight, Plus, Trash2
} from 'lucide-react'
import GlassCard from '@/components/ui/GlassCard'
import NeonButton from '@/components/ui/NeonButton'

// Device types for service
const deviceTypes = [
  { value: 'smartphone', label: 'Smartphone', icon: Smartphone, color: 'from-blue-500 to-cyan-500' },
  { value: 'laptop', label: 'Laptop', icon: Laptop, color: 'from-indigo-500 to-purple-500' },
  { value: 'tablet', label: 'Tablet', icon: Tablet, color: 'from-purple-500 to-pink-500' },
  { value: 'smartwatch', label: 'Jam Tangan', icon: Watch, color: 'from-emerald-500 to-teal-500' },
  { value: 'headphone', label: 'Headphone', icon: Headphones, color: 'from-orange-500 to-red-500' },
]

// Watch movements
const watchMovements = [
  { value: 'automatic', label: 'Automatic', icon: Settings },
  { value: 'quartz', label: 'Quartz', icon: Battery },
  { value: 'mechanical', label: 'Mechanical', icon: Cpu },
  { value: 'smartwatch', label: 'Smartwatch', icon: Smartphone },
  { value: 'other', label: 'Other', icon: Package },
]

// Watch conditions
const watchConditions = [
  { value: 'new', label: 'New', color: 'text-emerald-600 bg-emerald-50' },
  { value: 'excellent', label: 'Excellent', color: 'text-green-600 bg-green-50' },
  { value: 'good', label: 'Good', color: 'text-blue-600 bg-blue-50' },
  { value: 'fair', label: 'Fair', color: 'text-yellow-600 bg-yellow-50' },
  { value: 'poor', label: 'Poor', color: 'text-red-600 bg-red-50' },
]

// Watch accessories
const watchAccessoriesList = [
  { value: 'original_box', label: 'Original Box', icon: Box },
  { value: 'warranty_card', label: 'Warranty Card', icon: Shield },
  { value: 'extra_strap', label: 'Extra Strap', icon: Watch },
  { value: 'manual_book', label: 'Manual Book', icon: FileText },
  { value: 'tool_kit', label: 'Tool Kit', icon: Wrench },
  { value: 'certificate', label: 'Certificate', icon: Star },
  { value: 'receipt', label: 'Receipt', icon: Receipt },
]

// Popular watch brands
const watchBrands = [
  'Rolex', 'Omega', 'Tag Heuer', 'Casio', 'Seiko',
  'Citizen', 'Tissot', 'Longines', 'Breitling', 'Cartier',
  'Apple Watch', 'Samsung Watch', 'Garmin', 'Fossil', 'Hamilton'
]

interface ServiceItem {
  id: string
  name: string
  quantity: number
  price: number
  type: 'jasa' | 'barang'
}

interface FormData {
  // Customer Information
  cs_name: string
  cs_phone: string
  serial_number: string

  // Device Information
  device_type: string
  device_brand: string
  device_model: string

  // Watch Specific Fields
  watch_brand: string
  watch_model: string
  watch_year: string
  watch_movement: string
  watch_condition: string
  watch_accessories: string[]

  // Service Information
  problem: string
  request: string
  notes: string

  // Teknisi Section (will be filled later)
  assigned_teknisi_id?: string
  start_date?: string
  done_date?: string
  work_duration?: string
  items: ServiceItem[]
  total_cost: number
  completion_notes: string
}

export default function ServiceInput() {
  const [formData, setFormData] = useState<FormData>({
    cs_name: '',
    cs_phone: '',
    serial_number: '',
    device_type: '',
    device_brand: '',
    device_model: '',
    watch_brand: '',
    watch_model: '',
    watch_year: '',
    watch_movement: '',
    watch_condition: '',
    watch_accessories: [],
    problem: '',
    request: '',
    notes: '',
    items: [],
    total_cost: 0,
    completion_notes: ''
  })
  const [newItem, setNewItem] = useState({ name: '', quantity: 1, price: 0, type: 'jasa' as 'jasa' | 'barang' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [lastInvoice, setLastInvoice] = useState<{ invoice: string; token: string } | null>(null)
  const [step, setStep] = useState(1)
  const [showWatchFields, setShowWatchFields] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    setShowWatchFields(formData.device_type === 'smartwatch')
  }, [formData.device_type])

  const generateInvoiceNumber = () => {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `INV-${year}${month}${day}-${random}`
  }

  const generateToken = () => {
    return Math.random().toString(36).substring(2, 15).toUpperCase()
  }

  const addItem = () => {
    if (!newItem.name || newItem.price <= 0) {
      toast.error('Please fill item name and price')
      return
    }

    const item: ServiceItem = {
      id: Date.now().toString(),
      ...newItem,
      quantity: newItem.quantity || 1
    }

    const newItems = [...formData.items, item]
    const newTotal = calculateTotal(newItems)

    setFormData({
      ...formData,
      items: newItems,
      total_cost: newTotal
    })

    setNewItem({ name: '', quantity: 1, price: 0, type: 'jasa' })
  }

  const removeItem = (index: number) => {
    const newItems = formData.items.filter((_, i) => i !== index)
    const newTotal = calculateTotal(newItems)
    setFormData({
      ...formData,
      items: newItems,
      total_cost: newTotal
    })
  }

  const calculateTotal = (items: ServiceItem[]) => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  }

  const nextStep = () => {
    if (step === 1 && !formData.cs_name) {
      toast.error('Please enter customer name')
      return
    }
    if (step === 1 && !formData.cs_phone) {
      toast.error('Please enter customer phone')
      return
    }
    if (step === 2 && !formData.device_type) {
      toast.error('Please select device type')
      return
    }
    if (step === 2 && !formData.device_brand) {
      toast.error('Please enter device brand')
      return
    }
    if (step === 3 && !formData.problem) {
      toast.error('Please describe the problem')
      return
    }
    setStep(step + 1)
  }

  const prevStep = () => {
    setStep(step - 1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const invoiceNumber = generateInvoiceNumber()
      const token = generateToken()
      const tokenExpiresAt = new Date()
      tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 30)

      // Prepare data for database
      const serviceData = {
        invoice_number: invoiceNumber,
        token: token,
        token_expires_at: tokenExpiresAt.toISOString(),
        customer_name: formData.cs_name,
        customer_phone: formData.cs_phone,
        serial_number: formData.serial_number,
        device_type: formData.device_type,
        device_brand: formData.device_brand,
        device_model: formData.device_model,
        watch_brand: formData.watch_brand || null,
        watch_model: formData.watch_model || null,
        watch_year: formData.watch_year ? parseInt(formData.watch_year) : null,
        watch_movement: formData.watch_movement || null,
        watch_condition: formData.watch_condition || null,
        watch_accessories: formData.watch_accessories,
        issue_description: formData.problem,
        request: formData.request,
        notes: formData.notes,
        final_cost: formData.total_cost,
        status: 'pending',
        created_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('service_orders')
        .insert([serviceData])
        .select()
        .single()

      if (error) throw error

      // Insert items if any
      if (formData.items.length > 0) {
        const itemsToInsert = formData.items.map(item => ({
          service_order_id: data.id,
          item_type: item.type,
          name: item.name,
          quantity: item.quantity,
          price: item.price
        }))

        const { error: itemsError } = await supabase
          .from('service_items')
          .insert(itemsToInsert)

        if (itemsError) throw itemsError
      }

      // Add initial timeline entry
      await supabase.from('service_timeline').insert({
        service_order_id: data.id,
        status: 'pending',
        message: `Service order created for ${formData.device_type === 'smartwatch' ? 'watch' : 'device'} ${formData.device_brand} ${formData.device_model}`,
        details: { created_by: 'system', device_type: formData.device_type }
      })

      setLastInvoice({ invoice: invoiceNumber, token: token })
      setSuccess(true)
      setStep(4)

      // Reset form after success
      setTimeout(() => {
        setFormData({
          cs_name: '',
          cs_phone: '',
          serial_number: '',
          device_type: '',
          device_brand: '',
          device_model: '',
          watch_brand: '',
          watch_model: '',
          watch_year: '',
          watch_movement: '',
          watch_condition: '',
          watch_accessories: [],
          problem: '',
          request: '',
          notes: '',
          items: [],
          total_cost: 0,
          completion_notes: ''
        })
        setSuccess(false)
        setStep(1)
      }, 5000)

      toast.success('Service order created successfully!')

    } catch (error: any) {
      console.error('Error:', error)
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const selectedDevice = deviceTypes.find(d => d.value === formData.device_type)
  const isWatch = formData.device_type === 'smartwatch'

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Service Order</h2>
            <p className="text-sm text-gray-500">Create new service request for customer</p>
          </div>
        </div>
      </motion.div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex-1 relative">
              <div className="flex items-center justify-center">
                <motion.div
                  animate={{
                    scale: step >= s ? 1 : 0.9,
                    backgroundColor: step >= s ? '#10b981' : '#e5e7eb'
                  }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                    step >= s ? 'text-white' : 'text-gray-500'
                  }`}
                  style={{ backgroundColor: step >= s ? '#10b981' : '#e5e7eb' }}
                >
                  {step > s ? <CheckCircle className="w-5 h-5" /> : s}
                </motion.div>
                <div className="absolute top-5 text-xs text-gray-500 mt-2 whitespace-nowrap">
                  {s === 1 ? 'Customer' : s === 2 ? 'Device' : s === 3 ? 'Service' : 'Complete'}
                </div>
              </div>
              {s < 4 && (
                <div className={`absolute top-5 left-1/2 w-full h-0.5 -translate-y-1/2 ${
                  step > s ? 'bg-green-500' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Customer Information */}
        {step === 1 && !success && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <GlassCard className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">Customer Information</h3>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CS / Customer Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={formData.cs_name}
                      onChange={(e) => setFormData({ ...formData, cs_name: e.target.value })}
                      required
                      className="w-full pl-9 pr-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="Customer name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    WhatsApp / Phone *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      value={formData.cs_phone}
                      onChange={(e) => setFormData({ ...formData, cs_phone: e.target.value })}
                      required
                      className="w-full pl-9 pr-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="+62 812 3456 7890"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Serial Number / IMEI
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={formData.serial_number}
                      onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                      className="w-full pl-9 pr-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="Serial number or IMEI"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    In Date (Auto)
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={new Date().toLocaleDateString('id-ID')}
                      disabled
                      className="w-full pl-9 pr-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-500"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <NeonButton onClick={nextStep}>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </NeonButton>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* Step 2: Device Information */}
        {step === 2 && !success && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <GlassCard className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <Cpu className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">Device Information</h3>
              </div>

              {/* Device Type Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Device Type *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {deviceTypes.map((device) => (
                    <motion.button
                      key={device.value}
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setFormData({ ...formData, device_type: device.value })}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        formData.device_type === device.value
                          ? `bg-gradient-to-br ${device.color} border-transparent text-white shadow-lg`
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <device.icon className={`w-6 h-6 mx-auto mb-2 ${
                        formData.device_type === device.value ? 'text-white' : 'text-gray-500'
                      }`} />
                      <span className={`text-xs font-medium ${
                        formData.device_type === device.value ? 'text-white' : 'text-gray-600'
                      }`}>
                        {device.label}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Brand *
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400">
                      <Tag className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      list={isWatch ? "watchBrands" : "brands"}
                      value={formData.device_brand}
                      onChange={(e) => setFormData({ ...formData, device_brand: e.target.value })}
                      required
                      className="w-full pl-9 pr-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder={isWatch ? "e.g., Rolex, Omega, Casio" : "e.g., Samsung, Apple"}
                    />
                    <datalist id="brands">
                      <option value="Samsung" /><option value="Apple" /><option value="Xiaomi" />
                      <option value="Oppo" /><option value="Vivo" /><option value="Realme" />
                      <option value="Nokia" /><option value="Sony" /><option value="LG" />
                    </datalist>
                    <datalist id="watchBrands">
                      {watchBrands.map(brand => <option key={brand} value={brand} />)}
                    </datalist>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Model (Optional)
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400">
                      {isWatch ? <Watch className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                    </div>
                    <input
                      type="text"
                      value={formData.device_model}
                      onChange={(e) => setFormData({ ...formData, device_model: e.target.value })}
                      className="w-full pl-9 pr-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder={isWatch ? "e.g., Submariner, Speedmaster" : "e.g., S21, iPhone 13"}
                    />
                  </div>
                </div>
              </div>

              {/* Watch Specific Fields */}
              {showWatchFields && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-6 mt-6 pt-6 border-t border-gray-100"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Watch className="w-5 h-5 text-emerald-500" />
                    <h4 className="font-semibold text-gray-800">Watch Details</h4>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Watch Brand
                      </label>
                      <input
                        type="text"
                        list="watchBrands"
                        value={formData.watch_brand}
                        onChange={(e) => setFormData({ ...formData, watch_brand: e.target.value })}
                        className="w-full px-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder="e.g., Rolex, Omega, Casio"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Watch Model
                      </label>
                      <input
                        type="text"
                        value={formData.watch_model}
                        onChange={(e) => setFormData({ ...formData, watch_model: e.target.value })}
                        className="w-full px-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder="e.g., Submariner, Speedmaster"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Year
                      </label>
                      <input
                        type="number"
                        value={formData.watch_year}
                        onChange={(e) => setFormData({ ...formData, watch_year: e.target.value })}
                        className="w-full px-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder="e.g., 2020"
                        min="1900"
                        max={new Date().getFullYear()}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Movement Type
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {watchMovements.map((movement) => (
                          <button
                            key={movement.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, watch_movement: movement.value })}
                            className={`p-2 rounded-lg text-sm flex items-center gap-2 transition-all ${
                              formData.watch_movement === movement.value
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            <movement.icon className="w-3 h-3" />
                            {movement.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Condition
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {watchConditions.map((condition) => (
                          <button
                            key={condition.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, watch_condition: condition.value })}
                            className={`p-2 rounded-lg text-xs transition-all ${
                              formData.watch_condition === condition.value
                                ? condition.color + ' ring-2 ring-offset-2 ring-emerald-500'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {condition.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Accessories Included
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {watchAccessoriesList.map((accessory) => (
                          <label
                            key={accessory.value}
                            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                              formData.watch_accessories.includes(accessory.value)
                                ? 'bg-emerald-50 border border-emerald-200'
                                : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={formData.watch_accessories.includes(accessory.value)}
                              onChange={(e) => {
                                const current = formData.watch_accessories || []
                                if (e.target.checked) {
                                  setFormData({ ...formData, watch_accessories: [...current, accessory.value] })
                                } else {
                                  setFormData({ ...formData, watch_accessories: current.filter(a => a !== accessory.value) })
                                }
                              }}
                              className="rounded text-emerald-500 focus:ring-emerald-500"
                            />
                            <accessory.icon className="w-3 h-3 text-gray-500" />
                            <span className="text-xs text-gray-600">{accessory.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="mt-8 flex justify-between">
                <NeonButton variant="secondary" onClick={prevStep}>
                  Back
                </NeonButton>
                <NeonButton onClick={nextStep}>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </NeonButton>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* Step 3: Service Information */}
        {step === 3 && !success && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <GlassCard className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">Service Details</h3>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Problem / Kendala *
                  </label>
                  <textarea
                    value={formData.problem}
                    onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
                    required
                    rows={3}
                    className="w-full px-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                    placeholder="Describe the problem in detail..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Request Customer
                  </label>
                  <textarea
                    value={formData.request}
                    onChange={(e) => setFormData({ ...formData, request: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                    placeholder="Customer's specific request..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Notes / Keterangan
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                    placeholder="Any additional notes..."
                  />
                </div>

                {/* Summary Preview */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Summary</p>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-gray-500">Customer:</span> {formData.cs_name}</p>
                    <p><span className="text-gray-500">Phone:</span> {formData.cs_phone}</p>
                    <p><span className="text-gray-500">Device:</span> {selectedDevice?.label} {formData.device_brand} {formData.device_model}</p>
                    {isWatch && formData.watch_brand && (
                      <p><span className="text-gray-500">Watch:</span> {formData.watch_brand} {formData.watch_model}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-between">
                <NeonButton variant="secondary" onClick={prevStep}>
                  Back
                </NeonButton>
                <NeonButton onClick={handleSubmit} loading={loading}>
                  {loading ? 'Creating...' : 'Create Service Order'}
                  {!loading && <Send className="w-4 h-4 ml-2" />}
                </NeonButton>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* Step 4: Success */}
        {step === 4 && success && lastInvoice && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
          >
            <GlassCard className="p-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl"
              >
                <CheckCircle className="w-10 h-10 text-white" />
              </motion.div>

              <h3 className="text-2xl font-bold text-gray-800 mb-2">Service Order Created!</h3>
              <p className="text-gray-500 mb-6">The service order has been successfully created.</p>

              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 mb-6">
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-1">Invoice Number</p>
                  <p className="text-xl font-bold text-gray-800">{lastInvoice.invoice}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Tracking Token</p>
                  <p className="text-xl font-mono text-blue-600">{lastInvoice.token}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <NeonButton variant="secondary" onClick={() => window.location.reload()}>
                  Create Another
                </NeonButton>
                <NeonButton onClick={() => {
                  navigator.clipboard.writeText(lastInvoice.token)
                  toast.success('Token copied!')
                }}>
                  Copy Token
                </NeonButton>
              </div>

              <p className="text-xs text-gray-400 mt-6">
                Give this token to customer for tracking service status
              </p>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Import missing icon
import { Receipt } from 'lucide-react'
