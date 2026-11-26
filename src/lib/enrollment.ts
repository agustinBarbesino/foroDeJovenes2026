import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import {
  buildOverflowMap,
  elegirGrupo,
  evaluarGrupo,
  propuestasDisponibles,
  type EquityState,
  type Profile,
} from "./equity";
import { loadEquityState } from "./equity-store";
import { getEquityConfig } from "./settings";
import { buildNameKey, type InscripcionInput } from "./validation";

export interface EnrollmentSuccess {
  ok: true;
  nombre: string;
  apellido: string;
  asignaciones: Array<{ propuestaId: number; titulo: string; grupo: number }>;
}

export interface EnrollmentFailure {
  ok: false;
  code: "duplicate" | "unavailable" | "invalid";
  message: string;
  sinCupo?: number[];
  alternativas?: number[];
}

export type EnrollmentResult = EnrollmentSuccess | EnrollmentFailure;

/** Se lanza dentro de la transacción para provocar el rollback y se traduce afuera. */
class EnrollmentConflict extends Error {
  constructor(readonly payload: EnrollmentFailure) {
    super(payload.message);
  }
}

function retryable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("sqlite_busy") ||
    message.includes("database is locked") ||
    message.includes("transaction") && message.includes("conflict") ||
    /p2034|p1008/.test(message)
  );
}

/**
 * Inscripción atómica: o se crean las 3 inscripciones o no se crea ninguna.
 * Revalida los cupos DENTRO de la transacción para resistir condiciones de
 * carrera entre varios formularios enviados al mismo tiempo.
 */
export async function inscribir(input: InscripcionInput): Promise<EnrollmentResult> {
  const profile: Profile = {
    courseId: input.curso,
    gender: input.genero,
    studentKey: buildNameKey(input.nombre, input.apellido, input.curso),
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const config = await getEquityConfig(tx);
          const course = await tx.course.findUnique({ where: { id: input.curso } });
          if (!course) {
            throw new EnrollmentConflict({
              ok: false,
              code: "invalid",
              message: "Ese curso no existe. Elegí uno de la lista.",
            });
          }

          const nameKey = profile.studentKey as string;
          const existing = await tx.student.findUnique({ where: { nameKey } });
          if (existing) {
            throw new EnrollmentConflict({
              ok: false,
              code: "duplicate",
              message: "Ya existe una inscripción con ese nombre, apellido y curso.",
            });
          }

          const selectedIds = [...new Set(input.propuestas)];
          const proposals = await tx.proposal.findMany({
            where: { id: { in: selectedIds }, active: true },
            select: { id: true, title: true },
          });
          if (proposals.length !== selectedIds.length) {
            throw new EnrollmentConflict({
              ok: false,
              code: "invalid",
              message: "Alguna propuesta ya no está disponible. Elegí otras.",
            });
          }

          const state: EquityState = await loadEquityState(tx);
          const overflow = buildOverflowMap(state, config);

          // Las más escasas primero: así intentamos acomodar las 3 aunque
          // otra inscripción haya ocupado lugares mientras tanto.
          const viableGroups = (proposalId: number) =>
            state.groups.filter(
              (group) =>
                group.proposalId === proposalId &&
                evaluarGrupo(state, group, profile, overflow, config).viable,
            ).length;
          const ordered = [...selectedIds].sort(
            (a, b) => viableGroups(a) - viableGroups(b),
          );

          const sinCupo = ordered.filter(
            (id) => elegirGrupo(state, profile, id, config) === null,
          );
          if (sinCupo.length > 0) {
            throw new EnrollmentConflict({
              ok: false,
              code: "unavailable",
              message:
                "Alguna propuesta se completó mientras elegías. No perdimos tus datos: elegí una alternativa.",
              sinCupo,
              alternativas: propuestasDisponibles(state, profile, config).filter(
                (id) => !selectedIds.includes(id),
              ),
            });
          }

          const student = await tx.student.create({
            data: {
              firstName: input.nombre,
              lastName: input.apellido,
              nameKey,
              preferredName: input.nombreElegido || null,
              gender: input.genero,
              courseId: input.curso,
            },
          });

          state.courseSizes[input.curso] = (state.courseSizes[input.curso] ?? 0) + 1;
          state.courseGenders[input.curso] ??= {
            Femenino: 0,
            Masculino: 0,
            "No binario": 0,
            "Prefiero no decir": 0,
          };
          state.courseGenders[input.curso][input.genero]++;

          const asignaciones: EnrollmentSuccess["asignaciones"] = [];
          for (const proposalId of ordered) {
            const group = elegirGrupo(state, profile, proposalId, config);
            if (!group) {
              // No debería pasar: ya validamos, pero abortamos antes de dejar
              // una inscripción incompleta.
              throw new EnrollmentConflict({
                ok: false,
                code: "unavailable",
                message: "Una propuesta se completó recién ahora. Probá de nuevo.",
                sinCupo: [proposalId],
                alternativas: propuestasDisponibles(state, profile, config),
              });
            }

            await tx.enrollment.create({
              data: {
                studentId: student.id,
                proposalId,
                groupId: group.id,
              },
            });
            state.enrollments.push({
              groupId: group.id,
              proposalId,
              courseId: input.curso,
              gender: input.genero,
            });
            asignaciones.push({
              propuestaId: proposalId,
              titulo: proposals.find((p) => p.id === proposalId)!.title,
              grupo: group.index,
            });
          }

          return {
            ok: true as const,
            nombre: input.nombre,
            apellido: input.apellido,
            asignaciones,
          };
        },
        { timeout: 10_000 },
      );
    } catch (error) {
      if (error instanceof EnrollmentConflict) return error.payload;
      if (retryable(error) && attempt < 2) continue;
      throw error;
    }
  }

  return {
    ok: false,
    code: "unavailable",
    message: "No pudimos completar la inscripción por concurrencia. Probá de nuevo.",
  };
}

/** Tipo helper para servicios que reciben un cliente de transacción. */
export type TransactionClient = Prisma.TransactionClient;
