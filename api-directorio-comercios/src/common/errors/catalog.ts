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
  NO_IMPLEMENTADO: {
    estado: 501,
    mensaje: 'Esta parte la programan ustedes. Mirá docs/NOTIFICATIONS.md.',
  },
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

  // Comercios
  COMERCIO_NO_ENCONTRADO: { estado: 404, mensaje: 'No existe ese comercio.' },
  QR_NO_RECONOCIDO: { estado: 404, mensaje: 'Ese código no es de un comercio asociado.' },

  RUBRO_NO_ENCONTRADO: { estado: 422, mensaje: 'Alguno de los rubros elegidos no existe.' },

  // Promociones
  PROMOCION_NO_ENCONTRADA: { estado: 404, mensaje: 'No existe esa promoción.' },
  // 410 al pedir el detalle; 422 al intentar usarla, validarla o editarla.
  PROMO_VENCIDA: { estado: 410, mensaje: 'Esa promoción ya no está vigente.' },

  PROMO_NO_EMPEZO: { estado: 422, mensaje: 'Esa promoción todavía no empezó.' },
  PROMO_SIN_CODIGO: {
    estado: 422,
    mensaje: 'Esta promoción no necesita código: se aplica directo en el local.',
  },
  PROMO_YA_USADA: { estado: 409, mensaje: 'Ya usaste esta promoción.' },
  CODIGO_INVALIDO: { estado: 404, mensaje: 'Ese código no existe.' },
  CODIGO_YA_VALIDADO: { estado: 409, mensaje: 'Ese código ya se usó.' },
  PROMO_DE_OTRO_COMERCIO: { estado: 403, mensaje: 'Ese código es de otro comercio.' },

  HORARIOS_SUPERPUESTOS: { estado: 422, mensaje: 'Hay dos horarios que se pisan el mismo día.' },

  // Reseñas
  RESENA_NO_ENCONTRADA: { estado: 404, mensaje: 'No existe esa reseña.' },
  RESENA_YA_EXISTE: {
    estado: 409,
    mensaje: 'Ya dejaste una reseña para este comercio. Podés editarla.',
  },
  RESENA_YA_RESPONDIDA: { estado: 409, mensaje: 'Ya respondiste esta reseña.' },
  REPORTE_PROPIO: { estado: 422, mensaje: 'No podés reportar tu propia reseña.' },
  FECHA_EN_EL_FUTURO: { estado: 422, mensaje: 'La fecha no puede ser posterior a este momento.' },
  ID_EN_USO: { estado: 409, mensaje: 'Ese identificador ya está en uso.' },

  // Archivos
  ARCHIVO_NO_ENCONTRADO: { estado: 404, mensaje: 'No encontramos ese archivo.' },
  ARCHIVO_NO_SUBIDO: { estado: 422, mensaje: 'Primero hay que subir la foto o el video.' },
} as const satisfies Record<string, { estado: number; mensaje: string }>;

export type CodigoError = keyof typeof CATALOGO;
