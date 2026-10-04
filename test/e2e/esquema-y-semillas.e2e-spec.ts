// AGENTS §5.2 y §10.4: el esquema queda estable después de sincronizar, y cada
// registro sembrado cumple el contrato. Corre en los cuatro motores.
import type { Sesion } from '../../contrato/api.js';
import type { Usuario } from '../../contrato/tipos.js';
import {
  CONTRASENA_DEMO,
  USUARIOS,
} from '../../src/semillas/datos/usuarios.js';
import { sembrar } from '../../src/semillas/sembrar.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato } from '../utilidades/contrato.js';

describe('AGENTS §5.2 — Estabilidad del esquema', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
  });
  afterAll(() => a.cerrar());

  it('después de sincronizar no queda ninguna consulta pendiente', async () => {
    const pendientes = await a.dataSource.driver.createSchemaBuilder().log();
    expect(pendientes.upQueries.map((q) => q.query)).toEqual([]);
  });
});

describe('ESPECIFICACION §8 — Usuarios de demo', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
    await sembrar(a.dataSource, a.reloj);
  });
  afterAll(() => a.cerrar());

  it.each(USUARIOS.map((u) => [u.email, u] as const))(
    '%s ingresa y su /yo cumple el contrato',
    async (email, semilla) => {
      const ingreso = await a
        .http()
        .post('/auth/ingreso')
        .send({ email, contrasena: CONTRASENA_DEMO })
        .expect(200);
      const { token } = esperarContrato<Sesion>(ingreso.body, 'Sesion');
      const res = await a
        .http()
        .get('/yo')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const usuario = esperarContrato<Usuario>(res.body, 'Usuario');
      expect(usuario).toMatchObject({
        id: semilla.id,
        rol: semilla.rol,
        nombre: semilla.nombre,
      });
    },
  );

  it('usr-207 es el Emiliano Ruiz del PRD, con una cancelación tardía', async () => {
    const ingreso = await a
      .http()
      .post('/auth/ingreso')
      .send({ email: 'emiliano@mail.com', contrasena: CONTRASENA_DEMO });
    expect(ingreso.body.datos.usuario).toMatchObject({
      id: 'usr-207',
      nombre: 'Emiliano Ruiz',
      email: 'emiliano@mail.com',
      telefono: '3455-401122',
      rol: 'jugador',
      cancelacionesTardias: 1,
      ausencias: 0,
    });
  });

  it('hay un jugador, un encargado y un administrador al menos', () => {
    expect(new Set(USUARIOS.map((u) => u.rol))).toEqual(
      new Set(['jugador', 'encargado', 'administrador']),
    );
  });
});

describe('AGENTS §16.2 — SEMBRAR_SI_VACIA', () => {
  it('con la base vacía, siembra al arrancar', async () => {
    const a = await crearApp({ entorno: { SEMBRAR_SI_VACIA: 'true' } });
    try {
      await a
        .http()
        .post('/auth/ingreso')
        .send({
          email: 'nahuel@villaguay.demo.ar',
          contrasena: CONTRASENA_DEMO,
        })
        .expect(200);
    } finally {
      await a.cerrar();
    }
  });

  it('sin la variable, la base queda vacía', async () => {
    const a = await crearApp();
    try {
      await a
        .http()
        .post('/auth/ingreso')
        .send({
          email: 'nahuel@villaguay.demo.ar',
          contrasena: CONTRASENA_DEMO,
        })
        .expect(401);
    } finally {
      await a.cerrar();
    }
  });
});
