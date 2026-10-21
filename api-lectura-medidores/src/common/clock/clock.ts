// El único lugar de la API que puede preguntar la hora de la máquina.

export abstract class Reloj {
  abstract ahora(): Date;
}

export class RelojSistema extends Reloj {
  ahora(): Date {
    return new Date();
  }
}

/** Reloj congelado: para tests y para demos (`FIXED_CLOCK`). Se puede mover. */
export class RelojFijo extends Reloj {
  private instante: Date;

  constructor(inicial: Date | string) {
    super();
    this.instante = new Date(inicial);
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
