import { Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ColumnaId, ColumnaInstante, ColumnaTexto } from '../../common/db/columns.js';
import { EventoEntidad } from '../events/event.entity.js';

/** D4: "guardar un evento" no tiene entidad en el PRD; es una tabla interna. */
@Entity('eventos_guardados')
@Index(['usuarioId', 'eventoId'], { unique: true })
@Index(['eventoId'])
export class EventoGuardadoEntidad {
  @ColumnaId()
  id: string;

  @ColumnaTexto(40)
  usuarioId: string;

  @ColumnaTexto(40)
  eventoId: string;

  @ColumnaInstante()
  creadoEn: Date;

  /** Sólo para traer y ordenar por el evento; no crea una clave foránea. */
  @ManyToOne(() => EventoEntidad, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'eventoId' })
  evento?: EventoEntidad;
}
