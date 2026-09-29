import { ValidationError } from 'class-validator';
import { mensajeDeValidacion } from './mensajes.js';

const error = (
  property: string,
  constraints: Record<string, string>,
  extra: Partial<ValidationError> = {},
): ValidationError =>
  Object.assign(new ValidationError(), { property, constraints, ...extra });

describe('AGENTS §7.3 — El error de validación nombra el primer campo, en castellano', () => {
  it('campo que falta', () => {
    expect(
      mensajeDeValidacion([error('email', { isNotEmpty: 'x', isEmail: 'x' })]),
    ).toBe('Falta el email.');
  });

  it('campo con formato incorrecto', () => {
    expect(
      mensajeDeValidacion([
        error('email', { isEmail: 'x' }, { value: 'hola' }),
      ]),
    ).toBe('Revisá el email: no tiene el formato correcto.');
  });

  it('campo que no se esperaba', () => {
    expect(
      mensajeDeValidacion([
        error('rol', { whitelistValidation: 'x' }, { value: 'operador' }),
      ]),
    ).toBe('No se puede mandar «rol» en este pedido.');
  });

  it('usa el mensaje propio del DTO si lo tiene', () => {
    expect(
      mensajeDeValidacion([
        error(
          'contrasena',
          { minLength: 'x' },
          {
            value: 'abc',
            contexts: {
              minLength: {
                mensaje: 'La contraseña tiene que tener al menos 8 caracteres.',
              },
            },
          },
        ),
      ]),
    ).toBe('La contraseña tiene que tener al menos 8 caracteres.');
  });

  it('si el tipo está mal, no usa el mensaje de otra regla (un número no es "demasiado largo")', () => {
    expect(
      mensajeDeValidacion([
        error(
          'telefono',
          { isString: 'x', maxLength: 'y' },
          {
            value: 5,
            contexts: {
              maxLength: { mensaje: 'El teléfono es demasiado largo.' },
            },
          },
        ),
      ]),
    ).toBe('Revisá el teléfono: no tiene el formato correcto.');
  });

  it('entra en los objetos anidados y nombra el campo de adentro', () => {
    expect(
      mensajeDeValidacion([
        error(
          'coordenadas',
          {},
          {
            value: {},
            children: [
              error('latitud', { isNumber: 'x' }, { value: undefined }),
            ],
          },
        ),
      ]),
    ).toBe('Falta la latitud.');
  });

  it('un campo sin etiqueta conocida se nombra tal cual, sin inglés', () => {
    expect(
      mensajeDeValidacion([error('cosaRara', { isInt: 'x' }, { value: 'a' })]),
    ).toBe('Revisá «cosaRara»: no tiene el formato correcto.');
  });
});
