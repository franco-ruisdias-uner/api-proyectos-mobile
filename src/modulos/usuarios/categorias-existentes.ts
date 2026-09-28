/**
 * Lo que `PATCH /yo` necesita saber de las categorías (R18). Lo implementa el catálogo
 * (`CategoriasServicio`).
 */
export abstract class CategoriasExistentes {
  abstract existenTodas(ids: string[]): Promise<boolean>;
}
