"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FilaInscripcion {
  inscripcionId: number;
  grupo: number;
  nombre: string;
  apellido: string;
  nombreElegido: string | null;
  curso: string;
  anio: number;
  genero: string;
}

interface TablaInscripcionesProps {
  propuestaId: number;
  titulo: string;
  filas: FilaInscripcion[];
}

interface Mensaje {
  texto: string;
  error: boolean;
}

const ENCABEZADOS = [
  "Grupo",
  "Nombre",
  "Apellido",
  "Nombre elegido",
  "Curso",
  "Año",
  "Género",
  "Acciones",
];

/** Tabla de una propuesta con borrado individual y de toda la tabla. */
export function TablaInscripciones({
  propuestaId,
  titulo,
  filas,
}: TablaInscripcionesProps) {
  const router = useRouter();
  const [eliminando, setEliminando] = useState<number | null>(null);
  const [eliminandoTodo, setEliminandoTodo] = useState(false);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);

  const ocupado = eliminando !== null || eliminandoTodo;

  async function eliminarUno(fila: FilaInscripcion) {
    const nombre = fila.nombreElegido ?? fila.nombre;
    const confirmado = window.confirm(
      `¿Eliminar la inscripción de ${nombre} ${fila.apellido} en ${titulo} (grupo ${fila.grupo})? El estudiante conserva sus otras inscripciones.`,
    );
    if (!confirmado) return;

    setEliminando(fila.inscripcionId);
    setMensaje(null);
    try {
      const response = await fetch(
        `/api/docentes/inscripciones/${fila.inscripcionId}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as {
        message?: string;
        eliminadas?: number;
      };
      if (!response.ok) {
        throw new Error(data.message ?? "No se pudo eliminar la inscripción");
      }
      setMensaje({
        texto: `Se eliminó la inscripción de ${nombre} ${fila.apellido}.`,
        error: false,
      });
      router.refresh();
    } catch (error) {
      setMensaje({
        texto: error instanceof Error ? error.message : "No se pudo eliminar la inscripción",
        error: true,
      });
    } finally {
      setEliminando(null);
    }
  }

  async function eliminarTodo() {
    const confirmado = window.confirm(
      `¿Eliminar las ${filas.length} inscripciones de ${titulo} (toda la tabla de esta propuesta)? Esta acción no se puede deshacer.`,
    );
    if (!confirmado) return;

    setEliminandoTodo(true);
    setMensaje(null);
    try {
      const response = await fetch(
        `/api/docentes/inscripciones?propuestaId=${propuestaId}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as {
        message?: string;
        eliminadas?: number;
      };
      if (!response.ok) {
        throw new Error(data.message ?? "No se pudieron eliminar las inscripciones");
      }
      setMensaje({
        texto: `Se eliminaron ${data.eliminadas ?? filas.length} inscripciones de ${titulo}.`,
        error: false,
      });
      router.refresh();
    } catch (error) {
      setMensaje({
        texto: error instanceof Error ? error.message : "No se pudieron eliminar las inscripciones",
        error: true,
      });
    } finally {
      setEliminandoTodo(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {filas.length} {filas.length === 1 ? "inscripción" : "inscripciones"} en esta propuesta.
        </p>
        <Button
          variant="destructive"
          size="sm"
          onClick={eliminarTodo}
          disabled={filas.length === 0 || ocupado}
        >
          {eliminandoTodo ? "Eliminando…" : "Eliminar toda la tabla"}
        </Button>
      </div>

      {mensaje && (
        <p
          role="status"
          className={cn("text-sm", mensaje.error ? "text-destructive" : "text-primary")}
        >
          {mensaje.texto}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wide">
            <tr>
              {ENCABEZADOS.map((encabezado) => (
                <th key={encabezado} className="px-3 py-2 font-semibold">
                  {encabezado}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.inscripcionId} className="border-t">
                <td className="px-3 py-2 whitespace-nowrap">{fila.grupo}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fila.nombre}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fila.apellido}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fila.nombreElegido ?? "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fila.curso}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fila.anio}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fila.genero}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => eliminarUno(fila)}
                    disabled={ocupado}
                  >
                    {eliminando === fila.inscripcionId ? "Eliminando…" : "Eliminar"}
                  </Button>
                </td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td
                  className="px-3 py-6 text-center text-muted-foreground"
                  colSpan={ENCABEZADOS.length}
                >
                  Todavía no hay datos para esta vista.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
