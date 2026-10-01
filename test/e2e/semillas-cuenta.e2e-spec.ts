import { CONTRASENA_DE_DEMO } from '../../src/semillas/datos/usuarios.js';
import { sembrar } from '../../src/semillas/sembrar.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato } from '../utilidades/contrato.js';

// Espec. §8: usuarios de demo y sus favoritos. AGENTS §10.4: cada registro cumple el contrato.

let ctx: AppDePrueba;
beforeAll(async () => {
  ctx = await crearApp();
  await sembrar(ctx.dataSource, ctx.reloj);
});
afterAll(() => ctx.cerrar());

async function ingresar(email: string) {
  const r = await ctx.http
    .post('/auth/ingreso')
    .send({ email, contrasena: CONTRASENA_DE_DEMO })
    .expect(200);
  esperarContrato(r.body, 'Sesion');
  return r.body.datos.usuario;
}

describe('Espec. §8 — usuarios de demo', () => {
  it('Julián Ferrari (usr-320) tiene lin-05 y par-101 como favoritas, como en el PRD', async () => {
    expect(await ingresar('julian@mail.com')).toEqual({
      id: 'usr-320',
      nombre: 'Julián Ferrari',
      email: 'julian@mail.com',
      lineasFavoritas: ['lin-05'],
      paradasFavoritas: ['par-101'],
      avisosActivos: true,
      tema: 'sistema',
    });
  });

  it('nuevo@demo.ar no tiene nada (lista vacía)', async () => {
    const u = await ingresar('nuevo@demo.ar');
    expect(u.lineasFavoritas).toEqual([]);
    expect(u.paradasFavoritas).toEqual([]);
  });

  it('la Dirección entra y no tiene favoritos', async () => {
    const u = await ingresar('transporte@parana.demo.ar');
    expect(u.lineasFavoritas).toEqual([]);
  });
});
