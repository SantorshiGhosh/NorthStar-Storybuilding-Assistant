import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ className = '', showLabel = false }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`relative inline-flex items-center justify-center p-2 rounded-lg text-xs font-medium border transition-colors duration-350 ease-in-out cursor-pointer ${
        isDark
          ? 'bg-neutral-800 border-neutral-700 text-amber-400 hover:bg-neutral-750 hover:text-amber-300 hover:border-neutral-600 shadow-2xs'
          : 'bg-[#fbf9f4] border-[#1c1815]/15 text-[#1c1815]/70 hover:bg-white hover:text-[#7b2d3b] hover:border-[#7b2d3b]/30 shadow-2xs'
      } ${className}`}
    >
      <span className="sr-only">
        {isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      </span>

      <div className="relative w-4 h-4 flex items-center justify-center overflow-hidden">
        <Sun
          className={`w-4 h-4 transition-all duration-350 ease-in-out absolute ${
            isDark
              ? 'opacity-100 rotate-0 scale-100'
              : 'opacity-0 -rotate-90 scale-50 pointer-events-none'
          }`}
        />
        <Moon
          className={`w-4 h-4 transition-all duration-350 ease-in-out absolute ${
            isDark
              ? 'opacity-0 rotate-90 scale-50 pointer-events-none'
              : 'opacity-100 rotate-0 scale-100'
          }`}
        />
      </div>

      {showLabel && (
        <span className="ml-2 font-medium">
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </span>
      )}
    </button>
  );
}
