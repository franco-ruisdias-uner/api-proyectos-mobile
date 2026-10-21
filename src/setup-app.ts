// Configuración de la app de Express que comparten main.ts y los tests.
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { responderError } from './common/errors/exception-filter.js';
import { ENTORNO } from './config/environment.module.js';
import type { Entorno } from './config/environment.js';

/** Opciones de NestFactory.create: el body-parser lo registra configurarAplicacion(). */
export const OPCIONES_NEST = { bodyParser: false } as const;

export const LIMITE_JSON = '1mb';

export function configurarAplicacion(app: NestExpressApplication): void {
  const entorno = app.get<Entorno>(ENTORNO);

  // Detrás del proxy de Render o Koyeb: X-Forwarded-Proto/Host dan https y el host público.
  app.set('trust proxy', entorno.CONFIAR_PROXY);

  // La app puede correr en Expo web: CORS abierto.
  app.enableCors({
    origin: '*',
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
  });

  // JSON propio para que un cuerpo mal formado o enorme salga con el sobre de error.
  app.useBodyParser('json', { limit: LIMITE_JSON });
  app.use(
    (error: unknown, _req: Request, res: Response, next: NextFunction) => {
      if (!error) return next();
      responderError(error, res);
    },
  );

  const config = new DocumentBuilder()
    .setTitle('API Reporte Ciudadano · Gualeguaychú')
    .setDescription(
      [
        'API del Trabajo Final de Desarrollo para Móviles (UNER), a partir del PRD «Reporte Ciudadano».',
        '',
        'Toda respuesta viene en un sobre: `{ "datos": …, "meta": … }` (`meta` es `null` para un solo recurso).',
        'Los errores vienen como `{ "error": { "codigo": "…", "mensaje": "…" } }`; el mensaje se puede mostrar tal cual.',
        'Con sesión: cabecera `Authorization: Bearer <token>`. Las fechas llegan como `2026-11-14T21:00:00-03:00`.',
      ].join('\n'),
    )
    .setVersion('1')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'docs',
    app,
    () => SwaggerModule.createDocument(app, config),
    {
      jsonDocumentUrl: 'docs-json',
    },
  );
}
