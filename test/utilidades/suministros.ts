import type { Categoria, ModeloMedidor } from '../../contrato/tipos.js';
import { normalizarParaBusqueda } from '../../src/comun/texto/normalizar.js';
import { MedidorEntidad } from '../../src/modulos/suministros/medidor.entidad.js';
import { SuministroEntidad } from '../../src/modulos/suministros/suministro.entidad.js';
import type { AppDePrueba } from './crear-app.js';

let contador = 0;

export interface DatosMedidor {
  id?: string;
  serie?: string;
  modelo?: ModeloMedidor;
  multiplicador?: number;
  digitos?: number;
  videoClave?: string | null;
  codigoQr?: string | null;
  instaladoEn?: Date;
}

export interface DatosSuministro {
  id?: string;
  numero?: string;
  titular?: string;
  direccion?: string;
  latitud?: number;
  longitud?: number;
  categoria?: Categoria;
  lecturaAnterior?: number | null;
  fechaLecturaAnterior?: Date | null;
  consumoPromedio?: number | null;
  activo?: boolean;
  /** Si no se pasa, se crea un medidor nuevo con estos datos. */
  medidor?: DatosMedidor;
}

/** Builder: un medidor directo en la base. */
export async function crearMedidor(
  c: AppDePrueba,
  datos: DatosMedidor = {},
): Promise<MedidorEntidad> {
  contador += 1;
  const id = datos.id ?? `med-T${String(contador).padStart(5, '0')}`;
  const medidor: MedidorEntidad = {
    id,
    serie: datos.serie ?? `T-${contador}`,
    modelo: datos.modelo ?? 'agujas',
    multiplicador: datos.multiplicador ?? 1,
    digitos: datos.digitos ?? 5,
    videoClave: datos.videoClave ?? null,
    codigoQr: datos.codigoQr === undefined ? `COOP-CHJ:${id}` : datos.codigoQr,
    instaladoEn: datos.instaladoEn ?? new Date('2018-06-01T03:00:00Z'),
  };
  await c.dataSource.getRepository(MedidorEntidad).insert(medidor);
  return medidor;
}

/** Builder: un suministro con su medidor, directo en la base. */
export async function crearSuministro(
  c: AppDePrueba,
  datos: DatosSuministro = {},
): Promise<{ suministro: SuministroEntidad; medidor: MedidorEntidad }> {
  contador += 1;
  const medidor = await crearMedidor(c, datos.medidor);
  const numero = datos.numero ?? String(900000 + contador);
  const titular = datos.titular ?? 'Acosta, Mirta';
  const direccion = datos.direccion ?? `Calle ${contador}`;
  const suministro: SuministroEntidad = {
    id: datos.id ?? `sum-${numero}`,
    numero,
    titular,
    titularBusqueda: normalizarParaBusqueda(titular),
    direccion,
    direccionBusqueda: normalizarParaBusqueda(direccion),
    latitud: datos.latitud ?? -30.7521,
    longitud: datos.longitud ?? -57.9814,
    categoria: datos.categoria ?? 'residencial',
    medidorId: medidor.id,
    lecturaAnterior:
      datos.lecturaAnterior === undefined ? 1000 : datos.lecturaAnterior,
    fechaLecturaAnterior:
      datos.fechaLecturaAnterior === undefined
        ? new Date('2026-07-14T12:30:00Z')
        : datos.fechaLecturaAnterior,
    consumoPromedio:
      datos.consumoPromedio === undefined ? 18 : datos.consumoPromedio,
    activo: datos.activo ?? true,
  };
  await c.dataSource.getRepository(SuministroEntidad).insert(suministro);
  return { suministro, medidor };
}

/**
 * Hasta M2 no hay rutas, así que "este lector tiene este suministro en una de sus rutas" se
 * declara a mano. Sustituye sólo al `AccesoSuministros`; la base y los repositorios son reales.
 */
export class AccesoFijo {
  constructor(private readonly permitidos: Record<string, string[]> = {}) {}

  dar(usuarioId: string, suministroId: string): void {
    this.permitidos[usuarioId] = [
      ...(this.permitidos[usuarioId] ?? []),
      suministroId,
    ];
  }

  async puedeVer(usuarioId: string, suministroId: string): Promise<boolean> {
    return (this.permitidos[usuarioId] ?? []).includes(suministroId);
  }
}
