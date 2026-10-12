import type { Ruta } from '../../contrato/tipos.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearRuta } from '../utilidades/rutas.js';
import { crearSuministro } from '../utilidades/suministros.js';
import { bearer, conSesion, crearUsuario } from '../utilidades/usuarios.js';

const ids = (cuerpo: { datos: { id: string }[] }) =>
  cuerpo.datos.map((d) => d.id);

describe('M2 — GET /yo/rutas y Usuario.rutasAsignadas', () => {
  let c: AppDePrueba;
  let lector: { id: string; token: string };
  let otro: { id: string; token: string };
  let admin: { token: string };
  beforeAll(async () => {
    c = await crearApp();
    lector = await conSesion(c, 'lector');
    otro = await conSesion(c, 'lector');
    admin = await conSesion(c, 'administracion');
    await crearRuta(c, {
      numero: '12',
      lectorId: lector.id,
      estado: 'cerrada',
      cantidad: 1,
    });
    await crearRuta(c, {
      numero: '07',
      lectorId: lector.id,
      estado: 'en_curso',
      cantidad: 1,
    });
    await crearRuta(c, {
      numero: '03',
      lectorId: lector.id,
      estado: 'asignada',
      cantidad: 1,
    });
    await crearRuta(c, {
      numero: '05',
      lectorId: otro.id,
      estado: 'asignada',
      cantidad: 1,
    });
  });
  afterAll(() => c.cerrar());

  it('por defecto trae las asignadas y en curso, por número, y cumple el contrato', async () => {
    const r = await c
      .http()
      .get('/yo/rutas')
      .set(bearer(lector.token))
      .expect(200);
    esperarContrato(r.body, 'Ruta');
    expect(ids(r.body)).toEqual(['rut-03-2026-05', 'rut-07-2026-05']);
    expect(r.body.meta).toEqual({ total: 2, pagina: 1, porPagina: 20 });
  });

  it('estado acepta una lista separada por comas', async () => {
    const cerradas = await c
      .http()
      .get('/yo/rutas?estado=cerrada')
      .set(bearer(lector.token))
      .expect(200);
    expect(ids(cerradas.body)).toEqual(['rut-12-2026-05']);
    const varias = await c
      .http()
      .get('/yo/rutas?estado=asignada,cerrada')
      .set(bearer(lector.token))
      .expect(200);
    expect(ids(varias.body)).toEqual(['rut-03-2026-05', 'rut-12-2026-05']);
  });

  it('un estado que no existe es 400', async () => {
    const r = await c
      .http()
      .get('/yo/rutas?estado=perdida')
      .set(bearer(lector.token))
      .expect(400);
    esperarError(r.body, 'VALIDACION_FALLIDA');
  });

  it('pagina, y una página fuera de rango devuelve datos vacíos con el total', async () => {
    const p = await c
      .http()
      .get('/yo/rutas?porPagina=1&pagina=2')
      .set(bearer(lector.token))
      .expect(200);
    expect(ids(p.body)).toEqual(['rut-07-2026-05']);
    expect(p.body.meta).toEqual({ total: 2, pagina: 2, porPagina: 1 });
    const fuera = await c
      .http()
      .get('/yo/rutas?pagina=9')
      .set(bearer(lector.token))
      .expect(200);
    expect(fuera.body).toEqual({
      datos: [],
      meta: { total: 2, pagina: 9, porPagina: 20 },
    });
  });

  it('no mezcla las rutas de otro lector; administración no tiene rutas propias', async () => {
    const r = await c
      .http()
      .get('/yo/rutas')
      .set(bearer(otro.token))
      .expect(200);
    expect(ids(r.body)).toEqual(['rut-05-2026-05']);
    const a = await c
      .http()
      .get('/yo/rutas')
      .set(bearer(admin.token))
      .expect(200);
    expect(a.body.datos).toEqual([]);
  });

  it('sin token es 401', async () => {
    const r = await c.http().get('/yo/rutas').expect(401);
    esperarError(r.body, 'NO_AUTENTICADO');
  });

  it('GET /yo: rutasAsignadas son las asignadas o en curso, por número', async () => {
    const r = await c.http().get('/yo').set(bearer(lector.token)).expect(200);
    expect(r.body.datos.rutasAsignadas).toEqual([
      'rut-03-2026-05',
      'rut-07-2026-05',
    ]);
    const a = await c.http().get('/yo').set(bearer(admin.token)).expect(200);
    expect(a.body.datos.rutasAsignadas).toEqual([]);
  });

  it('GET /usuarios también las calcula', async () => {
    const r = await c
      .http()
      .get('/usuarios?rol=lector')
      .set(bearer(admin.token))
      .expect(200);
    const mio = r.body.datos.find((u: { id: string }) => u.id === lector.id);
    expect(mio.rutasAsignadas).toEqual(['rut-03-2026-05', 'rut-07-2026-05']);
  });
});

