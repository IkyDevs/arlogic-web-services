import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import sharp from 'sharp'

export async function POST(request: NextRequest) {
  console.log('🚀 Upload API called')

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string

    console.log('📁 File:', file?.name, file?.size)

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Compress image - dengan fallback jika sharp gagal
    let compressedBuffer: Buffer
    try {
      // Konfigurasi sharp untuk Vercel
      compressedBuffer = await sharp(buffer, {
        // Limit memory usage
        limitInputPixels: 268402689, // 16384 x 16384
      })
        .resize(1024, 1024, {
          fit: 'inside',
          withoutEnlargement: true,
          // Use faster options
          kernel: 'nearest'
        })
        .jpeg({
          quality: 75,
          // Faster compression
          progressive: false,
          optimizeScans: false,
          force: true
        })
        .toBuffer()

      console.log('✅ Compression complete:', compressedBuffer.length)
    } catch (sharpError) {
      console.error('❌ Sharp error, using original:', sharpError)
      compressedBuffer = buffer
    }

    // Generate filename
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 8)
    const fileName = `${type}/${timestamp}_${randomString}.jpg`

    // Upload to Supabase Storage
    const supabase = await createClient()
    const bucket = type === 'attendance' ? 'attendance-photos' : 'service-photos'

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, compressedBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      console.error('❌ Upload error:', error)
      return NextResponse.json({
        error: 'Storage upload failed',
        details: error.message
      }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName)

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName,
    })
  } catch (error: any) {
    console.error('❌ Error:', error)
    return NextResponse.json({
      error: 'Upload failed',
      details: error.message
    }, { status: 500 })
  }
}
