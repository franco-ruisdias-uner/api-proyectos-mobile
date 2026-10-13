// contrato/api.ts — Tipos que agrega la API y que no están en el PRD.
// Se publican a los alumnos junto con la API (van al README y a Swagger).
// Los tipos del PRD están en ./tipos.ts y no se tocan.
import type {
  Lectura,
  Medidor,
  MotivoNovedad,
  Novedad,
  Ruta,
  Suministro,
  Usuario,
} from './tipos.js';

/** Paginación de toda respuesta de lista. */
export interface Meta {
  total: number;
  pagina: number;
  porPagina: number;
}

/** Éxito con una lista: { datos: [...], meta: {...} } */
export interface RespuestaLista<T> {
  datos: T[];
  meta: Meta;
}

/** Éxito con un solo recurso: { datos: {...}, meta: null } */
export interface RespuestaUno<T> {
  datos: T;
  meta: null;
}

/** Error: { error: { codigo, mensaje } } — sin otros campos. */
export interface RespuestaError {
  error: {
    codigo: string;
    mensaje: string;
  };
}

/** Respuesta de POST /auth/registro y POST /auth/ingreso. */
export interface Sesion {
  token: string;
  usuario: Usuario;
}

/** Respuesta de POST /archivos. */
export interface ArchivoSubido {
  url: string;
  tipo: 'imagen' | 'audio' | 'video';
  bytes: number;
}

/** Respuesta de GET /salud. */
export interface Salud {
  estado: 'ok';
  motor: 'better-sqlite3' | 'postgres' | 'mysql' | 'mariadb';
  almacen:
    'local' | 'aws' | 'supabase' | 'r2' | 'b2' | 's3proxy' | 'localstack';
  version: string;
}

/** Respuesta de POST /dispositivos: el token de Expo registrado para el usuario de la sesión. */
export interface Dispositivo {
  tokenExpo: string;
  plataforma: 'ios' | 'android';
}

/** Respuesta de POST /dispositivos/prueba: a cuántos dispositivos del usuario se mandó la push. */
export interface PruebaPush {
  dispositivos: number;
}

/** Respuesta de POST /rutas/:id/descarga: la jornada completa, sin paginar. */
export interface PaqueteRuta {
  ruta: Ruta;
  /** En el orden de `ruta.suministroIds`. */
  suministros: Suministro[];
  /** Los de esos suministros, uno por suministro, en el mismo orden. */
  medidores: Medidor[];
  /** Las vigentes que el servidor ya tiene de esa ruta. */
  lecturas: Lectura[];
  /** Ídem. */
  novedades: Novedad[];
}

/** Respuesta de GET /rutas/:id/avance: lo que el servidor ya recibió. */
export interface AvanceRuta {
  rutaId: string;
  suministros: number;
  leidos: number;
  conNovedad: number;
  /** suministros - leidos - conNovedad */
  pendientes: number;
  fueraDeRango: number;
}

/** Un renglón de GET /novedades/resumen. */
export interface ResumenNovedades {
  motivo: MotivoNovedad;
  /** Nombre de la ruta (D10). */
  zona: string;
  cantidad: number;
}
