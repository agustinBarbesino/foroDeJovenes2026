import { NextResponse } from "next/server";
import { inscribir } from "@/lib/enrollment";
import { programarSync } from "@/lib/sync-scheduler";
import { inscripcionSchema } from "@/lib/validation";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Datos inválidos" }, { status: 400 });
  }

  const parsed = inscripcionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Revisá los datos" },
      { status: 400 },
    );
  }

  const result = await inscribir(parsed.data);
  if (!result.ok) {
    return NextResponse.json(result, {
      status: result.code === "duplicate" ? 409 : result.code === "invalid" ? 400 : 409,
    });
  }

  // La sincronización nunca bloquea la respuesta del estudiante.
  void programarSync().catch(() => undefined);

  return NextResponse.json(result, { status: 201 });
}
