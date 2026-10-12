// Las rutas de barrio de la app de clase (mocks/roster.ts, `extraRouteSeeds`), en su orden.
// Cada una tiene 20 suministros sobre su calle. Quién las lee y en qué estado están llega con M2.

export interface Barrio {
  numero: string;
  nombre: string;
  calle: string;
}

export const BARRIOS: Barrio[] = [
  { numero: '01', nombre: 'Centro', calle: 'San Martín' },
  { numero: '02', nombre: 'Barrio Sur', calle: 'Belgrano' },
  { numero: '03', nombre: 'Villa Libertad', calle: 'Urquiza' },
  { numero: '04', nombre: 'Barrio Norte', calle: 'Moreno' },
  { numero: '05', nombre: 'San Isidro', calle: 'Mitre' },
  { numero: '06', nombre: 'Los Pinos', calle: 'Sarmiento' },
  { numero: '08', nombre: 'La Estación', calle: 'Rivadavia' },
  { numero: '09', nombre: 'Parque del Sol', calle: 'Alberdi' },
  { numero: '10', nombre: 'Barrio Oeste', calle: 'Pellegrini' },
  { numero: '11', nombre: 'Costa del Uruguay', calle: 'Costanera' },
  { numero: '13', nombre: 'Santa Rosa', calle: '25 de Mayo' },
  { numero: '14', nombre: 'Las Heras', calle: 'Las Heras' },
  { numero: '15', nombre: 'San Martín', calle: 'Independencia' },
  { numero: '16', nombre: 'Barrio Este', calle: 'España' },
  { numero: '17', nombre: 'El Molino', calle: 'Italia' },
  { numero: '18', nombre: 'La Floresta', calle: 'Francia' },
  { numero: '19', nombre: 'Pueblo Nuevo', calle: 'Chile' },
  { numero: '20', nombre: 'Almirante Brown', calle: 'Brown' },
];
