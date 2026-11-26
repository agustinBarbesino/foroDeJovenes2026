import { describe, expect, it } from "vitest";
import { createDocentesToken, tokenValido } from "../src/lib/auth";
import { aCsv } from "../src/lib/csv";

describe("autenticación docente", () => {
  it("acepta solo el token derivado de la contraseña configurada", () => {
    const password = "clave-de-prueba";
    const token = createDocentesToken(password);
    expect(tokenValido(token, password)).toBe(true);
    expect(tokenValido(token, "otra-clave")).toBe(false);
    expect(tokenValido(undefined, password)).toBe(false);
  });
});

describe("exportación CSV", () => {
  it("escapa comillas y agrega BOM para Excel", () => {
    const csv = aCsv([["Nombre", "Género"], ['"Ana", "No binario"', "No binario"]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"""Ana"", ""No binario"""');
    expect(csv).toContain("\r\n");
  });
});
