import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import type { Sesion } from '../../../contract/api.js';
import type { Usuario } from '../../../contract/types.js';
import { hashearContrasena, verificarContrasena } from '../../common/auth/passwords.js';
import type { Rol } from '../../common/auth/decorators.js';
import { UsuariosActivos } from '../../common/auth/active-users.js';
import { VerificadorArchivos } from '../../common/files/file-verifier.js';
import { esViolacionDeUnicidad } from '../../common/db/uniqueness.js';
import { ErrorApi } from '../../common/errors/error-api.js';
import { nuevoId } from '../../common/ids/ids.js';
import { Reloj } from '../../common/clock/clock.js';
import { CategoriasExistentes } from './existing-categories.js';
import type { RegistroDto, IngresoDto } from './dto/register.dto.js';
import type { ActualizarYoDto } from './dto/update-me.dto.js';
import { mezclarPreferencias, preferenciasIniciales } from './rules/preferences.js';
import { UsuarioEntidad } from './user.entity.js';
import { aContrato } from './users.mapper.js';

// Hash de una contraseña cualquiera: el ingreso con un email inexistente tarda lo mismo.
const HASH_DE_RELLENO = hashearContrasena('relleno-para-igualar-tiempos');

const MAX_INTENTOS_ACTUALIZAR = 10;

export const normalizarEmail = (email: string) => email.trim().toLowerCase();

@Injectable()
export class UsuariosServicio extends UsuariosActivos {
  constructor(
    @InjectRepository(UsuarioEntidad) private readonly repo: Repository<UsuarioEntidad>,
    private readonly jwt: JwtService,
    private readonly reloj: Reloj,
    private readonly categorias: CategoriasExistentes,
    private readonly archivos: VerificadorArchivos,
  ) {
    super();
  }

  async rolDe(usuarioId: string): Promise<Rol | null> {
    const u = await this.repo.findOne({ where: { id: usuarioId }, select: { id: true, rol: true } });
    return u?.rol ?? null;
  }

  async registrar(dto: RegistroDto): Promise<Sesion> {
    const email = normalizarEmail(dto.email);
    if (await this.repo.existsBy({ email })) throw new ErrorApi('EMAIL_YA_REGISTRADO');
    const usuario = this.repo.create({
      id: nuevoId('usr'),
      nombre: dto.nombre,
      email,
      hashContrasena: await hashearContrasena(dto.contrasena),
      rol: 'turista',
      avatarClave: null,
      creadoEn: this.reloj.ahora(),
      preferencias: preferenciasIniciales(),
      version: 0,
    });
    try {
      await this.repo.insert(usuario);
    } catch (error) {
      // Dos registros simultáneos con el mismo email: el índice único decide.
      if (esViolacionDeUnicidad(error)) throw new ErrorApi('EMAIL_YA_REGISTRADO');
      throw error;
    }
    return this.sesion(await this.repo.findOneByOrFail({ id: usuario.id }));
  }

  async ingresar(dto: IngresoDto): Promise<Sesion> {
    const usuario = await this.repo.findOneBy({ email: normalizarEmail(dto.email) });
    const valida = await verificarContrasena(
      dto.contrasena,
      usuario?.hashContrasena ?? (await HASH_DE_RELLENO),
    );
    if (!usuario || !valida) throw new ErrorApi('CREDENCIALES_INVALIDAS');
    return this.sesion(usuario);
  }

  async yo(usuarioId: string): Promise<Usuario> {
    return aContrato(await this.buscar(usuarioId));
  }

  async actualizar(usuarioId: string, dto: ActualizarYoDto): Promise<Usuario> {
    const avatarClave =
      dto.avatarUrl === undefined || dto.avatarUrl === null
        ? dto.avatarUrl
        : await this.archivos.claveSubida(dto.avatarUrl, 'imagen');
    const categorias = dto.preferencias?.categoriasFavoritas;
    if (categorias && !(await this.categorias.existenTodas([...new Set(categorias)]))) {
      throw new ErrorApi('CATEGORIA_NO_ENCONTRADA');
    }
    // Las preferencias se mezclan sobre lo que hay en la base (R18). Si otro pedido la cambió
    // entre la lectura y la escritura, la versión ya no coincide y se vuelve a mezclar.
    for (let intento = 1; ; intento++) {
      const usuario = await this.buscar(usuarioId);
      const leida = usuario.version;
      if (dto.nombre !== undefined) usuario.nombre = dto.nombre;
      if (avatarClave !== undefined) usuario.avatarClave = avatarClave;
      if (dto.preferencias) {
        usuario.preferencias = mezclarPreferencias(usuario.preferencias, dto.preferencias);
      }
      usuario.version = leida + 1;
      const { affected } = await this.repo.update(
        { id: usuarioId, version: leida },
        {
          nombre: usuario.nombre,
          avatarClave: usuario.avatarClave,
          preferencias: usuario.preferencias,
          version: usuario.version,
        },
      );
      if (affected === 1) return aContrato(usuario);
      if (intento >= MAX_INTENTOS_ACTUALIZAR) throw new Error('PATCH /yo: demasiados choques de versión');
    }
  }

  private async buscar(usuarioId: string): Promise<UsuarioEntidad> {
    const usuario = await this.repo.findOneBy({ id: usuarioId });
    if (!usuario) throw new ErrorApi('NO_AUTENTICADO');
    return usuario;
  }

  private async sesion(usuario: UsuarioEntidad): Promise<Sesion> {
    const token = await this.jwt.signAsync({ sub: usuario.id, rol: usuario.rol });
    return { token, usuario: aContrato(usuario) };
  }
}
