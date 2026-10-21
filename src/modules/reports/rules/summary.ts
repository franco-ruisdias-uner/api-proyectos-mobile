export type AgruparPor = 'linea' | 'parada';

export interface FilaDeReporte {
  lineaId: string;
  paradaId: string;
  confirmaciones: number;
  fechaHora: Date;
}

export interface GrupoDeReportes {
  lineaId: string;
  paradaId: string | null;
  cantidad: number;
  confirmaciones: number;
  ultimo: Date;
}

/**
 * D8: agrupa los reportes por línea (`paradaId` null) o por línea y parada. Orden: más reportes
 * primero, y si empatan, por línea y parada (determinístico).
 */
export function resumirReportes(filas: FilaDeReporte[], agrupar: AgruparPor): GrupoDeReportes[] {
  const grupos = new Map<string, GrupoDeReportes>();
  for (const f of filas) {
    const paradaId = agrupar === 'parada' ? f.paradaId : null;
    const clave = `${f.lineaId}|${paradaId ?? ''}`;
    const grupo = grupos.get(clave);
    if (!grupo) {
      grupos.set(clave, {
        lineaId: f.lineaId,
        paradaId,
        cantidad: 1,
        confirmaciones: f.confirmaciones,
        ultimo: f.fechaHora,
      });
      continue;
    }
    grupo.cantidad++;
    grupo.confirmaciones += f.confirmaciones;
    if (f.fechaHora > grupo.ultimo) grupo.ultimo = f.fechaHora;
  }
  return [...grupos.values()].sort(
    (a, b) =>
      b.cantidad - a.cantidad ||
      a.lineaId.localeCompare(b.lineaId) ||
      (a.paradaId ?? '').localeCompare(b.paradaId ?? ''),
  );
}
