import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { DataSource } from 'typeorm';

// Sólo tiene sentido en PostgreSQL (MySQL y SQLite no tienen esquemas): en los otros motores,
// el archivo comprueba que DB_SCHEMA se ignora y la app anda igual.
const motor = process.env.DB_ENGINE ?? 'better-sqlite3';

describe('AGENTS §18.1 — DB_SCHEMA: las tablas van en el esquema de la API y nada más', () => {
  let c: AppDePrueba;
  beforeAll(async () => {
    if (motor === 'postgres') {
      // Una tabla ajena en public, que db:reiniciar tiene que respetar.
      const ajeno = new DataSource({
        type: 'postgres',
        url: process.env.DB_URL,
      });
      await ajeno.initialize();
      await ajeno.query('CREATE TABLE IF NOT EXISTS "tabla_ajena" (id int)');
      await ajeno.query('DROP SCHEMA IF EXISTS "api_prueba" CASCADE');
      await ajeno.destroy();
    }
    c = await crearApp({
      entorno: motor === 'postgres' ? { DB_SCHEMA: 'api_prueba' } : {},
    });
  });
  afterAll(async () => {
    await c.cerrar();
    if (motor === 'postgres') {
      const ajeno = new DataSource({
        type: 'postgres',
        url: process.env.DB_URL,
      });
      await ajeno.initialize();
      await ajeno.query('DROP TABLE IF EXISTS "tabla_ajena"');
      await ajeno.query('DROP SCHEMA IF EXISTS "api_prueba" CASCADE');
      await ajeno.destroy();
    }
  });

  it('la API anda', async () => {
    await c.http().get('/salud').expect(200);
  });

  it.runIf(motor === 'postgres')(
    'crea el esquema, deja las tablas ahí y no toca la tabla ajena de public',
    async () => {
      const tablas = (await c.dataSource.query(
        `SELECT table_schema AS esquema, table_name AS tabla FROM information_schema.tables WHERE table_name IN ('usuarios', 'tabla_ajena')`,
      )) as Array<{ esquema: string; tabla: string }>;
      expect(tablas).toContainEqual({
        esquema: 'api_prueba',
        tabla: 'usuarios',
      });
      expect(tablas).toContainEqual({
        esquema: 'public',
        tabla: 'tabla_ajena',
      });
    },
  );

  it.runIf(motor === 'postgres')(
    'al reconectar con borrado (db:reiniciar), la tabla ajena sobrevive',
    async () => {
      await c.cerrar();
      c = await crearApp({ entorno: { DB_SCHEMA: 'api_prueba' } });
      const ajena = (await c.dataSource.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tabla_ajena'`,
      )) as unknown[];
      expect(ajena).toHaveLength(1);
    },
  );
});
