import type { Usuario } from '../../../contract/types.js';

/** El ejemplo del PRD, para Swagger. */
export const EJEMPLO_USUARIO: Usuario = {
  id: 'usr-512',
  nombre: 'Marta Giménez',
  email: 'marta@mail.com',
  rol: 'vecino',
  comercioId: null,
  favoritos: ['com-118'],
  rubrosDeInteres: ['rub-ferreteria'],
  avisosActivos: true,
};
