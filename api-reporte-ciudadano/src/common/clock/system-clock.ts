import { Reloj } from './clock.js';

/** La hora de la computadora. Es el único lugar del código que usa new Date() sin argumentos. */
export class RelojSistema extends Reloj {
  ahora(): Date {
    return new Date();
  }
}
