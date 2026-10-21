import { Inject, Logger, Module, type OnApplicationBootstrap } from '@nestjs/common';
import { ENTORNO } from '../config/environment.module.js';
import type { Entorno } from '../config/environment.js';
import { CategoriasModulo } from '../modules/categories/categories.module.js';
import { EventosModulo } from '../modules/events/events.module.js';
import { EventosGuardadosModulo } from '../modules/saved-events/saved-events.module.js';
import { FavoritosModulo } from '../modules/favorites/favorites.module.js';
import { LugaresModulo } from '../modules/places/places.module.js';
import { VisitasModulo } from '../modules/visits/visits.module.js';
import { Sembrador } from './seed.js';

@Module({
  imports: [
    CategoriasModulo,
    LugaresModulo,
    EventosModulo,
    EventosGuardadosModulo,
    FavoritosModulo,
    VisitasModulo,
  ],
  providers: [Sembrador],
  exports: [Sembrador],
})
export class SemillasModulo implements OnApplicationBootstrap {
  constructor(
    @Inject(ENTORNO) private readonly entorno: Entorno,
    private readonly sembrador: Sembrador,
  ) {}

  /** `SEMBRAR_SI_VACIA=true` (Docker): si la base no tiene datos, siembra; si tiene, no toca nada. */
  async onApplicationBootstrap(): Promise<void> {
    if (!this.entorno.SEMBRAR_SI_VACIA) return;
    if (await this.sembrador.estaVacia()) {
      new Logger('Semillas').log('La base está vacía: cargo los datos de demo.');
      await this.sembrador.sembrar();
    }
  }
}
