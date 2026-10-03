import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { CATALOGO, type CodigoError } from '../comun/errores/catalogo.js';

/** Documenta en Swagger cada código de error que puede devolver un endpoint, con su mensaje. */
export function DocErrores(...codigos: CodigoError[]) {
  const porEstado = new Map<number, CodigoError[]>();
  for (const codigo of codigos) {
    const estado = CATALOGO[codigo].estado;
    porEstado.set(estado, [...(porEstado.get(estado) ?? []), codigo]);
  }
  return applyDecorators(
    ...[...porEstado].map(([estado, lista]) =>
      ApiResponse({
        status: estado,
        description: lista.map((c) => `\`${c}\`: ${CATALOGO[c].mensaje}`).join('<br>'),
        content: {
          'application/json': {
            examples: Object.fromEntries(
              lista.map((c) => [
                c,
                { value: { error: { codigo: c, mensaje: CATALOGO[c].mensaje } } },
              ]),
            ),
          },
        },
      }),
    ),
  );
}
