'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useUpload } from '@/hooks/useUpload'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { Camera, MapPin, X, CheckCircle, Loader, AlertCircle, LogOut, LogIn, Clock } from 'lucide-react'

interface AdminAttendanceModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  type: 'check_in' | 'check_out'
  existingAttendance?: any
}

export default function AdminAttendanceModal({
  isOpen,
  onClose,
  onSuccess,
  type,
  existingAttendance
}: AdminAttendanceModalProps) {
  const [step, setStep] = useState<'camera' | 'location' | 'success'>('camera')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [elapsedTime, setElapsedTime] = useState('00:00:00')
  const [expectedHours, setExpectedHours] = useState({ start: '', end: '', total: 9 })
  const [overtimeHours, setOvertimeHours] = useState(0)
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
    if (dayOfWeek === friday) {
      if (gender === 'female') {
        return { start: '11:00', end: '19:00', total: 8 }
      } else if (gender === 'male') {
        return { start: '13:00', end: '21:00', total: 8 }
      }
    }
    return { start: '11:00', end: '20:00', total: 9 }
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

  const calculateOvertime = (workMinutes: number) => {
    const expectedMinutes = expectedHours.total * 60
    if (workMinutes > expectedMinutes) {
      const overtime = workMinutes - expectedMinutes
      setOvertimeHours(overtime / 60)
    } else {
      setOvertimeHours(0)
    }
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
            const file = new File([blob], `admin_${type}_${Date.now()}.jpg`, { type: 'image/jpeg' })
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
    const inTime = isCheckIn ? formatTime(now) : existingAttendance?.check_in ? formatTime(new Date(existingAttendance.check_in)) : '-'
    const outTime = !isCheckIn ? formatTime(now) : '-'

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

      const expectedMinutes = expectedHours.total * 60
      if (totalMinutes > expectedMinutes) {
        const overtime = totalMinutes - expectedMinutes
        const otHours = Math.floor(overtime / 60)
        const otMinutes = overtime % 60
        lembur = `${otHours}h ${otMinutes}m`
      }
    }

    const caption = `${user?.full_name}
masuk jam : ${inTime}
keluar jam : ${outTime}
total jam : ${workDuration}
lembur : ${lembur}`

    const photoUrl = await uploadFile(photoFile, { 
      type: 'attendance',
      caption: caption
    })

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
            photo_url: photoUrl,
            location: location.address,
            check_in: new Date().toISOString(),
            status: 'checked_in'
          })

        if (dbError) throw dbError
        toast.success('Admin check in successful!')
      } else {
        const checkIn = new Date(existingAttendance.check_in)
        const checkOut = new Date()
        const diffMs = checkOut.getTime() - checkIn.getTime()
        const diffMinutes = Math.floor(diffMs / 60000)
        const hours = Math.floor(diffMinutes / 60)
        const minutes = diffMinutes % 60
        workDuration = `${hours}h ${minutes}m`

        const { error: dbError } = await supabase
          .from('attendances')
          .update({
            check_out: checkOut.toISOString(),
            status: 'checked_out',
            work_duration: workDuration,
            total_minutes: diffMinutes
          })
          .eq('id', existingAttendance?.id)
          .eq('teknisi_id', user?.id)

        if (dbError) throw dbError
        toast.success(`Admin check out successful! Total: ${workDuration}`)
      }

      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: isCheckIn ? 'ADMIN_CHECK_IN' : 'ADMIN_CHECK_OUT',
        details: {
          location: location.address,
          time: new Date().toISOString(),
          work_duration: workDuration,
          overtime: lembur
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-[#E9ECEF]"
      >
        <div className="flex justify-between items-center p-4 border-b border-[#E9ECEF]">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-full ${isCheckIn ? 'bg-green-100' : 'bg-orange-100'}`}>
              {icon}
            </div>
            <div>
              <h3 className="text-lg font-semibold">{title}</h3>
              {!isCheckIn && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  <span>Jam: {expectedHours.start} - {expectedHours.end}</span>
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {step === 'camera' && (
            <>
              {cameraError ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                  <p className="text-red-600 mb-4">{cameraError}</p>
                  {permissionDenied && (
                    <div className="text-sm text-gray-600 mb-4">
                      <p>To enable camera access:</p>
                      <ol className="list-decimal list-inside text-left mt-2">
                        <li>Click the camera icon in your browser's address bar</li>
                        <li>Select "Allow" for camera permission</li>
                        <li>Refresh the page</li>
                      </ol>
                    </div>
                  )}
                  <button onClick={startCamera} className="btn-primary mt-4">
                    Try Again
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative mb-4 bg-black rounded-lg overflow-hidden">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-auto min-h-[300px] object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                  <button
                    onClick={capturePhoto}
                    className="w-full btn-primary flex items-center justify-center gap-2"
                  >
                    <Camera className="w-5 h-5" />
                    Take Photo
                  </button>
                </>
              )}
            </>
          )}

          {step === 'location' && (
            <>
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-[#E9ECEF]">
                {photoPreview && (
                  <img src={photoPreview} alt="Captured" className="w-full rounded-lg mb-4" />
                )}
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-[#E94560] mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium">Your Location:</p>
                    <p className="text-sm text-gray-600 break-words">{location?.address || 'Getting location...'}</p>
                    {location && (
                      <p className="text-xs text-gray-400 mt-1">
                        Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              {!isCheckIn && existingAttendance?.check_in && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-blue-800">Time Elapsed</span>
                    </div>
                    <span className="font-mono text-lg font-bold text-blue-600">{elapsedTime}</span>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    Jam Kerja: {expectedHours.start} - {expectedHours.end} ({expectedHours.total} jam)
                  </p>
                </div>
              )}
              
              {uploading && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Compressing & uploading...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-[#E94560] h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={retakePhoto}
                  disabled={uploading}
                  className="flex-1 btn-secondary"
                >
                  Retake
                </button>
                <button
                  onClick={submitAttendance}
                  disabled={uploading || !location}
                  className="flex-1 btn-primary disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    isCheckIn ? 'Confirm Check In' : 'Confirm Check Out'
                  )}
                </button>
              </div>
            </>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h4 className="text-lg font-semibold mb-2">
                {isCheckIn ? 'Check In Successful!' : 'Check Out Successful!'}
              </h4>
              <p className="text-gray-500">
                {isCheckIn
                  ? 'You have successfully checked in.'
                  : `You have successfully checked out.`}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
