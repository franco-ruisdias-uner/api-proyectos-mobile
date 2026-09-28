const PREFIJO = 'COLON:';
const ID_DE_LUGAR = /^lug-[A-Za-z0-9_-]{1,36}$/;

/** D5: el contenido del QR del cartel de un lugar. */
export function codigoQrDe(lugarId: string): string {
  return `${PREFIJO}${lugarId}`;
}

/**
 * R6: el id del lugar si el texto es un QR de Mi Ciudad (`COLON:<lugarId>`); si no, `null`.
 * Se toleran espacios y saltos de línea alrededor, que agregan algunos lectores.
 */
export function leerCodigoQr(texto: string): string | null {
  const limpio = texto.trim();
  if (!limpio.startsWith(PREFIJO)) return null;
  const id = limpio.slice(PREFIJO.length);
  return ID_DE_LUGAR.test(id) ? id : null;
}
