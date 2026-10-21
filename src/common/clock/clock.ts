/**
 * La única fuente de "ahora" de la API (AGENTS §6). Todo lo que dependa de la hora lo pide
 * inyectado; en los tests se reemplaza por un `RelojFijo`.
 */
export abstract class Reloj {
  abstract ahora(): Date;
}

export class RelojSistema extends Reloj {
  ahora(): Date {
    return new Date();
  }
}

/** Reloj detenido en un instante. Se puede mover a mano (tests y `RELOJ_FIJO`). */
export class RelojFijo extends Reloj {
  private instante: Date;

  constructor(instante: Date | string) {
    super();
    this.instante = new Date(instante);
  }

  ahora(): Date {
    return new Date(this.instante.getTime());
  }

  fijar(instante: Date | string): void {
    this.instante = new Date(instante);
  }

  avanzar(milisegundos: number): void {
    this.instante = new Date(this.instante.getTime() + milisegundos);
  }
}
