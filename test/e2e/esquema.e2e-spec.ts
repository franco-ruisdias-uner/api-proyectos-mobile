import { crearApp, type AppDePrueba } from '../utilidades/crear-app.js';
import { esperarContrato, esperarForma } from '../utilidades/contrato.js';
import { Cuadrilla } from '../../src/modulos/catalogos/cuadrilla.entidad.js';
import { Zona } from '../../src/modulos/catalogos/zona.entidad.js';
import { sembrar } from '../../src/semillas/sembrar.js';
import {
  USUARIOS_DEMO,
  CONTRASENA_DEMO,
} from '../../src/semillas/datos/usuarios.js';
import { Usuario } from '../../src/modulos/usuarios/usuario.entidad.js';
import { aUsuario } from '../../src/modulos/usuarios/usuarios.mapeador.js';
import { AlmacenArchivos } from '../../src/comun/archivos/almacen-archivos.js';
import { Reloj } from '../../src/comun/reloj/reloj.js';

let ctx: AppDePrueba;
beforeAll(async () => {
  ctx = await crearApp();
});
afterAll(() => ctx.cerrar());

describe('AGENTS §5.2 — El esquema es estable en el motor', () => {
  it('después de sincronizar no queda ninguna consulta pendiente', async () => {
    const pendientes = await ctx.dataSource.driver.createSchemaBuilder().log();
    expect(pendientes.upQueries.map((q) => q.query)).toEqual([]);
  });
});

describe('AGENTS §10.4 — Las semillas de demo cumplen el contrato', () => {
  beforeAll(async () => {
    await sembrar(
      ctx.dataSource,
      ctx.app.get(AlmacenArchivos),
      ctx.app.get(Reloj),
    );
  });

  it('cada usuario sembrado es un Usuario del PRD', async () => {
    const usuarios = await ctx.dataSource.getRepository(Usuario).find();
    expect(usuarios.length).toBeGreaterThanOrEqual(USUARIOS_DEMO.length);
    for (const u of usuarios) esperarForma(aUsuario(u), 'Usuario');
  });

  it('ESPECIFICACION §8 — los ids y roles de los usuarios de demo', async () => {
    const porEmail = new Map(
      (await ctx.dataSource.getRepository(Usuario).find()).map((u) => [
        u.email,
        u,
      ]),
    );
    expect(porEmail.get('norma@mail.com')).toMatchObject({
      id: 'usr-084',
      nombre: 'Norma Pereyra',
      rol: 'vecino',
    });
    expect(porEmail.get('operador.norte@demo.ar')).toMatchObject({
      id: 'usr-003',
      rol: 'operador',
      zonaId: 'zon-norte',
    });
    expect(porEmail.get('operador.sur@demo.ar')).toMatchObject({
      rol: 'operador',
    });
    expect(porEmail.get('operador.sur@demo.ar')?.zonaId).not.toBe('zon-norte');
    expect(porEmail.get('nuevo@demo.ar')).toMatchObject({
      rol: 'vecino',
      zonaId: null,
    });
  });

  it('cada usuario de demo entra con su contraseña y /yo cumple el contrato', async () => {
    for (const { email } of USUARIOS_DEMO) {
      const ingreso = await ctx
        .http()
        .post('/auth/ingreso')
        .send({ email, contrasena: CONTRASENA_DEMO });
      expect(ingreso.status).toBe(200);
      const yo = await ctx
        .http()
        .get('/yo')
        .set('Authorization', `Bearer ${ingreso.body.datos.token}`);
      esperarContrato(yo, 'Usuario');
    }
  });

  it('ESPECIFICACION §8 — los catálogos sembrados cumplen el contrato y salen por la API', async () => {
    const op = await ctx
      .http()
      .post('/auth/ingreso')
      .send({ email: 'operador.norte@demo.ar', contrasena: CONTRASENA_DEMO });
    const auth = ['Authorization', `Bearer ${op.body.datos.token}`] as const;
    const tipos = await ctx.http().get('/tipos-de-reporte');
    esperarContrato(tipos, 'TipoDeReporte');
    expect(tipos.body.meta.total).toBe(8);
    const zonas = await ctx.http().get('/zonas');
    esperarContrato(zonas, 'Zona');
    expect(zonas.body.meta.total).toBe(4);
    const cuadrillas = await ctx
      .http()
      .get('/cuadrillas')
      .set(...auth);
    esperarContrato(cuadrillas, 'Cuadrilla');
    expect(
      cuadrillas.body.datos.find((c: { id: string }) => c.id === 'cua-02'),
    ).toMatchObject({ nombre: 'Cuadrilla 2 — Bacheo', zonaId: 'zon-norte' });
  });

  it('sembrar dos veces no duplica ni falla', async () => {
    const antes = await ctx.dataSource.getRepository(Usuario).count();
    await sembrar(
      ctx.dataSource,
      ctx.app.get(AlmacenArchivos),
      ctx.app.get(Reloj),
    );
    expect(await ctx.dataSource.getRepository(Usuario).count()).toBe(antes);
    expect(await ctx.dataSource.getRepository(Zona).count()).toBe(4);
    expect(await ctx.dataSource.getRepository(Cuadrilla).count()).toBe(9);
  });
});
