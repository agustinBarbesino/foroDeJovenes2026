/**
 * Sincronización idempotente con Google Sheets API v4 (service account).
 *
 * Privacidad acordada:
 *  - Las hojas por propuesta NO incluyen género individual; muestran un bloque
 *    agregado y columnas de identificación sin ese dato.
 *  - `Inscripciones` conserva Género con las 4 etiquetas exactas.
 *  - `Métricas` es agregada y suprime celdas con menos de `metricsMinCell`
 *    casos para evitar re-identificación en celdas chicas.
 */

import { google, type sheets_v4 } from "googleapis";
import { prisma } from "./db";
import {
  DEFAULT_EQUITY_CONFIG,
  GENDERS,
  type Gender,
} from "./config";
import { loadEquityState } from "./equity-store";
import { propuestaCompleta } from "./equity";
import {
  listarPropuestas,
  obtenerMetricas,
  obtenerPorPropuesta,
} from "./docentes-data";
import { getEquityConfig } from "./settings";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const RESERVED_NAMES = ["Resumen", "Inscripciones", "Métricas"];

export interface SheetPayload {
  name: string;
  rows: Array<Array<string | number>>;
}

export interface FilaPorPropuesta {
  grupo: number;
  anio: number;
  curso: string;
  genero: string;
  nombre: string;
  apellido: string;
  nombreElegido: string | null;
}

export interface FilaInscripcionPlana {
  nombre: string;
  apellido: string;
  nombreElegido: string | null;
  curso: string;
  anio: number;
  genero: string;
  propuesta: string;
  grupo: number;
}

export interface SheetsData {
  generatedAt: string;
  totalInscriptos: number;
  participaciones: number;
  propuestas: Array<{
    id: number;
    titulo: string;
    completa: boolean;
    inscriptos: number;
  }>;
  porPropuesta: Array<{
    propuestaId: number;
    titulo: string;
    filas: FilaPorPropuesta[];
  }>;
  inscripciones: FilaInscripcionPlana[];
  metricas: Array<{
    propuesta: string;
    grupo: number;
    anio: number;
    curso: string;
    genero: string;
    cantidad: number;
  }>;
  metricsMinCell: number;
}

