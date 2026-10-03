import { Reloj } from '../../src/comun/reloj/reloj.js';
import { Usuario } from '../../src/modulos/usuarios/usuario.entidad.js';
import { UsuariosServicio } from '../../src/modulos/usuarios/usuarios.servicio.js';
import { baseVacia, sembrar } from '../../src/semillas/sembrar.js';
import { SemillasModulo } from '../../src/semillas/semillas.modulo.js';
import { CONTRASENA_DEMO, USUARIOS } from '../../src/semillas/datos/usuarios.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato } from '../utilidades/contrato.js';

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
    await sembrar({ dataSource: t.dataSource, reloj: t.app.get(Reloj) });
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
    expect(await repo.count()).toBe(USUARIOS.length);
    expect((await repo.findOneByOrFail({ id: 'usr-512' })).nombre).toBe('Marta cambiada');
    await t.cerrar();
  });

  it('sin la variable, la base queda vacía', async () => {
    const t = await crearApp();
    expect(await baseVacia(t.dataSource)).toBe(true);
    await t.cerrar();
  });
});
