import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { middlewareContexto } from './comun/contexto/contexto-pedido.js';
import { errorDeValidacion } from './comun/errores/validacion.js';
import { aErrorApi, enviarError, FiltroExcepciones } from './comun/errores/filtro-excepciones.js';
import { middlewareSimulacion } from './comun/simulacion/simulacion.js';
import type { Entorno } from './config/entorno.js';
import { configurarSwagger } from './swagger/swagger.js';

/**
 * Todo lo que se configura sobre la app, igual en main.ts y en los tests.
 * La app se crea con `{ bodyParser: false }` (ver OPCIONES_APP).
 */
export function configurarApp(app: NestExpressApplication, entorno: Entorno): void {
  // Detrás del proxy de un host (Render, Koyeb): confiar en X-Forwarded-Proto/Host.
  app.set('trust proxy', entorno.confiarProxy);
  app.set('x-powered-by', false);
  app.enableCors();

  app.use(middlewareContexto(entorno.urlPublica));
  if (entorno.simulacionHabilitada) app.use(middlewareSimulacion());

  // La app se crea con `bodyParser: false` y el parser se registra acá, seguido del manejador
  // de sus errores: así un JSON mal escrito también sale con el sobre de error.
  app.useBodyParser('json', { limit: '1mb' });
  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(error);
    enviarError(res, aErrorApi(error));
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
      exceptionFactory: errorDeValidacion,
    }),
  );
  app.useGlobalFilters(new FiltroExcepciones());
  configurarSwagger(app);
}

/** Opciones de NestFactory.create / createNestApplication. */
export const OPCIONES_APP = { bodyParser: false } as const;
