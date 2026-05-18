"use client";

import { useEffect, useState } from "react";
import { noticeApi } from "@/lib/api";
import { Notice } from "@/lib/types";
import NoticeList from "@/components/NoticeList";
import NoticeForm from "@/components/NoticeForm";
import { toast } from "sonner";

export default function StudentNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();

  const fetchNotices = async () => {
    try {
      const [noticesData, meData] = await Promise.all([
        noticeApi.list(),
        fetch("/api/auth/me").then(r => r.json())
      ]);
      setNotices(noticesData);
      setCurrentUserId(meData.user?.id);
    } catch (err) {
      console.error("Failed to fetch data", err);
      toast.error("Failed to load notices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const handleCreateNotice = async (data: any) => {
    setIsPosting(true);
    try {
      await noticeApi.create(data);
      toast.success("Notice posted! Remember, other students can report it.");
      setShowForm(false);
      fetchNotices();
    } catch (err) {
      console.error("Failed to post notice", err);
      toast.error("Failed to post notice");
    } finally {
      setIsPosting(false);
    }
  };

  const handleReportNotice = async (id: string) => {
    if (!confirm("Are you sure you want to report this notice? Excessive reports will hide it.")) return;
    try {
      await noticeApi.report(id);
      toast.success("Notice reported");
      fetchNotices();
    } catch (err) {
      console.error("Failed to report notice", err);
      toast.error("Failed to report notice");
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-10 px-6">
      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-on-surface uppercase leading-tight">
            Student Feed // <span className="text-secondary">Notices</span>
          </h1>
          <p className="text-sm font-semibold uppercase tracking-widest text-on-surface-variant/60 mt-1">
            Community-moderated announcements
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold uppercase tracking-wider text-xs transition-all duration-300 ${
            showForm 
              ? "bg-surface-container-high text-on-surface" 
              : "bg-secondary text-on-secondary shadow-lg shadow-secondary/20 hover:scale-[1.02]"
          }`}
        >
          <span className="material-symbols-outlined text-sm">
            {showForm ? "close" : "add_box"}
          </span>
          {showForm ? "Cancel" : "Post Announcement"}
        </button>
      </header>

      {showForm && (
        <div className="mb-12 bg-surface-container-low rounded-[2rem] p-8 border border-outline-variant/10 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500">
          <NoticeForm onPost={handleCreateNotice} isPosting={isPosting} role="STUDENT" />
          <div className="mt-6 p-4 bg-error/5 rounded-2xl border border-error/10 flex items-center gap-3">
            <span className="material-symbols-outlined text-error">info</span>
            <p className="text-[10px] font-bold uppercase tracking-widest text-error/70">
              Community Guidelines: Notices with 5+ reports are automatically archived and hidden from students.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 animate-pulse">
          <div className="h-12 w-12 border-4 border-secondary/10 border-t-secondary rounded-full animate-spin mb-4"></div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">
            Scanning for updates...
          </p>
        </div>
      ) : (
        <NoticeList 
          notices={notices} 
          onReport={handleReportNotice}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}
