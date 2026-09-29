import { Entity, Index } from 'typeorm';
import {
  ColumnaEnum,
  ColumnaIdDeCliente,
  ColumnaInstante,
  ColumnaTexto,
  ColumnaTextoLargo,
} from '../../comun/db/columnas.js';
import type { OrigenVisita } from '../../../contrato/tipos.js';

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