describe('M2 — GET /rutas/:id, /suministros y /avance (R3, R4, R10)', () => {
  let c: AppDePrueba;
  let lector: { id: string; token: string };
  let otro: { id: string; token: string };
  let admin: { token: string };
  let ruta: { id: string; suministroIds: string[] };
  beforeAll(async () => {
    c = await crearApp();
    lector = await conSesion(c, 'lector');
    otro = await conSesion(c, 'lector');
    admin = await conSesion(c, 'administracion');
    // Números a propósito desordenados: el recorrido manda (R4).
    ruta = await crearRuta(c, {
      numero: '07',
      lectorId: lector.id,
      suministros: [
        { numero: '004162' },
        { numero: '004120' },
        { numero: '004150' },
        { numero: '000010' },
        { numero: '999999' },
      ],
    });
  });
  afterAll(() => c.cerrar());

  it('R4: la Ruta trae suministroIds en el orden del recorrido', async () => {
    const r = await c
      .http()
      .get(`/rutas/${ruta.id}`)
      .set(bearer(lector.token))
      .expect(200);
    esperarContrato(r.body, 'Ruta');
    const datos = r.body.datos as Ruta;
    expect(datos.suministroIds).toEqual([
      'sum-004162',
      'sum-004120',
      'sum-004150',
      'sum-000010',
      'sum-999999',
    ]);
    expect(datos).toMatchObject({
      id: 'rut-07-2026-05',
      numero: '07',
      bimestre: '2026-05',
      lectorId: lector.id,
      estado: 'asignada',
      descargadaEn: null,
      cerradaEn: null,
    });
  });

  it('administración puede ver cualquier ruta', async () => {
    await c
      .http()
      .get(`/rutas/${ruta.id}`)
      .set(bearer(admin.token))
      .expect(200);
  });

  it('R3: otro lector recibe 403 SIN_PERMISO, no 404', async () => {
    const r = await c
      .http()
      .get(`/rutas/${ruta.id}`)
      .set(bearer(otro.token))
      .expect(403);
    esperarError(r.body, 'SIN_PERMISO');
  });

  it('una ruta que no existe es 404 RUTA_NO_ENCONTRADA', async () => {
    const r = await c
      .http()
      .get('/rutas/rut-99-2026-05')
      .set(bearer(admin.token))
      .expect(404);
    esperarError(r.body, 'RUTA_NO_ENCONTRADA');
  });

  it('un id con forma inválida es 400 y sin token es 401', async () => {
    const r = await c
      .http()
      .get('/rutas/sum-1')
      .set(bearer(admin.token))
      .expect(400);
    esperarError(r.body, 'VALIDACION_FALLIDA');
    await c.http().get(`/rutas/${ruta.id}`).expect(401);
  });

  it('R4: /suministros devuelve el orden del recorrido, también paginado', async () => {
    const todo = await c
      .http()
      .get(`/rutas/${ruta.id}/suministros`)
      .set(bearer(lector.token))
      .expect(200);
    esperarContrato(todo.body, 'Suministro');
    expect(ids(todo.body)).toEqual(ruta.suministroIds);
    expect(todo.body.meta).toEqual({ total: 5, pagina: 1, porPagina: 50 });
    const p2 = await c
      .http()
      .get(`/rutas/${ruta.id}/suministros?porPagina=2&pagina=2`)
      .set(bearer(lector.token))
      .expect(200);
    expect(ids(p2.body)).toEqual(['sum-004150', 'sum-000010']);
    expect(p2.body.meta).toEqual({ total: 5, pagina: 2, porPagina: 2 });
    const fuera = await c
      .http()
      .get(`/rutas/${ruta.id}/suministros?pagina=7`)
      .set(bearer(lector.token))
      .expect(200);
    expect(fuera.body).toEqual({
      datos: [],
      meta: { total: 5, pagina: 7, porPagina: 50 },
    });
  });

  it('/suministros admite hasta 200 por página y rechaza más', async () => {
    const r200 = await c
      .http()
      .get(`/rutas/${ruta.id}/suministros?porPagina=200`)
      .set(bearer(lector.token))
      .expect(200);
    expect(r200.body.meta.porPagina).toBe(200);
    const r201 = await c
      .http()
      .get(`/rutas/${ruta.id}/suministros?porPagina=201`)
      .set(bearer(lector.token))
      .expect(400);
    esperarError(r201.body, 'VALIDACION_FALLIDA');
    await c
      .http()
      .get(`/rutas/${ruta.id}/suministros?pagina=0`)
      .set(bearer(lector.token))
      .expect(400);
  });

  it('/suministros: 403 a otro lector, 404 si no existe, 401 sin token', async () => {
    await c
      .http()
      .get(`/rutas/${ruta.id}/suministros`)
      .set(bearer(otro.token))
      .expect(403);
    await c
      .http()
      .get('/rutas/rut-99-2026-05/suministros')
      .set(bearer(admin.token))
      .expect(404);
    await c.http().get(`/rutas/${ruta.id}/suministros`).expect(401);
  });

  it('R10: el avance, sin lecturas ni novedades, tiene todo pendiente', async () => {
    const r = await c
      .http()
      .get(`/rutas/${ruta.id}/avance`)
      .set(bearer(lector.token))
      .expect(200);
    esperarContrato(r.body, 'AvanceRuta');
    expect(r.body.datos).toEqual({
      rutaId: ruta.id,
      suministros: 5,
      leidos: 0,
      conNovedad: 0,
      pendientes: 5,
      fueraDeRango: 0,
    });
  });

  it('/avance: 403 a otro lector, 404 si no existe, 401 sin token', async () => {
    await c
      .http()
      .get(`/rutas/${ruta.id}/avance`)
      .set(bearer(otro.token))
      .expect(403);
    await c
      .http()
      .get('/rutas/rut-99-2026-05/avance')
      .set(bearer(admin.token))
      .expect(404);
    await c.http().get(`/rutas/${ruta.id}/avance`).expect(401);
  });
});

