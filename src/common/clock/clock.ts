// El único lugar del código donde se lee la hora del sistema (AGENTS §6).
// Todo lo que depende de "ahora" recibe un Reloj inyectado.

/** Token de inyección y contrato del reloj. */
export abstract class Reloj {
  abstract ahora(): Date;
}

/** Reloj de verdad: la hora de la computadora. */
export class RelojSistema extends Reloj {
  ahora(): Date {
    return new Date();
  }
}

/**
 * Reloj congelado en un instante. Lo usan los tests (se puede mover) y la API cuando
 * RELOJ_FIJO tiene un instante, para demos y para probar casos de borde.
 */
export class RelojFijo extends Reloj {
  private instante: number;

  constructor(inicial: string | Date) {
    super();
    this.instante = RelojFijo.leer(inicial);
  }

  ahora(): Date {
    return new Date(this.instante);
  }

  /** Mueve el reloj a otro instante. */
  fijar(instante: string | Date): void {
    this.instante = RelojFijo.leer(instante);
  }

  /** Adelanta (o atrasa, con negativos) la cantidad de minutos indicada. */
  avanzarMinutos(minutos: number): void {
    this.instante += minutos * 60_000;
  }

  private static leer(valor: string | Date): number {
    const ms = typeof valor === 'string' ? Date.parse(valor) : valor.getTime();
    if (Number.isNaN(ms))
      throw new Error(`Instante inválido para el reloj: ${String(valor)}`);
    return ms;
  }
}
