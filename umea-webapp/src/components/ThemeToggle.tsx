"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className="
        flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all duration-200
        bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300
        dark:bg-[#111] dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5
      "
    >
      {theme === "light" ? (
        <>
          <Moon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Dark</span>
        </>
      ) : (
        <>
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Light</span>
        </>
      )}
    </button>
  );
}
