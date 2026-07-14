'use client'

import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { createClient } from '@/lib/supabase/client'
import { ensureProfile } from '@/lib/supabase/profile'
import { useRouter } from 'next/navigation'

export default function Providers({ children }: { children: React.ReactNode }) {
  const { user, setUser, setIsLoading, logout } = useAuthStore()
  const supabase = createClient()
  const router = useRouter()
  const redirectingRef = useRef(false)

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user: authUser }, error } = await supabase.auth.getUser()

        if (authUser && !error) {
          try {
            const profile = await ensureProfile(supabase, authUser)
            setUser(profile)
          } catch (profileErr: any) {
            console.warn('Profile initialization skipped:', profileErr)
            setUser({
              id: authUser.id,
              email: authUser.email || '',
              full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
              role: authUser.user_metadata?.role || 'teknisi',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            } as any)
          }
        } else {
          // getUser gagal — coba getSession sebagai fallback
          try {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user) {
              const profile = await ensureProfile(supabase, session.user)
              setUser(profile)
            } else {
              setUser(null)
            }
          } catch {
            // Both getUser and getSession failed — keep current user if exists
            if (!user) setUser(null)
          }
        }
      } catch (err) {
        console.error('Unexpected error in getUser:', err)
        // Keep current user from zustand persist if already set
        if (!user) setUser(null)
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
          redirectingRef.current = false
          router.refresh()
        } else if (event === 'SIGNED_OUT') {
          // Verify session benar-benar hilang sebelum redirect
          try {
            const { data: { session: currentSession } } = await supabase.auth.getSession()
            if (currentSession?.user) {
              // Session masih ada — SIGNED_OUT kemungkinan false positive (token refresh)
              return
            }
          } catch {
            // getSession gagal — tetap proceed
          }
          // Cek apakah masih ada user di zustand store dari localStorage
          const stored = typeof window !== 'undefined' ? localStorage.getItem('auth-storage') : null
          if (stored) {
            try {
              const parsed = JSON.parse(stored)
              if (parsed?.state?.user && !redirectingRef.current) {
                // Ada stored user, skip redirect dulu — getUser() akan handle
                setUser(null)
                logout()
                return
              }
            } catch { /* ignore parse error */ }
          }
          setUser(null)
          logout()
          if (!redirectingRef.current) {
            redirectingRef.current = true
            router.push('/login')
          }
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Token berhasil di-refresh — update profile
          try {
            const profile = await ensureProfile(supabase, session.user)
            setUser(profile)
          } catch { /* ignore */ }
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, setUser, setIsLoading, logout, router])

  return <>{children}</>
}
