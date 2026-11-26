# Changelog

Todos los cambios notables se documentan acá. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

### Added

- Scaffold inicial: Next.js + TypeScript + Tailwind, Prisma/SQLite, Vitest, ESLint.
- `.gitignore` y `.env.example` con exclusión de secretos y credenciales de Google.

### Added

- Schema de Prisma con cursos, estudiantes, propuestas, grupos, inscripciones y estado de sincronización.
- Seed determinista con 12 cursos, 14 propuestas, 337 estudiantes y casos de desbalance de género.

### Added

- Motor puro de equidad con restricciones duras por año/curso, balance F/M proporcional, distribución de personas no binaries y overflow de capacidad.
- Carga del estado desde Prisma y tests unitarios del motor (8 casos).
