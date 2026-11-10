import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Demo accounts so stats/history views have data in a fresh development database.
const demoUsers = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    nickname: "DemoRed",
    wins: 3,
    losses: 1,
    sequences: 7,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    nickname: "DemoBlue",
    wins: 1,
    losses: 3,
    sequences: 4,
  },
];

async function main() {
  for (const u of demoUsers) {
    await prisma.user.upsert({
      where: { id: u.id },
      create: { id: u.id, nickname: u.nickname },
      update: { nickname: u.nickname },
    });
    await prisma.userStats.upsert({
      where: { userId: u.id },
      create: {
        userId: u.id,
        gamesPlayed: u.wins + u.losses,
        wins: u.wins,
        losses: u.losses,
        sequencesCompleted: u.sequences,
      },
      update: {},
    });
  }
  console.log(`Seeded ${demoUsers.length} demo users`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
