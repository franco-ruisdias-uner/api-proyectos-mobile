// Builders de catálogos para los tests: no dependen de las semillas de demo.
import { nuevoId } from '../../src/comun/ids/ids.js';
import { Cuadrilla } from '../../src/modulos/catalogos/cuadrilla.entidad.js';
import { TipoDeReporte } from '../../src/modulos/catalogos/tipo-de-reporte.entidad.js';
import { Zona } from '../../src/modulos/catalogos/zona.entidad.js';
import type { AppDePrueba } from './crear-app.js';

export async function crearTipo(
  ctx: AppDePrueba,
  datos: Partial<TipoDeReporte> = {},
): Promise<TipoDeReporte> {
  const tipo = Object.assign(new TipoDeReporte(), {
    id: nuevoId('tip'),
    nombre: 'Bache',
    icono: 'construct',
    color: '#E67E22',
    areaResponsable: 'Obras Públicas',
    ...datos,
  });
  await ctx.dataSource.getRepository(TipoDeReporte).insert(tipo);
  return tipo;
}

/** Un cuadrado de ~1 km de lado con centro en (latitud, longitud). */
export const cuadradoAlrededorDe = (latitud: number, longitud: number) => {
  const d = 0.005;
  return [
    { latitud: latitud + d, longitud: longitud - d },
    { latitud: latitud + d, longitud: longitud + d },
    { latitud: latitud - d, longitud: longitud + d },
    { latitud: latitud - d, longitud: longitud - d },
  ];
};

export async function crearZona(
  ctx: AppDePrueba,
  datos: Partial<Zona> = {},
): Promise<Zona> {
  const zona = Object.assign(new Zona(), {
    id: nuevoId('zon'),
    nombre: 'Zona de prueba',
    limite: cuadradoAlrededorDe(-33.0, -58.5),
    referente: 'Ana Prueba',
    ...datos,
  });
  await ctx.dataSource.getRepository(Zona).insert(zona);
  return zona;
}

export async function crearCuadrilla(
  ctx: AppDePrueba,
  datos: Partial<Cuadrilla> & { zonaId: string },
): Promise<Cuadrilla> {
  const cuadrilla = Object.assign(new Cuadrilla(), {
    id: nuevoId('cua'),
    nombre: 'Cuadrilla de prueba',
    especialidad: 'Bacheo',
    activa: true,
    ...datos,
  });
  await ctx.dataSource.getRepository(Cuadrilla).insert(cuadrilla);
  return cuadrilla;
}
