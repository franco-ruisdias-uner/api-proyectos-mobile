import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { Lectura } from '../../../contrato/tipos.js';
import { ArchivosServicio } from '../../comun/archivos/archivos.servicio.js';
import type { SesionActual } from '../../comun/auth/sesion-actual.js';
import {
  ErrorApi,
  esDeadlock,
  esViolacionDeUnicidad,
} from '../../comun/errores/error-api.js';
import { leerInstante } from '../../comun/fechas/fechas.js';
import { nuevoId } from '../../comun/ids/ids.js';
import { Reloj } from '../../comun/reloj/reloj.js';
import { paginar } from '../../comun/respuesta/paginacion.js';
import type { Meta } from '../../comun/respuesta/respuesta.js';
import { RutaEntidad } from '../rutas/ruta.entidad.js';
import { RutaSuministroEntidad } from '../rutas/ruta-suministro.entidad.js';
import { RutasServicio } from '../rutas/rutas.servicio.js';
import { MedidorEntidad } from '../suministros/medidor.entidad.js';
import { SuministroEntidad } from '../suministros/suministro.entidad.js';
import type {
  CargarLecturaDto,
  ListarLecturasDto,
} from './dto/lecturas.dto.js';
import { LecturaEntidad } from './lectura.entidad.js';
import { aContrato } from './lecturas.mapeador.js';
import {
  calcularConsumo,
  evaluarRango,
  valorPosible,
} from './reglas/lecturas.js';
import { lecturasVigentesDeRuta } from './vigentes.js';

/** Tolerancia por relojes desfasados (AGENTS §10.5). */
const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000;

/** Los instantes se guardan al segundo: así lo que se responde es lo que quedó en la base. */
function alSegundo(instante: Date): Date {
  return new Date(Math.floor(instante.getTime() / 1000) * 1000);
}

@Injectable()
export class LecturasServicio {
  constructor(
    @InjectRepository(LecturaEntidad)
    private readonly lecturas: Repository<LecturaEntidad>,
    @InjectRepository(RutaSuministroEntidad)
    private readonly posiciones: Repository<RutaSuministroEntidad>,
    @InjectRepository(SuministroEntidad)
    private readonly suministros: Repository<SuministroEntidad>,
    @InjectRepository(MedidorEntidad)
    private readonly medidores: Repository<MedidorEntidad>,
    private readonly rutas: RutasServicio,
    private readonly dataSource: DataSource,
    private readonly reloj: Reloj,
    private readonly archivos: ArchivosServicio,
  ) {}

  private url = (clave: string) => this.archivos.url(clave);

  /** Los ids distinguen mayúsculas; MySQL y MariaDB no al comparar: se confirma acá. */
  private async buscarPorId(id: string): Promise<LecturaEntidad | null> {
    const l = await this.lecturas.findOneBy({ id });
    return l?.id === id ? l : null;
  }

  /** R15: el mismo id del mismo lector es un reintento; de otro lector, `ID_EN_USO`. */
  private reintento(existente: LecturaEntidad, sesion: SesionActual): Lectura {
    if (existente.lectorId !== sesion.usuarioId)
      throw new ErrorApi('ID_EN_USO');
    return aContrato(existente, this.url);
  }

