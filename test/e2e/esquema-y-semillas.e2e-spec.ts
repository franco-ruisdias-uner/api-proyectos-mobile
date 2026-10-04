// AGENTS §5.2 y §10.4: el esquema queda estable después de sincronizar, y cada
// registro sembrado cumple el contrato. Corre en los cuatro motores.
import type { Sesion } from '../../contrato/api.js';
import type { Deporte, Espacio, Usuario } from '../../contrato/tipos.js';
import {
  CONTRASENA_DEMO,
  USUARIOS,
} from '../../src/semillas/datos/usuarios.js';
import { DEPORTES, ESPACIOS } from '../../src/semillas/datos/espacios.js';
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

describe('ESPECIFICACION §8 — Espacios de demo', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
    await sembrar(a.dataSource, a.reloj);
  });
  afterAll(() => a.cerrar());

  it('los deportes sembrados cumplen el contrato', async () => {
    const res = await a.http().get('/deportes').expect(200);
    const datos = esperarContrato<Deporte[]>(res.body, 'Deporte');
    expect(datos.map((d) => d.id)).toEqual(DEPORTES.map((d) => d.id).sort());
  });

  it('los once espacios sembrados cumplen el contrato, cada uno por su detalle', async () => {
    expect(ESPACIOS).toHaveLength(11);
    for (const semilla of ESPACIOS) {
      const res = await a.http().get(`/espacios/${semilla.id}`).expect(200);
      esperarContrato<Espacio>(res.body, 'Espacio');
    }
  });

  it('esp-02 es la «Cancha 2 — Fútbol 5» del PRD y dep-futbol5 existe', async () => {
    const res = await a.http().get('/espacios/esp-02').expect(200);
    expect(res.body.datos).toMatchObject({
      id: 'esp-02',
      nombre: 'Cancha 2 — Fútbol 5',
      deporteId: 'dep-futbol5',
      iluminacion: true,
    });
  });

  it('la distribución del PRD: 2 fútbol 5, 1 fútbol 11, 3 básquet, 2 vóley, 2 tenis y 1 gimnasio', async () => {
    const res = await a.http().get('/espacios?porPagina=100').expect(200);
    const porDeporte = new Map<string, number>();
    for (const e of res.body.datos as Espacio[])
      porDeporte.set(e.deporteId, (porDeporte.get(e.deporteId) ?? 0) + 1);
    expect(Object.fromEntries(porDeporte)).toEqual({
      'dep-futbol5': 2,
      'dep-futbol11': 1,
      'dep-basquet': 3,
      'dep-voley': 2,
      'dep-tenis': 2,
      'dep-gimnasio': 1,
    });
  });

  it('los de Parque Berduc son tenis y el gimnasio es techado', async () => {
    const res = await a
      .http()
      .get('/espacios?complejo=parque berduc')
      .expect(200);
    expect(res.body.datos.map((e: Espacio) => e.deporteId)).toEqual([
      'dep-tenis',
      'dep-tenis',
    ]);
    const techados = await a
      .http()
      .get('/espacios?techado=true&deporteId=dep-gimnasio')
      .expect(200);
    expect(techados.body.meta.total).toBe(1);
  });

  it('hay un espacio sin video (videoUrl: null)', async () => {
    const res = await a.http().get('/espacios/esp-01').expect(200);
    expect(res.body.datos.videoUrl).toBeNull();
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
