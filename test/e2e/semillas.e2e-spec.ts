import { Sembrador } from '../../src/semillas/sembrar.js';
import { USUARIOS } from '../../src/semillas/datos/usuarios.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato } from '../utilidades/contrato.js';
import { bearer, ingresar } from '../utilidades/usuarios.js';

describe('ESPECIFICACION §8 — Semillas: los usuarios de la app de clase', () => {
  let c: AppDePrueba;
  let token: string;
  beforeAll(async () => {
    c = await crearApp();
    const sembrador = c.app.get(Sembrador);
    expect(await sembrador.estaVacia()).toBe(true);
    await sembrador.sembrar();
    expect(await sembrador.estaVacia()).toBe(false);
    token = await ingresar(c, { legajo: 'L-030', contrasena: 'lectura' });
  });
  afterAll(() => c.cerrar());

  it('cada usuario sembrado cumple el contrato y tiene los datos del mock', async () => {
    const r = await c
      .http()
      .get('/usuarios?porPagina=100')
      .set(bearer(token))
      .expect(200);
    esperarContrato(r.body, 'Usuario');
    expect(r.body.meta.total).toBe(20);
    expect(r.body.datos).toEqual(
      USUARIOS.map((u) => ({
        id: u.id,
        legajo: u.legajo,
        nombre: u.nombre,
        rol: u.rol,
        biometriaActiva: u.biometriaActiva,
        rutasAsignadas: [],
      })),
    );
  });

  it('usr-011 Ramón Duarte (L-011) es lector y usr-030 Laura Vidal (L-030) es administración', async () => {
    const ramon = await c
      .http()
      .post('/auth/ingreso')
      .send({ legajo: 'L-011', contrasena: 'lectura' })
      .expect(200);
    expect(ramon.body.datos.usuario).toMatchObject({
      id: 'usr-011',
      nombre: 'Ramón Duarte',
      rol: 'lector',
      biometriaActiva: true,
    });
    const laura = await c.http().get('/yo').set(bearer(token)).expect(200);
    expect(laura.body.datos).toMatchObject({
      id: 'usr-030',
      nombre: 'Laura Vidal',
      rol: 'administracion',
    });
  });

  it('todos ingresan con la contraseña de demo "lectura"', async () => {
    for (const u of USUARIOS)
      await ingresar(c, { legajo: u.legajo, contrasena: 'lectura' });
  });
});
