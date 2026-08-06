/**
 * Reconciliation Cron Job for Photo Uploads
 * 
 * Purpose:
 * - Find transactions stuck in 'pending' photo upload status for > 30 minutes
 * - Mark them as 'failed' so users can see retry button
 * - Prevents infinite "pending" state if browser closes during upload
 * 
 * Schedule:
 * - Run every 15-30 minutes via Vercel Cron or similar
 * - Example: run every 15 minutes (cron expression: setiap kelipatan 15 menit)
 * 
 * Environment:
 * - CRON_SECRET: Secret token for validating cron requests (prevent unauthorized calls)
 * 
 * Triggers:
 * - Via HTTP GET request with Authorization header
 * - Via scheduled task (Vercel Cron, AWS EventBridge, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

const PENDING_TIMEOUT_MINUTES = 30
const CRON_SECRET = process.env.CRON_SECRET

function log(...args: any[]) {
  console.log('[Reconcile-Upload-Cron]', ...args)
}

function err(...args: any[]) {
  console.error('[Reconcile-Upload-Cron]', ...args)
}

/**
 * GET handler - triggered by Vercel Cron or external scheduler
 * 
 * Authorization:
 * - Vercel Cron: Uses X-Vercel-Cron header (no auth needed if on Vercel)
 * - External: Requires ?secret=<CRON_SECRET> or Authorization header
 */
export async function GET(request: NextRequest) {
  const tStart = performance.now()

  try {
    // ── Authorization Check ──────────────────────────────────────────────
    // Vercel automatically adds x-vercel-cron header for scheduled crons
    const isVercelCron = request.headers.get('x-vercel-cron') === '1'
    
    // Or check for secret in query params (for external cron services)
    const secretParam = new URL(request.url).searchParams.get('secret')
    const authHeader = request.headers.get('authorization')

    const authorized =
      isVercelCron || 
      secretParam === CRON_SECRET || 
      authHeader === `Bearer ${CRON_SECRET}`

    if (!authorized) {
      err('UNAUTHORIZED: Invalid cron secret or missing Vercel header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    log('Starting reconciliation...')

    const supabase = await createServerClient()

    // ── Find stuck uploads ───────────────────────────────────────────────
    // Transactions stuck in 'pending' for > 30 minutes
    const cutoffTime = new Date(
      Date.now() - PENDING_TIMEOUT_MINUTES * 60 * 1000,
    ).toISOString()

    log(`Looking for uploads pending since before: ${cutoffTime}`)

    // Foto upload memakai dua kolom status berbeda per form: PengeluaranForm => photo_status,
    // LayananForm => upload_status. Keduanya harus di-reconcile agar tidak ada yang menggantung.
    const { data: stuckUploads, error: queryError } = await supabase
      .from('layanan')
      .select('id, customer_name, photo_status, upload_status, created_at')
      .or(`upload_status.in.(PENDING,UPLOADING),photo_status.eq.pending`)
      .lt('created_at', cutoffTime)

    if (queryError) {
      throw new Error(`Failed to query stuck uploads: ${queryError.message}`)
    }

    const count = stuckUploads?.length ?? 0
    log(`Found ${count} stuck uploads`)

    if (!count) {
      return NextResponse.json({
        success: true,
        reconciled: 0,
        duration_ms: Math.round(performance.now() - tStart),
        message: 'No stuck uploads found',
      })
    }

    // ── Mark as failed ───────────────────────────────────────────────────
    // Update kedua kolom status agar konsisten di semua UI (LayananList baca upload_status,
    // dashboard lain baca photo_status).
    const stuckIds = (stuckUploads ?? []).map((row: any) => row.id)

    const { error: updateError, count: updatedCount } = await supabase
      .from('layanan')
      .update({ photo_status: 'failed', upload_status: 'FAILED' })
      .in('id', stuckIds)

    if (updateError) {
      throw new Error(`Failed to update stuck uploads: ${updateError.message}`)
    }

    log(`Successfully marked ${updatedCount} uploads as failed`)

    // Log the reconciliation event
    for (const upload of stuckUploads ?? []) {
      log(
        `Reconciled: ${upload.id} (${upload.customer_name}), pending since ${upload.created_at}`,
      )
    }

    const duration = Math.round(performance.now() - tStart)

    return NextResponse.json({
      success: true,
      reconciled: updatedCount,
      stuck_uploads: stuckIds,
      timeout_minutes: PENDING_TIMEOUT_MINUTES,
      duration_ms: duration,
      message: `Reconciled ${updatedCount} stuck uploads`,
    })
  } catch (error: any) {
    err(`FAILED: ${error.message}`)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Reconciliation failed',
        duration_ms: Math.round(performance.now() - tStart),
      },
      { status: 500 },
    )
  }
}

/**
 * POST handler - for manual triggering (optional)
 * Can be called manually for testing or one-off reconciliation
 */
export async function POST(request: NextRequest) {
  try {
    // Validate authorization
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Just delegate to GET handler
    return GET(request)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Manual reconciliation failed' },
      { status: 500 },
    )
  }
}
