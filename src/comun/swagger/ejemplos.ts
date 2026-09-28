import type { Sesion } from '../../../contrato/api.js';
import type { Usuario } from '../../../contrato/tipos.js';
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

export function ejemploError(codigo: CodigoError) {
  return { example: { error: { codigo, mensaje: CATALOGO_ERRORES[codigo].mensaje } } };
}
