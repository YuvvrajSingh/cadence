"use client";

import { useEffect, useRef, useState } from "react";
import DeveloperBadge from "@/components/DeveloperBadge";

// ─── Types ────────────────────────────────────────────────────────────────────
type SubmissionStatus = "submitted" | "waiting";
type GradingStatus = "done" | "processing" | "pending" | "failed" | "none";

type StudentRow = {
  roll_number: string;
  name: string;
  submission_status: SubmissionStatus;
  grading_status: GradingStatus;
};

type ActiveExam = {
  _id: string | number;
  exam_name?: string;
  subject?: string;
  q_count?: number;
  student_count?: number;
  pending_count?: number;
};

// ─── Badge helpers ─────────────────────────────────────────────────────────────
function SubmissionBadge({ status }: { status: SubmissionStatus }) {
  if (status === "submitted") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-green-500/10 text-green-400 ring-1 ring-green-500/20">
        <span className="material-symbols-outlined text-[13px]">cloud_done</span>
        Submitted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-surface-variant/50 text-on-surface-variant/60 ring-1 ring-outline-variant/20">
      <span className="material-symbols-outlined text-[13px]">schedule</span>
      Waiting
    </span>
  );
}

function GradingBadge({ status }: { status: GradingStatus }) {
  const map: Record<GradingStatus, { label: string; icon: string; cls: string }> = {
    done:       { label: "Graded",     icon: "verified",   cls: "bg-primary/10 text-primary ring-primary/20" },
    processing: { label: "Processing", icon: "sync",       cls: "bg-blue-500/10 text-blue-400 ring-blue-500/20" },
    pending:    { label: "Pending",    icon: "hourglass",  cls: "bg-yellow-500/10 text-yellow-400 ring-yellow-500/20" },
    failed:     { label: "Failed",     icon: "error",      cls: "bg-red-500/10 text-red-400 ring-red-500/20" },
    none:       { label: "—",         icon: "remove",     cls: "bg-surface-variant/30 text-on-surface-variant/40 ring-outline-variant/10" },
  };
  const { label, icon, cls } = map[status] ?? map.none;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ring-1 ${cls} ${status === "processing" ? "animate-pulse" : ""}`}>
      <span className={`material-symbols-outlined text-[13px] ${status === "processing" ? "animate-spin" : ""}`}>{icon}</span>
      {label}
    </span>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function BatchGradingPage() {
  const [exams, setExams] = useState<ActiveExam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Remove flow
  const [confirmRoll, setConfirmRoll] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeMsg, setRemoveMsg] = useState<{ roll: string; type: "success" | "error"; text: string } | null>(null);

  // Evaluation state
  const [evaluating, setEvaluating] = useState(false);
  const [evaluateMsg, setEvaluateMsg] = useState<string | null>(null);

  // Auto-poll while grading is in-progress
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load exams
  useEffect(() => {
    fetch("/api/gradeai/teacher/active-exams")
      .then(r => r.ok ? r.json() : { exams: [] })
      .then(data => {
        const list: ActiveExam[] = Array.isArray(data.exams) ? data.exams : [];
        setExams(list);
        if (list.length > 0) setSelectedExamId(String(list[0]._id));
      })
      .catch(() => {})
      .finally(() => setLoadingExams(false));
  }, []);

  // Load batch status when exam changes
  useEffect(() => {
    if (!selectedExamId) return;
    stopPolling();
    fetchBatchStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExamId]);

  // Auto-poll while any student is pending/processing
  useEffect(() => {
    const hasInProgress = students.some(
      s => s.grading_status === "pending" || s.grading_status === "processing"
    );
    if (hasInProgress) {
      startPolling();
    } else {
      stopPolling();
    }
    return () => stopPolling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students]);

  function startPolling() {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(() => fetchBatchStatus(true), 15000);
  }

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  async function fetchBatchStatus(silent = false) {
    if (!selectedExamId) return;
    if (!silent) setLoadingStudents(true);
    try {
      const res = await fetch(`/api/gradeai/teacher/batch-status/${selectedExamId}`);
      if (res.ok) {
        const data = await res.json();
        setStudents(Array.isArray(data.students) ? data.students : []);
      }
    } catch {}
    finally { if (!silent) setLoadingStudents(false); }
  }

  async function handleRemove(roll: string) {
    setRemoving(roll);
    setConfirmRoll(null);
    setRemoveMsg(null);
    try {
      const res = await fetch(`/api/gradeai/teacher/delete-submission/${selectedExamId}/${encodeURIComponent(roll)}`, {
        method: "DELETE",
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Failed"); }
      // Optimistic update
      setStudents(prev =>
        prev.map(s =>
          s.roll_number === roll
            ? { ...s, submission_status: "waiting", grading_status: "none" }
            : s
        )
      );
      setRemoveMsg({ roll, type: "success", text: `Submission for ${roll} removed. Re-upload via Assembly Line.` });
    } catch (err: any) {
      setRemoveMsg({ roll, type: "error", text: err.message || "Failed to remove submission." });
    } finally {
      setRemoving(null);
    }
  }

  async function startGrading() {
    if (!selectedExamId) return;

    setEvaluating(true);
    setEvaluateMsg("Evaluating pending submissions... This may take several minutes.");
    try {
      const res = await fetch(`/api/gradeai/teacher/process-pending/${selectedExamId}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Evaluation failed");
      const data = await res.json();
      setEvaluateMsg(`Grading complete! Processed: ${data.processed}, Failed: ${data.failed}`);
      
      // Refresh batch status
      await fetchBatchStatus(true);
      
      // Refresh exam list to update counts
      const examsRes = await fetch("/api/gradeai/teacher/active-exams");
      if (examsRes.ok) {
        const examsData = await examsRes.json();
        setExams(Array.isArray(examsData.exams) ? examsData.exams : []);
      }
    } catch (e: any) {
      setEvaluateMsg(e.message || "Could not start grading");
    } finally {
      setEvaluating(false);
    }
  }

  // ── Stats
  const total       = students.length;
  const submitted   = students.filter(s => s.submission_status === "submitted").length;
  const graded      = students.filter(s => s.grading_status === "done").length;
  const pending     = students.filter(s => s.grading_status === "pending" || s.grading_status === "processing").length;

  // ── Filtered list
  const filtered = students.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return s.roll_number.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
  });

  if (loadingExams) return <div className="p-10 animate-pulse bg-surface-variant/20 rounded-[2rem] h-64" />;

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase leading-none">Batch Grading</h1>
            <p className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mt-2 leading-none">
              Per-student submission &amp; grading status dashboard
            </p>
          </div>
          <DeveloperBadge name="Nakshatra Kataria" moduleName="Exam" avatarInitials="NK" />
        </div>
      </header>

      {exams.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-outline-variant/40 rounded-[2rem]">
          <span className="material-symbols-outlined text-[3rem] text-on-surface-variant/30 mb-4">inventory_2</span>
          <h3 className="text-lg font-black uppercase">No Active Exams</h3>
          <p className="text-sm text-on-surface-variant font-medium mt-1">Create an exam first from the Midterms tab.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Exam selection dropdown ────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant shrink-0">Select Active Assessment</label>
            <div className="relative flex-1 max-w-md">
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-primary appearance-none pr-10 cursor-pointer hover:bg-surface-variant/50 transition-colors"
              >
                {exams.map(ex => (
                  <option key={ex._id} value={String(ex._id)}>
                    {ex.exam_name || ex.subject || `Exam ${ex._id}`}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant/50">
                unfold_more
              </span>
            </div>
          </div>

          {/* ── Stats ──────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Enrolled",  value: total,     icon: "group",        cls: "bg-surface-container text-on-surface" },
              { label: "Submitted", value: submitted,  icon: "cloud_done",   cls: "bg-green-500/10 text-green-400" },
              { label: "Graded",    value: graded,     icon: "verified",     cls: "bg-primary/10 text-primary" },
              { label: "Pending",   value: pending,    icon: "hourglass",    cls: "bg-yellow-500/10 text-yellow-400" },
            ].map(card => (
              <div key={card.label} className="bg-surface-container border border-outline-variant/20 rounded-2xl p-5 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${card.cls}`}>
                  <span className="material-symbols-outlined text-lg">{card.icon}</span>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{card.label}</p>
                  <p className="text-2xl font-black text-on-surface">{card.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Toolbar ────────────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-sm">search</span>
              <input
                type="text"
                placeholder="Search by roll number or name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-surface border border-outline-variant/30 rounded-xl pl-9 pr-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              onClick={() => fetchBatchStatus()}
              disabled={loadingStudents}
              className="bg-surface-container border border-outline-variant/30 text-on-surface-variant px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-surface-variant transition-colors disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-sm ${loadingStudents ? "animate-spin" : ""}`}>refresh</span>
              {loadingStudents ? "Loading..." : "Refresh"}
            </button>
            
            {selectedExamId && (
              <button
                onClick={() => void startGrading()}
                disabled={evaluating || !selectedExamId || (exams.find(e => String(e._id) === selectedExamId)?.pending_count ?? 0) === 0}
                className="bg-primary text-on-primary px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-50 flex items-center gap-2 hover:scale-95 transition-transform"
              >
                {evaluating ? (
                  <>
                     <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                     Grading...
                  </>
                ) : (
                  <>
                     <span className="material-symbols-outlined text-sm">smart_toy</span>
                     Start Grading ({exams.find(e => String(e._id) === selectedExamId)?.pending_count ?? 0})
                  </>
                )}
              </button>
            )}

            {evaluateMsg && (
              <span className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">{evaluateMsg}</span>
            )}
          </div>

          {/* ── Remove feedback toast ───────────────────────────────────────── */}
          {removeMsg && (
            <div className={`p-4 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-3 ${
              removeMsg.type === "success" ? "bg-primary-container text-on-primary-container" : "bg-error-container text-on-error-container"
            }`}>
              <span className="material-symbols-outlined text-sm">
                {removeMsg.type === "success" ? "check_circle" : "error"}
              </span>
              {removeMsg.text}
              <button onClick={() => setRemoveMsg(null)} className="ml-auto opacity-60 hover:opacity-100">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}

          {/* ── Roster table ────────────────────────────────────────────────── */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-[2rem] overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center px-6 py-4 border-b border-outline-variant/20 bg-surface-container">
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Student</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-center w-32">Submission</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-center w-32">Grading</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-center w-24">Action</p>
            </div>

            {loadingStudents ? (
              <div className="p-8 space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-14 rounded-xl bg-surface-variant/20 animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-16 text-center">
                <span className="material-symbols-outlined text-[3rem] text-on-surface-variant/20 mb-3">person_search</span>
                <p className="text-sm font-bold uppercase tracking-widest text-on-surface-variant/50">
                  {searchQuery ? "No students match your search." : "No students enrolled for this exam."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/10">
                {filtered.map(student => (
                  <div
                    key={student.roll_number}
                    className="grid grid-cols-[1fr_auto_auto_auto] items-center px-6 py-4 hover:bg-primary/5 transition-colors"
                  >
                    {/* Student info */}
                    <div>
                      <p className="text-sm font-black text-on-surface uppercase tracking-tight">
                        {student.roll_number}
                      </p>
                      <p className="text-[11px] font-medium text-on-surface-variant mt-0.5">
                        {student.name || "—"}
                      </p>
                    </div>

                    {/* Submission status */}
                    <div className="w-32 flex justify-center">
                      <SubmissionBadge status={student.submission_status} />
                    </div>

                    {/* Grading status */}
                    <div className="w-32 flex justify-center">
                      <GradingBadge status={student.grading_status} />
                    </div>

                    {/* Remove action */}
                    <div className="w-24 flex justify-center">
                      {student.submission_status === "submitted" ? (
                        confirmRoll === student.roll_number ? (
                          /* Inline confirm */
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleRemove(student.roll_number)}
                              disabled={removing === student.roll_number}
                              className="bg-error text-on-error px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:scale-95 transition-transform disabled:opacity-50"
                            >
                              {removing === student.roll_number ? "..." : "Yes"}
                            </button>
                            <button
                              onClick={() => setConfirmRoll(null)}
                              className="bg-surface-container border border-outline-variant/30 text-on-surface-variant px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-surface-variant transition-colors"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setConfirmRoll(student.roll_number); setRemoveMsg(null); }}
                            disabled={removing === student.roll_number}
                            title="Remove submission and photos"
                            className="w-8 h-8 rounded-lg bg-error/10 text-error flex items-center justify-center hover:bg-error hover:text-on-error transition-colors disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        )
                      ) : (
                        <span className="text-on-surface-variant/20">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer count */}
            {!loadingStudents && filtered.length > 0 && (
              <div className="px-6 py-3 border-t border-outline-variant/20 bg-surface-container">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
                  Showing {filtered.length} of {total} students
                  {pending > 0 && (
                    <span className="ml-3 text-yellow-400 animate-pulse">
                      • Auto-refreshing every 15s while grading is in-progress
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
