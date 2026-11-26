/**
 * Constantes del dominio y parámetros ajustables del motor de equidad.
 * Los valores por defecto pueden sobreescribirse desde la tabla `Setting`.
 */

export const GENDERS = [
  "Femenino",
  "Masculino",
  "No binario",
  "Prefiero no decir",
] as const;

export type Gender = (typeof GENDERS)[number];

export const BINARY_GENDERS = ["Femenino", "Masculino"] as const;
export const NON_BINARY_GENDERS = ["No binario", "Prefiero no decir"] as const;

export function isBinary(gender: Gender): boolean {
  return (BINARY_GENDERS as readonly string[]).includes(gender);
}

/** Normaliza la etiqueta recibida a una de las cuatro opciones válidas. */
export function parseGender(value: string): Gender | null {
  return GENDERS.find((g) => g === value) ?? null;
}

export const YEARS = [1, 2, 3, 5, 6, 7] as const;
export type Year = (typeof YEARS)[number];

export const COURSE_LABELS: Record<Year, readonly string[]> = {
  1: ["A", "B"],
  2: ["A", "B"],
  3: ["A", "B"],
  5: ["MMO", "IP"],
  6: ["MMO", "IP"],
  7: ["MMO", "IP"],
};

/** Nomenclatura exacta exigida por la institución. */
export const COURSES: ReadonlyArray<{ id: string; year: Year; label: string }> =
  YEARS.flatMap((year) =>
    COURSE_LABELS[year].map((label) => ({ id: `${year}°${label}`, year, label })),
  );

export const COURSE_IDS = COURSES.map((course) => course.id);
export const YEAR_BY_COURSE: Record<string, Year> = Object.fromEntries(
  COURSES.map((course) => [course.id, course.year]),
);

export interface EquityConfig {
  /** Cantidad de propuestas del evento. */
  proposalCount: number;
  /** Cantidad de propuestas que elige cada estudiante. */
  choicesPerStudent: number;
  /** Grupos por propuesta. */
  groupsPerProposal: number;
  /** Capacidad base de cada slot año+curso+grupo. */
  baseSlotCapacity: number;
  /** Mínimo de casos para mostrar una celda en Métricas (k-anonimato). */
  metricsMinCell: number;
}

export const DEFAULT_EQUITY_CONFIG: EquityConfig = {
  proposalCount: 14,
  choicesPerStudent: 3,
  groupsPerProposal: 3,
  baseSlotCapacity: 2,
  metricsMinCell: 3,
};

export const SEED_COURSE_SIZES: Record<string, number> = {
  "1°A": 28,
  "1°B": 28,
  "2°A": 28,
  "2°B": 28,
  "3°A": 28,
  "3°B": 28,
  "5°MMO": 28,
  "5°IP": 28,
  "6°MMO": 28,
  "6°IP": 28,
  "7°MMO": 28,
  "7°IP": 29, // 337 estudiantes en total
};

export const TOTAL_STUDENTS = Object.values(SEED_COURSE_SIZES).reduce(
  (sum, size) => sum + size,
  0,
);
