"use client";

import { useEffect, useState } from "react";
import { useAcademicYear } from "@/contexts/academic-year-context";
import DeveloperBadge from "@/components/DeveloperBadge";

type Objection = {
  id: string;
  exam_id: number;
  exam_name?: string;
  roll_number: string;
  question_numbers: number[];
  reason: string;
  status: "PENDING" | "RESOLVED" | "DISMISSED";
  teacher_reply?: string | null;
  created_at: string;
};

type QuestionResult = {
  question_number: number;
  marks_awarded: number;
  total_marks: number;
  class_average?: number;
  feedback?: string;
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

export default function StudentMidtermResultsPage() {
  const { selectedYear } = useAcademicYear();
  const academicYear = selectedYear?.label || "";

  const [profile, setProfile] = useState<any>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [emptyStateMessage, setEmptyStateMessage] = useState("There are currently no digitized exam records active for your profile.");
  const [resultsMessage, setResultsMessage] = useState("");

  // objection form
  const [selectedQuestions, setSelectedQuestions] = useState<number[]>([]);
  const [objectionReason, setObjectionReason] = useState("");
  const [submittingObjection, setSubmittingObjection] = useState(false);
  const [objectionMsg, setObjectionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // my objections list
  const [myObjections, setMyObjections] = useState<Objection[]>([]);
  const [loadingObjections, setLoadingObjections] = useState(false);

  useEffect(() => {
    fetch("/api/auth/student-me")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) throw new Error("No profile");
        const student = data.student ?? data;
        setProfile(student);
        return fetch(`/api/gradeai/student/active-exams/${student.rollNumber}`);
      })
      .then(res => res.ok ? res.json() : { exams: [] })
      .then(data => {
        const allExams = Array.isArray(data.exams) ? data.exams : [];
        const published = allExams.filter((ex: any) => Boolean(ex?.results_published));
        setExams(published);
        setResults(null);
        if (published.length > 0) {
          setSelectedExamId(String(published[0]._id));
        } else {
          setSelectedExamId("");
          setEmptyStateMessage(allExams.length > 0
            ? "Results are not published yet for your active exams."
            : "There are currently no digitized exam records active for your profile.");
        }
      })
      .catch(err => console.error("Error fetching data:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedExamId || !profile?.rollNumber) return;
    setLoadingResults(true);
    setResults(null);
    setResultsMessage("");
    setSelectedQuestions([]);
    setObjectionReason("");
    setObjectionMsg(null);
    fetch(`/api/gradeai/student/results/${selectedExamId}/${profile.rollNumber}`)
      .then(async res => {
        if (res.ok) return res.json();
        if (res.status === 403) { setResultsMessage("Results are not published for this exam yet."); return null; }
        if (res.status === 404) { setResultsMessage("No graded result is available for your roll number yet."); return null; }
        setResultsMessage("Unable to load results right now. Please try again.");
        return null;
      })
      .then(data => setResults(data))
      .catch(() => setResultsMessage("Unable to load results right now. Please try again."))
      .finally(() => setLoadingResults(false));
  }, [selectedExamId, profile]);

  useEffect(() => {
    if (!selectedExamId || !profile?.rollNumber) return;
    setLoadingObjections(true);
    fetch(`/api/objections/my?exam_id=${selectedExamId}&roll_number=${encodeURIComponent(profile.rollNumber)}`)
      .then(res => res.ok ? res.json() : { objections: [] })
      .then(data => setMyObjections(Array.isArray(data.objections) ? data.objections : []))
      .catch(() => setMyObjections([]))
      .finally(() => setLoadingObjections(false));
  }, [selectedExamId, profile]);

  function toggleQuestion(qNum: number) {
    setSelectedQuestions(prev => prev.includes(qNum) ? prev.filter(q => q !== qNum) : [...prev, qNum]);
  }

  async function handleSubmitObjection(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !selectedExamId) return;
    if (selectedQuestions.length === 0) { setObjectionMsg({ type: "error", text: "Select at least one question." }); return; }
    if (!objectionReason.trim()) { setObjectionMsg({ type: "error", text: "Please provide a reason." }); return; }
    setSubmittingObjection(true);
    setObjectionMsg(null);
    const selectedExam = exams.find(ex => String(ex._id) === selectedExamId);
    try {
      const res = await fetch("/api/objections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exam_id: Number(selectedExamId),
          exam_name: selectedExam?.exam_name ?? selectedExam?.subject ?? "",
          roll_number: profile.rollNumber,
          student_name: profile.name ?? "",
          question_numbers: selectedQuestions,
          reason: objectionReason.trim(),
        }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to submit."); }
      const data = await res.json();
      setMyObjections(prev => [data.objection, ...prev]);
      setSelectedQuestions([]);
      setObjectionReason("");
      setObjectionMsg({ type: "success", text: "Objection submitted. Your teacher will review it soon." });
    } catch (err: any) {
      setObjectionMsg({ type: "error", text: err.message || "Failed to submit objection." });
    } finally {
      setSubmittingObjection(false);
    }
  }

  if (loading) return <div className="p-10 animate-pulse bg-surface-variant/20 rounded-[2rem] h-64"></div>;

  const questionList: QuestionResult[] = results?.questions ?? [];
  const alreadyObjectedQuestions = new Set(
    myObjections.flatMap(obj => obj.question_numbers)
  );

  return (
    <div className="space-y-10">
      <header>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase leading-none">Midterm Results</h1>
          <DeveloperBadge name="Nakshatra Kataria" moduleName="Exam" avatarInitials="NK" />
        </div>
        <div className="flex items-center gap-3 mt-2 border-b border-outline-variant/20 pb-4">
          <p className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">GradeAI Automated Assessment</p>
          {academicYear && (
            <span className="text-[10px] font-black uppercase tracking-widest bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full">AY {academicYear}</span>
          )}
        </div>
      </header>

      {exams.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-outline-variant/40 rounded-[2rem]">
          <span className="material-symbols-outlined text-[4rem] text-on-surface-variant/30 mb-4">scan_delete</span>
          <h3 className="text-xl font-black uppercase text-on-surface">No Records Found</h3>
          <p className="text-sm text-on-surface-variant max-w-sm mx-auto font-medium">{emptyStateMessage}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Exam tabs */}
          <div className="flex gap-2 overflow-x-auto pb-4">
            {exams.map(ex => (
              <button key={ex._id} onClick={() => setSelectedExamId(String(ex._id))}
                className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors ${
                  selectedExamId === String(ex._id)
                    ? "bg-on-surface text-surface architectural-shadow"
                    : "bg-surface-container-low text-on-surface-variant border border-outline-variant/30 hover:bg-surface-variant"
                }`}>
                {ex.exam_name || `Exam ${ex._id}`}
              </button>
            ))}
          </div>

          {loadingResults ? (
            <div className="p-12 text-center bg-surface-container-lowest border border-outline-variant/30 rounded-[2rem]">
              <span className="material-symbols-outlined text-[3rem] text-on-surface-variant/40 mb-4 animate-spin">sync</span>
              <p className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Synchronizing LEDGER...</p>
            </div>
          ) : results ? (
            <div className="space-y-6">
              {/* Score card */}
              <div className="bg-surface-container border border-outline-variant/30 rounded-[2rem] p-8 md:p-12 shadow-sm flex flex-col md:flex-row justify-between items-center gap-10">
                <div>
                  <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.3em] mb-2">Final Score</h3>
                  <div className="text-7xl font-black tracking-tighter text-on-surface">
                    {results.total_marks || 0}
                    <span className="text-3xl text-on-surface-variant ml-2">/ {results.total_possible || 0}</span>
                  </div>
                </div>
                {results.class_average_total !== undefined && (
                  <div className="md:border-l border-outline-variant/30 md:pl-10 text-center md:text-left">
                    <h3 className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.3em] mb-2">Class Average</h3>
                    <div className="text-4xl font-black tracking-tighter text-on-surface-variant">
                      {results.class_average_total}
                      <span className="text-xl text-on-surface-variant/50 ml-1">/ {results.total_possible || 0}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Per-question breakdown */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-on-surface-variant px-2">Detailed Response Ledger</h4>
                {questionList.map((q, i) => (
                  <div key={i} className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 flex flex-col md:flex-row gap-8">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 bg-surface-variant text-on-surface font-black rounded-lg flex items-center justify-center">Q{q.question_number}</div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Response Pattern</span>
                      </div>
                      <p className="text-sm font-medium text-on-surface-variant italic leading-relaxed border-l-2 border-primary/20 pl-4">{q.feedback || "No feedback generated"}</p>
                    </div>
                    <div className="w-full md:w-48 bg-surface-container-low rounded-xl p-4 flex flex-col items-center justify-center border border-outline-variant/20">
                      <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Score Awarded</span>
                      <div className={`text-4xl font-black tracking-tight ${q.marks_awarded > 0 ? "text-primary" : "text-error"}`}>{q.marks_awarded}</div>
                      
                      {q.class_average !== undefined && (
                        <div className="mt-3 pt-3 border-t border-outline-variant/20 w-full text-center">
                          <span className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant/70 block">Class Avg</span>
                          <span className="text-sm font-bold text-on-surface-variant">{q.class_average} <span className="text-[10px]">/ {q.total_marks}</span></span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Objection Section ──────────────────────────────────────── */}
              <div className="border-t-2 border-dashed border-outline-variant/30 pt-8 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-error/10 text-error rounded-xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-lg">flag</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-black uppercase tracking-tight">Raise an Objection</h2>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Select questions to contest and provide a reason</p>
                  </div>
                </div>

                <form onSubmit={handleSubmitObjection} className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 space-y-5">
                  {/* Question multi-select */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Question(s) to Contest</label>
                    <div className="flex flex-wrap gap-2">
                      {questionList.length > 0 ? questionList.map(q => {
                        const isObjected = alreadyObjectedQuestions.has(q.question_number);
                        return (
                          <button key={q.question_number} type="button" onClick={() => !isObjected && toggleQuestion(q.question_number)}
                            disabled={isObjected}
                            title={isObjected ? "You have already raised an objection for this question" : ""}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all border ${
                              selectedQuestions.includes(q.question_number)
                                ? "bg-error text-on-error border-error"
                                : isObjected
                                ? "bg-surface-variant/50 border-outline-variant/10 text-on-surface-variant/30 cursor-not-allowed"
                                : "bg-surface-container border-outline-variant/30 text-on-surface-variant hover:border-error/50 hover:text-error"
                            }`}>
                            Q{q.question_number}
                            {selectedQuestions.includes(q.question_number) && <span className="material-symbols-outlined text-[12px] ml-1 align-middle">check</span>}
                          </button>
                        );
                      }) : <p className="text-xs text-on-surface-variant">No questions available.</p>}
                    </div>
                    {selectedQuestions.length > 0 && (
                      <p className="text-[10px] font-bold text-error uppercase tracking-widest">
                        Selected: Q{[...selectedQuestions].sort((a, b) => a - b).join(", Q")}
                      </p>
                    )}
                  </div>

                  {/* Reason */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Reason / Justification</label>
                    <textarea required rows={4} value={objectionReason} onChange={e => setObjectionReason(e.target.value)}
                      placeholder="Explain why you believe the marks awarded are incorrect..."
                      className="w-full resize-none bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-error/50 transition-all" />
                  </div>

                  {objectionMsg && (
                    <div className={`p-3 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${
                      objectionMsg.type === "success" ? "bg-primary-container text-on-primary-container" : "bg-error-container text-on-error-container"
                    }`}>
                      <span className="material-symbols-outlined text-sm">{objectionMsg.type === "success" ? "check_circle" : "error"}</span>
                      {objectionMsg.text}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button type="submit" disabled={submittingObjection}
                      className="bg-error text-on-error px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:scale-95 transition-transform disabled:opacity-50">
                      <span className="material-symbols-outlined text-sm">flag</span>
                      {submittingObjection ? "Submitting..." : "Submit Objection"}
                    </button>
                  </div>
                </form>

                {/* My objections history */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1">My Objections for This Exam</h3>
                  {loadingObjections ? (
                    <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-surface-variant/20 animate-pulse" />)}</div>
                  ) : myObjections.length === 0 ? (
                    <div className="p-6 text-center border border-dashed border-outline-variant/30 rounded-2xl">
                      <p className="text-sm font-bold uppercase tracking-widest text-on-surface-variant/50">No objections raised for this exam yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myObjections.map(obj => (
                        <div key={obj.id} className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex flex-wrap gap-1.5">
                              {obj.question_numbers.map(qn => (
                                <span key={qn} className="bg-surface-variant text-on-surface-variant px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">Q{qn}</span>
                              ))}
                            </div>
                            <StatusBadge status={obj.status} />
                          </div>
                          <p className="text-sm text-on-surface-variant font-medium leading-relaxed border-l-2 border-outline-variant/30 pl-3">{obj.reason}</p>
                          {obj.teacher_reply && (
                            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                              <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-1">Teacher Response</p>
                              <p className="text-xs text-on-surface font-medium leading-relaxed">{obj.teacher_reply}</p>
                            </div>
                          )}
                          <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50">
                            Submitted {new Date(obj.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-surface-container-lowest border border-outline-variant/30 rounded-[2rem]">
              <span className="material-symbols-outlined text-[3rem] text-on-surface-variant/40 mb-4">hourglass_empty</span>
              <p className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
                {resultsMessage || "No result record found for this exam yet."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
