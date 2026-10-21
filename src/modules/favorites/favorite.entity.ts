import { Entity, Index } from 'typeorm';
import { ColumnaId, ColumnaInstante, ColumnaTexto } from '../../common/db/columns.js';

@Entity('favoritos')
@Index(['usuarioId', 'lugarId'], { unique: true })
@Index(['usuarioId', 'creadoEn'])
export class FavoritoEntidad {
  @ColumnaId()
  id: string;

  @ColumnaTexto(40)
  usuarioId: string;

  @ColumnaTexto(40)
  lugarId: string;

  @ColumnaInstante()
  creadoEn: Date;
}
