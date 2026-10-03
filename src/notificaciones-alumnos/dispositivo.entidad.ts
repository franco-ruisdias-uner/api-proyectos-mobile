import { Entity, Index, PrimaryColumn } from 'typeorm';
import { ColumnaEnum, ColumnaInstante, ColumnaRef } from '../comun/db/columnas.js';
import type { Plataforma } from '../comun/notificaciones/puertos.js';

/** Un teléfono registrado para recibir push. Cada token pertenece a un solo usuario. */
@Entity('dispositivos')
export class Dispositivo {
  // El token de Expo es la clave: no tiene prefijo de id porque lo genera Expo.
  @PrimaryColumn({ type: 'varchar', length: 200 })
  tokenExpo: string;

  @Index()
  @ColumnaRef()
  usuarioId: string;

  @ColumnaEnum()
  plataforma: Plataforma;

  @ColumnaInstante()
  actualizadoEn: Date;
}
