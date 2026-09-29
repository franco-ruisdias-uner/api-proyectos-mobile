import { Entity } from 'typeorm';
import type { Coordenadas } from '../../../contrato/tipos.js';
import {
  ColumnaId,
  ColumnaJson,
  ColumnaTexto,
} from '../../comun/db/columnas.js';

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
