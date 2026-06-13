import { NextResponse } from 'next/server'
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3'

export async function GET() {
  try {
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true,
    })

    const command = new ListBucketsCommand({})
    const response = await s3Client.send(command)

    return NextResponse.json({
      success: true,
      buckets: response.Buckets,
      endpoint: process.env.R2_ENDPOINT
    })
  } catch (error: any) {
    console.error('R2 test error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code,
      endpoint: process.env.R2_ENDPOINT
    }, { status: 500 })
  }
}
