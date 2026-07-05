'use client'

import { motion } from 'framer-motion'
import { Watch, LogOut, X, LogIn, CheckCircle, LogOut as LogOutIcon } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'

interface QCSidebarProps {
  isOpen: boolean
  onClose: () => void
  menuItems: any[]
  activeTab: string
  onTabChange: (tabId: string) => void
  services: any[]
  user: any
  onLogout: () => void
  todayAttendance?: any
  onAttendance?: (type: 'check_in' | 'check_out') => void
}

export default function QCSidebar({
  isOpen,
  onClose,
  menuItems,
  activeTab,
  onTabChange,
  services,
  user,
  onLogout,
  todayAttendance,
  onAttendance
}: QCSidebarProps) {
  return (
    <aside
      className={`fixed top-0 left-0 h-full w-20 bg-white z-50 flex flex-col items-center py-4 sm:py-6 shadow-2xl lg:shadow-none lg:translate-x-0 lg:static lg:z-auto lg:h-auto lg:w-auto transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Logo */}
      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#4DB2FF] rounded-2xl flex items-center justify-center mb-6 sm:mb-8">
        <Watch className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col items-center gap-2 sm:gap-3 px-2 sm:px-3 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`sidebar-item w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all ${
              activeTab === item.id
                ? 'bg-[#FFD65A] text-black shadow-md'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
            title={item.label}
          >
            <item.icon className="w-5 h-5" />
          </button>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="flex flex-col items-center gap-2 sm:gap-3 px-2 sm:px-3">
        {/* Attendance */}
        {onAttendance && (
          <button
            onClick={() => onAttendance(
              todayAttendance && !todayAttendance.check_out
                ? 'check_out'
                : 'check_in'
            )}
            disabled={!!todayAttendance?.check_out}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all ${
              !todayAttendance
                ? 'bg-[#3CCF91] text-white hover:bg-[#2db87d]'
                : todayAttendance.check_out
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-[#FFD65A] text-black hover:bg-[#f5c94a]'
            }`}
            title={todayAttendance?.check_out ? 'Completed' : 'Attendance'}
          >
            {!todayAttendance ? (
              <LogIn className="w-5 h-5" />
            ) : todayAttendance.check_out ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <LogOutIcon className="w-5 h-5" />
            )}
          </button>
        )}

        {/* Theme Toggle */}
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all cursor-pointer">
          <ThemeToggle />
        </div>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
          title="Keluar"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </aside>
  )
}
