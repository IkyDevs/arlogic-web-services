import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@/lib/supabase/server'
import sharp from 'sharp'

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

    // Compress image
    let compressedBuffer: Buffer
    let contentType: string

    try {
      if (type === 'attendance') {
        compressedBuffer = await sharp(buffer)
          .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toBuffer()
        contentType = 'image/jpeg'
      } else {
        compressedBuffer = await sharp(buffer)
          .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 75 })
          .toBuffer()
        contentType = 'image/jpeg'
      }

      console.log('Compression complete. Original:', buffer.length, 'Compressed:', compressedBuffer.length)
    } catch (sharpError) {
      console.error('Sharp compression error:', sharpError)
      compressedBuffer = buffer
      contentType = file.type || 'image/jpeg'
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 8)
    const fileName = `${type}/${timestamp}_${randomString}.jpg`

    let publicUrl: string
    let storageUsed: string

    // Try R2 first
    try {
      const r2Endpoint = process.env.R2_ENDPOINT
      const r2AccessKey = process.env.R2_ACCESS_KEY_ID
      const r2SecretKey = process.env.R2_SECRET_ACCESS_KEY
      const r2Bucket = process.env.R2_BUCKET_NAME
      const r2PublicUrl = process.env.R2_PUBLIC_URL

      if (r2Endpoint && r2AccessKey && r2SecretKey && r2Bucket && r2PublicUrl) {
        const s3Client = new S3Client({
          region: 'auto',
          endpoint: r2Endpoint,
          credentials: {
            accessKeyId: r2AccessKey,
            secretAccessKey: r2SecretKey,
          },
          forcePathStyle: true,
        })

        const uploadParams = {
          Bucket: r2Bucket,
          Key: fileName,
          Body: compressedBuffer,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000',
        }

        await s3Client.send(new PutObjectCommand(uploadParams))
        publicUrl = `${r2PublicUrl}/${fileName}`
        storageUsed = 'cloudflare-r2'
        console.log('Uploaded to Cloudflare R2')
      } else {
        throw new Error('R2 configuration missing')
      }
    } catch (r2Error: any) {
      console.error('R2 upload failed, falling back to Supabase:', r2Error.message)

      // Fallback to Supabase Storage
      try {
        const supabase = await createClient()
        const bucket = type === 'attendance' ? 'attendance-photos' : 'service-photos'

        // Check if bucket exists, create if not
        const { data: buckets } = await supabase.storage.listBuckets()
        const bucketExists = buckets?.some(b => b.name === bucket)

        if (!bucketExists) {
          await supabase.storage.createBucket(bucket, { public: true })
        }

        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(fileName, compressedBuffer, {
            contentType,
            cacheControl: '3600',
          })

        if (error) throw error

        const { data: { publicUrl: supabaseUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(fileName)

        publicUrl = supabaseUrl
        storageUsed = 'supabase'
        console.log('Uploaded to Supabase Storage')
      } catch (supabaseError: any) {
        console.error('Both storage options failed:', supabaseError)
        return NextResponse.json({
          error: 'Storage upload failed',
          details: supabaseError.message
        }, { status: 500 })
      }
    }

    const originalSize = buffer.length
    const compressedSize = compressedBuffer.length
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1)

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName,
      storage: storageUsed,
      originalSize,
      compressedSize,
      compressionRatio: `${compressionRatio}%`,
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json({
      error: error.message || 'Upload failed',
      details: error.stack
    }, { status: 500 })
  }
}
