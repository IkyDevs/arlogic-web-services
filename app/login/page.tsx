'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { Watch, Sparkles, Clock, Shield, Users, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { setUser } = useAuthStore()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()

      if (!profile) {
        toast.error('Profile not found')
        return
      }

      setUser(profile)
      toast.success(`Welcome back!`)
      router.push(`/${profile.role}`)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      {/* Brutalist Decorative Elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 border-2 border-[#FF6B9D]" />
        <div className="absolute bottom-10 right-10 w-48 h-48 border-2 border-[#FFDE00]" />
        <div className="absolute top-1/3 left-1/4 w-24 h-24 border-2 border-[#3B82F6]" />
        <div className="absolute bottom-1/3 right-1/4 w-16 h-16 bg-[#FF6B9D] opacity-10" />
      </div>

      <div className="max-w-5xl w-full relative z-10">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Side - Branding */}
          <div className="space-y-6">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#FF6B9D] flex items-center justify-center border-2 border-black shadow-[4px_4px_0px_0px_black]">
                <Watch className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tighter">WATCH<span className="text-[#FF6B9D]">SERVICE</span></h1>
                <p className="text-xs font-mono">MANAGEMENT SYSTEM</p>
              </div>
            </div>

            {/* Hero Card */}
            <div className="border-2 border-black bg-white shadow-[8px_8px_0px_0px_black] p-8">
              <h2 className="text-5xl font-black tracking-tighter leading-tight mb-4">
                SERVICE
                <br />
                FOR YOUR
                <br />
                <span className="text-[#FF6B9D]">TIMEPIECE</span>
              </h2>
              <div className="w-16 h-1 bg-[#FFDE00] my-4" />
              <p className="text-gray-600 font-mono text-sm">
                Professional watch repair & service center.
                From classic mechanical to modern smartwatches.
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border-2 border-black bg-[#FF6B9D] p-4 shadow-[4px_4px_0px_0px_black]">
                <p className="text-2xl font-black text-white">50+</p>
                <p className="text-xs font-mono text-white">YEARS EXP.</p>
              </div>
              <div className="border-2 border-black bg-[#FFDE00] p-4 shadow-[4px_4px_0px_0px_black]">
                <p className="text-2xl font-black">10K+</p>
                <p className="text-xs font-mono">WATCHES</p>
              </div>
              <div className="border-2 border-black bg-[#3B82F6] p-4 shadow-[4px_4px_0px_0px_black]">
                <p className="text-2xl font-black text-white">100%</p>
                <p className="text-xs font-mono text-white">SATISFACTION</p>
              </div>
              <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_black]">
                <p className="text-2xl font-black">24/7</p>
                <p className="text-xs font-mono">SUPPORT</p>
              </div>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="border-2 border-black bg-white shadow-[8px_8px_0px_0px_black] p-6">
            <div className="text-center mb-6">
              <div className="inline-block bg-[#FF6B9D] text-white px-3 py-1 text-xs font-mono mb-3 border-2 border-black">
                SECURE ACCESS
              </div>
              <h3 className="text-2xl font-black">LOGIN</h3>
              <p className="text-sm font-mono text-gray-500">Sign in to your account</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase mb-1">EMAIL</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-white border-2 border-black font-mono text-sm focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px] transition-all"
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase mb-1">PASSWORD</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-white border-2 border-black font-mono text-sm focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px] transition-all"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#FFDE00] text-black font-black py-3 border-2 border-black shadow-[4px_4px_0px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_black] transition-all disabled:opacity-50"
              >
                {loading ? 'LOADING...' : '→ LOGIN →'}
              </button>
            </form>

            {/* Demo Credentials */}
            <div className="mt-6 p-4 bg-[#F5F5F5] border-2 border-black">
              <p className="text-xs font-black uppercase mb-2 flex items-center gap-2">
                <Sparkles className="w-3 h-3" />
                DEMO ACCESS
              </p>
              <div className="grid grid-cols-2 gap-1 text-xs font-mono">
                <div>admin@arlogic.com</div>
                <div>password</div>
                <div>iky@arlogic.com</div>
                <div>password</div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
