import type { ApiError } from '@/types/api'

export const rutaCerradaError: ApiError = {
  error: {
    codigo: 'RUTA_YA_CERRADA',
    mensaje: 'Esa ruta fue cerrada el 14/09.',
  },
}
