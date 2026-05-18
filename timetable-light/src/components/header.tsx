"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { useAcademicYear } from "@/contexts/academic-year-context";
import NoticeBell from "./NoticeBell";

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/master-data": "Master Data Warehouse",
  "/assignments": "Assignments // CADENCE",
  "/timetable-builder": "CADENCE TIMETABLE",
  "/timetable-views": "Timetable Views",
  "/settings": "Department Settings",
};

export default function Header() {
  const pathname = usePathname();
  const title = routeTitles[pathname ?? ""] ?? "CADENCE // PORTAL";

  const {
    academicYears,
    selectedYear,
    isArchived,
    setSelectedYear,
    loading,
  } = useAcademicYear();

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-surface/70 backdrop-blur-xl flex items-center justify-between px-8 h-16 shadow-sm border-b border-outline-variant/10">
        <div className="flex items-baseline gap-4">
          <h2 className="text-xl font-bold tracking-tighter text-on-surface">{title}</h2>
          <div className="flex gap-2">
            <span className="px-2 py-0.5 bg-primary-container text-on-primary-container text-[10px] font-bold uppercase rounded">
              CSE
            </span>
            <span className="px-2 py-0.5 bg-secondary-fixed text-on-secondary-fixed-variant text-[10px] font-bold uppercase rounded">
              HOD
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Academic Year Selector */}
          {!loading && (
            <div className="relative group">
              <button className="flex items-center gap-2 px-4 py-2 bg-surface-container-low rounded-lg text-sm font-bold text-on-surface hover:bg-surface-container-high transition-colors">
                <span className="material-symbols-outlined text-sm text-secondary">calendar_month</span>
                <span className="tracking-tight">{selectedYear?.label ?? "No Year"}</span>
                {selectedYear?.status === "DRAFT" && (
                  <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-500 text-[9px] font-bold uppercase rounded tracking-wider">
                    Draft
                  </span>
                )}
                {selectedYear?.status === "ARCHIVED" && (
                  <span className="px-1.5 py-0.5 bg-surface-container-high text-on-surface-variant text-[9px] font-bold uppercase rounded tracking-wider">
                    Archived
                  </span>
                )}
                {selectedYear?.isActive && (
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
                )}
                <span className="material-symbols-outlined text-sm text-on-surface-variant">expand_more</span>
              </button>

              {/* Dropdown */}
              <div className="absolute right-0 top-full mt-1 w-56 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 overflow-hidden">
                {academicYears.map((year) => (
                  <button
                    key={year.id}
                    onClick={() => setSelectedYear(year)}
                    className={`w-full flex items-center gap-2 px-4 py-3 text-sm text-left hover:bg-surface-container-low transition-colors border-b border-outline-variant/5 last:border-b-0 ${
                      selectedYear?.id === year.id ? "bg-secondary-fixed/30 font-bold" : ""
                    }`}
                  >
                    <span className="flex-1 font-semibold text-on-surface">{year.label}</span>
                    {year.isActive && (
                      <span className="px-1.5 py-0.5 bg-green-500/10 text-green-500 text-[9px] font-bold uppercase rounded">
                        Active
                      </span>
                    )}
                    {year.status === "DRAFT" && (
                      <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-500 text-[9px] font-bold uppercase rounded">
                        Draft
                      </span>
                    )}
                    {year.status === "ARCHIVED" && (
                      <span className="px-1.5 py-0.5 bg-surface-container-high text-on-surface-variant text-[9px] font-bold uppercase rounded">
                        Archived
                      </span>
                    )}
                  </button>
                ))}
                {academicYears.length === 0 && (
                  <div className="px-4 py-6 text-xs text-on-surface-variant text-center">
                    No academic years found.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <NoticeBell 
              href={
                selectedYear?.status === "ARCHIVED" 
                  ? "#" 
                  : "/notices"
              }
              role="ADMIN"
            />
            <Link href="/settings" className="p-2 text-on-surface-variant hover:text-secondary transition-all hover:translate-y-[-1px]">
              <span className="material-symbols-outlined">settings</span>
            </Link>
            <div className="h-8 w-8 rounded-full bg-surface-container-highest overflow-hidden border border-outline-variant/20 ml-2 flex items-center justify-center text-xs font-bold text-on-surface-variant">
              HD
            </div>
          </div>
        </div>
      </header>

      {/* Archived Year Banner */}
      {isArchived && (
        <div className="sticky top-16 z-30 w-full border-b border-red-300/40 bg-red-50 py-2 px-8 flex items-center justify-center gap-3">
          <span className="material-symbols-outlined text-sm text-error">warning</span>
          <span className="text-xs font-bold text-error uppercase tracking-wider">
            Archived Year — Read Only Mode
          </span>
          <span className="material-symbols-outlined text-sm text-error">warning</span>
        </div>
      )}
    </>
  );
}