describe('M2 — Un lector ve los suministros y medidores de sus rutas (R3)', () => {
  let c: AppDePrueba;
  it('con las rutas reales: los suyos sí, los demás 403', async () => {
    c = await crearApp();
    try {
      const lector = await conSesion(c, 'lector');
      const otro = await conSesion(c, 'lector');
      const ruta = await crearRuta(c, {
        lectorId: lector.id,
        suministros: [
          { medidor: { id: 'med-MIO001', codigoQr: 'COOP-CHJ:med-MIO001' } },
        ],
      });
      const { suministro: ajeno, medidor: medidorAjeno } =
        await crearSuministro(c);
      const mio = ruta.suministroIds[0];
      await c
        .http()
        .get(`/suministros/${mio}`)
        .set(bearer(lector.token))
        .expect(200);
      await c
        .http()
        .get('/medidores/med-MIO001')
        .set(bearer(lector.token))
        .expect(200);
      await c
        .http()
        .get('/medidores/qr/COOP-CHJ:med-MIO001')
        .set(bearer(lector.token))
        .expect(200);
      await c
        .http()
        .get(`/suministros/${ajeno.id}`)
        .set(bearer(lector.token))
        .expect(403);
      await c
        .http()
        .get(`/medidores/${medidorAjeno.id}`)
        .set(bearer(lector.token))
        .expect(403);
      await c
        .http()
        .get(`/suministros/${mio}`)
        .set(bearer(otro.token))
        .expect(403);
    } finally {
      await c.cerrar();
    }
  });
});

