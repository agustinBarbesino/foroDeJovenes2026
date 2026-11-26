/**
 * Motor puro de equidad. No depende de Prisma ni de la UI: recibe un estado
 * inmutable y devuelve decisiones. La API y los tests usan exactamente la
 * misma lógica, así no puede divergir "lo que se ofrece" de "lo que se asigna".
 *
 * Reglas:
 *  - Año y curso son restricciones duras (cupo por slot año+curso+grupo).
 *  - F/M es una restricción blanda: se busca la proporción real del curso,
 *    porque un 50/50 fijo dejaría sin lugar a cursos desbalanceados.
 *  - No binaries y "prefiero no decir" NO cuentan para el balance F/M, pero
 *    SÍ ocupan el slot y se reparten entre grupos para evitar clustering.
 */

import {
  DEFAULT_EQUITY_CONFIG,
  GENDERS,
  YEAR_BY_COURSE,
  YEARS,
  type EquityConfig,
  type Gender,
} from "./config";

export interface GroupInfo {
  id: number;
  proposalId: number;
  index: number;
}

export interface EnrollmentInfo {
  groupId: number;
  proposalId: number;
  courseId: string;
  gender: Gender;
}

export interface EquityState {
  groups: GroupInfo[];
  enrollments: EnrollmentInfo[];
  /** Cantidad total de estudiantes por curso (para calcular el overflow). */
  courseSizes: Record<string, number>;
  /** Distribución de género de TODOS los estudiantes del curso, no solo inscriptos. */
  courseGenders: Record<string, Record<Gender, number>>;
}

export interface Profile {
  courseId: string;
  gender: Gender;
  /** Solo para desempatar de forma determinista; nunca se usa para inferir género. */
  studentKey?: string | number;
}

export interface Evaluation {
  viable: boolean;
  score: number;
  reason?: "slot_full" | "year_full" | "course_full";
}

const isBinaryGender = (gender: Gender) =>
  gender === "Femenino" || gender === "Masculino";

/** Hash FNV-1a: estable entre corridas y máquinas. */
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * El total de participaciones (337*3 = 1011) supera los 1008 lugares base.
 * Calculamos cuántos lugares extra necesita cada curso y los asignamos a los
 * primeros grupos (orden determinista) sin concentrarlos en un solo slot.
 */
export function buildOverflowMap(
  state: EquityState,
  config: EquityConfig = DEFAULT_EQUITY_CONFIG,
): Map<string, number> {
  const overflow = new Map<string, number>();
  const totalGroups = state.groups.length || 1;
  const sortedGroups = [...state.groups].sort(
    (a, b) => hash(`${a.proposalId}:${a.index}`) - hash(`${b.proposalId}:${b.index}`),
  );

  for (const [courseId, size] of Object.entries(state.courseSizes)) {
    const needed =
      config.choicesPerStudent * size - totalGroups * config.baseSlotCapacity;
    for (let i = 0; i < needed; i++) {
      const group = sortedGroups[i % sortedGroups.length];
      const key = `${group.id}|${courseId}`;
      overflow.set(key, (overflow.get(key) ?? 0) + 1);
    }
  }

  return overflow;
}

export function slotCapacity(
  state: EquityState,
  groupId: number,
  courseId: string,
  overflow: Map<string, number>,
  config: EquityConfig = DEFAULT_EQUITY_CONFIG,
): number {
  return config.baseSlotCapacity + (overflow.get(`${groupId}|${courseId}`) ?? 0);
}

interface SlotCounts {
  total: number;
  Femenino: number;
  Masculino: number;
  "No binario": number;
  "Prefiero no decir": number;
}

function emptyCounts(): SlotCounts {
  return {
    total: 0,
    Femenino: 0,
    Masculino: 0,
    "No binario": 0,
    "Prefiero no decir": 0,
  };
}

