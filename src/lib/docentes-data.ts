import { prisma } from "./db";
import { YEAR_BY_COURSE, YEARS, GENDERS } from "./config";

export interface FilaPropuesta {
  propuestaId: number;
  titulo: string;
  grupo: number;
  nombre: string;
  apellido: string;
  nombreElegido: string | null;
  curso: string;
  anio: number;
  genero: string;
}

export interface FilaCurso {
  estudianteId: number;
  nombre: string;
  apellido: string;
  nombreElegido: string | null;
  curso: string;
  anio: number;
  genero: string;
  propuestas: string[];
}

export interface FilaMetrica {
  propuesta: string;
  grupo: number;
  anio: number;
  curso: string;
  genero: string;
  cantidad: number;
}

export async function listarPropuestas() {
  return prisma.proposal.findMany({
    select: { id: true, title: true },
    orderBy: { id: "asc" },
  });
}

export async function listarCursos() {
  return prisma.course.findMany({ select: { id: true }, orderBy: { id: "asc" } });
}

export async function obtenerPorPropuesta(propuestaId?: number): Promise<FilaPropuesta[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: propuestaId ? { proposalId: propuestaId } : undefined,
    include: {
      student: true,
      group: { include: { proposal: true } },
    },
    orderBy: [{ groupId: "asc" }, { student: { lastName: "asc" } }],
  });

  return enrollments.map((enrollment) => ({
    propuestaId: enrollment.proposalId,
    titulo: enrollment.group.proposal.title,
    grupo: enrollment.group.index,
    nombre: enrollment.student.firstName,
    apellido: enrollment.student.lastName,
    nombreElegido: enrollment.student.preferredName,
    curso: enrollment.student.courseId,
    anio: YEAR_BY_COURSE[enrollment.student.courseId],
    genero: enrollment.student.gender,
  }));
}

export async function obtenerPorCurso(curso?: string): Promise<FilaCurso[]> {
  const students = await prisma.student.findMany({
    where: curso ? { courseId: curso } : undefined,
    include: {
      enrollments: {
        include: { group: { include: { proposal: true } } },
        orderBy: { proposalId: "asc" },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return students.map((student) => ({
    estudianteId: student.id,
    nombre: student.firstName,
    apellido: student.lastName,
    nombreElegido: student.preferredName,
    curso: student.courseId,
    anio: YEAR_BY_COURSE[student.courseId],
    genero: student.gender,
    propuestas: student.enrollments.map(
      (enrollment) =>
        `${enrollment.group.proposal.title} (Grupo ${enrollment.group.index})`,
    ),
  }));
}

/** Agregado por propuesta × grupo × año × curso × género (4 categorías). */
export async function obtenerMetricas(): Promise<FilaMetrica[]> {
  const filas = await obtenerPorPropuesta();
  const mapa = new Map<string, FilaMetrica>();

  for (const fila of filas) {
    const key = `${fila.propuestaId}|${fila.grupo}|${fila.anio}|${fila.curso}|${fila.genero}`;
    const existente = mapa.get(key);
    if (existente) {
      existente.cantidad++;
      continue;
    }
    mapa.set(key, {
      propuesta: fila.titulo,
      grupo: fila.grupo,
      anio: fila.anio,
      curso: fila.curso,
      genero: fila.genero,
      cantidad: 1,
    });
  }

  return [...mapa.values()].sort(
    (a, b) =>
      a.propuesta.localeCompare(b.propuesta, "es") ||
      a.grupo - b.grupo ||
      a.anio - b.anio ||
      a.curso.localeCompare(b.curso, "es") ||
      GENDERS.indexOf(a.genero as (typeof GENDERS)[number]) -
        GENDERS.indexOf(b.genero as (typeof GENDERS)[number]),
  );
}

export function filasPropuestaCsv(filas: FilaPropuesta[]) {
  return [
    ["Propuesta", "Grupo", "Nombre", "Apellido", "Nombre elegido", "Curso", "Año", "Género"],
    ...filas.map((f) => [
      f.titulo,
      f.grupo,
      f.nombre,
      f.apellido,
      f.nombreElegido,
      f.curso,
      f.anio,
      f.genero,
    ]),
  ];
}

export function filasCursoCsv(filas: FilaCurso[]) {
  return [
    ["Nombre", "Apellido", "Nombre elegido", "Curso", "Año", "Género", "Propuesta 1", "Propuesta 2", "Propuesta 3"],
    ...filas.map((f) => [
      f.nombre,
      f.apellido,
      f.nombreElegido,
      f.curso,
      f.anio,
      f.genero,
      ...[0, 1, 2].map((i) => f.propuestas[i] ?? ""),
    ]),
  ];
}

export function filasMetricasCsv(filas: FilaMetrica[]) {
  return [
    ["Propuesta", "Grupo", "Año", "Curso", "Género", "Cantidad"],
    ...filas.map((f) => [f.propuesta, f.grupo, f.anio, f.curso, f.genero, f.cantidad]),
  ];
}

export const ANIOS = YEARS;
