import type { Comercio, Rubro } from '../../../contract/types.js';

/** Ejemplos para Swagger. */
export const EJEMPLO_RUBRO: Rubro = {
  id: 'rub-ferreteria',
  nombre: 'Ferretería y construcción',
  icono: 'hammer',
  color: '#E8A33D',
  orden: 4,
};

export const EJEMPLO_COMERCIO: Comercio = {
  id: 'com-118',
  nombre: 'Ferretería El Tornillo',
  rubroId: 'rub-ferreteria',
  descripcion: 'Herramientas, pinturas y materiales para la obra.',
  direccion: '9 de Julio 1234',
  coordenadas: { latitud: -32.4825, longitud: -58.2372 },
  telefono: '+54 3442 421234',
  whatsapp: '5493442421234',
  instagram: '@eltornillo',
  imagenes: ['http://192.168.0.10:3000/archivos/imagenes/2026/10/k3j9x0m2a7qz4h1d.jpg'],
  videoUrl: null,
  horarios: [
    { dia: 1, abre: '08:00', cierra: '12:00' },
    { dia: 1, abre: '16:30', cierra: '20:30' },
    { dia: 6, abre: '08:00', cierra: '13:00' },
  ],
  mediosDePago: ['efectivo', 'debito', 'transferencia'],
  puntaje: 4.6,
  cantidadResenas: 12,
  codigoQr: 'CCU:com-118',
  activo: true,
};
