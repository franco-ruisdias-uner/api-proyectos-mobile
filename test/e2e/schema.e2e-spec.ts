import { Table } from 'typeorm';
import { ALMACEN_ARCHIVOS } from '../../src/common/files/file-storage.js';
import { Reloj } from '../../src/common/clock/clock.js';
import { Usuario } from '../../src/modules/users/user.entity.js';
import { UsuariosServicio } from '../../src/modules/users/users.service.js';
import { baseVacia, sembrar } from '../../src/seeds/seed.js';
import { SemillasModulo } from '../../src/seeds/seeds.module.js';
import { VECINOS_DE_RELLENO } from '../../src/seeds/data/reviews.js';
import { CONTRASENA_DEMO, USUARIOS } from '../../src/seeds/data/users.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { esperarContrato } from '../utilities/contract.js';

describe(`AGENTS §5.2 — Esquema estable en ${process.env.DB_MOTOR ?? 'better-sqlite3'}`, () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
  });
  afterAll(() => t.cerrar());

  it('después de sincronizar no queda ninguna consulta pendiente', async () => {
    const pendientes = await t.dataSource.driver.createSchemaBuilder().log();
    expect(pendientes.upQueries.map((q) => q.query)).toEqual([]);
  });

  it('sincronizar dos veces seguidas tampoco deja nada pendiente', async () => {
    await t.dataSource.synchronize();
    const pendientes = await t.dataSource.driver.createSchemaBuilder().log();
    expect(pendientes.upQueries.map((q) => q.query)).toEqual([]);
  });
});

describe('AGENTS §10.4 — Las semillas cumplen el contrato', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    expect(await baseVacia(t.dataSource)).toBe(true);
    await sembrar({
      dataSource: t.dataSource,
      reloj: t.app.get(Reloj),
      almacen: t.app.get(ALMACEN_ARCHIVOS),
    });
  });
  afterAll(() => t.cerrar());

  it('ESPECIFICACION §8 — están los usuarios de demo con sus ids y roles', async () => {
    const usuarios = await t.dataSource.getRepository(Usuario).find({ order: { id: 'ASC' } });
    expect(usuarios.map((u) => [u.email, u.rol, u.comercioId])).toEqual(
      expect.arrayContaining([
        ['marta@mail.com', 'vecino', null],
        ['nuevo@demo.ar', 'vecino', null],
        ['tornillo@demo.ar', 'comercio', 'com-118'],
        ['otro.comercio@demo.ar', 'comercio', expect.stringMatching(/^com-/)],
      ]),
    );
    expect(usuarios.find((u) => u.email === 'marta@mail.com')?.id).toBe('usr-512');
    expect(await baseVacia(t.dataSource)).toBe(false);
  });

  it('cada usuario sembrado cumple el contrato Usuario', async () => {
    const servicio = t.app.get(UsuariosServicio);
    for (const u of await t.dataSource.getRepository(Usuario).find()) {
      esperarContrato({ datos: await servicio.contratoDe(u), meta: null }, 'Usuario');
    }
  });

  it.each(USUARIOS.map((u) => [u.email]))('%s ingresa con la contraseña de demo', async (email) => {
    const res = await t
      .http()
      .post('/auth/ingreso')
      .send({ email, contrasena: CONTRASENA_DEMO })
      .expect(200);
    esperarContrato(res.body, 'Sesion');
  });
});

describe('AGENTS §16.2 — SEMBRAR_SI_VACIA', () => {
  it('con la variable en true, la base vacía arranca con los datos de demo', async () => {
    const t = await crearApp({ variables: { SEMBRAR_SI_VACIA: 'true' } });
    // En la matriz, crearApp vacía la base después de arrancar: se vuelve a correr el arranque.
    await t.app.get(SemillasModulo).onApplicationBootstrap();
    await t
      .http()
      .post('/auth/ingreso')
      .send({ email: 'marta@mail.com', contrasena: CONTRASENA_DEMO })
      .expect(200);

    // Si la base ya tiene datos, no toca nada.
    const repo = t.dataSource.getRepository(Usuario);
    await repo.update({ id: 'usr-512' }, { nombre: 'Marta cambiada' });
    await t.app.get(SemillasModulo).onApplicationBootstrap();
    expect(await repo.count()).toBe(USUARIOS.length + VECINOS_DE_RELLENO.length);
    expect((await repo.findOneByOrFail({ id: 'usr-512' })).nombre).toBe('Marta cambiada');
    await t.cerrar();
  });

  it('sin la variable, la base queda vacía', async () => {
    const t = await crearApp();
    expect(await baseVacia(t.dataSource)).toBe(true);
    await t.cerrar();
  });
});

// AGENTS §18.3 — sólo PostgreSQL (la matriz): las tablas quedan en DB_ESQUEMA y reiniciar no toca otro esquema.
describe.runIf(process.env.DB_MOTOR === 'postgres')(
  'AGENTS §18.3 — DB_ESQUEMA en PostgreSQL',
  () => {
    let t: AppDePrueba;
    beforeAll(async () => {
      t = await crearApp({ variables: { DB_ESQUEMA: 'api_prueba' } });
    });
    afterAll(async () => {
      const runner = t.dataSource.createQueryRunner();
      await runner.dropTable('public.tabla_ajena', true);
      await runner.release();
      await t.dataSource.dropDatabase();
      await t.cerrar();
    });

    it('las tablas de la API quedan en el esquema pedido y reiniciar no toca una tabla ajena de public', async () => {
      const runner = t.dataSource.createQueryRunner();
      await runner.createTable(
        new Table({
          name: 'public.tabla_ajena',
          columns: [{ name: 'id', type: 'int', isPrimary: true }],
        }),
        true,
      );
      expect(await runner.hasTable('api_prueba.usuarios')).toBe(true);
      await t.dataSource.synchronize(true);
      expect(await runner.hasTable('api_prueba.usuarios')).toBe(true);
      expect(await runner.hasTable('public.tabla_ajena')).toBe(true);
      await runner.release();
    });
  },
);
