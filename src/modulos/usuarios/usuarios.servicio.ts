import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { esIdDe } from '../../comun/ids/ids.js';
import { LineaEntidad } from '../red/linea.entidad.js';
import { ParadaEntidad } from '../red/parada.entidad.js';
import type { ActualizarYoDto } from './dto/actualizar-yo.dto.js';
import { siguienteOrden } from './reglas/orden-favoritos.js';
import type { Sesion } from '../../../contrato/api.js';
import type { Usuario } from '../../../contrato/tipos.js';
import { hashearContrasena, verificarContrasena } from '../../comun/auth/contrasenas.js';
import { ROL_COMUN } from '../../comun/auth/roles.js';
import { Sesiones } from '../../comun/auth/sesiones.js';
import { esViolacionDeUnicidad } from '../../comun/db/unicidad.js';
import { ErrorDeApi } from '../../comun/errores/error-de-api.js';
import { nuevoId } from '../../comun/ids/ids.js';
import { Reloj } from '../../comun/reloj/reloj.js';
import type { IngresoDto } from './dto/ingreso.dto.js';
import type { RegistroDto } from './dto/registro.dto.js';
import { LineaFavoritaEntidad, ParadaFavoritaEntidad } from './favorita.entidad.js';
import { UsuarioEntidad } from './usuario.entidad.js';
import { aContrato } from './usuarios.mapeador.js';

export const normalizarEmail = (email: string) => email.trim().toLowerCase();

/** Un hash válido para comparar cuando el email no existe: así tarda lo mismo. */
const HASH_DE_RELLENO = hashearContrasena('relleno-para-igualar-tiempos');

@Injectable()
export class UsuariosServicio {
  constructor(
    @InjectRepository(UsuarioEntidad) private readonly usuarios: Repository<UsuarioEntidad>,
    @InjectRepository(LineaFavoritaEntidad)
    private readonly lineasFavoritas: Repository<LineaFavoritaEntidad>,
    @InjectRepository(ParadaFavoritaEntidad)
    private readonly paradasFavoritas: Repository<ParadaFavoritaEntidad>,
    @InjectRepository(LineaEntidad) private readonly lineas: Repository<LineaEntidad>,
    @InjectRepository(ParadaEntidad) private readonly paradas: Repository<ParadaEntidad>,
    private readonly sesiones: Sesiones,
    private readonly reloj: Reloj,
  ) {}

  /** Registro público: siempre crea un pasajero (AGENTS §7.1). */
  async registrar(dto: RegistroDto): Promise<Sesion> {
    const email = normalizarEmail(dto.email);
    if (await this.usuarios.existsBy({ email })) throw new ErrorDeApi('EMAIL_YA_REGISTRADO');
    const usuario = this.usuarios.create({
      id: nuevoId('usr'),
      nombre: dto.nombre,
      email,
      contrasenaHash: await hashearContrasena(dto.contrasena),
      rol: ROL_COMUN,
      avisosActivos: true,
      tema: 'sistema',
      creadoEn: this.reloj.ahora(),
    });
    try {
      await this.usuarios.insert(usuario);
    } catch (error) {
      // Dos registros simultáneos con el mismo email: el índice único decide.
      if (esViolacionDeUnicidad(error)) throw new ErrorDeApi('EMAIL_YA_REGISTRADO');
      throw error;
    }
    return this.sesionDe(usuario);
  }

  /** Mismo error exista o no el email (AGENTS §7.1). */
  async ingresar(dto: IngresoDto): Promise<Sesion> {
    const usuario = await this.usuarios.findOneBy({ email: normalizarEmail(dto.email) });
    const correcta = await verificarContrasena(
      dto.contrasena,
      usuario?.contrasenaHash ?? (await HASH_DE_RELLENO),
    );
    if (!usuario || !correcta) throw new ErrorDeApi('CREDENCIALES_INVALIDAS');
    return this.sesionDe(usuario);
  }

