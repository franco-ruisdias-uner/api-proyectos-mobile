// Fechas en la zona de Villaguay (AGENTS §4.3 y §6). Nunca la zona del proceso.
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

export const ZONA = 'America/Argentina/Buenos_Aires';

const ISO_CON_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const DIA = /^(\d{4})-(\d{2})-(\d{2})$/;
const HORA = /^([01]\d|2[0-4]):([0-5]\d)$/;

/** Instante → "2026-11-14T21:00:00-03:00" (sin milisegundos, con el offset de Argentina). */
export function aIsoConZona(instante: Date): string {
  return format(
    new TZDate(instante.getTime(), ZONA),
    "yyyy-MM-dd'T'HH:mm:ssXXX",
  );
}

/** Lee un instante ISO 8601 que trae offset o Z. Devuelve null si no es válido. */
export function leerInstante(texto: string): Date | null {
  if (!ISO_CON_OFFSET.test(texto)) return null;
  const ms = Date.parse(texto);
  return Number.isNaN(ms) ? null : new Date(ms);
}

/** El día "AAAA-MM-DD" de un instante, en hora argentina. */
export function diaEnZona(instante: Date): string {
  return format(new TZDate(instante.getTime(), ZONA), 'yyyy-MM-dd');
}

/** Día de la semana de un día "AAAA-MM-DD" (0 = domingo). No depende de la zona. */
export function diaDeSemana(dia: string): number {
  const partes = leerPartesDeDia(dia);
  if (!partes) throw new Error(`Día inválido: ${dia}`);
  return new Date(
    Date.UTC(partes.anio, partes.mes - 1, partes.dia),
  ).getUTCDay();
}

/** ¿Es un "AAAA-MM-DD" que existe en el calendario? */
export function esDiaValido(dia: string): boolean {
  return leerPartesDeDia(dia) !== null;
}

/** ¿Es un "HH:MM" válido? Admite "24:00" (fin del último turno, D8). */
export function esHoraValida(hora: string): boolean {
  const m = HORA.exec(hora);
  if (!m) return false;
  return m[1] !== '24' || m[2] === '00';
}

/** Suma días a un "AAAA-MM-DD" y devuelve otro "AAAA-MM-DD". */
export function sumarDias(dia: string, dias: number): string {
  const partes = leerPartesDeDia(dia);
  if (!partes) throw new Error(`Día inválido: ${dia}`);
  const fecha = new Date(
    Date.UTC(partes.anio, partes.mes - 1, partes.dia + dias),
  );
  return fecha.toISOString().slice(0, 10);
}

/**
 * El instante de un día y una hora de reloj en Villaguay. "24:00" es la medianoche
 * del día siguiente.
 */
export function instanteEnZona(dia: string, hora: string): Date {
  const partes = leerPartesDeDia(dia);
  if (!partes || !esHoraValida(hora))
    throw new Error(`Día u hora inválidos: ${dia} ${hora}`);
  const [hh, mm] = hora.split(':').map(Number);
  return new Date(
    new TZDate(partes.anio, partes.mes - 1, partes.dia, hh, mm, ZONA).getTime(),
  );
}

function leerPartesDeDia(
  dia: string,
): { anio: number; mes: number; dia: number } | null {
  const m = DIA.exec(dia);
  if (!m) return null;
  const [anio, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, d));
  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== d
  ) {
    return null;
  }
  return { anio, mes, dia: d };
}
