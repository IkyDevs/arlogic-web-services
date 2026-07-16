"use client";

import { ShoppingCart, ClipboardList } from "lucide-react";

interface MobileBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  transactionTabId?: string;
  serviceTabId?: string;
}

export default function MobileBottomNav({
  activeTab,
  onTabChange,
  transactionTabId = "management-transaction",
  serviceTabId = "services",
}: MobileBottomNavProps) {
  const tabs = [
    { id: transactionTabId, label: "Transaksi", icon: ShoppingCart },
    { id: serviceTabId, label: "Service", icon: ClipboardList },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white dark:bg-[#111111] border-t border-gray-200 dark:border-white/10 safe-area-bottom">
      <div className="flex items-center justify-around h-14 px-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 w-full h-full rounded-lg transition-colors ${
                isActive
                  ? "text-gray-900 dark:text-white"
                  : "text-gray-400 dark:text-gray-500"
              }`}
            >
              <div
                className={`p-1.5 rounded-lg transition-colors ${
                  isActive
                    ? "bg-gray-100 dark:bg-white/10"
                    : ""
                }`}
              >
                <tab.icon className="w-5 h-5" />
              </div>
              <span
                className={`text-[10px] font-medium leading-none ${
                  isActive
                    ? "text-gray-900 dark:text-white"
                    : "text-gray-400 dark:text-gray-500"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
