import { Entity } from 'typeorm';
import type { Coordenadas, Gravedad } from '../../../contrato/tipos.js';
import {
  ColumnaEnum,
  ColumnaId,
  ColumnaInstante,
  ColumnaJson,
  ColumnaTexto,
  ColumnaTextoLargo,
} from '../../comun/db/columnas.js';

/** Un aviso de la Dirección de Transporte. Las líneas a las que afecta están en `aviso_lineas`. */
@Entity('avisos')
export class AvisoEntidad {
  @ColumnaId()
  id: string;

  @ColumnaTexto(200)
  titulo: string;

  @ColumnaTextoLargo()
  detalle: string;

  @ColumnaInstante()
  desde: Date;

  /** Sin fin, mientras sea null. */
  @ColumnaInstante({ nullable: true })
  hasta: Date | null;

  @ColumnaEnum()
  gravedad: Gravedad;

  @ColumnaJson({ nullable: true })
  trazadoAlternativo: Coordenadas[] | null;

  /** La clave del archivo (AGENTS §8), no la URL: el mapeador la hace absoluta. */
  @ColumnaTexto(200, { nullable: true })
  videoClave: string | null;
}
