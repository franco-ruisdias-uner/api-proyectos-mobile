import { Inject, Injectable, Logger, Module, type OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Reloj } from '../comun/reloj/reloj.js';
import { CONFIGURACION, type Configuracion } from '../config/configuracion.js';
import { baseVacia, sembrar } from './sembrar.js';

/** SEMBRAR_SI_VACIA=true: al arrancar, si la base no tiene datos, siembra (AGENTS §16.2). */
@Injectable()
export class SembradoInicial implements OnApplicationBootstrap {
  private readonly registro = new Logger('Semillas');

  constructor(
    @Inject(CONFIGURACION) private readonly config: Configuracion,
    private readonly dataSource: DataSource,
    private readonly reloj: Reloj,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.sembrarSiVacia) return;
    if (!(await baseVacia(this.dataSource))) {
      this.registro.log('La base ya tiene datos: no se siembra nada.');
      return;
    }
    await sembrar(this.dataSource, this.reloj);
    this.registro.log('Base vacía: se cargaron los datos de demo.');
  }
}

@Module({ providers: [SembradoInicial] })
export class SemillasModulo {}
