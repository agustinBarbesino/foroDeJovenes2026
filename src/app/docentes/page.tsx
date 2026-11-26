import { LoginDocentes } from "@/components/login-docentes";

export const metadata = { title: "Acceso docente | Foro de Jóvenes" };

export default function PaginaDocentes() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold">Panel docente</h1>
      <LoginDocentes />
    </main>
  );
}
