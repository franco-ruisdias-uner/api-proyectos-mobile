const KBPS_MPEG2_CAPA3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const KBPS_MPEG1_CAPA3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];

/**
 * Duración de un MP3 de tasa constante: bytes × 8 / tasa del primer cuadro. Es otro cálculo que
 * el de la API (que recorre los cuadros), para comprobar R20 de forma independiente.
 */
export function duracionMp3Constante(mp3: Buffer): number {
  if (mp3[0] !== 0xff || (mp3[1] & 0xe0) !== 0xe0) throw new Error('No empieza con un cuadro MP3');
  const mpeg1 = ((mp3[1] >> 3) & 0b11) === 3;
  const kbps = (mpeg1 ? KBPS_MPEG1_CAPA3 : KBPS_MPEG2_CAPA3)[mp3[2] >> 4];
  return (mp3.length * 8) / (kbps * 1000);
}
