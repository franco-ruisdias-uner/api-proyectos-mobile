import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { hashearContrasena } from '../comun/auth/contrasenas.js';
import { Reloj } from '../comun/reloj/reloj.js';
import { UsuarioEntidad } from '../modulos/usuarios/usuario.entidad.js';
import { USUARIOS_SEMILLA } from './datos/usuarios.js';

const DIA = 24 * 60 * 60 * 1000;

/**
 * Carga los datos de demo. Todo lo temporal se calcula relativo al reloj (AGENTS §6), así la
 * demo siempre tiene "hoy". Cada módulo agrega lo suyo acá.
 */
@Injectable()
export class Sembrador {
  private readonly log = new Logger('Semillas');

  constructor(
    private readonly dataSource: DataSource,
    private readonly reloj: Reloj,
  ) {}

  async estaVacia(): Promise<boolean> {
    return (await this.dataSource.getRepository(UsuarioEntidad).count()) === 0;
  }

  async sembrar(): Promise<void> {
    const ahora = this.reloj.ahora();
    const usuarios = this.dataSource.getRepository(UsuarioEntidad);
    for (const u of USUARIOS_SEMILLA) {
      await usuarios.insert({
        id: u.id,
        nombre: u.nombre,
        email: u.email,
        hashContrasena: await hashearContrasena(u.contrasena),
        rol: u.rol,
        avatarClave: null,
        creadoEn: new Date(ahora.getTime() - u.creadoHaceDias * DIA),
        preferencias: u.preferencias,
        version: 0,
      });
    }
    this.log.log(`Datos de demo cargados: ${USUARIOS_SEMILLA.length} usuarios.`);
  }
}
