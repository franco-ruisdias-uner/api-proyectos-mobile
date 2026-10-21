import { randomInt } from 'node:crypto';
import { clasificarPromocion, type PromocionEvaluable } from '../../promotions/rules/promotions.js';

/** D8: letras y números sin los que se confunden (0/O, 1/I): 24 letras + 8 dígitos. */
export const ALFABETO_DE_CODIGOS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const CODIGO = new RegExp(`^CCU-[${ALFABETO_DE_CODIGOS}]{4}-[${ALFABETO_DE_CODIGOS}]{4}$`);

type Azar = (maximoExclusivo: number) => number;

/** `CCU-XXXX-XXXX`. El azar es criptográfico: el código no se puede adivinar. */
export function generarCodigoDeUso(azar: Azar = (n) => randomInt(n)): string {
  const tramo = () =>
    Array.from({ length: 4 }, () => ALFABETO_DE_CODIGOS[azar(ALFABETO_DE_CODIGOS.length)]).join('');
  return `CCU-${tramo()}-${tramo()}`;
}

export const codigoDeUsoValido = (texto: string): boolean => CODIGO.test(texto);

/** Lo que escribe o escanea el comercio: sin espacios sobrantes y en mayúsculas. */
export const normalizarCodigo = (texto: string): string => texto.trim().toUpperCase();

const ID_DE_USO = /^uso-[A-Za-z0-9_-]{3,36}$/;
export const esIdDeUso = (id: string): boolean => ID_DE_USO.test(id);

/** R11 y R12: por qué una promo no admite (más) usos, o `null` si está vigente. */
export function motivoDeNoUso(
  promo: PromocionEvaluable,
  ahora: Date,
): 'PROMO_VENCIDA' | 'PROMO_NO_EMPEZO' | null {
  const situacion = clasificarPromocion(promo, ahora);
  if (situacion === 'vigente') return null;
  return situacion === 'proxima' ? 'PROMO_NO_EMPEZO' : 'PROMO_VENCIDA';
}
