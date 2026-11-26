import { PrismaClient } from "@prisma/client";
import {
  COURSES,
  DEFAULT_EQUITY_CONFIG,
  SEED_COURSE_SIZES,
  TOTAL_STUDENTS,
} from "../src/lib/config";
import {
  SEED_PROPOSALS,
  buildGenderPlan,
} from "../src/lib/seed-data";

const prisma = new PrismaClient();

/** PRNG determinista: el seed siempre genera los mismos estudiantes. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  "Sofía", "Lucía", "Martina", "Camila", "Valentina", "Julieta", "Emma", "María",
  "Agustina", "Paula", "Lara", "Mía", "Aurora", "Clara", "Zoe", "Ana",
  "Elena", "Iris", "Noa", "Mila", "Renata", "Alma", "Vera", "Nina",
  "Lía", "Antonella", "Guadalupe", "Milagros", "Florencia", "Candela", "Daiana", "Ludmila",
  "Sabrina", "Tatiana", "Vanesa", "Romina", "Silvina", "Natalia", "Brenda", "Cinthia",
];

const LAST_NAMES = [
  "García", "Rodríguez", "González", "Fernández", "López", "Martínez", "Sánchez", "Pérez",
  "Gómez", "Martín", "Jiménez", "Ruiz", "Hernández", "Díaz", "Moreno", "Álvarez",
  "Romero", "Navarro", "Torres", "Domínguez", "Vázquez", "Ríos", "Mendes", "Costa",
  "Silva", "Ferreyra", "Acosta", "Medina", "Barrios", "Ortiz", "Benítez", "Sosa",
  "Castillo", "Ramírez", "Flores", "Peralta", "Aguirre", "Rojas", "Núñez", "Luna",
];

const PREFERRED_NAMES = ["Luchi", "Nachi", "Vero", "Cami", "Juli", "Toto", "Nina"];

async function main() {
  const random = mulberry32(2026);

  // Reset en orden seguro para poder correr `npm run seed` las veces que haga falta.
  await prisma.enrollment.deleteMany();
  await prisma.group.deleteMany();
  await prisma.student.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.course.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.syncStatus.deleteMany();

  await prisma.course.createMany({
    data: COURSES.map((course) => ({
      id: course.id,
      year: course.year,
      label: course.label,
    })),
  });

  await prisma.proposal.createMany({ data: SEED_PROPOSALS });

  const proposals = await prisma.proposal.findMany({ orderBy: { id: "asc" } });
  await prisma.group.createMany({
    data: proposals.flatMap((proposal) =>
      Array.from({ length: DEFAULT_EQUITY_CONFIG.groupsPerProposal }, (_, i) => ({
        proposalId: proposal.id,
        index: i + 1,
      })),
    ),
  });

  const genderPlan = buildGenderPlan(random);
  let globalIndex = 0;

  for (const [courseId, size] of Object.entries(SEED_COURSE_SIZES)) {
    const genders = genderPlan[courseId];
    for (let i = 0; i < size; i++) {
      const firstName = FIRST_NAMES[globalIndex % FIRST_NAMES.length];
      const lastName =
        LAST_NAMES[Math.floor(globalIndex / FIRST_NAMES.length) % LAST_NAMES.length];
      const preferredName =
        globalIndex % 53 === 0
          ? PREFERRED_NAMES[globalIndex % PREFERRED_NAMES.length]
          : null;

      await prisma.student.create({
        data: {
          firstName,
          lastName,
          nameKey: `${firstName}|${lastName}|${courseId}`.toLocaleLowerCase("es-AR"),
          preferredName,
          gender: genders[i],
          courseId,
        },
      });
      globalIndex++;
    }
  }

  await prisma.setting.upsert({
    where: { key: "equityConfig" },
    create: { key: "equityConfig", value: JSON.stringify(DEFAULT_EQUITY_CONFIG) },
    update: { value: JSON.stringify(DEFAULT_EQUITY_CONFIG) },
  });

  await prisma.syncStatus.upsert({
    where: { id: 1 },
    create: { id: 1, status: "never" },
    update: { status: "never", lastError: null },
  });

  const [courses, proposalsCount, groups, students] = await Promise.all([
    prisma.course.count(),
    prisma.proposal.count(),
    prisma.group.count(),
    prisma.student.count(),
  ]);

  console.log(
    `Seed listo: ${courses} cursos, ${proposalsCount} propuestas, ${groups} grupos y ${students} estudiantes.`,
  );
  if (students !== TOTAL_STUDENTS) {
    throw new Error(`Se esperaban ${TOTAL_STUDENTS} estudiantes, se crearon ${students}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
