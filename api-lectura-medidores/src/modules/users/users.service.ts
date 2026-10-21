import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type FindOptionsWhere, In, Like, Repository } from 'typeorm';
import type { EstadoRuta, Usuario } from '../../../contract/types.js';
import {
  contrasenaCoincide,
  hashearContrasena,
} from '../../common/auth/passwords.js';
import {
  ErrorApi,
  esViolacionDeUnicidad,
} from '../../common/errors/error-api.js';
import { nuevoId } from '../../common/ids/ids.js';
import { paginar } from '../../common/response/pagination.js';
import type { Meta } from '../../common/response/response.js';
import { Reloj } from '../../common/clock/clock.js';
import { normalizarParaBusqueda } from '../../common/text/text.js';
import type {
  ActualizarUsuarioDto,
  ActualizarYoDto,
  CrearUsuarioDto,
  ListarUsuariosDto,
} from './dto/users.dto.js';
import { RutaEntidad } from '../routes/route.entity.js';
import { compararPorLegajo, normalizarLegajo } from './rules/employee-id.js';
import { UsuarioEntidad } from './user.entity.js';
import { aContrato } from './users.mapper.js';

@Injectable()
export class UsuariosServicio {
  constructor(
    @InjectRepository(UsuarioEntidad)
    private readonly repositorio: Repository<UsuarioEntidad>,
    @InjectRepository(RutaEntidad)
    private readonly rutas: Repository<RutaEntidad>,
    private readonly reloj: Reloj,
  ) {}

  /**
   * `Usuario.rutasAsignadas`: ids de las rutas `asignada` o `en_curso` de cada lector, por
   * número de ruta. Se calcula, no se guarda. Para administración es `[]`.
   */
  private async rutasAsignadas(
    usuarioIds: string[],
  ): Promise<Map<string, string[]>> {
    const abiertas: EstadoRuta[] = ['asignada', 'en_curso'];
    const mapa = new Map<string, string[]>(usuarioIds.map((id) => [id, []]));
    if (usuarioIds.length === 0) return mapa;
    const rutas = await this.rutas.find({
      where: { lectorId: In(usuarioIds), estado: In(abiertas) },
      order: { numero: 'ASC', bimestre: 'DESC', id: 'ASC' },
    });
    for (const r of rutas) mapa.get(r.lectorId)?.push(r.id);
    return mapa;
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
}
