import { Entity, Index } from 'typeorm';
import type { Plataforma } from '../../../contract/api.js';
import {
  ColumnaClave,
  ColumnaEnum,
  ColumnaInstante,
  ColumnaRef,
} from '../../common/db/columns.js';

/**
 * Token de Expo de un teléfono. El token es la clave: pertenece a un solo usuario a la vez
 * (si otro lo registra, pasa a ése).
 */
@Entity('dispositivos')
@Index(['usuarioId'])
export class Dispositivo {
  @ColumnaClave(255)
  tokenExpo: string;

  @ColumnaRef()
  usuarioId: string;

  @ColumnaEnum()
  plataforma: Plataforma;

  @ColumnaInstante()
  creadoEn: Date;

  @ColumnaInstante()
  actualizadoEn: Date;
}
