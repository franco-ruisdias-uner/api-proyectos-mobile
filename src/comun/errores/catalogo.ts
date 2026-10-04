// Catálogo único de errores (AGENTS §4.6). Los códigos son estables para siempre:
// la app los compara. Los mensajes se muestran tal cual en la pantalla.

export interface EntradaCatalogo {
  estado: number;
  mensaje: string;
}

export const CATALOGO = {
  // Comunes a toda la API
  VALIDACION_FALLIDA: {
    estado: 400,
    mensaje: 'Revisá los datos que mandaste.',
  },
  NO_AUTENTICADO: { estado: 401, mensaje: 'Tenés que ingresar con tu cuenta.' },
  CREDENCIALES_INVALIDAS: {
    estado: 401,
    mensaje: 'El email o la contraseña no son correctos.',
  },
  SIN_PERMISO: { estado: 403, mensaje: 'No tenés permiso para hacer esto.' },
  RUTA_NO_ENCONTRADA: {
    estado: 404,
    mensaje: 'Esa dirección no existe en la API.',
  },
  ESPACIO_NO_ENCONTRADO: {
    estado: 404,
    mensaje: 'No existe ese espacio.',
  },
  ARCHIVO_NO_ENCONTRADO: {
    estado: 404,
    mensaje: 'No encontramos ese archivo.',
  },
  FECHA_FUERA_DE_RANGO: {
    estado: 422,
    mensaje: 'Sólo se pueden ver y reservar los próximos siete días.',
  },
  EMAIL_YA_REGISTRADO: {
    estado: 409,
    mensaje: 'Ya hay una cuenta con ese email.',
  },
  ARCHIVO_DEMASIADO_GRANDE: {
    estado: 413,
    mensaje: 'El archivo es demasiado grande.',
  },
  TIPO_DE_ARCHIVO_NO_PERMITIDO: {
    estado: 415,
    mensaje:
      'Ese tipo de archivo no se puede subir. Usá una foto, un audio o un video.',
  },
  RANGO_NO_VALIDO: {
    estado: 416,
    mensaje: 'No pudimos leer esa parte del archivo.',
  },
  ERROR_INTERNO: {
    estado: 500,
    mensaje: 'Algo salió mal de nuestro lado. Probá de nuevo en un rato.',
  },
  ALMACEN_NO_DISPONIBLE: {
    estado: 503,
    mensaje: 'No pudimos acceder a los archivos. Probá de nuevo en un rato.',
  },
} as const satisfies Record<string, EntradaCatalogo>;

export type CodigoError = keyof typeof CATALOGO;
