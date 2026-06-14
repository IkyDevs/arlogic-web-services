'use client'

import { ReactNode } from 'react'

interface NeoCardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  hover?: boolean
}

export default function NeoCard({ children, className = '', onClick, hover = true }: NeoCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-white border-3 border-black shadow-[6px_6px_0px_0px_black]
        p-5
        ${hover ? 'transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_black] cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
