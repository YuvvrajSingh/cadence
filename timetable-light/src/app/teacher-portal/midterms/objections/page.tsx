"use client";

import { useEffect, useState } from "react";
import DeveloperBadge from "@/components/DeveloperBadge";

type Objection = {
  id: string;
  exam_id: number;
  exam_name?: string;
  roll_number: string;
  student_name?: string;
  question_numbers: number[];
  reason: string;
  status: "PENDING" | "RESOLVED" | "DISMISSED";
  teacher_reply?: string | null;
  created_at: string;
  updated_at: string;
};

type ExamOption = {
  _id: string | number;
  exam_name?: string;
  subject?: string;
};

type QuestionDetail = {
  question_number: number;
  marks_awarded: number;
  total_marks: number;
  grade?: string;
  feedback?: string;
  extracted_ocr_text?: string;
  question_text?: string;
  model_answer?: string;
  similarity_score?: number | null;
  image_paths?: string[];
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING:   "bg-yellow-500/15 text-yellow-400 ring-yellow-500/30",
    RESOLVED:  "bg-green-500/15  text-green-400  ring-green-500/30",
    DISMISSED: "bg-red-500/15    text-red-400    ring-red-500/30",
  };
  const icons: Record<string, string> = {
    PENDING: "pending", RESOLVED: "check_circle", DISMISSED: "cancel",
  };
  const s = status?.toUpperCase() ?? "PENDING";
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ring-1 ${styles[s] ?? styles.PENDING}`}>
      <span className="material-symbols-outlined text-[12px]">{icons[s] ?? "pending"}</span>
      {s}
    </span>
  );
}

export default function TeacherObjectionsPage() {
  const [objections, setObjections] = useState<Objection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "RESOLVED" | "DISMISSED">("ALL");
  const [examFilter, setExamFilter] = useState("");
  const [examOptions, setExamOptions] = useState<ExamOption[]>([]);

  // Review panel
  const [selected, setSelected] = useState<Objection | null>(null);
  const [reply, setReply] = useState("");
  const [newMarks, setNewMarks] = useState<Record<number, string>>({});
  const [details, setDetails] = useState<QuestionDetail[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load exams for filter dropdown
  useEffect(() => {
    fetch("/api/gradeai/teacher/active-exams")
      .then(res => res.ok ? res.json() : { exams: [] })
      .then(data => setExamOptions(Array.isArray(data.exams) ? data.exams : []))
      .catch(() => {});
  }, []);

  // Load objections
  useEffect(() => {
    fetchObjections();
  }, [statusFilter, examFilter]);

  async function fetchObjections() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (examFilter) params.set("exam_id", examFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const res = await fetch(`/api/objections?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load objections.");
      const data = await res.json();
      setObjections(Array.isArray(data.objections) ? data.objections : []);
    } catch (err: any) {
      setError(err.message || "Failed to load objections.");
    } finally {
      setLoading(false);
    }
  }

  async function openReview(obj: Objection) {
    setSelected(obj);
    setReply(obj.teacher_reply ?? "");
    setNewMarks({});
    setReviewMsg(null);
    setDetails([]);
    setDetailsLoading(true);

    try {
      const res = await fetch(`/api/gradeai/teacher/get-student-details/${obj.exam_id}/${obj.roll_number}`);
      if (!res.ok) throw new Error("Failed to load details");
      const data = await res.json();
      setDetails(data.details ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setDetailsLoading(false);
    }
  }

  async function submitReview(action: "RESOLVED" | "DISMISSED") {
    if (!selected) return;
    setReviewing(true);
    setReviewMsg(null);
    try {
      // First override marks if any are provided
      if (action === "RESOLVED") {
        for (const qnStr of Object.keys(newMarks)) {
          const qn = Number(qnStr);
          const val = newMarks[qn];
          if (!val) continue;

          const fd = new FormData();
          fd.append("exam_id", String(selected.exam_id));
          fd.append("roll_number", selected.roll_number);
          fd.append("question_number", String(qn));
          fd.append("marks_awarded", val);

          const overrideRes = await fetch("/api/gradeai/teacher/update-marks", { method: "POST", body: fd });
          if (!overrideRes.ok) throw new Error(`Failed to override marks for Q${qn}`);
        }
      }

      // Then resolve the objection
      const res = await fetch(`/api/objections/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action, teacher_reply: reply }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed."); }
      const data = await res.json();
      const updated = data.objection as Objection;
      setObjections(prev => prev.map(o => o.id === updated.id ? updated : o));
      setSelected(updated);
      setReviewMsg({ type: "success", text: `Objection marked as ${action}. Marks updated successfully.` });
    } catch (err: any) {
      setReviewMsg({ type: "error", text: err.message || "Failed to update." });
    } finally {
      setReviewing(false);
    }
  }

  const pendingCount = objections.filter(o => o.status === "PENDING").length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <header>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase leading-none">Objections Centre</h1>
            <p className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mt-2 leading-none">
              Student Exam Objections — Review &amp; Resolution
            </p>
          </div>
          <DeveloperBadge name="Nakshatra Kataria" moduleName="Exam" avatarInitials="NK" />
        </div>
      </header>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: "Total",     value: objections.length,  icon: "inbox",        colour: "bg-primary-container text-on-primary-container" },
          { label: "Pending",   value: pendingCount,         icon: "pending",      colour: "bg-yellow-500/10 text-yellow-400" },
          { label: "Resolved",  value: objections.filter(o => o.status === "RESOLVED").length,  icon: "check_circle", colour: "bg-green-500/10 text-green-400" },
        ].map(s => (
          <div key={s.label} className="bg-surface-container border border-outline-variant/20 rounded-2xl p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.colour}`}>
              <span className="material-symbols-outlined text-lg">{s.icon}</span>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{s.label}</p>
              <p className="text-2xl font-black text-on-surface">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 flex flex-wrap gap-4 items-end">
        {/* Exam filter */}
        <div className="space-y-1.5 flex-1 min-w-[160px]">
          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Exam</label>
          <select value={examFilter} onChange={e => setExamFilter(e.target.value)}
            className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary">
            <option value="">All Exams</option>
            {examOptions.map(ex => (
              <option key={String(ex._id)} value={String(ex._id)}>
                {ex.exam_name || ex.subject || String(ex._id)}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div className="flex gap-2 flex-wrap">
          {(["ALL", "PENDING", "RESOLVED", "DISMISSED"] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors border ${
                statusFilter === s
                  ? "bg-on-surface text-surface border-on-surface"
                  : "bg-surface-container border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant"
              }`}>
              {s}
            </button>
          ))}
        </div>

        <button onClick={fetchObjections} disabled={loading}
          className="bg-primary text-on-primary px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:scale-95 transition-transform disabled:opacity-50">
          <span className="material-symbols-outlined text-sm">{loading ? "sync" : "refresh"}</span>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-error-container text-on-error-container text-xs font-bold uppercase tracking-widest flex items-center gap-2">
          <span className="material-symbols-outlined">error</span> {error}
        </div>
      )}

      {/* Main content */}
      <>
        {/* Objections list */}
        <div className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-[2rem] overflow-hidden">
          <div className="p-6 border-b border-outline-variant/20">
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
              {loading ? "Loading..." : `${objections.length} Objection${objections.length !== 1 ? "s" : ""}`}
            </p>
          </div>

          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-surface-variant/20 animate-pulse" />)}
            </div>
          ) : objections.length === 0 ? (
            <div className="p-16 text-center">
              <span className="material-symbols-outlined text-[3rem] text-on-surface-variant/20 mb-4">flag_circle</span>
              <p className="text-sm font-bold uppercase tracking-widest text-on-surface-variant/50">No objections found.</p>
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/10">
              {objections.map(obj => (
                <div key={obj.id} onClick={() => openReview(obj)}
                  className={`p-5 cursor-pointer transition-colors hover:bg-primary/5 ${selected?.id === obj.id ? "bg-primary/10" : ""}`}>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-on-surface">
                        {obj.exam_name || `Exam ${obj.exam_id}`}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mt-0.5">
                        {obj.roll_number}{obj.student_name ? ` · ${obj.student_name}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={obj.status} />
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {obj.question_numbers.map(qn => (
                      <span key={qn} className="bg-surface-variant text-on-surface-variant px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest">Q{qn}</span>
                    ))}
                  </div>

                  <p className="text-xs text-on-surface-variant line-clamp-2 font-medium">{obj.reason}</p>

                  <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 mt-2">
                    {new Date(obj.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Review Modal */}
        {selected && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
            <div className="w-full max-w-4xl max-h-full bg-surface-container-lowest border border-outline-variant/30 rounded-[2rem] overflow-hidden flex flex-col shadow-2xl">
            {/* Panel header */}
            <div className="p-6 border-b border-outline-variant/20 flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Review Objection</p>
                <h3 className="text-xl font-black uppercase mt-1">{selected.roll_number}</h3>
                {selected.student_name && <p className="text-sm text-on-surface-variant font-medium">{selected.student_name}</p>}
              </div>
              <button onClick={() => { setSelected(null); setReviewMsg(null); }} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Exam info */}
              <div className="bg-surface-container rounded-xl p-4 space-y-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Exam</p>
                <p className="text-sm font-black text-on-surface">{selected.exam_name || `Exam ${selected.exam_id}`}</p>
              </div>

              {/* Questions contested with override inputs and audit */}
              <div className="space-y-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Override Marks &amp; Student Audit</p>
                {detailsLoading ? (
                  <div className="h-20 bg-surface-variant/20 animate-pulse rounded-xl" />
                ) : (
                  <div className="space-y-4">
                    {selected.question_numbers.map(qn => {
                      const d = details.find(detail => detail.question_number === qn);
                      return (
                        <div key={qn} className="bg-surface-container rounded-2xl border border-outline-variant/20 overflow-hidden shadow-sm">
                          {/* Q Header and Input */}
                          <div className="flex items-center justify-between bg-surface-container px-4 py-3 border-b border-outline-variant/10">
                            <div className="flex items-center gap-3">
                              <span className="bg-error/10 text-error px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest shrink-0">Q{qn}</span>
                              {d && (
                                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant bg-surface-variant/30 px-2 py-1 rounded flex items-center gap-1.5">
                                  {selected.status === "PENDING" ? "Current Mark:" : "Final Mark:"} 
                                  <span className="text-sm text-on-surface">{d.marks_awarded}/{d.total_marks}</span>
                                </span>
                              )}
                            </div>
                            
                            {selected.status === "PENDING" && d && (
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max={d.total_marks}
                                value={newMarks[qn] || ""}
                                onChange={(e) => {
                                  let val = e.target.value;
                                  if (val !== "") {
                                    const numVal = parseFloat(val);
                                    if (!isNaN(numVal)) {
                                      if (numVal > d.total_marks) val = String(d.total_marks);
                                      else if (numVal < 0) val = "0";
                                    }
                                  }
                                  setNewMarks(prev => ({ ...prev, [qn]: val }));
                                }}
                                className="w-32 bg-surface border border-outline-variant/30 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-primary"
                                placeholder={`Max ${d.total_marks}`}
                              />
                            )}
                          </div>

                          {/* Audit Info */}
                          {d && (
                            <div className="p-4 space-y-3">
                              {/* Model Question */}
                              {d.question_text && (
                                <details className="group">
                                  <summary className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1 cursor-pointer hover:text-primary transition-colors flex items-center gap-1 list-none [&::-webkit-details-marker]:hidden select-none">
                                    <span className="material-symbols-outlined text-[12px] transition-transform group-open:rotate-90">chevron_right</span>
                                    Model Question
                                  </summary>
                                  <p className="text-xs text-on-surface leading-relaxed bg-surface-variant/20 rounded-lg p-2 mt-1">{d.question_text}</p>
                                </details>
                              )}

                              {/* Model Answer */}
                              {d.model_answer && (
                                <details className="group">
                                  <summary className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1 cursor-pointer hover:text-primary transition-colors flex items-center gap-1 list-none [&::-webkit-details-marker]:hidden select-none">
                                    <span className="material-symbols-outlined text-[12px] transition-transform group-open:rotate-90">chevron_right</span>
                                    Model Answer
                                  </summary>
                                  <p className="text-xs text-on-surface leading-relaxed bg-primary/5 rounded-lg p-2 mt-1">{d.model_answer}</p>
                                </details>
                              )}

                              {/* OCR Text */}
                              <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Student Answer (OCR)</p>
                                <p className="text-xs text-on-surface-variant leading-relaxed bg-surface-variant/30 rounded-lg p-2 font-mono max-h-32 overflow-y-auto">{d.extracted_ocr_text || "[OCR_UNREADABLE] No readable text extracted from image."}</p>
                              </div>

                              {/* Uploaded Images */}
                              {d.image_paths && d.image_paths.length > 0 && (
                                <div>
                                  <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Original Answer Sheet</p>
                                  <div className="space-y-2">
                                    {d.image_paths.map((imgPath, idx) => (
                                      <img
                                        key={idx}
                                        src={`/api/gradeai/uploads/${imgPath.replace(/^uploads[\/\\]/, "")}`}
                                        alt={`Student Answer Q${qn} Part ${idx + 1}`}
                                        className="w-full rounded-lg border border-outline-variant/30 shadow-sm bg-surface-container"
                                        loading="lazy"
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Semantic Similarity */}
                              <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Semantic Similarity</p>
                                <p className="text-xs text-on-surface-variant leading-relaxed bg-surface-variant/20 rounded-lg p-2 font-mono">
                                  {typeof d.similarity_score === "number" ? `${d.similarity_score}%` : "N/A"}
                                </p>
                              </div>

                              {/* AI Feedback */}
                              {d.feedback && (
                                <div>
                                  <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1">AI Feedback</p>
                                  <p className="text-xs text-on-surface-variant italic leading-relaxed">{d.feedback}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Student reason */}
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Student Reason</p>
                <div className="bg-surface-container-low border border-outline-variant/20 rounded-xl p-4">
                  <p className="text-sm text-on-surface font-medium leading-relaxed">{selected.reason}</p>
                </div>
              </div>

              {/* Current status */}
              <div className="flex items-center gap-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Current Status</p>
                <StatusBadge status={selected.status} />
              </div>

              {/* Teacher reply */}
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">
                  Your Reply (optional)
                </label>
                <textarea rows={4} value={reply} onChange={e => setReply(e.target.value)}
                  placeholder="Explain your decision to the student..."
                  className="w-full resize-none bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary transition-all" />
              </div>

              {reviewMsg && (
                <div className={`p-3 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${
                  reviewMsg.type === "success" ? "bg-primary-container text-on-primary-container" : "bg-error-container text-on-error-container"
                }`}>
                  <span className="material-symbols-outlined text-sm">{reviewMsg.type === "success" ? "check_circle" : "error"}</span>
                  {reviewMsg.text}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex pt-2">
                <button onClick={() => submitReview("RESOLVED")} disabled={reviewing || selected.status === "RESOLVED"}
                  className="w-full bg-green-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-95 transition-transform disabled:opacity-50">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  {reviewing ? "Saving..." : "Resolve & Update Marks"}
                </button>
              </div>

              <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 text-center">
                Submitted {new Date(selected.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </p>
              </div>
            </div>
          </div>
        )}
      </>
    </div>
  );
}
