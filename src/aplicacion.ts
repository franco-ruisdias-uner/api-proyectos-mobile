import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { conContexto } from './comun/contexto/contexto-de-pedido.js';
import { FiltroDeExcepciones } from './comun/errores/filtro-de-excepciones.js';
import { crearValidationPipe } from './comun/errores/validacion.js';
import { middlewareDeSimulacion } from './comun/simulacion/simulacion.middleware.js';
import { CONFIGURACION, type Configuracion } from './config/configuracion.js';
import { VERSION } from './modulos/salud/version.js';

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

  const documento = new DocumentBuilder()
    .setTitle('API Transporte Público · Paraná')
    .setDescription(
      'API del Trabajo Final de Desarrollo para Móviles (UNER). Todas las respuestas vienen en ' +
        'el sobre `{ datos, meta }` o `{ error: { codigo, mensaje } }`. Las fechas y horas viajan ' +
        'con offset `-03:00`. La sesión va en `Authorization: Bearer <token>`.',
    )
    .setVersion(VERSION)
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, documento), {
    jsonDocumentUrl: 'docs-json',
  });
}
