import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

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
    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string // 'attendance' or 'service'

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    console.log('Processing file:', file.name, 'Type:', type, 'Size:', file.size)

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Compress image based on type
    let compressedBuffer: Buffer
    let contentType: string

    try {
      if (type === 'attendance') {
        // Attendance photo: compress more, keep face recognizable
        compressedBuffer = await sharp(buffer)
          .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toBuffer()
        contentType = 'image/jpeg'
      } else {
        // Service/Layanan photo: medium quality for documentation
        compressedBuffer = await sharp(buffer)
          .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 75 })
          .toBuffer()
        contentType = 'image/jpeg'
      }

      console.log('Compression complete. Original:', buffer.length, 'Compressed:', compressedBuffer.length)
    } catch (sharpError) {
      console.error('Sharp compression error:', sharpError)
      // Fallback: use original buffer if compression fails
      compressedBuffer = buffer
      contentType = file.type || 'image/jpeg'
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 8)
    const fileName = `${type}/${timestamp}_${randomString}.jpg`

    console.log('Uploading to R2:', fileName)

    // Upload to Cloudflare R2
    const uploadParams = {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: compressedBuffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000',
    }

    const command = new PutObjectCommand(uploadParams)
    const result = await s3Client.send(command)

    console.log('Upload successful:', result.$metadata)

    // Get public URL
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${fileName}`

    // Calculate compression ratio
    const originalSize = buffer.length
    const compressedSize = compressedBuffer.length
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1)

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName,
      originalSize,
      compressedSize,
      compressionRatio: `${compressionRatio}%`,
    })
  } catch (error: any) {
    console.error('Upload error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      metadata: error.$metadata
    })

    return NextResponse.json({
      error: 'Upload failed',
      details: error.message,
      code: error.code
    }, { status: 500 })
  }
}
