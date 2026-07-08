import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Verify caller is admin
    const supabase = await createClient()
    const { data: { user: callerUser } } = await supabase.auth.getUser()

    if (!callerUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single()

    if (callerProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Use service role client for admin operations
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Delete from auth.users first
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId)

    if (authError) {
      console.warn('Auth deletion warning:', authError.message)
    }

    // Delete related records first (foreign key constraints)
    const cleanups = [
      supabase.from('activity_logs').delete().eq('user_id', userId),
      supabase.from('notifications').delete().eq('user_id', userId),
      supabase.from('service_timeline').update({ teknisi_id: null }).eq('teknisi_id', userId),
      supabase.from('service_orders').update({ assigned_teknisi_id: null }).eq('assigned_teknisi_id', userId),
      supabase.from('service_documentation').update({ uploaded_by: null }).eq('uploaded_by', userId),
      supabase.from('attendances').delete().eq('teknisi_id', userId),
      supabase.from('feedbacks').delete().eq('teknisi_id', userId),
      supabase.from('layanan').update({ handled_by: null }).eq('handled_by', userId),
      supabase.from('layanan').update({ created_by: null }).eq('created_by', userId),
    ];

    await Promise.all(cleanups);

    // Delete from public.profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileError) {
      console.error('Error deleting profile:', profileError)
      return NextResponse.json({
        error: 'Failed to delete profile: ' + profileError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    })
  } catch (error: any) {
    console.error('Delete user error:', error)
    return NextResponse.json({
      error: 'Failed to delete user: ' + error.message
    }, { status: 500 })
  }
}
