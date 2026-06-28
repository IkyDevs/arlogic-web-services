'use client'

import { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface ModernCardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  hover?: boolean
  animate?: boolean
  delay?: number
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export default function ModernCard({
  children,
  className = '',
  onClick,
  hover = true,
  animate = true,
  delay = 0,
  padding = 'md'
}: ModernCardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6'
  }

  const Component = animate ? motion.div : 'div'

  const props = animate ? {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay, ease: [0.25, 0.46, 0.45, 0.94] as const }
  } : {}

  return (
    <Component
      {...props}
      onClick={onClick}
      className={`
        bg-white rounded-xl
        border border-slate-200
        ${paddingClasses[padding]}
        transition-all duration-200
        ${hover ? 'hover:shadow-md hover:border-slate-300' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </Component>
  )
}
