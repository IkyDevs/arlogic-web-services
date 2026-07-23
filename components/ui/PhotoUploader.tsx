'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, Upload, X, Image, FileImage, AlertCircle,
  CheckCircle, Loader, RefreshCw, Grid, List, Clock,
  AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { usePhotoUpload, PhotoFile, PhotoUploadOptions, UploadType } from '@/hooks/usePhotoUpload'
import { uploadConfig } from '@/lib/uploadConfig'

interface PhotoUploaderProps {
  type: UploadType
  caption?: string
  maxFiles?: number
  onPhotosChange?: (photos: PhotoFile[]) => void
  onUploadComplete?: (results: PhotoFile[]) => void
  onError?: (error: string) => void
  existingUrls?: string[]
  onRemoveExisting?: (url: string) => void
  children?: (props: { openCamera: () => void; openGallery: () => void }) => React.ReactNode
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatSpeed(bytes: number, ms: number): string {
  if (ms <= 0) return ''
  const bps = (bytes / ms) * 1000
  if (bps > 1024 * 1024) return `${(bps / 1024 / 1024).toFixed(1)} MB/s`
  if (bps > 1024) return `${(bps / 1024).toFixed(1)} KB/s`
  return `${bps.toFixed(0)} B/s`
}

function formatETA(remainingBytes: number, speedBps: number): string {
  if (speedBps <= 0) return ''
  const seconds = remainingBytes / speedBps
  if (seconds < 60) return `${Math.ceil(seconds)}d`
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}j ${Math.ceil((seconds % 3600) / 60)}m`
}

const statusConfig: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  pending: { color: 'text-slate-500', bg: 'bg-slate-100', icon: Image, label: 'Menunggu' },
  ready: { color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle, label: 'Siap' },
  uploading: { color: 'text-indigo-600', bg: 'bg-indigo-50', icon: Loader, label: 'Upload...' },
  success: { color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle, label: 'Berhasil' },
  error: { color: 'text-red-600', bg: 'bg-red-50', icon: AlertCircle, label: 'Gagal' },
}

function PhotoThumbnail({ photo, onRemove, viewMode }: {
  photo: PhotoFile
  onRemove: (id: string) => void
  viewMode: 'grid' | 'list'
}) {
  const cfg = statusConfig[photo.status]
  const StatusIcon = cfg.icon

  if (viewMode === 'list') {
    return (
      <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-slate-200">
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
          {photo.preview ? (
            <img src={photo.preview} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FileImage className="w-5 h-5 text-slate-400" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-900 truncate">{photo.name}</p>
          <p className="text-[10px] text-slate-500">{formatSize(photo.size)}</p>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.bg} ${cfg.color}`}>
          {photo.status === 'uploading' ? (
            <Loader className="w-3 h-3 animate-spin" />
          ) : (
            <StatusIcon className="w-3 h-3" />
          )}
          <span>{cfg.label}</span>
          {photo.status === 'uploading' && photo.progress > 0 && (
            <span>{photo.progress}%</span>
          )}
        </div>
        <button
          onClick={() => onRemove(photo.id)}
          className="p-1 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
          disabled={photo.status === 'uploading'}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="relative group aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200"
    >
      {photo.preview ? (
        <img
          src={photo.preview}
          alt={photo.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <FileImage className="w-8 h-8 text-slate-300" />
        </div>
      )}

      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200" />

      <div className={`absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${cfg.bg} ${cfg.color} shadow-sm`}>
        {photo.status === 'uploading' ? (
          <Loader className="w-2.5 h-2.5 animate-spin" />
        ) : (
          <StatusIcon className="w-2.5 h-2.5" />
        )}
        <span>{cfg.label}</span>
        {photo.status === 'uploading' && photo.progress > 0 && (
          <span>{photo.progress}%</span>
        )}
      </div>

      {photo.status === 'error' && photo.error && (
        <div className="absolute bottom-6 left-1 right-1">
          <div className="px-1.5 py-0.5 bg-red-500/90 rounded text-[8px] text-white truncate">
            {photo.error}
          </div>
        </div>
      )}

      <button
        onClick={() => onRemove(photo.id)}
        className="absolute top-1.5 right-1.5 p-1 bg-white/90 hover:bg-red-500 hover:text-white rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-all"
        disabled={photo.status === 'uploading'}
      >
        <X className="w-3 h-3" />
      </button>

      <div className="absolute bottom-1 left-1 px-1 py-0.5 bg-black/50 rounded text-[8px] text-white opacity-0 group-hover:opacity-100 transition-all truncate max-w-[70%]">
        {photo.name}
      </div>
    </motion.div>
  )
}

