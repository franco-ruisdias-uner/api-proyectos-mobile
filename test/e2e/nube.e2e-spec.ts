import { crearApp, type AppDePrueba } from '../utilidades/crear-app.js';
import { crearVecino } from '../utilidades/usuarios.js';
import { jpegDe } from '../utilidades/archivos.js';

async function urlSubida(ctx: AppDePrueba, cabeceras: Record<string, string>) {
  const vecino = await crearVecino(ctx);
  const res = await ctx
    .http()
    .post('/archivos')
    .set(...vecino.auth)
    .set(cabeceras)
    .attach('archivo', jpegDe(500), 'foto.jpg');
  return res.body.datos.url as string;
}

describe('AGENTS §18.2 — CONFIAR_PROXY', () => {
  const proxy = {
    'X-Forwarded-Proto': 'https',
    'X-Forwarded-Host': 'mi-api.onrender.com',
  };

  it('con CONFIAR_PROXY=true las URLs de los archivos salen https con el host público', async () => {
    const ctx = await crearApp({ entorno: { CONFIAR_PROXY: 'true' } });
    try {
      expect(await urlSubida(ctx, proxy)).toMatch(
        /^https:\/\/mi-api\.onrender\.com\/archivos\//,
      );
    } finally {
      await ctx.cerrar();
    }
  });

  it('sin CONFIAR_PROXY se ignoran las cabeceras X-Forwarded-*', async () => {
    const ctx = await crearApp();
    try {
      const url = await urlSubida(ctx, proxy);
      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/archivos\//);
    } finally {
      await ctx.cerrar();
    }
  });
});

// Con PostgreSQL (matriz): las tablas quedan en DB_ESQUEMA y no se toca otro esquema.
describe.runIf(process.env.DB_MOTOR === 'postgres')(
  'AGENTS §18.3 — DB_ESQUEMA en PostgreSQL',
  () => {
    it('crea el esquema, deja ahí las tablas y db:reiniciar (dropDatabase) no toca otro esquema', async () => {
      const ctx = await crearApp({ entorno: { DB_ESQUEMA: 'api_prueba' } });
      try {
        const ds = ctx.dataSource;
        await ds.query(
          'CREATE TABLE IF NOT EXISTS public.ajena_de_prueba (x int)',
        );
        const enEsquema = await ds.query(
          `SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'api_prueba' AND tablename = 'reportes'`,
        );
        expect(enEsquema[0].n).toBe(1);
        // La base de la matriz se comparte entre archivos: en `public` pueden quedar tablas de otros.
        const enPublicAntes = await ds.query(
          `SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'ajena_de_prueba'`,
        );

        await ds.dropDatabase();
        const ajena = await ds.query(
          `SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ajena_de_prueba'`,
        );
        expect(ajena[0].n).toBe(1);
        const enPublicDespues = await ds.query(
          `SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'ajena_de_prueba'`,
        );
        expect(enPublicDespues[0].n).toBe(enPublicAntes[0].n);
        const quedan = await ds.query(
          `SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'api_prueba'`,
        );
        expect(quedan[0].n).toBe(0);
        await ds.query('DROP TABLE public.ajena_de_prueba');
        await ds.query('DROP SCHEMA api_prueba CASCADE');
      } finally {
        await ctx.cerrar();
      }
    });
  },
);
