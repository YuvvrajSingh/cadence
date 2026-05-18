
import { PrismaClient, SubjectType } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  const jsonPath = path.resolve(__dirname, "../../../seed-subjects.json");
  if (!fs.existsSync(jsonPath)) {
    console.error("JSON file not found at", jsonPath);
    return;
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const academicYearLabel = data.academic_year; // "2026-27"

  // 1. Find Academic Year
  const ay = await prisma.academicYear.findUnique({
    where: { label: academicYearLabel },
  });

  if (!ay) {
    console.error(`Academic Year with label "${academicYearLabel}" not found in DB.`);
    return;
  }

  console.log(`Found Academic Year: ${ay.label} (ID: ${ay.id})`);

  let subjectsCreated = 0;
  let assignmentsCreated = 0;

  for (const branchData of data.branches) {
    const branchName = branchData.branch;
    
    // 2. Find Branch
    const branch = await prisma.branch.findUnique({
      where: { name: branchName },
    });

    if (!branch) {
      console.warn(`Branch "${branchName}" not found. Skipping.`);
      continue;
    }

    console.log(`Processing Branch: ${branchName}`);

    for (const semData of branchData.semesters) {
      const semStr = semData.semester; // e.g., "VII"
      
      // Map Roman numerals to numbers
      const semMap: Record<string, { semester: number, year: number }> = {
        "I": { semester: 1, year: 1 },
        "II": { semester: 2, year: 1 },
        "III": { semester: 3, year: 2 },
        "IV": { semester: 4, year: 2 },
        "V": { semester: 5, year: 3 },
        "VI": { semester: 6, year: 3 },
        "VII": { semester: 7, year: 4 },
        "VIII": { semester: 8, year: 4 },
      };

      const semInfo = semMap[semStr];
      if (!semInfo) {
        console.warn(`Unknown semester format "${semStr}". Skipping.`);
        continue;
      }

      // 3. Find or Create ClassSection
      const classSection = await prisma.classSection.upsert({
        where: {
          academicYearId_branchId_year_semester: {
            academicYearId: ay.id,
            branchId: branch.id,
            year: semInfo.year,
            semester: semInfo.semester,
          },
        },
        update: {},
        create: {
          academicYearId: ay.id,
          branchId: branch.id,
          year: semInfo.year,
          semester: semInfo.semester,
        },
      });

      console.log(`  Semester ${semStr} (ClassSection ID: ${classSection.id})`);

      for (const s of semData.subjects) {
        // 4. Upsert Subject
        const subject = await prisma.subject.upsert({
          where: { code: s.code },
          update: {
            name: s.name,
            abbreviation: s.abbreviation,
            creditHours: s.credits,
            type: s.type.toUpperCase() as SubjectType,
          },
          create: {
            code: s.code,
            name: s.name,
            abbreviation: s.abbreviation,
            creditHours: s.credits,
            type: s.type.toUpperCase() as SubjectType,
            isActive: true,
          },
        });

        subjectsCreated++;

        // 5. Assign Subject to ClassSection
        await prisma.classSubject.upsert({
          where: {
            classSectionId_subjectId: {
              classSectionId: classSection.id,
              subjectId: subject.id,
            },
          },
          update: {},
          create: {
            classSectionId: classSection.id,
            subjectId: subject.id,
          },
        });

        assignmentsCreated++;
        console.log(`    ✓ Assigned [${s.code}] ${s.name}`);
      }
    }
  }

  console.log(`\nFinished! Subjects upserted: ${subjectsCreated}, Assignments created: ${assignmentsCreated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
