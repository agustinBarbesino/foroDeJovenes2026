# Foro de Jóvenes 2026

Aplicación web completa para la inscripción de estudiantes a las propuestas del Foro de Jóvenes de una escuela secundaria técnica, con criterios explícitos de equidad por año/curso y de inclusión de personas no binaries.

- **Frontend y backend**: Next.js (App Router), React, TypeScript, Tailwind CSS y componentes estilo shadcn/ui.
- **Datos**: SQLite con Prisma, transacciones para la inscripción atómica.
- **Validación**: Zod.
- **Tests**: Vitest (motor de equidad, inscripción, panel y Sheets mockeado).
- **Integración**: Google Sheets API v4 con service account.

## Requisitos

- Node.js 18.18 o superior (probado con Node 18.19).
- Un spreadsheet de Google y un service account si se quiere sincronización (opcional: la app funciona sin esto).

## Instalación y ejecución

```bash
npm install
cp .env.example .env
npm run setup   # prisma db push + seed: 12 cursos, 14 propuestas y 337 estudiantes
npm run dev
```

- Formulario público: <http://localhost:3000>
- Panel docente: <http://localhost:3000/docentes> (contraseña: `TEACHER_PASSWORD` en `.env`)

Para producción:

```bash
npm run build
npm start
```

### Variables de entorno

| Variable | Descripción | Default |
| --- | --- | --- |
| `DATABASE_URL` | Archivo SQLite (por defecto `file:./dev.db`, relativo a `prisma/`) | obligatoria |
| `TEACHER_PASSWORD` | Contraseña del panel docente | obligatoria |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Correo del service account | opcional |
| `GOOGLE_PRIVATE_KEY` | Clave privada con `\n` literales | opcional |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Id del spreadsheet | opcional |
| `GOOGLE_SHEETS_AUTO_SYNC` | `true` habilita el debounce de 30 s | `false` |
| `PROPOSAL_COUNT` | Cantidad de propuestas | `14` |
| `GROUPS_PER_PROPOSAL` | Grupos por propuesta | `3` |
| `CHOICES_PER_STUDENT` | Propuestas que elige cada estudiante | `3` |
| `BASE_SLOT_CAPACITY` | Cupo base por año+curso+grupo | `2` |
| `METRICS_MIN_CELL` | Mínimo de casos para publicar una celda agregada | `3` |

Los parámetros también pueden cambiarse en la fila `equityConfig` de la tabla `Setting`. Si cambiás `PROPOSAL_COUNT` o `GROUPS_PER_PROPOSAL`, volvé a correr `npm run setup` para recrear grupos.

