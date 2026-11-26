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

## Formulario de inscripción

La ruta `/` es pública: se cargan nombre, apellido, curso, género y nombre autopercibido opcional. Después se muestran las propuestas con lugar para ese perfil y se eligen exactamente 3.

La confirmación (`POST /api/inscripciones`) valida todo con Zod, revalida los cupos **dentro de una transacción** y crea las 3 inscripciones juntas. Si una propuesta se completó en el medio, no se crea nada: se devuelve el aviso y las alternativas, y el formulario conserva los datos ya cargados.

## Panel docente

La ruta es `/docentes` y la contraseña se define en `TEACHER_PASSWORD` (ver `.env.example`). Es solo lectura: permite ver las tablas por propuesta y por curso, las métricas con las 4 categorías de género, exportar CSV y sincronizar con Google Sheets.

## Algoritmo de equidad

El motor vive en `src/lib/equity.ts` y es una función pura: recibe el estado (grupos, inscripciones, tamaño y composición de cada curso) y devuelve decisiones. La misma función calcula las propuestas disponibles y elige el grupo al confirmar, así que no puede haber diferencia entre "se mostró" y "se asignó".

- **Restricciones duras**: cupo por slot `año + curso + grupo` y tope de estudiantes por año en cada grupo.
- **Equilibrio F/M**: blando y **proporcional a la composición real del curso**. Un 50/50 fijo dejaría sin lugar a cursos con mayoría de un género; por eso el objetivo por slot es `capacidad × proporción_de_mujeres_del_curso` y se busca con un puntaje. No se infiere género desde el nombre.
- **No binaries y "prefiero no decir"**: no cuentan para el balance F/M, pero ocupan el slot. El puntaje penaliza repetir personas no binaries en el mismo `grupo + curso`, para distribuirlas entre los 3 grupos.
- **Capacidad**: `BASE_SLOT_CAPACITY = 2` por curso y grupo. Como `337 × 3 = 1011` participaciones superan los `42 × 12 × 2 = 1008` lugares base, se calculan 3 lugares de overflow para el curso de 29 estudiantes y se asignan de forma determinista entre grupos distintos.
- **Propuesta completa**: se oculta cuando ninguno de sus 3 grupos puede aceptar el perfil del estudiante; globalmente se marca completa cuando todos sus slots están llenos.

Los parámetros `proposalCount`, `choicesPerStudent`, `groupsPerProposal`, `baseSlotCapacity` y `metricsMinCell` están en `src/lib/config.ts` y pueden sobreescribirse desde la tabla `Setting`.

## Google Sheets

### Configuración

1. En Google Cloud, creá (o elegí) un proyecto y habilitá **Google Sheets API**.
2. Creá un **service account** y descargá su JSON. No lo commitees: se excluye con `.gitignore`.
3. Compartí el spreadsheet con el correo del service account (`...iam.gserviceaccount.com`) con permiso de **Editor**.
4. Copiá `.env.example` a `.env` y completá:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL="cuenta@proyecto.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_SPREADSHEET_ID="id_del_spreadsheet"
GOOGLE_SHEETS_AUTO_SYNC="true"
```

La clave privada va entre comillas dobles con los saltos de línea como `\n` literales.

### Estructura del spreadsheet

- **`Resumen`**: total de inscriptos, participaciones, propuestas activas y estado de cada propuesta.
- **Una hoja por propuesta**: nombre sanitizado (≤31 caracteres, sin `/ \ ? * [ ]`), con un bloque de conteo agregado por género y las columnas `Grupo`, `Año`, `Curso`, `Nombre`, `Apellido`, `Nombre elegido`. **No incluye género individual**.
- **`Inscripciones`**: `Nombre`, `Apellido`, `Nombre elegido`, `Curso`, `Año`, `Género`, `Propuesta`, `Grupo`.
- **`Métricas`**: agregado por propuesta × grupo × año × curso × género, sin datos personales; las celdas con menos de `METRICS_MIN_CELL` casos se muestran como `<3` para evitar re-identificación.

### Sync

El botón "Sincronizar con Google Sheets" del panel docente fuerza una sync. Si `GOOGLE_SHEETS_AUTO_SYNC=true`, cada inscripción programa una sync con **debounce de 30 s**. La escritura es idempotente: se aseguran las hojas, se limpia cada rango y se vuelve a cargar. Ante un error se reintenta una vez y queda registrado en `SyncStatus`, visible en el panel. **Si Sheets falla o no está configurado, la inscripción no se bloquea.**

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

El campo se llama **Género**, es obligatorio y tiene exactamente cuatro opciones: `Femenino`, `Masculino`, `No binario` y `Prefiero no decir`. No hay un campo libre "Otro", no se infería género a partir del nombre legal y el nombre autopercibido es opcional y nunca reemplaza al nombre legal.

- **Panel docente (protegido)**: muestra el género individual y el nombre elegido.
- **Hojas por propuesta en Sheets**: solo agregados por género; no hay columna individual.
- **`Inscripciones` en Sheets**: conserva `Género` con las cuatro etiquetas exactas, porque es la trazabilidad plana acordada. Su acceso debe estar restringido a quien administra el spreadsheet.
- **`Métricas`**: solo agregados, con supresión de celdas con menos de 3 casos.

Esta decisión reduce las copias del dato sensible sin perder la auditoría: el detalle vivo está en la base de datos y en el panel, no se replica en 14 hojas.
