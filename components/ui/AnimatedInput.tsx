'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface AnimatedInputProps {
  label: string
  type?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  required?: boolean
  placeholder?: string
  icon?: React.ReactNode
  error?: string
}

export default function AnimatedInput({
  label,
  type = 'text',
  value,
  onChange,
  required,
  placeholder,
  icon,
  error
}: AnimatedInputProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div className="relative">
      <motion.div
        className={`relative rounded-xl transition-all duration-200 ${
          isFocused ? 'ring-2 ring-blue-500/20 shadow-lg' : ''
        } ${error ? 'ring-2 ring-red-500/20' : ''}`}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
      >
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              {icon}
            </div>
          )}
          <input
            type={type}
            value={value}
            onChange={onChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            required={required}
            placeholder={placeholder}
            className={`
              w-full px-4 py-3 bg-white/50 border rounded-xl
              transition-all duration-200 outline-none
              ${icon ? 'pl-10' : 'pl-4'}
              ${error ? 'border-red-500' : isFocused ? 'border-blue-500' : 'border-slate-200'}
              hover:border-slate-300 focus:bg-white
            `}
          />
          <AnimatePresence>
            {value && !isFocused && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute -top-2.5 left-3 px-1 bg-white text-xs font-medium text-slate-500"
              >
                {label}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-xs text-red-500 mt-1 ml-1"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
