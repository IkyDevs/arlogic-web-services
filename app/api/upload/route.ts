import { NextRequest, NextResponse } from 'next/server'
import { uploadMultipleToTelegram } from '@/lib/telegram'

// Dynamically load sharp to avoid crashes on environments without native binaries (like Vercel)
let sharp: any = null
try {
  sharp = require('sharp')
} catch (e) {
  console.warn('⚠️ sharp module could not be loaded, server-side resizing disabled:', e)
}

export async function POST(request: NextRequest) {
  try {
    console.log('📤 Upload API called - Telegram Storage (Multiple Photos)')
    
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const type = formData.get('type') as string
    const caption = formData.get('caption') as string || ''
    const formDataJson = formData.get('formData') as string || '{}'
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 })
    }

    console.log(`📤 Files: ${files.length} files, Type: ${type}`)
    console.log(`📤 Form Data: ${formDataJson}`)

    // Parse form data
    const parsedFormData = JSON.parse(formDataJson)
    console.log('📤 Parsed form data:', parsedFormData)

    // Process each file: compress & resize
    const processedFiles: Array<{ buffer: Buffer; name: string }> = []
    
    for (const file of files) {
      console.log(`📤 Processing: ${file.name}, Size: ${file.size} bytes`)
      
      try {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        
        if (!sharp) {
          console.log(`⚠️ sharp is not available, using original file directly: ${file.name}`)
          processedFiles.push({
            buffer: buffer,
            name: `${type}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`
          })
          continue
        }
        
        // Get dimensions
        const metadata = await sharp(buffer).metadata()
        console.log(`📐 Original: ${metadata.width}x${metadata.height}`)
        
        // Resize to max 1280px for Telegram
        const maxDimension = 1280
        let width = metadata.width || 0
        let height = metadata.height || 0
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }
        
        console.log(`📐 Resized to: ${width}x${height}`)
        
        const processedBuffer = await sharp(buffer)
          .rotate()
          .flatten({ background: { r: 255, g: 255, b: 255 } })
          .resize(width, height, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer()
        
        console.log(`✅ Processed: ${buffer.length} → ${processedBuffer.length} bytes`)
        
        // Simpan file yang sudah diproses
        processedFiles.push({
          buffer: processedBuffer,
          name: `${type}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`
        })
        
      } catch (error) {
        console.error(`❌ Error processing ${file.name}:`, error)
        // Jika error, gunakan file asli
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        processedFiles.push({
          buffer: buffer,
          name: `${type}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`
        })
      }
    }

    // Map type ke channel
    const channelMap: Record<string, 'attendance' | 'service' | 'layanan' | 'inventory'> = {
      attendance: 'attendance',
      service: 'service',
      layanan: 'layanan',
      inventory: 'inventory',
    }
    const channelType = channelMap[type] || 'service'
    
    // Buat caption dengan informasi form
    const formDataEntries = Object.entries(parsedFormData)
      .filter(([key]) => key !== 'photos')
    
    const fullCaption = formDataEntries.length > 0
      ? `${caption}\n\n📋 Form Data:\n${formDataEntries.map(([key, value]) => `• ${key}: ${value}`).join('\n')}`
      : caption

    console.log(`📤 Uploading ${processedFiles.length} files to Telegram channel: ${channelType}`)

    // Upload multiple files ke Telegram (gabung dalam 1 request)
    const urls = await uploadMultipleToTelegram(
      processedFiles,
      fullCaption,
      channelType
    )
    
    console.log(`✅ Upload to Telegram successful (${urls.length} files)`)
    
    return NextResponse.json({
      success: true,
      urls: urls,
      count: urls.length,
      storage: 'telegram',
      channel: channelType,
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