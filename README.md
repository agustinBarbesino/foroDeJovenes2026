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

## Tratamiento de datos de género

El género individual se muestra en el panel docente protegido por contraseña. En Google Sheets las hojas por propuesta incluyen **solo agregados** por género; `Métricas` aplica supresión de celdas con pocos casos para evitar re-identificación (detalle en el README final).
