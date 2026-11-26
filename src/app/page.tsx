import { InscripcionForm } from "@/components/inscripcion-form";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Foro de Jóvenes 2026</h1>
        <p className="text-muted-foreground">
          Elegí tres propuestas para participar. Buscamos que cada grupo tenga
          estudiantes de todos los años y cursos, con lugar para todas las identidades.
        </p>
      </header>
      <InscripcionForm />
    </main>
  );
}
