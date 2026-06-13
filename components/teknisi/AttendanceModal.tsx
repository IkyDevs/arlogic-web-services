'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useUpload } from '@/hooks/useUpload'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { Camera, MapPin, X, CheckCircle, Loader, AlertCircle, LogOut, LogIn } from 'lucide-react'

interface AttendanceModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  type: 'check_in' | 'check_out'  // New prop
  existingAttendance?: any // For check_out, we need the existing record
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
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const supabase = createClient()
  const { user } = useAuthStore()
  const { uploadFile, uploading, progress } = useUpload()

  const isCheckIn = type === 'check_in'
  const title = isCheckIn ? 'Check In - Start Work' : 'Check Out - End Work'
  const icon = isCheckIn ? <LogIn className="w-6 h-6" /> : <LogOut className="w-6 h-6" />

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
            const file = new File([blob], `${type}_${Date.now()}.jpg`, { type: 'image/jpeg' })
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
        // Use default location as fallback
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

    // Upload photo to Cloudflare R2 with compression
    const photoUrl = await uploadFile(photoFile, { type: 'attendance' })

    if (!photoUrl) {
      toast.error('Failed to upload photo')
      return
    }

    try {
      if (isCheckIn) {
        // CHECK IN - Create new attendance record
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
        toast.success('Check In successful! Welcome to work!')
      } else {
        // CHECK OUT - Update existing attendance record
        const { error: dbError } = await supabase
          .from('attendances')
          .update({
            check_out: new Date().toISOString(),
            status: 'checked_out'
          })
          .eq('id', existingAttendance?.id)
          .eq('teknisi_id', user?.id)

        if (dbError) throw dbError
        toast.success('Check Out successful! Have a nice休息!')
      }

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: isCheckIn ? 'CHECK_IN' : 'CHECK_OUT',
        details: {
          location: location.address,
          time: new Date().toISOString()
        }
      })

      setStep('success')

      setTimeout(() => {
        if (photoPreview) URL.revokeObjectURL(photoPreview)
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl p-6 w-full max-w-md"
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-full ${isCheckIn ? 'bg-green-100' : 'bg-orange-100'}`}>
              {icon}
            </div>
            <h3 className="text-xl font-bold">{title}</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {step === 'camera' && (
          <div>
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
                <div className="flex gap-3">
                  <button
                    onClick={capturePhoto}
                    className="flex-1 btn-primary flex items-center justify-center gap-2"
                  >
                    <Camera className="w-5 h-5" />
                    Take Photo
                  </button>
                </div>
                <p className="text-xs text-gray-500 text-center mt-3">
                  Make sure your face is clearly visible
                </p>
              </>
            )}
          </div>
        )}

        {step === 'location' && (
          <div>
            <div className="mb-4 p-4 bg-gray-100 rounded-lg">
              {photoPreview && (
                <img src={photoPreview} alt="Captured" className="w-full rounded-lg mb-4" />
              )}
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">Your Location:</p>
                  <p className="text-sm text-gray-600 break-words">{location?.address || 'Getting location...'}</p>
                  {location && (
                    <p className="text-xs text-gray-500 mt-1">
                      Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {uploading && (
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Compressing & uploading...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
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
                Retake Photo
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
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h4 className="text-lg font-semibold mb-2">
              {isCheckIn ? 'Check In Successful!' : 'Check Out Successful!'}
            </h4>
            <p className="text-gray-600">
              {isCheckIn
                ? 'You have successfully checked in. Have a productive day!'
                : 'You have successfully checked out. See you tomorrow!'}
            </p>
          </div>
        )}
      </motion.div>
    </div>
  )
}
