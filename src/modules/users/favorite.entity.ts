import { Entity, Index } from 'typeorm';
import { ColumnaId, ColumnaInstante } from '../../common/db/columns.js';

/** Un comercio favorito de un usuario. La clave compuesta impide repetirlo. */
@Entity('favoritos')
@Index(['usuarioId', 'creadoEn'])
export class Favorito {
  @ColumnaId()
  usuarioId: string;

  @ColumnaId()
  comercioId: string;

  @ColumnaInstante()
  creadoEn: Date;
}
