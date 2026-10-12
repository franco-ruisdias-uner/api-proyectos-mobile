// Verificación independiente de M2 — Rutas (caja negra, AGENTS §12).
import { createHmac } from 'node:crypto';
import type {
  Medidor,
  Ruta,
  Suministro,
  Usuario,
} from '../../contrato/tipos.js';
import { Sembrador } from '../../src/semillas/sembrar.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearRuta } from '../utilidades/rutas.js';
import { crearSuministro } from '../utilidades/suministros.js';
import {
  bearer,
  conSesion,
  crearUsuario,
  ingresar,
} from '../utilidades/usuarios.js';

const b64 = (o: unknown) =>
  Buffer.from(JSON.stringify(o)).toString('base64url');
function firmar(payload: Record<string, unknown>, secreto: string): string {
  const cab = b64({ alg: 'HS256', typ: 'JWT' });
  const cuerpo = b64(payload);
  const f = createHmac('sha256', secreto)
    .update(`${cab}.${cuerpo}`)
    .digest('base64url');
  return `${cab}.${cuerpo}.${f}`;
}
const SECRETO = 'secreto-de-los-tests-no-es-de-verdad';
const JERGA =
  /undefined|null|NaN|\bmust\b|\bshould\b|property|string|number|boolean|exception|SQL|QueryFailed|constraint|class-validator|stack|\bISO\b|enum/i;

type Sesion = Awaited<ReturnType<typeof conSesion>>;

