"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COURSE_IDS, GENDERS, type Gender } from "@/lib/config";
import { cn } from "@/lib/utils";

interface Propuesta {
  id: number;
  title: string;
  description: string;
}

interface Asignacion {
  propuestaId: number;
  titulo: string;
  grupo: number;
}

interface RespuestaInscripcion {
  ok: boolean;
  message?: string;
  sinCupo?: number[];
  alternativas?: number[];
  asignaciones?: Asignacion[];
}

type Perfil = {
  nombre: string;
  apellido: string;
  curso: string;
  genero: Gender | "";
  nombreElegido: string;
};

const perfilInicial: Perfil = {
  nombre: "",
  apellido: "",
  curso: "",
  genero: "",
  nombreElegido: "",
};

export function InscripcionForm() {
  const [perfil, setPerfil] = useState<Perfil>(perfilInicial);
  const [propuestas, setPropuestas] = useState<Propuesta[]>([]);
  const [seleccionadas, setSeleccionadas] = useState<number[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [asignaciones, setAsignaciones] = useState<Asignacion[] | null>(null);

  const update = (key: keyof Perfil, value: string) => {
    setPerfil((prev) => ({ ...prev, [key]: value }));
    setMensaje(null);
  };

  async function buscarPropuestas(event: React.FormEvent) {
    event.preventDefault();
    setMensaje(null);
    setBuscando(true);
    try {
      const response = await fetch("/api/propuestas-disponibles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curso: perfil.curso, genero: perfil.genero }),
      });
      const data = (await response.json()) as {
        propuestas?: Propuesta[];
        message?: string;
      };
      if (!response.ok) {
        setMensaje(data.message ?? "No pudimos buscar las propuestas. Probá de nuevo.");
        return;
      }
      setPropuestas(data.propuestas ?? []);
      setSeleccionadas([]);
      if ((data.propuestas ?? []).length === 0) {
        setMensaje("Por ahora no hay propuestas con lugar para tu curso. Probá más tarde.");
      }
    } catch {
      setMensaje("No pudimos conectar con el servidor. Probá de nuevo.");
    } finally {
      setBuscando(false);
    }
  }

  function toggle(id: number) {
    setMensaje(null);
    setSeleccionadas((prev) => {
      if (prev.includes(id)) return prev.filter((value) => value !== id);
      if (prev.length >= 3) {
        setMensaje("Ya elegiste 3 propuestas. Si querés cambiar una, destildala primero.");
        return prev;
      }
      return [...prev, id];
    });
  }

  async function confirmar() {
    if (seleccionadas.length !== 3) {
      setMensaje("Tenés que elegir exactamente 3 propuestas.");
      return;
    }
    setEnviando(true);
    setMensaje(null);
    try {
      const response = await fetch("/api/inscripciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...perfil,
          nombreElegido: perfil.nombreElegido || null,
          propuestas: seleccionadas,
        }),
      });
      const data = (await response.json()) as RespuestaInscripcion;

      if (response.ok && data.ok && data.asignaciones) {
        setAsignaciones(data.asignaciones);
        return;
      }

      setMensaje(
        data.message ?? "No pudimos completar la inscripción. Probá de nuevo.",
      );
      if (data.sinCupo?.length) {
        setSeleccionadas((prev) =>
          prev.filter((id) => !data.sinCupo?.includes(id)),
        );
      }
      if (data.alternativas) {
        setPropuestas((prev) =>
          prev.filter(
            (propuesta) =>
              data.alternativas?.includes(propuesta.id) ||
              !data.sinCupo?.includes(propuesta.id),
          ),
        );
      }
    } catch {
      setMensaje("No pudimos conectar con el servidor. Probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  function reiniciar() {
    setPerfil(perfilInicial);
    setPropuestas([]);
    setSeleccionadas([]);
    setAsignaciones(null);
    setMensaje(null);
  }

  if (asignaciones) {
    return (
      <Card className="mx-auto w-full max-w-2xl">
        <CardHeader>
          <CardTitle>¡Listo, {perfil.nombreElegido || perfil.nombre}! Quedaste inscripto/a.</CardTitle>
          <CardDescription>
            Estas son tus 3 propuestas y el grupo que te tocó.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2">
            {asignaciones.map((asignacion) => (
              <li
                key={asignacion.propuestaId}
                className="flex items-center justify-between rounded-md bg-secondary px-4 py-3"
              >
                <span>{asignacion.titulo}</span>
                <strong>Grupo {asignacion.grupo}</strong>
              </li>
            ))}
          </ul>
          <Button variant="outline" onClick={reiniciar}>
            Anotar a otra persona
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tus datos</CardTitle>
          <CardDescription>
            No necesitás iniciar sesión. Solo necesitamos tu curso para cuidar la equidad.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={buscarPropuestas} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={perfil.nombre}
                onChange={(e) => update("nombre", e.target.value)}
                autoComplete="given-name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apellido">Apellido</Label>
              <Input
                id="apellido"
                value={perfil.apellido}
                onChange={(e) => update("apellido", e.target.value)}
                autoComplete="family-name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="curso">Curso</Label>
              <select
                id="curso"
                value={perfil.curso}
                onChange={(e) => update("curso", e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">Elegí tu curso</option>
                {COURSE_IDS.map((curso) => (
                  <option key={curso} value={curso}>
                    {curso}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="genero">Género</Label>
              <select
                id="genero"
                value={perfil.genero}
                onChange={(e) => update("genero", e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">Elegí una opción</option>
                {GENDERS.map((genero) => (
                  <option key={genero} value={genero}>
                    {genero}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="nombreElegido">
                Nombre autopercibido / ¿Cómo querés que te llamemos? (opcional)
              </Label>
              <Input
                id="nombreElegido"
                value={perfil.nombreElegido}
                onChange={(e) => update("nombreElegido", e.target.value)}
                placeholder="Tu nombre elegido, si querés"
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={buscando}>
                {buscando ? "Buscando…" : "Ver propuestas disponibles"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {mensaje && (
        <div
          role="status"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
        >
          {mensaje}
        </div>
      )}

      {propuestas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Elegí 3 propuestas</CardTitle>
            <CardDescription>
              Ya seleccionaste {seleccionadas.length} de 3. Las propuestas completas no aparecen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              {propuestas.map((propuesta) => {
                const activa = seleccionadas.includes(propuesta.id);
                return (
                  <button
                    key={propuesta.id}
                    type="button"
                    onClick={() => toggle(propuesta.id)}
                    aria-pressed={activa}
                    className={cn(
                      "rounded-lg border p-4 text-left transition-colors hover:bg-secondary",
                      activa && "border-primary bg-primary/5 ring-2 ring-primary/30",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="font-semibold">{propuesta.title}</h4>
                      <span
                        className={cn(
                          "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs",
                          activa && "border-primary bg-primary text-primary-foreground",
                        )}
                      >
                        {activa ? "✓" : ""}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {propuesta.description}
                    </p>
                  </button>
                );
              })}
            </div>
            <Button onClick={confirmar} disabled={seleccionadas.length !== 3 || enviando}>
              {enviando ? "Confirmando…" : "Confirmar inscripción"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
