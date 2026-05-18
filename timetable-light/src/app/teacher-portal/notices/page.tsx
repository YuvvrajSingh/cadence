"use client";

import { useEffect, useState } from "react";
import { noticeApi } from "@/lib/api";
import { Notice } from "@/lib/types";
import NoticeList from "@/components/NoticeList";
import NoticeForm from "@/components/NoticeForm";
import { toast } from "sonner";

export default function TeacherNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const fetchNotices = async () => {
    try {
      const data = await noticeApi.list();
      setNotices(data);
    } catch (err) {
      console.error("Failed to fetch notices", err);
      toast.error("Failed to load notices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const handleCreateNotice = async (data: { title: string; content: string; target: "ALL" | "TEACHERS" | "STUDENTS"; tags: string[] }) => {
    setIsPosting(true);
    try {
      await noticeApi.create(data);
      toast.success("Notice posted successfully");
      setShowForm(false);
      fetchNotices();
    } catch (err) {
      console.error("Failed to post notice", err);
      toast.error("Failed to post notice");
    } finally {
      setIsPosting(false);
    }
  };

  const handleRestoreNotice = async (id: string) => {
    try {
      await noticeApi.restore(id);
      toast.success("Notice restored and protected");
      fetchNotices();
    } catch (err) {
      console.error("Failed to restore notice", err);
      toast.error("Failed to restore notice");
    }
  };

  const handleDeleteNotice = async (id: string) => {
    if (!confirm("Are you sure you want to delete this archived notice?")) return;
    try {
      await noticeApi.delete(id);
      toast.success("Notice deleted permanently");
      setNotices(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error("Failed to delete notice", err);
      toast.error("Failed to delete notice");
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-10 px-6">
      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-on-surface uppercase">
            Departmental Notices
          </h1>
          <p className="text-sm font-semibold uppercase tracking-widest text-on-surface-variant/60 mt-1">
            Stay updated or share announcements
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold uppercase tracking-wider text-xs transition-all duration-300 ${
            showForm 
              ? "bg-surface-container-high text-on-surface hover:bg-surface-container-highest" 
              : "bg-secondary text-on-secondary hover:bg-secondary/90 shadow-lg shadow-secondary/20"
          }`}
        >
          <span className="material-symbols-outlined text-sm">
            {showForm ? "close" : "add_circle"}
          </span>
          {showForm ? "Cancel" : "Post New Notice"}
        </button>
      </header>

      {showForm && (
        <div className="mb-12 bg-surface-container-low rounded-[2rem] p-8 border border-outline-variant/10 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500">
          <NoticeForm onPost={handleCreateNotice} isPosting={isPosting} role="TEACHER" />
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 animate-pulse">
          <div className="h-12 w-12 border-4 border-secondary/10 border-t-secondary rounded-full animate-spin mb-4"></div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">
            Fetching announcements...
          </p>
        </div>
      ) : (
        <NoticeList 
          notices={notices} 
          onRestore={handleRestoreNotice}
          onDelete={handleDeleteNotice}
          isTeacher={true}
        />
      )}
    </div>
  );
}
