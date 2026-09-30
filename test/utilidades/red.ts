import type { Coordenadas, Sentido } from '../../contrato/tipos.js';
import { nuevoId } from '../../src/comun/ids/ids.js';
import { normalizarParaBusqueda } from '../../src/comun/texto/texto.js';
import { LineaEntidad } from '../../src/modulos/red/linea.entidad.js';
import { ParadaEntidad } from '../../src/modulos/red/parada.entidad.js';
import { RecorridoParadaEntidad } from '../../src/modulos/red/recorrido-parada.entidad.js';
import { RecorridoEntidad } from '../../src/modulos/red/recorrido.entidad.js';
import { ordenDeNumero } from '../../src/modulos/red/reglas/numero-de-linea.js';
import type { AppDePrueba } from './crear-app.js';

let contador = 0;

export interface DatosDeParada {
  id?: string;
  nombre?: string;
  latitud?: number;
  longitud?: number;
  sentido?: Sentido;
  refugio?: boolean;
  codigoQr?: string | null;
}

/** Builder de parada, directo en la base. El QR por defecto es PARANA:<id>. */
export async function crearParada(
  ctx: AppDePrueba,
  datos: DatosDeParada = {},
): Promise<ParadaEntidad> {
  contador++;
  const id = datos.id ?? nuevoId('par');
  const nombre = datos.nombre ?? `Esquina ${contador}`;
  const parada = ctx.dataSource.getRepository(ParadaEntidad).create({
    id,
    nombre,
    nombreBusqueda: normalizarParaBusqueda(nombre),
    latitud: datos.latitud ?? -31.7333,
    longitud: datos.longitud ?? -60.5241,
    sentido: datos.sentido ?? 'ida',
    refugio: datos.refugio ?? true,
    codigoQr: datos.codigoQr === undefined ? `PARANA:${id}` : datos.codigoQr,
  });
  await ctx.dataSource.getRepository(ParadaEntidad).insert(parada);
  return parada;
}

export interface RecorridoDePrueba {
  sentido: Sentido;
  destino?: string;
  trazado?: Coordenadas[];
  /** Ids de paradas ya creadas, en orden de paso. */
  paradaIds: string[];
}

export interface DatosDeLinea {
  id?: string;
  numero?: string;
  nombre?: string;
  color?: string;
  empresa?: string;
  activa?: boolean;
  recorridos?: RecorridoDePrueba[];
}

const TRAZADO: Coordenadas[] = [
  { latitud: -31.73, longitud: -60.53 },
  { latitud: -31.735, longitud: -60.52 },
];

/** Builder de línea con sus recorridos y las paradas de cada uno. */
export async function crearLinea(
  ctx: AppDePrueba,
  datos: DatosDeLinea = {},
): Promise<LineaEntidad> {
  contador++;
  const numero = datos.numero ?? String(contador);
  const linea = ctx.dataSource.getRepository(LineaEntidad).create({
    id: datos.id ?? nuevoId('lin'),
    numero,
    numeroOrden: ordenDeNumero(numero),
    nombre: datos.nombre ?? `Línea ${numero}`,
    color: datos.color ?? '#1B6CA8',
    empresa: datos.empresa ?? 'Empresa de prueba',
    activa: datos.activa ?? true,
  });
  await ctx.dataSource.getRepository(LineaEntidad).insert(linea);
  for (const r of datos.recorridos ?? []) {
    await ctx.dataSource.getRepository(RecorridoEntidad).insert({
      lineaId: linea.id,
      sentido: r.sentido,
      destino: r.destino ?? `hacia el ${r.sentido}`,
      trazado: r.trazado ?? TRAZADO,
    });
    for (const [orden, paradaId] of r.paradaIds.entries()) {
      await ctx.dataSource
        .getRepository(RecorridoParadaEntidad)
        .insert({ lineaId: linea.id, sentido: r.sentido, orden, paradaId });
    }
  }
  return linea;
}
