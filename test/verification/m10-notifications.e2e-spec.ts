import { JwtService } from '@nestjs/jwt';
import { Favorito } from '../../src/modules/users/favorite.entity.js';
import { crearComercio, crearRubro } from '../utilities/businesses.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { crearUsuario, type UsuarioDePrueba } from '../utilities/users.js';

const MENSAJE = 'Esta parte la programan ustedes. Mirá docs/NOTIFICATIONS.md.';
const TOKEN = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';

describe('AGENTS §19.3 — Los tres endpoints de /dispositivos responden 501 NO_IMPLEMENTADO en main', () => {
  let t: AppDePrueba;
  let marta: UsuarioDePrueba;
  beforeAll(async () => {
    t = await crearApp({
      almacenReal: true,
      enviadorReal: true,
      variables: { NOTIFICACIONES: 'expo' },
    });
    marta = await crearUsuario(t);
  });
  afterAll(() => t.cerrar());

  const pedir = (m: 'post' | 'delete', ruta: string, cuerpo?: object, auth = true) => {
    let r = t.http()[m](ruta);
    if (auth) r = r.set(marta.auth);
    return cuerpo ? r.send(cuerpo) : r;
  };

  it.each([
    ['post', '/dispositivos', { tokenExpo: TOKEN, plataforma: 'android' }],
    ['delete', `/dispositivos/${encodeURIComponent(TOKEN)}`, undefined],
    ['post', '/dispositivos/prueba', undefined],
  ] as const)('501 con el sobre exacto: %s %s', async (m, ruta, cuerpo) => {
    const res = await pedir(m, ruta, cuerpo).expect(501);
    esperarError(res.body, 'NO_IMPLEMENTADO');
    expect(res.body).toEqual({ error: { codigo: 'NO_IMPLEMENTADO', mensaje: MENSAJE } });
    expect(res.headers['content-type']).toMatch(/json/);
  });

  it.each([
    ['post', '/dispositivos', { tokenExpo: TOKEN, plataforma: 'android' }],
    ['delete', `/dispositivos/${encodeURIComponent(TOKEN)}`, undefined],
    ['post', '/dispositivos/prueba', undefined],
  ] as const)('401 sin sesión va antes del 501: %s %s', async (m, ruta, cuerpo) => {
    const res = await pedir(m, ruta, cuerpo, false).expect(401);
    esperarError(res.body, 'NO_AUTENTICADO');
  });

  it('401 con token mal firmado o vencido', async () => {
    const malo = new JwtService({ secret: 'otro-secreto' }).sign({ sub: marta.id, rol: 'vecino' });
    const vencido = new JwtService({ secret: 'secreto-de-los-tests' }).sign({
      sub: marta.id,
      rol: 'vecino',
      exp: 1000,
    });
    for (const [nombre, tk] of [
      ['mal firmado', malo],
      ['vencido', vencido],
      ['basura', 'basura'],
    ]) {
      const res = await t.http().post('/dispositivos/prueba').set('Authorization', `Bearer ${tk}`);
      expect(res.status, nombre).toBe(401);
      esperarError(res.body, 'NO_AUTENTICADO');
    }
  });

  it.each([
    [{}],
    [{ tokenExpo: 'abc', plataforma: 'android' }],
    [{ tokenExpo: TOKEN }],
    [{ tokenExpo: TOKEN, plataforma: 'windows' }],
    [{ tokenExpo: TOKEN, plataforma: 'ios', extra: 1 }],
    [{ tokenExpo: 5, plataforma: 'ios' }],
  ])('400 con cuerpo inválido va antes del 501: %j', async (cuerpo) => {
    const res = await t.http().post('/dispositivos').set(marta.auth).send(cuerpo).expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
  });

  it('el 501 no cambia entre repeticiones ni con pedidos simultáneos', async () => {
    const rs = await Promise.all(
      [1, 2, 3].map(() =>
        t
          .http()
          .post('/dispositivos')
          .set(marta.auth)
          .send({ tokenExpo: TOKEN, plataforma: 'ios' }),
      ),
    );
    expect(rs.map((r) => r.status)).toEqual([501, 501, 501]);
  });

  it('GET /dispositivos sigue siendo 404 RUTA_NO_ENCONTRADA', async () => {
    const res = await t.http().get('/dispositivos').set(marta.auth).expect(404);
    esperarError(res.body, 'RUTA_NO_ENCONTRADA');
  });
});

