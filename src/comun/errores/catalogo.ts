// Catálogo único de errores. Los códigos son estables: una vez publicados no cambian.
// Los mensajes se muestran tal cual en la pantalla del teléfono.

export const CATALOGO = {
  // Comunes
  VALIDACION_FALLIDA: { estado: 400, mensaje: 'Hay un dato que no está bien.' },
  NO_AUTENTICADO: {
    estado: 401,
    mensaje: 'Tenés que ingresar de nuevo con tu legajo y contraseña.',
  },
  CREDENCIALES_INVALIDAS: {
    estado: 401,
    mensaje: 'El legajo o la contraseña no son correctos.',
  },
  SIN_PERMISO: { estado: 403, mensaje: 'No tenés permiso para hacer eso.' },
  RECURSO_NO_ENCONTRADO: {
    estado: 404,
    mensaje: 'Esa dirección no existe en la API.',
  },
  ARCHIVO_NO_ENCONTRADO: {
    estado: 404,
    mensaje: 'No encontramos ese archivo.',
  },
  RANGO_NO_VALIDO: {
    estado: 416,
    mensaje: 'No se pudo leer esa parte del archivo.',
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
  ARCHIVO_NO_SUBIDO: {
    estado: 422,
    mensaje:
      'El archivo todavía no se subió. Probá de nuevo cuando tengas señal.',
  },
  ERROR_INTERNO: {
    estado: 500,
    mensaje: 'Algo salió mal de nuestro lado. Probá de nuevo en un rato.',
  },
  ALMACEN_NO_DISPONIBLE: {
    estado: 503,
    mensaje: 'No pudimos acceder a los archivos. Probá de nuevo en un rato.',
  },

  // Lectura de Medidores — usuarios
  LEGAJO_YA_REGISTRADO: {
    estado: 409,
    mensaje: 'Ya hay una cuenta con ese legajo.',
  },
  USUARIO_NO_ENCONTRADO: { estado: 404, mensaje: 'No existe ese usuario.' },

  // Lectura de Medidores — suministros y medidores
  SUMINISTRO_NO_ENCONTRADO: {
    estado: 404,
    mensaje: 'No existe ese suministro.',
  },
  MEDIDOR_NO_ENCONTRADO: { estado: 404, mensaje: 'No existe ese medidor.' },
} as const satisfies Record<string, { estado: number; mensaje: string }>;

export type CodigoError = keyof typeof CATALOGO;
