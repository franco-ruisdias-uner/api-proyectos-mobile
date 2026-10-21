// contract/api.ts — Tipos que agrega la API y que no están en el PRD.
// Se publican a los alumnos junto con la API (van al README y a Swagger).
// Los tipos del PRD están en ./types.ts y no se tocan.
import type { Usuario } from './types.js';

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
  tipo: "imagen" | "audio" | "video";
  bytes: number;
}

/** Respuesta de GET /salud. */
export interface Salud {
  estado: "ok";
  motor: "better-sqlite3" | "postgres" | "mysql" | "mariadb";
  almacen: "local" | "aws" | "supabase" | "r2" | "b2" | "s3proxy" | "localstack";
  version: string;
}

/** Respuesta de POST /dispositivos: el teléfono registrado para recibir push. */
export interface Dispositivo {
  tokenExpo: string;
  plataforma: "ios" | "android";
}

/** Respuesta de POST /dispositivos/prueba: a cuántos teléfonos se mandó la push de prueba. */
export interface PruebaNotificacion {
  enviadas: number;
}
