'use client'

import { ReactNode } from 'react'

interface ModernButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'outline' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit' | 'reset'
  icon?: ReactNode
}

const variants = {
  primary: 'bg-[#2D3E2F] text-white border-[#2D3E2F] hover:bg-[#8B7355] hover:border-[#8B7355]',
  outline: 'bg-transparent text-[#2D3E2F] border-[#2D3E2F] hover:bg-[#2D3E2F] hover:text-white',
  ghost: 'bg-transparent text-[#2D3E2F] border-transparent hover:bg-[#F0EDE8]',
  danger: 'bg-[#B55B5B] text-white border-[#B55B5B] hover:bg-[#9a4a4a]',
  success: 'bg-[#5A7D5C] text-white border-[#5A7D5C] hover:bg-[#4a6a4c]',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-5 py-2.5 text-base rounded-xl',
  lg: 'px-7 py-3.5 text-lg rounded-xl',
}

export default function ModernButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  icon
}: ModernButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        relative font-semibold text-center transition-all duration-200 cursor-pointer
        border-2
        ${variants[variant]} ${sizes[size]}
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none
        ${className}
      `}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading...
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2">
          {icon}
          {children}
        </div>
      )}
    </button>
  )
}
