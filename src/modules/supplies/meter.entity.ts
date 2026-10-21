import { Entity } from 'typeorm';
import type { ModeloMedidor } from '../../../contract/types.js';
import {
  ColumnaEntero,
  ColumnaEnum,
  ColumnaId,
  ColumnaInstante,
  ColumnaTexto,
} from '../../common/db/columns.js';

@Entity('medidores')
export class MedidorEntidad {
  @ColumnaId()
  id: string;

  @ColumnaTexto(40)
  serie: string;

  @ColumnaEnum()
  modelo: ModeloMedidor;

  @ColumnaEntero()
  multiplicador: number;

  @ColumnaEntero()
  digitos: number;

  /** Clave del video en el almacén de archivos; el mapeador la hace URL absoluta. */
  @ColumnaTexto(200, { nullable: true })
  videoClave: string | null;

  @ColumnaTexto(100, { nullable: true, unique: true })
  codigoQr: string | null;

  @ColumnaInstante()
  instaladoEn: Date;
}
