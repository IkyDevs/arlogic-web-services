import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { r2Client } from '@/lib/cloudflare-r2'

// Hapus import sharp - kita akan skip kompresi di Vercel
// import sharp from 'sharp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30 // 30 detik timeout

export async function POST(request: NextRequest) {
  try {
    console.log('📤 Upload API called - Vercel Production')
    console.log('🔑 R2 Config:', {
      endpoint: process.env.R2_ENDPOINT ? '✅' : '❌',
      bucket: process.env.R2_BUCKET_NAME ? '✅' : '❌',
      accessKey: process.env.R2_ACCESS_KEY_ID ? '✅' : '❌',
    })

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

    // Convert to buffer
    const bytes = await file.arrayBuffer()
    let buffer = Buffer.from(bytes)

    // SKIP SHARP di Vercel - langsung upload original
    // Kompresi akan dilakukan di client side sebelum upload

    console.log(`📤 Uploading to R2: ${type}/${Date.now()}`)

    // Generate filename
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 8)
    const fileName = `${type}/${timestamp}_${randomString}.jpg`

    // Upload to Cloudflare R2
    const uploadParams = {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: file.type || 'image/jpeg',
      CacheControl: 'public, max-age=31536000',
    }

    await r2Client.send(new PutObjectCommand(uploadParams))
    console.log('✅ Upload to R2 successful')

    // Get public URL
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${fileName}`

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName: fileName,
    })

  } catch (error: any) {
    console.error('❌ Upload error:', error)

    // Error detail untuk debugging
    return NextResponse.json(
      {
        error: 'Upload failed',
        details: error.message || 'Unknown error',
        code: error.code || 'UNKNOWN',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// OPTIONS method untuk CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
