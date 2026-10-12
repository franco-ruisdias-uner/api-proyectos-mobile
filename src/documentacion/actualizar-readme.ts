import { readFileSync, writeFileSync } from 'node:fs';

// `pnpm docs:readme`: regenera las tablas de endpoints y de errores del README.
process.env.DB_MOTOR = 'better-sqlite3';

const { NestFactory } = await import('@nestjs/core');
const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger');
const { AppModule } = await import('../app.module.js');
const { MARCAS, reemplazarEntre, tablaDeEndpoints, tablaDeErrores } =
  await import('./tablas.js');

const app = await NestFactory.create(
  AppModule.registrar({
    ENTORNO: 'test',
    DB_ARCHIVO: ':memory:',
    JWT_SECRETO: 'solo-para-generar-el-readme',
    DIRECTORIO_ARCHIVOS: '/tmp/api-medidores-readme',
  }),
  { logger: ['error'] },
);
await app.init();
const documento = SwaggerModule.createDocument(
  app,
  new DocumentBuilder().build(),
);
await app.close();

let readme = readFileSync('README.md', 'utf8');
readme = reemplazarEntre(
  readme,
  MARCAS.endpoints,
  tablaDeEndpoints(documento as never),
);
readme = reemplazarEntre(readme, MARCAS.errores, tablaDeErrores());
writeFileSync('README.md', readme);
console.log('README actualizado.');
