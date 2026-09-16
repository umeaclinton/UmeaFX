"use client";

import { useState, useRef, useEffect } from "react";
import { Info, X } from "lucide-react";

interface InfoTooltipProps {
  title?: string;
  content: string;
  className?: string;
}

export function InfoTooltip({ title, content, className = "" }: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative inline-flex items-center ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onMouseEnter={() => setIsOpen(true)}
        className="text-gray-400 hover:text-emerald-500 dark:text-slate-400 dark:hover:text-emerald-400 transition-colors p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 inline-flex items-center justify-center focus:outline-none"
        title="More Information"
        aria-label="More Information"
      >
        <span className="w-4 h-4 rounded-full border border-current text-[11px] font-bold font-serif leading-none flex items-center justify-center">
          i
        </span>
      </button>

      {isOpen && (
        <div
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 sm:w-72 p-3.5 rounded-2xl bg-white dark:bg-[#151515] border border-gray-200 dark:border-white/15 text-gray-800 dark:text-slate-200 text-xs shadow-2xl shadow-black/20 dark:shadow-black/60 animate-in fade-in zoom-in-95 duration-150"
          onMouseLeave={() => setIsOpen(false)}
        >
          {title && (
            <div className="font-bold text-gray-900 dark:text-white mb-1 flex items-center justify-between">
              <span>{title}</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <p className="text-[11px] leading-relaxed text-gray-600 dark:text-slate-300 font-normal">
            {content}
          </p>
          {/* Subtle pointer triangle */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[5px] border-4 border-transparent border-t-white dark:border-t-[#151515]" />
        </div>
      )}
    </div>
  );
}
