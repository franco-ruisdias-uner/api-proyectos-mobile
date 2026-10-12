import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { hashearContrasena } from '../comun/auth/contrasenas.js';
import { Reloj } from '../comun/reloj/reloj.js';
import { normalizarParaBusqueda } from '../comun/texto/normalizar.js';
import { normalizarLegajo } from '../modulos/usuarios/reglas/legajo.js';
import { UsuarioEntidad } from '../modulos/usuarios/usuario.entidad.js';
import { CONTRASENA_DEMO, USUARIOS } from './datos/usuarios.js';

/** Carga los datos de demo. Se usa desde `pnpm db:reiniciar` y con SEMBRAR_SI_VACIA. */
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
    // Una sola sal para todas las cuentas de demo sería más rápido, pero cada usuario
    // lleva la suya, como cualquier otra cuenta.
    const usuarios = await Promise.all(
      USUARIOS.map(async (u) => ({
        ...u,
        legajoBusqueda: normalizarLegajo(u.legajo),
        nombreBusqueda: normalizarParaBusqueda(u.nombre),
        hashContrasena: await hashearContrasena(CONTRASENA_DEMO),
        versionSesion: 0,
        creadoEn: ahora,
      })),
    );
    await this.dataSource.transaction(async (m) => {
      await m.getRepository(UsuarioEntidad).insert(usuarios);
    });
    this.log.log(
      `Sembrados ${usuarios.length} usuarios (contraseña de demo: "${CONTRASENA_DEMO}").`,
    );
  }
}
