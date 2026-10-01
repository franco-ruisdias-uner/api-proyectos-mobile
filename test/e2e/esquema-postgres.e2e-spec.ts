import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';

const motor = process.env.DB_MOTOR ?? 'better-sqlite3';

// Sólo tiene sentido en PostgreSQL: es el único motor con esquemas (AGENTS §18.3).
describe.skipIf(motor !== 'postgres')('AGENTS §18.1 — DB_ESQUEMA en PostgreSQL', () => {
  let ctx: AppDePrueba;

  beforeAll(async () => {
    ctx = await crearApp({ entorno: { DB_ESQUEMA: 'api_prueba' } });
  });
  afterAll(async () => {
    await ctx.dataSource.query('DROP TABLE IF EXISTS public.tabla_ajena_de_prueba');
    await ctx.dataSource.query('DROP SCHEMA IF EXISTS api_prueba CASCADE');
    await ctx.cerrar();
  });

  const tablasDe = async (esquema: string): Promise<string[]> =>
    (
      (await ctx.dataSource.query(
        'SELECT table_name FROM information_schema.tables WHERE table_schema = $1',
        [esquema],
      )) as { table_name: string }[]
    ).map((fila) => fila.table_name);

  it('la API crea el esquema y deja ahí sus tablas', async () => {
    const tablas = await tablasDe('api_prueba');
    expect(tablas).toEqual(expect.arrayContaining(['lineas', 'paradas', 'usuarios', 'avisos']));
  });

  it('funciona de punta a punta: se registra un usuario y vuelve a leerlo', async () => {
    const r = await ctx.http
      .post('/auth/registro')
      .send({ nombre: 'Ana', email: 'ana@mail.com', contrasena: 'clave-larga-1' })
      .expect(201);
    await ctx.http
      .get('/yo')
      .set('Authorization', `Bearer ${r.body.datos.token as string}`)
      .expect(200);
  });

  it('db:reiniciar (synchronize con borrado) no toca una tabla ajena en public', async () => {
    await ctx.dataSource.query('CREATE TABLE public.tabla_ajena_de_prueba (id int primary key)');
    await ctx.dataSource.query('INSERT INTO public.tabla_ajena_de_prueba VALUES (1)');

    await ctx.dataSource.synchronize(true);

    expect(await tablasDe('public')).toContain('tabla_ajena_de_prueba');
    const filas = (await ctx.dataSource.query(
      'SELECT count(*)::int AS n FROM public.tabla_ajena_de_prueba',
    )) as { n: number }[];
    expect(filas[0].n).toBe(1);
    expect(await tablasDe('api_prueba')).toContain('lineas'); // se volvió a crear
  });

  it('la estabilidad del esquema se mantiene: cero consultas pendientes', async () => {
    const pendientes = await ctx.dataSource.driver.createSchemaBuilder().log();
    expect(pendientes.upQueries.map((q) => q.query)).toEqual([]);
  });
});
