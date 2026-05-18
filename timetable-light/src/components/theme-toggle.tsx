"use client";

import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant hover:text-secondary group"
      title="Toggle dark mode"
    >
      <span className="material-symbols-outlined text-[20px] transition-transform duration-300 group-hover:rotate-12">
        {theme === "dark" ? "light_mode" : "dark_mode"}
      </span>
    </button>
  );
}
