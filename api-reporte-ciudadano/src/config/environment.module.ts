import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CLAVE_ENTORNO, validarEntorno, type Entorno } from './environment.js';

/** Token para inyectar el Entorno ya validado: `@Inject(ENTORNO) entorno: Entorno`. */
export const ENTORNO = Symbol('ENTORNO');

/**
 * Valida el entorno con @nestjs/config al arrancar. `sobrescribir` pisa lo que venga de
 * process.env (lo usan los tests). El .env lo carga main.ts antes de importar la app,
 * porque los tipos de columna dependen de DB_MOTOR (ver src/common/db/columns.ts).
 */
@Global()
@Module({})
export class EntornoModulo {
  static registrar(sobrescribir: Record<string, string> = {}): DynamicModule {
    return {
      module: EntornoModulo,
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          validate: (crudo) => {
            const entorno = validarEntorno({ ...crudo, ...sobrescribir });
            return { [CLAVE_ENTORNO]: entorno };
          },
        }),
      ],
      providers: [
        {
          provide: ENTORNO,
          inject: [ConfigService],
          useFactory: (config: ConfigService): Entorno =>
            config.getOrThrow<Entorno>(CLAVE_ENTORNO),
        },
      ],
      exports: [ENTORNO],
    };
  }
}
