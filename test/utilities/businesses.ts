import { nuevoId } from '../../src/common/ids/ids.js';
import { normalizarParaBusqueda } from '../../src/common/text/text.js';
import { Comercio } from '../../src/modules/businesses/business.entity.js';
import { Rubro } from '../../src/modules/businesses/category.entity.js';
import type { AppDePrueba } from './create-app.js';

/** Builder de rubros: inserta directo en la base. */
export async function crearRubro(t: AppDePrueba, datos: Partial<Rubro> = {}): Promise<Rubro> {
  const rubro: Rubro = {
    id: datos.id ?? nuevoId('rub'),
    nombre: datos.nombre ?? 'Rubro de prueba',
    icono: datos.icono ?? 'tag',
    color: datos.color ?? '#336699',
    orden: datos.orden ?? 1,
  };
  await t.dataSource.getRepository(Rubro).insert(rubro);
  return rubro;
}

/** Builder de comercios: los campos de búsqueda se derivan del nombre y la descripción. */
export async function crearComercio(
  t: AppDePrueba,
  datos: Partial<Comercio> = {},
): Promise<Comercio> {
  const nombre = datos.nombre ?? 'Comercio de prueba';
  const descripcion = datos.descripcion ?? 'Descripción de prueba.';
  const comercio: Comercio = {
    id: datos.id ?? nuevoId('com'),
    nombre,
    nombreBusqueda: normalizarParaBusqueda(nombre),
    rubroId: datos.rubroId ?? 'rub-prueba',
    descripcion,
    descripcionBusqueda: normalizarParaBusqueda(descripcion),
    direccion: datos.direccion ?? '9 de Julio 1234',
    latitud: datos.latitud ?? -32.4825,
    longitud: datos.longitud ?? -58.2372,
    telefono: datos.telefono ?? null,
    whatsapp: datos.whatsapp ?? null,
    instagram: datos.instagram ?? null,
    imagenes: datos.imagenes ?? [],
    videoClave: datos.videoClave ?? null,
    horarios: datos.horarios ?? [{ dia: 1, abre: '08:00', cierra: '12:00' }],
    mediosDePago: datos.mediosDePago ?? ['efectivo'],
    puntaje: datos.puntaje ?? 0,
    cantidadResenas: datos.cantidadResenas ?? 0,
    activo: datos.activo ?? true,
    cerradoHasta: datos.cerradoHasta ?? null,
  };
  await t.dataSource.getRepository(Comercio).insert(comercio);
  return comercio;
}
