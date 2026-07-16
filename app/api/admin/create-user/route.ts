import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateOrigin } from '@/lib/csrf'
import { rateLimitIP } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // CSRF & rate limit checks
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const rl = rateLimitIP(request)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { email, password, full_name, role, gender } = await request.json()

    // Validate inputs
    if (!email || !password || !full_name || !role) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    const validRoles = ['admin', 'teknisi', 'supervisor', 'owner', 'customer']
    const validGenders = ['male', 'female', 'other']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }
    const normalizedGender = typeof gender === 'string' ? gender.toLowerCase() : 'other'
    if (!validGenders.includes(normalizedGender)) {
      return NextResponse.json(
        { error: 'Invalid gender' },
        { status: 400 }
      )
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

    // Create auth user with admin API (no email confirmation needed)
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create auth user' }, { status: 500 })
    }

    // Create/update profile
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email,
        full_name,
        role,
        gender: normalizedGender,
      })

    if (profileError) {
      await adminClient.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: 'Failed to create user profile: ' + profileError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      user: { id: authData.user.id, email, full_name, role }
    })
  } catch (err: any) {
    console.error('Create user error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
