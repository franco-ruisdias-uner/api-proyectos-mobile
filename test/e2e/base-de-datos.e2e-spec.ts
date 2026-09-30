import { baseVacia, sembrar } from '../../src/semillas/sembrar.js';
import { CONTRASENA_DE_DEMO, USUARIOS } from '../../src/semillas/datos/usuarios.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato } from '../utilidades/contrato.js';

describe(`AGENTS §5.2 — esquema estable en ${process.env.DB_MOTOR ?? 'better-sqlite3'}`, () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('después de sincronizar no queda ninguna consulta pendiente', async () => {
    const pendientes = await ctx.dataSource.driver.createSchemaBuilder().log();
    expect(pendientes.upQueries.map((q) => q.query)).toEqual([]);
  });

  it('volver a sincronizar tampoco cambia nada', async () => {
    await ctx.dataSource.synchronize();
    const pendientes = await ctx.dataSource.driver.createSchemaBuilder().log();
    expect(pendientes.upQueries.map((q) => q.query)).toEqual([]);
  });
});

describe('AGENTS §10.4 — los datos de demo cumplen el contrato', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
    expect(await baseVacia(ctx.dataSource)).toBe(true);
    await sembrar(ctx.dataSource, ctx.reloj);
  });
  afterAll(() => ctx.cerrar());

  it('la base ya no está vacía', async () => {
    expect(await baseVacia(ctx.dataSource)).toBe(false);
  });

  it('espec. §8 — están las tres cuentas de demo, con los ids del PRD', () => {
    expect(USUARIOS.map((u) => u.email)).toEqual([
      'julian@mail.com',
      'nuevo@demo.ar',
      'transporte@parana.demo.ar',
    ]);
    expect(USUARIOS[0]).toMatchObject({ id: 'usr-320', nombre: 'Julián Ferrari', rol: 'pasajero' });
    expect(USUARIOS[2].rol).toBe('direccion');
  });

  it.each(USUARIOS.map((u) => [u.email]))(
    '%s ingresa con la contraseña de demo y su Usuario cumple el contrato',
    async (email) => {
      const ingreso = await ctx.http
        .post('/auth/ingreso')
        .send({ email, contrasena: CONTRASENA_DE_DEMO })
        .expect(200);
      esperarContrato(ingreso.body, 'Sesion');
      const yo = await ctx.http
        .get('/yo')
        .set('Authorization', `Bearer ${ingreso.body.datos.token as string}`)
        .expect(200);
      esperarContrato(yo.body, 'Usuario');
    },
  );

  it('usr-320 es Julián Ferrari, como en el PRD', async () => {
    const r = await ctx.http
      .post('/auth/ingreso')
      .send({ email: 'julian@mail.com', contrasena: CONTRASENA_DE_DEMO })
      .expect(200);
    expect(r.body.datos.usuario).toMatchObject({
      id: 'usr-320',
      nombre: 'Julián Ferrari',
      email: 'julian@mail.com',
      avisosActivos: true,
      tema: 'sistema',
    });
  });
});

describe('AGENTS §16.2 — SEMBRAR_SI_VACIA', () => {
  it('con SEMBRAR_SI_VACIA=true, una base vacía arranca con los datos de demo', async () => {
    const ctx = await crearApp({ entorno: { SEMBRAR_SI_VACIA: 'true' } });
    try {
      // Contra un servidor, crearApp vacía la base después de arrancar: se vuelve a arrancar el hook.
      if (await baseVacia(ctx.dataSource)) {
        const { SembradoInicial } = await import('../../src/semillas/semillas.modulo.js');
        await ctx.app.get(SembradoInicial).onApplicationBootstrap();
      }
      await ctx.http
        .post('/auth/ingreso')
        .send({ email: 'julian@mail.com', contrasena: CONTRASENA_DE_DEMO })
        .expect(200);
      // Si ya tiene datos, no toca nada.
      const { SembradoInicial } = await import('../../src/semillas/semillas.modulo.js');
      await ctx.app.get(SembradoInicial).onApplicationBootstrap();
    } finally {
      await ctx.cerrar();
    }
  });

  it('sin SEMBRAR_SI_VACIA la base queda vacía', async () => {
    const ctx = await crearApp();
    try {
      expect(await baseVacia(ctx.dataSource)).toBe(true);
    } finally {
      await ctx.cerrar();
    }
  });
});
