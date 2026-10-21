import type {
  Categoria,
  Coordenadas,
  ModeloMedidor,
} from '../../../contract/types.js';
import { codigoQrDe } from '../../modules/supplies/rules/qr.js';
import { BARRIOS } from './neighborhoods.js';

// Suministros y medidores de la app de clase (docs/reference/class-app/mocks/brasil.ts,
// quintas.ts y neighborhoods.ts): misma lógica, mismos ids y mismo orden. El orden de la
// lista es el del recorrido de cada ruta: Brasil, Quintas Norte y los barrios.

export interface SemillaMedidor {
  id: string;
  serie: string;
  modelo: ModeloMedidor;
  multiplicador: number;
  digitos: number;
  /** Modelo cuyo video instructivo usa (se sube al sembrar); `null` = sin video. */
  videoModelo: ModeloMedidor | null;
  codigoQr: string;
  instaladoEn: Date;
}

export interface SemillaSuministro {
  id: string;
  numero: string;
  titular: string;
  direccion: string;
  latitud: number;
  longitud: number;
  categoria: Categoria;
  medidorId: string;
  lecturaAnterior: number | null;
  fechaLecturaAnterior: Date | null;
  consumoPromedio: number | null;
  activo: boolean;
}

const MODELOS_COMUNES: ModeloMedidor[] = ['agujas', 'digital', 'agujas_viejo'];
const TITULARES = [
  'Acosta, Mirta',
  'Fernández, Hugo',
  'Giménez, Elsa',
  'López, Carmen',
  'Martínez, Pedro',
  'Ojeda, Nelly',
  'Quiroga, Andrés',
  'Sosa, Graciela',
  'Vera, Julio',
  'Zabala, Irene',
];
const TITULARES_FIJOS = [
  'Coronel, Ramona',
  'Benítez, Olga',
  'Peralta, Dora',
  'Miguez, Hector',
];

/** La lectura anterior es la del cuarto bimestre: 14/07/2026 09:30 (hora argentina). */
const LECTURA_ANTERIOR_EN = new Date('2026-07-14T09:30:00-03:00');

export const CANTIDAD_BRASIL = 200;
const INDICE_CONEXION_NUEVA = 10;
const INDICE_MULTIPLICADOR = 25;
const INDICE_LECTURA_NEGATIVA = 40;
const CANTIDAD_QUINTAS = 20;
const SUMINISTROS_POR_BARRIO = 20;

/** Un barrio con un suministro que dejó de estar activo, para ver R8 en la app. */
const BARRIO_CON_INACTIVO = '02';
const INDICE_INACTIVO = 5;

/** A 6 decimales (11 cm): quita el ruido de coma flotante de la fórmula del mock. */
const aSeisDecimales = (n: number) => Math.round(n * 1e6) / 1e6;

function coordenadas(indice: number, origen: Coordenadas): Coordenadas {
  return {
    latitud: aSeisDecimales(origen.latitud + indice * 0.00012),
    longitud: aSeisDecimales(
      origen.longitud + (indice % 2 === 0 ? 0.00008 : -0.00008),
    ),
  };
}

function modeloComun(indice: number): ModeloMedidor {
  return MODELOS_COMUNES[indice % MODELOS_COMUNES.length];
}

interface Par {
  suministro: SemillaSuministro;
  medidor: SemillaMedidor;
}

const NUMEROS_FIJOS_BRASIL = ['004120', '004136', '004150', '004162'];
const CALLES_FIJAS_BRASIL = [1420, 1436, 1450, 1462];

