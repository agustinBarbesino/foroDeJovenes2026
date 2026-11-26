"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginDocentes() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function ingresar(event: React.FormEvent) {
    event.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const response = await fetch("/api/docentes/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        setError(data.message ?? "No se pudo ingresar");
        return;
      }
      router.push("/docentes/panel");
      router.refresh();
    } catch {
      setError("No pudimos conectar con el servidor");
    } finally {
      setCargando(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Acceso docente</CardTitle>
        <CardDescription>
          Esta vista es solo lectura. Ingresá con la contraseña configurada.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={ingresar} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={cargando}>
            {cargando ? "Ingresando…" : "Ingresar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
