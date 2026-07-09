'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { createClient } from '@/lib/supabase/client'
import { ensureProfile } from '@/lib/supabase/profile'
import { useRouter } from 'next/navigation'

export default function Providers({ children }: { children: React.ReactNode }) {
  const { setUser, setIsLoading, logout } = useAuthStore()
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          try {
            const profile = await ensureProfile(supabase, user)
            setUser(profile)
          } catch (error: any) {
            console.warn('Profile initialization skipped:', error)
            setUser({
              id: user.id,
              email: user.email || '',
              full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
              role: user.user_metadata?.role || 'teknisi',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            } as any)
          }
        } else {
          setUser(null)
        }
      } catch (err) {
        console.error('Unexpected error in getUser:', err)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          try {
            const profile = await ensureProfile(supabase, session.user)
            setUser(profile)
          } catch (error) {
            console.warn('Profile initialization skipped on sign in:', error)
          }
          router.refresh()
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          logout()
          router.push('/login')
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, setUser, setIsLoading, logout, router])

  return <>{children}</>
}
