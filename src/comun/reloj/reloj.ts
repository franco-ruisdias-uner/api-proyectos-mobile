/**
 * La única fuente de "ahora" de la API (AGENTS §6). Todo lo que depende de la hora recibe un
 * Reloj inyectado; `new Date()` sin argumentos y `Date.now()` sólo aparecen en este archivo.
 */
export abstract class Reloj {
  abstract ahora(): Date;
}

export class RelojSistema extends Reloj {
  ahora(): Date {
    return new Date();
  }
}

/** Reloj quieto en un instante. Se usa en tests y con RELOJ_FIJO para demos. */
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
