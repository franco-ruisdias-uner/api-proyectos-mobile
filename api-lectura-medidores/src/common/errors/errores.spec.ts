import {
  BadRequestException,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
} from '@nestjs/common';
import { CATALOGO } from './catalog.js';
import { ErrorApi, esViolacionDeUnicidad } from './error-api.js';
import { aErrorApi } from './exception-filter.js';

describe('AGENTS §4.6 — Catálogo de errores', () => {
  it('los códigos son MAYUSCULAS_CON_GUION_BAJO y los mensajes no tienen jerga', () => {
    for (const [codigo, { mensaje }] of Object.entries(CATALOGO)) {
      expect(codigo).toMatch(/^[A-Z]+(_[A-Z]+)*$/);
      expect(mensaje).not.toMatch(/exception|error:|undefined|null|stack/i);
      expect(mensaje.endsWith('.')).toBe(true);
    }
  });

  it('ErrorApi toma el estado y el mensaje del catálogo', () => {
    const e = new ErrorApi('LEGAJO_YA_REGISTRADO');
    expect([e.estado, e.message]).toEqual([
      409,
      'Ya hay una cuenta con ese legajo.',
    ]);
    expect(new ErrorApi('SIN_PERMISO', 'Otro texto.').message).toBe(
      'Otro texto.',
    );
  });

  it.each([
    [new BadRequestException('x'), 'VALIDACION_FALLIDA', 400],
    [new UnauthorizedException(), 'NO_AUTENTICADO', 401],
    [new NotFoundException('Cannot GET /nada'), 'RECURSO_NO_ENCONTRADO', 404],
    [new PayloadTooLargeException(), 'ARCHIVO_DEMASIADO_GRANDE', 413],
    [
      Object.assign(new Error('Unexpected token'), {
        status: 400,
        type: 'entity.parse.failed',
      }),
      'VALIDACION_FALLIDA',
      400,
    ],
    [
      new Error('duplicate key value violates unique constraint "IDX_…"'),
      'ERROR_INTERNO',
      500,
    ],
    ['cualquier cosa', 'ERROR_INTERNO', 500],
  ])('%o → %s', (excepcion, codigo, estado) => {
    const e = aErrorApi(excepcion);
    expect([e.codigo, e.estado]).toEqual([codigo, estado]);
    expect(e.message).not.toMatch(/Cannot GET|Unexpected token|IDX_/);
  });
});

describe('AGENTS §4.6 — Una violación de índice único se reconoce en los cuatro motores', () => {
  it.each([
    [{ driverError: { code: '23505' } }, true],
    [{ driverError: { code: 'ER_DUP_ENTRY', errno: 1062 } }, true],
    [{ driverError: { code: 'SQLITE_CONSTRAINT_UNIQUE' } }, true],
    [{ code: 'SQLITE_CONSTRAINT_PRIMARYKEY' }, true],
    [{ driverError: { code: 'SQLITE_BUSY' } }, false],
    [null, false],
  ])('%o → %s', (error, esperado) => {
    expect(esViolacionDeUnicidad(error)).toBe(esperado);
  });
});
