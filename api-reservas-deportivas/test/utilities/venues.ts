// Builders de deportes y espacios para los tests: cada test arma sus propios datos.
import { DeporteEntidad } from '../../src/modules/venues/sport.entity.js';
import { EspacioEntidad } from '../../src/modules/venues/venue.entity.js';
import { normalizarTexto } from '../../src/common/text/text.js';
import type { AppDePrueba } from './create-app.js';

let contador = 0;

export async function crearDeporte(
  a: AppDePrueba,
  datos: Partial<DeporteEntidad> = {},
): Promise<DeporteEntidad> {
  contador += 1;
  const repo = a.dataSource.getRepository(DeporteEntidad);
  return repo.save(
    repo.create({
      id: `dep-t${contador}`,
      nombre: `Deporte ${contador}`,
      icono: 'football-outline',
      color: '#2E7D32',
      ...datos,
    }),
  );
}

export async function crearEspacio(
  a: AppDePrueba,
  datos: Partial<EspacioEntidad> & { deporteId: string },
): Promise<EspacioEntidad> {
  contador += 1;
  const repo = a.dataSource.getRepository(EspacioEntidad);
  const complejo = datos.complejo ?? 'Polideportivo Municipal';
  return repo.save(
    repo.create({
      id: `esp-t${contador}`,
      nombre: `Cancha ${contador}`,
      superficie: 'Césped sintético',
      techado: false,
      iluminacion: true,
      capacidad: 10,
      precioPorHora: 8000,
      latitud: -31.8644,
      longitud: -59.0272,
      imagenes: [],
      videoUrl: null,
      reglas: 'Usar calzado deportivo.',
      activo: true,
      ...datos,
      complejo,
      complejoBusqueda: normalizarTexto(complejo),
    }),
  );
}
