import { Injectable } from '@nestjs/common';

/**
 * Único lugar del código que puede preguntar la hora del sistema (AGENTS §6).
 * Todo lo que depende de "ahora" recibe un Reloj inyectado.
 */
export abstract class Reloj {
  abstract ahora(): Date;
}

@Injectable()
export class RelojSistema extends Reloj {
  ahora(): Date {
    return new Date();
  }
}

/** Reloj detenido: lo usan los tests y la API cuando RELOJ_FIJO está definido. */
export class RelojFijo extends Reloj {
  private instante: number;

  constructor(inicial: string | Date) {
    super();
    this.instante = new Date(inicial).getTime();
  }

  ahora(): Date {
    return new Date(this.instante);
  }

  fijar(instante: string | Date): void {
    this.instante = new Date(instante).getTime();
  }

  avanzar(milisegundos: number): void {
    this.instante += milisegundos;
  }
}