### Comandos

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build y servidor de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm test` | 19 tests con Vitest (usa `prisma/test.db`, aislado) |
| `npm run db:push` | Sincronizar el schema con la base |
| `npm run seed` | Recargar datos iniciales |
| `npm run setup` | `db:push` + `seed` |

## Datos iniciales

El seed es determinista y genera:

- Los 12 cursos con la nomenclatura exacta: `1°A`, `1°B`, `2°A`, `2°B`, `3°A`, `3°B`, `5°MMO`, `5°IP`, `6°MMO`, `6°IP`, `7°MMO`, `7°IP`. Los 4° años organizan y no se cargan como asistentes.
- 14 propuestas (incluidas "Género y diversidad", "Nuevas masculinidades" y "Disidencias y derechos"), con 3 grupos cada una.
- 337 estudiantes: 28 por curso y 29 en `7°IP`. Incluye 8 estudiantes no binaries, 5 que prefirieron no decir y 7 nombres autopercibidos.
- Casos de desbalance estructural: `1°B` tiene mayoría de mujeres y `2°A` mayoría de varones, para probar el algoritmo.

## Formulario de inscripción

La ruta `/` es pública. Se cargan nombre, apellido, curso, género y un nombre autopercibido opcional ("¿Cómo querés que te llamemos?"). Después se muestran las propuestas con lugar para ese perfil y se eligen exactamente 3.

La confirmación (`POST /api/inscripciones`) valida todo con Zod, revalida los cupos **dentro de una transacción** y crea las 3 inscripciones juntas. Si una propuesta se completó en el medio, no se crea nada: se devuelve el aviso y las alternativas, y el formulario conserva los datos ya cargados. Tampoco se permite duplicar propuesta ni inscribir dos veces a la misma persona (nombre + apellido + curso).

## Panel docente

Ruta `/docentes`, protegida con `TEACHER_PASSWORD` mediante una cookie httpOnly con token HMAC (la contraseña nunca viaja en la cookie). Es solo lectura:

- **Por propuesta**: 3 grupos con nombre, apellido, nombre elegido, curso, año, género y grupo.
- **Por curso**: estudiantes del curso con sus 3 propuestas y grupos.
- **Métricas de equidad**: agregado por propuesta × grupo × año × curso × género (4 categorías).
- Exportación CSV de cada tabla (con BOM para Excel) y botón "Sincronizar con Google Sheets" con el estado de la última sync.

## Algoritmo de equidad

El motor vive en `src/lib/equity.ts` y es una función pura: recibe el estado (grupos, inscripciones, tamaño y composición de cada curso) y devuelve decisiones. La misma función calcula las propuestas disponibles y elige el grupo al confirmar, así que no puede haber diferencia entre "se mostró" y "se asignó".

- **Restricciones duras**: cupo por slot `año + curso + grupo` y tope de estudiantes por año en cada grupo (`ceil(capacidad_del_grupo / 6)`).
- **Equilibrio F/M**: blando y **proporcional a la composición real del curso**. Un 50/50 fijo dejaría sin lugar a cursos con mayoría de un género; por eso el objetivo por slot es `capacidad × proporción_de_mujeres_del_curso` y se busca con un puntaje. No se infiere género a partir del nombre.
- **No binaries y "prefiero no decir"**: no cuentan para el balance F/M, pero ocupan el slot. El puntaje penaliza repetir personas no binaries en el mismo `grupo + curso`, para distribuirlas entre los 3 grupos sin clustering. Nunca se les asigna un slot binario ni se les infiere sexo.
- **Capacidad**: `BASE_SLOT_CAPACITY = 2` por curso y grupo. Como `337 × 3 = 1011` participaciones superan los `42 × 12 × 2 = 1008` lugares base, se calculan 3 lugares de overflow para el curso de 29 estudiantes y se asignan de forma determinista entre grupos distintos.
- **Propuesta completa**: se oculta cuando ninguno de sus 3 grupos puede aceptar el perfil del estudiante; globalmente se marca completa cuando todos sus slots están llenos.

Fórmulas clave:

```text
participaciones      = estudiantes × CHOICES_PER_STUDENT = 337 × 3 = 1011
grupos               = PROPOSAL_COUNT × GROUPS_PER_PROPOSAL = 14 × 3 = 42
lugares base         = grupos × cursos × BASE_SLOT_CAPACITY = 42 × 12 × 2 = 1008
overflow por curso   = CHOICES_PER_STUDENT × estudiantes_del_curso - grupos × BASE_SLOT_CAPACITY
máximo por año/grupo = ceil(capacidad_total_del_grupo / 6)
objetivo F por slot  = round(capacidad_del_slot × mujeres_del_curso / binarios_del_curso)
```

Si un slot está lleno se prueba otro grupo de la misma propuesta; si ninguno sirve, la propuesta no se ofrece. La inscripción ordena las propuestas elegidas por escasez antes de asignar.

## Google Sheets

### Configuración

1. En Google Cloud, creá (o elegí) un proyecto y habilitá **Google Sheets API**.
2. Creá un **service account** y descargá su JSON. No lo commitees: se excluye con `.gitignore`.
3. Compartí el spreadsheet con el correo del service account (`...iam.gserviceaccount.com`) con permiso de **Editor**.
4. Completá las variables de Google en `.env` (ver tabla arriba):

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL="cuenta@proyecto.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_SPREADSHEET_ID="id_del_spreadsheet"
GOOGLE_SHEETS_AUTO_SYNC="true"
```

La clave privada va entre comillas dobles con los saltos de línea como `\n` literales.

### Estructura del spreadsheet

