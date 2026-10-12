import type { Medidor, Suministro } from '../../../contrato/tipos.js';

export const EJEMPLO_SUMINISTRO: Suministro = {
  id: 'sum-004120',
  numero: '004120',
  titular: 'Coronel, Ramona',
  direccion: 'Brasil 1420',
  coordenadas: { latitud: -30.7521, longitud: -57.9814 },
  categoria: 'residencial',
  medidorId: 'med-A88413',
  lecturaAnterior: 1284,
  fechaLecturaAnterior: '2026-07-14T09:30:00-03:00',
  consumoPromedio: 18,
  activo: true,
};

export const EJEMPLO_MEDIDOR: Medidor = {
  id: 'med-A88413',
  serie: 'A-88413',
  modelo: 'agujas',
  multiplicador: 1,
  digitos: 5,
  videoInstructivoUrl:
    'http://192.168.0.10:3000/archivos/videos/2026/09/3f9c1e0b7a42d8c5e1f60a9b.mp4',
  codigoQr: 'COOP-CHJ:med-A88413',
  instaladoEn: '2019-03-11T00:00:00-03:00',
};
