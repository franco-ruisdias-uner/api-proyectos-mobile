import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { middlewareOrigen } from './comun/origen/origen.js';
import { middlewareSimulacion } from './comun/simulacion/middleware-simulacion.js';
import { ENTORNO } from './config/entorno.modulo.js';
import type { Entorno } from './config/entorno.js';
import { VERSION } from './config/version.js';

/** Lo que se configura sobre Express; lo comparten `main.ts` y `crearApp()` de los tests. */
export function configurarApp(app: NestExpressApplication): void {
  const entorno = app.get<Entorno>(ENTORNO);
  if (entorno.CONFIAR_PROXY) app.set('trust proxy', true);
  app.enableCors();
  app.use(middlewareOrigen(entorno.URL_PUBLICA));
  if (entorno.SIMULACION_HABILITADA) app.use(middlewareSimulacion);

  const documento = SwaggerModule.createDocument(
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
  SwaggerModule.setup('docs', app, documento, { jsonDocumentUrl: 'docs-json' });
}
