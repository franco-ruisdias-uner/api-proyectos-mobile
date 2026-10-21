import { Entity } from 'typeorm';
import {
  ColumnaBooleana,
  ColumnaDia,
  ColumnaEntero,
  ColumnaHora,
  ColumnaId,
  ColumnaRef,
  ColumnaTexto,
} from '../../common/db/columns.js';

@Entity('reservas_fijas')
export class ReservaFijaEntidad {
  @ColumnaId()
  id: string;

  @ColumnaRef()
  espacioId: string;

  @ColumnaTexto(120)
  titular: string;

  /** 0 = domingo. */
  @ColumnaEntero()
  dia: number;

  @ColumnaHora()
  inicio: string;

  @ColumnaHora()
  fin: string;

  @ColumnaDia()
  desde: string;

  @ColumnaDia({ nullable: true })
  hasta: string | null;

  @ColumnaBooleana()
  activa: boolean;
}
