'use client'

import { motion } from 'framer-motion'
import { Watch, LogOut, X } from 'lucide-react'

interface QCSidebarProps {
  isOpen: boolean
  onClose: () => void
  menuItems: any[]
  activeTab: string
  onTabChange: (tabId: string) => void
  services: any[]
  user: any
  onLogout: () => void
}

export default function QCSidebar({
  isOpen,
  onClose,
  menuItems,
  activeTab,
  onTabChange,
  services,
  user,
  onLogout
}: QCSidebarProps) {
  return (
    <div className={`sidebar-container fixed left-0 top-0 h-full w-64 bg-white border-r border-[#E9ECEF] z-40 transform transition-transform duration-200 ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
      <div className="p-4 border-b border-[#E9ECEF]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-[#1A1A2E] to-[#0F3460] rounded-lg flex items-center justify-center">
              <Watch className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#1A1A2E]">Watch<span className="text-[#E94560]">Service</span></h1>
              <p className="text-[10px] text-gray-400">QC Panel</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3 p-2.5 bg-[#FAFAFA] rounded-lg">
          <div className="w-9 h-9 bg-[#E94560] rounded-full flex items-center justify-center text-white font-semibold text-sm">
            {user?.full_name?.charAt(0) || 'Q'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{user?.full_name}</p>
            <p className="text-xs text-gray-400 truncate">Quality Control</p>
          </div>
        </div>
      </div>

      <nav className="p-3 space-y-0.5">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full text-left px-3 py-2.5 font-medium text-sm flex items-center gap-3 rounded-lg transition-all ${
              activeTab === item.id
                ? 'bg-[#1A1A2E] text-white'
                : 'text-[#1A1A2E] hover:bg-gray-100'
            }`}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
            {item.id !== 'all' && (
              <span className="ml-auto text-xs bg-gray-200 px-2 py-0.5 rounded-full">
                {services.filter(s => s.teknisi_name === item.id).length}
              </span>
            )}
          </button>
        ))}

        <div className="pt-4 mt-4 border-t border-[#E9ECEF]">
          <button
            onClick={onLogout}
            className="w-full text-left px-3 py-2.5 font-medium text-sm flex items-center gap-3 rounded-lg text-[#E94560] hover:bg-red-50 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Keluar
          </button>
        </div>
      </nav>
    </div>
  )
}
