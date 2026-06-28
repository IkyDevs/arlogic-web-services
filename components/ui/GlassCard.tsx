'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  delay?: number
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export default function GlassCard({ children, className = '', hover = true, delay = 0, padding = 'md' }: GlassCardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] as const }}
      whileHover={hover ? {
        y: -2,
        transition: { duration: 0.2 }
      } : {}}
      className={`
        bg-white/80 backdrop-blur-md
        rounded-xl border border-slate-200
        ${paddingClasses[padding]}
        transition-all duration-200
        ${hover ? 'hover:shadow-md' : ''}
        ${className}
      `}
    >
      {children}
    </motion.div>
  )
}
