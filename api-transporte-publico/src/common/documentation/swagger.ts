import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { CATALOGO, type CodigoDeError } from '../errors/catalog.js';

/** Documenta en Swagger cada código de error que puede devolver un endpoint. */
export function ErroresPosibles(...codigos: CodigoDeError[]) {
  const porEstado = new Map<number, CodigoDeError[]>();
  for (const codigo of codigos) {
    const estado = CATALOGO[codigo].estado;
    porEstado.set(estado, [...(porEstado.get(estado) ?? []), codigo]);
  }
  return applyDecorators(
    ...[...porEstado.entries()].map(([estado, lista]) =>
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

/** Respuesta de éxito con un ejemplo del cuerpo completo (sobre incluido). */
export function Ejemplo(estado: number, descripcion: string, ejemplo: unknown) {
  return ApiResponse({
    status: estado,
    description: descripcion,
    content: { 'application/json': { example: ejemplo } },
  });
}
