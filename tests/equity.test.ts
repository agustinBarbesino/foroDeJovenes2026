import { describe, expect, it } from "vitest";
import {
  COURSE_IDS,
  SEED_COURSE_SIZES,
  YEARS,
  isBinary,
  type Gender,
} from "../src/lib/config";
import {
  asignarSimulado,
  buildOverflowMap,
  elegirGrupo,
  emptyGenderCounts,
  femaleShare,
  makeTestState,
  propuestaCompleta,
  puedeAceptar,
  slotCapacity,
  type EquityState,
  type Profile,
} from "../src/lib/equity";

function counts(
  F: number,
  M: number,
  NB = 0,
  PND = 0,
): Record<Gender, number> {
  const result = emptyGenderCounts();
  result.Femenino = F;
  result.Masculino = M;
  result["No binario"] = NB;
  result["Prefiero no decir"] = PND;
  return result;
}

function balancedState(overrides: Partial<EquityState> = {}): EquityState {
  return makeTestState({
    courseSizes: { ...SEED_COURSE_SIZES },
    courseGenders: Object.fromEntries(
      Object.keys(SEED_COURSE_SIZES).map((id) => [id, counts(14, 14)]),
    ),
    ...overrides,
  });
}

function enrollmentsOfGroup(state: EquityState, groupId: number) {
  return state.enrollments.filter((e) => e.groupId === groupId);
}

describe("motor de equidad: año y curso (restricción dura)", () => {
  it("reparte 2 estudiantes por curso y grupo sin superar el cupo", () => {
    const state = balancedState();
    let student = 0;

    // 12 cursos × 2 estudiantes = 24 participaciones en una sola propuesta.
    for (const courseId of COURSE_IDS) {
      for (let i = 0; i < 2; i++) {
        const gender: Gender = i === 0 ? "Femenino" : "Masculino";
        const group = asignarSimulado(
          state,
          { courseId, gender, studentKey: student++ },
          1,
        );
        expect(group).not.toBeNull();
      }
    }

    const groups = state.groups.filter((g) => g.proposalId === 1);
    expect(groups).toHaveLength(3);

    const allEnrollments = state.enrollments;
    expect(allEnrollments).toHaveLength(24);

    // 4 estudiantes por año (2 cursos × 2), sin importar el grupo.
    for (const year of YEARS) {
      const yearCourses = COURSE_IDS.filter((id) => id.startsWith(`${year}°`));
      expect(
        allEnrollments.filter((e) => yearCourses.includes(e.courseId)),
      ).toHaveLength(4);
    }

    // Ningún grupo supera la capacidad dura del slot año+curso.
    for (const courseId of COURSE_IDS) {
      const enrollments = allEnrollments.filter((e) => e.courseId === courseId);
      expect(enrollments).toHaveLength(2);
      for (const group of groups) {
        expect(
          enrollmentsOfGroup(state, group.id).filter((e) => e.courseId === courseId).length,
        ).toBeLessThanOrEqual(2);
      }
    }
  });

  it("deja de ofrecer la propuesta cuando el slot del curso está lleno en los 3 grupos", () => {
    const state = balancedState();
    for (let i = 0; i < 3; i++) {
      const group = state.groups.find(
        (g) => g.proposalId === 1 && g.index === i + 1,
      )!;
      state.enrollments.push(
        { groupId: group.id, proposalId: 1, courseId: "1°A", gender: "Femenino" },
        { groupId: group.id, proposalId: 1, courseId: "1°A", gender: "Masculino" },
      );
    }

    expect(puedeAceptar(state, { courseId: "1°A", gender: "Femenino" }, 1)).toBe(false);
    // Otras propuestas siguen disponibles: el cupo es por propuesta.
    expect(puedeAceptar(state, { courseId: "1°A", gender: "Femenino" }, 2)).toBe(true);
  });
});

