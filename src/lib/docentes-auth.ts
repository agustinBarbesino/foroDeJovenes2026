import type { NextRequest } from "next/server";
import { DOCENTES_COOKIE, tokenValido } from "./auth";

export function requestAutorizado(request: NextRequest): boolean {
  return tokenValido(
    request.cookies.get(DOCENTES_COOKIE)?.value,
    process.env.TEACHER_PASSWORD,
  );
}
