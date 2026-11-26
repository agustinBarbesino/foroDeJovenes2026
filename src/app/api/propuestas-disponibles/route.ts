import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { propuestasDisponibles } from "@/lib/equity";
import { loadEquityState } from "@/lib/equity-store";
import { getEquityConfig } from "@/lib/settings";
import { disponibilidadSchema } from "@/lib/validation";

/** No guarda nada: calcula qué propuestas aceptan al perfil recibido. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Datos inválidos" }, { status: 400 });
  }

  const parsed = disponibilidadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Revisá los datos" },
      { status: 400 },
    );
  }

  const state = await loadEquityState(prisma);
  const config = await getEquityConfig(prisma);
  const ids = propuestasDisponibles(
    state,
    { courseId: parsed.data.curso, gender: parsed.data.genero },
    config,
  );

  const propuestas = await prisma.proposal.findMany({
    where: { id: { in: ids }, active: true },
    select: { id: true, title: true, description: true },
    orderBy: { id: "asc" },
  });

  return NextResponse.json({ propuestas });
}