function countBy(
  state: EquityState,
  predicate: (enrollment: EnrollmentInfo) => boolean,
): SlotCounts {
  const counts = emptyCounts();
  for (const enrollment of state.enrollments) {
    if (!predicate(enrollment)) continue;
    counts.total++;
    counts[enrollment.gender]++;
  }
  return counts;
}

/** Cantidad de personas no binaries o que prefirieron no decir en un grupo. */
function nonBinaryCount(
  state: EquityState,
  groupId: number,
  courseId?: string,
): number {
  return state.enrollments.filter(
    (e) =>
      e.groupId === groupId &&
      (!courseId || e.courseId === courseId) &&
      !isBinaryGender(e.gender),
  ).length;
}

/** Proporción de mujeres entre los estudiantes binarios del curso. */
export function femaleShare(
  state: EquityState,
  courseId: string,
): number {
  const counts = state.courseGenders[courseId];
  if (!counts) return 0.5;
  const binaryTotal = counts.Femenino + counts.Masculino;
  if (binaryTotal === 0) return 0.5;
  return counts.Femenino / binaryTotal;
}

function totalCapacityForGroup(
  state: EquityState,
  groupId: number,
  overflow: Map<string, number>,
  config: EquityConfig,
): number {
  return Object.keys(state.courseSizes).reduce(
    (sum, courseId) => sum + slotCapacity(state, groupId, courseId, overflow, config),
    0,
  );
}

/**
 * Evalúa un grupo para un perfil. Es la ÚNICA fuente de verdad usada tanto por
 * `propuestasDisponibles` como por `elegirGrupo`.
 */
export function evaluarGrupo(
  state: EquityState,
  group: GroupInfo,
  profile: Profile,
  overflow: Map<string, number>,
  config: EquityConfig = DEFAULT_EQUITY_CONFIG,
): Evaluation {
  const year = YEAR_BY_COURSE[profile.courseId];
  const capacity = slotCapacity(state, group.id, profile.courseId, overflow, config);
  const slot = countBy(
    state,
    (e) => e.groupId === group.id && e.courseId === profile.courseId,
  );
  const yearCount = countBy(
    state,
    (e) => e.groupId === group.id && YEAR_BY_COURSE[e.courseId] === year,
  ).total;
  const groupCapacity = totalCapacityForGroup(state, group.id, overflow, config);
  const maxPerYear = Math.ceil(groupCapacity / YEARS.length);

  // RESTRICCIONES DURAS
  if (slot.total >= capacity) return { viable: false, score: Infinity, reason: "slot_full" };
  if (yearCount >= maxPerYear) return { viable: false, score: Infinity, reason: "year_full" };

  let score = 0;

  if (isBinaryGender(profile.gender)) {
    // Objetivo proporcional al curso: en 1°B (64% mujeres) un slot de 2
    // apunta a ~1 mujer y ~1 varón; en cursos con mayoría varón, al revés.
    const targetF = Math.round(capacity * femaleShare(state, profile.courseId));
    const targetM = capacity - targetF;
    const nextF = slot.Femenino + (profile.gender === "Femenino" ? 1 : 0);
    const nextM = slot.Masculino + (profile.gender === "Masculino" ? 1 : 0);
    score += 10 * (Math.abs(nextF - targetF) + Math.abs(nextM - targetM));
  } else {
    // Sin cupo binario: solo se reparte entre grupos. Preferimos el grupo con
    // menos personas no binaries de ese mismo año+curso, y luego del grupo.
    score += 100 * nonBinaryCount(state, group.id, profile.courseId);
    score += 20 * nonBinaryCount(state, group.id);
  }

  // Equilibrio de carga entre los 3 grupos y entre años.
  const groupLoad = countBy(state, (e) => e.groupId === group.id).total;
  score += 5 * groupLoad;
  score += yearCount;

  // Desempate estable (no depende del orden de iteración de la DB).
  const key = profile.studentKey ?? `${profile.courseId}:${profile.gender}`;
  score += hash(`${key}:${group.id}`) / 1_000_000_000;

  return { viable: true, score };
}

