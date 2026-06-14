'use client'

import { ReactNode } from 'react'

interface NeoButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit' | 'reset'
}

const variants = {
  primary: 'bg-black text-white border-black',
  secondary: 'bg-white text-black border-black',
  danger: 'bg-red-600 text-white border-black',
  success: 'bg-lime-400 text-black border-black',
  warning: 'bg-yellow-400 text-black border-black',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-base',
  lg: 'px-8 py-4 text-lg',
}

export default function NeoButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  type = 'button'
}: NeoButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        relative font-bold text-center transition-all duration-100 cursor-pointer
        border-3 border-black shadow-[4px_4px_0px_0px_black]
        hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_black]
        active:translate-x-[4px] active:translate-y-[4px] active:shadow-[0px_0px_0px_0px_black]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0
        ${variants[variant]} ${sizes[size]} ${className}
      `}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Processing...
        </div>
      ) : children}
    </button>
  )
}
