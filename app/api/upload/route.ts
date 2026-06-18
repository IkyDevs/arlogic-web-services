import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import sharp from 'sharp'

export async function POST(request: NextRequest) {
  try {
    console.log('📤 Upload API called')

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string

    if (!file) {
      console.log('❌ No file provided')
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    console.log(`📤 File: ${file.name}, Type: ${type}, Size: ${file.size} bytes`)

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Compress image
    let compressedBuffer: Buffer
    let contentType: string

    try {
      if (type === 'attendance') {
        compressedBuffer = await sharp(buffer)
          .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toBuffer()
      } else {
        compressedBuffer = await sharp(buffer)
          .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 75 })
          .toBuffer()
      }
      contentType = 'image/jpeg'
      console.log(`✅ Compressed: ${buffer.length} → ${compressedBuffer.length} bytes`)
    } catch (sharpError) {
      console.error('⚠️ Compression error, using original:', sharpError)
      compressedBuffer = buffer
      contentType = file.type || 'image/jpeg'
    }

    // Generate filename
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 8)
    const fileName = `${type}/${timestamp}_${randomString}.jpg`

    // Upload to Supabase
    const supabase = await createClient()
    const bucket = type === 'attendance' ? 'attendance-photos' : 'service-photos'

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, compressedBuffer, {
        contentType: contentType,
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('❌ Upload error:', uploadError)
      return NextResponse.json(
        { error: 'Upload to storage failed', details: uploadError.message },
        { status: 500 }
      )
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName)

    console.log('✅ Upload success:', fileName)

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      fileName: fileName,
      originalSize: buffer.length,
      compressedSize: compressedBuffer.length,
    })

  } catch (error: any) {
    console.error('❌ Upload API error:', error)
    return NextResponse.json(
      {
        error: 'Upload failed',
        details: error.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
