/**
 * Se implementa del todo en el hito de Google Sheets.
 * La interfaz ya existe para que la inscripción no dependa del módulo de sync.
 */
export async function programarSync(): Promise<void> {
  return Promise.resolve();
}

/** Sync manual del panel docente (se implementa con Google Sheets más adelante). */
export async function sincronizarAhora(): Promise<{ status: string; message: string }> {
  return { status: "not_configured", message: "Integración con Sheets en configuración" };
}
