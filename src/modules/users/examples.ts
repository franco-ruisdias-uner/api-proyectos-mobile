import type { Usuario } from '../../../contract/types.js';

/** Ejemplo del PRD, para Swagger. */
export const USUARIO_DE_EJEMPLO: Usuario = {
  id: 'usr-320',
  nombre: 'Julián Ferrari',
  email: 'julian@mail.com',
  lineasFavoritas: ['lin-05'],
  paradasFavoritas: ['par-101'],
  avisosActivos: true,
  tema: 'sistema',
};

export const SESION_DE_EJEMPLO = {
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3ItMzIwIn0.firma',
  usuario: USUARIO_DE_EJEMPLO,
};
