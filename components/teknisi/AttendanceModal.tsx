'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useUpload } from '@/hooks/useUpload'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { Camera, MapPin, X, CheckCircle, Loader, AlertCircle, LogOut, LogIn, Clock, User } from 'lucide-react'

interface AttendanceModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  type: 'check_in' | 'check_out'
  existingAttendance?: any
}

export default function AttendanceModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  type,
  existingAttendance 
}: AttendanceModalProps) {
  const [step, setStep] = useState<'camera' | 'location' | 'success'>('camera')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [elapsedTime, setElapsedTime] = useState('00:00:00')
  const [expectedHours, setExpectedHours] = useState({ start: '', end: '', total: 9 })
  const [isOvertime, setIsOvertime] = useState(false)
  const [checkOutNotes, setCheckOutNotes] = useState('')
  const [checkInNotes, setCheckInNotes] = useState('')
  const overtimeThreshold = 20
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const supabase = createClient()
  const { user } = useAuthStore()
  const { uploadFile, uploading, progress } = useUpload()

  const isCheckIn = type === 'check_in'
  const title = isCheckIn ? 'Absen Masuk' : 'Absen Pulang'
  const icon = isCheckIn ? <LogIn className="w-6 h-6" /> : <LogOut className="w-6 h-6" />

  const getWorkHoursByDayAndGender = (dayOfWeek: number, gender: string) => {
    const friday = 5
    const saturday = 6
    if (dayOfWeek === friday) {
      if (gender === 'female') {
        return { start: '11:00', end: '19:00', total: 8, overtimeStart: '19:00' }
      } else if (gender === 'male') {
        return { start: '13:00', end: '21:00', total: 8, overtimeStart: '21:00' }
      }
      return { start: '11:00', end: '20:00', total: 9, overtimeStart: '19:00' }
    }
    if (dayOfWeek === saturday) {
      return { start: '11:00', end: '20:00', total: 9, overtimeStart: '19:00' }
    }
    return { start: '11:00', end: '20:00', total: 9, overtimeStart: '19:00' }
  }

  const parseTimeToMinutes = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 60 + minutes
  }

  const getOvertimeMinutesFromSchedule = (checkInTime: Date, checkOutTime: Date, dayOfWeek: number, gender: string) => {
    const schedule = getWorkHoursByDayAndGender(dayOfWeek, gender)
    const overtimeStartMinutes = parseTimeToMinutes(schedule.overtimeStart || schedule.end)
    const checkOutMinutes = checkOutTime.getHours() * 60 + checkOutTime.getMinutes()
    return Math.max(0, checkOutMinutes - overtimeStartMinutes)
  }

  const calculateTime = () => {
    if (!existingAttendance?.check_in) return
    const now = new Date()
    const start = new Date(existingAttendance.check_in)
    const diff = now.getTime() - start.getTime()
    const hours = Math.floor(diff / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    setElapsedTime(
      `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    )
  }

  const getOvertimeText = () => {
    if (!existingAttendance?.check_in) return 'tidak ada'
    const now = new Date()
    const checkIn = new Date(existingAttendance.check_in)
    const diffMs = now.getTime() - checkIn.getTime()
    const totalMinutes = Math.floor(diffMs / 60000)
    const thresholdMinutes = overtimeThreshold * 60
    if (totalMinutes > thresholdMinutes) {
      const overtime = totalMinutes - thresholdMinutes
      const otHours = Math.floor(overtime / 60)
      const otMinutes = overtime % 60
      return `${otHours}h ${otMinutes}m`
    }
    return 'tidak ada'
  }

  useEffect(() => {
    if (isOpen && user) {
      const today = new Date()
      const dayOfWeek = today.getDay()
      const gender = (user as any).gender || 'other'
      setExpectedHours(getWorkHoursByDayAndGender(dayOfWeek, gender))
      
      if (!isCheckIn && existingAttendance?.check_in) {
        calculateTime()
        timerRef.current = setInterval(calculateTime, 1000)
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isOpen, type, user, existingAttendance])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }

  const startCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Your browser does not support camera access')
      toast.error('Camera not supported in this browser')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }
      })
      
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
        }
      }
      setCameraError(null)
      setPermissionDenied(false)
    } catch (error: any) {
      console.error('Camera error:', error)
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionDenied(true)
        setCameraError('Camera permission denied. Please allow camera access.')
        toast.error('Camera access denied')
      } else if (error.name === 'NotFoundError') {
        setCameraError('No camera found on this device')
        toast.error('No camera detected')
      } else {
        setCameraError(`Cannot access camera: ${error.message}`)
        toast.error('Failed to access camera')
      }
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  useEffect(() => {
    if (isOpen && step === 'camera') {
      setCameraError(null)
      setPermissionDenied(false)
      startCamera()
    }
    return () => {
      stopCamera()
    }
  }, [isOpen, step])

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      const context = canvas.getContext('2d')
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        
        canvas.toBlob(async (blob) => {
          if (blob) {
            const file = new File([blob], `attendance_${type}_${Date.now()}.jpg`, { type: 'image/jpeg' })
            setPhotoFile(file)
            const previewUrl = URL.createObjectURL(blob)
            setPhotoPreview(previewUrl)
            stopCamera()
            setStep('location')
            getCurrentLocation()
          }
        }, 'image/jpeg', 0.95)
      }
    }
  }

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported')
      return
    }

    toast.loading('Getting your location...', { id: 'location' })

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        toast.dismiss('location')
        const { latitude, longitude } = position.coords
        
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18`,
            {
              headers: { 'User-Agent': 'ServiceManagementApp/1.0' }
            }
          )
          const data = await response.json()
          
          let address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
          if (data.display_name) {
            const parts = data.display_name.split(',')
            address = parts.slice(0, 3).join(',')
          }
          
          setLocation({
            lat: latitude,
            lng: longitude,
            address: address
          })
          
          toast.success('Location detected!')
        } catch (error) {
          setLocation({
            lat: latitude,
            lng: longitude,
            address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
          })
          toast.success('Location detected!')
        }
      },
      (error) => {
        toast.dismiss('location')
        console.error('Geolocation error:', error)
        
        let errorMessage = 'Unable to get location'
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = 'Location permission denied'
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage = 'Location information unavailable'
        }
        
        toast.error(errorMessage)
        setLocation({
          lat: -6.200000,
          lng: 106.816666,
          address: 'Location unavailable (using default)'
        })
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
  }

  const retakePhoto = () => {
    setPhotoFile(null)
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
      setPhotoPreview(null)
    }
    setStep('camera')
    startCamera()
  }

  const submitAttendance = async () => {
    if (!photoFile || !location) {
      toast.error('Missing photo or location')
      return
    }

    const now = new Date()
    const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const role = ((user as any)?.role || (user as any)?.user_metadata?.role || 'staff').toUpperCase()

    let workDuration = '-'
    let totalMinutes = 0
    let lembur = 'tidak ada'

    if (!isCheckIn && existingAttendance?.check_in) {
      const checkIn = new Date(existingAttendance.check_in)
      const checkOut = new Date()
      const diffMs = checkOut.getTime() - checkIn.getTime()
      totalMinutes = Math.floor(diffMs / 60000)
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60
      workDuration = `${hours}h ${minutes}m`

      const thresholdMinutes = overtimeThreshold * 60
      if (totalMinutes > thresholdMinutes) {
        const overtime = totalMinutes - thresholdMinutes
        const otHours = Math.floor(overtime / 60)
        const otMinutes = overtime % 60
        lembur = `${otHours}h ${otMinutes}m`
      }
    }

    let photoUrl: string | null = null
    if (!isCheckIn) {
      let caption = `ABSEN PULANG
absensi: ${dateStr} ${timeStr}
role: ${role}
nama: ${user?.full_name}
total jam: ${workDuration}
lembur: ${lembur}`

      if (isOvertime) {
        caption = caption + `\nlembur: YA\ncatatan: ${checkOutNotes || '-'}`
      }

      photoUrl = (await uploadFile(photoFile, {
        type: 'attendance',
        caption: caption
      }))?.url || null
    } else {
      const caption = `ABSEN MASUK
absensi: ${dateStr} ${timeStr}
role: ${role}
nama: ${user?.full_name}
catatan: ${checkInNotes || '-'}`

      photoUrl = (await uploadFile(photoFile, {
        type: 'attendance',
        caption: caption
      }))?.url || null
    }

    if (!photoUrl) {
      toast.error('Failed to upload photo')
      return
    }

    try {
      if (isCheckIn) {
        const { error: dbError } = await supabase
          .from('attendances')
          .insert({
            teknisi_id: user?.id,
            photo_url: photoUrl!,
            location: location.address,
            check_in: new Date().toISOString(),
            status: 'checked_in',
            notes: checkInNotes || null
          })

        if (dbError) throw dbError
        toast.success('Check in successful!')
      } else {
        const checkIn = new Date(existingAttendance.check_in)
        const checkOut = new Date()
        const diffMs = checkOut.getTime() - checkIn.getTime()
        const diffMinutes = Math.floor(diffMs / 60000)
        const hours = Math.floor(diffMinutes / 60)
        const minutes = diffMinutes % 60
        workDuration = `${hours}h ${minutes}m`

        const dayOfWeek = checkOut.getDay()
        const gender = (user as any)?.gender || 'other'
        const schemaOvertimeMinutes = getOvertimeMinutesFromSchedule(checkIn, checkOut, dayOfWeek, gender)
        const overtimeMinutes = isOvertime ? Math.max(0, diffMinutes - (overtimeThreshold * 60)) : schemaOvertimeMinutes

        const { error: dbError } = await supabase
          .from('attendances')
          .update({
            check_out: checkOut.toISOString(),
            status: 'checked_out',
            work_duration: workDuration,
            total_minutes: diffMinutes,
            overtime_minutes: overtimeMinutes,
            is_overtime: isOvertime,
            notes: checkOutNotes || null
          })
          .eq('id', existingAttendance?.id)
          .eq('teknisi_id', user?.id)

        if (dbError) throw dbError
        toast.success(`Check out successful! Total: ${workDuration}`)
      }

      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: isCheckIn ? 'CHECK_IN' : 'CHECK_OUT',
        details: {
          location: location.address,
          time: new Date().toISOString(),
          work_duration: workDuration,
          overtime: lembur,
          is_overtime: isOvertime,
          notes: checkOutNotes || null
        }
      })

      setStep('success')

      setTimeout(() => {
        if (photoPreview) URL.revokeObjectURL(photoPreview)
        if (timerRef.current) clearInterval(timerRef.current)
        onSuccess()
        onClose()
      }, 2000)
    } catch (error: any) {
      console.error('Attendance error:', error)
      toast.error(error.message || `Failed to ${isCheckIn ? 'check in' : 'check out'}`)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 max-h-[85vh] sm:max-h-[80vh] flex flex-col"
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${isCheckIn ? 'bg-teal-50' : 'bg-amber-50'}`}>
              {icon}
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              {!isCheckIn && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock className="w-3 h-3" />
                  <span>Jam: {expectedHours.start} - {expectedHours.end}</span>
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1">
          {step === 'camera' && (
            <>
              {cameraError ? (
                <div className="text-center py-6">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                  <p className="text-red-600 text-sm mb-3">{cameraError}</p>
                  {permissionDenied && (
                    <div className="text-xs text-slate-600 mb-4 text-left bg-slate-50 p-3 rounded-lg">
                      <p className="font-medium mb-2">Aktifkan kamera:</p>
                      <ol className="list-decimal list-inside space-y-1 text-slate-600">
                        <li>Klik ikon kamera di address bar</li>
                        <li>Pilih &quot;Allow&quot; untuk akses kamera</li>
                        <li>Refresh halaman</li>
                      </ol>
                    </div>
                  )}
                  <button onClick={startCamera} className="btn-primary text-sm">
                    Coba Lagi
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative mb-3 bg-black rounded-xl overflow-hidden">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-auto min-h-[180px] sm:min-h-[240px] object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                  <button
                    onClick={capturePhoto}
                    className="w-full bg-slate-900 text-white font-medium py-2.5 rounded-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <Camera className="w-5 h-5" />
                    Ambil Foto
                  </button>
                </>
              )}
            </>
          )}

          {step === 'location' && (
            <>
              <div className="mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                {photoPreview && (
                  <img src={photoPreview} alt="Hasil foto" className="w-full rounded-lg mb-2.5 max-h-32 object-cover" />
                )}
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-900">Lokasi:</p>
                    <p className="text-xs text-slate-600 break-words">{location?.address || 'Mendapatkan lokasi...'}</p>
                    {location && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
                <textarea
                  value={isCheckIn ? checkInNotes : checkOutNotes}
                  onChange={(e) => isCheckIn ? setCheckInNotes(e.target.value) : setCheckOutNotes(e.target.value)}
                  placeholder={isCheckIn ? "Catatan absen masuk (opsional)..." : "Catatan absen pulang (opsional)..."}
                  rows={2}
                  className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg focus:outline-none focus:border-blue-500 text-sm resize-none"
                />
              </div>

              {!isCheckIn && existingAttendance?.check_in && (
                <div className="mb-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span className="font-medium text-blue-800 text-sm">Waktu Kerja</span>
                    </div>
                    <span className="font-mono text-base font-bold text-blue-600">{elapsedTime}</span>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    Jam: {expectedHours.start} - {expectedHours.end} ({expectedHours.total} jam)
                  </p>
                </div>
              )}

              {!isCheckIn && (
                <div className="mb-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <label className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={isOvertime}
                      onChange={(e) => setIsOvertime(e.target.checked)}
                      className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-sm font-medium text-amber-800">Lembur</span>
                  </label>
                </div>
              )}

              {uploading && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Mengupload...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2.5">
                <button
                  onClick={retakePhoto}
                  disabled={uploading}
                  className="flex-1 bg-white text-slate-900 border border-slate-200 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium"
                >
                  Ulangi
                </button>
                <button
                  onClick={submitAttendance}
                  disabled={uploading || !location}
                  className="flex-1 bg-slate-900 text-white font-medium py-2 rounded-lg hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 text-sm"
                >
                  {uploading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      <span className="hidden sm:inline">Memproses...</span>
                      <span className="sm:hidden">...</span>
                    </>
                  ) : (
                    isCheckIn ? 'Absen Masuk' : 'Absen Pulang'
                  )}
                </button>
              </div>
            </>
          )}

          {step === 'success' && (
            <div className="text-center py-6">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h4 className="text-base font-semibold text-slate-900 mb-1">
                {isCheckIn ? 'Absen Masuk Berhasil!' : 'Absen Pulang Berhasil!'}
              </h4>
              {!isCheckIn && (
                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600 mb-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Total: {elapsedTime.replace(/00:00:00/, 'Menghitung...')}</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Jam Kerja: {expectedHours.start} - {expectedHours.end}
                  </p>
                </div>
              )}
              <p className="text-xs text-slate-500 mt-2">
                {isCheckIn
                  ? 'Anda sudah absen masuk.'
                  : 'Anda sudah absen pulang.'}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}