  /** El Usuario del PRD. Si la cuenta ya no existe, la sesión no sirve. */
  async obtener(id: string): Promise<Usuario> {
    const usuario = await this.usuarios.findOneBy({ id });
    if (!usuario) throw new ErrorDeApi('NO_AUTENTICADO');
    return this.aContrato(usuario);
  }

  /** `PATCH /yo`: sólo nombre, avisos y tema. Lo que no viene no se toca. */
  async actualizar(id: string, cambios: ActualizarYoDto): Promise<Usuario> {
    const datos: Partial<UsuarioEntidad> = {};
    if (cambios.nombre !== undefined) datos.nombre = cambios.nombre;
    if (cambios.avisosActivos !== undefined) datos.avisosActivos = cambios.avisosActivos;
    if (cambios.tema !== undefined) datos.tema = cambios.tema;
    if (Object.keys(datos).length > 0) await this.usuarios.update({ id }, datos);
    return this.obtener(id);
  }

  /** Idempotente: si ya era favorita no cambia nada ni su lugar en el orden (R16). */
  async agregarLineaFavorita(usuarioId: string, lineaId: string): Promise<Usuario> {
    // Se compara el id devuelto: MySQL y MariaDB no distinguen mayúsculas al buscar.
    const linea = esIdDe('lin', lineaId) ? await this.lineas.findOneBy({ id: lineaId }) : null;
    if (!linea || linea.id !== lineaId) throw new ErrorDeApi('LINEA_NO_ENCONTRADA');
    const actuales = await this.lineasFavoritas.findBy({ usuarioId });
    if (!actuales.some((f) => f.lineaId === lineaId)) {
      const orden = siguienteOrden(actuales.map((f) => f.orden));
      await this.insertarIgnorandoRepetido(() =>
        this.lineasFavoritas.insert({ usuarioId, lineaId, orden }),
      );
    }
    return this.obtener(usuarioId);
  }

  async quitarLineaFavorita(usuarioId: string, lineaId: string): Promise<void> {
    await this.lineasFavoritas.delete({ usuarioId, lineaId });
  }

  async agregarParadaFavorita(usuarioId: string, paradaId: string): Promise<Usuario> {
    const parada = esIdDe('par', paradaId) ? await this.paradas.findOneBy({ id: paradaId }) : null;
    if (!parada || parada.id !== paradaId) throw new ErrorDeApi('PARADA_NO_ENCONTRADA');
    const actuales = await this.paradasFavoritas.findBy({ usuarioId });
    if (!actuales.some((f) => f.paradaId === paradaId)) {
      const orden = siguienteOrden(actuales.map((f) => f.orden));
      await this.insertarIgnorandoRepetido(() =>
        this.paradasFavoritas.insert({ usuarioId, paradaId, orden }),
      );
    }
    return this.obtener(usuarioId);
  }

  async quitarParadaFavorita(usuarioId: string, paradaId: string): Promise<void> {
    await this.paradasFavoritas.delete({ usuarioId, paradaId });
  }

  /** Dos altas simultáneas: la clave primaria decide y la perdedora ya es "agregado". */
  private async insertarIgnorandoRepetido(insertar: () => Promise<unknown>): Promise<void> {
    try {
      await insertar();
    } catch (error) {
      if (!esViolacionDeUnicidad(error)) throw error;
    }
  }

  private async sesionDe(usuario: UsuarioEntidad): Promise<Sesion> {
    return {
      token: await this.sesiones.firmar({ id: usuario.id, rol: usuario.rol }),
      usuario: await this.aContrato(usuario),
    };
  }

  private async aContrato(usuario: UsuarioEntidad): Promise<Usuario> {
    const [lineas, paradas] = await Promise.all([
      this.lineasFavoritas.find({
        where: { usuarioId: usuario.id },
        order: { orden: 'ASC', lineaId: 'ASC' },
      }),
      this.paradasFavoritas.find({
        where: { usuarioId: usuario.id },
        order: { orden: 'ASC', paradaId: 'ASC' },
      }),
    ]);
    return aContrato(usuario, {
      lineas: lineas.map((f) => f.lineaId),
      paradas: paradas.map((f) => f.paradaId),
    });
  }
}
