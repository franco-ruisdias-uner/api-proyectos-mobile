/**
 * Catálogo único de errores (AGENTS §4.6). Los códigos son estables para siempre; los
 * mensajes se muestran tal cual en la pantalla del teléfono.
 * El README y Swagger se arman a partir de esta tabla.
 */
export const CATALOGO = {
  // Genéricos
  VALIDACION_FALLIDA: { estado: 400, mensaje: 'Hay datos que faltan o no son válidos.' },
  NO_AUTENTICADO: { estado: 401, mensaje: 'Tenés que ingresar con tu cuenta para hacer esto.' },
  SIN_PERMISO: { estado: 403, mensaje: 'No tenés permiso para hacer esto.' },
  RUTA_NO_ENCONTRADA: { estado: 404, mensaje: 'No encontramos lo que buscabas.' },
  ARCHIVO_DEMASIADO_GRANDE: {
    estado: 413,
    mensaje:
      'El archivo es demasiado grande. Las fotos pueden pesar hasta 5 MB, los audios 10 MB y los videos 30 MB.',
  },
  TIPO_DE_ARCHIVO_NO_PERMITIDO: {
    estado: 415,
    mensaje:
      'Ese tipo de archivo no se puede subir. Usá una foto JPG, PNG o WEBP, un audio M4A, AAC o MP3, o un video MP4.',
  },
  RANGO_NO_SATISFACIBLE: { estado: 416, mensaje: 'No pudimos leer esa parte del archivo.' },
  ERROR_INTERNO: {
    estado: 500,
    mensaje: 'Algo salió mal de nuestro lado. Probá de nuevo en un rato.',
  },
  ALMACEN_NO_DISPONIBLE: {
    estado: 503,
    mensaje: 'No pudimos acceder a los archivos. Probá de nuevo en un rato.',
  },

  // Cuenta
  EMAIL_YA_REGISTRADO: { estado: 409, mensaje: 'Ya hay una cuenta con ese email. Probá ingresar.' },
  CREDENCIALES_INVALIDAS: { estado: 401, mensaje: 'El email o la contraseña no son correctos.' },

  // Archivos
  ARCHIVO_NO_ENCONTRADO: { estado: 404, mensaje: 'No encontramos ese archivo.' },
  ARCHIVO_NO_SUBIDO: { estado: 422, mensaje: 'Primero hay que subir la foto o el video.' },
} as const satisfies Record<string, { estado: number; mensaje: string }>;

export type CodigoError = keyof typeof CATALOGO;