export default function PhotoUploader({
  type,
  caption,
  maxFiles = uploadConfig.IMAGE_MAX_FILES,
  onPhotosChange,
  onUploadComplete,
  onError,
  existingUrls,
  onRemoveExisting,
  children,
}: PhotoUploaderProps) {
  const {
    photos,
    uploading,
    overallProgress,
    profiling,
    hasChanges,
    hasSuccess,
    hasError,
    addPhotos,
    uploadPhotos,
    removePhoto,
    cancel,
    reset,
    retryFailed,
  } = usePhotoUpload()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showExisting, setShowExisting] = useState(true)
  const uploadStartRef = useRef(0)
  const [speed, setSpeed] = useState('')
  const [eta, setEta] = useState('')
  const speedIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    onPhotosChange?.(photos)
  }, [photos, onPhotosChange])

  useEffect(() => {
    if (uploading && uploadStartRef.current > 0) {
      speedIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - uploadStartRef.current
        if (elapsed > 0) {
          const totalBytes = photos.reduce((s, p) => s + p.size, 0)
          const uploadedBytes = Math.round((overallProgress / 100) * totalBytes)
          const remainingBytes = totalBytes - uploadedBytes
          const speedStr = formatSpeed(uploadedBytes, elapsed)
          setSpeed(speedStr)
          const bps = (uploadedBytes / elapsed) * 1000
          setEta(formatETA(remainingBytes, bps))
        }
      }, 1000)
    } else {
      if (speedIntervalRef.current) clearInterval(speedIntervalRef.current)
      setSpeed('')
      setEta('')
    }
    return () => {
      if (speedIntervalRef.current) clearInterval(speedIntervalRef.current)
    }
  }, [uploading, overallProgress, photos])

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return
    const rawFiles = Array.from(files).filter(
      (f) => f.type.startsWith('image/') || /\.(heic|heif|avif)$/i.test(f.name),
    )
    if (!rawFiles.length) {
      toast.error('Tidak ada file gambar yang valid')
      return
    }
    await addPhotos(rawFiles, { type, maxFiles })
  }, [addPhotos, type, maxFiles])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
    if (e.target) e.target.value = ''
  }, [handleFiles])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleUploadAll = useCallback(async () => {
    const ready = photos.filter((p) => p.status === 'ready' || p.status === 'pending')
    if (!ready.length && !hasError) {
      toast.error('Tidak ada foto siap upload')
      return
    }
    const toUpload = hasError ? photos.filter((p) => p.status !== 'success') : ready
    uploadStartRef.current = Date.now()
    const results = await uploadPhotos(toUpload, { type, caption })
    if (results.length > 0) {
      onUploadComplete?.(results)
    }
  }, [photos, hasError, uploadPhotos, type, caption, onUploadComplete])

  const handleRemove = useCallback((id: string) => {
    removePhoto(id)
  }, [removePhoto])

  const totalReady = photos.filter((p) => p.status === 'ready' || p.status === 'pending').length
  const totalError = photos.filter((p) => p.status === 'error').length
  const hasExistingUrls = existingUrls && existingUrls.length > 0
  const totalUploaded = photos.filter((p) => p.status === 'success').length

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileInput}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={handleFileInput}
        className="hidden"
      />

      <div
        ref={dropRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative rounded-xl border-2 border-dashed transition-all ${
          dragOver
            ? 'border-blue-500 bg-blue-50'
            : photos.length > 0
              ? 'border-slate-200 bg-white'
              : 'border-slate-300 bg-slate-50 hover:border-slate-400'
        }`}
      >
        {children ? (
          children({
            openCamera: () => cameraInputRef.current?.click(),
            openGallery: () => fileInputRef.current?.click(),
          })
        ) : (
          <div className="p-4">
            {photos.length === 0 && !hasExistingUrls ? (
              <div
                className="text-center py-6 cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-100 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-700 mb-1">Upload Foto</p>
                <p className="text-xs text-slate-500 mb-4">
                  Drag & drop, pilih dari galeri, atau ambil langsung dari kamera
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2"
                  >
                    <Image className="w-4 h-4" /> Galeri
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click() }}
                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-all flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" /> Kamera
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-3">
                  Format: JPG, PNG, WebP, HEIC (max {uploadConfig.IMAGE_MAX_SIZE_MB}MB per file)
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {hasExistingUrls && showExisting && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-slate-500">
                        Foto Tersimpan ({existingUrls!.length})
                      </p>
                      <button
                        onClick={() => setShowExisting(false)}
                        className="text-[10px] text-blue-600 hover:text-blue-700"
                      >
                        Sembunyikan
                      </button>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {existingUrls!.map((url, i) => (
                        <div key={url} className="relative group aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                          <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                          {onRemoveExisting && (
                            <button
                              onClick={() => onRemoveExisting(url)}
                              className="absolute top-1 right-1 p-1 bg-white/90 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/50 to-transparent">
                            <p className="text-[8px] text-white font-medium">Foto {i + 1}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-slate-200 my-2" />
                  </div>
                )}
                {hasExistingUrls && !showExisting && (
                  <button
                    onClick={() => setShowExisting(true)}
                    className="text-xs text-blue-600 hover:text-blue-700 mb-2 block"
                  >
                    Tampilkan {existingUrls!.length} foto tersimpan
                  </button>
                )}

                {photos.length > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-slate-500">
                          {photos.length} file
                          {uploading && (
                            <span className="ml-1 text-indigo-600">
                              ({totalUploaded} berhasil)
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {formatSize(photos.reduce((s, p) => s + p.size, 0))}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setViewMode('grid')}
                          className={`p-1 rounded ${viewMode === 'grid' ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          <Grid className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setViewMode('list')}
                          className={`p-1 rounded ${viewMode === 'list' ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          <List className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <AnimatePresence mode="popLayout">
                      {viewMode === 'grid' ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                          {photos.map((photo) => (
                            <PhotoThumbnail
                              key={photo.id}
                              photo={photo}
                              onRemove={handleRemove}
                              viewMode="grid"
                            />
                          ))}
                          {!uploading && photos.length < maxFiles && (
                            <motion.button
                              layout
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              onClick={() => fileInputRef.current?.click()}
                              className="aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-slate-400 flex items-center justify-center transition-all hover:bg-slate-50"
                            >
                              <div className="text-center">
                                <Camera className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                                <p className="text-[9px] text-slate-500">Tambah</p>
                              </div>
                            </motion.button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {photos.map((photo) => (
                            <PhotoThumbnail
                              key={photo.id}
                              photo={photo}
                              onRemove={handleRemove}
                              viewMode="list"
                            />
                          ))}
                        </div>
                      )}
                    </AnimatePresence>
                  </>
                )}

                {photos.length > 0 && photos.length < maxFiles && !uploading && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2 border border-dashed border-slate-300 rounded-xl text-xs text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-all"
                  >
                    + Tambah foto lagi
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {uploading && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-600">
            <span className="flex items-center gap-1">
              <Loader className="w-3 h-3 animate-spin" />
              Mengupload {totalUploaded}/{photos.length}...
            </span>
            <span className="flex items-center gap-3">
              {speed && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{speed}</span>}
              {eta && <span className="text-slate-400">~{eta}</span>}
              <span>{overallProgress}%</span>
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Profiling (dev only) */}
      {profiling && uploadConfig.isDev && (
        <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-[9px] font-mono text-slate-400">
            Upload:{profiling.upload}ms · Telegram:{profiling.telegram}ms · Supabase:{profiling.supabase}ms · Total:{profiling.total}ms
          </p>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {!uploading && hasChanges && (
          <button
            onClick={handleUploadAll}
            disabled={totalReady === 0 && totalError === 0}
            className="flex-1 min-w-[120px] px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {totalError > 0
              ? `Upload Ulang (${totalError})`
              : totalReady > 0
                ? `Upload ${totalReady} Foto`
                : 'Upload'}
          </button>
        )}

        {uploading && (
          <button
            onClick={cancel}
            className="px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-all flex items-center gap-2"
          >
            <X className="w-4 h-4" /> Batal
          </button>
        )}

        {hasSuccess && !uploading && (
          <button
            onClick={reset}
            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Reset
          </button>
        )}

        {hasError && !uploading && (
          <button
            onClick={() => retryFailed({ type, caption })}
            className="px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-all flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" /> Retry Gagal
          </button>
        )}
      </div>
    </div>
  )
}
