import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string // 'attendance' | 'service'

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files allowed' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    // Convert to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Compress with sharp
    let compressedBuffer: Buffer
    try {
      if (type === 'attendance') {
        compressedBuffer = await sharp(buffer)
          .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toBuffer()
      } else {
        compressedBuffer = await sharp(buffer)
          .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 75 })
          .toBuffer()
      }
    } catch {
      compressedBuffer = buffer
    }

    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const fileName = `${type || 'service'}/${timestamp}_${random}.jpg`

    // Try Cloudflare R2 first (if configured)
    const r2Configured =
      process.env.R2_ENDPOINT &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME &&
      process.env.R2_PUBLIC_URL

    if (r2Configured) {
      try {
        const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
        const s3 = new S3Client({
          region: 'auto',
          endpoint: process.env.R2_ENDPOINT,
          credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID!,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
          },
          forcePathStyle: true,
        })

        await s3.send(new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: fileName,
          Body: compressedBuffer,
          ContentType: 'image/jpeg',
          CacheControl: 'public, max-age=31536000',
        }))

        const url = `${process.env.R2_PUBLIC_URL}/${fileName}`
        return NextResponse.json({
          success: true,
          url,
          fileName,
          storage: 'r2',
          originalSize: buffer.length,
          compressedSize: compressedBuffer.length,
          compressionRatio: `${((buffer.length - compressedBuffer.length) / buffer.length * 100).toFixed(1)}%`,
        })
      } catch (r2Error: any) {
        console.warn('R2 upload failed, falling back to Supabase:', r2Error.message)
      }
    }

    // Fallback: Supabase Storage
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Ensure bucket exists
    const bucketName = type === 'attendance' ? 'attendance-photos' : 'service-photos'
    const { error: bucketError } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
    })
    // Ignore error if bucket already exists
    if (bucketError && !bucketError.message.includes('already exists')) {
      console.warn('Bucket creation warning:', bucketError.message)
    }

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, compressedBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '31536000',
        upsert: true,
      })

    if (uploadError) {
      console.error('Supabase upload error:', uploadError)
      return NextResponse.json({
        error: 'Upload failed',
        details: uploadError.message,
      }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName)

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName,
      storage: 'supabase',
      originalSize: buffer.length,
      compressedSize: compressedBuffer.length,
      compressionRatio: `${((buffer.length - compressedBuffer.length) / buffer.length * 100).toFixed(1)}%`,
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json({
      error: 'Upload failed',
      details: error.message,
    }, { status: 500 })
  }
}
