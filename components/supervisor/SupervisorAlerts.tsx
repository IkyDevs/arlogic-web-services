"use client";

import { AlertTriangle, Info, XCircle } from "lucide-react";

export interface SupervisorAlert {
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
}

const SEVERITY_STYLE: Record<
  SupervisorAlert["severity"],
  { box: string; icon: string; Icon: typeof Info }
> = {
  info: {
    box: "bg-blue-50 border-blue-100 dark:bg-blue-900/15 dark:border-blue-800/40",
    icon: "text-blue-600 dark:text-blue-400",
    Icon: Info,
  },
  warning: {
    box: "bg-amber-50 border-amber-100 dark:bg-amber-900/15 dark:border-amber-800/40",
    icon: "text-amber-600 dark:text-amber-400",
    Icon: AlertTriangle,
  },
  critical: {
    box: "bg-red-50 border-red-100 dark:bg-red-900/15 dark:border-red-800/40",
    icon: "text-red-600 dark:text-red-400",
    Icon: XCircle,
  },
};

export default function SupervisorAlerts({ alerts }: { alerts: SupervisorAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((a, i) => {
        const { box, icon, Icon } = SEVERITY_STYLE[a.severity];
        return (
          <div
            key={i}
            className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 ${box}`}
          >
            <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${icon}`} aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {a.title}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {a.detail}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}