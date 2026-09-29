// contrato/tipos.ts — «Reporte Ciudadano · Gualeguaychú»
// Copia literal de los tipos del PRD (sección «Resumen — qué entidades maneja la app»).
// Es lo que los alumnos tienen en src/tipos/. NO SE MODIFICA.

export interface Coordenadas {
  latitud: number;
  longitud: number;
}

export interface Foto {
  id: string;
  url: string; // o ruta local mientras no se subió
  momento: "problema" | "arreglo";
}

export type EstadoReporte =
  | "recibido" | "en_revision" | "asignado" | "resuelto" | "rechazado";

export interface Reporte {
  id: string;
  codigo: string;
  tipoId: string;
  descripcion: string | null;
  audioUrl: string | null;
  fotos: Foto[];
  coordenadas: Coordenadas;
  direccion: string;
  zonaId: string;
  estado: EstadoReporte;
  autorId: string;
  cuadrillaId: string | null;
  duplicadoDe: string | null;
  adhesiones: number;
  creadoEn: string;
  sincronizado: boolean;
}

export interface TipoDeReporte {
  id: string;
  nombre: string;
  icono: string;
  color: string;
  areaResponsable: string;
}

export interface CambioDeEstado {
  id: string;
  reporteId: string;
  estado: EstadoReporte;
  comentario: string | null;
  operadorId: string | null;
  fechaHora: string;
}

export type Rol = "vecino" | "operador";

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  rol: Rol;
  zonaId: string | null;
  avisosActivos: boolean;
  creadoEn: string;
}

export interface Zona {
  id: string;
  nombre: string;
  limite: Coordenadas[];
  referente: string;
}

export interface Cuadrilla {
  id: string;
  nombre: string;
  zonaId: string;
  especialidad: string;
  activa: boolean;
}
