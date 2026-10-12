import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Entorno } from './config/entorno.js';
import { crearValidationPipe } from './comun/errores/validacion.js';
import { middlewareOrigen } from './comun/origen/origen.js';
import { versionDeLaApi } from './comun/salud/version.js';
import { middlewareSimulacion } from './comun/simulacion/simulacion.js';

/** Todo lo que se configura sobre la app, igual en main.ts y en los tests. */
export function configurarApp(
  app: NestExpressApplication,
  entorno: Entorno,
): void {
  app.enableCors();
  if (entorno.CONFIAR_PROXY) app.set('trust proxy', true);
  app.use(middlewareOrigen(entorno.URL_PUBLICA));
  if (entorno.SIMULACION_HABILITADA) app.use(middlewareSimulacion);
  app.useGlobalPipes(crearValidationPipe());

  const documento = new DocumentBuilder()
    .setTitle('API · Lectura de Medidores · Chajarí')
    .setDescription(
      'API del Trabajo Final 2026 (Desarrollo para Móviles · UNER), a partir del PRD «Lectura de Medidores» ' +
        'de la Cooperativa de Agua Potable de Chajarí.\n\n' +
        'Todas las respuestas vienen en un sobre: `{ datos, meta }` (en un solo recurso, `meta` es `null`) o ' +
        '`{ error: { codigo, mensaje } }`. Las fechas y horas tienen la zona `-03:00`. ' +
        'Para usar los endpoints con candado, ingresá con `POST /auth/ingreso` y tocá **Authorize** con el token.\n\n' +
        'Cabecera `X-Simular`: `error-500` o `demora-3000`, para probar errores y demoras.',
    )
    .setVersion(versionDeLaApi())
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'docs',
    app,
    () => SwaggerModule.createDocument(app, documento),
    {
      jsonDocumentUrl: 'docs-json',
    },
  );
}