/** Nombres válidos: ≤31 caracteres, sin / \ ? * [ ] ni duplicados. */
export function sanitizeSheetName(title: string, used: Set<string>): string {
  let base = title
    .replace(/[\\/?*:]/g, " ")
    .replace(/[\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31)
    .trim();

  if (!base) base = "Propuesta";
  if (RESERVED_NAMES.includes(base)) base = `Prop. ${base}`.slice(0, 31);

  if (!used.has(base)) {
    used.add(base);
    return base;
  }

  for (let suffix = 2; ; suffix++) {
    const text = ` (${suffix})`;
    const candidate = `${base.slice(0, 31 - text.length)}${text}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
}

function quote(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

function ordenarFilas(filas: FilaPorPropuesta[]): FilaPorPropuesta[] {
  const ordenGenero = (genero: string) => {
    const index = GENDERS.indexOf(genero as Gender);
    return index === -1 ? 99 : index;
  };
  return [...filas].sort(
    (a, b) =>
      a.grupo - b.grupo ||
      a.anio - b.anio ||
      a.curso.localeCompare(b.curso, "es") ||
      ordenGenero(a.genero) - ordenGenero(b.genero) ||
      a.apellido.localeCompare(b.apellido, "es"),
  );
}

/** Genera todas las hojas a partir de un estado ya cargado (función pura). */
export function buildSheetsPayload(data: SheetsData): SheetPayload[] {
  const used = new Set<string>(RESERVED_NAMES);
  const payload: SheetPayload[] = [];

  payload.push({
    name: "Resumen",
    rows: [
      ["Foro de Jóvenes 2026"],
      ["Generado", data.generatedAt],
      ["Total inscriptos", data.totalInscriptos],
      ["Participaciones", data.participaciones],
      ["Propuestas activas", data.propuestas.length],
      [],
      ["Propuesta", "Estado", "Inscriptos", "Grupos"],
      ...data.propuestas.map((propuesta) => [
        propuesta.titulo,
        propuesta.completa ? "Completa" : "Con lugar",
        propuesta.inscriptos,
        3,
      ]),
      [],
      ["Nota de privacidad", "Las hojas por propuesta no incluyen género individual"],
    ],
  });

  for (const propuesta of data.porPropuesta) {
    const filas = ordenarFilas(propuesta.filas);
    const conteo = Object.fromEntries(GENDERS.map((g) => [g, 0])) as Record<string, number>;
    for (const fila of filas) conteo[fila.genero] = (conteo[fila.genero] ?? 0) + 1;

    payload.push({
      name: sanitizeSheetName(propuesta.titulo, used),
      rows: [
        ["Propuesta", propuesta.titulo],
        ["Género (agregado)", "Cantidad"],
        ...GENDERS.map((genero) => [genero, conteo[genero]]),
        [],
        // Sin columna de género individual, según la decisión de privacidad.
        ["Grupo", "Año", "Curso", "Nombre", "Apellido", "Nombre elegido"],
        ...filas.map((fila) => [
          fila.grupo,
          fila.anio,
          fila.curso,
          fila.nombre,
          fila.apellido,
          fila.nombreElegido ?? "",
        ]),
      ],
    });
  }

  payload.push({
    name: "Inscripciones",
    rows: [
      ["Nombre", "Apellido", "Nombre elegido", "Curso", "Año", "Género", "Propuesta", "Grupo"],
      ...data.inscripciones.map((fila) => [
        fila.nombre,
        fila.apellido,
        fila.nombreElegido ?? "",
        fila.curso,
        fila.anio,
        fila.genero,
        fila.propuesta,
        fila.grupo,
      ]),
    ],
  });

  payload.push({
    name: "Métricas",
    rows: [
      ["Propuesta", "Grupo", "Año", "Curso", "Género", "Cantidad"],
      ...data.metricas.map((fila) => [
        fila.propuesta,
        fila.grupo,
        fila.anio,
        fila.curso,
        fila.genero,
        fila.cantidad < data.metricsMinCell
          ? `<${data.metricsMinCell}`
          : fila.cantidad,
      ]),
    ],
  });

  return payload;
}

function privateKey(): string | null {
  const value = process.env.GOOGLE_PRIVATE_KEY;
  if (!value) return null;
  // En .env la clave se pega con \n literales.
  return value.replace(/\\n/g, "\n");
}

export function sheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      privateKey() &&
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
  );
}

async function buildData(): Promise<SheetsData> {
  const [state, config, propuestas, porPropuesta, metricas, totalInscriptos, participaciones] =
    await Promise.all([
      loadEquityState(prisma),
      getEquityConfig(prisma),
      listarPropuestas(),
      obtenerPorPropuesta(),
      obtenerMetricas(),
      prisma.student.count(),
      prisma.enrollment.count(),
    ]);

  const porPropuestaData = propuestas.map((propuesta) => ({
    propuestaId: propuesta.id,
    titulo: propuesta.title,
    filas: porPropuesta
      .filter((fila) => fila.propuestaId === propuesta.id)
      .map((fila) => ({
        grupo: fila.grupo,
        anio: fila.anio,
        curso: fila.curso,
        genero: fila.genero,
        nombre: fila.nombre,
        apellido: fila.apellido,
        nombreElegido: fila.nombreElegido,
      })),
  }));

  const tituloPorId = new Map(propuestas.map((p) => [p.id, p.title]));
  const inscripciones: FilaInscripcionPlana[] = porPropuesta.map((fila) => ({
    nombre: fila.nombre,
    apellido: fila.apellido,
    nombreElegido: fila.nombreElegido,
    curso: fila.curso,
    anio: fila.anio,
    genero: fila.genero,
    propuesta: tituloPorId.get(fila.propuestaId) ?? "",
    grupo: fila.grupo,
  }));

  return {
    generatedAt: new Date().toISOString(),
    totalInscriptos,
    participaciones,
    propuestas: propuestas.map((propuesta) => ({
      id: propuesta.id,
      titulo: propuesta.title,
      completa: propuestaCompleta(state, propuesta.id, config),
      inscriptos: porPropuesta.filter((f) => f.propuestaId === propuesta.id).length,
    })),
    porPropuesta: porPropuestaData,
    inscripciones,
    metricas,
    metricsMinCell: config.metricsMinCell ?? DEFAULT_EQUITY_CONFIG.metricsMinCell,
  };
}

async function setStatus(status: string, error: string | null, now?: Date) {
  await prisma.syncStatus.upsert({
    where: { id: 1 },
    create: { id: 1, status, lastError: error, lastSyncAt: now },
    update: { status, lastError: error, ...(now ? { lastSyncAt: now } : {}) },
  });
}

async function withRetry<T>(operacion: () => Promise<T>): Promise<T> {
  try {
    return await operacion();
  } catch (error) {
    console.error("Fallo de Google Sheets, reintentando una vez:", error);
    await new Promise((resolve) => setTimeout(resolve, 500));
    return operacion();
  }
}

/** Client factory separada para poder inyectar un mock en los tests. */
export function createSheetsClient(): sheets_v4.Sheets | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = privateKey();
  if (!email || !key) return null;
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: SCOPES,
  });
  return google.sheets({ version: "v4", auth });
}

export interface SyncOptions {
  client?: sheets_v4.Sheets;
  spreadsheetId?: string;
}

/** Escribe todas las hojas de forma idempotente: clear + update por hoja. */
export async function sincronizarAhora(
  options: SyncOptions = {},
): Promise<{ status: string; message: string }> {
  const client = options.client ?? createSheetsClient();
  const spreadsheetId = options.spreadsheetId ?? process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!client || !spreadsheetId) {
    await setStatus("not_configured", "Faltan variables de Google Sheets");
    return {
      status: "not_configured",
      message: "Google Sheets no está configurado. La inscripción sigue funcionando.",
    };
  }

  await setStatus("syncing", null);
  try {
    const payload = buildSheetsPayload(await buildData());

    await withRetry(async () => {
      const spreadsheet = await client.spreadsheets.get({
        spreadsheetId,
        fields: "sheets.properties.title",
      });
      const existentes = new Set(
        spreadsheet.data.sheets?.map((s) => s.properties?.title ?? "") ?? [],
      );
      const faltantes = payload.filter((hoja) => !existentes.has(hoja.name));
      if (faltantes.length > 0) {
        await client.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: faltantes.map((hoja) => ({
              addSheet: { properties: { title: hoja.name } },
            })),
          },
        });
      }

      for (const hoja of payload) {
        await client.spreadsheets.values.clear({
          spreadsheetId,
          range: quote(hoja.name),
        });
        await client.spreadsheets.values.update({
          spreadsheetId,
          range: `${quote(hoja.name)}!A1`,
          valueInputOption: "RAW",
          requestBody: { values: hoja.rows },
        });
      }
    });

    await setStatus("ok", null, new Date());
    return { status: "ok", message: `Sincronizadas ${payload.length} hojas con Google Sheets.` };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message.slice(0, 500) : String(error);
    console.error("No se pudo sincronizar con Google Sheets:", error);
    await setStatus("error", mensaje);
    return { status: "error", message: `No se pudo sincronizar: ${mensaje}` };
  }
}
