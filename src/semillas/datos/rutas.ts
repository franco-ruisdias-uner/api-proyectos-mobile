import { idDeRuta } from '../../modulos/rutas/reglas/rutas.js';
import type { EstadoRuta } from '../../../contrato/tipos.js';
import { BARRIOS } from './barrios.js';
import { CANTIDAD_BRASIL, type SemillaSuministro } from './suministros.js';

// Las rutas de la app de clase (docs/referencia/app-de-clase/mocks/routes.ts): la 07 de Brasil
// y la 12 de Quintas Norte del lector usr-011, y las 18 de barrio. El recorrido de cada una es el
// orden en que `generarSuministrosYMedidores` entrega sus suministros.

export interface SemillaRuta {
  id: string;
  numero: string;
  nombre: string;
  bimestre: string;
  lectorId: string;
  estado: EstadoRuta;
  descargadaEn: Date | null;
  cerradaEn: Date | null;
  suministroIds: string[];
}

export const BIMESTRE_DE_DEMO = '2026-05';
const CANTIDAD_QUINTAS = 20;
const SUMINISTROS_POR_BARRIO = 20;
const DESCARGA_DE_HOY = new Date('2026-09-15T07:40:00-03:00');
const DESCARGA_DE_AYER = new Date('2026-09-14T07:10:00-03:00');
const CIERRE_DE_AYER = new Date('2026-09-14T17:02:00-03:00');

export function generarRutas(suministros: SemillaSuministro[]): SemillaRuta[] {
  const ids = suministros.map((s) => s.id);
  const rutas: SemillaRuta[] = [
    {
      id: idDeRuta('07', BIMESTRE_DE_DEMO),
      numero: '07',
      nombre: 'Barrio Brasil',
      bimestre: BIMESTRE_DE_DEMO,
      lectorId: 'usr-011',
      estado: 'en_curso',
      descargadaEn: DESCARGA_DE_HOY,
      cerradaEn: null,
      suministroIds: ids.slice(0, CANTIDAD_BRASIL),
    },
    {
      id: idDeRuta('12', BIMESTRE_DE_DEMO),
      numero: '12',
      nombre: 'Quintas Norte',
      bimestre: BIMESTRE_DE_DEMO,
      lectorId: 'usr-011',
      estado: 'cerrada',
      descargadaEn: DESCARGA_DE_AYER,
      cerradaEn: CIERRE_DE_AYER,
      suministroIds: ids.slice(
        CANTIDAD_BRASIL,
        CANTIDAD_BRASIL + CANTIDAD_QUINTAS,
      ),
    },
  ];
  const inicioBarrios = CANTIDAD_BRASIL + CANTIDAD_QUINTAS;
  BARRIOS.forEach((barrio, i) => {
    const desde = inicioBarrios + i * SUMINISTROS_POR_BARRIO;
    rutas.push({
      id: idDeRuta(barrio.numero, BIMESTRE_DE_DEMO),
      numero: barrio.numero,
      nombre: barrio.nombre,
      bimestre: BIMESTRE_DE_DEMO,
      lectorId: barrio.lectorId,
      estado: barrio.estado,
      // Como en el mock: las que no están `asignada` se descargaron hoy a las 07:40.
      descargadaEn: barrio.estado === 'asignada' ? null : DESCARGA_DE_HOY,
      cerradaEn: barrio.estado === 'cerrada' ? CIERRE_DE_AYER : null,
      suministroIds: ids.slice(desde, desde + SUMINISTROS_POR_BARRIO),
    });
  });
  return rutas;
}
