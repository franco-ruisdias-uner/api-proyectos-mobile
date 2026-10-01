import type { Coordenadas, Gravedad } from '../../../contrato/tipos.js';
import { CLAVE_DEL_VIDEO_DE_DEMO } from '../medios/video-de-demo.js';

export interface AvisoSemilla {
  id: string;
  titulo: string;
  detalle: string;
  lineaIds: string[];
  desde: Date;
  hasta: Date | null;
  gravedad: Gravedad;
  trazadoAlternativo: Coordenadas[] | null;
  videoClave: string | null;
}

const DIA = 24 * 3600_000;
const HORA = 3600_000;

/**
 * Avisos de demo. Las fechas son relativas a `ahora` (el reloj de la API) para que siempre haya
 * vigentes, uno próximo y uno terminado, también con RELOJ_FIJO.
 */
export function avisosDeDemo(ahora: Date): AvisoSemilla[] {
  const en = (milisegundos: number) => new Date(Math.floor((ahora.getTime() + milisegundos) / 1000) * 1000);
  return [
    // Del PRD, con su id exacto: desvío por obra en Corrientes, con trazado alternativo y video.
    {
      id: 'avi-088',
      titulo: 'Desvío por obra en calle Corrientes',
      detalle:
        'Por una obra cloacal, las líneas 2, 7 y 9 desvían por Santa Fe y no pasan por Corrientes. ' +
        'Mirá el recorrido alternativo en el mapa.',
      lineaIds: ['lin-02', 'lin-07', 'lin-09'],
      desde: en(-1 * DIA),
      hasta: en(6 * DIA),
      gravedad: 'desvio',
      trazadoAlternativo: [
        { latitud: -31.7333, longitud: -60.5241 },
        { latitud: -31.7321, longitud: -60.5229 },
        { latitud: -31.7345, longitud: -60.523 },
        { latitud: -31.7339, longitud: -60.5204 },
        { latitud: -31.7352, longitud: -60.5217 },
      ],
      videoClave: CLAVE_DEL_VIDEO_DE_DEMO,
    },
    // Un aviso sin video ni trazado, sin fecha de fin.
    {
      id: 'avi-089',
      titulo: 'Más unidades en las líneas 5 y 14',
      detalle: 'Mientras dure el ciclo lectivo hay más unidades en horas pico.',
      lineaIds: ['lin-05', 'lin-14'],
      desde: en(-2 * DIA),
      hasta: null,
      gravedad: 'informativo',
      trazadoAlternativo: null,
      videoClave: null,
    },
    // Suspensión: la unidad rota de Almafuerte y Newbery (par-102 sólo lo recorre la 8).
    {
      id: 'avi-090',
      titulo: 'Unidad descompuesta en Almafuerte y Newbery',
      detalle: 'Una unidad de la línea 8 quedó parada en Almafuerte y Newbery. El servicio se normaliza en un rato.',
      lineaIds: ['lin-08'],
      desde: en(-1 * HORA),
      hasta: en(3 * HORA),
      gravedad: 'suspension',
      trazadoAlternativo: null,
      videoClave: null,
    },
    // Próximo: todavía no empezó.
    {
      id: 'avi-091',
      titulo: 'Cambio de recorrido de la línea 1',
      detalle: 'Desde el fin de semana la línea 1 cambia su recorrido en el centro.',
      lineaIds: ['lin-01'],
      desde: en(3 * DIA),
      hasta: en(10 * DIA),
      gravedad: 'desvio',
      trazadoAlternativo: null,
      videoClave: null,
    },
    // Ya terminado.
    {
      id: 'avi-092',
      titulo: 'Desvío por corte de calle (terminado)',
      detalle: 'La línea 4 volvió a su recorrido habitual.',
      lineaIds: ['lin-04'],
      desde: en(-10 * DIA),
      hasta: en(-3 * DIA),
      gravedad: 'desvio',
      trazadoAlternativo: null,
      videoClave: null,
    },
  ];
}
