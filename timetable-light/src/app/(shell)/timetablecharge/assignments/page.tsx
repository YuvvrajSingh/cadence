"use client";

import { useEffect, useState } from "react";
import { teacherApi, subjectApi, classApi } from "@/lib/api";
import { useAcademicYear } from "@/contexts/academic-year-context";
import type { Teacher, Subject, ClassSection, TeacherSubject, ClassSubject } from "@/lib/types";
import DeveloperBadge from "@/components/DeveloperBadge";

type View = "teacher-subject" | "class-subject";

export default function AssignmentsPage() {
  const { selectedYear, isArchived, loading: yearLoading } = useAcademicYear();
  const [view, setView] = useState<View>("teacher-subject");
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [teacherSubjects, setTeacherSubjects] = useState<TeacherSubject[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [loading, setLoading] = useState(true);

  // Assign modal
  const [showAssign, setShowAssign] = useState(false);
  const [assignSubjectIds, setAssignSubjectIds] = useState<string[]>([]);
  const [subjectSearch, setSubjectSearch] = useState("");

  // Class filter inside the Teacher→Subject modal
  const [modalFilterClassId, setModalFilterClassId] = useState("");
  const [modalClassSubjectIds, setModalClassSubjectIds] = useState<string[] | null>(null);
  const [modalClassLoading, setModalClassLoading] = useState(false);

  useEffect(() => {
    if (yearLoading || !selectedYear) return;
    async function load() {
      try {
        const [t, s, c] = await Promise.all([
          teacherApi.list().catch(() => []),
          subjectApi.list().catch(() => []),
          classApi.list(selectedYear!.id).catch(() => []),
        ]);
        setTeachers(t);
        setSubjects(s);
        setClasses(c);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedYear, yearLoading]);

  async function loadTeacherSubjects(tId: string) {
    setSelectedTeacher(tId);
    const ts = await teacherApi.getSubjects(tId).catch(() => []);
    setTeacherSubjects(ts);
  }

  async function loadClassSubjects(cId: string) {
    setSelectedClass(cId);
    const cs = await classApi.getSubjects(cId).catch(() => []);
    setClassSubjects(cs);
  }

  async function handleModalClassFilter(classIdStr: string) {
    setModalFilterClassId(classIdStr);
    setAssignSubjectIds([]);
    if (!classIdStr) {
      setModalClassSubjectIds(null);
      return;
    }
    setModalClassLoading(true);
    try {
      const cs = await classApi.getSubjects(classIdStr).catch(() => []);
      setModalClassSubjectIds(cs.map((x: ClassSubject) => x.subjectId));
    } finally {
      setModalClassLoading(false);
    }
  }

  function closeAssignModal() {
    setShowAssign(false);
    setAssignSubjectIds([]);
    setSubjectSearch("");
    setModalFilterClassId("");
    setModalClassSubjectIds(null);
  }

  async function handleRemoveTS(teacherId: string, subjectId: string) {
    await teacherApi.removeSubject(teacherId, subjectId).catch(() => {});
    loadTeacherSubjects(teacherId);
  }

  async function handleRemoveCS(classId: string, subjectId: string) {
    await classApi.removeSubject(classId, subjectId).catch(() => {});
    loadClassSubjects(classId);
  }

  const filteredModalSubjects = (modalClassSubjectIds !== null
    ? subjects.filter((s) => modalClassSubjectIds.includes(s.id))
    : subjects
  ).filter(s => 
    s.name.toLowerCase().includes(subjectSearch.toLowerCase()) || 
    s.code.toLowerCase().includes(subjectSearch.toLowerCase())
  );

  const [assignGroups, setAssignGroups] = useState<Record<string, string[]>>({});

  const toggleSubject = (id: string, isLab: boolean) => {
    setAssignSubjectIds(prev => {
      const isRemoving = prev.includes(id);
      if (isRemoving) {
        const nextGroups = { ...assignGroups };
        delete nextGroups[id];
        setAssignGroups(nextGroups);
        return prev.filter(x => x !== id);
      } else {
        if (isLab) setAssignGroups(p => ({ ...p, [id]: ["A1"] })); // Default to A1
        return [...prev, id];
      }
    });
  };

  const toggleGroup = (subjectId: string, group: string) => {
    setAssignGroups(prev => {
      const current = prev[subjectId] || [];
      const next = current.includes(group)
        ? current.filter(g => g !== group)
        : [...current, group];
      return { ...prev, [subjectId]: next };
    });
  };

  const alreadyAssignedIds = new Set(
    (view === "teacher-subject" ? teacherSubjects : classSubjects).map(a => a.subjectId)
  );

  async function handleAssign() {
    if (assignSubjectIds.length === 0) return;
    try {
      if (view === "teacher-subject" && selectedTeacher) {
        const assignments = assignSubjectIds.map(id => ({
          subjectId: id,
          groups: assignGroups[id] || []
        }));
        await teacherApi.assignSubjectsBulk(selectedTeacher, assignments);
        loadTeacherSubjects(selectedTeacher);
      } else if (view === "class-subject" && selectedClass) {
        // Classes don't use teacher-specific groups for assignment records usually, 
        // but we'll follow the pattern. Class assignments are usually 1:1.
        const assignments = assignSubjectIds.map(id => ({ subjectId: id }));
        await classApi.assignSubjectsBulk(selectedClass, assignments.map(a => a.subjectId)); // Class API still old for now
        loadClassSubjects(selectedClass);
      }
      closeAssignModal();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error assigning");
    }
  }

  function calculateWorkload(assignments: (TeacherSubject | ClassSubject)[]) {
    return assignments.reduce((sum, a) => {
      const credit = a.subject?.creditHours || 0;
      if (a.subject?.type === "LAB" && "groups" in a) {
        const groupCount = (a as any).groups?.length || 1; // Default to 1 if not specified
        return sum + (credit * groupCount);
      }
      return sum + credit;
    }, 0);
  }

  return (
    <div className="max-w-7xl mx-auto w-full space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="space-y-1">
            <h2 className="text-3xl font-black tracking-tighter text-on-surface italic leading-none">Assignments</h2>
            <p className="text-on-surface-variant text-sm font-medium leading-none mt-1">
              Map teachers to subjects and subjects to class sections.
            </p>
          </div>
          <DeveloperBadge name="Yuvraj Singh" moduleName="Timetable" avatarInitials="YS" />
        </div>
        <div className="flex p-1 bg-surface-container-high rounded-lg">
          <button
            onClick={() => setView("teacher-subject")}
            className={`px-6 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
              view === "teacher-subject" ? "bg-surface-container-lowest text-secondary shadow-sm rounded-md" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Teacher → Subject
          </button>
          <button
            onClick={() => setView("class-subject")}
            className={`px-6 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
              view === "class-subject" ? "bg-surface-container-lowest text-secondary shadow-sm rounded-md" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Class → Subject
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Entity list */}
        <div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant mb-4">
            {view === "teacher-subject" ? "Select Teacher" : "Select Class"}
          </h3>
          <div className="space-y-2">
            {loading ? (
              <p className="text-sm text-on-surface-variant">Loading...</p>
            ) : view === "teacher-subject" ? (
              teachers.map((t) => (
                <button
                  key={t.id}
                  onClick={() => loadTeacherSubjects(t.id)}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    selectedTeacher === t.id ? "bg-secondary text-white" : "hover:bg-surface-container-lowest"
                  }`}
                >
                  <div className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold ${
                    selectedTeacher === t.id ? "bg-white/20 text-white" : "bg-primary-fixed text-on-primary-fixed"
                  }`}>
                    {t.abbreviation.slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{t.name}</p>
                    <p className={`text-[10px] ${selectedTeacher === t.id ? "text-white/60" : "text-on-surface-variant"}`}>{t.abbreviation}</p>
                  </div>
                </button>
              ))
            ) : (
              classes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => loadClassSubjects(c.id)}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    selectedClass === c.id ? "bg-secondary text-white" : "hover:bg-surface-container-lowest"
                  }`}
                >
                  <div className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold ${
                    selectedClass === c.id ? "bg-white/20 text-white" : "bg-primary-fixed text-on-primary-fixed"
                  }`}>
                    {c.branch?.name?.slice(0, 2) || "??"}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{c.branch?.name} Sem {c.semester}</p>
                    <p className={`text-[10px] ${selectedClass === c.id ? "text-white/60" : "text-on-surface-variant"}`}>Year {c.year} &nbsp;·&nbsp; Section ID: {c.id}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Assigned subjects */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-on-surface">Assigned Subjects</h3>
              {view === "teacher-subject" && selectedTeacher && (() => {
                const teacher = teachers.find(t => t.id === selectedTeacher);
                const current = teacherSubjects.reduce((sum, ts) => sum + (ts.subject?.creditHours || 0), 0);
                const limit = teacher?.workloadLimit || 18;
                const percentage = Math.min((current / limit) * 100, 100);
                const isOver = current > limit;

                return (
                  <div className="flex items-center gap-6 animate-in fade-in slide-in-from-top-1 duration-300">
                    <div className="flex flex-col gap-1.5 min-w-[180px]">
                      <div className="flex justify-between items-end">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isOver ? 'text-error' : 'text-on-surface-variant'}`}>
                          Workload Status
                        </span>
                        <span className={`text-xs font-black ${isOver ? 'text-error' : 'text-secondary'}`}>
                          {calculateWorkload(teacherSubjects)} / {limit} Hrs
                        </span>
                      </div>
                      <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden border border-outline-variant/10">
                        <div 
                          className={`h-full transition-all duration-500 ease-out ${isOver ? 'bg-error' : 'bg-gradient-to-r from-secondary to-secondary-container'}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Editable Limit Pill */}
                    <div className="relative group/limit">
                      <div className="absolute -top-3 left-2 px-1 bg-surface-container-lowest text-[8px] font-black uppercase tracking-widest text-outline z-10">
                        Max Limit
                      </div>
                      <div className="flex items-center bg-surface-container-low border border-outline-variant/20 rounded-lg overflow-hidden focus-within:border-secondary transition-colors h-10 shadow-sm">
                        <div className="pl-3 pr-1 text-outline-variant">
                          <span className="material-symbols-outlined text-sm">settings_input_component</span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          className="w-12 bg-transparent border-none text-sm font-black text-on-surface outline-none px-2 py-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          defaultValue={limit}
                          onBlur={async (e) => {
                            const newLimit = parseInt(e.target.value);
                            if (isNaN(newLimit) || newLimit < 0) return;
                            if (newLimit === limit) return;
                            try {
                              const updated = await teacherApi.update(selectedTeacher, { workloadLimit: newLimit });
                              setTeachers(prev => prev.map(t => t.id === selectedTeacher ? updated : t));
                            } catch (err) {
                              alert("Failed to update limit. Ensure backend is running.");
                            }
                          }}
                        />
                        <div className="pr-3 text-[10px] font-bold text-outline uppercase tracking-tight">
                          Hrs
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {view === "class-subject" && selectedClass && (
                <div className="flex items-center gap-1.5 px-4 py-2 bg-secondary/5 border border-secondary/10 rounded-full animate-in fade-in slide-in-from-top-1 duration-300">
                  <span className="material-symbols-outlined text-sm text-secondary">analytics</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-secondary">
                    Curriculum Credits: {classSubjects.reduce((sum, cs) => sum + (cs.subject?.creditHours || 0), 0)} Hrs
                  </span>
                </div>
              )}
            </div>
            {(selectedTeacher || selectedClass) && (
              <button
                onClick={() => setShowAssign(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-secondary to-secondary-container text-white text-xs font-bold uppercase tracking-wider rounded-md shadow-lg shadow-secondary/20 hover:scale-[1.02] transition-all"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Assign Subjects
              </button>
            )}
          </div>

          {!selectedTeacher && !selectedClass ? (
            <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-outline-variant/20 rounded-xl">
              <span className="material-symbols-outlined text-4xl text-outline-variant/40 mb-4">assignment_ind</span>
              <p className="text-sm font-bold text-on-surface-variant">Select an entity from the left</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(view === "teacher-subject" ? teacherSubjects : classSubjects).map((assignment) => {
                const sub = subjects.find((s) => s.id === assignment.subjectId);
                return (
                  <div
                    key={assignment.id}
                    className={`p-5 rounded-xl border-l-4 shadow-sm ${
                      sub?.type === "LAB" ? "border-on-tertiary-container bg-tertiary-fixed/10" : "border-secondary bg-secondary-fixed/10"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded ${
                        sub?.type === "LAB" ? "bg-tertiary-fixed text-on-tertiary-fixed-variant" : "bg-secondary/10 text-secondary"
                      }`}>
                        {sub?.code || "—"}
                      </span>
                      <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase ${
                        sub?.type === "LAB" ? "bg-tertiary-fixed text-on-tertiary-fixed-variant" : "bg-primary-fixed text-on-primary-fixed-variant"
                      }`}>
                        {sub?.type || "—"}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-on-surface mb-1">{sub?.name || "Unknown Subject"}</h4>
                    {sub?.type === "LAB" && view === "teacher-subject" && (assignment as TeacherSubject).groups && (
                      <div className="flex gap-1.5 mt-1">
                        {(assignment as TeacherSubject).groups.map((g: string) => (
                          <span key={g} className="px-1.5 py-0.5 rounded bg-tertiary/10 text-on-tertiary-container text-[9px] font-black">{g}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-outline-variant/10">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
                          {sub?.type === "LAB" && view === "teacher-subject"
                            ? `${(sub?.creditHours || 0) * ((assignment as TeacherSubject).groups?.length || 1)} Total Hrs`
                            : `${sub?.creditHours || 0} Credits`
                          }
                        </span>
                        {sub?.type === "LAB" && view === "teacher-subject" && (
                          <span className="text-[8px] font-bold text-outline uppercase tracking-tighter">
                            {sub?.creditHours} credits × {((assignment as TeacherSubject).groups?.length || 1)} groups
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (view === "teacher-subject" && selectedTeacher) handleRemoveTS(selectedTeacher, assignment.subjectId);
                          else if (view === "class-subject" && selectedClass) handleRemoveCS(selectedClass, assignment.subjectId);
                        }}
                        className="text-on-surface-variant hover:text-error transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">link_off</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Assign modal */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-on-surface/20 backdrop-blur-sm" onClick={closeAssignModal} />
          <div className="relative bg-surface-container-lowest p-8 rounded-xl shadow-2xl w-full max-w-md architectural-shadow border border-outline-variant/20">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-black tracking-tighter mb-1">Assign Subjects</h3>
                <p className="text-xs text-on-surface-variant font-medium">Select one or more subjects to link.</p>
              </div>
              {view === "teacher-subject" && selectedTeacher && (() => {
                const teacher = teachers.find(t => t.id === selectedTeacher);
                const current = calculateWorkload(teacherSubjects);
                const added = subjects
                  .filter(s => assignSubjectIds.includes(s.id))
                  .reduce((sum, s) => {
                    const base = s.creditHours || 0;
                    if (s.type === "LAB") {
                      const groupCount = assignGroups[s.id]?.length || 1;
                      return sum + (base * groupCount);
                    }
                    return sum + base;
                  }, 0);
                const total = current + added;
                const overLimit = teacher && total > teacher.workloadLimit;

                return (
                  <div className="text-right">
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${overLimit ? 'text-error' : 'text-on-surface-variant'}`}>
                      {overLimit ? 'Over Workload Limit' : 'Projected Workload'}
                    </p>
                    <div className="flex items-center gap-1 justify-end">
                      <span className="text-xs font-bold text-on-surface">
                        {current}
                      </span>
                      {added > 0 && (
                        <span className={`text-xs font-bold ${overLimit ? 'text-error' : 'text-secondary'}`}>
                          + {added}
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-outline uppercase mx-1">/</span>
                      <span className="text-xs font-bold text-on-surface">
                        {teacher?.workloadLimit || 18}
                      </span>
                      <span className="text-[10px] font-bold text-outline uppercase ml-0.5">Hrs</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="space-y-4">
              {view === "teacher-subject" && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Filter by Class</label>
                  <select
                    value={modalFilterClassId}
                    onChange={(e) => handleModalClassFilter(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg text-sm font-semibold p-3 outline-none focus:ring-2 focus:ring-secondary/20"
                  >
                    <option value="">All subjects</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.branch?.name} Sem {c.semester} (Year {c.year})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Search Subjects</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-outline">search</span>
                  <input
                    type="text"
                    placeholder="Search by code or name..."
                    value={subjectSearch}
                    onChange={(e) => setSubjectSearch(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg text-sm font-semibold p-3 pl-10 outline-none focus:ring-2 focus:ring-secondary/20"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Subjects ({assignSubjectIds.length} selected)
                  </label>
                  <button 
                    onClick={() => {
                      const selectableIds = filteredModalSubjects
                        .filter(s => !alreadyAssignedIds.has(s.id))
                        .map(s => s.id);
                      
                      if (assignSubjectIds.length === selectableIds.length && selectableIds.length > 0) {
                        setAssignSubjectIds([]);
                      } else {
                        setAssignSubjectIds(selectableIds);
                      }
                    }}
                    className="text-[10px] font-bold text-secondary uppercase tracking-widest hover:underline"
                  >
                    {assignSubjectIds.length > 0 && assignSubjectIds.length === filteredModalSubjects.filter(s => !alreadyAssignedIds.has(s.id)).length 
                      ? "Deselect All" : "Select All"}
                  </button>
                </div>
                
                <div className="max-h-60 overflow-y-auto pr-2 space-y-1 bg-surface-container-low/50 p-2 rounded-lg border border-outline-variant/10">
                  {modalClassLoading ? (
                    <div className="py-8 text-center">
                      <p className="text-xs font-bold text-on-surface-variant animate-pulse">Loading class subjects...</p>
                    </div>
                  ) : filteredModalSubjects.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-xs font-bold text-on-surface-variant">No subjects found</p>
                    </div>
                  ) : (
                    filteredModalSubjects.map((s) => {
                      const isSelected = assignSubjectIds.includes(s.id);
                      const isAlreadyAssigned = alreadyAssignedIds.has(s.id);
                      return (
                        <div 
                          key={s.id}
                          onClick={() => !isAlreadyAssigned && toggleSubject(s.id, s.type === "LAB")}
                          className={`flex items-center gap-3 p-2.5 rounded-md transition-all ${
                            isAlreadyAssigned ? "opacity-50 cursor-not-allowed bg-surface-container-high/30" : 
                            isSelected ? "bg-secondary/10 border-secondary/20 cursor-pointer" : "hover:bg-surface-container-high border-transparent cursor-pointer"
                          } border`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            isAlreadyAssigned ? "bg-outline-variant border-outline-variant" :
                            isSelected ? "bg-secondary border-secondary" : "border-outline"
                          }`}>
                            {(isSelected || isAlreadyAssigned) && <span className="material-symbols-outlined text-[12px] text-white font-black">check</span>}
                          </div>
                          <div className="grow overflow-hidden">
                            <div className="flex items-center justify-between">
                              <p className={`text-xs font-bold truncate ${isSelected ? "text-secondary" : "text-on-surface"}`}>{s.name}</p>
                              {isAlreadyAssigned && (
                                <span className="text-[8px] font-black uppercase tracking-tighter bg-outline-variant/20 text-outline-variant px-1.5 py-0.5 rounded ml-2 flex-shrink-0">
                                  Already Assigned
                                </span>
                              )}
                            </div>
                            <p className="text-[9px] font-bold text-outline uppercase tracking-tighter">{s.code} &nbsp;·&nbsp; {s.type}</p>
                            
                            {/* Group selection for Labs */}
                            {isSelected && s.type === "LAB" && (
                              <div 
                                className="mt-3 flex items-center gap-4 animate-in fade-in zoom-in-95 duration-200"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-[8px] font-black uppercase tracking-widest text-outline">Groups:</span>
                                {["A1", "A2", "A3"].map(g => (
                                  <label key={g} className="flex items-center gap-1.5 cursor-pointer group/grp">
                                    <input 
                                      type="checkbox"
                                      checked={(assignGroups[s.id] || []).includes(g)}
                                      onChange={() => toggleGroup(s.id, g)}
                                      className="hidden"
                                    />
                                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
                                      (assignGroups[s.id] || []).includes(g) 
                                        ? "bg-secondary border-secondary scale-110 shadow-sm shadow-secondary/30" 
                                        : "border-outline group-hover/grp:border-secondary/50"
                                    }`}>
                                      {(assignGroups[s.id] || []).includes(g) && <span className="material-symbols-outlined text-[10px] text-white font-black">check</span>}
                                    </div>
                                    <span className={`text-[10px] font-black tracking-tight transition-colors ${(assignGroups[s.id] || []).includes(g) ? "text-secondary" : "text-outline"}`}>{g}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={closeAssignModal} className="flex-1 py-3 border border-outline-variant/30 text-on-surface-variant font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-surface-container-high transition-colors">Cancel</button>
              <button 
                onClick={handleAssign} 
                disabled={assignSubjectIds.length === 0}
                className="flex-1 py-3 bg-secondary text-white font-bold text-xs uppercase tracking-widest rounded-lg shadow-lg shadow-secondary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                Assign {assignSubjectIds.length > 0 ? `(${assignSubjectIds.length})` : ""}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
