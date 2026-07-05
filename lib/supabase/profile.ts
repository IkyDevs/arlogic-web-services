type AuthUserLike = {
  id: string
  email?: string | null
  user_metadata?: Record<string, any>
}

function buildFallbackProfile(authUser: AuthUserLike) {
  const allowedRoles = ['admin', 'teknisi', 'supervisor', 'owner', 'customer'] as const
  const roleFromMeta = authUser.user_metadata?.role
  const role = typeof roleFromMeta === 'string' && allowedRoles.includes(roleFromMeta as any)
    ? roleFromMeta
    : 'customer'

  return {
    id: authUser.id,
    email: authUser.email ?? '',
    full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
    role,
    phone: authUser.user_metadata?.phone || null,
    avatar_url: authUser.user_metadata?.avatar_url || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export async function ensureProfile(supabase: any, authUser: AuthUserLike) {
  const fallbackProfile = buildFallbackProfile(authUser)

  try {
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle()

    if (fetchError) {
      console.warn('Profile lookup failed, using fallback profile:', fetchError)
    } else if (existingProfile) {
      return existingProfile
    }

    const profileData = {
      id: authUser.id,
      email: authUser.email ?? '',
      full_name: fallbackProfile.full_name,
      role: fallbackProfile.role,
      phone: fallbackProfile.phone,
      avatar_url: fallbackProfile.avatar_url,
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' })
      .select('*')
      .maybeSingle()

    if (error) {
      console.warn('Profile upsert failed, using fallback profile:', error)
      return fallbackProfile
    }

    return data ?? fallbackProfile
  } catch (error) {
    console.warn('Unexpected profile ensure error, using fallback profile:', error)
    return fallbackProfile
  }
}
