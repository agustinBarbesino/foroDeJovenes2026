import { prisma } from "./db";

export type ResultadoEliminacion =
  | { ok: true; eliminadas: number }
  | { ok: false; code: "invalid" | "not_found"; message: string };

function idValido(id: number): boolean {
  return Number.isInteger(id) && id > 0;
}

/**
 * Borra una sola fila. El estudiante se conserva con sus otras inscripciones;
 * si era la última, sigue cargado en la base.
 */
export async function eliminarInscripcion(id: number): Promise<ResultadoEliminacion> {
  if (!idValido(id)) {
    return { ok: false, code: "invalid", message: "Ese identificador no es válido." };
  }

  const { count } = await prisma.enrollment.deleteMany({ where: { id } });
  if (count === 0) {
    return { ok: false, code: "not_found", message: "Esa inscripción ya no existe." };
  }

  return { ok: true, eliminadas: count };
}

/** Borra toda la tabla de una propuesta, sin tocar las otras propuestas. */
export async function eliminarInscripcionesDePropuesta(
  propuestaId: number,
): Promise<ResultadoEliminacion> {
  if (!idValido(propuestaId)) {
    return { ok: false, code: "invalid", message: "Esa propuesta no es válida." };
  }

  const propuesta = await prisma.proposal.findUnique({
    where: { id: propuestaId },
    select: { id: true },
  });
  if (!propuesta) {
    return { ok: false, code: "not_found", message: "No encontramos esa propuesta." };
  }

  const { count } = await prisma.enrollment.deleteMany({ where: { proposalId: propuestaId } });
  return { ok: true, eliminadas: count };
}
