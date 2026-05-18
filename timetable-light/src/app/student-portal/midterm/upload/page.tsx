"use client";

import { useEffect, useState } from "react";
import { useAcademicYear } from "@/contexts/academic-year-context";
import DeveloperBadge from "@/components/DeveloperBadge";

type ActiveExam = {
  _id: string | number;
  exam_name?: string;
  subject?: string;
  q_count?: number;
  branch?: string;
  year?: string;
};

export default function StudentMidtermSubmitPage() {
  const { selectedYear } = useAcademicYear();
  const [profile, setProfile] = useState<any>(null);
  const [exams, setExams] = useState<ActiveExam[]>([]);
  const [selectedExam, setSelectedExam] = useState<ActiveExam | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Question-wise files state
  const [questionUploads, setQuestionUploads] = useState<Record<number, File[]>>({});

  useEffect(() => {
    fetch("/api/auth/student-me")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) throw new Error("No profile");
        const student = data.student ?? data;
        setProfile(student);
        // Fetch all active exams first
        return fetch(`/api/gradeai/teacher/active-exams`);
      })
      .then(res => res.ok ? res.json() : { exams: [] })
      .then(data => {
        const allExams = Array.isArray(data.exams) ? data.exams : [];
        // Filter by branch and year if needed, but for now let's show all and let student pick
        // (Usually we filter on backend, but let's be safe)
        setExams(allExams);
        if (allExams.length > 0) {
           handleExamSelect(allExams[0]);
        }
      })
      .catch(err => console.error("Error fetching data:", err))
      .finally(() => setLoading(false));
  }, []);

  function handleExamSelect(exam: ActiveExam) {
    setSelectedExam(exam);
    const slots = Array.from({ length: Number(exam.q_count || 1) }, (_, i) => i + 1);
    setQuestionUploads(Object.fromEntries(slots.map(q => [q, []])));
    setUploadMsg(null);
  }

  function handleFilesChange(qNum: number, files: FileList | null) {
    if (!files) return;
    const newFiles = Array.from(files);
    setQuestionUploads(prev => ({
      ...prev,
      [qNum]: [...(prev[qNum] || []), ...newFiles]
    }));
  }

  function removeFile(qNum: number, index: number) {
    setQuestionUploads(prev => ({
      ...prev,
      [qNum]: prev[qNum].filter((_, i) => i !== index)
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !selectedExam) return;

    const totalFiles = Object.values(questionUploads).reduce((sum, files) => sum + files.length, 0);
    if (totalFiles === 0) {
      setUploadMsg({ type: "error", text: "Please attach at least one image." });
      return;
    }

    setUploading(true);
    setUploadMsg(null);

    const formData = new FormData();
    formData.append("exam_id", String(selectedExam._id));
    formData.append("roll_number", profile.rollNumber);
    formData.append("student_name", profile.name || "");
    formData.append("year", profile.batch || profile.year || "");
    formData.append("branch", profile.classSection?.branch || profile.branch || "");
    formData.append("email", profile.email || "");

    // Add files
    Object.entries(questionUploads).forEach(([q, files]) => {
      files.forEach(file => {
        formData.append(`q_${q}`, file, file.name);
      });
    });

    try {
      const res = await fetch("/api/gradeai/public/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Upload failed. Please try again.");
      }

      setUploadMsg({ type: "success", text: "Submission successful! Your answers have been saved on the server." });
      // Reset files
      const slots = Array.from({ length: Number(selectedExam.q_count || 1) }, (_, i) => i + 1);
      setQuestionUploads(Object.fromEntries(slots.map(q => [q, []])));
    } catch (err: any) {
      setUploadMsg({ type: "error", text: err.message });
    } finally {
      setUploading(false);
    }
  }

  if (loading) return (
    <div className="p-10 space-y-4 animate-pulse">
      <div className="h-10 bg-surface-variant/30 rounded-xl w-1/3" />
      <div className="h-64 bg-surface-variant/20 rounded-[2rem] w-full" />
    </div>
  );

  if (!profile) return <div className="p-10 text-center">Failed to load profile. Please login again.</div>;

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <header className="text-center flex flex-col items-center gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-center gap-3">
          <h1 className="text-3xl font-black tracking-tighter uppercase leading-none">Midterm Submission</h1>
          <DeveloperBadge name="Nakshatra Kataria" moduleName="Exam" avatarInitials="NK" />
        </div>
        <p className="text-sm font-bold uppercase tracking-widest text-on-surface-variant leading-none mt-1">
          {profile.name} • {profile.rollNumber}
        </p>
      </header>

      {exams.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-outline-variant/40 rounded-[2rem] bg-surface-container-lowest">
          <span className="material-symbols-outlined text-[3rem] text-on-surface-variant/20 mb-4">event_busy</span>
          <h3 className="text-lg font-black uppercase">No Active Exams</h3>
          <p className="text-sm text-on-surface-variant font-medium mt-1">Check back later when an exam is active.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Exam Selection */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Select Exam</label>
            <div className="grid grid-cols-1 gap-2">
              {exams.map(ex => (
                <button
                  key={ex._id}
                  type="button"
                  onClick={() => handleExamSelect(ex)}
                  className={`px-4 py-3 rounded-xl text-left transition-all border ${
                    selectedExam?._id === ex._id
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-surface border-outline-variant/20 text-on-surface hover:bg-surface-variant/20"
                  }`}
                >
                  <div className="text-sm font-black uppercase">{ex.exam_name || ex.subject}</div>
                  <div className="text-[10px] font-bold opacity-60 uppercase tracking-widest">{ex.branch} • {ex.year}</div>
                </button>
              ))}
            </div>
          </div>

          {selectedExam && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Capture Answer Sheets</h3>
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {selectedExam.q_count} Questions
                </span>
              </div>

              <div className="space-y-3">
                {Array.from({ length: Number(selectedExam.q_count || 1) }, (_, i) => i + 1).map(qNum => (
                  <div key={qNum} className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 md:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="w-10 h-10 bg-surface-variant text-on-surface font-black rounded-lg flex items-center justify-center shrink-0">
                        Q{qNum}
                      </div>
                      
                      <div className="flex-1 space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {questionUploads[qNum]?.map((file, idx) => (
                            <div key={idx} className="relative group">
                              <div className="w-16 h-16 rounded-lg bg-primary/5 border border-primary/20 overflow-hidden">
                                <img 
                                  src={URL.createObjectURL(file)} 
                                  alt="Preview" 
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <button 
                                type="button"
                                onClick={() => removeFile(qNum, idx)}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-error text-on-error rounded-full flex items-center justify-center shadow-lg"
                              >
                                <span className="material-symbols-outlined text-[12px] font-bold">close</span>
                              </button>
                            </div>
                          ))}
                          
                          <label className="w-16 h-16 rounded-lg border-2 border-dashed border-outline-variant/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
                            <input 
                              type="file" 
                              accept="image/*" 
                              capture="environment"
                              multiple 
                              onChange={(e) => handleFilesChange(qNum, e.target.files)}
                              className="hidden" 
                            />
                            <span className="material-symbols-outlined text-on-surface-variant/40">add_a_photo</span>
                            <span className="text-[8px] font-black uppercase text-on-surface-variant/40 mt-1">Capture</span>
                          </label>
                        </div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                          {questionUploads[qNum]?.length || 0} images attached for this question
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploadMsg && (
            <div className={`p-4 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-3 ${
              uploadMsg.type === "success" ? "bg-primary-container text-on-primary-container" : "bg-error-container text-on-error-container"
            }`}>
              <span className="material-symbols-outlined">{uploadMsg.type === "success" ? "check_circle" : "error"}</span>
              {uploadMsg.text}
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              disabled={uploading || !selectedExam}
              className="w-full bg-on-surface text-surface py-5 rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {uploading ? (
                <>
                  <span className="material-symbols-outlined animate-spin">sync</span>
                  Uploading to Server...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">cloud_upload</span>
                  Submit Answer Sheets
                </>
              )}
            </button>
            <p className="text-center text-[10px] font-medium text-on-surface-variant mt-4 leading-relaxed px-4">
              Images will be saved directly to the central department database on the host PC. Please ensure all pages are clearly visible.
            </p>
          </div>
        </form>
      )}
    </div>
  );
}
