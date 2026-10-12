import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RutaSuministroEntidad } from '../rutas/ruta-suministro.entidad.js';
import { RutaEntidad } from '../rutas/ruta.entidad.js';
import { AccesoSuministros } from './acceso-suministros.js';

/** R3: un lector ve los suministros que están en alguna de sus rutas. */
@Injectable()
export class AccesoPorRutas extends AccesoSuministros {
  constructor(
    @InjectRepository(RutaSuministroEntidad)
    private readonly posiciones: Repository<RutaSuministroEntidad>,
    @InjectRepository(RutaEntidad)
    private readonly rutas: Repository<RutaEntidad>,
  ) {
    super();
  }

  async puedeVer(usuarioId: string, suministroId: string): Promise<boolean> {
    const enRutas = await this.posiciones.findBy({ suministroId });
    const rutaIds = enRutas
      .filter((p) => p.suministroId === suministroId)
      .map((p) => p.rutaId);
    if (rutaIds.length === 0) return false;
    const mias = await this.rutas.findBy({
      id: In(rutaIds),
      lectorId: usuarioId,
    });
    return mias.some((r) => r.lectorId === usuarioId);
  }
}