- **`Resumen`**: total de inscriptos, participaciones, propuestas activas, estado de cada propuesta y fecha de generación.
- **Una hoja por propuesta**: nombre sanitizado (≤31 caracteres, sin `/ \ ? * [ ]`, sin duplicados), con un bloque de conteo agregado por género y las columnas `Grupo`, `Año`, `Curso`, `Nombre`, `Apellido`, `Nombre elegido`. **No incluye género individual**. El orden de las filas es grupo → año → curso → género → apellido.
- **`Inscripciones`**: `Nombre`, `Apellido`, `Nombre elegido`, `Curso`, `Año`, `Género`, `Propuesta`, `Grupo`.
- **`Métricas`**: agregado por propuesta × grupo × año × curso × género, sin datos personales; celdas con menos de `METRICS_MIN_CELL` casos se publican como `<3`.

### Sync

El botón "Sincronizar con Google Sheets" del panel docente fuerza una sync. Si `GOOGLE_SHEETS_AUTO_SYNC=true`, cada inscripción programa una sync con **debounce de 30 s**. La escritura es idempotente: se aseguran las hojas, se limpia cada rango y se vuelve a cargar (`values.clear` + `values.update`). Ante un error se reintenta una vez y queda registrado en `SyncStatus`, visible en el panel. **Si Sheets falla o no está configurado, la inscripción no se bloquea.**

> En un proceso Node largo (`next start`) el debounce funciona con `setTimeout`. En despliegues serverless conviene reemplazarlo por un cron que llame a `POST /api/docentes/sync`.

### Troubleshooting

| Síntoma | Causa probable |
| --- | --- |
| Estado `not_configured` | Faltan variables de Google en `.env` |
| `403 Forbidden` | El spreadsheet no está compartido con el service account como Editor |
| `404 Not found` | `GOOGLE_SHEETS_SPREADSHEET_ID` incorrecto |
| `invalid_grant` | Clave privada mal pegada: revisá los `\n` y las comillas |
| Estado `error` en el panel | Revisá `lastError` y los logs del servidor; se reintentó una vez |

## Tratamiento de datos de género

El campo se llama **Género**, es obligatorio y tiene exactamente cuatro opciones: `Femenino`, `Masculino`, `No binario` y `Prefiero no decir`. No hay un campo libre "Otro", no se infiere género a partir del nombre legal y el nombre autopercibido es opcional y nunca reemplaza al nombre legal. La UI usa "estudiantes", voseo rioplatense y evita suponer género en mensajes y validaciones.

- **Panel docente (protegido)**: muestra el género individual y el nombre elegido.
- **Hojas por propuesta en Sheets**: solo agregados por género; no hay columna individual.
- **`Inscripciones` en Sheets**: conserva `Género` con las cuatro etiquetas exactas, porque es la trazabilidad plana acordada. Su acceso debe estar restringido a quien administra el spreadsheet.
- **`Métricas`**: solo agregados, con supresión de celdas con menos de 3 casos.

Esta decisión reduce las copias del dato sensible sin perder la auditoría: el detalle vivo está en la base de datos y en el panel, no se replica en 14 hojas.

## Contribución

El repositorio es <https://github.com/agustinBarbesino/foroDeJovenes2026>. El flujo es obligatorio:

1. **Nunca** trabajar directo sobre `main`. Crear una rama por hito:
   `chore/<descripcion>`, `feat/<descripcion>`, `fix/<descripcion>`, `docs/<descripcion>`.
2. Commits atómicos con [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`. Mensajes en español, con cuerpo cuando el "por qué" no sea obvio.
3. Antes de cada push: `npm run lint && npm run typecheck && npm test`. No pushear con errores.
4. Al terminar el hito, pushear la rama y abrir un Pull Request contra `main` con qué cambia y cómo probarlo.
5. Actualizar `README.md` y `CHANGELOG.md` en cada PR relevante.
6. Nunca commitear `.env`, JSON de service account, `node_modules/`, `dist/` ni `.next/` (ver `.gitignore`).

Historial de hitos: `chore/setup-inicial` → `feat/modelo-datos-y-seed` → `feat/motor-asignacion` → `feat/formulario-inscripcion` → `feat/panel-docentes` → `feat/integracion-sheets` → `docs/readme-final`.
