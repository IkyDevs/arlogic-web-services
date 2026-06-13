import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Profile } from '@/types'

interface AuthState {
  user: Profile | null
  setUser: (user: Profile | null) => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      isLoading: true,
      setIsLoading: (loading) => set({ isLoading: loading }),
      logout: () => set({ user: null }),
    }),
    {
      name: 'auth-storage',
    }
  )
)
