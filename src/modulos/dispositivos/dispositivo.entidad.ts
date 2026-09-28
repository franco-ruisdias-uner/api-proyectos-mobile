import { Entity, Index } from 'typeorm';
import type { Dispositivo } from '../../../contrato/api.js';
import { ColumnaEnum, ColumnaInstante, ColumnaTexto } from '../../comun/db/columnas.js';
import { PrimaryColumn } from 'typeorm';

@Entity('dispositivos')
export class DispositivoEntidad {
  /** El token de Expo es la clave: registrar el mismo token dos veces deja uno. */
  @PrimaryColumn({ type: 'varchar', length: 200 })
  tokenExpo: string;

  @Index()
  @ColumnaTexto(40)
  usuarioId: string;

  @ColumnaEnum()
  plataforma: Dispositivo['plataforma'];

  @ColumnaInstante()
  registradoEn: Date;
}
