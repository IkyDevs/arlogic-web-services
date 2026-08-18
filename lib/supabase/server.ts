import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 hari — cegah logout tiap browser ditutup

export const createClient = async () => {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              const isAuthCookie = name.includes('-auth-token')
              cookieStore.set(
                name,
                value,
                isAuthCookie ? { ...options, maxAge: AUTH_COOKIE_MAX_AGE } : options,
              )
            })
          } catch {
            // Handle error
          }
        },
      },
    },
  )
}
