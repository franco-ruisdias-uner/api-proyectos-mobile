import { readFileSync, writeFileSync } from 'node:fs';

// `pnpm docs:readme`: regenera las tablas de endpoints y de errores del README.
// La app se levanta en memoria, sin .env: el entorno se fija antes de importar AppModule
// (ConfigModule valida al importarse), por eso los imports de abajo son dinámicos.
Object.assign(process.env, {
  APP_ENV: 'test',
  DB_ENGINE: 'better-sqlite3',
  DB_FILE: ':memory:',
  JWT_SECRET: 'solo-para-generar-el-readme',
  STORAGE_DIR: '/tmp/api-medidores-readme',
});

const { NestFactory } = await import('@nestjs/core');
const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger');
const { AppModule } = await import('../app.module.js');
const { MARCAS, reemplazarEntre, tablaDeEndpoints, tablaDeErrores } =
  await import('./tables.js');

const app = await NestFactory.create(AppModule, { logger: ['error'] });
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
