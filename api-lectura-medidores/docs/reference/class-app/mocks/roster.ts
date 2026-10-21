import type { EstadoRuta, Rol } from '@/types/entities'

export type UserSeed = {
  id: string
  legajo: string
  nombre: string
  rol: Rol
  biometriaActiva: boolean
}

export type RouteSeed = {
  numero: string
  nombre: string
  calle: string
  estado: EstadoRuta
  lectorId: string
}

export const userSeeds: UserSeed[] = [
  { id: 'usr-011', legajo: 'L-011', nombre: 'Ramón Duarte', rol: 'lector', biometriaActiva: true },
  { id: 'usr-012', legajo: 'L-012', nombre: 'Silvia Fernández', rol: 'lector', biometriaActiva: true },
  { id: 'usr-013', legajo: 'L-013', nombre: 'Jorge Pereyra', rol: 'lector', biometriaActiva: false },
  { id: 'usr-014', legajo: 'L-014', nombre: 'Marta Quiroga', rol: 'lector', biometriaActiva: true },
  { id: 'usr-015', legajo: 'L-015', nombre: 'Carlos Ibáñez', rol: 'lector', biometriaActiva: false },
  { id: 'usr-016', legajo: 'L-016', nombre: 'Ana Belén Sosa', rol: 'lector', biometriaActiva: true },
  { id: 'usr-017', legajo: 'L-017', nombre: 'Pedro Álvarez', rol: 'lector', biometriaActiva: true },
  { id: 'usr-018', legajo: 'L-018', nombre: 'Lucía Romero', rol: 'lector', biometriaActiva: false },
  { id: 'usr-019', legajo: 'L-019', nombre: 'Héctor Gómez', rol: 'lector', biometriaActiva: true },
  { id: 'usr-020', legajo: 'L-020', nombre: 'Norma Cabrera', rol: 'lector', biometriaActiva: false },
  { id: 'usr-021', legajo: 'L-021', nombre: 'Diego Palacios', rol: 'lector', biometriaActiva: true },
  { id: 'usr-022', legajo: 'L-022', nombre: 'Claudia Medina', rol: 'lector', biometriaActiva: true },
  { id: 'usr-023', legajo: 'L-023', nombre: 'Raúl Benítez', rol: 'lector', biometriaActiva: false },
  { id: 'usr-024', legajo: 'L-024', nombre: 'Verónica Acosta', rol: 'lector', biometriaActiva: true },
  { id: 'usr-025', legajo: 'L-025', nombre: 'Miguel Torres', rol: 'lector', biometriaActiva: false },
  { id: 'usr-026', legajo: 'L-026', nombre: 'Graciela Núñez', rol: 'lector', biometriaActiva: true },
  { id: 'usr-027', legajo: 'L-027', nombre: 'Sergio Molina', rol: 'lector', biometriaActiva: true },
  { id: 'usr-028', legajo: 'L-028', nombre: 'Patricia Leiva', rol: 'lector', biometriaActiva: false },
  { id: 'usr-029', legajo: 'L-029', nombre: 'Oscar Paredes', rol: 'lector', biometriaActiva: true },
  { id: 'usr-030', legajo: 'L-030', nombre: 'Laura Vidal', rol: 'administracion', biometriaActiva: false },
]

export const extraRouteSeeds: RouteSeed[] = [
  { numero: '01', nombre: 'Centro', calle: 'San Martín', estado: 'asignada', lectorId: 'usr-012' },
  { numero: '02', nombre: 'Barrio Sur', calle: 'Belgrano', estado: 'en_curso', lectorId: 'usr-013' },
  { numero: '03', nombre: 'Villa Libertad', calle: 'Urquiza', estado: 'cerrada', lectorId: 'usr-014' },
  { numero: '04', nombre: 'Barrio Norte', calle: 'Moreno', estado: 'asignada', lectorId: 'usr-015' },
  { numero: '05', nombre: 'San Isidro', calle: 'Mitre', estado: 'en_curso', lectorId: 'usr-016' },
  { numero: '06', nombre: 'Los Pinos', calle: 'Sarmiento', estado: 'cerrada', lectorId: 'usr-017' },
  { numero: '08', nombre: 'La Estación', calle: 'Rivadavia', estado: 'asignada', lectorId: 'usr-018' },
  { numero: '09', nombre: 'Parque del Sol', calle: 'Alberdi', estado: 'en_curso', lectorId: 'usr-019' },
  { numero: '10', nombre: 'Barrio Oeste', calle: 'Pellegrini', estado: 'cerrada', lectorId: 'usr-020' },
  { numero: '11', nombre: 'Costa del Uruguay', calle: 'Costanera', estado: 'asignada', lectorId: 'usr-021' },
  { numero: '13', nombre: 'Santa Rosa', calle: '25 de Mayo', estado: 'en_curso', lectorId: 'usr-022' },
  { numero: '14', nombre: 'Las Heras', calle: 'Las Heras', estado: 'cerrada', lectorId: 'usr-023' },
  { numero: '15', nombre: 'San Martín', calle: 'Independencia', estado: 'asignada', lectorId: 'usr-024' },
  { numero: '16', nombre: 'Barrio Este', calle: 'España', estado: 'en_curso', lectorId: 'usr-025' },
  { numero: '17', nombre: 'El Molino', calle: 'Italia', estado: 'cerrada', lectorId: 'usr-026' },
  { numero: '18', nombre: 'La Floresta', calle: 'Francia', estado: 'asignada', lectorId: 'usr-027' },
  { numero: '19', nombre: 'Pueblo Nuevo', calle: 'Chile', estado: 'en_curso', lectorId: 'usr-028' },
  { numero: '20', nombre: 'Almirante Brown', calle: 'Brown', estado: 'cerrada', lectorId: 'usr-029' },
]

export function routeId(numero: string): string {
  return `rut-${numero}-2026-05`
}
