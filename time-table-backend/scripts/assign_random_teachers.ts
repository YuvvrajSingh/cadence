import { prisma } from "../src/prisma/client";

const ODD_SEMESTERS = [3, 5, 7];
const DEFAULT_WORKLOAD_LIMIT = 20;

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

async function ensureWorkloadLimits() {
  const teachers = await prisma.teacher.findMany({
    select: { id: true, workloadLimit: true },
  });

  const missing = teachers.filter((t) => (t as any).workloadLimit == null);
  if (!missing.length) return 0;

  await Promise.all(
    missing.map((t) =>
      prisma.teacher.update({
        where: { id: t.id },
        data: { workloadLimit: DEFAULT_WORKLOAD_LIMIT },
      }),
    ),
  );

  return missing.length;
}

async function main() {
  const updated = await ensureWorkloadLimits();

  const teachers = await prisma.teacher.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  if (!teachers.length) {
    throw new Error("No active teachers found.");
  }

  const classSections = await prisma.classSection.findMany({
    where: { semester: { in: ODD_SEMESTERS } },
    select: { id: true },
  });

  if (!classSections.length) {
    console.log("No class sections found for semesters:", ODD_SEMESTERS.join(", "));
    return;
  }

  const classSubjects = await prisma.classSubject.findMany({
    where: {
      classSectionId: { in: classSections.map((c) => c.id) },
      subject: { isActive: true },
    },
    select: { subjectId: true, subject: { select: { type: true } } },
  });

  const subjectMap = new Map<string, "THEORY" | "LAB">();
  classSubjects.forEach((cs) => {
    subjectMap.set(cs.subjectId, cs.subject.type);
  });

  const subjectIds = Array.from(subjectMap.keys());

  if (!subjectIds.length) {
    console.log("No active subjects found for odd semesters.");
    return;
  }

  const deleteResult = await prisma.teacherSubject.deleteMany({
    where: { subjectId: { in: subjectIds } },
  });

  const data = subjectIds.map((subjectId) => {
    const subjectType = subjectMap.get(subjectId);
    return {
      subjectId,
      teacherId: pickRandom(teachers).id,
      groups: subjectType === "LAB" ? ["A1", "A2", "A3"] : [],
    };
  });

  await prisma.teacherSubject.createMany({ data });

  console.log("Random teacher assignment complete.");
  console.log("Odd semesters:", ODD_SEMESTERS.join(", "));
  console.log("Subjects assigned:", subjectIds.length);
  console.log("Teachers available:", teachers.length);
  console.log("Existing assignments removed:", deleteResult.count);
  if (updated) {
    console.log("Teachers updated with workloadLimit:", updated);
  }
}

main()
  .catch((err) => {
    console.error("[assign_random_teachers] Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