function parDeBrasil(indice: number): Par {
  const numero =
    NUMEROS_FIJOS_BRASIL[indice] ?? String(4200 + indice).padStart(6, '0');
  const calle = CALLES_FIJAS_BRASIL[indice] ?? 1462 + (indice - 3) * 14;
  const medidorId = indice === 0 ? 'med-A88413' : `med-${numero}`;
  const conexionNueva = indice === INDICE_CONEXION_NUEVA;
  const conMultiplicador = indice === INDICE_MULTIPLICADOR;
  const modelo: ModeloMedidor = conMultiplicador
    ? 'multiplicador'
    : modeloComun(indice);

  let lecturaAnterior = 1000 + indice * 3;
  if (indice === 0 || indice === 1) lecturaAnterior = 1284;
  if (indice === INDICE_LECTURA_NEGATIVA) lecturaAnterior = 4100;

  return {
    medidor: {
      id: medidorId,
      serie: indice === 0 ? 'A-88413' : `B-${numero}`,
      modelo,
      multiplicador: conMultiplicador ? 10 : 1,
      digitos: 5,
      videoModelo: conMultiplicador ? null : modelo,
      codigoQr: codigoQrDe(medidorId),
      instaladoEn: new Date(
        indice === 0
          ? '2019-03-11T00:00:00-03:00'
          : '2018-06-01T00:00:00-03:00',
      ),
    },
    suministro: {
      id: `sum-${numero}`,
      numero,
      titular: TITULARES_FIJOS[indice] ?? TITULARES[indice % TITULARES.length],
      direccion: `Brasil ${calle}`,
      // El ejemplo del PRD manda: sum-004120 está en (-30.7521, -57.9814) (D19, A18).
      ...(indice === 0
        ? { latitud: -30.7521, longitud: -57.9814 }
        : coordenadas(indice, { latitud: -30.7521, longitud: -57.9814 })),
      categoria: 'residencial',
      medidorId,
      lecturaAnterior: conexionNueva ? null : lecturaAnterior,
      fechaLecturaAnterior: conexionNueva ? null : LECTURA_ANTERIOR_EN,
      consumoPromedio: conexionNueva ? null : 18,
      activo: true,
    },
  };
}

function parDeQuintas(indice: number): Par {
  const numero = String(8001 + indice).padStart(6, '0');
  const medidorId = `med-Q${numero}`;
  const modelo = modeloComun(indice);
  return {
    medidor: {
      id: medidorId,
      serie: `Q-${numero}`,
      modelo,
      multiplicador: 1,
      digitos: 5,
      videoModelo: modelo,
      codigoQr: codigoQrDe(medidorId),
      instaladoEn: new Date('2016-11-02T00:00:00-03:00'),
    },
    suministro: {
      id: `sum-${numero}`,
      numero,
      titular: TITULARES[indice % TITULARES.length],
      direccion: `Los Sauces ${120 + indice * 16}`,
      ...coordenadas(indice, { latitud: -30.72, longitud: -57.97 }),
      categoria: 'rural',
      medidorId,
      lecturaAnterior: 800 + indice * 5,
      fechaLecturaAnterior: LECTURA_ANTERIOR_EN,
      consumoPromedio: 18,
      activo: true,
    },
  };
}

function parDeBarrio(indiceBarrio: number, indice: number): Par {
  const barrio = BARRIOS[indiceBarrio];
  const numero = `${barrio.numero}${String(indice + 1).padStart(4, '0')}`;
  const medidorId = `med-${numero}`;
  const modelo = modeloComun(indice);
  return {
    medidor: {
      id: medidorId,
      serie: `N-${numero}`,
      modelo,
      multiplicador: 1,
      digitos: 5,
      videoModelo: modelo,
      codigoQr: codigoQrDe(medidorId),
      instaladoEn: new Date('2017-04-08T00:00:00-03:00'),
    },
    suministro: {
      id: `sum-${numero}`,
      numero,
      titular: TITULARES[(indiceBarrio + indice) % TITULARES.length],
      direccion: `${barrio.calle} ${100 + indice * 12}`,
      ...coordenadas(indice, {
        latitud: -30.77 + indiceBarrio * 0.004,
        longitud: -57.99 + indiceBarrio * 0.003,
      }),
      categoria: indice % 10 === 0 ? 'comercial' : 'residencial',
      medidorId,
      lecturaAnterior: 500 + indice * 4,
      fechaLecturaAnterior: LECTURA_ANTERIOR_EN,
      consumoPromedio: 18,
      activo: !(
        barrio.numero === BARRIO_CON_INACTIVO && indice === INDICE_INACTIVO
      ),
    },
  };
}

/** Los 580 suministros con sus medidores, en el orden de recorrido de sus rutas. */
export function generarSuministrosYMedidores(): {
  suministros: SemillaSuministro[];
  medidores: SemillaMedidor[];
} {
  const pares: Par[] = [
    ...Array.from({ length: CANTIDAD_BRASIL }, (_, i) => parDeBrasil(i)),
    ...Array.from({ length: CANTIDAD_QUINTAS }, (_, i) => parDeQuintas(i)),
    ...BARRIOS.flatMap((_, b) =>
      Array.from({ length: SUMINISTROS_POR_BARRIO }, (_, i) =>
        parDeBarrio(b, i),
      ),
    ),
  ];
  return {
    suministros: pares.map((p) => p.suministro),
    medidores: pares.map((p) => p.medidor),
  };
}
