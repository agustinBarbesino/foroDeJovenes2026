/** CSV con BOM para que Excel abra correctamente los acentos. */
export function aCsv(filas: Array<Array<string | number | null>>): string {
  const escapar = (valor: string | number | null) => {
    const texto = valor === null || valor === undefined ? "" : String(valor);
    return `"${texto.replace(/"/g, '""')}"`;
  };
  return `\uFEFF${filas.map((fila) => fila.map(escapar).join(",")).join("\r\n")}\r\n`;
}
