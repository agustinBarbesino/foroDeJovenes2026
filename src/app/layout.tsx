import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Foro de Jóvenes 2026",
  description: "Inscripción a las propuestas del Foro de Jóvenes",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
