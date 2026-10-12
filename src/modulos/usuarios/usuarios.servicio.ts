import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type FindOptionsWhere, Like, Repository } from 'typeorm';
import type { Usuario } from '../../../contrato/tipos.js';
import {
  contrasenaCoincide,
  hashearContrasena,
} from '../../comun/auth/contrasenas.js';
import {
  ErrorApi,
  esViolacionDeUnicidad,
} from '../../comun/errores/error-api.js';
import { nuevoId } from '../../comun/ids/ids.js';
import { paginar } from '../../comun/respuesta/paginacion.js';
import type { Meta } from '../../comun/respuesta/respuesta.js';
import { Reloj } from '../../comun/reloj/reloj.js';
import { normalizarParaBusqueda } from '../../comun/texto/normalizar.js';
import type {
  ActualizarUsuarioDto,
  ActualizarYoDto,
  CrearUsuarioDto,
  ListarUsuariosDto,
} from './dto/usuarios.dto.js';
import { compararPorLegajo, normalizarLegajo } from './reglas/legajo.js';
import { UsuarioEntidad } from './usuario.entidad.js';
import { aContrato } from './usuarios.mapeador.js';

@Injectable()
export class UsuariosServicio {
  constructor(
    @InjectRepository(UsuarioEntidad)
    private readonly repositorio: Repository<UsuarioEntidad>,
    private readonly reloj: Reloj,
  ) {}

  /**
   * `Usuario.rutasAsignadas`: ids de las rutas `asignada` o `en_curso` del lector, por
   * número. Las rutas llegan en M2; hasta entonces ningún usuario tiene rutas.
   */
  private async rutasAsignadas(
    usuarioIds: string[],
  ): Promise<Map<string, string[]>> {
    return new Map(usuarioIds.map((id) => [id, []]));
  }

  private async aContratos(usuarios: UsuarioEntidad[]): Promise<Usuario[]> {
    const rutas = await this.rutasAsignadas(usuarios.map((u) => u.id));
    return usuarios.map((u) => aContrato(u, rutas.get(u.id) ?? []));
  }

  async contratoDe(usuario: UsuarioEntidad): Promise<Usuario> {
    const [contrato] = await this.aContratos([usuario]);
    return contrato;
  }

  async buscar(id: string): Promise<UsuarioEntidad> {
    const usuario = await this.repositorio.findOneBy({ id });
    if (!usuario) throw new ErrorApi('USUARIO_NO_ENCONTRADO');
    return usuario;
  }

  async buscarPorLegajo(legajo: string): Promise<UsuarioEntidad | null> {
    return this.repositorio.findOneBy({
      legajoBusqueda: normalizarLegajo(legajo),
    });
  }

  async listar(
    filtros: ListarUsuariosDto,
  ): Promise<{ datos: Usuario[]; meta: Meta }> {
    const base: FindOptionsWhere<UsuarioEntidad> = {};
    if (filtros.rol !== undefined) base.rol = filtros.rol;
    let where: FindOptionsWhere<UsuarioEntidad>[] = [base];
    const termino =
      filtros.buscar === undefined
        ? ''
        : normalizarParaBusqueda(filtros.buscar);
    if (termino !== '') {
      where = [
        { ...base, legajoBusqueda: Like(`%${termino}%`) },
        { ...base, nombreBusqueda: Like(`%${termino}%`) },
      ];
    }
    // Los usuarios de una cooperativa son pocos: se ordenan en TypeScript para que el
    // orden sea idéntico en los cuatro motores (cada uno ordena texto a su manera).
    // `%` y `_` del término son comodines para LIKE: la base filtra de más y acá se deja
    // sólo lo que contiene el texto tal cual.
    const encontrados = (await this.repositorio.findBy(where)).filter(
      (u) =>
        termino === '' ||
        u.legajoBusqueda.includes(termino) ||
        u.nombreBusqueda.includes(termino),
    );
    encontrados.sort(compararPorLegajo);
    const pagina = paginar(encontrados, filtros);
    return { datos: await this.aContratos(pagina.datos), meta: pagina.meta };
  }

  async crear(dto: CrearUsuarioDto): Promise<UsuarioEntidad> {
    const legajoBusqueda = normalizarLegajo(dto.legajo);
    if (await this.repositorio.existsBy({ legajoBusqueda })) {
      throw new ErrorApi('LEGAJO_YA_REGISTRADO');
    }
    const usuario = this.repositorio.create({
      id: nuevoId('usr'),
      legajo: dto.legajo,
      legajoBusqueda,
      nombre: dto.nombre,
      nombreBusqueda: normalizarParaBusqueda(dto.nombre),
      rol: dto.rol,
      biometriaActiva: false,
      hashContrasena: await hashearContrasena(dto.contrasena),
      versionSesion: 0,
      creadoEn: this.reloj.ahora(),
    });
    try {
      return await this.repositorio.save(usuario);
    } catch (error) {
      // Dos altas simultáneas con el mismo legajo: el índice único decide.
      if (esViolacionDeUnicidad(error))
        throw new ErrorApi('LEGAJO_YA_REGISTRADO');
      throw error;
    }
  }

  async actualizar(
    id: string,
    dto: ActualizarUsuarioDto,
  ): Promise<UsuarioEntidad> {
    const usuario = await this.buscar(id);
    if (dto.nombre !== undefined) {
      usuario.nombre = dto.nombre;
      usuario.nombreBusqueda = normalizarParaBusqueda(dto.nombre);
    }
    if (dto.contrasena !== undefined) {
      usuario.hashContrasena = await hashearContrasena(dto.contrasena);
      usuario.versionSesion += 1; // blanqueo: cierra todas sus sesiones (R2)
    }
    return this.repositorio.save(usuario);
  }

  async actualizarPropio(
    id: string,
    dto: ActualizarYoDto,
  ): Promise<UsuarioEntidad> {
    const usuario = await this.buscar(id);
    if (dto.contrasenaNueva !== undefined) {
      const coincide = await contrasenaCoincide(
        dto.contrasenaActual ?? '',
        usuario.hashContrasena,
      );
      if (!coincide)
        throw new ErrorApi(
          'CREDENCIALES_INVALIDAS',
          'La contraseña actual no es correcta.',
        );
      usuario.hashContrasena = await hashearContrasena(dto.contrasenaNueva);
    }
    if (dto.biometriaActiva !== undefined)
      usuario.biometriaActiva = dto.biometriaActiva;
    return this.repositorio.save(usuario);
  }

  async cerrarSesiones(id: string): Promise<void> {
    await this.repositorio.increment({ id }, 'versionSesion', 1);
  }
}
