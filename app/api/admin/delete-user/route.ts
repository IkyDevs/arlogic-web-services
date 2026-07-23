import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { deleteUserSchema } from '@/lib/validation/schemas'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = deleteUserSchema.parse(body)

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

    const adminClient = getSupabaseAdmin()

    const { error: authError } = await adminClient.auth.admin.deleteUser(parsed.userId)

    if (authError) {
      console.warn('Auth deletion warning:', authError.message)
    }

    const cleanups = [
      supabase.from('activity_logs').delete().eq('user_id', parsed.userId),
      supabase.from('notifications').delete().eq('user_id', parsed.userId),
      supabase.from('service_timeline').update({ teknisi_id: null }).eq('teknisi_id', parsed.userId),
      supabase.from('service_orders').update({ assigned_teknisi_id: null }).eq('assigned_teknisi_id', parsed.userId),
      supabase.from('service_documentation').update({ uploaded_by: null }).eq('uploaded_by', parsed.userId),
      supabase.from('attendances').delete().eq('teknisi_id', parsed.userId),
      supabase.from('feedbacks').delete().eq('teknisi_id', parsed.userId),
      supabase.from('layanan').update({ handled_by: null }).eq('handled_by', parsed.userId),
      supabase.from('layanan').update({ created_by: null }).eq('created_by', parsed.userId),
    ];

    await Promise.all(cleanups);

    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', parsed.userId)

    if (profileError) {
      console.error('Error deleting profile:', profileError)
      return NextResponse.json({ error: 'Failed to delete profile: ' + profileError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'User deleted successfully' })
  } catch (error: any) {
    console.error('[Delete User Error]', error)
    return NextResponse.json({ error: 'Failed to delete user: ' + error.message }, { status: 500 })
  }
}