  async cargar(
    dto: CargarLecturaDto,
    sesion: SesionActual,
  ): Promise<{ lectura: Lectura; creada: boolean }> {
    if (dto.id !== undefined) {
      const existente = await this.buscarPorId(dto.id);
      if (existente)
        return { lectura: this.reintento(existente, sesion), creada: false };
    }
    // R12, en este orden.
    const ruta = await this.rutas.buscarDelLector(dto.rutaId, sesion);
    if (ruta.estado === 'cerrada') this.rutas.errorDeRutaCerrada(ruta);
    const enRuta = await this.posiciones.findOneBy({
      rutaId: ruta.id,
      suministroId: dto.suministroId,
    });
    if (enRuta?.suministroId !== dto.suministroId)
      throw new ErrorApi('SUMINISTRO_FUERA_DE_RUTA');
    const suministro = await this.suministros.findOneByOrFail({
      id: dto.suministroId,
    });
    const medidor = await this.medidores.findOneByOrFail({
      id: suministro.medidorId,
    });
    if (!valorPosible(dto.valor, medidor.digitos))
      throw new ErrorApi('LECTURA_INVALIDA');
    if (typeof dto.fotoUri !== 'string' || dto.fotoUri.trim() === '')
      throw new ErrorApi('FOTO_REQUERIDA');
    const fotoClave = await this.archivos.claveDeArchivoSubido(
      dto.fotoUri.trim(),
    );
    // Una foto es una imagen: un audio o un video subidos no valen.
    if (!fotoClave.startsWith('imagenes/'))
      throw new ErrorApi('FOTO_REQUERIDA');
    const fechaHora = leerInstante(dto.fechaHora);
    if (fechaHora === null)
      throw new ErrorApi(
        'VALIDACION_FALLIDA',
        'La fecha y hora de la lectura no es válida.',
      );
    if (
      fechaHora.getTime() >
      this.reloj.ahora().getTime() + TOLERANCIA_FUTURO_MS
    )
      throw new ErrorApi(
        'VALIDACION_FALLIDA',
        'La fecha y hora de la lectura todavía no llegó.',
      );

    const consumo = calcularConsumo(
      dto.valor,
      suministro.lecturaAnterior,
      medidor.multiplicador,
    );
    const id = dto.id ?? nuevoId('lec');
    const fila: LecturaEntidad = {
      id,
      rutaId: ruta.id,
      suministroId: suministro.id,
      lectorId: sesion.usuarioId,
      valor: dto.valor,
      consumo,
      fotoClave,
      latitud: dto.coordenadas?.latitud ?? null,
      longitud: dto.coordenadas?.longitud ?? null,
      fueraDeRango: evaluarRango(consumo, suministro.consumoPromedio),
      confirmadaPorLector: dto.confirmadaPorLector ?? false,
      fechaHora: alSegundo(fechaHora),
      recibidaEn: alSegundo(this.reloj.ahora()),
    };
    try {
      await this.guardar(fila);
    } catch (error) {
      if (!esViolacionDeUnicidad(error) && !esDeadlock(error)) throw error;
      // Dos pedidos iguales a la vez: el índice único decidió. El que perdió es un reintento.
      const existente = await this.buscarPorId(id);
      if (!existente) throw error;
      return { lectura: this.reintento(existente, sesion), creada: false };
    }
    return { lectura: aContrato(fila, this.url), creada: true };
  }

  private async guardar(fila: LecturaEntidad): Promise<void> {
    for (let intento = 1; ; intento++) {
      try {
        await this.dataSource.transaction(async (m) => {
          await m.getRepository(LecturaEntidad).insert(fila);
          // Con el lector en la calle, la ruta deja de estar sólo asignada.
          await m
            .getRepository(RutaEntidad)
            .update(
              { id: fila.rutaId, estado: 'asignada' },
              { estado: 'en_curso' },
            );
        });
        return;
      } catch (error) {
        if (!esDeadlock(error) || intento >= 4) throw error;
        if ((await this.buscarPorId(fila.id)) !== null) throw error;
      }
    }
  }

  async obtener(id: string, sesion: SesionActual): Promise<Lectura> {
    const lectura = await this.buscarPorId(id);
    if (!lectura) throw new ErrorApi('LECTURA_NO_ENCONTRADA');
    await this.rutas.buscarAccesible(lectura.rutaId, sesion);
    return aContrato(lectura, this.url);
  }

  /** R13: las vigentes de la ruta, en el orden del recorrido (R4). */
  async listarDeRuta(
    rutaId: string,
    sesion: SesionActual,
    filtros: ListarLecturasDto,
  ): Promise<{ datos: Lectura[]; meta: Meta }> {
    await this.rutas.buscarAccesible(rutaId, sesion);
    const vigentes = await lecturasVigentesDeRuta(this.lecturas, rutaId);
    const posiciones = await this.posiciones.find({
      where: { rutaId },
      order: { posicion: 'ASC' },
    });
    const ordenadas = posiciones
      .flatMap((p) => {
        const l = vigentes.get(p.suministroId);
        return l ? [l] : [];
      })
      .filter(
        (l) =>
          filtros.fueraDeRango === undefined ||
          l.fueraDeRango === filtros.fueraDeRango,
      );
    const pagina = paginar(ordenadas, filtros);
    return {
      datos: pagina.datos.map((l) => aContrato(l, this.url)),
      meta: pagina.meta,
    };
  }
}
