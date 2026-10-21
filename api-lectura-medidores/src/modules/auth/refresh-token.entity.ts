import { Entity, Index } from 'typeorm';
import {
  ColumnaEntero,
  ColumnaId,
  ColumnaInstante,
  ColumnaTexto,
} from '../../common/db/columns.js';

@Entity('tokens_refresco')
export class TokenRefrescoEntidad {
  @ColumnaId()
  id: string;

  @Index()
  @ColumnaTexto(40)
  usuarioId: string;

  @ColumnaTexto(64, { unique: true })
  hash: string;

  @ColumnaEntero()
  versionSesion: number;

  @ColumnaInstante()
  expiraEn: Date;
}
