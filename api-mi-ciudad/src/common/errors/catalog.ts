/**
 * Catálogo único de errores (AGENTS §4.6). Los códigos son estables para siempre: la app de
 * los alumnos decide qué mostrar según el código. Los mensajes se muestran tal cual en pantalla.
 */
export const CATALOGO_ERRORES = {
  // Comunes
  VALIDACION_FALLIDA: { estado: 400, mensaje: 'Revisá los datos que mandaste.' },
  NO_AUTENTICADO: { estado: 401, mensaje: 'Tenés que ingresar con tu cuenta para hacer esto.' },
  SIN_PERMISO: { estado: 403, mensaje: 'No tenés permiso para hacer esto.' },
  RUTA_NO_ENCONTRADA: { estado: 404, mensaje: 'Esa dirección no existe en la API.' },
  PEDIDO_DEMASIADO_GRANDE: { estado: 413, mensaje: 'El pedido es demasiado grande.' },
  ARCHIVO_DEMASIADO_GRANDE: { estado: 413, mensaje: 'El archivo es demasiado grande.' },
  TIPO_DE_ARCHIVO_NO_PERMITIDO: {
    estado: 415,
    mensaje: 'Ese tipo de archivo no se puede subir. Probá con una foto, un audio o un video.',
  },
  RANGO_NO_SATISFACIBLE: { estado: 416, mensaje: 'No pudimos leer esa parte del archivo.' },
  NO_IMPLEMENTADO: {
    estado: 501,
    mensaje: 'Esta parte la programan ustedes. Mirá docs/NOTIFICATIONS.md.',
  },
  ERROR_INTERNO: { estado: 500, mensaje: 'Algo salió mal de nuestro lado. Probá de nuevo en un rato.' },
  ALMACEN_NO_DISPONIBLE: {
    estado: 503,
    mensaje: 'No pudimos acceder a los archivos. Probá de nuevo en un rato.',
  },
  // Cuenta
  CREDENCIALES_INVALIDAS: { estado: 401, mensaje: 'El email o la contraseña no son correctos.' },
  EMAIL_YA_REGISTRADO: { estado: 409, mensaje: 'Ya hay una cuenta con ese email.' },
  // Archivos
  ARCHIVO_NO_ENCONTRADO: { estado: 404, mensaje: 'No encontramos ese archivo.' },
  ARCHIVO_NO_SUBIDO: { estado: 422, mensaje: 'Primero hay que subir la foto.' },
  // Catálogo
  LUGAR_NO_ENCONTRADO: { estado: 404, mensaje: 'No existe ese lugar.' },
  QR_NO_RECONOCIDO: {
    estado: 404,
    mensaje: 'Ese código no es de Mi Ciudad. Probá con el cartel de otro lugar.',
  },
  // Agenda
  EVENTO_NO_ENCONTRADO: { estado: 404, mensaje: 'No existe ese evento.' },
  EVENTO_NO_VIGENTE: { estado: 422, mensaje: 'Ese evento ya terminó o fue cancelado.' },
  // Mi recorrido
  VISITA_NO_ENCONTRADA: { estado: 404, mensaje: 'No encontramos esa visita.' },
  FECHA_EN_EL_FUTURO: {
    estado: 422,
    mensaje: 'La fecha de la visita no puede ser posterior a este momento.',
  },
  ID_EN_USO: { estado: 409, mensaje: 'Ese identificador ya está en uso.' },
  // Proyecto
  CATEGORIA_NO_ENCONTRADA: { estado: 422, mensaje: 'Alguna de las categorías elegidas no existe.' },
} as const satisfies Record<string, { estado: number; mensaje: string }>;

export type CodigoError = keyof typeof CATALOGO_ERRORES;
