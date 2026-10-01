import { Entity, Index } from 'typeorm';
import type { Plataforma } from '../../contrato/api.js';
import {
  ColumnaClave,
  ColumnaEnum,
  ColumnaInstante,
  ColumnaRef,
} from '../comun/db/columnas.js';

/** Token de push de un teléfono. Es clave primaria: un token es de un solo usuario a la vez. */
@Entity('dispositivos')
@Index(['usuarioId'])
export class Dispositivo {
  @ColumnaClave(200)
  tokenExpo: string;

  @ColumnaRef()
  usuarioId: string;

  @ColumnaEnum()
  plataforma: Plataforma;

  @ColumnaInstante()
  creadoEn: Date;
}
