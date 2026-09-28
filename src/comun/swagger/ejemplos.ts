import type { Sesion } from '../../../contrato/api.js';
import type { Categoria, Lugar, Usuario } from '../../../contrato/tipos.js';
import { CATALOGO_ERRORES, type CodigoError } from '../errores/catalogo.js';

/** Ejemplos de Swagger, tomados del PRD. */
export const EJEMPLO_USUARIO: Usuario = {
  id: 'usr-201',
  nombre: 'Lucía Méndez',
  email: 'lucia@mail.com',
  avatarUrl: null,
  creadoEn: '2026-09-02T18:20:00-03:00',
  preferencias: {
    categoriasFavoritas: ['cat-museos', 'cat-playas'],
    avisarProximidad: true,
    radioAvisoMetros: 250,
    tema: 'sistema',
  },
};

export const EJEMPLO_SESION: Sesion = {
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…',
  usuario: EJEMPLO_USUARIO,
};

export const EJEMPLO_CATEGORIA: Categoria = {
  id: 'cat-museos',
  nombre: 'Museos y patrimonio',
  icono: 'business-outline',
  color: '#8E5A4A',
  orden: 3,
};

export const EJEMPLO_LUGAR: Lugar = {
  id: 'lug-004',
  nombre: 'Molino Forclaz',
  categoriaId: 'cat-museos',
  descripcionCorta: 'Molino de viento de 1888 levantado por colonos suizos.',
  descripcion: 'Construido en 1888 por Juan Bautista Forclaz ...',
  coordenadas: { latitud: -32.1904, longitud: -58.1932 },
  direccion: 'Colonia San José, Ruta Provincial 26',
  imagenes: ['http://192.168.0.10:3000/archivos/imagenes/2026/09/semilla-molino-1.png'],
  horarios: [
    { dia: 2, abre: '09:00', cierra: '19:00' },
    { dia: 6, abre: '10:00', cierra: '20:00' },
  ],
  telefono: '345-4421234',
  sitioWeb: null,
  precioEntrada: 1500,
  audioguia: {
    url: 'http://192.168.0.10:3000/archivos/audios/2026/09/semilla-audioguia-molino.mp3',
    duracionSegundos: 252,
    idioma: 'es',
  },
  codigoQr: 'COLON:lug-004',
  accesible: false,
  activo: true,
  actualizadoEn: '2026-08-01T10:30:00-03:00',
};

export function ejemploError(codigo: CodigoError) {
  return { example: { error: { codigo, mensaje: CATALOGO_ERRORES[codigo].mensaje } } };
}
