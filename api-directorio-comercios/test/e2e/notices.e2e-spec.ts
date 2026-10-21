import { Favorito } from '../../src/modules/users/favorite.entity.js';
import { RubroDeInteres } from '../../src/modules/users/interest-category.entity.js';
import { crearComercio, crearRubro } from '../utilities/businesses.js';
import { esperarError } from '../utilities/contract.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { AlmacenTokensMemoria } from '../utilities/push-doubles.js';
import { crearUsuario, type UsuarioDePrueba } from '../utilities/users.js';

describe('PRD §7 — Avisos: push por promo nueva de un favorito o de un rubro de interés', () => {
  let t: AppDePrueba;
  let tornillo: UsuarioDePrueba;
  let otro: UsuarioDePrueba;
  let favorita: UsuarioDePrueba;
  let interesada: UsuarioDePrueba;
  let ambas: UsuarioDePrueba;
  let apagada: UsuarioDePrueba;
  let ajena: UsuarioDePrueba;

  const registrar = (u: UsuarioDePrueba, token: string) =>
    t.almacen.guardar(u.id, token, 'android');

  beforeAll(async () => {
    t = await crearApp();
    await crearRubro(t, { id: 'rub-ferreteria' });
    await crearRubro(t, { id: 'rub-gastro' });
    await crearComercio(t, {
      id: 'com-118',
      nombre: 'Ferretería El Tornillo',
      rubroId: 'rub-ferreteria',
    });
    await crearComercio(t, { id: 'com-201', nombre: 'Panadería Otra', rubroId: 'rub-gastro' });
    tornillo = await crearUsuario(t, { rol: 'comercio', comercioId: 'com-118' });
    otro = await crearUsuario(t, { rol: 'comercio', comercioId: 'com-201' });
    favorita = await crearUsuario(t);
    interesada = await crearUsuario(t);
    ambas = await crearUsuario(t);
    apagada = await crearUsuario(t, { avisosActivos: false });
    ajena = await crearUsuario(t);
    const ahora = t.reloj.ahora();
    await t.dataSource.getRepository(Favorito).insert([
      { usuarioId: favorita.id, comercioId: 'com-118', creadoEn: ahora },
      { usuarioId: ambas.id, comercioId: 'com-118', creadoEn: ahora },
      { usuarioId: apagada.id, comercioId: 'com-118', creadoEn: ahora },
      { usuarioId: ajena.id, comercioId: 'com-201', creadoEn: ahora },
    ]);
    await t.dataSource.getRepository(RubroDeInteres).insert([
      { usuarioId: interesada.id, rubroId: 'rub-ferreteria', posicion: 0 },
      { usuarioId: ambas.id, rubroId: 'rub-ferreteria', posicion: 0 },
      { usuarioId: apagada.id, rubroId: 'rub-ferreteria', posicion: 0 },
      { usuarioId: ajena.id, rubroId: 'rub-gastro', posicion: 0 },
    ]);
    for (const [u, tok] of [
      [favorita, 'ExponentPushToken[fav]'],
      [interesada, 'ExponentPushToken[int]'],
      [ambas, 'ExponentPushToken[amb]'],
      [apagada, 'ExponentPushToken[apa]'],
      [ajena, 'ExponentPushToken[aje]'],
      [tornillo, 'ExponentPushToken[tor]'],
    ] as const) {
      await registrar(u, tok);
    }
  });
  afterAll(() => t.cerrar());
  beforeEach(() => t.enviador.limpiar());

  const crear = (u: UsuarioDePrueba, titulo = '15% en pinturas') =>
    t
      .http()
      .post('/mi-comercio/promociones')
      .set(u.auth)
      .send({ titulo, detalle: 'Todas las marcas.', hasta: '2026-10-31T23:59:59-03:00' });

  it('avisa a favoritos y a interesados en el rubro, una sola push por persona', async () => {
    const res = await crear(tornillo).expect(201);
    await t.avisos.esperarPendientes();
    const tokens = t.enviador.enviados.flatMap((m) => m.tokens).sort();
    expect(tokens).toEqual(
      ['ExponentPushToken[amb]', 'ExponentPushToken[fav]', 'ExponentPushToken[int]'].sort(),
    );
    expect(t.enviador.enviados).toHaveLength(1);
    expect(t.enviador.enviados[0]).toMatchObject({
      titulo: 'Ferretería El Tornillo',
      cuerpo: 'Nueva promoción: 15% en pinturas',
      datos: { tipo: 'promocion', promocionId: res.body.datos.id, comercioId: 'com-118' },
    });
  });

  it('no avisa a quien tiene los avisos apagados, ni a quien no sigue ni al comercio', async () => {
    await crear(tornillo).expect(201);
    await t.avisos.esperarPendientes();
    const tokens = t.enviador.enviados.flatMap((m) => m.tokens);
    expect(tokens).not.toContain('ExponentPushToken[apa]');
    expect(tokens).not.toContain('ExponentPushToken[aje]');
    expect(tokens).not.toContain('ExponentPushToken[tor]');
  });

  it('la promo de otro rubro avisa sólo a sus seguidores', async () => {
    await crear(otro, 'Docena de facturas').expect(201);
    await t.avisos.esperarPendientes();
    expect(t.enviador.enviados.flatMap((m) => m.tokens)).toEqual(['ExponentPushToken[aje]']);
  });

  it('un pedido inválido no avisa a nadie', async () => {
    const res = await t
      .http()
      .post('/mi-comercio/promociones')
      .set(tornillo.auth)
      .send({
        titulo: 'Promo vieja',
        detalle: 'Ya terminó.',
        desde: '2020-01-01T00:00:00-03:00',
        hasta: '2020-02-01T00:00:00-03:00',
      })
      .expect(422);
    esperarError(res.body);
    await t.avisos.esperarPendientes();
    expect(t.enviador.enviados).toEqual([]);
  });

  it('un error del enviador no rompe la creación', async () => {
    t.enviador.fallarCon = new Error('Expo caído');
    const res = await crear(tornillo).expect(201);
    await t.avisos.esperarPendientes();
    const lista = await t.http().get('/mi-comercio/promociones').set(tornillo.auth).expect(200);
    expect(lista.body.datos.map((p: { id: string }) => p.id)).toContain(res.body.datos.id);
  });

  it('editar o dar de baja una promo no manda avisos', async () => {
    const res = await crear(tornillo).expect(201);
    await t.avisos.esperarPendientes();
    t.enviador.limpiar();
    await t
      .http()
      .patch(`/mi-comercio/promociones/${res.body.datos.id}`)
      .set(tornillo.auth)
      .send({ titulo: 'Otro título' })
      .expect(200);
    await t
      .http()
      .delete(`/mi-comercio/promociones/${res.body.datos.id}`)
      .set(tornillo.auth)
      .expect(204);
    await t.avisos.esperarPendientes();
    expect(t.enviador.enviados).toEqual([]);
  });

  it('token inválido según Expo: se descarta y no se reintenta', async () => {
    t.enviador.invalidos.add('ExponentPushToken[fav]');
    await crear(tornillo).expect(201);
    await t.avisos.esperarPendientes();
    t.enviador.limpiar();
    await crear(tornillo).expect(201);
    await t.avisos.esperarPendientes();
    expect(t.enviador.enviados.flatMap((m) => m.tokens)).not.toContain('ExponentPushToken[fav]');
  });
});

describe('Avisos con los dobles en memoria de los puertos', () => {
  it('el almacén en memoria devuelve los tokens de los usuarios pedidos', async () => {
    const a = new AlmacenTokensMemoria();
    await a.guardar('usr-1', 'T1', 'ios');
    expect(await a.tokensDe(['usr-1', 'usr-2'])).toEqual(['T1']);
  });
});