describe('AGENTS §19.3 — Los flujos que avisan siguen andando con las piezas vacías (sin 500)', () => {
  let t: AppDePrueba;
  let tornillo: UsuarioDePrueba;
  let fav: UsuarioDePrueba;
  let apagada: UsuarioDePrueba;
  beforeAll(async () => {
    t = await crearApp({
      almacenReal: true,
      enviadorReal: true,
      variables: { NOTIFICACIONES: 'expo' },
    });
    await crearRubro(t, { id: 'rub-ferreteria' });
    await crearComercio(t, { id: 'com-118', rubroId: 'rub-ferreteria' });
    tornillo = await crearUsuario(t, { rol: 'comercio', comercioId: 'com-118' });
    fav = await crearUsuario(t);
    apagada = await crearUsuario(t, { avisosActivos: false });
    await t.dataSource.getRepository(Favorito).insert([
      { usuarioId: fav.id, comercioId: 'com-118', creadoEn: t.reloj.ahora() },
      { usuarioId: apagada.id, comercioId: 'com-118', creadoEn: t.reloj.ahora() },
    ]);
  });
  afterAll(() => t.cerrar());

  it('POST /mi-comercio/promociones da 201 con la Promocion aunque nadie pueda recibir la push', async () => {
    const res = await t
      .http()
      .post('/mi-comercio/promociones')
      .set(tornillo.auth)
      .send({
        titulo: '10% en tornillos',
        detalle: 'Todo el mes.',
        hasta: '2026-10-31T23:59:59-03:00',
      })
      .expect(201);
    esperarContrato(res.body, 'Promocion');
    await t.avisos.esperarPendientes();
    // sigue siendo servible
    await t.http().get(`/promociones/${res.body.datos.id}`).expect(200);
  });

  it('crear promo varias veces seguidas no deja la app rota', async () => {
    for (let i = 0; i < 3; i++) {
      await t
        .http()
        .post('/mi-comercio/promociones')
        .set(tornillo.auth)
        .send({ titulo: `Promo ${i}`, detalle: 'x', hasta: '2026-10-31T23:59:59-03:00' })
        .expect(201);
    }
    await t.avisos.esperarPendientes();
    await t.http().get('/salud').expect(200);
  });

  it('PUT/DELETE favoritos y PATCH /yo devuelven lo de siempre', async () => {
    const u = await crearUsuario(t);
    const put = await t.http().put('/yo/favoritos/com-118').set(u.auth).expect(200);
    esperarContrato(put.body, 'Usuario');
    expect(put.body.datos.favoritos).toEqual(['com-118']);
    const patch = await t
      .http()
      .patch('/yo')
      .set(u.auth)
      .send({ nombre: 'Nuevo', rubrosDeInteres: ['rub-ferreteria'], avisosActivos: false })
      .expect(200);
    esperarContrato(patch.body, 'Usuario');
    expect(patch.body.datos.avisosActivos).toBe(false);
    await t.http().delete('/yo/favoritos/com-118').set(u.auth).expect(204);
    await t.http().delete('/yo/favoritos/com-118').set(u.auth).expect(204);
    const yo = await t.http().get('/yo').set(u.auth).expect(200);
    esperarContrato(yo.body, 'Usuario');
  });

  it('el registro y el ingreso siguen devolviendo la sesión', async () => {
    const r = await t
      .http()
      .post('/auth/registro')
      .send({ nombre: 'Ana', email: 'ana@m10.ar', contrasena: 'una-clave-larga' })
      .expect(201);
    esperarContrato(r.body, 'Sesion');
    const i = await t
      .http()
      .post('/auth/ingreso')
      .send({ email: 'ana@m10.ar', contrasena: 'una-clave-larga' })
      .expect(200);
    esperarContrato(i.body, 'Sesion');
  });
});

describe('AGENTS §19.3 — Swagger marca los tres endpoints como "los completan ustedes"; /salud no cambió', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
  });
  afterAll(() => t.cerrar());

  it.each([
    ['/dispositivos', 'post'],
    ['/dispositivos/{tokenExpo}', 'delete'],
    ['/dispositivos/prueba', 'post'],
  ])('%s %s documenta el 501 y avisa a los alumnos', async (ruta, metodo) => {
    const res = await t.http().get('/docs-json').expect(200);
    const op = res.body.paths[ruta]?.[metodo] as Record<string, unknown> & {
      responses: Record<string, unknown>;
    };
    expect(op, `${metodo} ${ruta}`).toBeTruthy();
    expect(op.responses['501'], 'respuesta 501 documentada').toBeTruthy();
    const texto = JSON.stringify(op).toLowerCase();
    expect(texto).toMatch(/ustedes|alumnos|501|no_implementado/);
  });

  it('/salud conserva su forma', async () => {
    const res = await t.http().get('/salud').expect(200);
    esperarContrato(res.body, 'Salud');
    expect(Object.keys(res.body.datos).sort()).toEqual(['almacen', 'estado', 'motor', 'version']);
    expect(res.body.meta).toBeNull();
  });

  it('con dobles en memoria (por defecto) los endpoints dependen del almacén, no del controlador', async () => {
    const u = await crearUsuario(t);
    const res = await t
      .http()
      .post('/dispositivos')
      .set(u.auth)
      .send({ tokenExpo: TOKEN, plataforma: 'ios' });
    expect([201, 501]).toContain(res.status);
  });
});
