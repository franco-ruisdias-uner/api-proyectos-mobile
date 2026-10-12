/**
 * Qué suministros puede ver un lector: los que están en una de sus rutas (R3). La
 * implementación real es `AccesoPorRutas`; el puerto existe para no atar este módulo al de rutas.
 */
export abstract class AccesoSuministros {
  abstract puedeVer(usuarioId: string, suministroId: string): Promise<boolean>;
}
