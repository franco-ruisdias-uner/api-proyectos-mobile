import { Entity } from 'typeorm';
import {
  ColumnaDia,
  ColumnaHora,
  ColumnaId,
  ColumnaRef,
  ColumnaTexto,
} from '../../common/db/columns.js';

/** Bloqueo de un espacio (D12): sin `inicio` ni `fin`, cubre el día entero. */
@Entity('bloqueos')
export class BloqueoEntidad {
  @ColumnaId()
  id: string;

  @ColumnaRef()
  espacioId: string;

  @ColumnaDia()
  fecha: string;

  @ColumnaHora({ nullable: true })
  inicio: string | null;

  @ColumnaHora({ nullable: true })
  fin: string | null;

  @ColumnaTexto(200)
  motivo: string;
}
