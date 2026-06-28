'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { motion } from 'framer-motion'
import {
  Watch, Mail, Lock, ArrowRight,
  Shield, Clock, Users, Star,
  CheckCircle, Sparkles
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState<'email' | 'password' | null>(null)
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
      toast.success(`Welcome back, ${profile.full_name}!`)
      router.push(`/${profile.role}`)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-600/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-slate-900/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl w-full relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* ==================== LEFT SIDE - BRANDING ==================== */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center">
                <Watch className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  Watch<span className="text-blue-600">Service</span>
                </h1>
                <p className="text-xs text-slate-400 font-medium">Management System</p>
              </div>
            </div>

            {/* Hero Text */}
            <div className="space-y-4">
              <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 leading-tight">
                Professional Watch
                <br />
                <span className="text-blue-600">Service Management</span>
              </h2>
              <p className="text-slate-500 text-lg leading-relaxed max-w-md">
                Complete solution for watch service centers.
                Manage repairs, track progress, and delight your customers.
              </p>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                <div className="w-8 h-8 bg-blue-600/10 rounded-lg flex items-center justify-center">
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-sm text-slate-900">Real-time</p>
                  <p className="text-xs text-slate-400">Tracking</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                <div className="w-8 h-8 bg-slate-900/10 rounded-lg flex items-center justify-center">
                  <Shield className="w-4 h-4 text-slate-900" />
                </div>
                <div>
                  <p className="font-medium text-sm text-slate-900">Secure &</p>
                  <p className="text-xs text-slate-400">Reliable</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <p className="font-medium text-sm text-slate-900">Multi-role</p>
                  <p className="text-xs text-slate-400">Support</p>
                </div>
              </div>
            </div>

            {/* Trust Indicators */}
            <div className="flex items-center gap-6 pt-4 border-t border-slate-200">
<span className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      <span className="text-sm font-medium text-slate-900">4.8/5 Rating</span>
                    </span>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-slate-900">99.9% Uptime</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-slate-900">1000+ Users</span>
              </div>
            </div>
          </motion.div>

          {/* ==================== RIGHT SIDE - LOGIN FORM ==================== */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-8">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="inline-block px-3 py-1 bg-blue-600/10 rounded-full mb-3">
                  <span className="text-xs font-medium text-blue-600">SECURE LOGIN</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Welcome Back</h3>
                <p className="text-sm text-slate-500 mt-1">Sign in to your account to continue</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                {/* Email Field */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <div className={`relative transition-all ${focused === 'email' ? 'ring-2 ring-blue-600/20' : ''}`}>
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocused('email')}
                      onBlur={() => setFocused(null)}
                      required
                      className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 transition-all text-sm"
                      placeholder="admin@example.com"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <div className={`relative transition-all ${focused === 'password' ? 'ring-2 ring-blue-600/20' : ''}`}>
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocused('password')}
                      onBlur={() => setFocused(null)}
                      required
                      className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 transition-all text-sm"
                       placeholder="•••••••••"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-slate-900 text-white font-medium py-3 rounded-lg hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              

              {/* Footer */}
              <div className="mt-6 text-center">
                <p className="text-xs text-slate-400">
                  By signing in, you agree to our Terms of Service
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
