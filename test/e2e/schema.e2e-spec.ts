import { crearApp, type AppDePrueba } from '../utilities/create-app.js';

describe('AGENTS §5.2 — Estabilidad del esquema', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it(`después de sincronizar no queda ninguna consulta pendiente (${process.env.DB_MOTOR})`, async () => {
    const pendientes = await ctx.dataSource.driver.createSchemaBuilder().log();
    expect(pendientes.upQueries.map((q) => q.query)).toEqual([]);
  });

  it('las tablas van en snake_case y en plural', () => {
    for (const entidad of ctx.dataSource.entityMetadatas) {
      expect(entidad.tableName).toMatch(/^[a-z]+(_[a-z]+)*$/);
    }
  });
});
