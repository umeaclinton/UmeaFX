"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
      className="
        fixed bottom-6 right-6 z-50
        w-12 h-12 rounded-full
        flex items-center justify-center
        shadow-xl transition-all duration-300
        border
        bg-gray-900 border-gray-700 text-white hover:bg-gray-800
        dark:bg-white dark:border-gray-200 dark:text-gray-900 dark:hover:bg-gray-100
        hover:scale-110 active:scale-95
      "
    >
      {theme === "light" ? (
        <Moon className="w-5 h-5" />
      ) : (
        <Sun className="w-5 h-5 text-amber-500" />
      )}
    </button>
  );
}
