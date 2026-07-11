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

    // Process all files — skip sharp since client already compressed to JPEG
    const processedFiles: Array<{ buffer: Buffer; name: string }> = []
    const timestamp = Date.now()
    
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      
      if (sharp) {
        try {
          // Fast pass: just ensure JPEG format, keep high quality
          const processedBuffer = await sharp(buffer)
            .jpeg({ quality: 90 })
            .toBuffer()
          processedFiles.push({
            buffer: processedBuffer,
            name: `${type}/${timestamp}_${Math.random().toString(36).substring(2, 8)}.jpg`
          })
        } catch {
          // Fallback: use original
          processedFiles.push({
            buffer,
            name: `${type}/${timestamp}_${Math.random().toString(36).substring(2, 8)}.jpg`
          })
        }
      } else {
        processedFiles.push({
          buffer,
          name: `${type}/${timestamp}_${Math.random().toString(36).substring(2, 8)}.jpg`
        })
      }
    }

    // Map type ke channel
    const channelMap: Record<string, 'attendance' | 'service' | 'layanan' | 'inventory' | 'kaspin'> = {
      attendance: 'attendance',
      service: 'service',
      layanan: 'layanan',
      inventory: 'inventory',
      kaspin: 'kaspin',
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
    const telegramResults = await uploadMultipleToTelegram(
      processedFiles,
      fullCaption,
      channelType
    )
    
    const urls = telegramResults.map(r => r.url)
    const messageRefs = telegramResults.map(r => ({ chat_id: r.chat_id, message_id: r.message_id }))
    
    console.log(`✅ Upload to Telegram successful (${urls.length} files)`)
    
    return NextResponse.json({
      success: true,
      urls: urls,
      messages: messageRefs,
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