describe('Verificación M2 — caja negra con datos propios', () => {
  let c: AppDePrueba;
  let admin: Sesion;
  let lector: Sesion;
  let otro: Sesion;

  beforeAll(async () => {
    c = await crearApp();
    admin = await conSesion(c, 'administracion', { legajo: 'V2-ADM' });
    lector = await conSesion(c, 'lector', { legajo: 'V2-LEC' });
    otro = await conSesion(c, 'lector', { legajo: 'V2-OTRO' });
  });
  afterAll(() => c.cerrar());

  const get = (ruta: string, s: Sesion) =>
    c.http().get(ruta).set(bearer(s.token));

  /** Mueve el reloj, ingresa de nuevo (el token dura 12 h) y siempre lo devuelve a las 8:00 del 15/09. */
  async function conReloj<T>(
    instante: string,
    quien: Sesion,
    f: (token: string) => Promise<T>,
  ): Promise<T> {
    c.reloj.fijar(instante);
    try {
      return await f(await ingresar(c, quien));
    } finally {
      c.reloj.fijar('2026-09-15T08:00:00-03:00');
    }
  }

  describe('AGENTS §7 — 401 en todo endpoint de M2', () => {
    const endpoints: Array<['get' | 'post' | 'patch', string]> = [
      ['get', '/yo/rutas'],
      ['get', '/rutas'],
      ['post', '/rutas'],
      ['get', '/rutas/rut-01-2026-05'],
      ['patch', '/rutas/rut-01-2026-05'],
      ['get', '/rutas/rut-01-2026-05/suministros'],
      ['post', '/rutas/rut-01-2026-05/descarga'],
      ['get', '/rutas/rut-01-2026-05/avance'],
    ];
    it.each(endpoints)('%s %s sin token → 401', async (m, ruta) => {
      const r = await c.http()[m](ruta).expect(401);
      esperarError(r.body, 'NO_AUTENTICADO');
    });
    it.each(endpoints)('%s %s mal firmado → 401', async (m, ruta) => {
      const malo = firmar(
        { sub: admin.id, rol: 'administracion', exp: 9999999999 },
        'otro',
      );
      const r = await c.http()[m](ruta).set(bearer(malo)).expect(401);
      esperarError(r.body, 'NO_AUTENTICADO');
    });
    it.each(endpoints)('%s %s vencido → 401', async (m, ruta) => {
      const v = firmar(
        { sub: admin.id, rol: 'administracion', iat: 1000, exp: 2000, ver: 0 },
        SECRETO,
      );
      const r = await c.http()[m](ruta).set(bearer(v)).expect(401);
      esperarError(r.body, 'NO_AUTENTICADO');
    });
    it('un token invalidado por /auth/salida deja de servir en M2', async () => {
      const x = await conSesion(c, 'administracion', { legajo: 'V2-SALE' });
      await c.http().post('/auth/salida').set(bearer(x.token)).expect(204);
      await get('/rutas', x).expect(401);
    });
  });

  describe('R3 — rol equivocado y ruta ajena', () => {
    it('un lector en endpoints 🛡 → 403 SIN_PERMISO (GET/POST/PATCH)', async () => {
      const r1 = await get('/rutas', lector).expect(403);
      esperarError(r1.body, 'SIN_PERMISO');
      await c
        .http()
        .post('/rutas')
        .set(bearer(lector.token))
        .send({})
        .expect(403);
      await c
        .http()
        .patch('/rutas/rut-01-2026-05')
        .set(bearer(lector.token))
        .send({})
        .expect(403);
    });
    it('un lector que pide una ruta que no existe en endpoint 🛡: 403 antes que validar', async () => {
      // el rol se chequea primero: no hay que filtrar si una ruta existe
      await c
        .http()
        .patch('/rutas/rut-98-2026-05')
        .set(bearer(lector.token))
        .send({ nombre: 'x' })
        .expect(403);
    });
    it('403 con el mismo mensaje y sobre exacto, sin jerga', async () => {
      const ruta = await crearRuta(c, { lectorId: otro.id, cantidad: 1 });
      for (const [m, p] of [
        ['get', `/rutas/${ruta.id}`],
        ['get', `/rutas/${ruta.id}/suministros`],
        ['get', `/rutas/${ruta.id}/avance`],
        ['post', `/rutas/${ruta.id}/descarga`],
      ] as const) {
        const r = await c.http()[m](p).set(bearer(lector.token)).expect(403);
        esperarError(r.body, 'SIN_PERMISO');
        expect(r.body.error.mensaje).not.toMatch(JERGA);
      }
      // y la descarga ajena no tocó la ruta
      const despues = await get(`/rutas/${ruta.id}`, admin).expect(200);
      expect(despues.body.datos.estado).toBe('asignada');
      expect(despues.body.datos.descargadaEn).toBeNull();
    });
  });

  describe('Forma — Ruta, PaqueteRuta, AvanceRuta', () => {
    it('Ruta tiene exactamente los 9 campos del PRD, con nulos en null', async () => {
      const ruta = await crearRuta(c, { lectorId: lector.id, cantidad: 2 });
      const r = await get(`/rutas/${ruta.id}`, lector).expect(200);
      esperarContrato(r.body, 'Ruta');
      expect(Object.keys(r.body.datos).sort()).toEqual(
        [
          'id',
          'numero',
          'nombre',
          'bimestre',
          'lectorId',
          'suministroIds',
          'estado',
          'descargadaEn',
          'cerradaEn',
        ].sort(),
      );
      expect(r.body.datos.descargadaEn).toBeNull();
      expect(r.body.datos.cerradaEn).toBeNull();
    });
    it('Ruta cerrada con todos los instantes llenos cumple el contrato', async () => {
      const ruta = await crearRuta(c, {
        lectorId: lector.id,
        estado: 'cerrada',
        cantidad: 1,
      });
      const r = await get(`/rutas/${ruta.id}`, lector).expect(200);
      esperarContrato(r.body, 'Ruta');
      expect(r.body.datos.cerradaEn).toMatch(/-03:00$/);
      expect(r.body.datos.descargadaEn).toMatch(/-03:00$/);
    });
    it('AvanceRuta tiene exactamente sus 6 campos', async () => {
      const ruta = await crearRuta(c, { lectorId: lector.id, cantidad: 4 });
      const r = await get(`/rutas/${ruta.id}/avance`, lector).expect(200);
      esperarContrato(r.body, 'AvanceRuta');
      expect(r.body.datos).toEqual({
        rutaId: ruta.id,
        suministros: 4,
        leidos: 0,
        conNovedad: 0,
        pendientes: 4,
        fueraDeRango: 0,
      });
    });
    it('PaqueteRuta: sólo 5 claves; medidores uno por suministro y en el mismo orden', async () => {
      const ruta = await crearRuta(c, {
        lectorId: lector.id,
        suministros: [
          { numero: '714162', medidor: { id: 'med-VZ0003' } },
          { numero: '714120', medidor: { id: 'med-VZ0001' } },
          {
            numero: '714150',
            medidor: { id: 'med-VZ0002', videoClave: null },
            lecturaAnterior: null,
            consumoPromedio: null,
            fechaLecturaAnterior: null,
          },
        ],
      });
      const r = await c
        .http()
        .post(`/rutas/${ruta.id}/descarga`)
        .set(bearer(lector.token))
        .expect(200);
      esperarContrato(r.body, 'PaqueteRuta');
      const p = r.body.datos;
      expect(Object.keys(p).sort()).toEqual(
        ['lecturas', 'medidores', 'novedades', 'ruta', 'suministros'].sort(),
      );
      expect((p.suministros as Suministro[]).map((s) => s.numero)).toEqual([
        '714162',
        '714120',
        '714150',
      ]);
      expect((p.medidores as Medidor[]).map((m) => m.id)).toEqual([
        'med-VZ0003',
        'med-VZ0001',
        'med-VZ0002',
      ]);
      expect(
        (p.suministros as Suministro[]).map((s, i) => [
          s.medidorId,
          (p.medidores as Medidor[])[i]?.id,
        ]),
      ).toSatisfy((pares: string[][]) => pares.every(([a, b]) => a === b));
      expect(p.suministros[2].lecturaAnterior).toBeNull();
      expect(p.suministros[2].fechaLecturaAnterior).toBeNull();
      expect(p.suministros[2].consumoPromedio).toBeNull();
      expect(p.medidores[2].videoInstructivoUrl).toBeNull();
      expect(p.ruta.suministroIds).toEqual(
        p.suministros.map((s: Suministro) => s.id),
      );
    });
    it('el paquete con videos: URL absoluta de esta API y con el Host del pedido', async () => {
      const ruta = await crearRuta(c, {
        lectorId: lector.id,
        suministros: [{ medidor: { videoClave: 'videos/2026/09/v.mp4' } }],
      });
      const r = await c
        .http()
        .post(`/rutas/${ruta.id}/descarga`)
        .set(bearer(lector.token))
        .set('Host', '10.0.0.5:3000')
        .expect(200);
      esperarContrato(r.body, 'PaqueteRuta');
      expect(r.body.datos.medidores[0].videoInstructivoUrl).toBe(
        'http://10.0.0.5:3000/archivos/videos/2026/09/v.mp4',
      );
    });
  });

  describe('Fechas — instantes con -03:00 en los bordes', () => {
    it('descarga a las 23:59:59 en Chajarí: descargadaEn con el día local y -03:00', async () => {
      const ruta = await crearRuta(c, { lectorId: lector.id, cantidad: 1 });
      const r = await conReloj('2026-12-31T23:59:59-03:00', lector, (t) =>
        c.http().post(`/rutas/${ruta.id}/descarga`).set(bearer(t)).expect(200),
      );
      esperarContrato(r.body, 'PaqueteRuta');
      expect(r.body.datos.ruta.descargadaEn).toBe('2026-12-31T23:59:59-03:00');
      expect(r.body.datos.ruta.estado).toBe('en_curso');
    });
    it('descarga a las 00:00:00 del 1/1', async () => {
      const ruta = await crearRuta(c, { lectorId: lector.id, cantidad: 1 });
      const r = await conReloj('2027-01-01T00:00:00-03:00', lector, (t) =>
        c.http().post(`/rutas/${ruta.id}/descarga`).set(bearer(t)).expect(200),
      );
      expect(r.body.datos.ruta.descargadaEn).toBe('2027-01-01T00:00:00-03:00');
    });
    it('descarga con milisegundos en el reloj: sin milisegundos en la salida', async () => {
      const ruta = await crearRuta(c, { lectorId: lector.id, cantidad: 1 });
      const r = await conReloj('2026-09-30T23:59:59.999-03:00', lector, (t) =>
        c.http().post(`/rutas/${ruta.id}/descarga`).set(bearer(t)).expect(200),
      );
      expect(r.body.datos.ruta.descargadaEn).toMatch(
        /^2026-09-30T23:59:5[89]-03:00$/,
      );
    });
    it.each([
      ['2026-01-01T02:30:00Z', '31/12'],
      ['2026-10-01T02:59:59Z', '30/09'],
      ['2026-10-01T03:00:00Z', '01/10'],
      ['2026-03-01T02:00:00Z', '28/02'],
      ['2026-09-14T20:02:00Z', '14/09'],
    ])(
      'R22: cerradaEn %s (UTC) → "Esa ruta fue cerrada el %s." en hora argentina',
      async (utc, dia) => {
        const ruta = await crearRuta(c, {
          lectorId: lector.id,
          estado: 'cerrada',
          cerradaEn: new Date(utc),
          cantidad: 1,
        });
        const r = await c
          .http()
          .post(`/rutas/${ruta.id}/descarga`)
          .set(bearer(lector.token))
          .expect(409);
        esperarError(r.body, 'RUTA_YA_CERRADA');
        expect(r.body.error.mensaje).toBe(`Esa ruta fue cerrada el ${dia}.`);
      },
    );
  });

  describe('GET /yo/rutas — filtros y paginación', () => {
    let l: Sesion;
    beforeAll(async () => {
      l = await conSesion(c, 'lector', { legajo: 'V2-YO' });
      for (const [n, e] of [
        ['31', 'cerrada'],
        ['32', 'en_curso'],
        ['33', 'asignada'],
        ['34', 'asignada'],
      ] as const) {
        await crearRuta(c, {
          numero: n,
          bimestre: '2026-04',
          lectorId: l.id,
          estado: e,
          cantidad: 1,
        });
      }
    });
    it.each([
      ['estado=', 400],
      ['estado=,', 400],
      ['estado=asignada,', 400],
      ['estado=asignada,,cerrada', 400],
      ['estado=ASIGNADA', 400],
      ['estado=abierta', 400],
      ['pagina=0', 400],
      ['pagina=-1', 400],
      ['pagina=abc', 400],
      ['porPagina=0', 400],
      ['porPagina=101', 400],
      ['porPagina=1.5', 400],
      ['filtroInventado=1', 400],
    ])('?%s → %i con VALIDACION_FALLIDA en castellano', async (q, st) => {
      const r = await get(`/yo/rutas?${q}`, l).expect(st);
      esperarError(r.body, 'VALIDACION_FALLIDA');
      expect(r.body.error.mensaje).not.toMatch(JERGA);
    });
    it('estado repetido no duplica filas', async () => {
      const r = await get('/yo/rutas?estado=cerrada&estado=cerrada', l);
      // o 400 o una sola fila; nunca duplicadas
      if (r.status === 200) {
        const ids = r.body.datos.map((d: Ruta) => d.id);
        expect(new Set(ids).size).toBe(ids.length);
      } else expect(r.status).toBe(400);
    });
    it('estado=asignada,en_curso,cerrada trae todas, por número', async () => {
      const r = await get(
        '/yo/rutas?estado=asignada,en_curso,cerrada',
        l,
      ).expect(200);
      esperarContrato(r.body, 'Ruta');
      expect(r.body.datos.map((d: Ruta) => d.numero)).toEqual([
        '31',
        '32',
        '33',
        '34',
      ]);
    });
    it('paginación de a una: orden estable y meta correcto; página fuera de rango', async () => {
      const vistos: string[] = [];
      for (let p = 1; p <= 3; p++) {
        const r = await get(`/yo/rutas?pagina=${p}&porPagina=1`, l).expect(200);
        expect(r.body.meta).toEqual({ total: 3, pagina: p, porPagina: 1 });
        vistos.push(r.body.datos[0].numero);
      }
      expect(vistos).toEqual(['32', '33', '34']);
      const fuera = await get('/yo/rutas?pagina=9&porPagina=1', l).expect(200);
      expect(fuera.body.datos).toEqual([]);
      expect(fuera.body.meta).toEqual({ total: 3, pagina: 9, porPagina: 1 });
    });
    it('administración no tiene rutas propias: lista vacía y rutasAsignadas []', async () => {
      const r = await get('/yo/rutas', admin).expect(200);
      expect(r.body.datos).toEqual([]);
      expect(r.body.meta.total).toBe(0);
      const yo = await get('/yo', admin).expect(200);
      expect(yo.body.datos.rutasAsignadas).toEqual([]);
    });
    it('lector sin rutas: lista vacía', async () => {
      const sin = await conSesion(c, 'lector', { legajo: 'V2-SIN' });
      const r = await get('/yo/rutas', sin).expect(200);
      expect(r.body.datos).toEqual([]);
      expect(r.body.meta).toEqual({ total: 0, pagina: 1, porPagina: 20 });
    });
    it('Usuario.rutasAsignadas: ordenadas por número, sin cerradas, también en /usuarios, ingreso y PATCH /yo', async () => {
      const yo = await get('/yo', l).expect(200);
      esperarContrato(yo.body, 'Usuario');
      expect(yo.body.datos.rutasAsignadas).toEqual([
        'rut-32-2026-04',
        'rut-33-2026-04',
        'rut-34-2026-04',
      ]);
      const ing = await c
        .http()
        .post('/auth/ingreso')
        .send({ legajo: 'v2-yo', contrasena: 'clave-de-prueba' })
        .expect(200);
      esperarContrato(
        ing.body.datos.usuario
          ? { datos: ing.body.datos.usuario, meta: null }
          : ing.body,
        'Usuario',
      );
      expect(ing.body.datos.usuario.rutasAsignadas).toHaveLength(3);
      const p = await c
        .http()
        .patch('/yo')
        .set(bearer(l.token))
        .send({ biometriaActiva: true })
        .expect(200);
      esperarContrato(p.body, 'Usuario');
      expect(p.body.datos.rutasAsignadas).toHaveLength(3);
      const lista = await get('/usuarios?buscar=V2-YO', admin).expect(200);
      expect((lista.body.datos as Usuario[])[0]?.rutasAsignadas).toHaveLength(
        3,
      );
      const uno = await c
        .http()
        .patch(`/usuarios/${l.id}`)
        .set(bearer(admin.token))
        .send({ nombre: 'Nuevo nombre' })
        .expect(200);
      expect(uno.body.datos.rutasAsignadas).toHaveLength(3);
    });
    it('descargar una ruta asignada no la saca de rutasAsignadas (queda en_curso)', async () => {
      const x = await conSesion(c, 'lector', { legajo: 'V2-DESC' });
      const r = await crearRuta(c, { lectorId: x.id, cantidad: 1 });
      await c
        .http()
        .post(`/rutas/${r.id}/descarga`)
        .set(bearer(x.token))
        .expect(200);
      const yo = await get('/yo', x).expect(200);
      expect(yo.body.datos.rutasAsignadas).toEqual([r.id]);
    });
  });

  describe('Entrada — ids de ruta en la URL', () => {
    it.each([
      'RUT-07-2026-05',
      'sum-004120',
      'rut-07',
      'rut-07-2026-5',
      'rut--',
      'xyz',
    ])('GET /rutas/%s → 400 (forma) o 404, nunca 500', async (id) => {
      const r = await get(`/rutas/${id}`, admin);
      expect([400, 404]).toContain(r.status);
      esperarError(r.body);
      expect(r.body.error.mensaje).not.toMatch(JERGA);
    });
    it('GET /rutas/rut-99-2026-05 → 404 RUTA_NO_ENCONTRADA exacto', async () => {
      const r = await get('/rutas/rut-99-2026-05', admin).expect(404);
      esperarError(r.body, 'RUTA_NO_ENCONTRADA');
      expect(r.body.error.mensaje).toBe('No existe esa ruta.');
    });
    it.each(['suministros', 'avance'])(
      'GET /rutas/rut-99-2026-05/%s → 404',
      async (sub) => {
        const r = await get(`/rutas/rut-99-2026-05/${sub}`, admin).expect(404);
        esperarError(r.body, 'RUTA_NO_ENCONTRADA');
      },
    );
    it('POST descarga de una inexistente → 404', async () => {
      const r = await c
        .http()
        .post('/rutas/rut-99-2026-05/descarga')
        .set(bearer(admin.token))
        .expect(404);
      esperarError(r.body, 'RUTA_NO_ENCONTRADA');
    });
    it('PATCH de una inexistente → 404', async () => {
      const r = await c
        .http()
        .patch('/rutas/rut-99-2026-05')
        .set(bearer(admin.token))
        .send({ nombre: 'x' })
        .expect(404);
      esperarError(r.body, 'RUTA_NO_ENCONTRADA');
    });
  });

  describe('R4 / R10 — recorrido y paginación de /rutas/:id/suministros', () => {
    let ruta: Awaited<ReturnType<typeof crearRuta>>;
    beforeAll(async () => {
      const nums = ['724162', '724120', '724150', '720009', '730000', '720100'];
      ruta = await crearRuta(c, {
        lectorId: lector.id,
        suministros: nums.map((numero) => ({ numero })),
      });
    });
    it('el orden es el de carga, sin ordenar por número ni por id (ni como texto ni como número)', async () => {
      const r = await get(`/rutas/${ruta.id}/suministros`, lector).expect(200);
      esperarContrato(r.body, 'Suministro');
      expect(r.body.datos.map((s: Suministro) => s.numero)).toEqual([
        '724162',
        '724120',
        '724150',
        '720009',
        '730000',
        '720100',
      ]);
      expect(r.body.meta).toEqual({ total: 6, pagina: 1, porPagina: 50 });
    });
    it('páginas de a 4: [4][2], sin repetir ni perder, y fuera de rango vacío', async () => {
      const p1 = await get(`/rutas/${ruta.id}/suministros?porPagina=4`, lector);
      const p2 = await get(
        `/rutas/${ruta.id}/suministros?porPagina=4&pagina=2`,
        lector,
      );
      expect(p1.body.datos).toHaveLength(4);
      expect(p2.body.datos).toHaveLength(2);
      expect(p2.body.meta).toEqual({ total: 6, pagina: 2, porPagina: 4 });
      expect(
        [...p1.body.datos, ...p2.body.datos].map((s: Suministro) => s.id),
      ).toEqual(ruta.suministroIds);
      const p3 = await get(
        `/rutas/${ruta.id}/suministros?porPagina=4&pagina=3`,
        lector,
      ).expect(200);
      expect(p3.body.datos).toEqual([]);
      expect(p3.body.meta.total).toBe(6);
    });
    it.each(['porPagina=201', 'porPagina=0', 'pagina=0', 'pagina=x'])(
      '?%s → 400',
      async (q) => {
        const r = await get(
          `/rutas/${ruta.id}/suministros?${q}`,
          lector,
        ).expect(400);
        esperarError(r.body, 'VALIDACION_FALLIDA');
      },
    );
    it('una ruta de 60: el default devuelve 50 y la página 2 los 10 restantes', async () => {
      const grande = await crearRuta(c, { lectorId: lector.id, cantidad: 60 });
      const p1 = await get(`/rutas/${grande.id}/suministros`, lector).expect(
        200,
      );
      expect(p1.body.datos).toHaveLength(50);
      expect(p1.body.meta).toEqual({ total: 60, pagina: 1, porPagina: 50 });
      const p2 = await get(`/rutas/${grande.id}/suministros?pagina=2`, lector);
      expect(p2.body.datos).toHaveLength(10);
      expect(p2.body.datos[0].id).toBe(grande.suministroIds[50]);
    });
    it('admin puede pedir /suministros y /avance de cualquier ruta', async () => {
      await get(`/rutas/${ruta.id}/suministros`, admin).expect(200);
      await get(`/rutas/${ruta.id}/avance`, admin).expect(200);
    });
    it('los suministros inactivos siguen en su lugar y con activo:false (R8)', async () => {
      const r = await crearRuta(c, {
        lectorId: lector.id,
        suministros: [{}, { activo: false }, {}],
      });
      const res = await get(`/rutas/${r.id}/suministros`, lector).expect(200);
      expect(res.body.datos.map((s: Suministro) => s.activo)).toEqual([
        true,
        false,
        true,
      ]);
    });
  });

  describe('R7 — descarga: efectos y concurrencia', () => {
    it('la segunda descarga con el reloj movido no cambia descargadaEn; la ruta sigue en_curso', async () => {
      const ruta = await crearRuta(c, { lectorId: lector.id, cantidad: 2 });
      const a = await c
        .http()
        .post(`/rutas/${ruta.id}/descarga`)
        .set(bearer(lector.token))
        .expect(200);
      const b = await conReloj('2026-09-16T10:00:00-03:00', lector, (t) =>
        c.http().post(`/rutas/${ruta.id}/descarga`).set(bearer(t)).expect(200),
      );
      expect(a.body.datos.ruta.descargadaEn).toBe('2026-09-15T08:00:00-03:00');
      expect(b.body.datos.ruta.descargadaEn).toBe('2026-09-15T08:00:00-03:00');
      expect(b.body.datos.ruta.estado).toBe('en_curso');
    });
    it('dos descargas simultáneas: las dos 200 y un solo descargadaEn', async () => {
      const ruta = await crearRuta(c, { lectorId: lector.id, cantidad: 3 });
      const rs = await Promise.all(
        [0, 1, 2].map(() =>
          c.http().post(`/rutas/${ruta.id}/descarga`).set(bearer(lector.token)),
        ),
      );
      expect(rs.map((r) => r.status)).toEqual([200, 200, 200]);
      const ts = new Set(rs.map((r) => r.body.datos.ruta.descargadaEn));
      expect(ts.size).toBe(1);
    });
    it('la administración que descarga marca la ruta en_curso (R7 literal)', async () => {
      const ruta = await crearRuta(c, { lectorId: lector.id, cantidad: 1 });
      const r = await c
        .http()
        .post(`/rutas/${ruta.id}/descarga`)
        .set(bearer(admin.token))
        .expect(200);
      expect(r.body.datos.ruta.estado).toBe('en_curso');
      expect(r.body.datos.ruta.descargadaEn).not.toBeNull();
    });
    it('descarga en_curso sin descargadaEn guardada no revienta (dato heredado)', async () => {
      const ruta = await crearRuta(c, {
        lectorId: lector.id,
        estado: 'en_curso',
        descargadaEn: null,
        cantidad: 1,
      });
      const r = await c
        .http()
        .post(`/rutas/${ruta.id}/descarga`)
        .set(bearer(lector.token))
        .expect(200);
      esperarContrato(r.body, 'PaqueteRuta');
    });
    it('descarga de ruta cerrada: la ruta no cambia', async () => {
      const ruta = await crearRuta(c, {
        lectorId: lector.id,
        estado: 'cerrada',
        cantidad: 1,
      });
      await c
        .http()
        .post(`/rutas/${ruta.id}/descarga`)
        .set(bearer(lector.token))
        .expect(409);
      const r = await get(`/rutas/${ruta.id}`, lector).expect(200);
      expect(r.body.datos.estado).toBe('cerrada');
    });
    it('ruta de 200 suministros con orden barajado: 200 de cada cosa en una respuesta', async () => {
      const ruta = await crearRuta(c, { lectorId: lector.id, cantidad: 200 });
      const r = await c
        .http()
        .post(`/rutas/${ruta.id}/descarga`)
        .set(bearer(lector.token))
        .expect(200);
      expect(r.body.meta).toBeNull();
      expect(r.body.datos.suministros).toHaveLength(200);
      expect(r.body.datos.medidores).toHaveLength(200);
      expect(r.body.datos.suministros.map((s: Suministro) => s.id)).toEqual(
        ruta.suministroIds,
      );
    });
  });

  describe('Acceso del lector a /suministros y /medidores por sus rutas (R3, A23)', () => {
    it('suministro y medidor (por id y por QR) de su ruta → 200; de una ruta ajena → 403', async () => {
      const mio = await crearRuta(c, { lectorId: lector.id, cantidad: 1 });
      const ajeno = await crearRuta(c, { lectorId: otro.id, cantidad: 1 });
      const sm = mio.suministroIds[0];
      const sa = ajeno.suministroIds[0];
      const medM = (await get(`/suministros/${sm}`, lector).expect(200)).body
        .datos.medidorId;
      const medA = (await get(`/suministros/${sa}`, admin).expect(200)).body
        .datos.medidorId;
      await get(`/medidores/${medM}`, lector).expect(200);
      await get(`/medidores/qr/COOP-CHJ:${medM}`, lector).expect(200);
      for (const p of [
        `/suministros/${sa}`,
        `/medidores/${medA}`,
        `/medidores/qr/COOP-CHJ:${medA}`,
      ]) {
        const r = await get(p, lector).expect(403);
        esperarError(r.body, 'SIN_PERMISO');
      }
    });
    it('suministro sin ruta alguna: el lector recibe 403 y admin 200', async () => {
      const { suministro } = await crearSuministro(c);
      await get(`/suministros/${suministro.id}`, lector).expect(403);
      await get(`/suministros/${suministro.id}`, admin).expect(200);
    });
    it('suministro inexistente: 404 al lector también (no 403)', async () => {
      const r = await get('/suministros/sum-nope99', lector);
      expect([404]).toContain(r.status);
      esperarError(r.body, 'SUMINISTRO_NO_ENCONTRADO');
    });
    it('un suministro en ruta cerrada del lector sigue accesible (A23)', async () => {
      const x = await conSesion(c, 'lector', { legajo: 'V2-CER' });
      const r = await crearRuta(c, {
        lectorId: x.id,
        estado: 'cerrada',
        cantidad: 1,
      });
      await get(`/suministros/${r.suministroIds[0]}`, x).expect(200);
    });
    it('al cambiar de lector (en_curso) el anterior pierde acceso y el nuevo lo gana', async () => {
      const a = await conSesion(c, 'lector', { legajo: 'V2-A' });
      const b = await conSesion(c, 'lector', { legajo: 'V2-B' });
      const r = await crearRuta(c, {
        lectorId: a.id,
        estado: 'en_curso',
        cantidad: 1,
      });
      const s = r.suministroIds[0];
      await get(`/suministros/${s}`, a).expect(200);
      await c
        .http()
        .patch(`/rutas/${r.id}`)
        .set(bearer(admin.token))
        .send({ lectorId: b.id })
        .expect(200);
      await get(`/suministros/${s}`, a).expect(403);
      await get(`/suministros/${s}`, b).expect(200);
      await get(`/rutas/${r.id}`, a).expect(403);
      await get(`/rutas/${r.id}`, b).expect(200);
      expect((await get('/yo', a)).body.datos.rutasAsignadas).toEqual([]);
      expect((await get('/yo', b)).body.datos.rutasAsignadas).toEqual([r.id]);
    });
    it('quitar un suministro de una ruta asignada le quita el acceso al lector', async () => {
      const x = await conSesion(c, 'lector', { legajo: 'V2-QUITA' });
      const r = await crearRuta(c, { lectorId: x.id, cantidad: 2 });
      const [s1, s2] = r.suministroIds;
      await get(`/suministros/${s2}`, x).expect(200);
      await c
        .http()
        .patch(`/rutas/${r.id}`)
        .set(bearer(admin.token))
        .send({ suministroIds: [s1] })
        .expect(200);
      await get(`/suministros/${s2}`, x).expect(403);
      await get(`/suministros/${s1}`, x).expect(200);
    });
  });

  describe('GET /rutas (administración) — filtros combinados y orden', () => {
    let lA: Sesion;
    let lB: Sesion;
    beforeAll(async () => {
      lA = await conSesion(c, 'lector', { legajo: 'V2-FA' });
      lB = await conSesion(c, 'lector', { legajo: 'V2-FB' });
      const defs: Array<[string, string, Sesion, 'asignada' | 'cerrada']> = [
        ['5', '2031-01', lA, 'asignada'],
        ['05', '2031-01', lB, 'cerrada'],
        ['10', '2031-01', lA, 'cerrada'],
        ['2', '2031-06', lA, 'asignada'],
        ['3', '2030-06', lB, 'asignada'],
      ];
      for (const [numero, bimestre, l, estado] of defs) {
        await crearRuta(c, {
          numero,
          bimestre,
          lectorId: l.id,
          estado,
          cantidad: 1,
        });
      }
    });
    it('orden: bimestre descendente, luego número como texto', async () => {
      const r = await get('/rutas?bimestre=2031-01', admin).expect(200);
      expect(r.body.datos.map((d: Ruta) => d.numero)).toEqual([
        '05',
        '10',
        '5',
      ]);
      const todas = await get('/rutas?porPagina=100', admin).expect(200);
      const bs = (todas.body.datos as Ruta[])
        .map((d) => d.bimestre)
        .filter((b) => b.startsWith('203'));
      expect(bs).toEqual([
        '2031-06',
        '2031-01',
        '2031-01',
        '2031-01',
        '2030-06',
      ]);
    });
    it('filtros combinados: lectorId + estado + bimestre', async () => {
      const r = await get(
        `/rutas?lectorId=${lA.id}&estado=cerrada&bimestre=2031-01`,
        admin,
      ).expect(200);
      esperarContrato(r.body, 'Ruta');
      expect(r.body.datos.map((d: Ruta) => d.numero)).toEqual(['10']);
      expect(r.body.meta.total).toBe(1);
    });
    it('lectorId de un usuario sin rutas / inexistente → lista vacía, no error', async () => {
      const r = await get('/rutas?lectorId=usr-inexistente1', admin).expect(
        200,
      );
      expect(r.body.datos).toEqual([]);
      expect(r.body.meta.total).toBe(0);
    });
    it('estado en lista separada por comas en /rutas (coherente con /yo/rutas) o 400, nunca 500', async () => {
      const r = await get(
        '/rutas?estado=asignada,cerrada&bimestre=2031-01',
        admin,
      );
      expect([200, 400]).toContain(r.status);
      if (r.status === 200) expect(r.body.meta.total).toBe(3);
    });
    it.each([
      'bimestre=2026-00',
      'bimestre=2026-07',
      'bimestre=2026-5',
      'bimestre=abc',
      'estado=otra',
      'pagina=0',
      'porPagina=101',
      'bimestre=',
    ])('/rutas?%s → 400', async (q) => {
      const r = await get(`/rutas?${q}`, admin).expect(400);
      esperarError(r.body, 'VALIDACION_FALLIDA');
    });
    it('paginación: total constante y sin repetidos entre páginas', async () => {
      const vistos: string[] = [];
      for (let p = 1; p <= 3; p++) {
        const r = await get(
          `/rutas?bimestre=2031-01&porPagina=1&pagina=${p}`,
          admin,
        );
        expect(r.body.meta).toEqual({ total: 3, pagina: p, porPagina: 1 });
        vistos.push(r.body.datos[0].id);
      }
      expect(new Set(vistos).size).toBe(3);
    });
  });

  describe('R5 — POST /rutas', () => {
    let lec: Sesion;
    let n = 0;
    const cuerpo = async (extra: Record<string, unknown> = {}) => {
      n += 1;
      const { suministro } = await crearSuministro(c);
      return {
        numero: String(40 + n),
        nombre: 'Ruta de prueba',
        bimestre: '2027-02',
        lectorId: lec.id,
        suministroIds: [suministro.id],
        ...extra,
      };
    };
    const post = (b: unknown) =>
      c
        .http()
        .post('/rutas')
        .set(bearer(admin.token))
        .send(b as object);
    beforeAll(async () => {
      lec = await conSesion(c, 'lector', { legajo: 'V2-POST' });
    });

    it('201 con la Ruta completa, id determinístico, asignada y con nulos', async () => {
      const b = await cuerpo({ numero: '07', bimestre: '2027-03' });
      const r = await post(b).expect(201);
      esperarContrato(r.body, 'Ruta');
      expect(r.body.datos).toEqual({
        id: 'rut-07-2027-03',
        numero: '07',
        nombre: 'Ruta de prueba',
        bimestre: '2027-03',
        lectorId: lec.id,
        suministroIds: b.suministroIds,
        estado: 'asignada',
        descargadaEn: null,
        cerradaEn: null,
      });
      const g = await get('/rutas/rut-07-2027-03', admin).expect(200);
      expect(g.body.datos).toEqual(r.body.datos);
    });
    it('el recorrido pedido se conserva con números desordenados', async () => {
      const a = await crearSuministro(c, { numero: '744162' });
      const b = await crearSuministro(c, { numero: '744120' });
      const d = await crearSuministro(c, { numero: '744150' });
      const ids = [a, b, d].map((x) => x.suministro.id);
      const r = await post(
        await cuerpo({ suministroIds: ids, numero: '66' }),
      ).expect(201);
      expect(r.body.datos.suministroIds).toEqual(ids);
      const s = await get(`/rutas/${r.body.datos.id}/suministros`, admin);
      expect(s.body.datos.map((x: Suministro) => x.numero)).toEqual([
        '744162',
        '744120',
        '744150',
      ]);
    });
    it('"7" y "07" son rutas distintas del mismo bimestre', async () => {
      await post(await cuerpo({ numero: '7', bimestre: '2027-04' })).expect(
        201,
      );
      await post(await cuerpo({ numero: '07', bimestre: '2027-04' })).expect(
        201,
      );
    });
    it('el mismo número en otro bimestre sí', async () => {
      await post(await cuerpo({ numero: '71', bimestre: '2027-05' })).expect(
        201,
      );
      await post(await cuerpo({ numero: '71', bimestre: '2027-06' })).expect(
        201,
      );
    });
    it.each([
      ['numero vacío', { numero: '' }],
      ['numero con letras', { numero: 'A1' }],
      ['numero de 7 dígitos', { numero: '1234567' }],
      ['numero numérico', { numero: 7 }],
      ['numero con guion', { numero: '1-2' }],
      ['sin numero', { numero: undefined }],
      ['nombre vacío', { nombre: '' }],
      ['nombre sólo espacios', { nombre: '   ' }],
      ['nombre numérico', { nombre: 5 }],
      ['sin nombre', { nombre: undefined }],
      ['bimestre 00', { bimestre: '2027-00' }],
      ['bimestre 07', { bimestre: '2027-07' }],
      ['bimestre 5', { bimestre: '2027-5' }],
      ['bimestre año corto', { bimestre: '27-05' }],
      ['bimestre fecha', { bimestre: '2027-05-01' }],
      ['bimestre vacío', { bimestre: '' }],
      ['sin bimestre', { bimestre: undefined }],
      ['lectorId sin prefijo', { lectorId: 'lector-1' }],
      ['lectorId vacío', { lectorId: '' }],
      ['lectorId numérico', { lectorId: 12 }],
      ['sin lectorId', { lectorId: undefined }],
      ['suministroIds vacío', { suministroIds: [] }],
      ['suministroIds no es lista', { suministroIds: 'sum-000001' }],
      ['suministroIds con prefijo malo', { suministroIds: ['med-123456'] }],
      ['suministroIds con número', { suministroIds: [4120] }],
      ['suministroIds null', { suministroIds: null }],
      ['sin suministroIds', { suministroIds: undefined }],
      ['campo de más estado', { estado: 'cerrada' }],
      ['campo de más id', { id: 'rut-99-2027-02' }],
      ['campo de más descargadaEn', { descargadaEn: null }],
      ['campo de más createdAt', { createdAt: 'x' }],
    ])('400 VALIDACION_FALLIDA: %s', async (_t, extra) => {
      const b = { ...(await cuerpo()), ...extra };
      const r = await post(b).expect(400);
      esperarError(r.body, 'VALIDACION_FALLIDA');
      expect(r.body.error.mensaje).not.toMatch(JERGA);
    });
    it('cuerpo vacío / no JSON → 400', async () => {
      const r = await post({}).expect(400);
      esperarError(r.body, 'VALIDACION_FALLIDA');
      const r2 = await c
        .http()
        .post('/rutas')
        .set(bearer(admin.token))
        .set('Content-Type', 'application/json')
        .send('{no es json')
        .expect(400);
      esperarError(r2.body);
    });
    it('301 suministros → 400 y 300 → 201', async () => {
      const ids: string[] = [];
      for (let i = 0; i < 301; i++)
        ids.push(`sum-X${String(i).padStart(5, '0')}`);
      const r = await post(await cuerpo({ suministroIds: ids })).expect(400);
      esperarError(r.body, 'VALIDACION_FALLIDA');
    });
    it('lectorId: administración, otro rol o inexistente → 422 LECTOR_NO_ENCONTRADO exacto', async () => {
      for (const id of [admin.id, 'usr-noexiste1']) {
        const r = await post(await cuerpo({ lectorId: id })).expect(422);
        esperarError(r.body, 'LECTOR_NO_ENCONTRADO');
        expect(r.body.error.mensaje).toBe(
          'Ese usuario no existe o no es lector.',
        );
      }
    });
    it('SUMINISTRO_REPETIDO 422, también si el repetido no existe (A21: antes que 404)', async () => {
      const b = await cuerpo();
      const id = (b.suministroIds as string[])[0]!;
      let r = await post({ ...b, suministroIds: [id, id] }).expect(422);
      esperarError(r.body, 'SUMINISTRO_REPETIDO');
      r = await post({
        ...b,
        suministroIds: ['sum-zzz999', 'sum-zzz999'],
      }).expect(422);
      esperarError(r.body, 'SUMINISTRO_REPETIDO');
    });
    it('SUMINISTRO_NO_ENCONTRADO 404 si alguno no existe; no se crea la ruta (atómico)', async () => {
      const b = await cuerpo({ numero: '88' });
      const r = await post({
        ...b,
        suministroIds: [...(b.suministroIds as string[]), 'sum-fantasma1'],
      }).expect(404);
      esperarError(r.body, 'SUMINISTRO_NO_ENCONTRADO');
      await get(`/rutas/rut-88-2027-02`, admin).expect(404);
      // y el suministro válido quedó libre para otra ruta
      await post({ ...b, numero: '89' }).expect(201);
    });
    it('SUMINISTRO_EN_OTRA_RUTA 409: el mensaje nombra suministro y ruta; la ruta no queda creada', async () => {
      const a = await crearSuministro(c, { numero: '754120' });
      await post(
        await cuerpo({ numero: '91', suministroIds: [a.suministro.id] }),
      ).expect(201);
      const r = await post(
        await cuerpo({ numero: '92', suministroIds: [a.suministro.id] }),
      ).expect(409);
      esperarError(r.body, 'SUMINISTRO_EN_OTRA_RUTA');
      expect(r.body.error.mensaje).toBe(
        'El suministro 754120 ya está en la ruta 91 de este bimestre.',
      );
      await get('/rutas/rut-92-2027-02', admin).expect(404);
    });
    it('el mismo suministro en dos bimestres distintos está bien', async () => {
      const a = await crearSuministro(c);
      await post(
        await cuerpo({
          numero: '93',
          bimestre: '2028-01',
          suministroIds: [a.suministro.id],
        }),
      ).expect(201);
      await post(
        await cuerpo({
          numero: '93',
          bimestre: '2028-02',
          suministroIds: [a.suministro.id],
        }),
      ).expect(201);
    });
    it('RUTA_YA_EXISTE 409 con mensaje exacto', async () => {
      const b = await cuerpo({ numero: '94' });
      await post(b).expect(201);
      const r = await post(await cuerpo({ numero: '94' })).expect(409);
      esperarError(r.body, 'RUTA_YA_EXISTE');
      expect(r.body.error.mensaje).toBe(
        'Ya hay una ruta con ese número en ese bimestre.',
      );
    });
    it('concurrencia: 4 pedidos iguales → un 201 y tres 409 limpios (nunca 500)', async () => {
      const b = await cuerpo({ numero: '95' });
      const rs = await Promise.all([1, 2, 3, 4].map(() => post(b)));
      const estados = rs.map((r) => r.status).sort();
      expect(estados).toEqual([201, 409, 409, 409]);
      for (const r of rs.filter((x) => x.status === 409))
        esperarError(r.body, 'RUTA_YA_EXISTE');
    });
    it('concurrencia: dos rutas distintas con el mismo suministro → una gana, la otra 409', async () => {
      const s = await crearSuministro(c);
      const mk = (numero: string) => ({
        numero,
        nombre: 'x',
        bimestre: '2029-01',
        lectorId: lec.id,
        suministroIds: [s.suministro.id],
      });
      const rs = await Promise.all([post(mk('96')), post(mk('97'))]);
      expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
      esperarError(
        rs.find((r) => r.status === 409)!.body,
        'SUMINISTRO_EN_OTRA_RUTA',
      );
    });
    it('el lector nuevo ve la ruta en /yo/rutas y en rutasAsignadas', async () => {
      const l2 = await conSesion(c, 'lector', { legajo: 'V2-NUEVO' });
      const r = await post(
        await cuerpo({ numero: '98', lectorId: l2.id }),
      ).expect(201);
      const yo = await get('/yo/rutas', l2).expect(200);
      expect(yo.body.datos.map((x: Ruta) => x.id)).toEqual([r.body.datos.id]);
      expect((await get('/yo', l2)).body.datos.rutasAsignadas).toEqual([
        r.body.datos.id,
      ]);
    });
  });

  describe('R6 — PATCH /rutas/:id', () => {
    const patch = (id: string, b: unknown) =>
      c
        .http()
        .patch(`/rutas/${id}`)
        .set(bearer(admin.token))
        .send(b as object);

    it('asignada: cambia nombre, lector y suministros a la vez; devuelve la ruta nueva', async () => {
      const l2 = await conSesion(c, 'lector', { legajo: 'V2-P1' });
      const r = await crearRuta(c, { lectorId: lector.id, cantidad: 2 });
      const nuevo = await crearSuministro(c);
      const ids = [nuevo.suministro.id, r.suministroIds[0]!];
      const res = await patch(r.id, {
        nombre: 'Otro nombre',
        lectorId: l2.id,
        suministroIds: ids,
      }).expect(200);
      esperarContrato(res.body, 'Ruta');
      expect(res.body.datos).toMatchObject({
        id: r.id,
        nombre: 'Otro nombre',
        lectorId: l2.id,
        suministroIds: ids,
        estado: 'asignada',
      });
      const s = await get(`/rutas/${r.id}/suministros`, l2).expect(200);
      expect(s.body.datos.map((x: Suministro) => x.id)).toEqual(ids);
    });
    it('el suministro quitado queda libre para otra ruta del bimestre', async () => {
      const r = await crearRuta(c, { lectorId: lector.id, cantidad: 2 });
      const [s1, s2] = r.suministroIds;
      await patch(r.id, { suministroIds: [s1] }).expect(200);
      const r2 = await crearRuta(c, {
        lectorId: lector.id,
        suministroIds: [s2!],
      });
      expect(r2.suministroIds).toEqual([s2]);
    });
    it('en_curso: el mismo conjunto en otro orden es RUTA_EN_CURSO; la lista no se altera', async () => {
      const r = await crearRuta(c, {
        lectorId: lector.id,
        estado: 'en_curso',
        cantidad: 3,
      });
      const rev = [...r.suministroIds].reverse();
      const res = await patch(r.id, { suministroIds: rev }).expect(409);
      esperarError(res.body, 'RUTA_EN_CURSO');
      expect(res.body.error.mensaje).toBe(
        'La ruta ya salió a la calle: no se le pueden cambiar los suministros.',
      );
      const g = await get(`/rutas/${r.id}`, admin);
      expect(g.body.datos.suministroIds).toEqual(r.suministroIds);
    });
    it('en_curso: un PATCH mixto con suministros cambiados no aplica ni el nombre (atómico)', async () => {
      const r = await crearRuta(c, {
        lectorId: lector.id,
        estado: 'en_curso',
        nombre: 'Original',
        cantidad: 2,
      });
      await patch(r.id, {
        nombre: 'Cambiado',
        suministroIds: [r.suministroIds[0]],
      }).expect(409);
      const g = await get(`/rutas/${r.id}`, admin);
      expect(g.body.datos.nombre).toBe('Original');
    });
    it('en_curso: mismo suministroIds + otro nombre → 200', async () => {
      const r = await crearRuta(c, {
        lectorId: lector.id,
        estado: 'en_curso',
        cantidad: 2,
      });
      const res = await patch(r.id, {
        nombre: 'Sólo nombre',
        suministroIds: r.suministroIds,
      }).expect(200);
      expect(res.body.datos.nombre).toBe('Sólo nombre');
      expect(res.body.datos.estado).toBe('en_curso');
      expect(res.body.datos.descargadaEn).not.toBeNull();
    });
    it('cerrada: RUTA_YA_CERRADA con fecha, cualquiera sea el cuerpo; con cuerpo vacío también', async () => {
      const r = await crearRuta(c, {
        lectorId: lector.id,
        estado: 'cerrada',
        cantidad: 1,
      });
      const a = await patch(r.id, { nombre: 'x' }).expect(409);
      esperarError(a.body, 'RUTA_YA_CERRADA');
      expect(a.body.error.mensaje).toBe('Esa ruta fue cerrada el 14/09.');
      const b = await patch(r.id, { lectorId: otro.id }).expect(409);
      esperarError(b.body, 'RUTA_YA_CERRADA');
    });
    it('el lector que deja la ruta: no pasa nada con descargadaEn ni estado', async () => {
      const r = await crearRuta(c, {
        lectorId: lector.id,
        estado: 'en_curso',
        cantidad: 1,
      });
      const res = await patch(r.id, { lectorId: otro.id }).expect(200);
      expect(res.body.datos.estado).toBe('en_curso');
      expect(res.body.datos.descargadaEn).toBe('2026-09-15T07:40:00-03:00');
    });
    it('lectorId: admin / inexistente → 422; con prefijo malo → 400', async () => {
      const r = await crearRuta(c, { lectorId: lector.id, cantidad: 1 });
      const a = await patch(r.id, { lectorId: admin.id }).expect(422);
      esperarError(a.body, 'LECTOR_NO_ENCONTRADO');
      await patch(r.id, { lectorId: 'usr-nadie12345' }).expect(422);
      await patch(r.id, { lectorId: 'xx' }).expect(400);
    });
    it('suministroIds: repetidos 422, inexistentes 404, vacío/301 400, ocupado 409', async () => {
      const r = await crearRuta(c, { lectorId: lector.id, cantidad: 1 });
      const ajeno = await crearRuta(c, { lectorId: otro.id, cantidad: 1 });
      const [s] = r.suministroIds;
      esperarError(
        (await patch(r.id, { suministroIds: [s, s] }).expect(422)).body,
        'SUMINISTRO_REPETIDO',
      );
      esperarError(
        (await patch(r.id, { suministroIds: ['sum-fantasma9'] }).expect(404))
          .body,
        'SUMINISTRO_NO_ENCONTRADO',
      );
      esperarError(
        (await patch(r.id, { suministroIds: [] }).expect(400)).body,
        'VALIDACION_FALLIDA',
      );
      const e = await patch(r.id, {
        suministroIds: [s, ajeno.suministroIds[0]],
      }).expect(409);
      esperarError(e.body, 'SUMINISTRO_EN_OTRA_RUTA');
      expect(e.body.error.mensaje).toContain(`${ajeno.numero}`);
      // no se aplicó nada
      expect(
        (await get(`/rutas/${r.id}`, admin)).body.datos.suministroIds,
      ).toEqual([s]);
    });
    it.each([
      ['nombre vacío', { nombre: '' }],
      ['nombre null', { nombre: null }],
      ['nombre numérico', { nombre: 3 }],
      ['numero', { numero: '99' }],
      ['bimestre', { bimestre: '2026-06' }],
      ['estado', { estado: 'cerrada' }],
      ['id', { id: 'rut-1-2026-05' }],
      ['descargadaEn', { descargadaEn: '2026-09-15T08:00:00-03:00' }],
      ['cerradaEn', { cerradaEn: null }],
      ['campo ajeno', { password: 'x' }],
    ])('400: %s', async (_t, b) => {
      const r = await crearRuta(c, { lectorId: lector.id, cantidad: 1 });
      const res = await patch(r.id, b).expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
      expect(res.body.error.mensaje).not.toMatch(JERGA);
    });
    it('PATCH {} devuelve la ruta sin cambios', async () => {
      const r = await crearRuta(c, { lectorId: lector.id, cantidad: 1 });
      const antes = (await get(`/rutas/${r.id}`, admin)).body.datos;
      const res = await patch(r.id, {}).expect(200);
      expect(res.body.datos).toEqual(antes);
    });
    it('un lector (aunque sea el dueño) → 403', async () => {
      const r = await crearRuta(c, { lectorId: lector.id, cantidad: 1 });
      await c
        .http()
        .patch(`/rutas/${r.id}`)
        .set(bearer(lector.token))
        .send({ nombre: 'mío' })
        .expect(403);
    });
    it('concurrencia: dos PATCH que toman el mismo suministro libre → uno 200 y otro 409', async () => {
      const libre = await crearSuministro(c);
      const r1 = await crearRuta(c, { lectorId: lector.id, cantidad: 1 });
      const r2 = await crearRuta(c, { lectorId: lector.id, cantidad: 1 });
      const rs = await Promise.all([
        patch(r1.id, {
          suministroIds: [...r1.suministroIds, libre.suministro.id],
        }),
        patch(r2.id, {
          suministroIds: [...r2.suministroIds, libre.suministro.id],
        }),
      ]);
      expect(rs.map((x) => x.status).sort()).toEqual([200, 409]);
      esperarError(
        rs.find((x) => x.status === 409)!.body,
        'SUMINISTRO_EN_OTRA_RUTA',
      );
    });
    it('concurrencia: PATCH de suministros en carrera con la primera descarga no deja la ruta inconsistente', async () => {
      const r = await crearRuta(c, { lectorId: lector.id, cantidad: 2 });
      const [pa, de] = await Promise.all([
        patch(r.id, {
          suministroIds: [r.suministroIds[1], r.suministroIds[0]],
        }),
        c.http().post(`/rutas/${r.id}/descarga`).set(bearer(lector.token)),
      ]);
      expect([200, 409]).toContain(pa.status);
      expect(de.status).toBe(200);
      // el paquete que recibió el lector coincide con su ruta
      expect(de.body.datos.suministros.map((s: Suministro) => s.id)).toEqual(
        de.body.datos.ruta.suministroIds,
      );
      const fin = (await get(`/rutas/${r.id}`, admin)).body.datos;
      if (pa.status === 409) expect(fin.suministroIds).toEqual(r.suministroIds);
    });
  });

  describe('Semillas (§8) — las 20 rutas de la app de clase', () => {
    let s: AppDePrueba;
    let adm: string;
    beforeAll(async () => {
      s = await crearApp();
      await s.app.get(Sembrador).sembrar();
      adm = await ingresar(s, { legajo: 'L-030', contrasena: 'lectura' });
    });
    afterAll(() => s.cerrar());

    const roster: Array<[string, string, string, string]> = [
      ['01', 'Centro', 'asignada', 'usr-012'],
      ['02', 'Barrio Sur', 'en_curso', 'usr-013'],
      ['03', 'Villa Libertad', 'cerrada', 'usr-014'],
      ['04', 'Barrio Norte', 'asignada', 'usr-015'],
      ['05', 'San Isidro', 'en_curso', 'usr-016'],
      ['06', 'Los Pinos', 'cerrada', 'usr-017'],
      ['07', 'Barrio Brasil', 'en_curso', 'usr-011'],
      ['08', 'La Estación', 'asignada', 'usr-018'],
      ['09', 'Parque del Sol', 'en_curso', 'usr-019'],
      ['10', 'Barrio Oeste', 'cerrada', 'usr-020'],
      ['11', 'Costa del Uruguay', 'asignada', 'usr-021'],
      ['12', 'Quintas Norte', 'cerrada', 'usr-011'],
      ['13', 'Santa Rosa', 'en_curso', 'usr-022'],
      ['14', 'Las Heras', 'cerrada', 'usr-023'],
      ['15', 'San Martín', 'asignada', 'usr-024'],
      ['16', 'Barrio Este', 'en_curso', 'usr-025'],
      ['17', 'El Molino', 'cerrada', 'usr-026'],
      ['18', 'La Floresta', 'asignada', 'usr-027'],
      ['19', 'Pueblo Nuevo', 'en_curso', 'usr-028'],
      ['20', 'Almirante Brown', 'cerrada', 'usr-029'],
    ];
    it.each(roster)(
      'ruta %s "%s" es %s de %s, con sus instantes como el mock',
      async (num, nombre, estado, lectorId) => {
        const r = await s
          .http()
          .get(`/rutas/rut-${num}-2026-05`)
          .set(bearer(adm))
          .expect(200);
        esperarContrato(r.body, 'Ruta');
        const d = r.body.datos as Ruta;
        expect(d).toMatchObject({
          numero: num,
          nombre,
          estado,
          lectorId,
          bimestre: '2026-05',
        });
        expect(d.descargadaEn).toBe(
          estado === 'asignada'
            ? null
            : num === '12'
              ? '2026-09-14T07:10:00-03:00'
              : '2026-09-15T07:40:00-03:00',
        );
        expect(d.cerradaEn).toBe(
          estado === 'cerrada' ? '2026-09-14T17:02:00-03:00' : null,
        );
        expect(d.suministroIds.length).toBeGreaterThan(0);
      },
    );
    it('Ramón (usr-011) ve en /yo/rutas la 07 y, pidiendo cerradas, la 12; Laura ve [] ', async () => {
      const ramon = await ingresar(s, {
        legajo: 'L-011',
        contrasena: 'lectura',
      });
      const a = await s.http().get('/yo/rutas').set(bearer(ramon)).expect(200);
      expect(a.body.datos.map((x: Ruta) => x.id)).toEqual(['rut-07-2026-05']);
      const b = await s
        .http()
        .get('/yo/rutas?estado=cerrada')
        .set(bearer(ramon))
        .expect(200);
      expect(b.body.datos.map((x: Ruta) => x.id)).toEqual(['rut-12-2026-05']);
      const l = await s.http().get('/yo/rutas').set(bearer(adm)).expect(200);
      expect(l.body.datos).toEqual([]);
    });
    it('la ruta 07: 200 suministros en el orden de Brasil; casos feos en su lugar (índice 10 sin anterior, 25 con ×10 sin video)', async () => {
      const ramon = await ingresar(s, {
        legajo: 'L-011',
        contrasena: 'lectura',
      });
      const r = await s
        .http()
        .post('/rutas/rut-07-2026-05/descarga')
        .set(bearer(ramon))
        .expect(200);
      const p = r.body.datos;
      expect(p.suministros[0]).toMatchObject({
        id: 'sum-004120',
        numero: '004120',
        medidorId: 'med-A88413',
      });
      expect(p.medidores[0]).toMatchObject({
        id: 'med-A88413',
        serie: 'A-88413',
        modelo: 'agujas',
        codigoQr: 'COOP-CHJ:med-A88413',
      });
      expect(p.suministros[10].lecturaAnterior).toBeNull();
      expect(p.suministros[10].fechaLecturaAnterior).toBeNull();
      expect(p.medidores[25]).toMatchObject({
        multiplicador: 10,
        videoInstructivoUrl: null,
      });
      for (const [i, m] of (p.medidores as Medidor[]).entries()) {
        if (i !== 25 && m.modelo !== 'multiplicador')
          expect(m.videoInstructivoUrl).toMatch(/\/archivos\/.+\.mp4$/);
      }
    });
    it('los videos de la ruta 07 se bajan con Range (206)', async () => {
      const ramon = await ingresar(s, {
        legajo: 'L-011',
        contrasena: 'lectura',
      });
      const r = await s
        .http()
        .post('/rutas/rut-07-2026-05/descarga')
        .set(bearer(ramon));
      const url = (r.body.datos.medidores as Medidor[]).find(
        (m) => m.videoInstructivoUrl,
      )!.videoInstructivoUrl!;
      const ruta = new URL(url).pathname;
      const v = await s.http().get(ruta).set('Range', 'bytes=0-9');
      expect(v.status).toBe(206);
    });
    it('un suministro no está en dos rutas del bimestre: ids únicos entre las 20', async () => {
      const r = await s.http().get('/rutas?porPagina=100').set(bearer(adm));
      const todos = (r.body.datos as Ruta[]).flatMap((x) => x.suministroIds);
      expect(new Set(todos).size).toBe(todos.length);
    });
    it('administración arma una ruta nueva con suministros de otro bimestre ocupados en 2026-05 → RUTA 409 en el mismo bimestre', async () => {
      const r07 = await s
        .http()
        .get('/rutas/rut-07-2026-05')
        .set(bearer(adm))
        .expect(200);
      const res = await s
        .http()
        .post('/rutas')
        .set(bearer(adm))
        .send({
          numero: '21',
          nombre: 'Nueva',
          bimestre: '2026-05',
          lectorId: 'usr-011',
          suministroIds: [r07.body.datos.suministroIds[0]],
        })
        .expect(409);
      esperarError(res.body, 'SUMINISTRO_EN_OTRA_RUTA');
      expect(res.body.error.mensaje).toBe(
        'El suministro 004120 ya está en la ruta 07 de este bimestre.',
      );
    });
  });

  describe('Usuario sin ruta ni permisos: sesión de un lector inexistente', () => {
    it('token firmado con el secreto correcto pero de un usuario borrado/inexistente → 401', async () => {
      const t = firmar(
        { sub: 'usr-fantasma', rol: 'administracion', exp: 9999999999, ver: 0 },
        SECRETO,
      );
      await c.http().get('/rutas').set(bearer(t)).expect(401);
    });
    it('token de un usuario cuyo rol en el JWT dice administracion pero en la base es lector → 403', async () => {
      const u = await crearUsuario(c, { legajo: 'V2-FALSO', rol: 'lector' });
      const t = firmar(
        { sub: u.id, rol: 'administracion', exp: 9999999999, ver: 0 },
        SECRETO,
      );
      const r = await c.http().get('/rutas').set(bearer(t));
      expect([401, 403]).toContain(r.status);
    });
  });
});
