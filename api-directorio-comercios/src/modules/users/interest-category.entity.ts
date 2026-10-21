import { Entity } from 'typeorm';
import { ColumnaEntero, ColumnaId } from '../../common/db/columns.js';

/** Un rubro que le interesa a un usuario; `posicion` guarda el orden en que lo eligió. */
@Entity('rubros_de_interes')
export class RubroDeInteres {
  @ColumnaId()
  usuarioId: string;

  @ColumnaId()
  rubroId: string;

  @ColumnaEntero()
  posicion: number;
}
