"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { authApi, teacherMeApi } from "@/lib/api";
import type { Teacher } from "@/lib/types";
import { AcademicYearProvider } from "@/contexts/academic-year-context";
import { ThemeToggle } from "@/components/theme-toggle";
import NoticeBell from "@/components/NoticeBell";

const teacherNavItems = [
  { href: "/teacher-portal/timetable", label: "My Timetable", icon: "calendar_view_day", exact: false },
  { href: "/teacher-portal/midterms", label: "Midterms", icon: "grading", exact: true },
  { href: "/teacher-portal/midterms/results", label: "Results", icon: "leaderboard", exact: true },
  { href: "/teacher-portal/midterms/objections", label: "Objections", icon: "flag", exact: false },
  { href: "/teacher-portal/midterms/batch", label: "Batch Grading", icon: "table_rows", exact: false },
  { href: "/teacher-portal/notices", label: "Notices", icon: "notifications", exact: false },
];

export default function TeacherPortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [checking, setChecking] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        // Verify session exists and is a teacher account
        const meRes = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store",
        });
        if (!meRes.ok) {
          if (active) { router.replace("/login"); router.refresh(); }
          return;
        }
        const meBody = await meRes.json();
        // If somehow an admin lands here, redirect them to the admin dashboard
        if (meBody.user?.role === "ADMIN") {
          if (active) { router.replace("/dashboard"); }
          return;
        }

        // Fetch the teacher's own profile
        const t = await teacherMeApi.get();
        if (active) {
          setTeacher(t);
          setChecking(false);
        }
      } catch {
        if (active) { router.replace("/login"); router.refresh(); }
      }
    }

    init();
    return () => { active = false; };
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);
    try { await authApi.logout(); } catch { /* session may already be gone */ }
    router.replace("/login");
    router.refresh();
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-on-surface-variant opacity-70">
          Validating session...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="h-16 bg-surface-container-lowest border-b border-outline-variant/10 flex items-center px-4 lg:px-6 gap-3 lg:gap-6 fixed top-0 left-0 right-0 z-50">
        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="lg:hidden p-2 text-on-surface-variant hover:bg-surface-container rounded-lg"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>

        {/* Branding */}
        <div className="flex items-center gap-3 mr-auto lg:mr-6">
          <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-sm text-white">school</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-black tracking-[0.12em] uppercase text-on-surface leading-none">
              CADENCE // PORTAL
            </p>
            <div className="flex items-center gap-2 mt-0.5 leading-none">
              <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">
                Faculty Portal
              </p>
              <span className="text-[8px] font-black uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                By Nakshatara Kataria
              </span>
            </div>
          </div>
        </div>

        {/* Navigation tabs (Desktop) */}
        <nav className="hidden lg:flex gap-1 overflow-x-auto no-scrollbar">
          {teacherNavItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-surface-container text-secondary"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50"
                }`}
              >
                <span className="material-symbols-outlined text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: user info + logout */}
        <div className="flex items-center gap-2 lg:gap-4 ml-0 lg:ml-auto">
          <ThemeToggle />
          <NoticeBell href="/teacher-portal/notices" role="TEACHER" />
          <div className="text-right hidden md:block">
            <p className="text-xs font-bold text-on-surface leading-none truncate max-w-[120px]">{teacher?.name}</p>
            <p className="text-[10px] text-on-surface-variant mt-0.5 leading-none truncate max-w-[120px]">
              {teacher?.abbreviation} · Faculty
            </p>
          </div>
          <span className="material-symbols-outlined text-2xl text-on-surface-variant hidden sm:block">
            account_circle
          </span>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:text-error hover:bg-error/5 rounded-lg transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            <span className="hidden lg:inline">{loggingOut ? "..." : "Logout"}</span>
          </button>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      <div 
        className={`fixed inset-0 bg-black/50 z-[60] transition-opacity duration-300 lg:hidden ${isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* Mobile Drawer */}
      <div 
        className={`fixed top-0 left-0 bottom-0 w-[280px] bg-surface-container-lowest z-[70] shadow-2xl transition-transform duration-300 lg:hidden flex flex-col ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="p-6 border-b border-outline-variant/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-sm text-white">school</span>
            </div>
            <p className="text-sm font-black tracking-widest text-on-surface">TEACHER PORTAL</p>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {teacherNavItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-all ${
                  isActive
                    ? "bg-secondary text-white shadow-lg shadow-secondary/20"
                    : "text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-outline-variant/10 bg-surface-container-low">
          {/* Developer Credit */}
          <div className="mb-4 px-3 py-2 bg-primary/5 rounded-xl border border-outline-variant/10 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <div className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant leading-none">
              Developed By: <span className="text-primary">Nakshatara Kataria</span>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center">
              <span className="material-symbols-outlined text-on-surface-variant">person</span>
            </div>
            <div>
              <p className="text-xs font-bold text-on-surface">{teacher?.name}</p>
              <p className="text-[10px] text-on-surface-variant">{teacher?.abbreviation} · Administrator</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-error/10 text-error rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-error hover:text-white transition-all"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            {loggingOut ? "Signing out..." : "Logout"}
          </button>
        </div>
      </div>

      {/* Page content */}
      <main className="flex-1 pt-16">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          <AcademicYearProvider storageKey="teacher-selected-year-id" forceActive={true}>
            {children}
          </AcademicYearProvider>
        </div>
      </main>
    </div>
  );
}
