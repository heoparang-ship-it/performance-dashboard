"use client";

import { useState, type ReactNode } from "react";

interface CollapsibleSectionProps {
  title: string;
  icon: string;
  defaultOpen?: boolean;
  children: ReactNode;
  onOpen?: () => void;
}

export default function CollapsibleSection({
  title,
  icon,
  defaultOpen = false,
  children,
  onOpen,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next && onOpen) onOpen();
  };

  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm">{icon}</span>
        <span className="flex-1 text-sm font-medium text-gray-700">{title}</span>
        <span className={`text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`}>
          {"\u25B6"}
        </span>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          {children}
        </div>
      )}
    </div>
  );
}
