// Lo que se configura sobre la app ya creada. Lo comparten main.ts y los tests, así
// los tests prueban exactamente lo mismo que corre.
import { ValidationPipe, type ValidationError } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Configuracion } from './config/environment.js';
import { ErrorApi } from './common/errors/error-api.js';
import { FiltroExcepciones } from './common/errors/exception-filter.js';
import { middlewareContextoPedido } from './common/context/request-context.js';
import { middlewareSimulacion } from './common/simulation/simulation.js';

export function configurarApp(app: NestExpressApplication): void {
  const config = app.get(Configuracion);

  // Detrás del proxy de Render/Koyeb: confiar en X-Forwarded-Proto/Host (AGENTS §18.2).
  app.set('trust proxy', config.confiarProxy);
  app.disable('x-powered-by');
  // La app puede correr también en Expo web.
  app.enableCors();

  app.use(middlewareContextoPedido(config.urlPublica));
  if (config.simulacionHabilitada) app.use(middlewareSimulacion());

  app.useGlobalFilters(new FiltroExcepciones());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // Un solo problema por campo: el primero en validarse, que es el decorador de más abajo.
      stopAtFirstError: true,
      exceptionFactory: (errores) =>
        new ErrorApi('VALIDACION_FALLIDA', mensajeDeValidacion(errores)),
    }),
  );

  const documento = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('API Reservas Deportivas · Villaguay')
      .setDescription(
        'API del Trabajo Final de Desarrollo para Móviles (UNER). Toda respuesta viene en ' +
          '`{ datos, meta }`; los errores, en `{ error: { codigo, mensaje } }`. ' +
          'Los endpoints con candado piden `Authorization: Bearer <token>`.',
      )
      .setVersion('0.1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('docs', app, documento);
}

/** El primer problema de validación, en castellano y nombrando el campo. */
export function mensajeDeValidacion(
  errores: ValidationError[],
  ruta = '',
): string {
  for (const error of errores) {
    const campo = ruta ? `${ruta}.${error.property}` : error.property;
    const restricciones = error.constraints ?? {};
    if (restricciones.whitelistValidation)
      return `Sobra el dato «${campo}»: la API no lo usa.`;
    const mensaje = Object.values(restricciones)[0];
    if (mensaje) return mensaje;
    if (error.children?.length)
      return mensajeDeValidacion(error.children, campo);
  }
  return 'Revisá los datos que mandaste.';
}
