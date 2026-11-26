import { NextRequest, NextResponse } from "next/server";
import { requestAutorizado } from "@/lib/docentes-auth";
import {
  aCsv,
} from "@/lib/csv";
import {
  filasCursoCsv,
  filasMetricasCsv,
  filasPropuestaCsv,
  obtenerMetricas,
  obtenerPorCurso,
  obtenerPorPropuesta,
} from "@/lib/docentes-data";

export async function GET(request: NextRequest) {
  if (!requestAutorizado(request)) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const view = params.get("view") ?? "propuesta";
  const propuestaId = Number(params.get("propuestaId"));
  const curso = params.get("curso");

  let nombre = "export";
  let filas: Array<Array<string | number | null>>;

  if (view === "curso") {
    filas = filasCursoCsv(await obtenerPorCurso(curso ?? undefined));
    nombre = curso ? `curso-${curso}` : "cursos";
  } else if (view === "metricas") {
    filas = filasMetricasCsv(await obtenerMetricas());
    nombre = "metricas";
  } else {
    filas = filasPropuestaCsv(
      await obtenerPorPropuesta(Number.isFinite(propuestaId) ? propuestaId : undefined),
    );
    nombre = propuestaId ? `propuesta-${propuestaId}` : "propuestas";
  }

  return new NextResponse(aCsv(filas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
