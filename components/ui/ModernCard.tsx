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
}

export default function ModernCard({
  children,
  className = '',
  onClick,
  hover = true,
  animate = true,
  delay = 0
}: ModernCardProps) {
  const Component = animate ? motion.div : 'div'

  const props = animate ? {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay }
  } : {}

  return (
    <Component
      {...props}
      onClick={onClick}
      className={`
        bg-white rounded-2xl p-5
        border border-[#E6E2DB]
        transition-all duration-200
        ${hover ? 'hover:shadow-[0_8px_24px_rgba(45,62,47,0.08)] hover:-translate-y-1 cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </Component>
  )
}
