import { applyDecorators } from '@nestjs/common';
import { ValidateBy } from 'class-validator';
import { interpretarInstante } from './fechas.js';

/**
 * Instante ISO 8601 que viene en el cuerpo: tiene que traer offset (o Z) y ser una fecha que
 * exista. Queda como texto en el DTO; el servicio lo interpreta con `interpretarInstante`.
 */
export const CampoInstante = (mensaje: string) =>
  applyDecorators(
    ValidateBy({
      name: 'esInstante',
      validator: {
        validate: (valor: unknown) =>
          typeof valor === 'string' && interpretarInstante(valor) !== null,
        defaultMessage: () => mensaje,
      },
    }),
  );