/** Elige el mejor grupo viable de una propuesta, o `null` si no hay lugar. */
export function elegirGrupo(
  state: EquityState,
  profile: Profile,
  proposalId: number,
  config: EquityConfig = DEFAULT_EQUITY_CONFIG,
): GroupInfo | null {
  const overflow = buildOverflowMap(state, config);
  const groups = state.groups.filter((g) => g.proposalId === proposalId);
  let best: GroupInfo | null = null;
  let bestScore = Infinity;

  for (const group of groups) {
    const evaluation = evaluarGrupo(state, group, profile, overflow, config);
    if (!evaluation.viable) continue;
    if (evaluation.score < bestScore) {
      best = group;
      bestScore = evaluation.score;
    }
  }

  return best;
}

/** Una propuesta se ofrece si AL MENOS un grupo acepta al perfil. */
export function puedeAceptar(
  state: EquityState,
  profile: Profile,
  proposalId: number,
  config: EquityConfig = DEFAULT_EQUITY_CONFIG,
): boolean {
  return elegirGrupo(state, profile, proposalId, config) !== null;
}

/** Propuestas disponibles para este perfil, en orden de id. */
export function propuestasDisponibles(
  state: EquityState,
  profile: Profile,
  config: EquityConfig = DEFAULT_EQUITY_CONFIG,
): number[] {
  const ids = [...new Set(state.groups.map((g) => g.proposalId))].sort((a, b) => a - b);
  return ids.filter((id) => puedeAceptar(state, profile, id, config));
}

/** Una propuesta está completa cuando TODOS sus slots están llenos. */
export function propuestaCompleta(
  state: EquityState,
  proposalId: number,
  config: EquityConfig = DEFAULT_EQUITY_CONFIG,
): boolean {
  const overflow = buildOverflowMap(state, config);
  const groups = state.groups.filter((g) => g.proposalId === proposalId);
  if (groups.length === 0) return true;

  return groups.every((group) =>
    Object.keys(state.courseSizes).every(
      (courseId) =>
        countBy(state, (e) => e.groupId === group.id && e.courseId === courseId).total >=
        slotCapacity(state, group.id, courseId, overflow, config),
    ),
  );
}

/** Helper para tests y simulaciones: muta el estado devolviendo el grupo elegido. */
export function asignarSimulado(
  state: EquityState,
  profile: Profile,
  proposalId: number,
  config: EquityConfig = DEFAULT_EQUITY_CONFIG,
): GroupInfo | null {
  const group = elegirGrupo(state, profile, proposalId, config);
  if (!group) return null;
  state.enrollments.push({
    groupId: group.id,
    proposalId,
    courseId: profile.courseId,
    gender: profile.gender,
  });
  return group;
}

/** Arma un estado mínimo para tests (1 propuesta, 3 grupos, cursos pretendidos). */
export function makeTestState(options: {
  courseSizes: Record<string, number>;
  courseGenders: Record<string, Record<Gender, number>>;
  proposalIds?: number[];
  config?: EquityConfig;
}): EquityState {
  const config = options.config ?? DEFAULT_EQUITY_CONFIG;
  const groups: GroupInfo[] = [];
  const proposalIds =
    options.proposalIds ??
    Array.from({ length: config.proposalCount }, (_, index) => index + 1);
  for (const proposalId of proposalIds) {
    for (let index = 1; index <= config.groupsPerProposal; index++) {
      groups.push({ id: groups.length + 1, proposalId, index });
    }
  }
  return {
    groups,
    enrollments: [],
    courseSizes: options.courseSizes,
    courseGenders: options.courseGenders,
  };
}

export function emptyGenderCounts(): Record<Gender, number> {
  return Object.fromEntries(GENDERS.map((g) => [g, 0])) as Record<Gender, number>;
}
