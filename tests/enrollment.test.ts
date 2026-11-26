import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db";
import { inscribir } from "../src/lib/enrollment";
import {
  eliminarInscripcion,
  eliminarInscripcionesDePropuesta,
} from "../src/lib/eliminar-inscripciones";
import { buildNameKey, inscripcionSchema, type InscripcionInput } from "../src/lib/validation";

const environment = {
  ...process.env,
  DATABASE_URL: "file:./test.db",
};

const input: InscripcionInput = {
  nombre: "Prueba",
  apellido: "Estudiante",
  curso: "1°A",
  genero: "Femenino",
  nombreElegido: null,
  propuestas: [1, 2, 3],
};

beforeAll(() => {
  execFileSync("npx", ["tsx", "prisma/seed.ts"], {
    env: environment,
    stdio: "ignore",
  });
});

describe("validación del formulario", () => {
  it("exige exactamente 3 propuestas y sin repeticiones", () => {
    expect(
      inscripcionSchema.safeParse({ ...input, propuestas: [1, 2] }).success,
    ).toBe(false);
    expect(
      inscripcionSchema.safeParse({ ...input, propuestas: [1, 2, 2] }).success,
    ).toBe(false);
    expect(inscripcionSchema.safeParse(input).success).toBe(true);
  });
});

describe("inscripción atómica", () => {
  it("crea al estudiante y sus 3 inscripciones juntos", async () => {
    const result = await inscribir(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.asignaciones).toHaveLength(3);
    const student = await prisma.student.findUnique({
      where: { nameKey: buildNameKey("Prueba", "Estudiante", "1°A") },
    });
    expect(student).not.toBeNull();
    expect(
      await prisma.enrollment.count({ where: { studentId: student!.id } }),
    ).toBe(3);
  });

  it("rechaza duplicados de nombre + apellido + curso", async () => {
    const result = await inscribir(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("duplicate");
  });

  it("no crea nada si una propuesta se llenó: avisa y ofrece alternativas", async () => {
    // Llenamos los 3 grupos de la propuesta 1 para el curso 1°A.
    const groups = await prisma.group.findMany({
      where: { proposalId: 1 },
      orderBy: { index: "asc" },
    });
    const students = await prisma.student.findMany({
      where: { courseId: "1°A" },
      take: groups.length * 2,
    });
    for (const [index, group] of groups.entries()) {
      await prisma.enrollment.createMany({
        data: [
          {
            studentId: students[index * 2].id,
            proposalId: 1,
            groupId: group.id,
          },
          {
            studentId: students[index * 2 + 1].id,
            proposalId: 1,
            groupId: group.id,
          },
        ],
      });
    }

    const otherInput: InscripcionInput = {
      ...input,
      nombre: "Otra",
      apellido: "Persona",
      propuestas: [1, 2, 3],
    };
    const result = await inscribir(otherInput);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.code).toBe("unavailable");
    expect(result.sinCupo).toContain(1);
    expect(result.alternativas?.length).toBeGreaterThan(0);
    expect(
      await prisma.student.findUnique({
        where: { nameKey: buildNameKey("Otra", "Persona", "1°A") },
      }),
    ).toBeNull();
  });
});

describe("eliminación de inscripciones", () => {
  it("borra una inscripción y conserva al estudiante con sus otras dos", async () => {
    const inscripcion = await inscribir({
      ...input,
      nombre: "Borrar",
      apellido: "Uno",
      propuestas: [4, 5, 6],
    });
    expect(inscripcion.ok).toBe(true);

    const estudiante = await prisma.student.findUnique({
      where: { nameKey: buildNameKey("Borrar", "Uno", "1°A") },
    });
    expect(estudiante).not.toBeNull();

    const filas = await prisma.enrollment.findMany({
      where: { studentId: estudiante!.id },
    });
    expect(filas).toHaveLength(3);

    const objetivo = filas.find((fila) => fila.proposalId === 4)!;
    expect(await eliminarInscripcion(objetivo.id)).toEqual({
      ok: true,
      eliminadas: 1,
    });
    expect(
      await prisma.enrollment.findUnique({ where: { id: objetivo.id } }),
    ).toBeNull();
    expect(
      await prisma.enrollment.count({ where: { studentId: estudiante!.id } }),
    ).toBe(2);
    expect(
      await prisma.student.findUnique({ where: { id: estudiante!.id } }),
    ).not.toBeNull();
  });

  it("borra toda la tabla de una propuesta sin tocar las otras", async () => {
    const inscripcion = await inscribir({
      ...input,
      nombre: "Borrar",
      apellido: "Todo",
      propuestas: [7, 8, 9],
    });
    expect(inscripcion.ok).toBe(true);

    const estudiante = await prisma.student.findUnique({
      where: { nameKey: buildNameKey("Borrar", "Todo", "1°A") },
    });
    expect(
      await prisma.enrollment.count({ where: { proposalId: 9 } }),
    ).toBeGreaterThan(0);

    const eliminadas = await eliminarInscripcionesDePropuesta(9);
    expect(eliminadas.ok).toBe(true);
    expect(await prisma.enrollment.count({ where: { proposalId: 9 } })).toBe(0);
    expect(
      await prisma.enrollment.count({ where: { studentId: estudiante!.id } }),
    ).toBe(2);
  });

  it("avisa cuando no existe la fila o el identificador es inválido", async () => {
    expect(await eliminarInscripcion(999_999)).toMatchObject({
      ok: false,
      code: "not_found",
    });
    expect(await eliminarInscripcionesDePropuesta(999_999)).toMatchObject({
      ok: false,
      code: "not_found",
    });
    expect(await eliminarInscripcion(-1)).toMatchObject({
      ok: false,
      code: "invalid",
    });
    expect(await eliminarInscripcionesDePropuesta(Number.NaN)).toMatchObject({
      ok: false,
      code: "invalid",
    });
  });
});
