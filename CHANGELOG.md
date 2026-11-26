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

### Added

- Formulario público de inscripción con propuestas disponibles por perfil y selección de 3 opciones.
- API de inscripción transaccional con revalidación de cupos, duplicados y alternativas ante carreras.
- Tests de integración de inscripción atómica y validación Zod (4 casos).

### Added

- Panel docente protegido con contraseña, tablas por propuesta y curso, métricas de equidad y exportación CSV.
- Botón de sincronización manual con indicador de estado (integración de Sheets en el siguiente hito).

### Added

- Módulo de Google Sheets con service account, hojas `Resumen`, por propuesta, `Inscripciones` y `Métricas`, nombres sanitizados y sincronización idempotente con un reintento.
- Sync automática con debounce de 30 s, sin bloquear la inscripción cuando falla.
- Tests mockeados del payload y de la sincronización (5 casos).
- Guía de configuración, estructura y troubleshooting de Google Sheets en el README.

### Added

- README final con instalación, variables, seed, algoritmo y fórmulas, panel docente, Sheets, privacidad de género y flujo de contribución.
- Override de parámetros del motor desde variables de entorno.

### Added

- Eliminación de inscripciones desde el panel docente: una fila o toda la tabla de la propuesta filtrada, con confirmación en la UI y endpoints `DELETE` protegidos por la cookie docente.
- Los borrados conservan al estudiante con sus otras inscripciones y reprograman la sync con Google Sheets sin bloquear la respuesta.
- Tests de integración del borrado individual y masivo, y tests de autorización, validación y reprogramación de sync en las rutas (8 casos nuevos).