describe('M2 — POST /rutas/:id/descarga (R7, R8, R9)', () => {
  let c: AppDePrueba;
  let lector: { id: string; token: string };
  let otro: { id: string; token: string };
  let admin: { token: string };
  beforeAll(async () => {
    c = await crearApp();
    lector = await conSesion(c, 'lector');
    otro = await conSesion(c, 'lector');
    admin = await conSesion(c, 'administracion');
  });
  afterAll(() => c.cerrar());

  it('la primera descarga marca descargadaEn y pasa a en_curso; la siguiente no lo toca', async () => {
    const ruta = await crearRuta(c, { lectorId: lector.id, cantidad: 2 });
    const primera = await c
      .http()
      .post(`/rutas/${ruta.id}/descarga`)
      .set(bearer(lector.token))
      .expect(200);
    esperarContrato(primera.body, 'PaqueteRuta');
    expect(primera.body.datos.ruta).toMatchObject({
      estado: 'en_curso',
      descargadaEn: '2026-09-15T08:00:00-03:00',
      cerradaEn: null,
    });
    c.reloj.avanzar(60 * 60 * 1000);
    const segunda = await c
      .http()
      .post(`/rutas/${ruta.id}/descarga`)
      .set(bearer(lector.token))
      .expect(200);
    expect(segunda.body.datos.ruta).toMatchObject({
      estado: 'en_curso',
      descargadaEn: '2026-09-15T08:00:00-03:00',
    });
    const get = await c
      .http()
      .get(`/rutas/${ruta.id}`)
      .set(bearer(lector.token))
      .expect(200);
    expect(get.body.datos.estado).toBe('en_curso');
  });

  it('R7: una ruta de 200 suministros baja en una sola respuesta, en orden, con sus 200 medidores', async () => {
    const ruta = await crearRuta(c, { lectorId: lector.id, cantidad: 200 });
    const r = await c
      .http()
      .post(`/rutas/${ruta.id}/descarga`)
      .set(bearer(lector.token))
      .expect(200);
    esperarContrato(r.body, 'PaqueteRuta');
    const p = r.body.datos;
    expect(p.ruta.suministroIds).toEqual(ruta.suministroIds);
    expect(p.suministros.map((s: { id: string }) => s.id)).toEqual(
      ruta.suministroIds,
    );
    expect(p.medidores).toHaveLength(200);
    expect(p.medidores.map((m: { id: string }) => m.id)).toEqual(
      p.suministros.map((s: { medidorId: string }) => s.medidorId),
    );
    expect(p.lecturas).toEqual([]);
    expect(p.novedades).toEqual([]);
  });

  it('R4: el paquete respeta el recorrido aunque los números estén desordenados', async () => {
    const ruta = await crearRuta(c, {
      lectorId: lector.id,
      suministros: [
        { numero: '004162' },
        { numero: '004120' },
        { numero: '004150' },
      ],
    });
    const r = await c
      .http()
      .post(`/rutas/${ruta.id}/descarga`)
      .set(bearer(lector.token))
      .expect(200);
    expect(
      r.body.datos.suministros.map((s: { numero: string }) => s.numero),
    ).toEqual(['004162', '004120', '004150']);
  });

  it('R8: un suministro inactivo sigue en su lugar', async () => {
    const ruta = await crearRuta(c, {
      lectorId: lector.id,
      suministros: [{}, { activo: false }, {}],
    });
    const r = await c
      .http()
      .post(`/rutas/${ruta.id}/descarga`)
      .set(bearer(lector.token))
      .expect(200);
    expect(
      r.body.datos.suministros.map((s: { activo: boolean }) => s.activo),
    ).toEqual([true, false, true]);
    const lista = await c
      .http()
      .get(`/rutas/${ruta.id}/suministros`)
      .set(bearer(lector.token))
      .expect(200);
    expect(ids(lista.body)).toEqual(ruta.suministroIds);
  });

  it('R9: el video del medidor es una URL de esta API (/archivos/…)', async () => {
    const ruta = await crearRuta(c, {
      lectorId: lector.id,
      suministros: [
        { medidor: { videoClave: 'videos/2026/09/abc123.mp4' } },
        {},
      ],
    });
    const r = await c
      .http()
      .post(`/rutas/${ruta.id}/descarga`)
      .set(bearer(lector.token))
      .expect(200);
    expect(r.body.datos.medidores[0].videoInstructivoUrl).toMatch(
      /^https?:\/\/[^/]+\/archivos\/videos\/2026\/09\/abc123\.mp4$/,
    );
    expect(r.body.datos.medidores[1].videoInstructivoUrl).toBeNull();
  });

  it('una ruta cerrada no se descarga: RUTA_YA_CERRADA con el mensaje del PRD', async () => {
    const ruta = await crearRuta(c, {
      lectorId: lector.id,
      estado: 'cerrada',
      cantidad: 1,
    });
    const r = await c
      .http()
      .post(`/rutas/${ruta.id}/descarga`)
      .set(bearer(lector.token))
      .expect(409);
    esperarError(r.body, 'RUTA_YA_CERRADA');
    expect(r.body.error.mensaje).toBe('Esa ruta fue cerrada el 14/09.');
  });

  it('403 a otro lector, 404 si no existe, 401 sin token; administración puede', async () => {
    const ruta = await crearRuta(c, { lectorId: lector.id, cantidad: 1 });
    await c
      .http()
      .post(`/rutas/${ruta.id}/descarga`)
      .set(bearer(otro.token))
      .expect(403);
    await c
      .http()
      .post('/rutas/rut-99-2026-05/descarga')
      .set(bearer(admin.token))
      .expect(404);
    await c.http().post(`/rutas/${ruta.id}/descarga`).expect(401);
    await c
      .http()
      .post(`/rutas/${ruta.id}/descarga`)
      .set(bearer(admin.token))
      .expect(200);
  });
});

