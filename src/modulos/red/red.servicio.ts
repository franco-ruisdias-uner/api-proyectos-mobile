import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, type FindOptionsWhere, In, Like, Repository } from 'typeorm';
import type { Meta } from '../../../contrato/api.js';
import type { Coordenadas, Linea, Parada } from '../../../contrato/tipos.js';
import { ErrorDeApi } from '../../comun/errores/error-de-api.js';
import { cajaAlrededor } from '../../comun/geo/geo.js';
import { esIdDe } from '../../comun/ids/ids.js';
import { paginar } from '../../comun/respuesta/respuesta.js';
import { normalizarParaBusqueda } from '../../comun/texto/texto.js';
import type { ListarParadasDto } from './dto/listar-paradas.dto.js';
import { LineaEntidad } from './linea.entidad.js';
import { ParadaEntidad } from './parada.entidad.js';
import { RecorridoParadaEntidad } from './recorrido-parada.entidad.js';
import { RecorridoEntidad } from './recorrido.entidad.js';
import { lineaAContrato, paradaAContrato } from './red.mapeador.js';
import { compararLineas } from './reglas/numero-de-linea.js';
import { paradaIdDeQr } from './reglas/qr.js';
import { seleccionarParadas } from './reglas/seleccion-de-paradas.js';

interface Pagina<T> {
  datos: T[];
  meta: Meta;
}

@Injectable()
export class RedServicio {
  constructor(
    @InjectRepository(LineaEntidad) private readonly lineas: Repository<LineaEntidad>,
    @InjectRepository(RecorridoEntidad) private readonly recorridos: Repository<RecorridoEntidad>,
    @InjectRepository(RecorridoParadaEntidad)
    private readonly tramos: Repository<RecorridoParadaEntidad>,
    @InjectRepository(ParadaEntidad) private readonly paradas: Repository<ParadaEntidad>,
  ) {}

  async listarLineas(pedido: { pagina?: number; porPagina?: number }): Promise<Pagina<Linea>> {
    const pagina = paginar(pedido);
    const todas = (await this.lineas.find()).sort(compararLineas);
    const deLaPagina = todas.slice(pagina.skip, pagina.skip + pagina.take);
    return {
      datos: await this.armarLineas(deLaPagina),
      meta: { total: todas.length, pagina: pagina.pagina, porPagina: pagina.porPagina },
    };
  }

  async obtenerLinea(id: string): Promise<Linea> {
    // Un id mal formado es "no existe" (DECISIONES A7). Se compara el id devuelto porque
    // MySQL y MariaDB no distinguen mayúsculas al buscar y los otros motores sí.
    const linea = esIdDe('lin', id) ? await this.lineas.findOneBy({ id }) : null;
    if (!linea || linea.id !== id) throw new ErrorDeApi('LINEA_NO_ENCONTRADA');
    return (await this.armarLineas([linea]))[0];
  }

  async listarParadas(filtros: ListarParadasDto): Promise<Pagina<Parada>> {
    const centro = this.centroDe(filtros);
    if (filtros.radioMetros !== undefined && !centro) {
      throw new ErrorDeApi(
        'VALIDACION_FALLIDA',
        'Para buscar por radio (radioMetros) hace falta la latitud y la longitud.',
      );
    }
    if (filtros.orden === 'distancia' && !centro) {
      throw new ErrorDeApi(
        'VALIDACION_FALLIDA',
        'Para ordenar por distancia hace falta la latitud y la longitud.',
      );
    }

    // Sólo los filtros que vinieron: TypeORM 1.x falla con un `where` en undefined.
    const where: FindOptionsWhere<ParadaEntidad> = {};
    if (filtros.sentido) where.sentido = filtros.sentido;
    const termino = normalizarParaBusqueda(filtros.q ?? '');
    // `%` y `_` serían comodines de LIKE: con ellos se busca sólo en memoria, más abajo.
    if (termino && !/[%_\\]/.test(termino)) where.nombreBusqueda = Like(`%${termino}%`);
    if (centro && filtros.radioMetros !== undefined) {
      const caja = cajaAlrededor(centro, filtros.radioMetros);
      where.latitud = Between(caja.latitudMinima, caja.latitudMaxima);
      where.longitud = Between(caja.longitudMinima, caja.longitudMaxima);
    }
    if (filtros.lineaId) {
      const lineaId = filtros.lineaId;
      const deLaLinea = (await this.tramos.findBy({ lineaId })).filter(
        (t) => t.lineaId === lineaId,
      );
      if (deLaLinea.length === 0) return this.paginaVacia(filtros);
      where.id = In([...new Set(deLaLinea.map((t) => t.paradaId))]);
    }

    let candidatas = await this.paradas.findBy(where);
    if (termino) candidatas = candidatas.filter((p) => p.nombreBusqueda.includes(termino));
    const elegidas = seleccionarParadas(candidatas, {
      orden: filtros.orden ?? 'nombre',
      centro,
      radioMetros: filtros.radioMetros,
    });

    const pagina = paginar(filtros);
    const deLaPagina = elegidas.slice(pagina.skip, pagina.skip + pagina.take);
    const lineaIds = await this.lineaIdsDe(deLaPagina.map((p) => p.id));
    return {
      datos: deLaPagina.map((p) => paradaAContrato(p, lineaIds.get(p.id) ?? [])),
      meta: { total: elegidas.length, pagina: pagina.pagina, porPagina: pagina.porPagina },
    };
  }

