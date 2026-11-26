import { describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db";
import {
  buildSheetsPayload,
  sanitizeSheetName,
  sincronizarAhora,
  type SheetsData,
} from "../src/lib/sheets";

const datos: SheetsData = {
  generatedAt: "2026-11-26T00:00:00.000Z",
  totalInscriptos: 3,
  participaciones: 9,
  propuestas: [{ id: 1, titulo: "Género y diversidad", completa: false, inscriptos: 3 }],
  porPropuesta: [
    {
      propuestaId: 1,
      titulo: "Género y diversidad",
      filas: [
        {
          grupo: 1,
          anio: 1,
          curso: "1°A",
          genero: "Femenino",
          nombre: "Ana",
          apellido: "Pérez",
          nombreElegido: null,
        },
        {
          grupo: 2,
          anio: 1,
          curso: "1°A",
          genero: "No binario",
          nombre: "Lu",
          apellido: "Gómez",
          nombreElegido: "Luchi",
        },
        {
          grupo: 3,
          anio: 1,
          curso: "1°A",
          genero: "Masculino",
          nombre: "Sol",
          apellido: "Díaz",
          nombreElegido: null,
        },
      ],
    },
  ],
  inscripciones: [
    {
      nombre: "Lu",
      apellido: "Gómez",
      nombreElegido: "Luchi",
      curso: "1°A",
      anio: 1,
      genero: "No binario",
      propuesta: "Género y diversidad",
      grupo: 2,
    },
  ],
  metricas: [
    { propuesta: "Género y diversidad", grupo: 1, anio: 1, curso: "1°A", genero: "Femenino", cantidad: 1 },
    { propuesta: "Género y diversidad", grupo: 2, anio: 1, curso: "1°A", genero: "Masculino", cantidad: 4 },
  ],
  metricsMinCell: 3,
};

describe("nombres de hojas", () => {
  it("sanitiza caracteres inválidos, limita a 31 caracteres y evita duplicados", () => {
    const usadas = new Set<string>();
    const a = sanitizeSheetName("Cambio climático y sostenibilidad", usadas);
    const b = sanitizeSheetName("Cambio climático y sostenibilidad", usadas);
    expect(a.length).toBeLessThanOrEqual(31);
    expect(b.length).toBeLessThanOrEqual(31);
    expect(a).not.toBe(b);
    expect(sanitizeSheetName("Riesgo / ? * [ ]", usadas)).not.toMatch(/[\\/?*[\]]/);
  });
});

describe("payload de Google Sheets", () => {
  const hojas = buildSheetsPayload(datos);

  it("genera Resumen, hoja por propuesta, Inscripciones y Métricas", () => {
    expect(hojas.map((hoja) => hoja.name)).toEqual([
      "Resumen",
      "Género y diversidad",
      "Inscripciones",
      "Métricas",
    ]);
  });

  it("no expone género individual en la hoja de la propuesta", () => {
    const hoja = hojas.find((h) => h.name === "Género y diversidad")!;
    const encabezado = hoja.rows.find((fila) => fila[0] === "Grupo")!;
    expect(encabezado).not.toContain("Género");
    expect(hoja.rows.some((fila) => fila[0] === "Género (agregado)")).toBe(true);
    expect(
      hoja.rows.some((fila) => fila.includes("No binario") && fila[1] === 1),
    ).toBe(true);
  });

  it("mantiene las 4 etiquetas exactas en Inscripciones y suprime celdas chicas en Métricas", () => {
    const inscripciones = hojas.find((h) => h.name === "Inscripciones")!;
    expect(inscripciones.rows[0]).toContain("Género");
    expect(inscripciones.rows[1]).toContain("No binario");

    const metricas = hojas.find((h) => h.name === "Métricas")!;
    expect(metricas.rows).toContainEqual([
      "Género y diversidad", 1, 1, "1°A", "Femenino", "<3",
    ]);
    expect(metricas.rows).toContainEqual([
      "Género y diversidad", 2, 1, "1°A", "Masculino", 4,
    ]);
  });
});

describe("sincronización mockeada", () => {
  it("crea hojas faltantes, limpia y actualiza, y reintenta una vez", async () => {
    let getCount = 0;
    let batchCount = 0;
    let clearCount = 0;
    let updateCount = 0;
    const client = {
      spreadsheets: {
        get: async () => {
          getCount++;
          if (getCount === 1) throw new Error("error temporal de red");
          return { data: { sheets: [] } };
        },
        batchUpdate: async () => {
          batchCount++;
          return {};
        },
        values: {
          clear: async () => {
            clearCount++;
            return {};
          },
          update: async () => {
            updateCount++;
            return {};
          },
        },
      },
    };

    const resultado = await sincronizarAhora({
      client: client as never,
      spreadsheetId: "spreadsheet-de-prueba",
    });

    expect(resultado.status).toBe("ok");
    expect(getCount).toBe(2); // un reintento
    expect(batchCount).toBeGreaterThan(0);
    expect(clearCount).toBeGreaterThan(0);
    expect(updateCount).toBe(clearCount);

    const estado = await prisma.syncStatus.findUnique({ where: { id: 1 } });
    expect(estado?.status).toBe("ok");
  });
});
