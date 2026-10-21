import { Reloj } from './clock.js';

/**
 * Reloj congelado: en los tests y, con RELOJ_FIJO, en las demos. Se puede mover a mano.
 */
export class RelojFijo extends Reloj {
  private instante: Date;

  constructor(inicial: Date) {
    super();
    this.instante = new Date(inicial.getTime());
  }

  ahora(): Date {
    return new Date(this.instante.getTime());
  }

  /** Lo pone en un instante (Date o ISO con offset). */
  mover(a: Date | string): void {
    this.instante = new Date(
      typeof a === 'string' ? Date.parse(a) : a.getTime(),
    );
  }

  avanzar(milisegundos: number): void {
    this.instante = new Date(this.instante.getTime() + milisegundos);
  }
}
