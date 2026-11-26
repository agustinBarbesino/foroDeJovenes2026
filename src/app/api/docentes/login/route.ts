import { NextResponse } from "next/server";
import { createDocentesToken, DOCENTES_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { password?: string };
  const password = process.env.TEACHER_PASSWORD;

  if (!password || body.password !== password) {
    return NextResponse.json({ message: "Contraseña incorrecta" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(DOCENTES_COOKIE, createDocentesToken(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}
