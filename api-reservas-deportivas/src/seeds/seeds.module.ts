import {
  Injectable,
  Logger,
  Module,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AlmacenArchivos } from '../common/files/file-storage.js';
import { Configuracion } from '../config/environment.js';
import { Reloj } from '../common/clock/clock.js';
import { baseVacia, sembrar } from './seed.js';

/** Con SEMBRAR_SI_VACIA=true siembra al arrancar si la base no tiene datos (AGENTS §16.2). */
@Injectable()
export class SembradoInicial implements OnApplicationBootstrap {
  private readonly logger = new Logger('Semillas');

  constructor(
    private readonly config: Configuracion,
    private readonly dataSource: DataSource,
    private readonly reloj: Reloj,
    private readonly almacen: AlmacenArchivos,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.sembrarSiVacia) return;
    if (!(await baseVacia(this.dataSource))) {
      this.logger.log('La base ya tiene datos: no se siembra.');
      return;
    }
    await sembrar(this.dataSource, this.reloj, this.almacen);
    this.logger.log('Base vacía: se cargaron los datos de demo.');
  }
}

@Module({ providers: [SembradoInicial] })
export class SemillasModulo {}
