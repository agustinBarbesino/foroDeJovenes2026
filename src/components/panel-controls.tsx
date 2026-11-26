"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await fetch("/api/docentes/logout", { method: "POST" });
        router.push("/docentes");
        router.refresh();
      }}
    >
      Cerrar sesión
    </Button>
  );
}

interface SyncControlsProps {
  status: string;
  lastSyncAt: string | null;
  lastError: string | null;
}

const ETIQUETAS: Record<string, string> = {
  never: "Todavía no se sincronizó",
  ok: "Última sincronización correcta",
  error: "Error en la última sincronización",
  not_configured: "Google Sheets no está configurado",
  syncing: "Sincronizando…",
};

export function SyncControls({ status, lastSyncAt, lastError }: SyncControlsProps) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function sincronizar() {
    setCargando(true);
    setMensaje(null);
    try {
      const response = await fetch("/api/docentes/sync", { method: "POST" });
      const data = (await response.json()) as { status?: string; message?: string };
      setMensaje(data.message ?? (data.status ? ETIQUETAS[data.status] : null));
      router.refresh();
    } catch {
      setMensaje("No se pudo iniciar la sincronización");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm">
      <Button size="sm" onClick={sincronizar} disabled={cargando}>
        {cargando ? "Sincronizando…" : "Sincronizar con Google Sheets"}
      </Button>
      <span className="text-muted-foreground">
        {ETIQUETAS[status] ?? status}
        {lastSyncAt ? ` · ${new Date(lastSyncAt).toLocaleString("es-AR")}` : ""}
      </span>
      {(lastError || mensaje) && (
        <span className="text-destructive">{mensaje ?? lastError}</span>
      )}
    </div>
  );
}

interface FiltroProps {
  param: string;
  value: string;
  opciones: Array<{ value: string; label: string }>;
  etiqueta: string;
}

export function FiltroSelect({ param, value, opciones, etiqueta }: FiltroProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-medium">{etiqueta}</span>
      <select
        value={value}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set(param, event.target.value);
          params.set("view", searchParams.get("view") ?? "propuesta");
          router.push(`?${params.toString()}`);
        }}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      >
        {opciones.map((opcion) => (
          <option key={opcion.value} value={opcion.value}>
            {opcion.label}
          </option>
        ))}
      </select>
    </label>
  );
}
