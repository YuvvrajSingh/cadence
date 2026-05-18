import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Updating all Lab subjects to 2 credit hours...");
  
  const result = await prisma.subject.updateMany({
    where: {
      type: "LAB"
    },
    data: {
      creditHours: 2
    }
  });

  console.log(`Successfully updated ${result.count} lab subjects.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
