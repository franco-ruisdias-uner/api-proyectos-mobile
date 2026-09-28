import type { Categoria } from '../../../contrato/tipos.js';
import type { CategoriaEntidad } from './categoria.entidad.js';

/** La única salida de una categoría hacia el cliente. */
export function aContrato(c: CategoriaEntidad): Categoria {
  return { id: c.id, nombre: c.nombre, icono: c.icono, color: c.color, orden: c.orden };
}
