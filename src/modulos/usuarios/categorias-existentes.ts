/**
 * Lo que `PATCH /yo` necesita saber de las categorías (R18). Lo implementa el catálogo (M1);
 * mientras no haya catálogo, no existe ninguna categoría.
 */
export abstract class CategoriasExistentes {
  abstract existenTodas(ids: string[]): Promise<boolean>;
}

export class SinCategorias extends CategoriasExistentes {
  existenTodas(ids: string[]): Promise<boolean> {
    return Promise.resolve(ids.length === 0);
  }
}
