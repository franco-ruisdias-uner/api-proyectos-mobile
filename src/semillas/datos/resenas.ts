import { estrellasParaPromedio } from '../../modulos/resenas/reglas/resenas.js';
import type { UsuarioSemilla } from './usuarios.js';

/** Vecinos de relleno: cada reseña de la demo tiene un autor distinto por comercio (R7). */
export const CANTIDAD_DE_VECINOS = 60;

export const VECINOS_DE_RELLENO: UsuarioSemilla[] = Array.from(
  { length: CANTIDAD_DE_VECINOS },
  (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return {
      id: `usr-vec${n}`,
      nombre: `Vecino ${n}`,
      email: `vecino${n}@demo.ar`,
      rol: 'vecino',
      comercioId: null,
      avisosActivos: true,
    };
  },
);

export interface ResenaSemilla {
  id: string;
  comercioId: string;
  usuarioId: string;
  estrellas: number;
  comentario: string;
  respuesta: string | null;
  /** Días antes de "ahora" en que se escribió. */
  haceDias: number;
}

export interface ReporteSemilla {
  resenaId: string;
  usuarioId: string;
}

const POSITIVOS = [
  'Muy buena atención, me asesoraron en todo.',
  'Buenos precios y mucha variedad.',
  'Siempre atienden con una sonrisa. Recomendable.',
  'Rápidos y prolijos, volvería sin dudar.',
  'Excelente calidad, lo recomiendo.',
];
const NEUTROS = ['Cumple, nada del otro mundo.', 'Está bien, aunque a veces hay que esperar.'];
const NEGATIVOS = ['Tardaron mucho en atenderme.', 'Esperaba más por el precio que pagué.'];

const comentarioPara = (estrellas: number, i: number): string => {
  const lista = estrellas >= 4 ? POSITIVOS : estrellas === 3 ? NEUTROS : NEGATIVOS;
  return lista[i % lista.length];
};

const RESPUESTA_TORNILLO = '¡Gracias, Marta! La esperamos pronto.';

/** Reseñas de Marta (`usr-512`): la del PRD (`res-2210`, con respuesta) y una más. */
const DE_MARTA = new Set(['com-118', 'com-101']);

export interface ComercioParaResenas {
  id: string;
  puntaje: number;
  cantidadResenas: number;
}

/**
 * ESPECIFICACION §8. Respalda `puntaje` y `cantidadResenas` de cada comercio con reseñas
 * reales (A20): hasta `CANTIDAD_DE_VECINOS` por comercio (el que tiene «muchas» queda en 60).
 * `res-2210` es la del PRD; una reseña de `com-125` está reportada y otra respondida.
 */
export function generarResenas(comercios: ComercioParaResenas[]): {
  resenas: ResenaSemilla[];
  reportes: ReporteSemilla[];
} {
  const resenas: ResenaSemilla[] = [];
  const reportes: ReporteSemilla[] = [];
  let contador = 3000;
  comercios.forEach((comercio, i) => {
    const cantidad = Math.min(comercio.cantidadResenas, CANTIDAD_DE_VECINOS);
    const estrellas = estrellasParaPromedio(cantidad, comercio.puntaje);
    const conMarta = DE_MARTA.has(comercio.id);
    for (let k = 0; k < cantidad; k++) {
      const esMarta = conMarta && k === 0;
      const esLaDelPrd = esMarta && comercio.id === 'com-118';
      const id = esLaDelPrd ? 'res-2210' : `res-${contador++}`;
      const relleno = VECINOS_DE_RELLENO[(i * 7 + k) % CANTIDAD_DE_VECINOS];
      resenas.push({
        id,
        comercioId: comercio.id,
        usuarioId: esMarta ? 'usr-512' : relleno.id,
        estrellas: estrellas[k],
        comentario: comentarioPara(estrellas[k], i + k),
        respuesta: esLaDelPrd ? RESPUESTA_TORNILLO : null,
        haceDias: 3 + k * 2 + (i % 5),
      });
      if (comercio.id === 'com-125' && k === 0)
        resenas[resenas.length - 1].respuesta = '¡Muchas gracias por elegirnos!';
      if (comercio.id === 'com-125' && k === 2)
        reportes.push({ resenaId: id, usuarioId: 'usr-512' });
    }
  });
  return { resenas, reportes };
}
