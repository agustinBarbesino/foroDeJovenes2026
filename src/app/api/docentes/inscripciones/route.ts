import { NextRequest, NextResponse } from "next/server";
import { requestAutorizado } from "@/lib/docentes-auth";
import { eliminarInscripcionesDePropuesta } from "@/lib/eliminar-inscripciones";
import { programarSync } from "@/lib/sync-scheduler";

export async function DELETE(request: NextRequest) {
  if (!requestAutorizado(request)) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const propuestaId = Number(request.nextUrl.searchParams.get("propuestaId"));
  const resultado = await eliminarInscripcionesDePropuesta(propuestaId);
  if (!resultado.ok) {
    return NextResponse.json(resultado, {
      status: resultado.code === "invalid" ? 400 : 404,
    });
  }

  // Igual que el alta: un problema de Sheets nunca bloquea el borrado.
  void programarSync().catch(() => undefined);

  return NextResponse.json(resultado);
}
