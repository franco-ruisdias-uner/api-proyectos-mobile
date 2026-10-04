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
  TURNO_NO_ENCONTRADO: { estado: 404, mensaje: 'No existe ese turno.' },
  TURNO_PASADO: { estado: 422, mensaje: 'Ese turno ya pasó.' },
  TURNO_OCUPADO: { estado: 409, mensaje: 'Ese turno ya fue reservado.' },
  TURNO_NO_DISPONIBLE: {
    estado: 409,
    mensaje: 'Ese turno no está disponible.',
  },
  CAPACIDAD_EXCEDIDA: {
    estado: 422,
    mensaje: 'Son más personas de las que entran en este espacio.',
  },
  LIMITE_DE_RESERVAS: {
    estado: 422,
    mensaje: 'Ya tenés tres reservas activas. Cancelá una para reservar otra.',
  },
  RESERVA_NO_ENCONTRADA: {
    estado: 404,
    mensaje: 'No encontramos esa reserva.',
  },
  CANCELACION_FUERA_DE_PLAZO: {
    estado: 422,
    mensaje:
      'Faltan menos de cuatro horas: avisale al encargado para cancelar.',
  },
  RESERVA_NO_CANCELABLE: {
    estado: 409,
    mensaje: 'Esa reserva ya no se puede cancelar.',
  },
  CODIGO_INVALIDO: { estado: 404, mensaje: 'Ese código no es de una reserva.' },
  USUARIO_NO_ENCONTRADO: { estado: 404, mensaje: 'No existe ese usuario.' },
  RESERVA_CANCELADA: { estado: 422, mensaje: 'Esa reserva está cancelada.' },
  RESERVA_AUSENTE: {
    estado: 422,
    mensaje: 'Esa reserva figura como ausente.',
  },
  CODIGO_DE_OTRO_DIA: { estado: 422, mensaje: 'Esa reserva no es para hoy.' },
  CODIGO_DE_OTRO_ESPACIO: {
    estado: 422,
    mensaje: 'Esa reserva es para otra cancha.',
  },
  INGRESO_YA_REGISTRADO: { estado: 409, mensaje: 'Esa reserva ya ingresó.' },
  FUERA_DE_HORARIO: {
    estado: 422,
    mensaje: 'Todavía no es el horario de esa reserva, o ya terminó.',
  },
  ANTES_DE_TIEMPO: {
    estado: 422,
    mensaje: 'Todavía no se puede marcar como ausente.',
  },
  BLOQUEO_NO_ENCONTRADO: {
    estado: 404,
    mensaje: 'No encontramos ese bloqueo.',
  },
  FIJA_NO_ENCONTRADA: {
    estado: 404,
    mensaje: 'No encontramos esa reserva fija.',
  },
  MOTIVO_REQUERIDO: { estado: 422, mensaje: 'Escribí el motivo del bloqueo.' },
  FECHA_PASADA: {
    estado: 422,
    mensaje: 'No se puede bloquear un día que ya pasó.',
  },
  FIJA_SUPERPUESTA: {
    estado: 409,
    mensaje: 'Ya hay una reserva fija en ese horario.',
  },
  CONFLICTO_CON_RESERVAS: {
    estado: 409,
    mensaje:
      'Hay reservas confirmadas en ese horario. Resolvelas antes de cargar la fija.',
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
  NO_IMPLEMENTADO: {
    estado: 501,
    mensaje: 'Esta parte la programan ustedes. Mirá docs/NOTIFICACIONES.md.',
  },
  ALMACEN_NO_DISPONIBLE: {
    estado: 503,
    mensaje: 'No pudimos acceder a los archivos. Probá de nuevo en un rato.',
  },
} as const satisfies Record<string, EntradaCatalogo>;

export type CodigoError = keyof typeof CATALOGO;
