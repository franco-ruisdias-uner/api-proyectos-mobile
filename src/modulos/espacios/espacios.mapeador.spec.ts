import { conOrigen } from '../../comun/pedido/contexto-pedido.js';
import { aContrato } from './espacios.mapeador.js';
import type { EspacioEntidad } from './espacio.entidad.js';

const base = {
  id: 'esp-02',
  nombre: 'Cancha 2',
  deporteId: 'dep-futbol5',
  complejo: 'Polideportivo Municipal',
  complejoBusqueda: 'polideportivo municipal',
  superficie: 'Césped sintético',
  techado: false,
  iluminacion: true,
  capacidad: 10,
  precioPorHora: 8000,
  latitud: -31.8,
  longitud: -59.0,
  imagenes: ['imagenes/2026/09/a.jpg'],
  videoUrl: null,
  reglas: 'x',
  activo: true,
} as EspacioEntidad;

describe('Espacios — mapeador (PRD: coordenadas anidadas, URLs absolutas, nulos)', () => {
  it('arma coordenadas y no expone la columna de búsqueda', () => {
    const e = conOrigen('http://h:3000', () => aContrato(base));
    expect(e.coordenadas).toEqual({ latitud: -31.8, longitud: -59.0 });
    expect(Object.keys(e)).not.toContain('complejoBusqueda');
    expect(Object.keys(e)).not.toContain('latitud');
  });

  it('hace absolutas las imágenes y deja el video en null', () => {
    const e = conOrigen('http://h:3000', () => aContrato(base));
    expect(e.imagenes).toEqual([
      'http://h:3000/archivos/imagenes/2026/09/a.jpg',
    ]);
    expect(e.videoUrl).toBeNull();
  });
});