describe('M2 — GET /rutas (administración)', () => {
  let c: AppDePrueba;
  let a: { id: string };
  let b: { id: string };
  let admin: { token: string };
  let lector: { token: string };
  beforeAll(async () => {
    c = await crearApp();
    a = await crearUsuario(c, { rol: 'lector' });
    b = await crearUsuario(c, { rol: 'lector' });
    admin = await conSesion(c, 'administracion');
    lector = await conSesion(c, 'lector');
    await crearRuta(c, {
      numero: '07',
      bimestre: '2026-04',
      lectorId: a.id,
      estado: 'cerrada',
      cantidad: 1,
    });
    await crearRuta(c, {
      numero: '12',
      bimestre: '2026-05',
      lectorId: b.id,
      estado: 'en_curso',
      cantidad: 1,
    });
    await crearRuta(c, {
      numero: '07',
      bimestre: '2026-05',
      lectorId: a.id,
      cantidad: 1,
    });
    await crearRuta(c, {
      numero: '01',
      bimestre: '2026-05',
      lectorId: a.id,
      estado: 'cerrada',
      cantidad: 1,
    });
  });
  afterAll(() => c.cerrar());

  it('ordena por bimestre descendente y número, y cumple el contrato', async () => {
    const r = await c.http().get('/rutas').set(bearer(admin.token)).expect(200);
    esperarContrato(r.body, 'Ruta');
    expect(ids(r.body)).toEqual([
      'rut-01-2026-05',
      'rut-07-2026-05',
      'rut-12-2026-05',
      'rut-07-2026-04',
    ]);
    expect(r.body.meta).toEqual({ total: 4, pagina: 1, porPagina: 20 });
  });

  it('filtra por bimestre, lectorId y estado', async () => {
    const bim = await c
      .http()
      .get('/rutas?bimestre=2026-04')
      .set(bearer(admin.token))
      .expect(200);
    expect(ids(bim.body)).toEqual(['rut-07-2026-04']);
    const lec = await c
      .http()
      .get(`/rutas?lectorId=${b.id}`)
      .set(bearer(admin.token))
      .expect(200);
    expect(ids(lec.body)).toEqual(['rut-12-2026-05']);
    const est = await c
      .http()
      .get('/rutas?estado=cerrada')
      .set(bearer(admin.token))
      .expect(200);
    expect(ids(est.body)).toEqual(['rut-01-2026-05', 'rut-07-2026-04']);
    const todos = await c
      .http()
      .get(`/rutas?lectorId=${a.id}&estado=cerrada&bimestre=2026-05`)
      .set(bearer(admin.token))
      .expect(200);
    expect(ids(todos.body)).toEqual(['rut-01-2026-05']);
    const ninguna = await c
      .http()
      .get('/rutas?bimestre=2030-01')
      .set(bearer(admin.token))
      .expect(200);
    expect(ninguna.body).toEqual({
      datos: [],
      meta: { total: 0, pagina: 1, porPagina: 20 },
    });
  });

  it('filtros mal formados son 400', async () => {
    await c.http().get('/rutas?estado=x').set(bearer(admin.token)).expect(400);
    await c
      .http()
      .get('/rutas?bimestre=mayo')
      .set(bearer(admin.token))
      .expect(400);
    await c
      .http()
      .get('/rutas?lectorId=sum-1')
      .set(bearer(admin.token))
      .expect(400);
  });

  it('pagina', async () => {
    const r = await c
      .http()
      .get('/rutas?porPagina=3&pagina=2')
      .set(bearer(admin.token))
      .expect(200);
    expect(ids(r.body)).toEqual(['rut-07-2026-04']);
    expect(r.body.meta).toEqual({ total: 4, pagina: 2, porPagina: 3 });
  });

  it('un lector recibe 403 y sin token 401', async () => {
    const r = await c
      .http()
      .get('/rutas')
      .set(bearer(lector.token))
      .expect(403);
    esperarError(r.body, 'SIN_PERMISO');
    await c.http().get('/rutas').expect(401);
  });
});

