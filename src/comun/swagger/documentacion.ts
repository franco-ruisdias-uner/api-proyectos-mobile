// Ayudas para Swagger (AGENTS §11.5): errores posibles de cada endpoint y sobres de respuesta.
import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { CATALOGO, type CodigoError } from '../errores/catalogo.js';

/** Documenta cada código de error que puede devolver el endpoint, con su estado y mensaje. */
export function DocErrores(...codigos: CodigoError[]) {
  const porEstado = new Map<number, CodigoError[]>();
  for (const c of codigos) {
    const estado = CATALOGO[c].estado;
    porEstado.set(estado, [...(porEstado.get(estado) ?? []), c]);
  }
  return applyDecorators(
    ...[...porEstado].map(([estado, lista]) =>
      ApiResponse({
        status: estado,
        description: lista
          .map((c) => `\`${c}\`: ${CATALOGO[c].mensaje}`)
          .join('<br>'),
        schema: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                codigo: { type: 'string', enum: lista, example: lista[0] },
                mensaje: {
                  type: 'string',
                  example: CATALOGO[lista[0]].mensaje,
                },
              },
              required: ['codigo', 'mensaje'],
            },
          },
          required: ['error'],
        },
      }),
    ),
  );
}

/** Endpoint con sesión: candado en Swagger y 401. */
export const DocConSesion = () =>
  applyDecorators(ApiBearerAuth(), DocErrores('NO_AUTENTICADO'));

/** Respuesta { datos: <modelo>, meta: null }. */
export function DocRespuestaUno(
  estado: number,
  modelo: Type<unknown>,
  descripcion: string,
) {
  return applyDecorators(
    ApiExtraModels(modelo),
    ApiResponse({
      status: estado,
      description: descripcion,
      schema: {
        type: 'object',
        properties: {
          datos: { $ref: getSchemaPath(modelo) },
          meta: { type: 'null', example: null },
        },
        required: ['datos', 'meta'],
      },
    }),
  );
}

/** Respuesta { datos: [<modelo>], meta: { total, pagina, porPagina } }. */
export function DocRespuestaLista(modelo: Type<unknown>, descripcion: string) {
  return applyDecorators(
    ApiExtraModels(modelo),
    ApiResponse({
      status: 200,
      description: descripcion,
      schema: {
        type: 'object',
        properties: {
          datos: { type: 'array', items: { $ref: getSchemaPath(modelo) } },
          meta: {
            type: 'object',
            properties: {
              total: { type: 'integer', example: 42 },
              pagina: { type: 'integer', example: 1 },
              porPagina: { type: 'integer', example: 20 },
            },
            required: ['total', 'pagina', 'porPagina'],
          },
        },
        required: ['datos', 'meta'],
      },
    }),
  );
}
