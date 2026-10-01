// Catálogo único de errores (AGENTS §4.6). Los códigos son estables para siempre: se pueden
// agregar, nunca cambiar. Los mensajes se muestran tal cual en la pantalla del teléfono.

export interface EntradaDeCatalogo {
  estado: number;
  mensaje: string;
}

export const CATALOGO = {
  // Genéricos
  VALIDACION_FALLIDA: { estado: 400, mensaje: 'Revisá los datos que mandaste.' },
  NO_AUTENTICADO: { estado: 401, mensaje: 'Tenés que ingresar con tu cuenta.' },
  SIN_PERMISO: { estado: 403, mensaje: 'No tenés permiso para hacer esto.' },
  RUTA_NO_ENCONTRADA: { estado: 404, mensaje: 'Esa dirección no existe en la API.' },
  ARCHIVO_DEMASIADO_GRANDE: { estado: 413, mensaje: 'El archivo es demasiado grande.' },
  TIPO_DE_ARCHIVO_NO_PERMITIDO: {
    estado: 415,
    mensaje: 'Ese tipo de archivo no está permitido. Mandá una foto, un audio o un video.',
  },
  RANGO_NO_VALIDO: { estado: 416, mensaje: 'No se puede enviar esa parte del archivo.' },
  ERROR_INTERNO: { estado: 500, mensaje: 'Algo salió mal. Probá de nuevo en un rato.' },
  ALMACEN_NO_DISPONIBLE: {
    estado: 503,
    mensaje: 'No pudimos acceder a los archivos. Probá de nuevo en un rato.',
  },

  // Cuenta
  EMAIL_YA_REGISTRADO: { estado: 409, mensaje: 'Ya hay una cuenta con ese email.' },
  CREDENCIALES_INVALIDAS: { estado: 401, mensaje: 'El email o la contraseña no son correctos.' },

  // Red (M1)
  LINEA_NO_ENCONTRADA: { estado: 404, mensaje: 'No existe esa línea.' },
  PARADA_NO_ENCONTRADA: { estado: 404, mensaje: 'No existe esa parada.' },
  QR_NO_RECONOCIDO: { estado: 404, mensaje: 'Ese código no es de una parada de Paraná.' },

  // Avisos (M4)
  AVISO_NO_ENCONTRADO: { estado: 404, mensaje: 'No existe ese aviso.' },
  ARCHIVO_NO_SUBIDO: { estado: 422, mensaje: 'Primero hay que subir la foto o el video.' },

  // Reportes de demora (M5)
  REPORTE_NO_ENCONTRADO: { estado: 404, mensaje: 'No encontramos ese reporte.' },
  LINEA_NO_PARA_EN_PARADA: { estado: 422, mensaje: 'Esa línea no para en esta parada.' },
  REPORTE_YA_ENVIADO: {
    estado: 409,
    mensaje: 'Ya avisaste de esta línea en esta parada hace un rato.',
  },
  REPORTE_VENCIDO: { estado: 422, mensaje: 'Ese reporte ya es viejo para confirmarlo.' },
  CONFIRMACION_PROPIA: { estado: 422, mensaje: 'No podés confirmar tu propio reporte.' },
  FECHA_EN_EL_FUTURO: {
    estado: 422,
    mensaje: 'La fecha del reporte no puede ser posterior a este momento.',
  },
  ID_EN_USO: { estado: 409, mensaje: 'Ese identificador ya está en uso.' },

  // Archivos
  ARCHIVO_NO_ENCONTRADO: { estado: 404, mensaje: 'No encontramos ese archivo.' },
} as const satisfies Record<string, EntradaDeCatalogo>;

export type CodigoDeError = keyof typeof CATALOGO;