  async obtenerParada(id: string): Promise<Parada> {
    const parada = esIdDe('par', id) ? await this.paradas.findOneBy({ id }) : null;
    if (!parada || parada.id !== id) throw new ErrorDeApi('PARADA_NO_ENCONTRADA');
    return this.aParada(parada);
  }

  /** R4: `PARANA:<paradaId>`. Cualquier otra cosa es QR_NO_RECONOCIDO, nunca un 500. */
  async paradaPorQr(codigo: string): Promise<Parada> {
    if (!paradaIdDeQr(codigo)) throw new ErrorDeApi('QR_NO_RECONOCIDO');
    const parada = await this.paradas.findOneBy({ codigoQr: codigo });
    if (!parada || parada.codigoQr !== codigo) throw new ErrorDeApi('QR_NO_RECONOCIDO');
    return this.aParada(parada);
  }

  private centroDe(filtros: ListarParadasDto): Coordenadas | undefined {
    const { latitud, longitud } = filtros;
    if (latitud === undefined && longitud === undefined) return undefined;
    if (latitud === undefined) {
      throw new ErrorDeApi(
        'VALIDACION_FALLIDA',
        'Falta la latitud (latitud) junto con la longitud.',
      );
    }
    if (longitud === undefined) {
      throw new ErrorDeApi(
        'VALIDACION_FALLIDA',
        'Falta la longitud (longitud) junto con la latitud.',
      );
    }
    return { latitud, longitud };
  }

  private paginaVacia(filtros: ListarParadasDto): Pagina<Parada> {
    const { pagina, porPagina } = paginar(filtros);
    return { datos: [], meta: { total: 0, pagina, porPagina } };
  }

  private async aParada(parada: ParadaEntidad): Promise<Parada> {
    const lineaIds = await this.lineaIdsDe([parada.id]);
    return paradaAContrato(parada, lineaIds.get(parada.id) ?? []);
  }

  /** R2: las líneas de cada parada salen de los recorridos, ordenadas por número de línea. */
  private async lineaIdsDe(paradaIds: string[]): Promise<Map<string, string[]>> {
    const resultado = new Map<string, string[]>();
    if (paradaIds.length === 0) return resultado;
    const tramos = await this.tramos.findBy({ paradaId: In(paradaIds) });
    const lineas = await this.lineas.findBy({ id: In([...new Set(tramos.map((t) => t.lineaId))]) });
    const orden = new Map(lineas.sort(compararLineas).map((l, i) => [l.id, i]));
    for (const tramo of tramos) {
      const actuales = resultado.get(tramo.paradaId) ?? [];
      if (!actuales.includes(tramo.lineaId)) actuales.push(tramo.lineaId);
      resultado.set(tramo.paradaId, actuales);
    }
    for (const ids of resultado.values())
      ids.sort((a, b) => (orden.get(a) ?? 0) - (orden.get(b) ?? 0));
    return resultado;
  }

  private async armarLineas(lineas: LineaEntidad[]): Promise<Linea[]> {
    if (lineas.length === 0) return [];
    const ids = lineas.map((l) => l.id);
    const [recorridos, tramos] = await Promise.all([
      this.recorridos.findBy({ lineaId: In(ids) }),
      this.tramos.findBy({ lineaId: In(ids) }),
    ]);
    return lineas.map((linea) =>
      lineaAContrato(
        linea,
        recorridos
          .filter((r) => r.lineaId === linea.id)
          .sort((a, b) => (a.sentido < b.sentido ? -1 : a.sentido > b.sentido ? 1 : 0))
          .map((recorrido) => ({
            recorrido,
            paradaIds: tramos
              .filter((t) => t.lineaId === linea.id && t.sentido === recorrido.sentido)
              .sort((a, b) => a.orden - b.orden)
              .map((t) => t.paradaId),
          })),
      ),
    );
  }
}
