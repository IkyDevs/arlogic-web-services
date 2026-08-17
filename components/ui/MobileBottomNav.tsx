"use client";

import { LayoutDashboard, ShoppingCart, ClipboardList } from "lucide-react";

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  homeTabId: string;
  homeLabel?: string;
  transactionTabId?: string;
  transactionLabel?: string;
  serviceTabId?: string;
  serviceLabel?: string;
}

export default function MobileBottomNav({
  activeTab,
  setActiveTab,
  homeTabId,
  homeLabel = "Home",
  transactionTabId = "management-transaction",
  transactionLabel = "Transaksi",
  serviceTabId = "services",
  serviceLabel = "Service",
}: MobileBottomNavProps) {
  const tabs = [
    { id: homeTabId, label: homeLabel, icon: LayoutDashboard, ariaLabel: "Dashboard utama" },
    { id: transactionTabId, label: transactionLabel, icon: ShoppingCart, ariaLabel: "Management transaksi" },
    { id: serviceTabId, label: serviceLabel, icon: ClipboardList, ariaLabel: "Service order" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-[var(--color-card)] border-t border-[var(--color-border)] safe-area-bottom" role="navigation" aria-label="Navigasi utama">
      <div className="flex items-center justify-around h-14 px-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-label={tab.ariaLabel}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 w-full h-full rounded-lg transition-colors ${
                isActive
                  ? "text-[var(--color-accent-teal)]"
                  : "text-[var(--color-text-tertiary)]"
              }`}
            >
              <div
                className={`p-1.5 rounded-lg transition-colors ${
                  isActive
                    ? "bg-[var(--color-accent-teal-soft)]"
                    : ""
                }`}
              >
                <tab.icon className="w-5 h-5" aria-hidden="true" />
              </div>
              <span
                className={`text-[10px] font-medium leading-none ${
                  isActive
                    ? "text-[var(--color-accent-teal)]"
                    : "text-[var(--color-text-tertiary)]"
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
