// pnpm docs:readme — regenera las tablas de endpoints y de errores del README.
import { readFileSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';

// Una app de mentira, en memoria, sólo para armar el documento de Swagger.
Object.assign(process.env, {
  ENTORNO: 'test',
  JWT_SECRETO: process.env.JWT_SECRETO ?? 'solo-para-generar-el-readme',
  DB_MOTOR: 'better-sqlite3',
  DB_ARCHIVO: ':memory:',
  DIRECTORIO_ARCHIVOS: mkdtempSync(join(tmpdir(), 'readme-')),
  NOTIFICACIONES: 'registro',
  SEMBRAR_SI_VACIA: 'false',
});

const { AppModule } = await import('../app.module.js');
const { documentoSwagger } = await import('../setup-app.js');
const { actualizarReadme } = await import('./readme.js');

const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error'] });
const documento = SwaggerModule.createDocument(app, documentoSwagger());
writeFileSync('README.md', actualizarReadme(readFileSync('README.md', 'utf8'), documento));
await app.close();
console.log('README.md actualizado (endpoints y errores).');
