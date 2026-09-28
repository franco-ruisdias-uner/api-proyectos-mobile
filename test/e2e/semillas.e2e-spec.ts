import { crearApp, type AppDePrueba } from '../utilidades/crear-app.js';
import { esperarContrato } from '../utilidades/contrato.js';
import { conSesion } from '../utilidades/builders.js';
import { Sembrador } from '../../src/semillas/sembrador.js';
import { USUARIOS_SEMILLA } from '../../src/semillas/datos/usuarios.js';

describe('AGENTS §10.4 — Los datos de demo cumplen el contrato', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
    await ctx.app.get(Sembrador).sembrar();
  });
  afterAll(() => ctx.cerrar());

  it.each(USUARIOS_SEMILLA.map((u) => [u.email, u]))(
    '%s ingresa con su contraseña de demo',
    async (_email, u) => {
      const ingreso = await ctx
        .http()
        .post('/auth/ingreso')
        .send({ email: u.email, contrasena: u.contrasena })
        .expect(200);
      esperarContrato(ingreso.body, 'Sesion');
      const yo = await ctx.http().get('/yo').set(conSesion(ingreso.body.datos.token)).expect(200);
      esperarContrato(yo.body, 'Usuario');
      expect(yo.body.datos.id).toBe(u.id);
    },
  );

  it('especificación §8 — usr-201 es Lucía Méndez, como en el PRD', async () => {
    const ingreso = await ctx
      .http()
      .post('/auth/ingreso')
      .send({ email: 'lucia@mail.com', contrasena: 'lucia1234' });
    expect(ingreso.body.datos.usuario).toMatchObject({
      id: 'usr-201',
      nombre: 'Lucía Méndez',
      email: 'lucia@mail.com',
      avatarUrl: null,
      preferencias: {
        categoriasFavoritas: ['cat-museos', 'cat-playas'],
        avisarProximidad: true,
        radioAvisoMetros: 250,
        tema: 'sistema',
      },
    });
  });

  it('sembrar sólo si está vacía: no duplica', async () => {
    expect(await ctx.app.get(Sembrador).estaVacia()).toBe(false);
  });
});
