# Foro de Jóvenes 2026

Inscripción de estudiantes a las propuestas del Foro de Jóvenes, con criterios explícitos de equidad por año/curso y perspectiva de género e inclusión de personas no binaries.

> Documentación completa en construcción (hito `docs/readme-final`).

## Requisitos

- Node.js 18.18 o superior.

## Instalación rápida

```bash
npm install
cp .env.example .env
npm run setup   # prisma db push + seed con 12 cursos, 14 propuestas y 337 estudiantes
npm run dev
```

La aplicación queda en `http://localhost:3000` y el panel docente en `http://localhost:3000/docentes`.

## Comandos

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm test` | Tests unitarios |
| `npm run seed` | Cargar datos iniciales |

## Algoritmo de equidad

El motor vive en `src/lib/equity.ts` y es una función pura: recibe el estado (grupos, inscripciones, tamaño y composición de cada curso) y devuelve decisiones. La misma función calcula las propuestas disponibles y elige el grupo al confirmar, así que no puede haber diferencia entre "se mostró" y "se asignó".

- **Restricciones duras**: cupo por slot `año + curso + grupo` y tope de estudiantes por año en cada grupo.
- **Equilibrio F/M**: blando y **proporcional a la composición real del curso**. Un 50/50 fijo dejaría sin lugar a cursos con mayoría de un género; por eso el objetivo por slot es `capacidad × proporción_de_mujeres_del_curso` y se busca con un puntaje. No se infiere género desde el nombre.
- **No binaries y "prefiero no decir"**: no cuentan para el balance F/M, pero ocupan el slot. El puntaje penaliza repetir personas no binaries en el mismo `grupo + curso`, para distribuirlas entre los 3 grupos.
- **Capacidad**: `BASE_SLOT_CAPACITY = 2` por curso y grupo. Como `337 × 3 = 1011` participaciones superan los `42 × 12 × 2 = 1008` lugares base, se calculan 3 lugares de overflow para el curso de 29 estudiantes y se asignan de forma determinista entre grupos distintos.
- **Propuesta completa**: se oculta cuando ninguno de sus 3 grupos puede aceptar el perfil del estudiante; globalmente se marca completa cuando todos sus slots están llenos.

Los parámetros `proposalCount`, `choicesPerStudent`, `groupsPerProposal`, `baseSlotCapacity` y `metricsMinCell` están en `src/lib/config.ts` y pueden sobreescribirse desde la tabla `Setting`.

## Tratamiento de datos de género

El género individual se muestra en el panel docente protegido por contraseña. En Google Sheets las hojas por propuesta incluyen **solo agregados** por género; `Métricas` aplica supresión de celdas con pocos casos para evitar re-identificación (detalle en el README final).
