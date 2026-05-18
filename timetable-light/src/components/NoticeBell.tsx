"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { noticeApi } from "@/lib/api";
import { usePathname } from "next/navigation";

interface NoticeBellProps {
  href: string;
  role: "ADMIN" | "TEACHER" | "STUDENT";
}

export default function NoticeBell({ href, role }: NoticeBellProps) {
  const [count, setCount] = useState(0);
  const [archivedCount, setArchivedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const notices = await noticeApi.list();
        // Count notices from last 24 hours for the pulse
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const newNotices = notices.filter(n => new Date(n.createdAt) > oneDayAgo);
        setCount(newNotices.length);

        if (role !== "STUDENT") {
          const archived = notices.filter(n => n.isArchived);
          setArchivedCount(archived.length);
        }
      } catch (err) {
        console.error("Failed to fetch notice counts", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();
    // Refresh every minute
    const interval = setInterval(fetchCounts, 60000);
    return () => clearInterval(interval);
  }, [role, pathname]);

  const hasAlert = role !== "STUDENT" && archivedCount > 0;

  return (
    <Link 
      href={href}
      className={`p-2 text-on-surface-variant hover:text-secondary transition-all hover:translate-y-[-1px] relative group ${pathname === href ? "text-secondary" : ""}`}
    >
      <span className="material-symbols-outlined">
        {hasAlert ? "notification_important" : "notifications"}
      </span>
      
      {(count > 0 || hasAlert) && (
        <span className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-surface animate-pulse ${hasAlert ? "bg-error" : "bg-secondary"}`}></span>
      )}

      {/* Tooltip */}
      <div className="absolute top-full right-0 mt-2 px-3 py-2 bg-on-surface text-surface text-[9px] font-black uppercase tracking-widest rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-xl pointer-events-none whitespace-nowrap z-50 border border-outline-variant/10">
        <div className="flex flex-col gap-1">
          {count > 0 && <span>{count} New Announcements</span>}
          {hasAlert && <span className="text-error-container">⚠️ {archivedCount} Post(s) need moderation</span>}
          {count === 0 && !hasAlert && <span>No new notices</span>}
        </div>
      </div>
    </Link>
  );
}
