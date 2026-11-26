import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DOCENTES_COOKIE, tokenValido } from "@/lib/auth";
import {
  listarCursos,
  listarPropuestas,
  obtenerMetricas,
  obtenerPorCurso,
  obtenerPorPropuesta,
} from "@/lib/docentes-data";
import { prisma } from "@/lib/db";
import { FiltroSelect, LogoutButton, SyncControls } from "@/components/panel-controls";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type View = "propuesta" | "curso" | "metricas";

function Tabla({
  encabezados,
  filas,
}: {
  encabezados: string[];
  filas: Array<Array<string | number | null>>;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="bg-secondary text-xs uppercase tracking-wide">
          <tr>
            {encabezados.map((encabezado) => (
              <th key={encabezado} className="px-3 py-2 font-semibold">
                {encabezado}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, index) => (
            <tr key={index} className="border-t">
              {fila.map((celda, i) => (
                <td key={i} className="px-3 py-2 whitespace-nowrap">
                  {celda ?? "—"}
                </td>
              ))}
            </tr>
          ))}
          {filas.length === 0 && (
            <tr>
              <td className="px-3 py-6 text-center text-muted-foreground" colSpan={encabezados.length}>
                Todavía no hay datos para esta vista.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default async function PanelDocentes({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; propuestaId?: string; curso?: string }>;
}) {
  const cookieStore = await cookies();
  if (!tokenValido(cookieStore.get(DOCENTES_COOKIE)?.value, process.env.TEACHER_PASSWORD)) {
    redirect("/docentes");
  }

  const params = await searchParams;
  const view: View =
    params.view === "curso" || params.view === "metricas" ? params.view : "propuesta";
  const propuestaId = Number(params.propuestaId) || 1;
  const curso = params.curso || "1°A";

  const [propuestas, cursos, syncStatus] = await Promise.all([
    listarPropuestas(),
    listarCursos(),
    prisma.syncStatus.findUnique({ where: { id: 1 } }),
  ]);

  const links: Array<{ key: View; label: string }> = [
    { key: "propuesta", label: "Por propuesta" },
    { key: "curso", label: "Por curso" },
    { key: "metricas", label: "Métricas de equidad" },
  ];

  let encabezados: string[] = [];
  let filas: Array<Array<string | number | null>> = [];
  let exportUrl = "";

  if (view === "propuesta") {
    const datos = await obtenerPorPropuesta(propuestaId);
    encabezados = ["Grupo", "Nombre", "Apellido", "Nombre elegido", "Curso", "Año", "Género"];
    filas = datos.map((f) => [f.grupo, f.nombre, f.apellido, f.nombreElegido, f.curso, f.anio, f.genero]);
    exportUrl = `/api/docentes/export?view=propuesta&propuestaId=${propuestaId}`;
  } else if (view === "curso") {
    const datos = await obtenerPorCurso(curso);
    encabezados = ["Nombre", "Apellido", "Nombre elegido", "Género", "Propuesta 1", "Propuesta 2", "Propuesta 3"];
    filas = datos.map((f) => [
      f.nombre,
      f.apellido,
      f.nombreElegido,
      f.genero,
      ...[0, 1, 2].map((i) => f.propuestas[i] ?? "—"),
    ]);
    exportUrl = `/api/docentes/export?view=curso&curso=${encodeURIComponent(curso)}`;
  } else {
    const datos = await obtenerMetricas();
    encabezados = ["Propuesta", "Grupo", "Año", "Curso", "Género", "Cantidad"];
    filas = datos.map((f) => [f.propuesta, f.grupo, f.anio, f.curso, f.genero, f.cantidad]);
    exportUrl = "/api/docentes/export?view=metricas";
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Panel docente</h1>
          <p className="text-sm text-muted-foreground">
            Solo lectura. Podés exportar cada tabla y sincronizar con Google Sheets.
          </p>
        </div>
        <LogoutButton />
      </header>

      <SyncControls
        status={syncStatus?.status ?? "never"}
        lastSyncAt={syncStatus?.lastSyncAt?.toISOString() ?? null}
        lastError={syncStatus?.lastError ?? null}
      />

      <nav className="flex flex-wrap gap-2">
        {links.map((link) => (
          <Link
            key={link.key}
            href={`/docentes/panel?view=${link.key}`}
            className={cn(
              "rounded-md border px-3 py-2 text-sm",
              view === link.key
                ? "border-primary bg-primary/10 font-semibold"
                : "hover:bg-secondary",
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-4">
        {view === "propuesta" && (
          <Suspense fallback={null}>
            <FiltroSelect
              param="propuestaId"
              value={String(propuestaId)}
              etiqueta="Propuesta"
              opciones={propuestas.map((p) => ({ value: String(p.id), label: p.title }))}
            />
          </Suspense>
        )}
        {view === "curso" && (
          <Suspense fallback={null}>
            <FiltroSelect
              param="curso"
              value={curso}
              etiqueta="Curso"
              opciones={cursos.map((c) => ({ value: c.id, label: c.id }))}
            />
          </Suspense>
        )}
        <a
          href={exportUrl}
          className="rounded-md border px-3 py-2 text-sm hover:bg-secondary"
        >
          Exportar CSV
        </a>
      </div>

      <Tabla encabezados={encabezados} filas={filas} />
    </main>
  );
}
