import { BadRequestException, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { aErrorApi } from './filtro-excepciones.js';
import { ErrorApi } from './error-api.js';
import { CATALOGO } from './catalogo.js';

describe('AGENTS §4.6 — Todo error sale con un código del catálogo', () => {
  it.each([
    [new ErrorApi('EMAIL_YA_REGISTRADO'), 'EMAIL_YA_REGISTRADO', 409],
    [new NotFoundException(), 'RUTA_NO_ENCONTRADA', 404],
    [new BadRequestException('Unexpected token'), 'VALIDACION_FALLIDA', 400],
    [new PayloadTooLargeException(), 'ARCHIVO_DEMASIADO_GRANDE', 413],
    [new QueryFailedError('SELECT', [], new Error('no such table: x')), 'ERROR_INTERNO', 500],
    [new Error('se rompió algo'), 'ERROR_INTERNO', 500],
    ['un string tirado', 'ERROR_INTERNO', 500],
    [null, 'ERROR_INTERNO', 500],
  ])('%s → %s', (excepcion, codigo, estado) => {
    const e = aErrorApi(excepcion);
    expect(e.codigo).toBe(codigo);
    expect(e.estado).toBe(estado);
  });

  it('un error interno no filtra el detalle técnico en el mensaje', () => {
    const e = aErrorApi(new Error('duplicate key value violates unique constraint "IDX_123"'));
    expect(e.message).toBe(CATALOGO.ERROR_INTERNO.mensaje);
  });

  it('los mensajes del catálogo no tienen jerga técnica en inglés', () => {
    for (const { mensaje } of Object.values(CATALOGO)) {
      expect(mensaje).not.toMatch(/\b(error|null|undefined|exception|id|key|field|token)\b/i);
      expect(mensaje).toMatch(/[.!?]$/);
    }
  });

  it('los códigos están en MAYUSCULAS_CON_GUION_BAJO', () => {
    for (const codigo of Object.keys(CATALOGO)) expect(codigo).toMatch(/^[A-Z]+(_[A-Z]+)*$/);
  });
});