describe('M2 — POST /rutas (R5)', () => {
  let c: AppDePrueba;
  let lector: { id: string; token: string };
  let admin: { id: string; token: string };
  let s: string[];
  beforeAll(async () => {
    c = await crearApp();
    lector = await conSesion(c, 'lector');
    admin = await conSesion(c, 'administracion');
    s = [];
    for (const numero of ['004162', '004120', '004150', '004170']) {
      s.push((await crearSuministro(c, { numero })).suministro.id);
    }
  });
  afterAll(() => c.cerrar());

  const cuerpo = (extra: Record<string, unknown> = {}) => ({
    numero: '07',
    nombre: 'Barrio Brasil',
    bimestre: '2026-05',
    lectorId: lector.id,
    suministroIds: [s[0], s[1], s[2]],
    ...extra,
  });
  const crear = (body: unknown, token = admin.token) =>
    c
      .http()
      .post('/rutas')
      .set(bearer(token))
      .send(body as object);

  it('crea la ruta asignada, con id determinístico y el recorrido pedido', async () => {
    const r = await crear(cuerpo()).expect(201);
    esperarContrato(r.body, 'Ruta');
    expect(r.body.datos).toEqual({
      id: 'rut-07-2026-05',
      numero: '07',
      nombre: 'Barrio Brasil',
      bimestre: '2026-05',
      lectorId: lector.id,
      suministroIds: [s[0], s[1], s[2]],
      estado: 'asignada',
      descargadaEn: null,
      cerradaEn: null,
    });
    const get = await c
      .http()
      .get('/rutas/rut-07-2026-05')
      .set(bearer(lector.token))
      .expect(200);
    expect(get.body.datos.suministroIds).toEqual([s[0], s[1], s[2]]);
    const mias = await c
      .http()
      .get('/yo/rutas')
      .set(bearer(lector.token))
      .expect(200);
    expect(ids(mias.body)).toContain('rut-07-2026-05');
  });

  it('R5: RUTA_YA_EXISTE si ya hay una con ese número en ese bimestre', async () => {
    const r = await crear(cuerpo({ suministroIds: [s[3]] })).expect(409);
    esperarError(r.body, 'RUTA_YA_EXISTE');
  });

  it('R5: el mismo pedido repetido también es RUTA_YA_EXISTE', async () => {
    const r = await crear(cuerpo()).expect(409);
    esperarError(r.body, 'RUTA_YA_EXISTE');
  });

  it('R5: un suministro no puede estar en dos rutas del mismo bimestre, y el mensaje dice en cuál', async () => {
    const r = await crear(
      cuerpo({ numero: '08', suministroIds: [s[3], s[1]] }),
    ).expect(409);
    esperarError(r.body, 'SUMINISTRO_EN_OTRA_RUTA');
    expect(r.body.error.mensaje).toBe(
      'El suministro 004120 ya está en la ruta 07 de este bimestre.',
    );
  });

  it('R5: en otro bimestre el mismo suministro sí puede estar', async () => {
    const r = await crear(
      cuerpo({ bimestre: '2026-06', suministroIds: [s[1]] }),
    ).expect(201);
    expect(r.body.datos.id).toBe('rut-07-2026-06');
  });

  it.each([
    ['bimestre fuera de 01 a 06', { bimestre: '2026-07' }],
    ['bimestre sin cero', { bimestre: '2026-5' }],
    ['bimestre que no es AAAA-NN', { bimestre: 'mayo' }],
    ['número que no son dígitos', { numero: 'ab' }],
    ['número vacío', { numero: '' }],
    ['número demasiado largo', { numero: '1234567' }],
    ['falta el nombre', { nombre: undefined }],
    ['nombre vacío', { nombre: '  ' }],
    ['falta el lector', { lectorId: undefined }],
    ['lector con otra forma de id', { lectorId: 'sum-1' }],
    ['suministroIds vacío', { suministroIds: [] }],
    ['suministroIds que no es lista', { suministroIds: 'sum-1' }],
    ['un suministroId con otra forma', { suministroIds: ['usr-1'] }],
    [
      'más de 300 suministros',
      { suministroIds: Array.from({ length: 301 }, (_, i) => `sum-${i}`) },
    ],
    ['un campo de más', { estado: 'cerrada' }],
  ])('400 VALIDACION_FALLIDA: %s', async (_nombre, extra) => {
    const r = await crear(cuerpo({ numero: '90', ...extra })).expect(400);
    esperarError(r.body, 'VALIDACION_FALLIDA');
  });

  it('LECTOR_NO_ENCONTRADO (422) si el usuario no existe o no es lector', async () => {
    const noExiste = await crear(
      cuerpo({ numero: '91', lectorId: 'usr-noexiste' }),
    ).expect(422);
    esperarError(noExiste.body, 'LECTOR_NO_ENCONTRADO');
    const esAdmin = await crear(
      cuerpo({ numero: '91', lectorId: admin.id }),
    ).expect(422);
    esperarError(esAdmin.body, 'LECTOR_NO_ENCONTRADO');
  });

  it('SUMINISTRO_REPETIDO (422) y SUMINISTRO_NO_ENCONTRADO (404)', async () => {
    const rep = await crear(
      cuerpo({ numero: '92', suministroIds: [s[3], s[3]] }),
    ).expect(422);
    esperarError(rep.body, 'SUMINISTRO_REPETIDO');
    const falta = await crear(
      cuerpo({ numero: '92', suministroIds: [s[3], 'sum-999999'] }),
    ).expect(404);
    esperarError(falta.body, 'SUMINISTRO_NO_ENCONTRADO');
  });

  it('300 suministros entran', async () => {
    const lote: string[] = [];
    for (let i = 0; i < 300; i++)
      lote.push((await crearSuministro(c)).suministro.id);
    const r = await crear(
      cuerpo({ numero: '93', bimestre: '2026-01', suministroIds: lote }),
    ).expect(201);
    expect(r.body.datos.suministroIds).toEqual(lote);
  });

  it('un lector recibe 403 y sin token 401', async () => {
    const r = await crear(cuerpo({ numero: '94' }), lector.token).expect(403);
    esperarError(r.body, 'SIN_PERMISO');
    await c
      .http()
      .post('/rutas')
      .send(cuerpo({ numero: '94' }))
      .expect(401);
  });

  it('concurrencia: dos pedidos iguales → uno crea y el otro dice RUTA_YA_EXISTE', async () => {
    const x = (await crearSuministro(c)).suministro.id;
    const pedido = cuerpo({ numero: '95', suministroIds: [x] });
    const [r1, r2] = await Promise.all([crear(pedido), crear(pedido)]);
    expect([r1.status, r2.status].sort()).toEqual([201, 409]);
    const perdedor = r1.status === 409 ? r1 : r2;
    esperarError(perdedor.body, 'RUTA_YA_EXISTE');
  });

  it('concurrencia: el mismo suministro en dos rutas a la vez → una gana y la otra SUMINISTRO_EN_OTRA_RUTA', async () => {
    const x = (await crearSuministro(c)).suministro.id;
    const [r1, r2] = await Promise.all([
      crear(cuerpo({ numero: '96', suministroIds: [x] })),
      crear(cuerpo({ numero: '97', suministroIds: [x] })),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([201, 409]);
    const perdedor = r1.status === 409 ? r1 : r2;
    esperarError(perdedor.body, 'SUMINISTRO_EN_OTRA_RUTA');
  });
});

describe('M2 — PATCH /rutas/:id (R6)', () => {
  let c: AppDePrueba;
  let lector: { id: string; token: string };
  let otro: { id: string; token: string };
  let admin: { token: string };
  let s: string[];
  let siguiente = 0;
  /** Suministros que ninguna otra ruta del bimestre usa. */
  const tomar = (n: number) => s.slice(siguiente, (siguiente += n));
  beforeAll(async () => {
    c = await crearApp();
    lector = await conSesion(c, 'lector');
    otro = await conSesion(c, 'lector');
    admin = await conSesion(c, 'administracion');
    s = [];
    for (let i = 0; i < 40; i++)
      s.push((await crearSuministro(c)).suministro.id);
  });
  afterAll(() => c.cerrar());

  const parchar = (id: string, body: unknown, token = admin.token) =>
    c
      .http()
      .patch(`/rutas/${id}`)
      .set(bearer(token))
      .send(body as object);

  it('cambia el nombre y devuelve la ruta', async () => {
    const s = tomar(5);
    const ruta = await crearRuta(c, {
      numero: '20',
      lectorId: lector.id,
      suministroIds: [s[0], s[1]],
    });
    const r = await parchar(ruta.id, { nombre: 'Centro nuevo' }).expect(200);
    esperarContrato(r.body, 'Ruta');
    expect(r.body.datos.nombre).toBe('Centro nuevo');
    expect(r.body.datos.suministroIds).toEqual([s[0], s[1]]);
  });

  it('asignada: se puede cambiar la lista de suministros y su orden', async () => {
    const s = tomar(5);
    const ruta = await crearRuta(c, {
      numero: '21',
      lectorId: lector.id,
      suministroIds: [s[0], s[1]],
    });
    const r = await parchar(ruta.id, {
      suministroIds: [s[3], s[1], s[0]],
    }).expect(200);
    expect(r.body.datos.suministroIds).toEqual([s[3], s[1], s[0]]);
    const get = await c
      .http()
      .get(`/rutas/${ruta.id}/suministros`)
      .set(bearer(lector.token))
      .expect(200);
    expect(ids(get.body)).toEqual([s[3], s[1], s[0]]);
  });

  it('en_curso: cambiar los suministros es RUTA_EN_CURSO; mandar la misma lista no cambia nada', async () => {
    const s = tomar(5);
    const ruta = await crearRuta(c, {
      numero: '22',
      lectorId: lector.id,
      estado: 'en_curso',
      suministroIds: [s[0], s[1]],
    });
    const r = await parchar(ruta.id, { suministroIds: [s[1], s[0]] }).expect(
      409,
    );
    esperarError(r.body, 'RUTA_EN_CURSO');
    const igual = await parchar(ruta.id, {
      suministroIds: [s[0], s[1]],
      nombre: 'Igual',
    }).expect(200);
    expect(igual.body.datos.nombre).toBe('Igual');
  });

  it('en_curso: se puede cambiar de lector y la ruta pasa a las rutas del nuevo', async () => {
    const ruta = await crearRuta(c, {
      numero: '23',
      lectorId: lector.id,
      estado: 'en_curso',
      cantidad: 1,
    });
    const r = await parchar(ruta.id, { lectorId: otro.id }).expect(200);
    expect(r.body.datos.lectorId).toBe(otro.id);
    expect(r.body.datos.estado).toBe('en_curso');
    const mias = await c
      .http()
      .get('/yo/rutas')
      .set(bearer(otro.token))
      .expect(200);
    expect(ids(mias.body)).toContain(ruta.id);
    const viejas = await c
      .http()
      .get('/yo/rutas')
      .set(bearer(lector.token))
      .expect(200);
    expect(ids(viejas.body)).not.toContain(ruta.id);
    await c
      .http()
      .get(`/rutas/${ruta.id}`)
      .set(bearer(lector.token))
      .expect(403);
  });

  it('un lector que no es lector es LECTOR_NO_ENCONTRADO', async () => {
    const ruta = await crearRuta(c, {
      numero: '24',
      lectorId: lector.id,
      cantidad: 1,
    });
    const r = await parchar(ruta.id, { lectorId: 'usr-noexiste' }).expect(422);
    esperarError(r.body, 'LECTOR_NO_ENCONTRADO');
  });

  it('cerrada: no se edita (RUTA_YA_CERRADA con la fecha)', async () => {
    const ruta = await crearRuta(c, {
      numero: '25',
      lectorId: lector.id,
      estado: 'cerrada',
      cantidad: 1,
    });
    const r = await parchar(ruta.id, { nombre: 'X' }).expect(409);
    esperarError(r.body, 'RUTA_YA_CERRADA');
    expect(r.body.error.mensaje).toBe('Esa ruta fue cerrada el 14/09.');
  });

  it('R5 también vale al editar: otra ruta del bimestre → 409, y las propias no cuentan', async () => {
    const s = tomar(5);
    const a = await crearRuta(c, {
      numero: '26',
      lectorId: lector.id,
      suministroIds: [s[0], s[1]],
    });
    await crearRuta(c, {
      numero: '27',
      lectorId: lector.id,
      suministroIds: [s[2]],
    });
    const choca = await parchar(a.id, { suministroIds: [s[0], s[2]] }).expect(
      409,
    );
    esperarError(choca.body, 'SUMINISTRO_EN_OTRA_RUTA');
    await parchar(a.id, { suministroIds: [s[1], s[0], s[4]] }).expect(200);
    const rep = await parchar(a.id, { suministroIds: [s[1], s[1]] }).expect(
      422,
    );
    esperarError(rep.body, 'SUMINISTRO_REPETIDO');
    const falta = await parchar(a.id, { suministroIds: ['sum-999998'] }).expect(
      404,
    );
    esperarError(falta.body, 'SUMINISTRO_NO_ENCONTRADO');
  });

  it('400: null, vacío, campos de más o que no se pueden cambiar', async () => {
    const ruta = await crearRuta(c, {
      numero: '28',
      lectorId: lector.id,
      cantidad: 1,
    });
    for (const body of [
      { nombre: null },
      { nombre: '' },
      { lectorId: null },
      { suministroIds: null },
      { suministroIds: [] },
      { numero: '99' },
      { bimestre: '2026-06' },
      { estado: 'cerrada' },
    ]) {
      const r = await parchar(ruta.id, body).expect(400);
      esperarError(r.body, 'VALIDACION_FALLIDA');
    }
  });

  it('403 a un lector (aunque sea el dueño), 404 si no existe, 401 sin token', async () => {
    const ruta = await crearRuta(c, {
      numero: '29',
      lectorId: lector.id,
      cantidad: 1,
    });
    const r = await parchar(ruta.id, { nombre: 'X' }, lector.token).expect(403);
    esperarError(r.body, 'SIN_PERMISO');
    await parchar('rut-99-2026-05', { nombre: 'X' }).expect(404);
    await c.http().patch(`/rutas/${ruta.id}`).send({ nombre: 'X' }).expect(401);
  });
});
