"use client";

import React from "react";

interface DeveloperBadgeProps {
  name: string;
  moduleName: string;
  avatarInitials: string;
}

export default function DeveloperBadge({ name, moduleName, avatarInitials }: DeveloperBadgeProps) {
  return (
    <div className="inline-flex items-center gap-3 px-3 py-1.5 rounded-2xl bg-surface-container-high/40 border border-outline-variant/15 text-xs font-bold text-on-surface-variant hover:text-secondary hover:border-secondary/40 hover:bg-surface-container-high/60 transition-all duration-300 shadow-sm select-none group cursor-pointer animate-in fade-in zoom-in duration-700">
      {/* Dev Avatar Icon */}
      <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-[10px] font-black text-white shadow-inner group-hover:scale-110 transition-transform duration-300 shrink-0">
        {avatarInitials}
        <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-surface-container-high animate-pulse" />
      </div>
      <div className="flex flex-col text-left">
        <span className="text-[9px] font-black tracking-widest text-on-surface-variant/60 uppercase leading-none mb-0.5">
          {moduleName} Module
        </span>
        <span className="text-[11px] font-black text-on-surface group-hover:text-secondary transition-colors leading-none">
          Developed by {name}
        </span>
      </div>
      <span className="material-symbols-outlined text-[14px] text-on-surface-variant/40 group-hover:text-secondary group-hover:translate-x-0.5 transition-all duration-300 shrink-0">
        arrow_forward
      </span>
    </div>
  );
}
