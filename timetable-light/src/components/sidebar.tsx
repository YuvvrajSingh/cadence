"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { authApi } from "@/lib/api";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/master-data", label: "Master Data", icon: "database" },
  { href: "/timetablecharge/assignments", label: "Assignments", icon: "assignment" },
  { href: "/timetablecharge/timetable-builder", label: "Timetable Builder", icon: "calendar_add_on" },
  { href: "/timetablecharge/timetable-views", label: "Timetable Views", icon: "calendar_view_day" },
  { href: "/dashboard/teacher-accounts", label: "Teacher Accounts", icon: "manage_accounts" },
  { href: "/notices", label: "Notices", icon: "notifications" },
];


export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [sessionRole, setSessionRole] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSessionInfo() {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setSessionRole(data?.user?.sessionRole || data?.user?.role || null);
          setUserEmail(data?.user?.email || null);
        }
      } catch (err) {
        console.error("Failed to fetch session info", err);
      }
    }
    fetchSessionInfo();
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await authApi.logout();
    } catch {
      // Still leave the app shell; cookie may already be cleared.
    }
    router.replace("/login");
    router.refresh();
  }

  const filteredNavItems = navItems.filter((item) => {
    if (sessionRole === "TIMETABLE_INCHARGE") {
      return ["/dashboard", "/timetablecharge/assignments", "/timetablecharge/timetable-builder", "/timetablecharge/timetable-views"].includes(item.href);
    }
    return true; // Admin sees everything
  });

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 overflow-y-auto bg-surface-container flex flex-col py-6 px-4 z-50 border-r border-outline-variant/5">
      {/* Logo */}
      <div className="mb-10 px-2">
        <h1 className="text-lg font-black tracking-[0.1em] uppercase text-on-surface">
          CADENCE // PORTAL
        </h1>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant mt-1">
          Conflict-Aware Scheduler
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {filteredNavItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 transition-colors duration-200 ${
                isActive
                  ? "text-secondary font-bold border-r-4 border-secondary bg-surface-container-high rounded-l-lg"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg"
              }`}
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              <span className="text-sm tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Developer Credit */}
      <div className="mt-auto mb-4 px-3 py-2 bg-primary/5 rounded-xl border border-outline-variant/10 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant leading-none">
          Developed By: <span className="text-primary">Yuvraj Singh</span>
        </div>
      </div>

      {/* User Card */}
      <div className="pt-6 border-t border-outline-variant/10">
        <div className="flex items-center gap-3 px-3 py-2 mb-4">
          <span className="material-symbols-outlined text-2xl text-on-surface-variant">account_circle</span>
          <div className="overflow-hidden">
            <p className="text-xs font-bold text-on-surface truncate">
              {sessionRole === "TIMETABLE_INCHARGE" ? "Timetable Incharge" : "Administrator"}
            </p>
            <p className="text-[10px] text-on-surface-variant truncate uppercase tracking-widest">
              {userEmail || "Department Staff"}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-surface-container-high/50 hover:bg-error/10 hover:text-error text-on-surface-variant rounded-lg transition-all duration-200 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          disabled={loggingOut}
          onClick={handleLogout}
        >
          <span className="material-symbols-outlined text-sm">logout</span>
          {loggingOut ? "Signing out…" : "Logout"}
        </button>
      </div>
    </aside>
  );
}
