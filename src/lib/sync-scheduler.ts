/**
 * La inscripción llama a `programarSync` sin esperar nada: si Sheets falla o
 * no está configurado, el alta del estudiante ya fue respondida.
 */
let timer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 30_000;

export async function programarSync(): Promise<void> {
  if (process.env.GOOGLE_SHEETS_AUTO_SYNC !== "true") return;
  if (timer) clearTimeout(timer);

  timer = setTimeout(async () => {
    timer = null;
    try {
      const { sincronizarAhora } = await import("./sheets");
      await sincronizarAhora();
    } catch (error) {
      console.error("Sync automática falló:", error);
    }
  }, DEBOUNCE_MS);
}

export async function sincronizarAhora() {
  const { sincronizarAhora: ejecutar } = await import("./sheets");
  return ejecutar();
}
