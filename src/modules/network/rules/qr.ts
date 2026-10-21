const FORMATO = /^PARANA:(par-[A-Za-z0-9_-]{1,36})$/;

export const codigoQrDe = (paradaId: string) => `PARANA:${paradaId}`;

/** El id de parada de un código QR, o `null` si no tiene el formato de Paraná (R4). */
export function paradaIdDeQr(codigo: string): string | null {
  return FORMATO.exec(codigo)?.[1] ?? null;
}
