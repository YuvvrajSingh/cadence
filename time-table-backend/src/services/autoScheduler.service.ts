import { PrismaClient, TimetableEntryType, AcademicYearStatus, NotificationLogType } from "@prisma/client";
import { prisma } from "../prisma/client";
import { AppError } from "../utils/AppError";
import { LAB_GROUPS } from "../utils/timetableConstants";
import { getParitySemesterList } from "../utils/semesterParity";

export const autoSchedulerService = {
  async generateTimetable(classSectionId: string) {
    // 1. Fetch class data and requirements
    const classSection = await prisma.classSection.findUnique({
      where: { id: classSectionId },
      include: { 
        branch: true,
        subjects: { include: { subject: true } } 
      },
    });

    if (!classSection) throw new AppError("Class section not found", 404, "NOT_FOUND");

    const academicYear = await prisma.academicYear.findUnique({ where: { id: classSection.academicYearId } });
    if (!academicYear) throw new AppError("Academic year not found", 404, "NOT_FOUND");
    if (academicYear.status === AcademicYearStatus.ARCHIVED) {
      throw new AppError("Cannot generate timetable for an archived academic year", 403, "FORBIDDEN");
    }
    const academicYearId = classSection.academicYearId;

    const classSubjects = classSection.subjects.map((cs) => cs.subject!);
    if (classSubjects.length === 0) {
      throw new AppError("No subjects assigned to this class section", 400, "VALIDATION_ERROR");
    }

    // 2. Fetch Slot table and build the orderToId lookup map
    // The scheduler works internally with slot order integers (1–6), same as before.
    // When writing to DB, it uses slotOrderToId[order] to get the FK.
    const allSlots = await prisma.slot.findMany({ orderBy: { order: "asc" } });
    const slotOrderToId = new Map<number, string>(allSlots.map((s) => [s.order, s.id]));

    const resolveSlotId = (order: number): string => {
      const id = slotOrderToId.get(order);
      if (!id) throw new AppError(`Slot order ${order} not found in DB`, 500, "INTERNAL_ERROR");
      return id;
    };

    // 3. Fetch Global Resources and Relationships
    const allTeachers = await prisma.teacher.findMany({
      where: { isActive: true },
      include: { teacherSubjects: true },
    });
    const allRooms = await prisma.room.findMany();
    const allLabs = await prisma.lab.findMany();

    // subjectId → available teacherIds
    const teacherMap = new Map<string, string[]>();
    for (const t of allTeachers) {
      for (const ts of t.teacherSubjects) {
        if (!teacherMap.has(ts.subjectId)) teacherMap.set(ts.subjectId, []);
        teacherMap.get(ts.subjectId)!.push(t.id);
      }
    }

    // 4. Global Occupancy & Workload Matrices
    const teacherOcc: Record<string, Record<number, Record<number, boolean>>> = {};
    const roomOcc: Record<string, Record<number, Record<number, boolean>>> = {};
    const labOcc: Record<string, Record<number, Record<number, boolean>>> = {};
    
    const teacherWorkload = new Map<string, number>();
    const teacherLimit = new Map<string, number>();
    const workloadUnit = 1;

    for (const t of allTeachers) {
      teacherOcc[t.id] = { 1:{}, 2:{}, 3:{}, 4:{}, 5:{}, 6:{} };
      teacherWorkload.set(t.id, 0);
      teacherLimit.set(t.id, t.workloadLimit || 20);
    }
    for (const r of allRooms) roomOcc[r.id] = { 1:{}, 2:{}, 3:{}, 4:{}, 5:{}, 6:{} };
    for (const l of allLabs) labOcc[l.id] = { 1:{}, 2:{}, 3:{}, 4:{}, 5:{}, 6:{} };

    // Fetch existing entries EXCLUDING the current class but WITHIN the same academic year.
    const existingEntries = await prisma.timetableEntry.findMany({
      where: {
        classSectionId: { not: classSectionId },
        classSection: {
          academicYearId,
          semester: {
            in: getParitySemesterList(classSection.semester),
          },
        },
      },
      include: { slot: true, labGroups: true, subject: true },
    });

    for (const entry of existingEntries) {
      const d = entry.day;
      const startOrder = entry.slot.order;
      const slotOrders = entry.entryType === "LAB"
        ? [startOrder, startOrder + 1]
        : [startOrder];

      for (const s of slotOrders) {
        if (entry.entryType === "LAB") {
          for (const lg of entry.labGroups) {
            if (teacherOcc[lg.teacherId]) {
              teacherOcc[lg.teacherId][d][s] = true;
            }
            if (labOcc[lg.labId]) labOcc[lg.labId][d][s] = true;
          }
        } else {
          if (entry.teacherId && teacherOcc[entry.teacherId]) {
            teacherOcc[entry.teacherId][d][s] = true;
          }
          if (entry.roomId && roomOcc[entry.roomId]) roomOcc[entry.roomId][d][s] = true;
        }
      }
      if (entry.entryType === "LAB") {
        const uniqueTeachers = new Set(entry.labGroups.map((lg) => lg.teacherId));
        for (const tId of uniqueTeachers) {
          if (!teacherOcc[tId]) continue;
          const current = teacherWorkload.get(tId) || 0;
          teacherWorkload.set(tId, current + workloadUnit);
        }
      } else if (entry.teacherId && teacherOcc[entry.teacherId]) {
        const current = teacherWorkload.get(entry.teacherId) || 0;
        teacherWorkload.set(entry.teacherId, current + workloadUnit);
      }
    }

    // 5. Build work queues for the chosen class
    const unplacedTheories = classSubjects
      .filter((s) => s.type === "THEORY")
      .map((s) => ({ subject: s, remaining: s.creditHours }));

    const auditReport: string[] = [];

    // Sync Lab requirements with Teacher Assignments
    const labNeeds: { groupName: string; subject: any; preferredTeacherId: string }[] = [];
    for (const subj of classSubjects.filter((s) => s.type === "LAB")) {
      const assignments = allTeachers.flatMap(t => 
        t.teacherSubjects
          .filter(ts => ts.subjectId === subj.id)
          .map(ts => ({ teacherId: t.id, groups: ts.groups }))
      );

      if (assignments.length === 0) {
        auditReport.push(`Note: No teacher assigned to groups for lab ${subj.name}. Skipping auto-sync for this subject.`);
      }

      for (const ass of assignments) {
        for (const groupName of ass.groups) {
          labNeeds.push({ groupName, subject: subj, preferredTeacherId: ass.teacherId });
        }
      }
    }

    const generatedTheoryPayloads: any[] = [];
    const generatedLabPayloads: any[] = [];

    // Local occupancy tracker for this class
    const classOcc: Record<number, Record<number, boolean>> = { 1:{}, 2:{}, 3:{}, 4:{}, 5:{}, 6:{} };
    const subjectsToday: Record<number, Record<string, number>> = { 1:{}, 2:{}, 3:{}, 4:{}, 5:{}, 6:{} };

    const validLabStarts = [1, 2, 4, 5];

    const findFreeRoom = (d: number, s: number) =>
      allRooms.find((r) => !roomOcc[r.id][d][s]);

    const findFreeTeacher = (subjectId: string, d: number, s: number, credit: number) => {
      const candidates = teacherMap.get(subjectId) || [];
      return candidates.find((tId) => {
        if (teacherOcc[tId][d][s]) return false;
        const current = teacherWorkload.get(tId) || 0;
        const limit = teacherLimit.get(tId) || 18;
        return (current + credit <= limit);
      });
    };

    const tryPlaceLab = (d: number, s: number): boolean => {
      const selectedNeeds: any[] = [];
      const usedGroups = new Set<string>();
      const assignedLabs = new Set<string>();
      const assignedTeachers = new Set<string>();

      for (let i = 0; i < labNeeds.length; i++) {
        const need = labNeeds[i];
        if (usedGroups.has(need.groupName)) continue;

        const tId = need.preferredTeacherId;
        const currentW = teacherWorkload.get(tId) || 0;
        const limit = teacherLimit.get(tId) || 20;

        if (currentW + workloadUnit > limit) continue;

        const isTeacherFree = !teacherOcc[tId][d][s] && !teacherOcc[tId][d][s + 1] && !assignedTeachers.has(tId);
        if (!isTeacherFree) continue;

        const lab = allLabs.find(
          (l) => !labOcc[l.id][d][s] && !labOcc[l.id][d][s + 1] && !assignedLabs.has(l.id),
        );

        if (lab) {
          selectedNeeds.push({ needId: i, ...need, teacherId: tId, labId: lab.id });
          usedGroups.add(need.groupName);
          assignedTeachers.add(tId);
          assignedLabs.add(lab.id);
          if (selectedNeeds.length === 2) break;
        }
      }

      if (selectedNeeds.length === 0) return false;

      generatedLabPayloads.push({
        classSectionId,
        day: d,
        slotOrder: s,
        entryType: "LAB",
        labGroups: selectedNeeds.map((n) => ({
          groupName: n.groupName,
          subjectId: n.subject.id,
          labId: n.labId,
          teacherId: n.teacherId,
        })),
      });

      for (const n of selectedNeeds) {
        const tId = n.teacherId;
        teacherOcc[tId][d][s] = true;
        teacherOcc[tId][d][s + 1] = true;
        labOcc[n.labId][d][s] = true;
        labOcc[n.labId][d][s + 1] = true;

        const current = teacherWorkload.get(tId) || 0;
        teacherWorkload.set(tId, current + workloadUnit);
      }
      classOcc[d][s] = true;
      classOcc[d][s + 1] = true;

      const indicesToRemove = selectedNeeds.map((n) => n.needId).sort((a, b) => b - a);
      for (const idx of indicesToRemove) labNeeds.splice(idx, 1);

      return true;
    };

    // 6. Algorithm Core (two-pass: strict then relaxed)
    for (const relaxed of [false, true]) {
      for (const d of [1, 2, 3, 4, 5, 6]) {
        for (const s of [1, 2, 3, 4, 5, 6]) {
          if (classOcc[d][s]) continue;

          // Attempt LAB placement (max two groups per slot pair)
          if (validLabStarts.includes(s) && labNeeds.length > 0 && !classOcc[d][s + 1]) {
            if (tryPlaceLab(d, s)) {
              continue;
            }
          }

          // Attempt THEORY placement
          for (let i = 0; i < unplacedTheories.length; i++) {
            const theory = unplacedTheories[i];
            const alreadyToday = subjectsToday[d][theory.subject.id] || 0;

            if (!relaxed && alreadyToday >= 1) continue;

            const room = findFreeRoom(d, s);
            const teacherId = findFreeTeacher(theory.subject.id, d, s, workloadUnit);

            if (room && teacherId) {
              generatedTheoryPayloads.push({
                classSectionId,
                day: d,
                slotOrder: s,
                entryType: "LECTURE",
                subjectId: theory.subject.id,
                roomId: room.id,
                teacherId,
              });

              roomOcc[room.id][d][s] = true;
              teacherOcc[teacherId][d][s] = true;
              classOcc[d][s] = true;

              // Update workload
              const current = teacherWorkload.get(teacherId) || 0;
              teacherWorkload.set(teacherId, current + workloadUnit);

              subjectsToday[d][theory.subject.id] = alreadyToday + 1;
              theory.remaining--;
              if (theory.remaining === 0) unplacedTheories.splice(i, 1);

              break;
            }
          }
        }
      }
    }

    // 6b. Lab-only retry pass to reduce leftover lab groups
    if (labNeeds.length > 0) {
      for (const d of [1, 2, 3, 4, 5, 6]) {
        for (const s of validLabStarts) {
          if (labNeeds.length === 0) break;
          if (classOcc[d][s] || classOcc[d][s + 1]) continue;
          tryPlaceLab(d, s);
        }
        if (labNeeds.length === 0) break;
      }
    }

    // 6c. Limited backtracking for leftover theory slots (single-swap repair)
    const findRelocationSlot = (teacherId: string, roomId: string) => {
      for (const d of [1, 2, 3, 4, 5, 6]) {
        for (const s of [1, 2, 3, 4, 5, 6]) {
          if (classOcc[d][s]) continue;
          if (teacherOcc[teacherId]?.[d]?.[s]) continue;
          if (roomOcc[roomId]?.[d]?.[s]) continue;
          return { d, s };
        }
      }
      return null;
    };

    for (const theory of unplacedTheories) {
      while (theory.remaining > 0) {
        let placed = false;

        for (let i = 0; i < generatedTheoryPayloads.length; i++) {
          const existing = generatedTheoryPayloads[i];
          const oldDay = existing.day as number;
          const oldSlot = existing.slotOrder as number;
          const oldTeacherId = existing.teacherId as string;
          const oldRoomId = existing.roomId as string;

          // Temporarily free the existing slot
          classOcc[oldDay][oldSlot] = false;
          teacherOcc[oldTeacherId][oldDay][oldSlot] = false;
          roomOcc[oldRoomId][oldDay][oldSlot] = false;

          const relocate = findRelocationSlot(oldTeacherId, oldRoomId);
          if (!relocate) {
            // Restore and continue
            classOcc[oldDay][oldSlot] = true;
            teacherOcc[oldTeacherId][oldDay][oldSlot] = true;
            roomOcc[oldRoomId][oldDay][oldSlot] = true;
            continue;
          }

          // Try placing the missing theory in the freed slot
          const newTeacherId = findFreeTeacher(theory.subject.id, oldDay, oldSlot, workloadUnit);
          const newRoom = findFreeRoom(oldDay, oldSlot);

          if (!newTeacherId || !newRoom) {
            // Restore and continue
            classOcc[oldDay][oldSlot] = true;
            teacherOcc[oldTeacherId][oldDay][oldSlot] = true;
            roomOcc[oldRoomId][oldDay][oldSlot] = true;
            continue;
          }

          // Commit relocation for existing entry
          existing.day = relocate.d;
          existing.slotOrder = relocate.s;
          classOcc[relocate.d][relocate.s] = true;
          teacherOcc[oldTeacherId][relocate.d][relocate.s] = true;
          roomOcc[oldRoomId][relocate.d][relocate.s] = true;

          // Commit placement for missing theory
          generatedTheoryPayloads.push({
            classSectionId,
            day: oldDay,
            slotOrder: oldSlot,
            entryType: "LECTURE",
            subjectId: theory.subject.id,
            roomId: newRoom.id,
            teacherId: newTeacherId,
          });
          classOcc[oldDay][oldSlot] = true;
          teacherOcc[newTeacherId][oldDay][oldSlot] = true;
          roomOcc[newRoom.id][oldDay][oldSlot] = true;

          const current = teacherWorkload.get(newTeacherId) || 0;
          teacherWorkload.set(newTeacherId, current + workloadUnit);

          theory.remaining--;
          placed = true;
          break;
        }

        if (!placed) break;
      }
    }

    // 7. Report Unplaced Components
    if (labNeeds.length > 0) {
      auditReport.push(`Warning: Could not schedule ${labNeeds.length} individual lab group requirements due to lack of teachers/labs/workload.`);
      for (const n of labNeeds) {
        const tId = n.preferredTeacherId;
        const currentW = teacherWorkload.get(tId) || 0;
        const limit = teacherLimit.get(tId) || 20;
        const overLimit = currentW + workloadUnit > limit;
        auditReport.push(`- Skipped Lab: Group ${n.groupName} for ${n.subject.name} (${overLimit ? 'Teacher Workload Full' : 'Resource Conflict'})`);
      }
    }

    const failedTheories = unplacedTheories.filter((t) => t.remaining > 0);
    if (failedTheories.length > 0) {
      auditReport.push("Warning: Could not schedule the following theory hours due to Teacher/Room/Workload conflicts:");
      for (const t of failedTheories) auditReport.push(`- ${t.subject.name}: Missed ${t.remaining} periods.`);
    }

    // 7b. Guard against duplicate slot assignments (defensive safety)
    const slotKeys = new Set<string>();
    const dropped: string[] = [];

    const dedupeBySlot = (payloads: any[], label: string) => {
      const kept: any[] = [];
      for (const p of payloads) {
        const key = `${p.day}:${p.slotOrder}`;
        if (slotKeys.has(key)) {
          dropped.push(`${label} ${p.day}/${p.slotOrder}`);
          continue;
        }
        slotKeys.add(key);
        kept.push(p);
      }
      return kept;
    };

    const dedupedLabs = dedupeBySlot(generatedLabPayloads, "LAB");
    const dedupedTheories = dedupeBySlot(generatedTheoryPayloads, "THEORY");

    if (dropped.length > 0) {
      auditReport.push(`Warning: Dropped ${dropped.length} duplicate slot assignments.`);
    }

    if (auditReport.length === 0) {
      auditReport.push(
        `Success! 100% of required classes scheduled. Generated ${generatedTheoryPayloads.length} theory slots and ${generatedLabPayloads.length} lab blocks.`,
      );
    }

    // 8. Write to Database (Transaction)
    await prisma.$transaction(async (tx) => {
      await tx.timetableEntry.deleteMany({ where: { classSectionId } });

      if (dedupedTheories.length > 0) {
        await tx.timetableEntry.createMany({
          data: dedupedTheories.map((p) => ({
            classSectionId: p.classSectionId,
            day: p.day,
            slotId: resolveSlotId(p.slotOrder),
            entryType: p.entryType,
            subjectId: p.subjectId,
            roomId: p.roomId,
            teacherId: p.teacherId,
          })),
        });
      }

      for (const lab of dedupedLabs) {
        await tx.timetableEntry.create({
          data: {
            classSectionId: lab.classSectionId,
            day: lab.day,
            slotId: resolveSlotId(lab.slotOrder),
            entryType: lab.entryType,
            labGroups: { create: lab.labGroups },
          },
        });
      }
    });
    
    // 9. Log activity summary
    await prisma.notificationLog.create({
      data: {
        type: NotificationLogType.ENTRY_CREATED,
        performedBy: "Auto-Scheduler",
        message: `Timetable auto-generated for ${classSection.branch?.name ?? "Class"} Year ${classSection.year} — ${generatedTheoryPayloads.length} lectures and ${generatedLabPayloads.length} labs created.`,
        date: new Date(),
        metadata: {
          classSectionId,
          lecturesCount: generatedTheoryPayloads.length,
          labsCount: generatedLabPayloads.length,
          auditReport,
        },
      },
    });

    return { success: true, auditReport };
  },
};
