'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Phone, Hash, Watch, Calendar,
  Send, CheckCircle, AlertCircle, ArrowRight,
  Settings, Battery, Cpu, Sparkles
} from 'lucide-react'

const watchMovements = [
  { value: 'automatic', label: 'AUTOMATIC', icon: Settings, color: 'pink' },
  { value: 'quartz', label: 'QUARTZ', icon: Battery, color: 'yellow' },
  { value: 'mechanical', label: 'MECHANICAL', icon: Cpu, color: 'blue' },
]

const watchBrands = [
  'ROLEX', 'OMEGA', 'TAG HEUER', 'CASIO', 'SEIKO',
  'CITIZEN', 'TISSOT', 'LONGINES', 'BREITLING', 'CARTIER',
  'APPLE WATCH', 'SAMSUNG WATCH', 'GARMIN'
]

export default function ServiceInput() {
  const [formData, setFormData] = useState({
    cs_name: '',
    cs_phone: '',
    serial_number: '',
    watch_brand: '',
    watch_model: '',
    watch_year: '',
    watch_movement: '',
    problem: '',
    request: '',
    notes: ''
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [lastInvoice, setLastInvoice] = useState<{ invoice: string; token: string } | null>(null)
  const [step, setStep] = useState(1)
  const supabase = createClient()

  const generateInvoiceNumber = () => {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `WATCH-${year}${month}${day}-${random}`
  }

  const generateToken = () => {
    return Math.random().toString(36).substring(2, 15).toUpperCase()
  }

  const nextStep = () => {
    if (step === 1 && (!formData.cs_name || !formData.cs_phone)) {
      toast.error('Fill customer info!')
      return
    }
    if (step === 2 && (!formData.watch_brand || !formData.watch_movement)) {
      toast.error('Fill watch details!')
      return
    }
    if (step === 3 && !formData.problem) {
      toast.error('Describe the problem!')
      return
    }
    setStep(step + 1)
  }

  const prevStep = () => setStep(step - 1)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const invoiceNumber = generateInvoiceNumber()
      const token = generateToken()
      const tokenExpiresAt = new Date()
      tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 30)

      const { error } = await supabase
        .from('service_orders')
        .insert([{
          invoice_number: invoiceNumber,
          token: token,
          token_expires_at: tokenExpiresAt.toISOString(),
          customer_name: formData.cs_name,
          customer_phone: formData.cs_phone,
          serial_number: formData.serial_number,
          device_type: 'smartwatch',
          device_brand: formData.watch_brand,
          device_model: formData.watch_model,
          watch_brand: formData.watch_brand,
          watch_model: formData.watch_model,
          watch_year: formData.watch_year ? parseInt(formData.watch_year) : null,
          watch_movement: formData.watch_movement,
          issue_description: formData.problem,
          request: formData.request,
          notes: formData.notes,
          status: 'pending'
        }])

      if (error) throw error

      setLastInvoice({ invoice: invoiceNumber, token: token })
      setSuccess(true)
      setStep(4)

      setTimeout(() => {
        setFormData({
          cs_name: '', cs_phone: '', serial_number: '',
          watch_brand: '', watch_model: '', watch_year: '',
          watch_movement: '', problem: '', request: '', notes: ''
        })
        setSuccess(false)
        setStep(1)
      }, 5000)

      toast.success('Watch service order created!')
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-[#FF6B9D] flex items-center justify-center border-2 border-black shadow-[4px_4px_0px_0px_black]">
            <Watch className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tighter">NEW WATCH SERVICE</h2>
            <p className="text-xs font-mono">Create service order for timepiece</p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex mb-8 border-2 border-black">
        {[1, 2, 3].map((s) => {
          const colors = {
            1: 'bg-[#FF6B9D] text-white',
            2: 'bg-[#FFDE00] text-black',
            3: 'bg-[#3B82F6] text-white'
          }
          return (
            <div
              key={s}
              className={`flex-1 py-3 text-center font-bold text-sm border-r-2 border-black last:border-r-0 ${
                step >= s ? colors[s as keyof typeof colors] : 'bg-white text-black'
              }`}
            >
              {s === 1 ? 'CUSTOMER' : s === 2 ? 'WATCH' : 'ISSUE'}
            </div>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Customer - Pink Theme */}
        {step === 1 && !success && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="border-2 border-black bg-white p-6 shadow-[6px_6px_0px_0px_black]"
          >
            <div className="flex items-center gap-2 mb-6 pb-2 border-b-2 border-black">
              <div className="w-8 h-8 bg-[#FF6B9D] flex items-center justify-center border-2 border-black">
                <User className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-xl font-black">CUSTOMER INFO</h3>
              <span className="ml-auto text-xs font-mono bg-[#FF6B9D] text-white px-2 py-0.5 border border-black">STEP 1/3</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase mb-1">FULL NAME <span className="text-[#FF6B9D]">*</span></label>
                <input
                  type="text"
                  value={formData.cs_name}
                  onChange={(e) => setFormData({ ...formData, cs_name: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-black font-mono focus:outline-none focus:translate-x-[1px] focus:translate-y-[1px] transition-all"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase mb-1">WHATSAPP / PHONE <span className="text-[#FF6B9D]">*</span></label>
                <input
                  type="tel"
                  value={formData.cs_phone}
                  onChange={(e) => setFormData({ ...formData, cs_phone: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-black font-mono focus:outline-none focus:translate-x-[1px] focus:translate-y-[1px] transition-all"
                  placeholder="+62 812 3456 7890"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase mb-1">SERIAL NUMBER</label>
                <input
                  type="text"
                  value={formData.serial_number}
                  onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-black font-mono focus:outline-none focus:translate-x-[1px] focus:translate-y-[1px] transition-all"
                  placeholder="Watch serial number"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase mb-1">IN DATE</label>
                <div className="flex items-center gap-2 px-3 py-2 border-2 border-black bg-[#F5F5F5]">
                  <Calendar className="w-4 h-4 text-[#FF6B9D]" />
                  <span className="font-mono text-sm">{new Date().toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={nextStep}
                className="bg-[#FF6B9D] text-white font-bold px-6 py-2 border-2 border-black shadow-[3px_3px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center gap-2"
              >
                NEXT <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Watch Details - Yellow Theme */}
        {step === 2 && !success && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="border-2 border-black bg-white p-6 shadow-[6px_6px_0px_0px_black]"
          >
            <div className="flex items-center gap-2 mb-6 pb-2 border-b-2 border-black">
              <div className="w-8 h-8 bg-[#FFDE00] flex items-center justify-center border-2 border-black">
                <Watch className="w-4 h-4 text-black" />
              </div>
              <h3 className="text-xl font-black">WATCH DETAILS</h3>
              <span className="ml-auto text-xs font-mono bg-[#FFDE00] text-black px-2 py-0.5 border border-black">STEP 2/3</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase mb-1">BRAND <span className="text-[#FFDE00]">*</span></label>
                <input
                  type="text"
                  list="watchBrands"
                  value={formData.watch_brand}
                  onChange={(e) => setFormData({ ...formData, watch_brand: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border-2 border-black font-mono focus:outline-none focus:translate-x-[1px] focus:translate-y-[1px] transition-all uppercase"
                  placeholder="ROLEX, OMEGA, CASIO..."
                />
                <datalist id="watchBrands">
                  {watchBrands.map(brand => <option key={brand} value={brand} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-black uppercase mb-1">MODEL</label>
                <input
                  type="text"
                  value={formData.watch_model}
                  onChange={(e) => setFormData({ ...formData, watch_model: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border-2 border-black font-mono focus:outline-none focus:translate-x-[1px] focus:translate-y-[1px] transition-all uppercase"
                  placeholder="SUBMARINER, SPEEDMASTER..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase mb-1">YEAR</label>
                  <input
                    type="number"
                    value={formData.watch_year}
                    onChange={(e) => setFormData({ ...formData, watch_year: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-black font-mono focus:outline-none focus:translate-x-[1px] focus:translate-y-[1px] transition-all"
                    placeholder="2020"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase mb-1">MOVEMENT <span className="text-[#FFDE00]">*</span></label>
                  <div className="grid grid-cols-3 gap-2">
                    {watchMovements.map((movement) => (
                      <button
                        key={movement.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, watch_movement: movement.value })}
                        className={`py-2 text-xs font-bold border-2 border-black transition-all ${
                          formData.watch_movement === movement.value
                            ? movement.color === 'pink' ? 'bg-[#FF6B9D] text-white'
                              : movement.color === 'yellow' ? 'bg-[#FFDE00] text-black'
                              : 'bg-[#3B82F6] text-white'
                            : 'bg-white text-black hover:bg-gray-100'
                        }`}
                      >
                        <movement.icon className="w-3 h-3 mx-auto mb-1" />
                        {movement.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={prevStep}
                className="bg-white text-black font-bold px-6 py-2 border-2 border-black hover:bg-gray-100 transition-all"
              >
                BACK
              </button>
              <button
                onClick={nextStep}
                className="bg-[#FFDE00] text-black font-bold px-6 py-2 border-2 border-black shadow-[3px_3px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center gap-2"
              >
                NEXT <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Issue - Blue Theme */}
        {step === 3 && !success && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="border-2 border-black bg-white p-6 shadow-[6px_6px_0px_0px_black]"
          >
            <div className="flex items-center gap-2 mb-6 pb-2 border-b-2 border-black">
              <div className="w-8 h-8 bg-[#3B82F6] flex items-center justify-center border-2 border-black">
                <AlertCircle className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-xl font-black">SERVICE ISSUE</h3>
              <span className="ml-auto text-xs font-mono bg-[#3B82F6] text-white px-2 py-0.5 border border-black">STEP 3/3</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase mb-1">PROBLEM / KENDALA <span className="text-[#3B82F6]">*</span></label>
                <textarea
                  value={formData.problem}
                  onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border-2 border-black font-mono focus:outline-none focus:translate-x-[1px] focus:translate-y-[1px] transition-all resize-none"
                  placeholder="Describe the watch issue..."
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase mb-1">CUSTOMER REQUEST</label>
                <textarea
                  value={formData.request}
                  onChange={(e) => setFormData({ ...formData, request: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border-2 border-black font-mono focus:outline-none focus:translate-x-[1px] focus:translate-y-[1px] transition-all resize-none"
                  placeholder="Special requests from customer..."
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase mb-1">ADDITIONAL NOTES</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border-2 border-black font-mono focus:outline-none focus:translate-x-[1px] focus:translate-y-[1px] transition-all resize-none"
                  placeholder="Any additional notes..."
                />
              </div>

              {/* Summary Box */}
              <div className="mt-4 p-4 border-2 border-black bg-[#F5F5F5]">
                <p className="text-xs font-black uppercase mb-2 flex items-center gap-2">
                  <Sparkles className="w-3 h-3 text-[#FFDE00]" />
                  SUMMARY
                </p>
                <div className="space-y-1 text-sm font-mono">
                  <p><span className="font-bold">CUSTOMER:</span> {formData.cs_name || '—'}</p>
                  <p><span className="font-bold">WATCH:</span> {formData.watch_brand || '—'} {formData.watch_model || '—'}</p>
                  <p><span className="font-bold">MOVEMENT:</span> {formData.watch_movement?.toUpperCase() || '—'}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={prevStep}
                className="bg-white text-black font-bold px-6 py-2 border-2 border-black hover:bg-gray-100 transition-all"
              >
                BACK
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-[#3B82F6] text-white font-bold px-6 py-2 border-2 border-black shadow-[3px_3px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? 'CREATING...' : 'CREATE ORDER'}
                {!loading && <Send className="w-4 h-4" />}
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 4: Success */}
        {step === 4 && success && lastInvoice && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="border-2 border-black bg-white p-8 text-center shadow-[8px_8px_0px_0px_black]"
          >
            <div className="w-16 h-16 bg-[#FF6B9D] flex items-center justify-center mx-auto mb-4 border-2 border-black">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>

            <h3 className="text-2xl font-black mb-2">ORDER CREATED!</h3>
            <p className="font-mono text-sm mb-6">Watch service order has been created.</p>

            <div className="border-2 border-black p-4 mb-6 bg-[#F5F5F5]">
              <p className="text-xs font-black uppercase mb-1">INVOICE NUMBER</p>
              <p className="text-xl font-black font-mono">{lastInvoice.invoice}</p>
              <div className="w-12 h-0.5 bg-black my-3 mx-auto" />
              <p className="text-xs font-black uppercase mb-1">TRACKING TOKEN</p>
              <p className="text-lg font-black font-mono text-[#FF6B9D]">{lastInvoice.token}</p>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="bg-white text-black font-bold px-5 py-2 border-2 border-black hover:bg-gray-100 transition-all"
              >
                NEW ORDER
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(lastInvoice.token)
                  toast.success('Token copied!')
                }}
                className="bg-[#FFDE00] text-black font-bold px-5 py-2 border-2 border-black shadow-[3px_3px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
              >
                COPY TOKEN
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
