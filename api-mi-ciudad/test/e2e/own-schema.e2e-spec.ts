import { Table } from 'typeorm';
import { crearApp, type AppDePrueba } from '../utilities/create-app.js';

// AGENTS §18.1 y §18.3: con PostgreSQL, las tablas van en DB_ESQUEMA y `db:reiniciar` no toca otro
// esquema. En los otros motores DB_ESQUEMA no se usa.
describe.runIf(process.env.DB_MOTOR === 'postgres')('AGENTS §18.1 — DB_ESQUEMA en PostgreSQL', () => {
  let ctx: AppDePrueba;
  const ESQUEMA = 'api_prueba';

  beforeAll(async () => {
    ctx = await crearApp({ entorno: { DB_ESQUEMA: ESQUEMA } });
  });
  afterAll(async () => {
    const consulta = ctx.dataSource.createQueryRunner();
    await consulta.dropTable('public.tabla_ajena', true);
    await consulta.release();
    await ctx.cerrar();
  });

  it('la API crea el esquema si no existe y deja sus tablas ahí', async () => {
    const consulta = ctx.dataSource.createQueryRunner();
    try {
      expect(await consulta.hasSchema(ESQUEMA)).toBe(true);
      for (const entidad of ctx.dataSource.entityMetadatas) {
        expect(await consulta.hasTable(`${ESQUEMA}.${entidad.tableName}`), entidad.tableName).toBe(true);
      }
    } finally {
      await consulta.release();
    }
  });

  it('funciona: registro e ingreso con las tablas en ese esquema', async () => {
    const res = await ctx
      .http()
      .post('/auth/registro')
      .send({ nombre: 'Ana', email: 'ana@esquema.test', contrasena: 'clave-larga-1' })
      .expect(201);
    expect(res.body.datos.usuario.email).toBe('ana@esquema.test');
  });

  it('el esquema es estable: cero consultas pendientes', async () => {
    const pendientes = await ctx.dataSource.driver.createSchemaBuilder().log();
    expect(pendientes.upQueries.map((q) => q.query)).toEqual([]);
  });

  it('reiniciar (synchronize(true)) borra las tablas de la API y no toca una tabla ajena de public', async () => {
    const consulta = ctx.dataSource.createQueryRunner();
    try {
      await consulta.dropTable('public.tabla_ajena', true);
      await consulta.createTable(
        new Table({
          name: 'public.tabla_ajena',
          columns: [{ name: 'id', type: 'varchar', length: '10', isPrimary: true }],
        }),
      );
      await ctx.dataSource.synchronize(true);
      expect(await consulta.hasTable('public.tabla_ajena')).toBe(true);
      expect(await consulta.hasTable(`${ESQUEMA}.usuarios`)).toBe(true);
    } finally {
      await consulta.release();
    }
    const usuarios = await ctx.dataSource.getRepository('UsuarioEntidad').count();
    expect(usuarios).toBe(0);
  });
});
