'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { createClient } from '@/lib/supabase/client'
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
          // First, check if profiles table exists and RLS is working
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle() // Use maybeSingle instead of single to avoid 406 error

          if (error) {
            console.error('Error fetching profile:', error)

            // If error is because RLS or missing table, try to create profile directly
            if (error.code === '42P17' || error.message.includes('infinite recursion')) {
              console.log('RLS recursion detected, trying direct insert...')

              // Try to insert profile directly
              const { data: newProfile, error: insertError } = await supabase
                .from('profiles')
                .upsert({
                  id: user.id,
                  email: user.email,
                  full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
                  role: 'customer'
                })
                .select()
                .maybeSingle()

              if (!insertError && newProfile) {
                setUser(newProfile)
              } else {
                // If still error, set user with basic info from auth
                console.warn('Using fallback profile data')
                setUser({
                  id: user.id,
                  email: user.email || '',
                  full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
                  role: 'customer',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                } as any)
              }
            } else if (error.code === 'PGRST116') {
              // Profile not found, create one
              const { data: newProfile, error: insertError } = await supabase
                .from('profiles')
                .insert({
                  id: user.id,
                  email: user.email,
                  full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
                  role: 'customer'
                })
                .select()
                .maybeSingle()

              if (!insertError && newProfile) {
                setUser(newProfile)
              } else {
                setUser(null)
              }
            } else {
              setUser(null)
            }
          } else if (profile) {
            setUser(profile)
          } else {
            // No profile found, create one
            const { data: newProfile, error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: user.id,
                email: user.email,
                full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
                role: 'customer'
              })
              .select()
              .maybeSingle()

            if (!insertError && newProfile) {
              setUser(newProfile)
            } else {
              setUser(null)
            }
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
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle()

          if (profile) {
            setUser(profile)
          } else {
            // Create profile if doesn't exist
            const { data: newProfile } = await supabase
              .from('profiles')
              .insert({
                id: session.user.id,
                email: session.user.email,
                full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
                role: 'customer'
              })
              .select()
              .maybeSingle()

            if (newProfile) setUser(newProfile)
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
