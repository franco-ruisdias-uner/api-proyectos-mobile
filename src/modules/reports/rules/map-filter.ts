// Combinaciones válidas de los filtros geográficos del mapa (funciones puras).

export interface FiltroGeografico {
  latitud?: number;
  longitud?: number;
  radioMetros?: number;
  norte?: number;
  sur?: number;
  este?: number;
  oeste?: number;
}

const definido = (v: unknown) => v !== undefined;

/**
 * Los filtros geográficos van completos o no van: centro + radio, o la caja de cuatro lados.
 * Devuelve el mensaje (en castellano) del primer problema, o `null` si está bien.
 */
export function problemaDelFiltroGeografico(
  f: FiltroGeografico,
): string | null {
  const circulo = [f.latitud, f.longitud, f.radioMetros];
  if (circulo.some(definido) && !circulo.every(definido)) {
    return 'Para buscar por cercanía hacen falta la latitud, la longitud y el radio en metros.';
  }
  const caja = [f.norte, f.sur, f.este, f.oeste];
  if (caja.some(definido) && !caja.every(definido)) {
    return 'Para buscar en una zona del mapa hacen falta los cuatro límites: norte, sur, este y oeste.';
  }
  if (definido(f.norte) && f.norte! < f.sur!) {
    return 'El límite norte del mapa tiene que estar más al norte que el sur.';
  }
  if (definido(f.este) && f.este! < f.oeste!) {
    return 'El límite este del mapa tiene que estar más al este que el oeste.';
  }
  return null;
}
