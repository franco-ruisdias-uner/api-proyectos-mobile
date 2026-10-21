import { Entity, Index } from 'typeorm';
import {
  ColumnaEnum,
  ColumnaIdDeCliente,
  ColumnaInstante,
  ColumnaTexto,
  ColumnaTextoLargo,
} from '../../common/db/columns.js';
import type { OrigenVisita } from '../../../contract/types.js';

@Entity('visitas')
@Index(['usuarioId', 'fechaHora', 'id'])
export class VisitaEntidad {
  @ColumnaIdDeCliente()
  id: string;

  @ColumnaTexto(40)
  usuarioId: string;

  @ColumnaTexto(40)
  lugarId: string;

  @ColumnaInstante()
  fechaHora: Date;

  @ColumnaEnum()
  origen: OrigenVisita;

  @ColumnaTexto(200, { nulo: true })
  fotoClave: string | null;

  @ColumnaTextoLargo({ nulo: true })
  nota: string | null;

  @ColumnaInstante()
  creadoEn: Date;
}
