'use client'

import { ReactNode } from 'react'

interface NeoCardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export default function NeoCard({ children, className = '', onClick, hover = true, padding = 'md' }: NeoCardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6'
  }

  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-xl
        border border-slate-200
        ${paddingClasses[padding]}
        transition-all duration-200
        ${hover ? 'hover:shadow-md' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
