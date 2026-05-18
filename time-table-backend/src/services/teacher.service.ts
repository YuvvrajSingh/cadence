import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client";
import { AppError } from "../utils/AppError";

const teacherInclude = {
  teacherSubjects: {
    include: {
      subject: true,
    },
  },
} satisfies Prisma.TeacherInclude;

const assertTeacherExists = async (teacherId: string) => {
  const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
  if (!teacher) {
    throw new AppError("Teacher not found", 404, "NOT_FOUND");
  }
};

export const teacherService = {
  listTeachers(includeInactive = false) {
    return prisma.teacher.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: "asc" },
    });
  },

  async getTeacherById(id: string) {
    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: teacherInclude,
    });

    if (!teacher) {
      throw new AppError("Teacher not found", 404, "NOT_FOUND");
    }

    return teacher;
  },

  createTeacher(data: { name: string; abbreviation: string }) {
    return prisma.teacher.create({ data: { ...data, isActive: true } });
  },

  async updateTeacher(id: string, data: { name?: string; abbreviation?: string; workloadLimit?: number }) {
    await assertTeacherExists(id);
    return prisma.teacher.update({ where: { id }, data });
  },

  async deleteTeacher(id: string) {
    await assertTeacherExists(id);
    // Hard delete is blocked by Restrict on LabGroupEntry if the teacher has active lab entries.
    // Use deactivateTeacher for safe archival instead.
    await prisma.teacher.delete({ where: { id } });
  },

  async deactivateTeacher(id: string) {
    await assertTeacherExists(id);
    const teacher = await prisma.teacher.update({ where: { id }, data: { isActive: false } });
    await prisma.user.updateMany({
      where: { teacherId: id },
      data: { isActive: false },
    });
    return teacher;
  },

  async reactivateTeacher(id: string) {
    await assertTeacherExists(id);
    const teacher = await prisma.teacher.update({ where: { id }, data: { isActive: true } });
    await prisma.user.updateMany({
      where: { teacherId: id },
      data: { isActive: true },
    });
    return teacher;
  },

  async assignSubject(teacherId: string, subjectId: string) {
    await assertTeacherExists(teacherId);

    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) {
      throw new AppError("Subject not found", 404, "NOT_FOUND");
    }

    const existing = await prisma.teacherSubject.findUnique({
      where: { teacherId_subjectId: { teacherId, subjectId } },
    });

    if (existing) {
      throw new AppError("Subject already assigned to teacher", 409, "CONFLICT");
    }

    return prisma.teacherSubject.create({
      data: {
        teacherId,
        subjectId,
      },
    });
  },

  async assignSubjectsBulk(teacherId: string, assignments: { subjectId: string; groups?: string[] }[]) {
    await assertTeacherExists(teacherId);

    const operations = assignments.map((assignment) => 
      prisma.teacherSubject.upsert({
        where: { teacherId_subjectId: { teacherId, subjectId: assignment.subjectId } },
        update: { groups: assignment.groups || [] },
        create: {
          teacherId,
          subjectId: assignment.subjectId,
          groups: assignment.groups || [],
        },
      })
    );

    return prisma.$transaction(operations);
  },

  async removeSubject(teacherId: string, subjectId: string) {
    await assertTeacherExists(teacherId);

    const existing = await prisma.teacherSubject.findUnique({
      where: { teacherId_subjectId: { teacherId, subjectId } },
    });

    if (!existing) {
      throw new AppError("Teacher-subject assignment not found", 404, "NOT_FOUND");
    }

    await prisma.teacherSubject.delete({ where: { id: existing.id } });
  },

  async getTeacherSubjects(teacherId: string) {
    await assertTeacherExists(teacherId);

    return prisma.teacherSubject.findMany({
      where: { teacherId },
      include: { subject: true },
      orderBy: { id: "asc" },
    });
  },

  async getTeacherSchedule(teacherId: string) {
    await assertTeacherExists(teacherId);

    return prisma.timetableEntry.findMany({
      where: { teacherId },
      include: {
        classSection: {
          include: {
            branch: true,
          },
        },
        subject: true,
        room: true,
      },
      orderBy: [{ day: "asc" }, { slot: { order: "asc" } }],
    });
  },
};
