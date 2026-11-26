import { Prisma, type PrismaClient } from "@prisma/client";
import { GENDERS, type Gender } from "./config";
import {
  emptyGenderCounts,
  type EnrollmentInfo,
  type EquityState,
  type GroupInfo,
} from "./equity";

type DbClient = PrismaClient | Prisma.TransactionClient;

/** Carga el estado que consume el motor. Sirve tanto con PrismaClient como con tx. */
export async function loadEquityState(db: DbClient): Promise<EquityState> {
  const [courses, groups, genderRows] = await Promise.all([
    db.course.findMany({ select: { id: true } }),
    db.group.findMany({
      select: { id: true, proposalId: true, index: true },
      orderBy: [{ proposalId: "asc" }, { index: "asc" }],
    }),
    db.student.groupBy({
      by: ["courseId", "gender"],
      _count: { _all: true },
    }),
  ]);

  const courseSizes: Record<string, number> = {};
  const courseGenders: Record<string, Record<Gender, number>> = {};
  for (const course of courses) {
    courseSizes[course.id] = 0;
    courseGenders[course.id] = emptyGenderCounts();
  }
  for (const row of genderRows) {
    const gender = GENDERS.find((g) => g === row.gender);
    if (!gender || !courseGenders[row.courseId]) continue;
    courseSizes[row.courseId] += row._count._all;
    courseGenders[row.courseId][gender] = row._count._all;
  }

  // El select de enrollment no trae courseId directamente (está en Student),
  // así que lo resolvemos con una consulta separada.
  const enrollmentRows = await db.enrollment.findMany({
    select: {
      groupId: true,
      proposalId: true,
      student: { select: { courseId: true, gender: true } },
    },
  });

  const enrollmentsInfo: EnrollmentInfo[] = enrollmentRows.map((row) => ({
    groupId: row.groupId,
    proposalId: row.proposalId,
    courseId: row.student.courseId,
    gender: row.student.gender as Gender,
  }));

  return {
    groups: groups as GroupInfo[],
    enrollments: enrollmentsInfo,
    courseSizes,
    courseGenders,
  };
}
