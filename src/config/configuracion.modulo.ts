import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CONFIGURACION, leerConfiguracion } from './configuracion.js';

/**
 * Carga .env (con @nestjs/config), lo valida y publica la configuración tipada con el
 * token CONFIGURACION. En los tests no se lee .env: el entorno lo arma crearApp().
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: process.env.VITEST !== undefined,
      validate: (entorno) => {
        leerConfiguracion(entorno);
        return entorno;
      },
    }),
  ],
  providers: [{ provide: CONFIGURACION, useFactory: () => leerConfiguracion(process.env) }],
  exports: [CONFIGURACION],
})
export class ConfiguracionModulo {}
