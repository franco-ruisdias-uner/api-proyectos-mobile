import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import type { Sesion } from '../../../contrato/api.js';
import type { Usuario } from '../../../contrato/tipos.js';
import { hashearContrasena, verificarContrasena } from '../../comun/auth/contrasenas.js';
import type { Rol } from '../../comun/auth/decoradores.js';
import { UsuariosActivos } from '../../comun/auth/usuarios-activos.js';
import { VerificadorArchivos } from '../../comun/archivos/verificador-archivos.js';
import { esViolacionDeUnicidad } from '../../comun/db/unicidad.js';
import { ErrorApi } from '../../comun/errores/error-api.js';
import { nuevoId } from '../../comun/ids/ids.js';
import { Reloj } from '../../comun/reloj/reloj.js';
import { CategoriasExistentes } from './categorias-existentes.js';
import type { RegistroDto, IngresoDto } from './dto/registro.dto.js';
import type { ActualizarYoDto } from './dto/actualizar-yo.dto.js';
import { mezclarPreferencias, preferenciasIniciales } from './reglas/preferencias.js';
import { UsuarioEntidad } from './usuario.entidad.js';
import { aContrato } from './usuarios.mapeador.js';

// Hash de una contraseña cualquiera: el ingreso con un email inexistente tarda lo mismo.
const HASH_DE_RELLENO = hashearContrasena('relleno-para-igualar-tiempos');

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
    const usuario = await this.buscar(usuarioId);
    if (dto.nombre !== undefined) usuario.nombre = dto.nombre;
    if (dto.avatarUrl !== undefined) {
      usuario.avatarClave =
        dto.avatarUrl === null ? null : await this.archivos.claveSubida(dto.avatarUrl, 'imagen');
    }
    if (dto.preferencias) {
      const categorias = dto.preferencias.categoriasFavoritas;
      if (categorias && !(await this.categorias.existenTodas([...new Set(categorias)]))) {
        throw new ErrorApi('CATEGORIA_NO_ENCONTRADA');
      }
      usuario.preferencias = mezclarPreferencias(usuario.preferencias, dto.preferencias);
    }
    await this.repo.save(usuario);
    return aContrato(usuario);
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
