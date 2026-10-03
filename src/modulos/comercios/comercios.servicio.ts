import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, type FindOptionsWhere, type Repository } from 'typeorm';
import type {
  Comercio as ComercioContrato,
  Coordenadas,
  Rubro as RubroContrato,
} from '../../../contrato/tipos.js';
import { hoyEnZona } from '../../comun/fechas/fechas.js';
import { ErrorApi } from '../../comun/errores/error-api.js';
import { cajaAlrededor, distanciaMetros } from '../../comun/geo/geo.js';
import { Reloj } from '../../comun/reloj/reloj.js';
import { normalizarParaBusqueda } from '../../comun/texto/texto.js';
import { Comercio } from './comercio.entidad.js';
import { comercioAContrato, rubroAContrato } from './comercios.mapeador.js';
import type { ListarComerciosDto } from './dto/listar-comercios.dto.js';
import { comercioIdDeQr, esIdDeComercio, ordenarComercios } from './reglas/comercios.js';
import { Rubro } from './rubro.entidad.js';

@Injectable()
export class ComerciosServicio {
  constructor(
    @InjectRepository(Rubro) private readonly rubros: Repository<Rubro>,
    @InjectRepository(Comercio) private readonly comercios: Repository<Comercio>,
    private readonly reloj: Reloj,
  ) {}

  async listarRubros(p: {
    pagina: number;
    porPagina: number;
  }): Promise<{ datos: RubroContrato[]; total: number }> {
    const [filas, total] = await this.rubros.findAndCount({
      order: { orden: 'ASC', id: 'ASC' },
      skip: (p.pagina - 1) * p.porPagina,
      take: p.porPagina,
    });
    return { datos: filas.map(rubroAContrato), total };
  }

  /**
   * Sólo comercios activos. La base filtra por rubro y por caja; la búsqueda de texto, el radio,
   * el orden y la página se resuelven en TypeScript: así dan lo mismo en los cuatro motores
   * (collation, comodines de LIKE) y son un par de cientos de filas.
   */
  async listar(q: ListarComerciosDto): Promise<{ datos: ComercioContrato[]; total: number }> {
    const centro = this.centroDe(q);
    const where: FindOptionsWhere<Comercio> = { activo: true };
    if (q.rubroId) where.rubroId = q.rubroId;
    if (centro && q.radioMetros !== undefined) {
      const caja = cajaAlrededor(centro, q.radioMetros);
      where.latitud = Between(caja.latitudMin, caja.latitudMax);
      where.longitud = Between(caja.longitudMin, caja.longitudMax);
    }
    let filas = await this.comercios.find({ where });

    const termino = normalizarParaBusqueda(q.q ?? '');
    if (termino) {
      filas = filas.filter(
        (c) => c.nombreBusqueda.includes(termino) || c.descripcionBusqueda.includes(termino),
      );
    }
    if (centro && q.radioMetros !== undefined) {
      const radio = q.radioMetros;
      filas = filas.filter(
        (c) => distanciaMetros(centro, { latitud: c.latitud, longitud: c.longitud }) <= radio,
      );
    }

    const ordenadas = ordenarComercios(filas, q.orden ?? 'nombre', centro);
    const desde = (q.pagina - 1) * q.porPagina;
    const hoy = hoyEnZona(this.reloj.ahora());
    return {
      datos: ordenadas.slice(desde, desde + q.porPagina).map((c) => comercioAContrato(c, hoy)),
      total: ordenadas.length,
    };
  }

  /** Detalle: también devuelve los dados de baja, con `activo: false` (D12). */
  async detalle(id: string): Promise<ComercioContrato> {
    const comercio = esIdDeComercio(id) ? await this.comercios.findOneBy({ id }) : null;
    if (!comercio) throw new ErrorApi('COMERCIO_NO_ENCONTRADO');
    return comercioAContrato(comercio, hoyEnZona(this.reloj.ahora()));
  }

  /** R16: `CCU:<comercioId>`; cualquier otra cosa es 404, nunca 500. */
  async porQr(codigo: string): Promise<ComercioContrato> {
    const id = comercioIdDeQr(codigo);
    const comercio = id ? await this.comercios.findOneBy({ id }) : null;
    if (!comercio) throw new ErrorApi('QR_NO_RECONOCIDO');
    return comercioAContrato(comercio, hoyEnZona(this.reloj.ahora()));
  }

  /** La posición va entera o no va; el radio y el orden por distancia la necesitan. */
  private centroDe(q: ListarComerciosDto): Coordenadas | null {
    const { latitud, longitud } = q;
    if ((latitud === undefined) !== (longitud === undefined)) {
      throw new ErrorApi('VALIDACION_FALLIDA', 'Falta la latitud o la longitud de tu posición.');
    }
    if (latitud === undefined || longitud === undefined) {
      if (q.radioMetros !== undefined)
        throw new ErrorApi('VALIDACION_FALLIDA', 'Para buscar por distancia falta tu posición.');
      if (q.orden === 'distancia')
        throw new ErrorApi('VALIDACION_FALLIDA', 'Para ordenar por distancia falta tu posición.');
      return null;
    }
    return { latitud, longitud };
  }
}