describe("motor de equidad: equilibrio varón/mujer", () => {
  it("balancea F/M cuando el curso tiene disponibilidad", () => {
    const state = balancedState();
    state.courseGenders["1°A"] = counts(14, 14);

    const profiles: Profile[] = Array.from({ length: 6 }, (_, i) => ({
      courseId: "1°A",
      gender: i % 2 === 0 ? "Femenino" : "Masculino",
      studentKey: i,
    }));
    for (const profile of profiles) {
      expect(asignarSimulado(state, profile, 1)).not.toBeNull();
    }

    const groups = state.groups.filter((g) => g.proposalId === 1);
    for (const group of groups) {
      const enrollments = enrollmentsOfGroup(state, group.id);
      expect(enrollments).toHaveLength(2);
      expect(enrollments.filter((e) => e.gender === "Femenino")).toHaveLength(1);
      expect(enrollments.filter((e) => e.gender === "Masculino")).toHaveLength(1);
    }
  });

  it("acepta desbalance estructural en ambos sentidos sin inferir género", () => {
    // 1°B: 17 mujeres / 10 varones (64% mujeres).
    const femaleHeavy = balancedState();
    femaleHeavy.courseGenders["1°B"] = counts(17, 10, 0, 1);
    expect(femaleShare(femaleHeavy, "1°B")).toBeCloseTo(0.63, 1);

    const femaleHeavyProfiles: Profile[] = [
      ...Array.from({ length: 4 }, (_, i) => ({
        courseId: "1°B",
        gender: "Femenino" as const,
        studentKey: `f${i}`,
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        courseId: "1°B",
        gender: "Masculino" as const,
        studentKey: `m${i}`,
      })),
    ];
    for (const profile of femaleHeavyProfiles) {
      expect(asignarSimulado(femaleHeavy, profile, 1)).not.toBeNull();
    }
    expect(
      femaleHeavy.enrollments.filter((e) => e.gender === "Femenino"),
    ).toHaveLength(4);

    // 2°A: 11 mujeres / 16 varones (40% mujeres).
    const maleHeavy = balancedState();
    maleHeavy.courseGenders["2°A"] = counts(11, 16, 1, 0);
    const maleHeavyProfiles: Profile[] = [
      ...Array.from({ length: 4 }, (_, i) => ({
        courseId: "2°A",
        gender: "Masculino" as const,
        studentKey: `m${i}`,
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        courseId: "2°A",
        gender: "Femenino" as const,
        studentKey: `f${i}`,
      })),
    ];
    for (const profile of maleHeavyProfiles) {
      expect(asignarSimulado(maleHeavy, profile, 1)).not.toBeNull();
    }
    expect(
      maleHeavy.enrollments.filter((e) => e.gender === "Masculino"),
    ).toHaveLength(4);
  });
});

describe("motor de equidad: personas no binaries", () => {
  it("distribuye no binaries entre los 3 grupos sin clustering", () => {
    const state = balancedState();
    state.courseGenders["3°A"] = counts(13, 14, 1);

    for (let i = 0; i < 3; i++) {
      expect(
        asignarSimulado(
          state,
          { courseId: "3°A", gender: "No binario", studentKey: `nb${i}` },
          1,
        ),
      ).not.toBeNull();
    }

    const groups = state.groups.filter((g) => g.proposalId === 1);
    const perGroup = groups.map(
      (g) =>
        enrollmentsOfGroup(state, g.id).filter((e) => !isBinary(e.gender)).length,
    );
    expect(perGroup).toEqual([1, 1, 1]);
  });

  it("mezcla 'No binario' y 'Prefiero no decir' sin cupo binario", () => {
    const state = balancedState();
    state.courseGenders["5°IP"] = counts(13, 13, 1, 1);
    const genders: Gender[] = [
      "No binario",
      "Prefiero no decir",
      "No binario",
    ];
    for (const [index, gender] of genders.entries()) {
      expect(
        asignarSimulado(state, { courseId: "5°IP", gender, studentKey: index }, 1),
      ).not.toBeNull();
    }
    const usedGroups = state.groups
      .filter((g) => g.proposalId === 1)
      .filter((g) => enrollmentsOfGroup(state, g.id).length > 0);
    expect(usedGroups).toHaveLength(3);
  });
});

describe("capacidad y overflow", () => {
  it("calcula 3 lugares extra para el curso de 29 estudiantes", () => {
    const state = balancedState();
    const overflow = buildOverflowMap(state);
    expect([...overflow.values()].reduce((a, b) => a + b, 0)).toBe(3);
    expect(overflow.size).toBe(3);

    for (const [key, extra] of overflow) {
      const [groupId, courseId] = key.split("|");
      expect(courseId).toBe("7°IP");
      expect(extra).toBe(1);
      expect(
        slotCapacity(state, Number(groupId), courseId, overflow),
      ).toBe(3);
    }
  });

  it("marca una propuesta como completa cuando todos sus slots están llenos", () => {
    const state = balancedState();
    const groups = state.groups.filter((g) => g.proposalId === 1);
    for (const group of groups) {
      for (const courseId of COURSE_IDS) {
        state.enrollments.push(
          { groupId: group.id, proposalId: 1, courseId, gender: "Femenino" },
          { groupId: group.id, proposalId: 1, courseId, gender: "Masculino" },
        );
      }
    }
    // Los 3 lugares de overflow del curso de 29 estudiantes también se llenan.
    for (const key of buildOverflowMap(state).keys()) {
      const [groupId, courseId] = key.split("|");
      state.enrollments.push({
        groupId: Number(groupId),
        proposalId: 1,
        courseId,
        gender: "No binario",
      });
    }

    expect(propuestaCompleta(state, 1)).toBe(true);
    expect(puedeAceptar(state, { courseId: "1°A", gender: "Femenino" }, 1)).toBe(false);
    expect(elegirGrupo(state, { courseId: "1°A", gender: "Femenino" }, 1)).toBeNull();
  });
});
