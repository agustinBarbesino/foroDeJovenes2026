import { z } from "zod";
import { COURSE_IDS, GENDERS } from "./config";

const nombre = z
  .string()
  .trim()
  .min(2, "Escribí tu nombre")
  .max(60, "El nombre es demasiado largo");

const apellido = z
  .string()
  .trim()
  .min(2, "Escribí tu apellido")
  .max(60, "El apellido es demasiado largo");

export const disponibilidadSchema = z.object({
  curso: z
    .string()
    .refine((value) => COURSE_IDS.includes(value), "Elegí un curso válido"),
  genero: z.enum(GENDERS, {
    errorMap: () => ({ message: "Elegí una opción de género válida" }),
  }),
});

export const inscripcionSchema = disponibilidadSchema.extend({
  nombre,
  apellido,
  nombreElegido: z.string().trim().max(40, "Es demasiado largo").optional().nullable(),
  propuestas: z
    .array(z.number().int().positive())
    .length(3, "Tenés que elegir exactamente 3 propuestas")
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "No podés elegir la misma propuesta dos veces",
    }),
});

export type InscripcionInput = z.infer<typeof inscripcionSchema>;
export type DisponibilidadInput = z.infer<typeof disponibilidadSchema>;

/** clave estable para detectar inscripciones duplicadas sin guardar datos en claro. */
export function buildNameKey(
  nombreValue: string,
  apellidoValue: string,
  curso: string,
): string {
  const normalize = (value: string) =>
    value.trim().replace(/\s+/g, " ").toLocaleLowerCase("es-AR");
  return `${normalize(nombreValue)}|${normalize(apellidoValue)}|${curso}`;
}
