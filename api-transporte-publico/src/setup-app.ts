import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { conContexto } from './common/context/request-context.js';
import { FiltroDeExcepciones } from './common/errors/exception-filter.js';
import { crearValidationPipe } from './common/errors/validation.js';
import { middlewareDeSimulacion } from './common/simulation/simulation-middleware.js';
import { CONFIGURACION, type Configuracion } from './config/environment.js';
import { VERSION } from './modules/health/version.js';

/** Todo lo que se configura sobre la app, igual en main.ts y en los tests. */
export function configurarAplicacion(app: NestExpressApplication): void {
  const config = app.get<Configuracion>(CONFIGURACION);

  // Detrás del proxy de Render/Koyeb: confiar en X-Forwarded-Proto y X-Forwarded-Host.
  app.set('trust proxy', config.confiarProxy);
  app.enableCors();

  // El origen del pedido, para armar las URLs absolutas de los archivos (AGENTS §8).
  app.use(
    (pedido: { protocol: string; host: string | undefined }, _r: unknown, siguiente: () => void) =>
      conContexto({ origen: `${pedido.protocol}://${pedido.host ?? 'localhost'}` }, siguiente),
  );
  if (config.simulacionHabilitada) app.use(middlewareDeSimulacion);

  app.useGlobalFilters(new FiltroDeExcepciones());
  app.useGlobalPipes(crearValidationPipe());

  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, documentoSwagger()), {
    jsonDocumentUrl: 'docs-json',
  });
}

export function documentoSwagger() {
  return new DocumentBuilder()
    .setTitle('API Transporte Público · Paraná')
    .setDescription(
      'API del Trabajo Final de Desarrollo para Móviles (UNER). Todas las respuestas vienen en ' +
        'el sobre `{ datos, meta }` o `{ error: { codigo, mensaje } }`. Las fechas y horas viajan ' +
        'con offset `-03:00`. La sesión va en `Authorization: Bearer <token>`.',
    )
    .setVersion(VERSION)
    .addBearerAuth()
    .build();
}
