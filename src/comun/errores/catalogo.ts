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
  NO_IMPLEMENTADO: {
    estado: 501,
    mensaje: 'Esta parte la programan ustedes. Mirá docs/NOTIFICACIONES.md.',
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

  // Lectura de Medidores — rutas
  LECTOR_NO_ENCONTRADO: {
    estado: 422,
    mensaje: 'Ese usuario no existe o no es lector.',
  },
  RUTA_NO_ENCONTRADA: { estado: 404, mensaje: 'No existe esa ruta.' },
  RUTA_YA_EXISTE: {
    estado: 409,
    mensaje: 'Ya hay una ruta con ese número en ese bimestre.',
  },
  RUTA_YA_CERRADA: { estado: 409, mensaje: 'Esa ruta fue cerrada el DD/MM.' },
  RUTA_EN_CURSO: {
    estado: 409,
    mensaje:
      'La ruta ya salió a la calle: no se le pueden cambiar los suministros.',
  },
  HAY_DATOS_SIN_SUBIR: {
    estado: 409,
    mensaje:
      'Faltan subir N lecturas y N novedades. Esperá a tener señal y probá de nuevo.',
  },
  SUMINISTRO_REPETIDO: {
    estado: 422,
    mensaje: 'Hay un suministro repetido en la ruta.',
  },
  SUMINISTRO_EN_OTRA_RUTA: {
    estado: 409,
    mensaje: 'El suministro 004120 ya está en la ruta 07 de este bimestre.',
  },

  // Lectura de Medidores — lecturas
  SUMINISTRO_FUERA_DE_RUTA: {
    estado: 422,
    mensaje: 'Ese suministro no es de esta ruta.',
  },
  LECTURA_INVALIDA: {
    estado: 422,
    mensaje: 'Ese número no puede salir de este medidor. Revisalo.',
  },
  LECTURA_NO_ENCONTRADA: {
    estado: 404,
    mensaje: 'No encontramos esa lectura.',
  },
  FOTO_REQUERIDA: { estado: 422, mensaje: 'Falta la foto del medidor.' },
  ID_EN_USO: {
    estado: 409,
    mensaje: 'Ese identificador ya lo usó otra persona.',
  },

  // Lectura de Medidores — novedades
  NOVEDAD_NO_ENCONTRADA: {
    estado: 404,
    mensaje: 'No encontramos esa novedad.',
  },

  // Lectura de Medidores — suministros y medidores
  SUMINISTRO_NO_ENCONTRADO: {
    estado: 404,
    mensaje: 'No existe ese suministro.',
  },
  MEDIDOR_NO_ENCONTRADO: { estado: 404, mensaje: 'No existe ese medidor.' },
} as const satisfies Record<string, { estado: number; mensaje: string }>;

export type CodigoError = keyof typeof CATALOGO;
