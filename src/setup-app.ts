import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { middlewareOrigen } from './common/context/request-context.js';
import { middlewareSimulacion } from './common/simulation/simulation-middleware.js';
import { ENTORNO } from './config/environment.module.js';
import type { Entorno } from './config/environment.js';
import { VERSION } from './config/version.js';

/** Lo que se configura sobre Express; lo comparten `main.ts` y `crearApp()` de los tests. */
export function configurarApp(app: NestExpressApplication): void {
  const entorno = app.get<Entorno>(ENTORNO);
  if (entorno.CONFIAR_PROXY) app.set('trust proxy', true);
  app.enableCors();
  app.use(middlewareOrigen(entorno.URL_PUBLICA));
  if (entorno.SIMULACION_HABILITADA) app.use(middlewareSimulacion);

  SwaggerModule.setup('docs', app, crearDocumentoSwagger(app), { jsonDocumentUrl: 'docs-json' });
}

/** El documento de `/docs`. También lo usa el test que genera las tablas del README. */
export function crearDocumentoSwagger(app: NestExpressApplication): OpenAPIObject {
  return SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Mi Ciudad · Guía turística de Colón')
      .setDescription(
        'API del Trabajo Final 2026 (Desarrollo para Móviles, UNER). Todas las respuestas vienen en ' +
          '`{ datos, meta }` o `{ error: { codigo, mensaje } }`. Las fechas van con offset `-03:00`. ' +
          'La sesión viaja en `Authorization: Bearer <token>`. Para probar errores y demoras, mandá ' +
          'la cabecera `X-Simular: error-500` o `X-Simular: demora-3000`.',
      )
      .setVersion(VERSION)
      .addBearerAuth()
      .build(),
  );
}
