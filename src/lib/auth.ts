import { createHmac, timingSafeEqual } from "node:crypto";

export const DOCENTES_COOKIE = "foro_docentes";
const SESSION_MESSAGE = "foro-de-jovenes-2026:docentes";

/** Token derivado de la contraseña: no guardamos la contraseña en la cookie. */
export function createDocentesToken(password: string): string {
  return createHmac("sha256", password).update(SESSION_MESSAGE).digest("hex");
}

export function tokenValido(token: string | undefined, password: string | undefined): boolean {
  if (!token || !password) return false;
  const expected = createDocentesToken(password);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function passwordConfigurada(): boolean {
  return Boolean(process.env.TEACHER_PASSWORD);
}
