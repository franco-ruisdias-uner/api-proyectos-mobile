import { Inject, Logger, Module, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { ALMACEN_ARCHIVOS, type AlmacenArchivos } from '../common/files/file-storage.js';
import { Reloj } from '../common/clock/clock.js';
import { ENTORNO, type Entorno } from '../config/environment.js';
import { baseVacia, sembrar } from './seed.js';

/** Con SEMBRAR_SI_VACIA=true, al arrancar siembra si la base no tiene datos (AGENTS §16.2). */
@Module({})
export class SemillasModulo implements OnApplicationBootstrap {
  private readonly logger = new Logger('Semillas');

  constructor(
    @Inject(ENTORNO) private readonly entorno: Entorno,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly reloj: Reloj,
    @Inject(ALMACEN_ARCHIVOS) private readonly almacen: AlmacenArchivos,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.entorno.sembrarSiVacia) return;
    if (!(await baseVacia(this.dataSource))) {
      this.logger.log('La base ya tiene datos: no se siembra.');
      return;
    }
    await sembrar({ dataSource: this.dataSource, reloj: this.reloj, almacen: this.almacen });
    this.logger.log('Base vacía: se cargaron los datos de demo.');
  }
}
