import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { versionDeLaApi } from '../config/version.js';

/** Swagger en /docs (y el JSON en /docs-json): la referencia para pasar del mock a fetch. */
export function configurarSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('API — Directorio de Comercios · Concepción del Uruguay')
    .setDescription(
      'API del Trabajo Final de Desarrollo para Móviles (UNER), sobre el PRD del Centro Comercial.\n\n' +
        'Toda respuesta viene en un sobre: `{ datos, meta }` si salió bien (en un solo recurso, ' +
        '`meta` es `null`) o `{ error: { codigo, mensaje } }` si no. El `mensaje` se puede mostrar ' +
        'tal cual en pantalla. Un `DELETE` que sale bien responde 204 sin cuerpo.\n\n' +
        'Las fechas con hora vienen como `2026-11-14T21:00:00-03:00`. Los ids son texto con prefijo.\n\n' +
        'Para probar errores y demoras: cabecera `X-Simular: error-500` o `X-Simular: demora-3000`.',
    )
    .setVersion(versionDeLaApi())
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      description: 'El token de /auth/ingreso o /auth/registro',
    })
    .build();
  const documento = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, documento, { jsonDocumentUrl: 'docs-json' });
}
