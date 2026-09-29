// Catálogo único de errores (AGENTS §4.6). Los códigos son estables para siempre: se agregan,
// nunca se cambian. Los mensajes se muestran tal cual en la pantalla del teléfono.

interface EntradaCatalogo {
  estado: number;
  mensaje: string;
}

export const CATALOGO = {
  // Comunes a los cinco proyectos
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
  ARCHIVO_NO_ENCONTRADO: {
    estado: 404,
    mensaje: 'No encontramos ese archivo.',
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
      'Ese tipo de archivo no se puede subir. Mandá una foto, un audio o un video.',
  },
  RANGO_NO_SATISFACIBLE: {
    estado: 416,
    mensaje: 'Esa parte del archivo no existe.',
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

export const esCodigoError = (valor: string): valor is CodigoError =>
  valor in CATALOGO;

/**
 * Error de negocio o de protocolo con un código del catálogo. El filtro global lo convierte
 * en { error: { codigo, mensaje } } con el estado del catálogo.
 */
export class ErrorApi extends Error {
  readonly estado: number;

  constructor(
    readonly codigo: CodigoError,
    mensaje?: string,
    /** Cabeceras que acompañan la respuesta (p. ej. Content-Range en un 416). */
    readonly cabeceras: Record<string, string> = {},
  ) {
    super(mensaje ?? CATALOGO[codigo].mensaje);
    this.name = 'ErrorApi';
    this.estado = CATALOGO[codigo].estado;
  }
}
