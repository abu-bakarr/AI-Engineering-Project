"use client";

import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <Icon size={48} className="text-gray-300 mb-4" />
      <p className="text-[15px] font-medium text-gray-700 mb-1">{title}</p>
      <p className="text-[13px] text-gray-400 mb-5">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-4 py-2 text-sm transition-colors duration-150"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
