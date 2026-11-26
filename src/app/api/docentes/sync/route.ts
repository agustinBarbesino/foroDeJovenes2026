import { NextRequest, NextResponse } from "next/server";
import { requestAutorizado } from "@/lib/docentes-auth";
import { sincronizarAhora } from "@/lib/sync-scheduler";

export async function POST(request: NextRequest) {
  if (!requestAutorizado(request)) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const resultado = await sincronizarAhora();
  return NextResponse.json(resultado);
}
