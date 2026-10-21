import {
  BadRequestException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ErrorApi } from './error-api.js';
import { traducirExcepcion } from './exception-filter.js';
import { esViolacionDeUnicidad } from './uniqueness.js';

describe('AGENTS §4.6 — Todo error sale como { error: { codigo, mensaje } }', () => {
  it('ErrorApi usa el estado del catálogo y su mensaje', () => {
    expect(traducirExcepcion(new ErrorApi('EMAIL_YA_REGISTRADO'))).toEqual({
      estado: 409,
      cuerpo: {
        error: {
          codigo: 'EMAIL_YA_REGISTRADO',
          mensaje: 'Ya hay una cuenta con ese email.',
        },
      },
    });
  });

  it.each([
    [new NotFoundException('Cannot GET /x'), 404, 'RUTA_NO_ENCONTRADA'],
    [new BadRequestException('bad'), 400, 'VALIDACION_FALLIDA'],
    [
      new BadRequestException(`Unexpected end of JSON input`),
      400,
      'VALIDACION_FALLIDA',
    ],
    [
      new PayloadTooLargeException('File too large'),
      413,
      'ARCHIVO_DEMASIADO_GRANDE',
    ],
    [new Error('boom'), 500, 'ERROR_INTERNO'],
    ['algo raro', 500, 'ERROR_INTERNO'],
    [
      new QueryFailedError('SELECT 1', [], new Error('SQLITE_ERROR')),
      500,
      'ERROR_INTERNO',
    ],
  ])('%s → %i %s, sin detalles técnicos', (excepcion, estado, codigo) => {
    const r = traducirExcepcion(excepcion);
    expect(r.estado).toBe(estado);
    expect(r.cuerpo.error.codigo).toBe(codigo);
    expect(Object.keys(r.cuerpo.error).sort()).toEqual(['codigo', 'mensaje']);
    expect(r.cuerpo.error.mensaje).not.toMatch(
      /Cannot|bad|boom|File too large|SQLITE|Unexpected/,
    );
  });

  it('un JSON mal formado (body-parser) sale como 400 en castellano', () => {
    const e = Object.assign(new SyntaxError('Unexpected token'), {
      status: 400,
      type: 'entity.parse.failed',
    });
    expect(traducirExcepcion(e).cuerpo.error).toEqual({
      codigo: 'VALIDACION_FALLIDA',
      mensaje: 'El cuerpo del pedido no es un JSON válido.',
    });
  });
});

describe('AGENTS §4.6 — Violación de índice único en cada motor', () => {
  const con = (driverError: object) =>
    new QueryFailedError(
      'INSERT',
      [],
      Object.assign(new Error('dup'), driverError),
    );
  it.each([
    ['sqlite', con({ code: 'SQLITE_CONSTRAINT_UNIQUE' }), true],
    ['postgres', con({ code: '23505' }), true],
    ['mysql', con({ code: 'ER_DUP_ENTRY', errno: 1062 }), true],
    ['otro error de base', con({ code: '42P01' }), false],
    ['error común', new Error('x'), false],
  ])('%s', (_motor, error, esperado) => {
    expect(esViolacionDeUnicidad(error)).toBe(esperado);
  });
});
