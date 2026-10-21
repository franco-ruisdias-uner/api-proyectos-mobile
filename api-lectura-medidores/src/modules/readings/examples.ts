import type { Lectura } from '../../../contract/types.js';

export const EJEMPLO_LECTURA: Lectura = {
  id: 'lec-88201',
  rutaId: 'rut-07-2026-05',
  suministroId: 'sum-004120',
  lectorId: 'usr-011',
  valor: 1302,
  consumo: 18,
  fotoUri:
    'http://192.168.0.10:3000/archivos/imagenes/2026/09/3f9a1c7e5b2d4a60.jpg',
  coordenadas: { latitud: -30.7521, longitud: -57.9814 },
  fueraDeRango: false,
  confirmadaPorLector: false,
  fechaHora: '2026-09-15T09:12:00-03:00',
  sincronizada: true,
};
