'use client'

import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { createClient } from '@/lib/supabase/client'
import { ensureProfile } from '@/lib/supabase/profile'
import { useRouter } from 'next/navigation'
import { BranchProvider } from '@/lib/context/BranchContext'
// asd
export default function Providers({ children }: { children: React.ReactNode }) {
  const { user, setUser, setIsLoading, logout } = useAuthStore()
  const supabase = createClient()
  const router = useRouter()
  const redirectingRef = useRef(false)

  useEffect(() => {
    let cancelled = false;

    const applyProfile = async (authUser: any): Promise<void> => {
      try {
        const profile = await ensureProfile(supabase, authUser);
        if (!cancelled) setUser(profile);
      } catch (profileErr) {
        console.warn('Profile initialization skipped:', profileErr);
        if (!cancelled) {
          setUser({
            id: authUser.id,
            email: authUser.email || '',
            full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
            role: authUser.user_metadata?.role || 'teknisi',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          } as any)
        }
      }
    };

    const verifySession = async () => {
      try {
        const { data: { user: authUser }, error } = await supabase.auth.getUser();
        if (authUser && !error) {
          await applyProfile(authUser);
        } else if (error) {
          // Token benar-benar salah/kadaluarsa — bersihkan, tapi jangan reset kalau cuma error sesaat
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user && !cancelled) {
            setUser(null);
            logout();
            if (!redirectingRef.current) {
              redirectingRef.current = true;
              router.push('/login');
            }
          }
        }
      } catch {
        // Network blip — biarkan user dari fast path
      }
    };

    const fastPath = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Baca session dari storage (instant, tanpa network) — dashboard render segera
          await applyProfile(session.user);
        } else {
          await verifySession();
        }
      } catch {
        await verifySession();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fastPath();

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

  return <BranchProvider>{children}</BranchProvider>
}
