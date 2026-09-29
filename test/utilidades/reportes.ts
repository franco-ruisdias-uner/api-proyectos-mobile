// Builders de reportes para los tests: no dependen de las semillas de demo.
import { AHORA_POR_DEFECTO, type AppDePrueba } from './crear-app.js';
import { JPEG, M4A } from './archivos.js';
import { nuevoId } from '../../src/comun/ids/ids.js';
import { parsearInstante } from '../../src/comun/fechas/fechas.js';
import { CambioDeEstado } from '../../src/modulos/reportes/cambio-de-estado.entidad.js';
import { FotoDeReporte } from '../../src/modulos/reportes/foto.entidad.js';
import { Reporte } from '../../src/modulos/reportes/reporte.entidad.js';
import type { EstadoReporte } from '../../contrato/tipos.js';
import type { UsuarioDePrueba } from './usuarios.js';

/** Sube un archivo por POST /archivos y devuelve su URL. */
export async function subirArchivo(
  ctx: AppDePrueba,
  como: UsuarioDePrueba,
  contenido: Buffer = JPEG,
  nombre = 'foto.jpg',
): Promise<string> {
  const res = await ctx
    .http()
    .post('/archivos')
    .set(...como.auth)
    .attach('archivo', contenido, nombre);
  if (res.status !== 201) throw new Error(`No se pudo subir: ${res.text}`);
  return res.body.datos.url as string;
}

export const subirAudio = (ctx: AppDePrueba, como: UsuarioDePrueba) =>
  subirArchivo(ctx, como, M4A, 'nota.m4a');

/** Punto de la calle Rocamora 1240 (el ejemplo del PRD). */
export const ROCAMORA = { latitud: -33.0089, longitud: -58.5142 };

/** Cuerpo válido de POST /reportes. */
export function cuerpoReporte(
  fotoUrl: string,
  tipoId: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    tipoId,
    descripcion: 'Pozo grande frente al número 1240.',
    audioUrl: null,
    fotos: [{ url: fotoUrl }],
    coordenadas: ROCAMORA,
    direccion: 'Rocamora 1240',
    creadoEn: '2026-09-14T09:22:00-03:00',
    ...extra,
  };
}

let secuencia = 0;

/** Inserta un reporte directo en la base (para los tests de listas y estados). */
export async function crearReporte(
  ctx: AppDePrueba,
  datos: Partial<Reporte> & { autorId: string; tipoId: string; zonaId: string },
  opciones: { fotos?: number } = {},
): Promise<Reporte> {
  secuencia += 1;
  const reporte = Object.assign(new Reporte(), {
    id: nuevoId('rep'),
    codigo: `GCHU-2026-${String(90000 + secuencia).padStart(5, '0')}`,
    descripcion: null,
    audioClave: null,
    latitud: ROCAMORA.latitud,
    longitud: ROCAMORA.longitud,
    direccion: 'Rocamora 1240',
    estado: 'recibido' as EstadoReporte,
    cuadrillaId: null,
    duplicadoDe: null,
    adhesiones: 0,
    creadoEn: parsearInstante(AHORA_POR_DEFECTO)!,
    ...datos,
  });
  await ctx.dataSource.getRepository(Reporte).insert(reporte);
  for (let i = 1; i <= (opciones.fotos ?? 1); i++) {
    await ctx.dataSource.getRepository(FotoDeReporte).insert({
      id: nuevoId('fot'),
      reporteId: reporte.id,
      clave: `imagenes/2026/09/${'a'.repeat(23)}${i}.jpg`,
      momento: 'problema',
      orden: i,
    });
  }
  return reporte;
}

export async function crearCambio(
  ctx: AppDePrueba,
  datos: Partial<CambioDeEstado> & { reporteId: string },
): Promise<CambioDeEstado> {
  const cambio = Object.assign(new CambioDeEstado(), {
    id: nuevoId('cam'),
    estado: 'recibido' as EstadoReporte,
    comentario: null,
    operadorId: null,
    fechaHora: parsearInstante(AHORA_POR_DEFECTO)!,
    secuencia: 1,
    ...datos,
  });
  await ctx.dataSource.getRepository(CambioDeEstado).insert(cambio);
  return cambio;
}
