import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  autorizado: vi.fn(),
  eliminarInscripcion: vi.fn(),
  eliminarPropuesta: vi.fn(),
  programarSync: vi.fn(),
}));

vi.mock("../src/lib/docentes-auth", () => ({
  requestAutorizado: mocks.autorizado,
}));
vi.mock("../src/lib/eliminar-inscripciones", () => ({
  eliminarInscripcion: mocks.eliminarInscripcion,
  eliminarInscripcionesDePropuesta: mocks.eliminarPropuesta,
}));
vi.mock("../src/lib/sync-scheduler", () => ({
  programarSync: mocks.programarSync,
}));

import { DELETE as deleteUna } from "../src/app/api/docentes/inscripciones/[id]/route";
import { DELETE as deleteTodas } from "../src/app/api/docentes/inscripciones/route";

const urlUna = "http://localhost/api/docentes/inscripciones/7";
const urlTodas = "http://localhost/api/docentes/inscripciones?propuestaId=3";
const contexto = { params: Promise.resolve({ id: "7" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.autorizado.mockReturnValue(true);
  mocks.eliminarInscripcion.mockResolvedValue({ ok: true, eliminadas: 1 });
  mocks.eliminarPropuesta.mockResolvedValue({ ok: true, eliminadas: 4 });
  mocks.programarSync.mockResolvedValue(undefined);
});

describe("rutas de eliminación", () => {
  it("rechaza ambos borrados sin la cookie docente", async () => {
    mocks.autorizado.mockReturnValue(false);

    const una = await deleteUna(new NextRequest(urlUna), contexto);
    const todas = await deleteTodas(new NextRequest(urlTodas));

    expect(una.status).toBe(401);
    expect(todas.status).toBe(401);
    expect(mocks.eliminarInscripcion).not.toHaveBeenCalled();
    expect(mocks.eliminarPropuesta).not.toHaveBeenCalled();
    expect(mocks.programarSync).not.toHaveBeenCalled();
  });

  it("elimina una inscripción y reprograma la sincronización", async () => {
    const response = await deleteUna(new NextRequest(urlUna), contexto);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, eliminadas: 1 });
    expect(mocks.eliminarInscripcion).toHaveBeenCalledWith(7);
    expect(mocks.programarSync).toHaveBeenCalledTimes(1);
  });

  it("elimina toda la propuesta indicada y reprograma la sincronización", async () => {
    const response = await deleteTodas(new NextRequest(urlTodas));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, eliminadas: 4 });
    expect(mocks.eliminarPropuesta).toHaveBeenCalledWith(3);
    expect(mocks.programarSync).toHaveBeenCalledTimes(1);
  });

  it("no sincroniza si la inscripción no existía", async () => {
    mocks.eliminarInscripcion.mockResolvedValue({
      ok: false,
      code: "not_found",
      message: "Esa inscripción ya no existe.",
    });

    const response = await deleteUna(new NextRequest(urlUna), contexto);

    expect(response.status).toBe(404);
    expect(mocks.programarSync).not.toHaveBeenCalled();
  });

  it("responde 400 ante un identificador inválido", async () => {
    mocks.eliminarPropuesta.mockResolvedValue({
      ok: false,
      code: "invalid",
      message: "Esa propuesta no es válida.",
    });

    const response = await deleteTodas(
      new NextRequest("http://localhost/api/docentes/inscripciones?propuestaId=abc"),
    );

    expect(response.status).toBe(400);
    expect(mocks.programarSync).not.toHaveBeenCalled();
  });
});
