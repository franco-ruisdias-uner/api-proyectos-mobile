import { Entity, Unique } from 'typeorm';
import {
  ColumnaEntero,
  ColumnaId,
  ColumnaTexto,
} from '../../comun/db/columnas.js';

/**
 * Un suministro dentro de una ruta, con su posición en el recorrido (R4). El orden de la
 * ruta sale siempre de `posicion`. `bimestre` se repite acá para que la base garantice que un
 * suministro no esté en dos rutas del mismo bimestre (R5), también con pedidos simultáneos.
 */
@Entity('rutas_suministros')
@Unique(['bimestre', 'suministroId'])
@Unique(['rutaId', 'posicion'])
export class RutaSuministroEntidad {
  @ColumnaId()
  rutaId: string;

  @ColumnaId()
  suministroId: string;

  @ColumnaTexto(7)
  bimestre: string;

  /** 0, 1, 2… en el orden del recorrido. */
  @ColumnaEntero()
  posicion: number;
}
