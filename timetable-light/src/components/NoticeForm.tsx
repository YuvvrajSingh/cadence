"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { noticeApi } from "@/lib/api";

interface NoticeFormProps {
  onPost: (data: { 
    title: string; 
    content: string; 
    target: "ALL" | "TEACHERS" | "STUDENTS"; 
    tags: string[];
    showAuthor?: boolean;
    externalLink?: string;
    attachments?: { url: string; type: string; name: string }[];
  }) => Promise<void>;
  isPosting: boolean;
  role: "ADMIN" | "TEACHER" | "STUDENT";
}

const PREDEFINED_TAGS = ["Academic", "Event", "Urgent", "Holiday", "Exam", "Placement", "General"];

export default function NoticeForm({ onPost, isPosting, role }: NoticeFormProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [target, setTarget] = useState<"ALL" | "TEACHERS" | "STUDENTS">("ALL");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showAuthor, setShowAuthor] = useState(true);
  const [externalLink, setExternalLink] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;
    
    if (selectedTags.length === 0) {
      toast.error("Please select at least one tag for the notice.");
      return;
    }

    try {
      let attachments: { url: string; type: string; name: string }[] = [];
      
      if (selectedFiles.length > 0) {
        setIsUploading(true);
        const uploadRes = await noticeApi.upload(selectedFiles);
        attachments = uploadRes.attachments;
      }

      await onPost({ 
        title, 
        content, 
        target, 
        tags: selectedTags,
        showAuthor: role === "TEACHER" ? showAuthor : true,
        externalLink: externalLink.trim() || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      
      setTitle("");
      setContent("");
      setTarget("ALL");
      setSelectedTags([]);
      setShowAuthor(true);
      setExternalLink("");
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error("Notice creation failed", err);
      toast.error("Failed to post notice");
    } finally {
      setIsUploading(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (files.length > 5) {
        toast.error("You can upload maximum 5 files.");
        return;
      }
      setSelectedFiles(files);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/70 ml-1">
            Notice Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Semester Registration"
            className="w-full bg-surface-container-high border-none rounded-2xl px-5 py-4 text-on-surface placeholder:text-on-surface-variant/30 focus:ring-2 focus:ring-secondary/50 transition-all font-medium"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/70 ml-1">
            Target Audience
          </label>
          <div className="flex gap-2 p-1 bg-surface-container-high rounded-2xl">
            {(["ALL", "TEACHERS", "STUDENTS"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTarget(t)}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 ${
                  target === t 
                    ? "bg-secondary text-on-secondary shadow-md" 
                    : "text-on-surface-variant/60 hover:text-on-surface hover:bg-surface-container-highest"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/70 ml-1 flex justify-between">
          <span>Select Tags (Compulsory)</span>
          <span className="text-[8px] opacity-60">*Choose at least one</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {PREDEFINED_TAGS.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                selectedTags.includes(tag)
                  ? "bg-secondary text-white border-secondary shadow-lg shadow-secondary/20"
                  : "bg-surface-container-high text-on-surface-variant/60 border-outline-variant/10 hover:border-secondary/30"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/70 ml-1">
          Content
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Detailed announcement content..."
          rows={4}
          className="w-full bg-surface-container-high border-none rounded-2xl px-5 py-4 text-on-surface placeholder:text-on-surface-variant/30 focus:ring-2 focus:ring-secondary/50 transition-all font-medium resize-none"
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/70 ml-1">
            External Link (Optional)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-sm text-on-surface-variant/30">link</span>
            <input
              type="url"
              value={externalLink}
              onChange={(e) => setExternalLink(e.target.value)}
              placeholder="https://example.com"
              className="w-full bg-surface-container-high border-none rounded-2xl pl-10 pr-5 py-4 text-on-surface placeholder:text-on-surface-variant/30 focus:ring-2 focus:ring-secondary/50 transition-all font-medium"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/70 ml-1">
            Attachments (Photos/PDF/DOCX)
          </label>
          <div className="relative">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-surface-container-high hover:bg-surface-container-highest border-2 border-dashed border-outline-variant/30 rounded-2xl px-5 py-4 text-on-surface-variant/60 transition-all font-medium flex items-center justify-between"
            >
              <span className="text-sm">
                {selectedFiles.length > 0 ? `${selectedFiles.length} files selected` : "Choose files..."}
              </span>
              <span className="material-symbols-outlined text-lg">upload_file</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        <div className="flex items-center">
          {role === "TEACHER" && (
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={showAuthor}
                  onChange={(e) => setShowAuthor(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-surface-container-highest rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-on-surface-variant/40 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary peer-checked:after:bg-on-secondary"></div>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 group-hover:text-on-surface transition-colors">
                Display My Name
              </span>
            </label>
          )}
        </div>

        <button
          type="submit"
          disabled={isPosting || isUploading}
          className="bg-secondary text-on-secondary px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-secondary/90 disabled:opacity-50 shadow-xl shadow-secondary/20 transition-all active:scale-95 flex items-center gap-3"
        >
          {isPosting || isUploading ? (
            <>
              <span className="h-4 w-4 border-2 border-on-secondary/30 border-t-on-secondary rounded-full animate-spin"></span>
              {isUploading ? "Uploading Files..." : "Posting..."}
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-sm">send</span>
              Post Notice
            </>
          )}
        </button>
      </div>
    </form>
  );
}
