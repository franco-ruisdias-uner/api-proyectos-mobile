import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { bearer, conSesion } from '../utilities/users.js';
import { crearSuministro } from '../utilities/supplies.js';
import { crearRuta } from '../utilities/routes.js';

const TOKEN_A = 'ExponentPushToken[lectorAAAAAAAAAAAAAAAA]';
const TOKEN_B = 'ExponentPushToken[lectorBBBBBBBBBBBBBBBB]';
const TOKEN_ADMIN = 'ExponentPushToken[adminAAAAAAAAAAAAAAAAA]';

describe('M6 — Avisos: push al lector cuando se le asigna una ruta (Especificación §9, D17)', () => {
  let c: AppDePrueba;
  let a: { id: string; token: string };
  let b: { id: string; token: string };
  let admin: { id: string; token: string };
  let s: string[];
  let siguiente = 0;
  const tomar = (n: number) => s.slice(siguiente, (siguiente += n));

  beforeAll(async () => {
    c = await crearApp();
    a = await conSesion(c, 'lector');
    b = await conSesion(c, 'lector');
    admin = await conSesion(c, 'administracion');
    s = [];
    for (let i = 0; i < 20; i++)
      s.push((await crearSuministro(c)).suministro.id);
    for (const [u, tokenExpo] of [
      [a, TOKEN_A],
      [b, TOKEN_B],
      [admin, TOKEN_ADMIN],
    ] as const)
      await c.almacenTokens.guardar(u.id, tokenExpo, 'android');
  });
  afterAll(() => c.cerrar());
  beforeEach(() => c.enviador.limpiar());

  const crear = (extra: Record<string, unknown> = {}) =>
    c
      .http()
      .post('/rutas')
      .set(bearer(admin.token))
      .send({
        numero: '07',
        nombre: 'Barrio Brasil',
        bimestre: '2026-05',
        lectorId: a.id,
        suministroIds: tomar(2),
        ...extra,
      });
  const parchar = (id: string, body: object) =>
    c.http().patch(`/rutas/${id}`).set(bearer(admin.token)).send(body);

  it('alta de ruta: el lector recibe "Tenés una ruta nueva: 07 Barrio Brasil." y nadie más', async () => {
    await crear().expect(201);
    await c.avisos.esperarPendientes();
    expect(c.enviador.enviados).toEqual([
      {
        tokens: [TOKEN_A],
        titulo: 'Ruta nueva',
        cuerpo: 'Tenés una ruta nueva: 07 Barrio Brasil.',
        datos: { tipo: 'ruta_nueva', rutaId: 'rut-07-2026-05' },
      },
    ]);
  });

  it('una alta rechazada no avisa', async () => {
    await crear({ numero: '07' }).expect(409);
    await crear({ numero: '08', lectorId: 'usr-noexiste' }).expect(422);
    await c.avisos.esperarPendientes();
    expect(c.enviador.enviados).toEqual([]);
  });

  it('cambio de lector: avisa sólo al lector nuevo', async () => {
    const ruta = await crearRuta(c, {
      numero: '30',
      nombre: 'Centro',
      lectorId: a.id,
      suministroIds: tomar(2),
    });
    await parchar(ruta.id, { lectorId: b.id }).expect(200);
    await c.avisos.esperarPendientes();
    expect(c.enviador.enviados).toHaveLength(1);
    expect(c.enviador.enviados[0]).toMatchObject({
      tokens: [TOKEN_B],
      cuerpo: 'Tenés una ruta nueva: 30 Centro.',
      datos: { rutaId: ruta.id },
    });
  });

  it('editar otra cosa, o "cambiar" al mismo lector, no avisa', async () => {
    const ruta = await crearRuta(c, {
      numero: '31',
      lectorId: a.id,
      suministroIds: tomar(2),
    });
    await parchar(ruta.id, { nombre: 'Otro nombre' }).expect(200);
    await parchar(ruta.id, { lectorId: a.id }).expect(200);
    await c.avisos.esperarPendientes();
    expect(c.enviador.enviados).toEqual([]);
  });

  it('el aviso usa el nombre nuevo si el mismo pedido también lo cambia', async () => {
    const ruta = await crearRuta(c, {
      numero: '32',
      nombre: 'Viejo',
      lectorId: a.id,
      suministroIds: tomar(2),
    });
    await parchar(ruta.id, { lectorId: b.id, nombre: 'Nuevo' }).expect(200);
    await c.avisos.esperarPendientes();
    expect(c.enviador.enviados[0].cuerpo).toBe(
      'Tenés una ruta nueva: 32 Nuevo.',
    );
  });

  it('un lector sin dispositivos registrados: la ruta se crea igual y no se manda nada', async () => {
    const sinToken = await conSesion(c, 'lector');
    await crear({ numero: '09', lectorId: sinToken.id }).expect(201);
    await c.avisos.esperarPendientes();
    expect(c.enviador.enviados).toEqual([]);
  });

  it('si Expo falla, el pedido igual responde 201 y la ruta existe', async () => {
    c.enviador.fallar = true;
    await crear({ numero: '10' }).expect(201);
    await c.avisos.esperarPendientes();
    await c
      .http()
      .get('/rutas/rut-10-2026-05')
      .set(bearer(a.token))
      .expect(200);
  });

  it('un token que Expo marca inválido se descarta', async () => {
    c.enviador.invalidos.add(TOKEN_B);
    await crear({ numero: '11', lectorId: b.id }).expect(201);
    await c.avisos.esperarPendientes();
    c.enviador.limpiar();
    await crear({ numero: '12', lectorId: b.id }).expect(201);
    await c.avisos.esperarPendientes();
    expect(c.enviador.enviados).toEqual([]);
  });
});
