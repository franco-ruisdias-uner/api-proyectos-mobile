import { generarCodigoDeUso } from '../../modules/redemptions/rules/redemptions.js';
import { PROMOCIONES } from './promotions.js';
import { VECINOS_DE_RELLENO } from './reviews.js';

export interface UsoSemilla {
  id: string;
  promocionId: string;
  usuarioId: string;
  codigo: string;
  /** Posición entre los validados de la promo (`0..total-1`), o `null` si está sin validar. */
  validado: { posicion: number; total: number } | null;
}

/** El código del PRD (`uso-7781`): el de Marta en `pro-441`, todavía sin mostrar en el mostrador. */
export const CODIGO_DE_MARTA = 'CCU-7KQ4-M9XH';

/**
 * ESPECIFICACION §8: usos validados y pendientes. Cada promo tiene tantos usos validados como
 * dice su `usos` (R13, A20): Marta es una de las que validó `pro-444`; el resto son vecinos de
 * relleno. Los pendientes: `uso-7781` de Marta y dos códigos más sin validar.
 */
export function generarUsos(): UsoSemilla[] {
  const codigos = new Set([CODIGO_DE_MARTA]);
  const codigoNuevo = (): string => {
    let c = generarCodigoDeUso();
    while (codigos.has(c)) c = generarCodigoDeUso();
    codigos.add(c);
    return c;
  };

  const usos: UsoSemilla[] = [];
  let n = 0;
  for (const p of PROMOCIONES) {
    for (let k = 0; k < p.usos; k++) {
      const deMarta = p.id === 'pro-444' && k === 0;
      n += 1;
      usos.push({
        id: `uso-s${String(n).padStart(3, '0')}`,
        promocionId: p.id,
        usuarioId: deMarta ? 'usr-512' : VECINOS_DE_RELLENO[k].id,
        codigo: codigoNuevo(),
        validado: { posicion: k, total: p.usos },
      });
    }
  }
  usos.push(
    {
      id: 'uso-7781',
      promocionId: 'pro-441',
      usuarioId: 'usr-512',
      codigo: CODIGO_DE_MARTA,
      validado: null,
    },
    {
      id: 'uso-s900',
      promocionId: 'pro-441',
      usuarioId: 'usr-vec30',
      codigo: codigoNuevo(),
      validado: null,
    },
    {
      id: 'uso-s901',
      promocionId: 'pro-450',
      usuarioId: 'usr-vec31',
      codigo: codigoNuevo(),
      validado: null,
    },
  );
  return usos;
}
