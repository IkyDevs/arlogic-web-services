import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

// Konfigurasi Cloudflare R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
})

export async function POST(request: NextRequest) {
  try {
    console.log('📤 Upload API called - Cloudflare R2')

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    console.log(`📤 File: ${file.name}, Type: ${type}, Size: ${file.size} bytes`)

    // Convert to buffer
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

    // Generate unique filename
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 8)
    const fileName = `${type}/${timestamp}_${randomString}.jpg`

    console.log(`📤 Uploading to R2: ${fileName}`)

    // Upload to Cloudflare R2
    const uploadParams = {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: compressedBuffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000',
    }

    await s3Client.send(new PutObjectCommand(uploadParams))
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
    return NextResponse.json(
      {
        error: 'Upload failed',
        details: error.message,
        code: error.code
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
