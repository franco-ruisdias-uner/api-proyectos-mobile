import { Entity, Index } from 'typeorm';
import {
  ColumnaBooleana,
  ColumnaDecimal,
  ColumnaEntero,
  ColumnaId,
  ColumnaInstante,
  ColumnaTexto,
} from '../../comun/db/columnas.js';

/**
 * Una lectura cargada en el campo. Nada se borra: la vigente de cada suministro y ruta se
 * elige con `elegirVigente` (R13). La foto se guarda como clave del almacén.
 */
@Entity('lecturas')
@Index(['rutaId', 'suministroId'])
export class LecturaEntidad {
  @ColumnaId()
  id: string;

  @ColumnaTexto(40)
  rutaId: string;

  @ColumnaTexto(40)
  suministroId: string;

  @ColumnaTexto(40)
  lectorId: string;

  @ColumnaEntero()
  valor: number;

  @ColumnaDecimal()
  consumo: number;

  @ColumnaTexto(200)
  fotoClave: string;

  @ColumnaDecimal({ nullable: true })
  latitud: number | null;

  @ColumnaDecimal({ nullable: true })
  longitud: number | null;

  @ColumnaBooleana()
  fueraDeRango: boolean;

  @ColumnaBooleana()
  confirmadaPorLector: boolean;

  @ColumnaInstante()
  fechaHora: Date;

  @ColumnaInstante()
  recibidaEn: Date;
}
