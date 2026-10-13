import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { bearer, conSesion } from '../utilidades/usuarios.js';
import { crearSuministro } from '../utilidades/suministros.js';
import { crearRuta } from '../utilidades/rutas.js';

const TOKEN = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const MENSAJE = 'Esta parte la programan ustedes. Mirá docs/NOTIFICACIONES.md.';

describe('AGENTS §19.3 — /dispositivos responde 501 NO_IMPLEMENTADO con el sobre exacto', () => {
  let c: AppDePrueba;
  beforeAll(async () => (c = await crearApp({ almacenReal: true })));
  afterAll(() => c.cerrar());

  const casos: Array<['post' | 'delete', string, object | undefined]> = [
    ['post', '/dispositivos', { tokenExpo: TOKEN, plataforma: 'ios' }],
    ['post', '/dispositivos', { tokenExpo: TOKEN, plataforma: 'android' }],
    ['post', '/dispositivos/prueba', undefined],
    ['delete', `/dispositivos/${encodeURIComponent(TOKEN)}`, undefined],
  ];

  it.each(['lector', 'administracion'] as const)(
    'rol %s: cada endpoint da 501, sólo codigo y mensaje, sin cuerpo extra',
    async (rol) => {
      const u = await conSesion(c, rol);
      for (const [m, ruta, cuerpo] of casos) {
        const r = await c.http()[m](ruta).set(bearer(u.token)).send(cuerpo);
        expect(r.status, `${m} ${ruta}`).toBe(501);
        esperarError(r.body, 'NO_IMPLEMENTADO');
        expect(Object.keys(r.body)).toEqual(['error']);
        expect(Object.keys(r.body.error).sort()).toEqual(['codigo', 'mensaje']);
        expect(r.body.error.mensaje).toBe(MENSAJE);
      }
    },
  );

  it('sin token, con token mal firmado y con token basura: 401 NO_AUTENTICADO antes que el 501', async () => {
    const u = await conSesion(c, 'lector');
    const malFirmado =
      u.token.slice(0, -4) + (u.token.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    for (const [m, ruta, cuerpo] of casos) {
      for (const h of [
        {},
        bearer(malFirmado),
        bearer('basura'),
        { Authorization: u.token },
      ]) {
        const r = await c.http()[m](ruta).set(h).send(cuerpo);
        expect(r.status, `${m} ${ruta}`).toBe(401);
        esperarError(r.body, 'NO_AUTENTICADO');
      }
    }
  });

  it('token invalidado por /auth/salida: 401 también en /dispositivos', async () => {
    const u = await conSesion(c, 'lector');
    await c.http().post('/auth/salida').set(bearer(u.token)).expect(204);
    esperarError(
      (
        await c
          .http()
          .post('/dispositivos/prueba')
          .set(bearer(u.token))
          .expect(401)
      ).body,
      'NO_AUTENTICADO',
    );
  });

  it('token vencido (12 horas): 401', async () => {
    const u = await conSesion(c, 'lector');
    c.reloj.avanzar(13 * 3600 * 1000);
    const r = await c.http().post('/dispositivos/prueba').set(bearer(u.token));
    c.reloj.avanzar(-13 * 3600 * 1000);
    expect(r.status).toBe(401);
  });

  it.each([
    ['sin cuerpo', undefined],
    ['sin plataforma', { tokenExpo: TOKEN }],
    ['sin tokenExpo', { plataforma: 'ios' }],
    ['plataforma inválida', { tokenExpo: TOKEN, plataforma: 'windows' }],
    ['plataforma numérica', { tokenExpo: TOKEN, plataforma: 1 }],
    ['token vacío', { tokenExpo: '', plataforma: 'ios' }],
    ['token numérico', { tokenExpo: 123, plataforma: 'ios' }],
    ['token que no es de Expo', { tokenExpo: 'abc', plataforma: 'ios' }],
    [
      'campo de más',
      { tokenExpo: TOKEN, plataforma: 'ios', usuarioId: 'usr-1' },
    ],
    [
      'campo de más (password)',
      { tokenExpo: TOKEN, plataforma: 'ios', password: 'x' },
    ],
  ])(
    'POST /dispositivos %s → 400 VALIDACION_FALLIDA, no 501',
    async (_n, cuerpo) => {
      const u = await conSesion(c, 'lector');
      const r = await c
        .http()
        .post('/dispositivos')
        .set(bearer(u.token))
        .send(cuerpo);
      expect(r.status).toBe(400);
      esperarError(r.body, 'VALIDACION_FALLIDA');
      expect(r.body.error.mensaje).not.toMatch(
        /must|should|property|undefined/i,
      );
    },
  );

  it('el 400 va antes que el 501 también para un lector sin dispositivos y para administración', async () => {
    const u = await conSesion(c, 'administracion');
    expect(
      (
        await c
          .http()
          .post('/dispositivos')
          .set(bearer(u.token))
          .send({ tokenExpo: 'x', plataforma: 'ios' })
      ).status,
    ).toBe(400);
  });

  it('DELETE con un token malformado: nunca 500 (400 o 501)', async () => {
    const u = await conSesion(c, 'lector');
    const r = await c.http().delete('/dispositivos/abc').set(bearer(u.token));
    expect([400, 501]).toContain(r.status);
    esperarError(r.body);
  });

  it('métodos no previstos (GET/PUT /dispositivos) no dan 501 ni 500', async () => {
    const u = await conSesion(c, 'lector');
    const g = await c.http().get('/dispositivos').set(bearer(u.token));
    expect(g.status).toBeGreaterThanOrEqual(400);
    expect(g.status).toBeLessThan(500);
    esperarError(g.body);
  });

  it('el 501 no se cachea entre pedidos ni cambia por pedidos repetidos', async () => {
    const u = await conSesion(c, 'lector');
    const rs = await Promise.all(
      Array.from({ length: 5 }, () =>
        c
          .http()
          .post('/dispositivos')
          .set(bearer(u.token))
          .send({ tokenExpo: TOKEN, plataforma: 'ios' }),
      ),
    );
    for (const r of rs) expect(r.status).toBe(501);
  });
});

describe('AGENTS §19.3 — los flujos que avisan siguen andando con los puertos vacíos', () => {
  let c: AppDePrueba;
  let admin: { id: string; token: string };
  let a: { id: string; token: string };
  let b: { id: string; token: string };
  beforeAll(async () => {
    // Almacén y enviador reales de `main` (los que dejan a los alumnos), NOTIFICACIONES=expo.
    c = await crearApp({
      almacenReal: true,
      entorno: { NOTIFICACIONES: 'expo' },
    });
    admin = await conSesion(c, 'administracion');
    a = await conSesion(c, 'lector');
    b = await conSesion(c, 'lector');
  });
  afterAll(() => c.cerrar());

  it('POST /rutas con lector asignado → 201 con la Ruta del contrato', async () => {
    const s = (await crearSuministro(c)).suministro.id;
    const r = await c
      .http()
      .post('/rutas')
      .set(bearer(admin.token))
      .send({
        numero: '41',
        nombre: 'Zona',
        bimestre: '2026-05',
        lectorId: a.id,
        suministroIds: [s],
      });
    expect(r.status).toBe(201);
    esperarContrato(r.body, 'Ruta');
    await c.avisos.esperarPendientes();
    expect(c.enviador.enviados).toEqual([]);
  });

  it('PATCH /rutas cambiando de lector (en_curso) → 200', async () => {
    const ruta = await crearRuta(c, {
      lectorId: a.id,
      estado: 'en_curso',
      cantidad: 1,
    });
    const r = await c
      .http()
      .patch(`/rutas/${ruta.id}`)
      .set(bearer(admin.token))
      .send({ lectorId: b.id });
    expect(r.status).toBe(200);
    esperarContrato(r.body, 'Ruta');
    expect(r.body.datos.lectorId).toBe(b.id);
    await c.avisos.esperarPendientes();
  });

  it('PATCH /rutas sin cambiar de lector → 200', async () => {
    const ruta = await crearRuta(c, { lectorId: a.id, cantidad: 1 });
    const r = await c
      .http()
      .patch(`/rutas/${ruta.id}`)
      .set(bearer(admin.token))
      .send({ nombre: 'Otro nombre' });
    expect(r.status).toBe(200);
    esperarContrato(r.body, 'Ruta');
  });

  it('los errores de negocio de /rutas siguen iguales (409 RUTA_YA_EXISTE)', async () => {
    const s = (await crearSuministro(c)).suministro.id;
    const cuerpo = {
      numero: '41',
      nombre: 'Zona',
      bimestre: '2026-05',
      lectorId: a.id,
      suministroIds: [s],
    };
    const r = await c
      .http()
      .post('/rutas')
      .set(bearer(admin.token))
      .send(cuerpo);
    expect(r.status).toBe(409);
    esperarError(r.body, 'RUTA_YA_EXISTE');
  });

  it('el lector ve la ruta asignada en /yo/rutas y /yo sigue con su forma', async () => {
    const r = await c.http().get('/yo/rutas').set(bearer(a.token)).expect(200);
    esperarContrato(r.body, 'Ruta');
    esperarContrato(
      (await c.http().get('/yo').set(bearer(a.token)).expect(200)).body,
      'Usuario',
    );
  });

  it('/salud sigue sano con NOTIFICACIONES=expo y sin implementación', async () => {
    const r = await c.http().get('/salud').expect(200);
    expect(r.body.datos.estado).toBe('ok');
  });

  it('POST /auth/ingreso y /auth/salida siguen igual', async () => {
    const u = await conSesion(c, 'lector');
    await c.http().post('/auth/salida').set(bearer(u.token)).expect(204);
  });
});

describe('AGENTS §19.2 — con los dobles en memoria, Avisos decide a quién y qué (regla de negocio intacta)', () => {
  let c: AppDePrueba;
  beforeAll(async () => (c = await crearApp()));
  afterAll(() => c.cerrar());

  it('asignar una ruta: sólo el lector nuevo recibe la push, con el texto de §9', async () => {
    const admin = await conSesion(c, 'administracion');
    const a = await conSesion(c, 'lector');
    const b = await conSesion(c, 'lector');
    await c.almacenTokens.guardar(
      a.id,
      'ExponentPushToken[aaaaaaaaaaaaaaaa]',
      'ios',
    );
    await c.almacenTokens.guardar(
      b.id,
      'ExponentPushToken[bbbbbbbbbbbbbbbb]',
      'ios',
    );
    await c.almacenTokens.guardar(
      admin.id,
      'ExponentPushToken[cccccccccccccccc]',
      'ios',
    );
    const s = (await crearSuministro(c)).suministro.id;
    await c
      .http()
      .post('/rutas')
      .set(bearer(admin.token))
      .send({
        numero: '07',
        nombre: 'Barrio Brasil',
        bimestre: '2026-05',
        lectorId: b.id,
        suministroIds: [s],
      })
      .expect(201);
    await c.avisos.esperarPendientes();
    expect(c.enviador.enviados).toHaveLength(1);
    expect(c.enviador.enviados[0].tokens).toEqual([
      'ExponentPushToken[bbbbbbbbbbbbbbbb]',
    ]);
    expect(c.enviador.enviados[0].cuerpo).toBe(
      'Tenés una ruta nueva: 07 Barrio Brasil.',
    );
  });

  it('un error del almacén o del enviador no rompe el pedido', async () => {
    const admin = await conSesion(c, 'administracion');
    const a = await conSesion(c, 'lector');
    const original = c.almacenTokens.tokensDe.bind(c.almacenTokens);
    c.almacenTokens.tokensDe = async () => {
      throw new Error('se cayó');
    };
    const s = (await crearSuministro(c)).suministro.id;
    const r = await c
      .http()
      .post('/rutas')
      .set(bearer(admin.token))
      .send({
        numero: '08',
        nombre: 'X',
        bimestre: '2026-05',
        lectorId: a.id,
        suministroIds: [s],
      });
    c.almacenTokens.tokensDe = original;
    expect(r.status).toBe(201);
  });
});

describe('Swagger — /dispositivos documentado como parte de los alumnos', () => {
  let c: AppDePrueba;
  beforeAll(async () => (c = await crearApp()));
  afterAll(() => c.cerrar());

  it('/docs-json lista los tres endpoints y menciona 501', async () => {
    const r = await c.http().get('/docs-json');
    if (r.status !== 200) return;
    const paths = r.body.paths as Record<
      string,
      Record<string, { responses?: Record<string, unknown> }>
    >;
    expect(paths['/dispositivos']?.post).toBeDefined();
    expect(paths['/dispositivos/prueba']?.post).toBeDefined();
    expect(paths['/dispositivos/{tokenExpo}']?.delete).toBeDefined();
    for (const op of [
      paths['/dispositivos'].post,
      paths['/dispositivos/prueba'].post,
      paths['/dispositivos/{tokenExpo}'].delete,
    ])
      expect(Object.keys(op.responses ?? {})).toContain('501');
  });
});
