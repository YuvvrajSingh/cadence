"use client";

import { useEffect, useRef, useState } from "react";
import { useAcademicYear } from "@/contexts/academic-year-context";
import { ImageCropper } from "@/components/image-cropper";
import DeveloperBadge from "@/components/DeveloperBadge";

type ActiveExam = {
  _id: string | number;
  exam_name?: string;
  subject: string;
  subject_name?: string;
  class_section: string;
  created_at?: string;
  total_marks?: number;
  year?: string;
  branch?: string;
  semester?: string;
  q_count?: number;
  academic_year?: string;
};

export default function TeacherMidtermPage() {
  const { selectedYear } = useAcademicYear();
  const [activeExams, setActiveExams] = useState<ActiveExam[]>([]);
  const [loading, setLoading] = useState(true);
  const academicYear = selectedYear?.label || "";

  // Create Mode state
  const [isCreating, setIsCreating] = useState(false);
  const [setupPhase, setSetupPhase] = useState<"init" | "questions" | "review">("init");
  const [createdExamId, setCreatedExamId] = useState<number | null>(null);

  // Phase 1 Form
  const [examName, setExamName] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branchName, setBranchName] = useState("");
  const [semester, setSemester] = useState("1");
  const [subjectCode, setSubjectCode] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [year, setYear] = useState("1");

  // Dropdown data
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; code: string; name: string }[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  // Phase 2 Form
  const [qNumber, setQNumber] = useState(1);
  const [qMarks, setQMarks] = useState(10);
  const [qText, setQText] = useState("");
  const [qModelAnswer, setQModelAnswer] = useState("");
  const [qDiagram, setQDiagram] = useState<File | null>(null);
  const [qDiagramUrl, setQDiagramUrl] = useState("");
  const [addedQuestions, setAddedQuestions] = useState<{
    number: number;
    marks: number;
    text: string;
    modelAnswer: string;
    diagram?: File | null;
    diagramUrl?: string;
  }[]>([]);

  const [creating, setCreating] = useState(false);

  // Assembly Line
  const [selectedExam, setSelectedExam] = useState<ActiveExam | null>(null);
  const [rollNumber, setRollNumber] = useState("");
  const [rollQueue, setRollQueue] = useState<string[]>([]);
  const [loadingRollQueue, setLoadingRollQueue] = useState(false);
  const [examQuestions, setExamQuestions] = useState<any[]>([]);
  const [showQuestions, setShowQuestions] = useState(false);
  const [questionNumbers, setQuestionNumbers] = useState<number[]>([1]);
  const [questionUploads, setQuestionUploads] = useState<Record<number, File[]>>({ 1: [] });
  const [uploading, setUploading] = useState(false);
  const [skipping, setSkipping] = useState(false);

  // Cropping flow state
  const [pendingCrops, setPendingCrops] = useState<{ q: number; files: File[] } | null>(null);
  const [currentCropIndex, setCurrentCropIndex] = useState(0);

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function parsePositiveIntOrFallback(raw: string, fallback: number) {
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  function resetAssemblyForm(exam: ActiveExam | null = selectedExam) {
    setRollNumber("");
    setRollQueue([]);

    const parsedCount = Number(exam?.q_count ?? 0);
    const questionCount = Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 0;
    const slots = Array.from({ length: questionCount }, (_, i) => i + 1);
    setQuestionNumbers(slots);
    setQuestionUploads(Object.fromEntries(slots.map((q) => [q, []])));
  }

  async function loadRollQueue(exam: ActiveExam) {
    const examId = String(exam._id).trim();
    if (!examId) return;

    setLoadingRollQueue(true);
    try {
      const [attendanceRes, submissionsRes] = await Promise.all([
        fetch(`/api/gradeai/teacher/get_attendance/${examId}`),
        fetch(`/api/gradeai/teacher/get_submissions/${examId}`),
      ]);

      const attendanceData = attendanceRes.ok ? await attendanceRes.json() : {};
      const submissionsData = submissionsRes.ok ? await submissionsRes.json() : {};

      const studentRows = Array.isArray(attendanceData?.students) ? attendanceData.students : [];
      const submittedRows = Array.isArray(submissionsData?.submitted_rolls) ? submissionsData.submitted_rolls : [];

      const studentRolls = studentRows
        .map((s: any) => {
          if (typeof s === "string") return s.trim().toUpperCase();
          return String(s?.roll_number ?? s?.rollNumber ?? s?.RollNo ?? s?.rollNo ?? "").trim().toUpperCase();
        })
        .filter((r: string) => Boolean(r));

      const submittedSet = new Set(
        submittedRows
          .map((r: any) => String(r ?? "").trim().toUpperCase())
          .filter((r: string) => Boolean(r))
      );

      const pending = studentRolls.filter((r: string, idx: number) => studentRolls.indexOf(r) === idx && !submittedSet.has(r));

      setRollQueue(pending);
      setRollNumber(pending[0] || "");
    } catch (err) {
      console.error(err);
      setRollQueue([]);
      setRollNumber("");
      setMessage({ type: "error", text: "Failed to load student roll queue for this exam." });
    } finally {
      setLoadingRollQueue(false);
    }
  }

  function advanceToNextRoll(doneRoll: string) {
    const normalizedDoneRoll = String(doneRoll || "").trim().toUpperCase();
    if (!normalizedDoneRoll) return;

    setRollQueue((prev) => {
      const nextQueue = prev.filter((r) => r !== normalizedDoneRoll);
      setRollNumber(nextQueue[0] || "");
      return nextQueue;
    });
  }

  async function loadExamQuestions(examId: string | number) {
    try {
      const res = await fetch(`/api/gradeai/teacher/exam-questions/${examId}`);
      if (res.ok) {
        const data = await res.json();
        setExamQuestions(data.questions || []);
      }
    } catch (err) {
      console.error(err);
    }
  }

  function handleQuestionFilesChange(questionNumber: number, files: FileList | null) {
    if (!files || files.length === 0) return;

    // Start crop flow
    setPendingCrops({ q: questionNumber, files: Array.from(files) });
    setCurrentCropIndex(0);
  }

  function onCropComplete(croppedFile: File) {
    if (!pendingCrops) return;

    const q = pendingCrops.q;
    setQuestionUploads((prev) => ({
      ...prev,
      [q]: [...(prev[q] || []), croppedFile],
    }));

    if (currentCropIndex < pendingCrops.files.length - 1) {
      setCurrentCropIndex(currentCropIndex + 1);
    } else {
      setPendingCrops(null);
      setCurrentCropIndex(0);
    }
  }

  function onCropCancel() {
    if (!pendingCrops) return;

    // Skip this specific photo but continue to next if any
    if (currentCropIndex < pendingCrops.files.length - 1) {
      setCurrentCropIndex(currentCropIndex + 1);
    } else {
      setPendingCrops(null);
      setCurrentCropIndex(0);
    }
  }

  useEffect(() => {
    fetchExams();
    fetchBranches();
  }, []);

  useEffect(() => {
    if (branchId && semester) fetchSubjects(branchId, semester);
  }, [branchId, semester]);

  async function fetchBranches() {
    try {
      const res = await fetch("/api/public/branches");
      if (res.ok) {
        const data = await res.json();
        setBranches(data);
        if (data.length > 0) {
          setBranchId(data[0].id);
          setBranchName(data[0].name);
        }
      }
    } catch { }
  }

  async function fetchSubjects(bId: string, sem: string) {
    setLoadingSubjects(true);
    setSubjectCode("");
    setSubjectName("");
    try {
      const res = await fetch(`/api/public/subjects-for-class?branchId=${bId}&semester=${sem}`);
      if (res.ok) {
        const data = await res.json();
        setSubjects(data);
        if (data.length > 0) { setSubjectCode(data[0].code); setSubjectName(data[0].name); }
      }
    } catch { } finally {
      setLoadingSubjects(false);
    }
  }


  async function fetchExams() {
    try {
      setLoading(true);
      const res = await fetch("/api/gradeai/teacher/active-exams");
      if (res.ok) {
        const data = await res.json();
        const exams = data.exams || [];
        setActiveExams(exams);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteExam(e: React.MouseEvent, examId: string | number) {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this exam and all its data? This action cannot be undone.")) return;

    try {
      const res = await fetch(`/api/gradeai/teacher/delete-exam/${examId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Exam deleted successfully." });
        fetchExams();
      } else {
        throw new Error("Failed to delete exam");
      }
    } catch (err) {
      setMessage({ type: "error", text: "Failed to delete exam." });
    }
  }

  const filteredExams = activeExams.filter((ex) => {
    if (!ex.academic_year) return true;
    if (!selectedYear) return true;
    if (ex.academic_year === selectedYear.label) return true;
    return ex.academic_year.startsWith(String(selectedYear.startYear));
  });

  function handlePreviousQuestion() {
    if (addedQuestions.length === 0) return;

    const prev = addedQuestions[addedQuestions.length - 1];
    setQNumber(prev.number);
    setQMarks(prev.marks);
    setQText(prev.text);
    setQModelAnswer(prev.modelAnswer);
    setQDiagram(prev.diagram || null);
    setQDiagramUrl(prev.diagramUrl || "");

    setAddedQuestions(prevList => prevList.slice(0, -1));
  }

  async function handleInitExam(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("exam_name", examName);
    formData.append("exam_type", "midterm");
    formData.append("branch", branchName);
    formData.append("semester", semester);
    formData.append("year", year);
    formData.append("subject", subjectCode);
    formData.append("subject_name", subjectName);

    try {
      const res = await fetch("/api/gradeai/teacher/create-exam", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to create exam");
      const data = await res.json();
      setCreatedExamId(data.exam_id);
      setSetupPhase("questions");
      setMessage({ type: "success", text: "Exam context established. Now add questions." });
    } catch (err) {
      setMessage({ type: "error", text: "Failed to initialize GradeAI assessment." });
    } finally {
      setCreating(false);
    }
  }

  async function handleAddQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!createdExamId) return;
    if (!Number.isFinite(qNumber) || qNumber < 1 || !Number.isFinite(qMarks) || qMarks < 1) {
      setMessage({ type: "error", text: "Question number and total marks must be valid positive numbers." });
      return;
    }
    setCreating(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("exam_id", createdExamId.toString());
    formData.append("question_number", qNumber.toString());
    formData.append("total_marks", qMarks.toString());
    formData.append("question_text", qText);
    formData.append("model_answer", qModelAnswer);
    if (qDiagram) {
      formData.append("diagram_image", qDiagram);
    }
    if (qDiagramUrl) {
      formData.append("diagram_url", qDiagramUrl);
    }

    try {
      const res = await fetch("/api/gradeai/teacher/add-question", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to add question");

      setAddedQuestions([...addedQuestions, {
        number: qNumber,
        marks: qMarks,
        text: qText,
        modelAnswer: qModelAnswer,
        diagram: qDiagram,
        diagramUrl: qDiagramUrl
      }]);
      setQNumber(qNumber + 1);
      setQText("");
      setQModelAnswer("");
      setQDiagram(null);
      setQDiagramUrl("");
      setMessage({ type: "success", text: `Question ${qNumber} added successfully.` });
    } catch (err) {
      setMessage({ type: "error", text: "Failed to add question." });
    } finally {
      setCreating(false);
    }
  }

  function handleFinishSetup() {
    setSetupPhase("review");
  }

  function deleteQuestion(index: number) {
    setAddedQuestions(prev => prev.filter((_, i) => i !== index));
  }

  function editQuestion(index: number) {
    const q = addedQuestions[index];
    setQNumber(q.number);
    setQMarks(q.marks);
    setQText(q.text);
    setQModelAnswer(q.modelAnswer);
    setQDiagram(q.diagram || null);
    setQDiagramUrl(q.diagramUrl || "");

    // Remove it from the list so it can be "re-added"
    setAddedQuestions(prev => prev.filter((_, i) => i !== index));
    setSetupPhase("questions");
  }

  function handleFinalizeExam() {
    setIsCreating(false);
    setSetupPhase("init");
    setCreatedExamId(null);
    setExamName("");
    setSubjectCode("");
    setSubjectName("");
    setAddedQuestions([]);
    setMessage({ type: "success", text: "Exam fully initialized and active." });
    fetchExams();
  }

  async function handleAssemblyUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedExam || !rollNumber.trim()) {
      setMessage({ type: "error", text: "Roll number is required." });
      return;
    }

    const totalQuestionFiles = questionNumbers.reduce(
      (sum, q) => sum + (questionUploads[q]?.length ?? 0),
      0
    );

    if (totalQuestionFiles === 0) {
      setMessage({ type: "error", text: "Attach at least one question image." });
      return;
    }
    if (questionNumbers.length === 0) {
      setMessage({ type: "error", text: "This exam has no configured questions yet." });
      return;
    }
    setUploading(true);
    setMessage(null);

    const examIdRaw = String(selectedExam._id).trim();
    const examId = Number(examIdRaw);
    const normalizedRoll = rollNumber.toUpperCase().trim();

    try {
      if (!Number.isFinite(examId)) {
        throw new Error("Invalid exam ID for upload");
      }

      const verifyRes = await fetch("/api/gradeai/student/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exam_id: examId,
          roll_number: normalizedRoll,
        }),
      });
      if (!verifyRes.ok) {
        throw new Error("Failed to verify student profile for question-wise upload");
      }

      const verifyData = await verifyRes.json();
      if (verifyData?.error) {
        throw new Error(String(verifyData.error));
      }

      const formData = new FormData();
      formData.append("exam_id", examIdRaw);
      formData.append("roll_number", normalizedRoll);
      formData.append("student_name", String(verifyData.name ?? ""));
      formData.append("year", String(verifyData.year ?? ""));
      formData.append("branch", String(verifyData.branch ?? ""));
      formData.append("email", String(verifyData.email ?? ""));

      // Compress images before upload
      const compressImage = async (file: File): Promise<File> => {
        if (file.type === "application/pdf") return file;
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = (e) => {
            const img = new Image();
            img.src = e.target?.result as string;
            img.onload = () => {
              const canvas = document.createElement("canvas");
              const MAX_WIDTH = 1200;
              const MAX_HEIGHT = 1600;
              let width = img.width;
              let height = img.height;

              if (width > height) {
                if (width > MAX_WIDTH) {
                  height *= MAX_WIDTH / width;
                  width = MAX_WIDTH;
                }
              } else {
                if (height > MAX_HEIGHT) {
                  width *= MAX_HEIGHT / height;
                  height = MAX_HEIGHT;
                }
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext("2d");
              if (!ctx) return resolve(file);

              ctx.drawImage(img, 0, 0, width, height);
              canvas.toBlob((blob) => {
                if (blob) {
                  resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: "image/jpeg" }));
                } else {
                  resolve(file);
                }
              }, "image/jpeg", 0.7);
            };
            img.onerror = () => resolve(file);
          };
          reader.onerror = () => resolve(file);
        });
      };

      for (const q of questionNumbers) {
        const files = questionUploads[q] ?? [];
        for (const file of files) {
          const processedFile = await compressImage(file);
          formData.append(`q_${q}`, processedFile, processedFile.name);
        }
      }

      const res = await fetch("/api/gradeai/public/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "Unknown error");
        console.error("Upload failed details:", res.status, errText);
        throw new Error(`Upload failed (${res.status}): ${errText.slice(0, 100)}`);
      }
      await res.json();
      setMessage({ type: "success", text: `Success: Evaluated ${normalizedRoll}` });
      advanceToNextRoll(normalizedRoll);
      setQuestionUploads(Object.fromEntries(questionNumbers.map((q) => [q, []])));
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Failed to process the answer sheet. Please try again.";
      setMessage({ type: "error", text: reason });
    } finally {
      setUploading(false);
    }
  }

  async function handleSkip() {
    if (!selectedExam || !rollNumber) {
      setMessage({ type: "error", text: "Roll number is required to mark absent." });
      return;
    }
    setSkipping(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("exam_id", String(selectedExam._id));
    formData.append("roll_number", rollNumber.toUpperCase());

    try {
      const res = await fetch("/api/gradeai/teacher/mark-absent", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to mark absent");
      setMessage({ type: "success", text: `Success: ${rollNumber.toUpperCase()} marked as absent.` });
      advanceToNextRoll(rollNumber.toUpperCase());
    } catch (err) {
      setMessage({ type: "error", text: "Failed to mark absent." });
    } finally {
      setSkipping(false);
    }
  }

  if (loading) return <div className="p-10 animate-pulse bg-surface-variant/20 rounded-[2rem] h-64"></div>;

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase leading-none">GradeAI Assessments</h1>
            <div className="flex items-center gap-3 mt-2">
              <p className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
                Automated Evaluation Pipeline
              </p>
              {academicYear && (
                <span className="text-[10px] font-black uppercase tracking-widest bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full">
                  AY {academicYear}
                </span>
              )}
            </div>
          </div>
          <DeveloperBadge name="Nakshatra Kataria" moduleName="Exam" avatarInitials="NK" />
        </div>
        {!selectedExam && !isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="bg-primary text-on-primary px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-base">add_task</span>
            Build New Exam
          </button>
        )}
      </header>

      {message && (
        <div className={`p-4 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${message.type === "success" ? "bg-primary-container text-on-primary-container" : "bg-error-container text-on-error-container"
          }`}>
          <span className="material-symbols-outlined">{message.type === "success" ? "check_circle" : "error"}</span>
          {message.text}
        </div>
      )}

      {isCreating ? (
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-[2rem] p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black uppercase">
              {setupPhase === "init" ? "Step 1: Exam Metadata" : setupPhase === "questions" ? `Step 2: Add Questions (Exam ID: ${createdExamId})` : "Step 3: Review & Publish"}
            </h2>
            {academicYear && (
              <span className="text-[10px] font-black uppercase tracking-widest bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full">
                AY {academicYear}
              </span>
            )}
          </div>

          {setupPhase === "init" ? (
            <form onSubmit={handleInitExam} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Exam Name</label>
                <input type="text" placeholder="e.g. Midterm 1" required value={examName} onChange={e => setExamName(e.target.value)}
                  className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Subject</label>
                {loadingSubjects ? (
                  <div className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface-variant animate-pulse">Loading subjects...</div>
                ) : subjects.length === 0 ? (
                  <div className="w-full bg-surface border border-error/30 rounded-xl px-4 py-3 text-xs text-error font-bold">No subjects found for this branch & semester</div>
                ) : (
                  <select required value={subjectCode}
                    onChange={e => {
                      setSubjectCode(e.target.value);
                      const s = subjects.find(s => s.code === e.target.value);
                      setSubjectName(s?.name ?? "");
                    }}
                    className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-primary"
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.code}>{s.code} — {s.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Branch</label>
                <select required value={branchId}
                  onChange={e => {
                    setBranchId(e.target.value);
                    const b = branches.find(b => b.id === e.target.value);
                    setBranchName(b?.name ?? "");
                  }}
                  className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-primary"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Semester</label>
                <input type="number" min="1" max="8" required value={semester} onChange={e => {
                  setSemester(e.target.value);
                  setYear(Math.ceil(parseInt(e.target.value || "1") / 2).toString());
                }}
                  className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Year</label>
                <input type="text" required value={year} disabled
                  className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm font-bold uppercase outline-none opacity-60"
                />
              </div>
              <div className="md:col-span-2 flex gap-4 md:col-start-2 justify-end mt-4">
                <button type="button" onClick={() => setIsCreating(false)} className="text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface">Cancel</button>
                <button type="submit" disabled={creating} className="bg-primary text-on-primary px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-50">
                  {creating ? "Saving..." : "Create & Next"}
                </button>
              </div>
            </form>
          ) : setupPhase === "questions" ? (
            <div className="space-y-8">
              {/* Visualizer for added questions */}
              {addedQuestions.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {addedQuestions.map((q, i) => (
                    <div key={i} className="bg-primary-container text-on-primary-container px-3 py-1 rounded-lg text-xs font-bold">
                      Q{q.number}: {q.marks}M
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddQuestion} className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border-2 border-dashed border-outline-variant/30 rounded-2xl bg-surface">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Question Number</label>
                  <input type="number" min="1" required value={qNumber} onChange={e => setQNumber(parsePositiveIntOrFallback(e.target.value, qNumber))}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Total Marks</label>
                  <input type="number" min="1" required value={qMarks} onChange={e => setQMarks(parsePositiveIntOrFallback(e.target.value, qMarks))}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Question Text</label>
                  <textarea placeholder="Write question here..." value={qText} onChange={e => setQText(e.target.value)}
                    className="w-full h-20 resize-none bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Model Answer</label>
                  <textarea required placeholder="Write the definitive model answer..." value={qModelAnswer} onChange={e => setQModelAnswer(e.target.value)}
                    className="w-full h-32 resize-none bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Reference Diagram (Optional)</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative group">
                      <input type="file" accept="image/*" onChange={e => {
                        setQDiagram(e.target.files?.[0] || null);
                        if (e.target.files?.[0]) setQDiagramUrl(""); // Clear URL if file selected
                      }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="border border-outline-variant/30 bg-surface-container-lowest rounded-xl py-3 px-4 flex items-center gap-3 text-sm text-on-surface-variant transition-colors group-hover:bg-surface-variant/30">
                        <span className="material-symbols-outlined text-xl">upload_file</span>
                        <span className="font-bold uppercase tracking-widest text-[10px] overflow-hidden text-ellipsis whitespace-nowrap">
                          {qDiagram ? qDiagram.name : "Upload Local Image"}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="Paste Image URL (Google/Web)"
                          value={qDiagramUrl}
                          onChange={e => {
                            setQDiagramUrl(e.target.value);
                            if (e.target.value) setQDiagram(null); // Clear file if URL provided
                          }}
                          className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 text-[10px] font-bold uppercase outline-none focus:ring-2 focus:ring-primary pr-10"
                        />
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-lg">link</span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const text = await navigator.clipboard.readText();
                            if (text.startsWith("http")) {
                              setQDiagramUrl(text);
                              setQDiagram(null);
                            }
                          } catch (err) {
                            console.error("Clipboard access denied");
                          }
                        }}
                        className="bg-surface-container-highest text-on-surface-variant px-3 rounded-xl hover:bg-primary/10 transition-colors"
                        title="Paste from Clipboard"
                      >
                        <span className="material-symbols-outlined text-lg">content_paste</span>
                      </button>
                    </div>
                  </div>

                  {(qDiagram || qDiagramUrl) && (
                    <div className="mt-2 p-2 border border-outline-variant/20 rounded-xl bg-surface-container-lowest flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-surface-variant overflow-hidden">
                        {qDiagram ? (
                          <img src={URL.createObjectURL(qDiagram)} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <img src={qDiagramUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src = "")} />
                        )}
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant flex-1 truncate">
                        {qDiagram ? `Local File: ${qDiagram.name}` : `URL: ${qDiagramUrl}`}
                      </p>
                      <button type="button" onClick={() => { setQDiagram(null); setQDiagramUrl(""); }} className="text-error hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-lg">close</span>
                      </button>
                    </div>
                  )}
                </div>
                <div className="md:col-span-2 flex justify-between items-center mt-2">
                  <button type="button" onClick={handlePreviousQuestion} disabled={addedQuestions.length === 0} className="text-xs font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2 hover:text-on-surface transition-colors disabled:opacity-30">
                    <span className="material-symbols-outlined text-base">arrow_back</span> Previous
                  </button>
                  <button type="submit" disabled={creating} className="bg-primary text-on-primary px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-sm hover:scale-95 transition-transform">
                    <span className="material-symbols-outlined">add</span> {creating ? "Saving..." : "Add Question"}
                  </button>
                </div>
              </form>

              <div className="flex justify-between items-center pt-4 border-t border-outline-variant/20">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Added {addedQuestions.length} Questions</p>
                <button type="button" onClick={handleFinishSetup} disabled={addedQuestions.length === 0} className="bg-secondary text-on-secondary px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-sm hover:scale-95 transition-transform disabled:opacity-50">
                  Review All Questions <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Verify details before final deployment</p>
                <button onClick={() => setSetupPhase("questions")} className="text-[10px] font-black uppercase tracking-widest bg-surface border border-outline-variant/30 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-surface-variant transition-colors">
                  <span className="material-symbols-outlined text-sm">edit_note</span> Back to Drafting
                </button>
              </div>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {addedQuestions.map((q, i) => (
                  <div key={i} className="bg-surface-container border border-outline-variant/20 rounded-2xl p-6 relative group">
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full">
                        Question {q.number} • {q.marks.toFixed(1)} Marks
                      </span>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => editQuestion(i)} className="p-2 text-on-surface-variant hover:text-primary transition-colors">
                          <span className="material-symbols-outlined text-xl">edit</span>
                        </button>
                        <button onClick={() => deleteQuestion(i)} className="p-2 text-on-surface-variant hover:text-error transition-colors">
                          <span className="material-symbols-outlined text-xl">delete</span>
                        </button>
                      </div>
                    </div>
                    <h4 className="text-sm font-bold uppercase tracking-tight text-on-surface mb-2">{q.text || "No question text provided"}</h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/10">
                        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Model Answer:</p>
                        <p className="text-xs font-medium text-on-surface">{q.modelAnswer}</p>
                      </div>

                      {(q.diagram || q.diagramUrl) && (
                        <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/10 flex items-center gap-4">
                          <div className="w-16 h-16 rounded-lg bg-surface-variant overflow-hidden shrink-0">
                            {q.diagram ? (
                              <img src={URL.createObjectURL(q.diagram)} alt="Diagram" className="w-full h-full object-cover" />
                            ) : (
                              <img src={q.diagramUrl} alt="Diagram" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Attached Diagram:</p>
                            <p className="text-[10px] font-bold text-on-surface truncate max-w-[150px]">
                              {q.diagram ? q.diagram.name : "Web Reference"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-8 border-t border-outline-variant/20">
                <button
                  onClick={handleFinalizeExam}
                  className="w-full bg-primary text-on-primary py-5 rounded-[1.5rem] text-sm font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:scale-[0.98] transition-all flex items-center justify-center gap-3"
                >
                  Finalize & Deploy Exam <span className="material-symbols-outlined text-xl">send</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : selectedExam ? (
        <div className="space-y-6">
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => {
                resetAssemblyForm(null);
                setSelectedExam(null);
              }}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span> Return to Assessment Registry
            </button>
          </div>

          <div className="bg-surface-container border border-outline-variant/30 rounded-[2rem] p-8 shadow-sm">
            <div className="flex justify-between items-center mb-8 border-b border-outline-variant/20 pb-6">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tight text-on-surface">{selectedExam.exam_name || selectedExam.subject}</h2>
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mt-1.5">{selectedExam.subject} • Active Grading Queue</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl font-black">robot_2</span>
              </div>
            </div>

            <form onSubmit={handleAssemblyUpload} className="space-y-6">
              <div className="flex flex-wrap gap-2 border-b border-outline-variant/10 pb-4">
                <button
                  type="button"
                  onClick={() => setShowQuestions(false)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!showQuestions ? "bg-primary text-on-primary shadow-lg shadow-primary/20" : "bg-surface-container-highest text-on-surface-variant hover:bg-primary/10"}`}
                >
                  Question-Wise Images
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuestions(true)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showQuestions ? "bg-primary text-on-primary shadow-lg shadow-primary/20" : "bg-surface-container-highest text-on-surface-variant hover:bg-primary/10"}`}
                >
                  View Exam Paper
                </button>
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant self-center ml-2">
                  {`${Number(selectedExam.q_count ?? 0)} questions configured`}
                </span>
              </div>

              {showQuestions ? (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar py-2">
                  {examQuestions.length === 0 ? (
                    <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant p-4 text-center">No questions found for this exam.</p>
                  ) : (
                    examQuestions.map((q, i) => (
                      <div key={i} className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6">
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full">
                            Question {q.question_number} • {q.total_marks.toFixed(1)} Marks
                          </span>
                        </div>
                        <h4 className="text-sm font-bold uppercase tracking-tight text-on-surface mb-3">{q.question_text || "No question text provided"}</h4>
                        <div className="bg-surface-container rounded-xl p-4 border border-outline-variant/10">
                          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Model Answer / Marking Key:</p>
                          <p className="text-xs font-medium text-on-surface whitespace-pre-wrap">{q.model_answer}</p>
                        </div>
                        {q.diagram_url && (
                          <div className="mt-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">Reference Visual:</p>
                            <img src={q.diagram_url} alt={`Diagram for Q${q.question_number}`} className="max-h-48 rounded-lg border border-outline-variant/20 shadow-sm" />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <>
                  <div className="grid gap-6 items-end grid-cols-1 md:grid-cols-[1fr_auto]">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Student Roll Number</label>
                      <input type="text" placeholder={loadingRollQueue ? "Loading roll queue..." : "e.g. 25UCSE3001"} required value={rollNumber} onChange={e => setRollNumber(e.target.value)}
                        className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-4 text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-primary"
                      />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        {loadingRollQueue
                          ? "Preparing pending roll list..."
                          : rollQueue.length > 0
                            ? `${rollQueue.length} pending in queue`
                            : "No pending rolls found for this exam"}
                      </p>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                      <button type="submit" disabled={uploading || skipping} className="bg-secondary text-on-secondary px-8 py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2 flex-1 h-[54px]">
                        {uploading ? <span className="material-symbols-outlined animate-spin-slow">sync</span> : <span className="material-symbols-outlined">send</span>}
                        {uploading ? "Evaluating..." : "Evaluate"}
                      </button>
                      <button type="button" onClick={handleSkip} disabled={uploading || skipping} className="bg-surface-variant text-on-surface-variant px-4 py-4 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-error hover:text-on-error transition-colors disabled:opacity-50 flex items-center justify-center gap-2 h-[54px]" title="Mark Absent & Skip">
                        <span className="material-symbols-outlined">person_off</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar pt-2">
                    {academicYear && !loadingRollQueue && rollQueue.length > 0 && !rollQueue.some(r => r.toUpperCase() === rollNumber.toUpperCase()) && (
                      <div className="bg-error-container/20 border border-error/30 p-4 rounded-xl flex items-center gap-3">
                        <span className="material-symbols-outlined text-error">warning</span>
                        <p className="text-[10px] font-black uppercase tracking-widest text-error">Roll Number not in pending queue</p>
                      </div>
                    )}
                    {questionNumbers.map((q) => (
                      <div key={q} className="grid grid-cols-1 md:grid-cols-[auto_1fr] items-center gap-3">
                        <div className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Q{q}</div>
                        <label className="relative border border-outline-variant/30 rounded-lg bg-surface px-4 py-3 cursor-pointer hover:bg-surface-variant/20 transition-colors flex items-center gap-3">
                          <span className="material-symbols-outlined text-on-surface-variant/40 text-lg">add_a_photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            capture="environment"
                            onChange={(e) => handleQuestionFilesChange(q, e.target.files)}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-on-surface-variant">
                            {questionUploads[q]?.length ? `${questionUploads[q].length} file(s) selected` : "Tap to capture or upload"}
                          </span>
                        </label>
                        {questionUploads[q]?.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setQuestionUploads(prev => ({ ...prev, [q]: [] }))}
                            className="p-2 text-error hover:bg-error/10 rounded-lg transition-colors"
                            title="Clear photos for this question"
                          >
                            <span className="material-symbols-outlined text-sm">delete_sweep</span>
                          </button>
                        )}
                      </div>
                    ))}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        {questionNumbers.reduce((sum, q) => sum + (questionUploads[q]?.length ?? 0), 0)} files selected
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        Fixed to {questionNumbers.length} question slot(s)
                      </p>
                    </div>
                  </div>
                </>
              )}
            </form>

            <div className="mt-8 p-4 rounded-xl bg-outline-variant/5 border border-outline-variant/10">
              <p className="text-[10px] font-medium leading-relaxed text-on-surface-variant max-w-2xl">
                <strong>Assembly Line Operation:</strong> Input the student's roll number and attach answer images/PDF per question slot. Do not reload the page between submissions. The AI engine will correlate answers against the established master key and register the score directly into the student ledger.
              </p>
            </div>
          </div>
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-outline-variant/40 rounded-[2rem]">
          <h3 className="text-xl font-black uppercase text-on-surface">Registry Empty</h3>
          <p className="text-sm text-on-surface-variant font-medium mt-2">Build a new exam for {selectedYear?.label} to begin operations.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExams.map(ex => (
            <div key={ex._id} onClick={() => { setSelectedExam(ex); resetAssemblyForm(ex); void loadRollQueue(ex); void loadExamQuestions(ex._id); }} className="bg-surface-container border border-outline-variant/30 rounded-[2rem] p-6 shadow-sm hover:shadow-md hover:border-primary/50 cursor-pointer transition-all group relative overflow-hidden">
              <div className="flex justify-between items-start mb-6">
                <div className="w-10 h-10 bg-surface-container-highest text-on-surface-variant rounded-xl flex items-center justify-center group-hover:bg-primary-container group-hover:text-on-primary-container transition-colors">
                  <span className="material-symbols-outlined text-lg">assignment</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-1 rounded">Active</span>
                  <button
                    onClick={(e) => handleDeleteExam(e, ex._id)}
                    className="p-1.5 rounded-lg text-on-surface-variant hover:bg-error/10 hover:text-error transition-colors"
                    title="Delete Exam"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-on-surface leading-none group-hover:text-primary transition-colors">{ex.exam_name || ex.subject_name || ex.subject}</h3>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 border-b border-outline-variant/20 pb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-[10px]">book</span> {ex.subject_name || ex.subject}
                </p>
                {ex.branch && (
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[10px]">school</span> {ex.branch}
                  </p>
                )}
                {ex.semester && (
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[10px]">calendar_today</span> Sem {ex.semester}
                  </p>
                )}
              </div>
              <div className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                <span className="material-symbols-outlined text-xs">open_in_new</span> Enter Assembly Line
              </div>
            </div>
          ))}
        </div>
      )}
      {/* ── Cropper Modal ── */}
      {pendingCrops && pendingCrops.files[currentCropIndex] && (
        <ImageCropper
          imageFile={pendingCrops.files[currentCropIndex]}
          onCrop={onCropComplete}
          onCancel={onCropCancel}
        />
      )}
    </div>
  );
}
