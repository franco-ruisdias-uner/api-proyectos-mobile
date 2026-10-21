import { Entity } from 'typeorm';
import type { Coordenadas } from '../../../contract/types.js';
import {
  ColumnaId,
  ColumnaJson,
  ColumnaTexto,
} from '../../common/db/columns.js';

@Entity('zonas')
export class Zona {
  @ColumnaId()
  id: string;

  @ColumnaTexto(80)
  nombre: string;

  /** Polígono de la zona; no se filtra por él en la base, se resuelve en TypeScript. */
  @ColumnaJson()
  limite: Coordenadas[];

  @ColumnaTexto(120)
  referente: string;
}
