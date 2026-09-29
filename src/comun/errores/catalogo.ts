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
  ID_EN_USO: { estado: 409, mensaje: 'Ese identificador ya está en uso.' },
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
  // Reporte Ciudadano
  REPORTE_NO_ENCONTRADO: {
    estado: 404,
    mensaje: 'No encontramos ese reporte.',
  },
  FOTO_REQUERIDA: {
    estado: 422,
    mensaje: 'El reporte necesita al menos una foto.',
  },
  TIPO_NO_ENCONTRADO: {
    estado: 422,
    mensaje: 'Elegí qué tipo de problema es.',
  },
  FUERA_DE_LA_CIUDAD: {
    estado: 422,
    mensaje: 'Ese punto queda fuera de Gualeguaychú. Corregilo en el mapa.',
  },
  FECHA_EN_EL_FUTURO: {
    estado: 422,
    mensaje: 'La fecha del reporte no puede ser posterior a este momento.',
  },
  ARCHIVO_NO_SUBIDO: {
    estado: 422,
    mensaje: 'Primero hay que subir la foto o el audio.',
  },
  REPORTE_CERRADO: {
    estado: 422,
    mensaje: 'Ese reporte ya está cerrado.',
  },
  ADHESION_A_REPORTE_PROPIO: {
    estado: 422,
    mensaje: 'Ya sos el autor de este reporte.',
  },
  TRANSICION_INVALIDA: {
    estado: 422,
    mensaje: 'Ese cambio de estado no es posible desde el estado actual.',
  },
  MOTIVO_REQUERIDO: {
    estado: 422,
    mensaje: 'Contá por qué se rechaza el reporte.',
  },
  CUADRILLA_REQUERIDA: {
    estado: 422,
    mensaje: 'Para asignar, elegí una cuadrilla.',
  },
  CUADRILLA_NO_ENCONTRADA: {
    estado: 422,
    mensaje: 'No existe esa cuadrilla.',
  },
  CUADRILLA_INACTIVA: {
    estado: 422,
    mensaje: 'Esa cuadrilla no está activa.',
  },
  CUADRILLA_DE_OTRA_ZONA: {
    estado: 422,
    mensaje: 'Esa cuadrilla trabaja en otra zona.',
  },
  DUPLICADO_INVALIDO: {
    estado: 422,
    mensaje: 'No se puede marcar como duplicado de ese reporte.',
  },
  ESTADO_NO_ADMITE_FOTO: {
    estado: 422,
    mensaje:
      'La foto del arreglo se sube cuando el reporte está asignado o resuelto.',
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
