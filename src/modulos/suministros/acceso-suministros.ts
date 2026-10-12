/**
 * Qué suministros puede ver un lector: los que están en una de sus rutas (R3). Las rutas
 * llegan en M2; hasta entonces ningún lector tiene rutas y esta implementación dice que no.
 * M2 la reemplaza por una que mira las rutas `asignada` y `en_curso` del lector.
 */
export abstract class AccesoSuministros {
  abstract puedeVer(usuarioId: string, suministroId: string): Promise<boolean>;
}

export class AccesoSinRutas extends AccesoSuministros {
  async puedeVer(): Promise<boolean> {
    return false;
  }
}
