'use client'

import { useRef, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, Upload, X, Image, FileImage, AlertCircle,
  CheckCircle, Loader, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { PendingFile } from '@/lib/upload/upload-types'
import { uploadServiceConfig } from '@/lib/upload/upload-config'
import { formatSize } from '@/lib/upload/upload-utils'

interface CentralUploaderProps {
  onFilesChange?: (files: PendingFile[]) => void
  addFiles: (files: File[]) => Promise<{ files: PendingFile[]; errors: string[] }>
  removeFile: (id: string) => Promise<void>
  clear: () => Promise<void>
  pendingFiles: PendingFile[]
  maxFiles?: number
  disabled?: boolean
  existingUrls?: string[]
  onRemoveExisting?: (url: string) => void
  children?: (props: { openCamera: () => void; openGallery: () => void }) => React.ReactNode
}

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: 'text-slate-500', bg: 'bg-slate-100', label: 'Menunggu' },
  ready: { color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Siap' },
  error: { color: 'text-red-600', bg: 'bg-red-50', label: 'Gagal' },
}

export default function CentralUploader({
  onFilesChange,
  addFiles,
  removeFile,
  clear,
  pendingFiles,
  maxFiles = uploadServiceConfig.maxFiles,
  disabled = false,
  existingUrls,
  onRemoveExisting,
  children,
}: CentralUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return
    const rawFiles = Array.from(files).filter(
      (f) => f.type.startsWith('image/') || /\.(heic|heif|avif)$/i.test(f.name),
    )
    if (!rawFiles.length) {
      toast.error('Tidak ada file gambar yang valid')
      return
    }
    const result = await addFiles(rawFiles)
    if (result.errors.length > 0) {
      result.errors.forEach(e => toast.error(e))
    }
    if (result.files.length > 0) {
      toast.success(`${result.files.length} foto ditambahkan`)
    }
  }, [addFiles])

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

  const handleRemove = useCallback(async (id: string) => {
    await removeFile(id)
    onFilesChange?.(pendingFiles.filter(f => f.id !== id))
  }, [removeFile, pendingFiles, onFilesChange])

  const handleClear = useCallback(async () => {
    await clear()
    onFilesChange?.([])
  }, [clear, onFilesChange])

  const totalSize = pendingFiles.reduce((s, f) => s + f.size, 0)
  const hasExistingUrls = existingUrls && existingUrls.length > 0

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
            : pendingFiles.length > 0
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
            {pendingFiles.length === 0 && !hasExistingUrls ? (
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
                  Format: JPG, PNG, WebP, HEIC (max {uploadServiceConfig.maxSizeMB}MB per file)
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {hasExistingUrls && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2">
                      Foto Tersimpan ({existingUrls!.length})
                    </p>
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
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-slate-200 my-2" />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-slate-500">
                      {pendingFiles.length} file ({formatSize(totalSize)})
                    </p>
                  </div>
                  {pendingFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="text-[10px] text-red-500 hover:text-red-600"
                    >
                      Hapus semua
                    </button>
                  )}
                </div>

                <AnimatePresence mode="popLayout">
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {pendingFiles.map((photo) => {
                      const cfg = statusConfig[photo.status] || statusConfig.ready
                      return (
                        <motion.div
                          key={photo.id}
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

                          <div className={`absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${cfg.bg} ${cfg.color} shadow-sm`}>
                            {photo.status === 'ready' ? (
                              <CheckCircle className="w-2.5 h-2.5" />
                            ) : (
                              <AlertCircle className="w-2.5 h-2.5" />
                            )}
                            <span>{cfg.label}</span>
                          </div>

                          {photo.status === 'error' && photo.error && (
                            <div className="absolute bottom-6 left-1 right-1">
                              <div className="px-1.5 py-0.5 bg-red-500/90 rounded text-[8px] text-white truncate">
                                {photo.error}
                              </div>
                            </div>
                          )}

                          {!disabled && (
                            <button
                              onClick={() => handleRemove(photo.id)}
                              className="absolute top-1.5 right-1.5 p-1 bg-white/90 hover:bg-red-500 hover:text-white rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}

                          <div className="absolute bottom-1 left-1 px-1 py-0.5 bg-black/50 rounded text-[8px] text-white opacity-0 group-hover:opacity-100 transition-all truncate max-w-[70%]">
                            {photo.name}
                          </div>
                        </motion.div>
                      )
                    })}
                    {!disabled && pendingFiles.length < maxFiles && (
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
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
