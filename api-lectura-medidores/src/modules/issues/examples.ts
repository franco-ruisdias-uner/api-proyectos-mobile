import type { ResumenNovedades } from '../../../contract/api.js';
import type { Novedad } from '../../../contract/types.js';

export const EJEMPLO_NOVEDAD: Novedad = {
  id: 'nov-3312',
  rutaId: 'rut-07-2026-05',
  suministroId: 'sum-004150',
  lectorId: 'usr-011',
  motivo: 'perro_suelto',
  comentario: null,
  audioUri:
    'http://192.168.0.10:3000/archivos/audios/2026/09/8c1d0e4f7a3b4c92.m4a',
  fotoUri:
    'http://192.168.0.10:3000/archivos/imagenes/2026/09/3f9a1c7e5b2d4a60.jpg',
  fechaHora: '2026-09-15T08:31:00-03:00',
  sincronizada: true,
};

export const EJEMPLO_RESUMEN: ResumenNovedades = {
  motivo: 'perro_suelto',
  zona: 'Barrio Brasil',
  cantidad: 3,
};
