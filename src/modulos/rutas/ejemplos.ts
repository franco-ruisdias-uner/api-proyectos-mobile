import type { AvanceRuta, PaqueteRuta } from '../../../contrato/api.js';
import type { Ruta } from '../../../contrato/tipos.js';
import {
  EJEMPLO_MEDIDOR,
  EJEMPLO_SUMINISTRO,
} from '../suministros/ejemplos.js';

export const EJEMPLO_RUTA: Ruta = {
  id: 'rut-07-2026-05',
  numero: '07',
  nombre: 'Barrio Brasil',
  bimestre: '2026-05',
  lectorId: 'usr-011',
  suministroIds: ['sum-004120', 'sum-004136', 'sum-004150'],
  estado: 'en_curso',
  descargadaEn: '2026-09-15T07:40:00-03:00',
  cerradaEn: null,
};

export const EJEMPLO_PAQUETE: PaqueteRuta = {
  ruta: EJEMPLO_RUTA,
  suministros: [EJEMPLO_SUMINISTRO],
  medidores: [EJEMPLO_MEDIDOR],
  lecturas: [],
  novedades: [],
};

export const EJEMPLO_AVANCE: AvanceRuta = {
  rutaId: 'rut-07-2026-05',
  suministros: 200,
  leidos: 120,
  conNovedad: 5,
  pendientes: 75,
  fueraDeRango: 3,
};
