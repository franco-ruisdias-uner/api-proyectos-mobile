import type { ValidationError } from '@nestjs/common';
import { mensajeDeValidacion } from './setup-app.js';

const error = (
  property: string,
  constraints?: Record<string, string>,
  children: ValidationError[] = [],
): ValidationError => ({
  property,
  constraints,
  children,
});

describe('AGENTS §7.3 — VALIDACION_FALLIDA nombra el primer campo con problemas', () => {
  it('usa el mensaje en castellano del DTO', () => {
    expect(
      mensajeDeValidacion([
        error('telefono', { isString: 'Falta el teléfono.' }),
      ]),
    ).toBe('Falta el teléfono.');
  });

  it('un campo de más se nombra', () => {
    expect(
      mensajeDeValidacion([
        error('rol', { whitelistValidation: 'property rol should not exist' }),
      ]),
    ).toBe('Sobra el dato «rol»: la API no lo usa.');
  });

  it('busca en los objetos anidados', () => {
    expect(
      mensajeDeValidacion([
        error('coordenadas', undefined, [
          error('latitud', { isNumber: 'La latitud no es válida.' }),
        ]),
      ]),
    ).toBe('La latitud no es válida.');
  });
});
