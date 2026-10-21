import { ValidatorConstraint, type ValidatorConstraintInterface } from 'class-validator';
import { esInstanteConZona } from '../dates/dates.js';

/** Instante ISO 8601 con offset o `Z` (AGENTS §4.3: en la entrada se acepta cualquiera). */
@ValidatorConstraint({ name: 'esInstanteConZona' })
export class EsInstanteConZona implements ValidatorConstraintInterface {
  validate(valor: unknown): boolean {
    return typeof valor === 'string' && esInstanteConZona(valor);
  }
}
