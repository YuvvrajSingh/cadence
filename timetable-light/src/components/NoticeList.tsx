import { Notice, NoticeAttachment } from "@/lib/types";
import { format } from "date-fns";
import { useState, useMemo } from "react";

interface NoticeListProps {
  notices: Notice[];
  onDelete?: (id: string) => void;
  onReport?: (id: string) => void;
  onRestore?: (id: string) => void;
  isAdmin?: boolean;
  isTeacher?: boolean;
  currentUserId?: string;
}

export default function NoticeList({ 
  notices, 
  onDelete, 
  onReport, 
  onRestore, 
  isAdmin, 
  isTeacher,
  currentUserId 
}: NoticeListProps) {
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [targetFilter, setTargetFilter] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    notices.forEach(n => n.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [notices]);

  const filteredNotices = useMemo(() => {
    return notices.filter(notice => {
      const matchesSearch = 
        notice.title.toLowerCase().includes(search.toLowerCase()) ||
        notice.content.toLowerCase().includes(search.toLowerCase());
      
      const matchesTags = 
        selectedTags.length === 0 || 
        selectedTags.every(t => notice.tags?.includes(t));

      const matchesTarget = 
        !targetFilter || 
        (targetFilter === "Admin" && notice.authorRole === "ADMIN") ||
        (targetFilter === "Teacher" && notice.authorRole === "TEACHER") ||
        (targetFilter === "Student" && notice.authorRole === "STUDENT");

      return matchesSearch && matchesTags && matchesTarget;
    });
  }, [notices, search, selectedTags, targetFilter]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return "image";
    if (type === "application/pdf") return "picture_as_pdf";
    if (type.includes("word")) return "description";
    return "attach_file";
  };

  if (notices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-surface-container-low rounded-3xl border border-outline-variant/10">
        <span className="material-symbols-outlined text-6xl text-on-surface-variant/20 mb-4">
          notifications_off
        </span>
        <p className="text-on-surface-variant font-medium">No notices yet.</p>
        <p className="text-xs text-on-surface-variant/60 mt-1 uppercase tracking-widest">
          Updates will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-lowest p-5 rounded-[2.5rem] border border-outline-variant/20 space-y-6 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60">
              search
            </span>
            <input
              type="text"
              placeholder="Search notices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 transition-all font-medium"
            />
          </div>

          <div className="flex bg-surface-container-low p-1.5 rounded-2xl border border-outline-variant/5">
            {[
              { id: "Admin", icon: "shield_person" },
              { id: "Teacher", icon: "school" },
              { id: "Student", icon: "person" }
            ].map((role) => (
              <button
                key={role.id}
                onClick={() => setTargetFilter(targetFilter === role.id ? null : role.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                  targetFilter === role.id
                    ? "bg-secondary text-on-secondary shadow-lg shadow-secondary/20"
                    : "text-on-surface-variant/60 hover:text-on-surface hover:bg-surface-container-highest"
                }`}
              >
                <span className="material-symbols-outlined text-sm">{role.icon}</span>
                {role.id}
              </button>
            ))}
          </div>
        </div>
        
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 mr-2">
              Filter Tags:
            </span>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all border ${
                  selectedTags.includes(tag)
                    ? "bg-secondary/10 text-secondary border-secondary/20"
                    : "bg-surface-container-high text-on-surface-variant/50 border-outline-variant/5 hover:border-secondary/20"
                }`}
              >
                #{tag}
              </button>
            ))}
            {(selectedTags.length > 0 || targetFilter) && (
              <button
                onClick={() => { setSelectedTags([]); setTargetFilter(null); setSearch(""); }}
                className="ml-auto text-[9px] font-black uppercase tracking-widest text-error/60 hover:text-error underline-offset-4 hover:underline transition-all"
              >
                Clear All
              </button>
            )}
          </div>
        )}
      </div>

      {filteredNotices.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-on-surface-variant/60 text-sm italic">No notices match your filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNotices.map((notice) => (
            <div
              key={notice.id}
              className={`group relative bg-surface-container-low hover:bg-surface-container transition-all duration-300 rounded-[2.5rem] p-6 border ${
                notice.isArchived 
                  ? "border-error/20 bg-error/[0.02]" 
                  : "border-outline-variant/10 hover:border-secondary/20"
              } hover:shadow-xl hover:shadow-secondary/5`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-inner ${
                    notice.isArchived ? "bg-error/10 text-error" : "bg-secondary/10 text-secondary"
                  }`}>
                    <span className="material-symbols-outlined text-2xl">
                      {notice.isArchived ? "archive" : "campaign"}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-black text-on-surface tracking-tighter group-hover:text-secondary transition-colors text-xl leading-tight">
                      {notice.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 bg-surface-container-high px-2 py-0.5 rounded-full border border-outline-variant/5">
                        {format(new Date(notice.createdAt), "MMM d, yyyy")}
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                        notice.target === "ALL" 
                          ? "bg-primary/5 text-primary border-primary/10" 
                          : notice.target === "TEACHERS" 
                          ? "bg-tertiary/5 text-tertiary border-tertiary/10"
                          : "bg-secondary/5 text-secondary border-secondary/10"
                      }`}>
                        {notice.target}
                      </span>
                      {notice.isArchived && (
                        <span className="text-[10px] font-black uppercase tracking-widest bg-error text-white px-2 py-0.5 rounded-full shadow-lg shadow-error/20 animate-pulse">
                          ARCHIVED
                        </span>
                      )}
                      {notice.authorName && notice.authorRole === "STUDENT" && (
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border bg-secondary/10 text-secondary border-secondary/20">
                          {notice.authorName} (student)
                        </span>
                      )}
                      {notice.authorName && notice.authorRole === "ADMIN" && (
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/20">
                          Administration
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {onRestore && notice.isArchived && (isAdmin || isTeacher) && (
                    <button
                      onClick={() => onRestore(notice.id)}
                      className="p-2 bg-secondary text-on-secondary rounded-xl hover:bg-secondary/90 transition-all active:scale-95 flex items-center gap-2 px-3"
                      title="Restore Notice"
                    >
                      <span className="material-symbols-outlined text-sm">restore</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest">Restore</span>
                    </button>
                  )}
                  {onReport && !notice.isArchived && !notice.isProtected && notice.postedBy !== currentUserId && !isTeacher && !isAdmin && notice.authorRole === "STUDENT" && (
                    <button
                      onClick={() => onReport(notice.id)}
                      className="p-2 hover:bg-error/10 hover:text-error text-on-surface-variant/40 rounded-xl bg-surface-container-high transition-all"
                      title="Report Notice"
                    >
                      <span className="material-symbols-outlined text-sm">flag</span>
                    </button>
                  )}
                  {onDelete && (isAdmin || (isTeacher && notice.isArchived)) && (
                    <button
                      onClick={() => onDelete(notice.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-error/10 hover:text-error text-on-surface-variant/40 rounded-xl bg-surface-container-high"
                      title="Delete Notice"
                    >
                      <span className="material-symbols-outlined text-xl">delete</span>
                    </button>
                  )}
                </div>
              </div>
              
              <div className="pl-16 space-y-4">
                <p className="text-on-surface-variant text-sm leading-relaxed whitespace-pre-wrap font-medium">
                  {notice.content}
                </p>

                {/* External Link */}
                {notice.externalLink && (
                  <a 
                    href={notice.externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/5 border border-secondary/20 rounded-xl text-secondary text-[11px] font-black uppercase tracking-widest hover:bg-secondary/10 transition-all group/link"
                  >
                    <span className="material-symbols-outlined text-sm">link</span>
                    Visit Link
                    <span className="material-symbols-outlined text-xs group-hover/link:translate-x-1 transition-transform">arrow_forward</span>
                  </a>
                )}

                {/* Attachments */}
                {notice.attachments && notice.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-3 pt-2">
                    {notice.attachments.map((file, idx) => {
                      const isImage = file.type.startsWith("image/");
                      return (
                        <div key={idx} className="space-y-2">
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 bg-surface-container-high rounded-2xl border border-outline-variant/10 hover:border-secondary/30 transition-all max-w-[220px] group/file"
                          >
                            <div className="h-10 w-10 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary group-hover/file:bg-secondary group-hover/file:text-on-secondary transition-colors">
                              <span className="material-symbols-outlined">
                                {getFileIcon(file.type)}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface truncate">
                                {file.name}
                              </p>
                              <p className="text-[8px] font-bold uppercase tracking-tighter text-on-surface-variant/40">
                                {file.type.split("/")[1]} file
                              </p>
                            </div>
                          </a>
                          {isImage && (
                            <div className="relative h-32 w-48 rounded-2xl overflow-hidden border border-outline-variant/10 group/img">
                              <img 
                                src={file.url} 
                                alt={file.name}
                                className="h-full w-full object-cover transition-transform duration-500 group-hover/img:scale-110"
                              />
                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="material-symbols-outlined text-white">zoom_in</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Teacher attribution */}
                {notice.authorRole === "TEACHER" && (
                  <div className="flex items-center gap-2 pt-2">
                    <span className="material-symbols-outlined text-sm text-tertiary">school</span>
                    <span className="text-[11px] font-black uppercase tracking-widest text-tertiary">
                      {notice.showAuthor ? notice.authorName : "Anonymous Faculty"}
                    </span>
                    <span className="text-[9px] text-on-surface-variant/40 font-medium uppercase tracking-wider">
                      · Faculty
                    </span>
                  </div>
                )}

                {notice.tags && notice.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {notice.tags.map(tag => (
                      <span key={tag} className="text-[9px] font-black uppercase tracking-tighter text-secondary/70 bg-secondary/5 px-2 py-0.5 rounded-md border border-secondary/10">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="absolute bottom-0 right-0 p-4 pointer-events-none opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                <span className="material-symbols-outlined text-[100px] rotate-12">
                  attachment
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
