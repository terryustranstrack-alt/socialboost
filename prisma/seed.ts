import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const BRANDS = [
  { name: "TransTRACK", slug: "transtrack-co" },
  { name: "TransTRACK Academy", slug: "transtrack-academy" },
];

// One seed user per role, each a member of both brands, so the MVP can be
// exercised end-to-end immediately after `npm run db:seed`.
const USERS: { name: string; email: string; role: Role }[] = [
  { name: "Admin", email: "admin@transtrack.co", role: Role.ADMIN },
  { name: "Content Creator", email: "creator@transtrack.co", role: Role.CREATOR },
  { name: "Approver", email: "approver@transtrack.co", role: Role.APPROVER },
  { name: "Viewer", email: "viewer@transtrack.co", role: Role.VIEWER },
];

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "ChangeMe123!";

async function main() {
  const brands = await Promise.all(
    BRANDS.map((b) =>
      prisma.brand.upsert({
        where: { slug: b.slug },
        update: {},
        create: b,
      }),
    ),
  );

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { name: u.name, email: u.email, passwordHash },
    });

    for (const brand of brands) {
      await prisma.membership.upsert({
        where: { userId_brandId: { userId: user.id, brandId: brand.id } },
        update: { role: u.role },
        create: { userId: user.id, brandId: brand.id, role: u.role },
      });
    }
  }

  console.log("Seeded brands:", brands.map((b) => b.slug).join(", "));
  console.log("Seeded users (password: %s):", SEED_PASSWORD);
  for (const u of USERS) console.log(`  - ${u.email} (${u.role})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
