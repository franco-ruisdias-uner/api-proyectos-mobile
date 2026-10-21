/**
 * Exclusión mutua por clave, dentro del proceso: las operaciones sobre la misma clave corren de a
 * una, en orden de llegada. Sirve para las ediciones que borran y vuelven a insertar filas hijas
 * (dos a la vez chocan por clave primaria o por deadlock según el motor). La API corre en un solo
 * proceso; con varias instancias habría que pasar esto a un bloqueo de la base.
 */
export class ExclusionPorClave {
  private readonly colas = new Map<string, Promise<unknown>>();

  async ejecutar<T>(clave: string, operacion: () => Promise<T>): Promise<T> {
    const anterior = this.colas.get(clave) ?? Promise.resolve();
    const actual = anterior.then(operacion, operacion);
    const cola = actual.catch(() => undefined);
    this.colas.set(clave, cola);
    try {
      return await actual;
    } finally {
      if (this.colas.get(clave) === cola) this.colas.delete(clave);
    }
  }
}
