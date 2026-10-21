import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import type { AppConfigService } from './config/configuration.js';
import { crearValidationPipe } from './common/errors/validation.js';
import { middlewareOrigen } from './common/context/request-context.js';
import { apiVersion } from './common/health/version.js';
import { middlewareSimulacion } from './common/simulation/simulation.js';
import path from 'node:path';
import { writeFileSync } from 'node:fs';

/**
 * Lo que se configura sobre la app de Express, en este orden. Lo usa main.ts y también los
 * tests e2e, para que la app que se prueba sea la misma que corre.
 */
export function setupApp(
  app: NestExpressApplication,
  config: AppConfigService,
): void {
  const http = config.get('http', { infer: true });

  // Detrás de un proxy (Render, Koyeb), confiar en X-Forwarded-*: así req.ip es la IP real
  // (la usa el límite de pedidos) y req.protocol dice https (lo usan las URLs de los archivos).
  if (http.trustProxy) app.set('trust proxy', true);

  // Cabeceras de seguridad, con dos ajustes a los valores de helmet:
  // - `cross-origin`: Expo web (otro origen) puede mostrar las fotos y reproducir los audios y
  //   videos que sirve /archivos;
  // - sin `upgrade-insecure-requests`: en la red de la facultad la API se usa por http
  //   (http://192.168.0.10:3000/docs) y el navegador pediría por https el JS y el CSS de
  //   Swagger, que no cargaría. Publicada, el host ya sirve todo por https.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } },
    }),
  );

  // CORS: las apps nativas no lo necesitan (no son un navegador); Expo web sí.
  app.enableCors({
    origin: http.corsOrigins,
    exposedHeaders: [
      'Content-Range',
      'Accept-Ranges',
      'Content-Length',
      'ETag',
      'Retry-After',
    ],
    maxAge: 600,
  });

  app.use(middlewareOrigen(http.publicUrl));
  if (config.get('app.simulationEnabled', { infer: true })) {
    app.use(middlewareSimulacion);
  }
  app.useGlobalPipes(crearValidationPipe());

  const configuracion = new DocumentBuilder()
    .setTitle('API · Lectura de Medidores · Chajarí')
    .setDescription(
      'API del Trabajo Final 2026 (Desarrollo para Móviles · UNER), a partir del PRD «Lectura de Medidores» ' +
        'de la Cooperativa de Agua Potable de Chajarí.\n\n' +
        'Todas las respuestas vienen en un sobre: `{ datos, meta }` (en un solo recurso, `meta` es `null`) o ' +
        '`{ error: { codigo, mensaje } }`. Las fechas y horas tienen la zona `-03:00`. ' +
        'Para usar los endpoints con candado, ingresá con `POST /auth/ingreso` y tocá **Authorize** con el token.\n\n' +
        'Cabecera `X-Simular`: `error-500` o `demora-3000`, para probar errores y demoras.',
    )
    .setVersion(apiVersion())
    .addServer(
      `http://localhost:${config.get('app.port', { infer: true })}`,
      'Esta computadora',
    )
    .addBearerAuth()
    .build();
  // El documento completo (con las rutas). Bruno importa swagger.json; sin `paths` lo rechaza.
  const documento = SwaggerModule.createDocument(app, configuracion);
  // En los tests no se escribe: cada e2e pisaría el archivo en la raíz del repo.
  if (config.get('app.env', { infer: true }) !== 'test') {
    writeFileSync(
      path.resolve(process.cwd(), 'swagger.json'),
      JSON.stringify(documento, null, 2),
      { encoding: 'utf8' },
    );
  }
  SwaggerModule.setup('docs', app, documento, { jsonDocumentUrl: 'docs-json' });
}
