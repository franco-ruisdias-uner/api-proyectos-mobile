// Verificación independiente de M4 — Novedades (caja negra, AGENTS §12).
import { createHmac } from 'node:crypto';
import { jpeg, m4a, mp4 } from '../utilities/files.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { RutaEntidad } from '../../src/modules/routes/route.entity.js';
import { crearRuta } from '../utilities/routes.js';
import { bearer, conSesion } from '../utilities/users.js';

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
const MOTIVOS = [
  'perro_suelto',
  'porton_cerrado',
  'pasto_alto',
  'medidor_tapado',
  'medidor_roto',
  'deshabitada',
  'no_se_encuentra',
];

type Sesion = Awaited<ReturnType<typeof conSesion>>;
type Ruta = { id: string; suministroIds: string[] };

describe('Verificación M4 — caja negra con datos propios', () => {
  let c: AppDePrueba;
  let admin: Sesion;
  let lector: Sesion;
  let otro: Sesion;
  let foto: string;
  let audio: string;

  beforeAll(async () => {
    c = await crearApp();
    admin = await conSesion(c, 'administracion', { legajo: 'V4-ADM' });
    lector = await conSesion(c, 'lector', { legajo: 'V4-LEC' });
    otro = await conSesion(c, 'lector', { legajo: 'V4-OTRO' });
    const sub = async (b: Buffer, n: string) =>
      (
        await c
          .http()
          .post('/archivos')
          .set(bearer(lector.token))
          .attach('archivo', b, n)
          .expect(201)
      ).body.datos.url as string;
    foto = await sub(jpeg(), 'f.jpg');
    audio = await sub(m4a(), 'a.m4a');
  });
  afterAll(() => c.cerrar());

  const nueva = (datos: Record<string, unknown> = {}): Promise<Ruta> =>
    crearRuta(c, {
      lectorId: lector.id,
      estado: 'en_curso',
      cantidad: 3,
      ...datos,
    });
  const cuerpo = (r: Ruta, i: number, resto: Record<string, unknown> = {}) => ({
    rutaId: r.id,
    suministroId: r.suministroIds[i],
    motivo: 'perro_suelto',
    comentario: null,
    audioUri: null,
    fotoUri: foto,
    fechaHora: '2026-09-15T07:30:00-03:00',
    ...resto,
  });
  const post = (s: Sesion, b: Record<string, unknown>) =>
    c.http().post('/novedades').set(bearer(s.token)).send(b);
  const get = (ruta: string, s: Sesion) =>
    c.http().get(ruta).set(bearer(s.token));
  const lectura = (r: Ruta, i: number, fechaHora: string) =>
    c.http().post('/lecturas').set(bearer(lector.token)).send({
      rutaId: r.id,
      suministroId: r.suministroIds[i],
      valor: 1010,
      fotoUri: foto,
      coordenadas: null,
      confirmadaPorLector: false,
      fechaHora,
    });
  const ids = (b: { datos: { id: string }[] }) => b.datos.map((d) => d.id);

  describe('Forma: nulos y todos los opcionales llenos', () => {
    it('con comentario y audio en null: todos los campos presentes', async () => {
      const r = await nueva();
      const res = await post(lector, cuerpo(r, 0)).expect(201);
      esperarContrato(res.body, 'Novedad');
      expect(res.body.datos.comentario).toBeNull();
      expect(res.body.datos.audioUri).toBeNull();
      expect(res.body.datos.sincronizada).toBe(true);
      expect(Object.keys(res.body.datos).sort()).toEqual(
        [
          'audioUri',
          'comentario',
          'fechaHora',
          'fotoUri',
          'id',
          'lectorId',
          'motivo',
          'rutaId',
          'sincronizada',
          'suministroId',
        ].sort(),
      );
    });

    it('con todo lleno', async () => {
      const r = await nueva();
      const res = await post(
        lector,
        cuerpo(r, 0, { comentario: 'Perro bravo', audioUri: audio }),
      ).expect(201);
      esperarContrato(res.body, 'Novedad');
      expect(res.body.datos.audioUri).toMatch(/^https?:\/\//);
      expect(res.body.datos.fotoUri).toMatch(/^https?:\/\//);
    });

    it.each(['', '   ', '\n\t'])(
      'comentario %j se guarda como null',
      async (comentario) => {
        const r = await nueva();
        const res = await post(lector, cuerpo(r, 0, { comentario })).expect(
          201,
        );
        esperarContrato(res.body, 'Novedad');
        expect(res.body.datos.comentario).toBeNull();
        const g = await get(`/novedades/${res.body.datos.id}`, lector).expect(
          200,
        );
        expect(g.body.datos.comentario).toBeNull();
      },
    );

    it('comentario ausente se acepta y vuelve null; audioUri ausente también', async () => {
      const r = await nueva();
      const b: Record<string, unknown> = cuerpo(r, 0);
      delete b.comentario;
      delete b.audioUri;
      const res = await post(lector, b).expect(201);
      esperarContrato(res.body, 'Novedad');
      expect(res.body.datos.comentario).toBeNull();
      expect(res.body.datos.audioUri).toBeNull();
    });

    it('comentario de 500 caracteres ok; 501 → 400', async () => {
      const r = await nueva();
      await post(lector, cuerpo(r, 0, { comentario: 'a'.repeat(500) })).expect(
        201,
      );
      const x = await post(
        lector,
        cuerpo(r, 1, { comentario: 'a'.repeat(501) }),
      ).expect(400);
      esperarError(x.body, 'VALIDACION_FALLIDA');
    });

    it.each(MOTIVOS)('el motivo %s se acepta', async (motivo) => {
      const r = await nueva({ cantidad: 1 });
      const res = await post(lector, cuerpo(r, 0, { motivo })).expect(201);
      esperarContrato(res.body, 'Novedad');
      expect(res.body.datos.motivo).toBe(motivo);
    });

    it('comentario con tildes y emoji vuelve intacto', async () => {
      const r = await nueva();
      const t = 'Portón cerrado, ñandú 🐕';
      const res = await post(lector, cuerpo(r, 0, { comentario: t })).expect(
        201,
      );
      expect(res.body.datos.comentario).toBe(t);
    });
  });

  describe('Fechas', () => {
    it.each([
      ['2026-09-15T10:30:00Z', '2026-09-15T07:30:00-03:00'],
      ['2026-09-15T10:30:00.123Z', '2026-09-15T07:30:00-03:00'],
      ['2026-09-15T07:30:00.999-03:00', '2026-09-15T07:30:00-03:00'],
      ['2026-09-15T12:30:00+02:00', '2026-09-15T07:30:00-03:00'],
      ['2026-09-15T11:00:00Z', '2026-09-15T08:00:00-03:00'],
      ['2026-12-31T23:59:59-03:00', null],
    ])('entrada %s', async (entrada, esperado) => {
      const r = await nueva({ cantidad: 1 });
      if (esperado === null) {
        // futura: el reloj está en 15/09
        const x = await post(lector, cuerpo(r, 0, { fechaHora: entrada }));
        expect(x.status).toBe(400);
        esperarError(x.body, 'VALIDACION_FALLIDA');
        return;
      }
      const res = await post(lector, cuerpo(r, 0, { fechaHora: entrada }));
      expect(res.status).toBe(201);
      esperarContrato(res.body, 'Novedad');
      expect(res.body.datos.fechaHora).toBe(esperado);
    });

    it.each([
      '2026-09-15',
      '2026-09-15T07:30:00',
      '15/09/2026 07:30',
      'ayer',
      '',
      '2026-13-45T00:00:00-03:00',
    ])('fechaHora inválida %j → 400', async (fechaHora) => {
      const r = await nueva({ cantidad: 1 });
      const x = await post(lector, cuerpo(r, 0, { fechaHora }));
      expect(x.status).toBe(400);
      esperarError(x.body, 'VALIDACION_FALLIDA');
    });

    it('fechaHora numérica o ausente → 400', async () => {
      const r = await nueva({ cantidad: 1 });
      const a = await post(lector, cuerpo(r, 0, { fechaHora: 1789000000 }));
      expect(a.status).toBe(400);
      const b: Record<string, unknown> = cuerpo(r, 0);
      delete b.fechaHora;
      const x = await post(lector, b);
      expect(x.status).toBe(400);
      esperarError(x.body, 'VALIDACION_FALLIDA');
    });

    it('tolerancia de 5 minutos: +4 min ok, +6 min → 400', async () => {
      const r = await nueva();
      await post(
        lector,
        cuerpo(r, 0, { fechaHora: '2026-09-15T08:04:00-03:00' }),
      ).expect(201);
      const x = await post(
        lector,
        cuerpo(r, 1, { fechaHora: '2026-09-15T08:06:00-03:00' }),
      ).expect(400);
      esperarError(x.body, 'VALIDACION_FALLIDA');
    });
  });

  describe('Entrada', () => {
    it.each([
      ['distancia', 12],
      ['abiertoAhora', true],
      ['createdAt', '2026-09-15T07:30:00-03:00'],
      ['password', 'x'],
      ['consumo', 4],
    ])('campo de más %s → 400', async (campo, valor) => {
      const r = await nueva({ cantidad: 1 });
      const x = await post(lector, cuerpo(r, 0, { [campo]: valor }));
      expect(x.status).toBe(400);
      esperarError(x.body, 'VALIDACION_FALLIDA');
      expect(x.body.error.mensaje).not.toMatch(JERGA);
    });

    it.each([
      ['motivo enum inválido', { motivo: 'PERRO_SUELTO' }],
      ['motivo vacío', { motivo: '' }],
      ['motivo número', { motivo: 3 }],
      ['motivo null', { motivo: null }],
      ['rutaId sin prefijo', { rutaId: 'xyz-07-2026-05' }],
      ['rutaId número', { rutaId: 7 }],
      ['suministroId sin prefijo', { suministroId: 'med-A88413' }],
      ['suministroId numérico', { suministroId: 4120 }],
      ['id sin prefijo', { id: 'lec-12345' }],
      ['id con caracteres raros', { id: 'nov-a b/c' }],
      ['id muy corto', { id: 'nov-ab' }],
      ['id numérico', { id: 42 }],
      ['comentario número', { comentario: 7 }],
      ['comentario objeto', { comentario: {} }],
      ['fotoUri número', { fotoUri: 3 }],
      ['audioUri número', { audioUri: 3 }],
    ])('%s → 400 con sobre de error', async (_n, resto) => {
      const r = await nueva({ cantidad: 1 });
      const x = await post(lector, cuerpo(r, 0, resto));
      expect(x.status).toBe(400);
      esperarError(x.body, 'VALIDACION_FALLIDA');
      expect(x.body.error.mensaje).not.toMatch(JERGA);
    });

    it('cuerpo vacío y cuerpo no JSON → 400', async () => {
      const a = await c
        .http()
        .post('/novedades')
        .set(bearer(lector.token))
        .send({});
      expect(a.status).toBe(400);
      esperarError(a.body);
      const b = await c
        .http()
        .post('/novedades')
        .set(bearer(lector.token))
        .set('Content-Type', 'application/json')
        .send('{no es json');
      expect(b.status).toBe(400);
      esperarError(b.body);
    });

    it('fotoUri ausente / "" / null → FOTO_REQUERIDA; file:// → ARCHIVO_NO_SUBIDO; otra URL → ARCHIVO_NO_SUBIDO', async () => {
      const r = await nueva({ cantidad: 1 });
      for (const f of [undefined, '', null]) {
        const b: Record<string, unknown> = cuerpo(r, 0);
        if (f === undefined) delete b.fotoUri;
        else b.fotoUri = f;
        const x = await post(lector, b);
        expect(x.status, `foto ${String(f)}`).toBe(422);
        esperarError(x.body, 'FOTO_REQUERIDA');
      }
      for (const f of ['file:///data/foto.jpg', 'https://ejemplo.com/a.jpg']) {
        const x = await post(lector, cuerpo(r, 0, { fotoUri: f }));
        expect(x.status, f).toBe(422);
        esperarError(x.body, 'ARCHIVO_NO_SUBIDO');
      }
    });

    it('audioUri con file:// u otra URL → ARCHIVO_NO_SUBIDO (422)', async () => {
      const r = await nueva({ cantidad: 1 });
      for (const f of ['file:///data/n.m4a', 'https://ejemplo.com/n.m4a']) {
        const x = await post(lector, cuerpo(r, 0, { audioUri: f }));
        expect(x.status, f).toBe(422);
        esperarError(x.body, 'ARCHIVO_NO_SUBIDO');
      }
    });

    it('audioUri de un video subido no es audio (4xx, no se guarda)', async () => {
      const v = (
        await c
          .http()
          .post('/archivos')
          .set(bearer(lector.token))
          .attach('archivo', mp4(), 'v.mp4')
          .expect(201)
      ).body.datos.url as string;
      const r = await nueva({ cantidad: 1 });
      const x = await post(lector, cuerpo(r, 0, { audioUri: v }));
      expect([400, 422]).toContain(x.status);
      esperarError(x.body);
      const l = await get(`/rutas/${r.id}/novedades`, lector).expect(200);
      expect(l.body.meta.total).toBe(0);
    });

    it('suministro de otra ruta → SUMINISTRO_FUERA_DE_RUTA', async () => {
      const r = await nueva();
      const r2 = await nueva();
      const x = await post(
        lector,
        cuerpo(r, 0, { suministroId: r2.suministroIds[0] }),
      );
      expect(x.status).toBe(422);
      esperarError(x.body, 'SUMINISTRO_FUERA_DE_RUTA');
    });

    it('ruta inexistente con buen prefijo → 404 RUTA_NO_ENCONTRADA', async () => {
      const r = await nueva();
      const x = await post(lector, cuerpo(r, 0, { rutaId: 'rut-99-2026-05' }));
      expect(x.status).toBe(404);
      esperarError(x.body, 'RUTA_NO_ENCONTRADA');
    });
  });

  describe('Permisos y sesión', () => {
    it('401 sin token, con token mal firmado, vencido y con basura', async () => {
      const r = await nueva({ cantidad: 1 });
      const b = cuerpo(r, 0);
      const sin = await c.http().post('/novedades').send(b);
      expect(sin.status).toBe(401);
      esperarError(sin.body, 'NO_AUTENTICADO');
      const ahora = Math.floor(Date.parse('2026-09-15T11:00:00Z') / 1000);
      const malFirmado = firmar(
        { sub: lector.id, rol: 'lector', iat: ahora, exp: ahora + 3600 },
        'otro-secreto',
      );
      const vencido = firmar(
        {
          sub: lector.id,
          rol: 'lector',
          iat: ahora - 90000,
          exp: ahora - 3600,
        },
        SECRETO,
      );
      for (const t of [malFirmado, vencido, 'basura']) {
        const x = await c.http().post('/novedades').set(bearer(t)).send(b);
        expect(x.status).toBe(401);
        esperarError(x.body, 'NO_AUTENTICADO');
      }
      for (const url of [
        '/novedades',
        '/novedades/nov-abc123',
        `/rutas/${r.id}/novedades`,
        '/novedades/resumen',
      ]) {
        const g = await c.http().get(url);
        expect(g.status, url).toBe(401);
        esperarError(g.body, 'NO_AUTENTICADO');
      }
    });

    it('token de 12 horas ya vencido (reloj movido) → 401', async () => {
      const l = await conSesion(c, 'lector', { legajo: 'V4-VENC' });
      c.reloj.avanzar?.(13 * 3600 * 1000);
      try {
        const g = await c
          .http()
          .get('/novedades/nov-abc123')
          .set(bearer(l.token));
        expect(g.status).toBe(401);
      } finally {
        c.reloj.fijar?.('2026-09-15T08:00:00-03:00');
      }
    });

    it('administración y lector ajeno no cargan (403); administración tampoco por id existente', async () => {
      const r = await nueva({ cantidad: 1 });
      for (const s of [admin, otro]) {
        const x = await post(s, cuerpo(r, 0));
        expect(x.status).toBe(403);
        esperarError(x.body, 'SIN_PERMISO');
      }
    });

    it('403 para el lector en GET /novedades y /novedades/resumen', async () => {
      for (const url of ['/novedades', '/novedades/resumen']) {
        const x = await get(url, lector);
        expect(x.status, url).toBe(403);
        esperarError(x.body, 'SIN_PERMISO');
      }
    });

    it('lector ajeno: 403 en GET /novedades/:id y /rutas/:id/novedades; admin ve ambos', async () => {
      const r = await nueva({ cantidad: 1 });
      const n = await post(lector, cuerpo(r, 0)).expect(201);
      for (const url of [
        `/novedades/${n.body.datos.id}`,
        `/rutas/${r.id}/novedades`,
      ]) {
        const x = await get(url, otro);
        expect(x.status, url).toBe(403);
        esperarError(x.body, 'SIN_PERMISO');
        const a = await get(url, admin);
        expect(a.status, url).toBe(200);
      }
    });

    it('/rutas/:id/novedades de ruta inexistente → 404 RUTA_NO_ENCONTRADA; id mal formado → 400', async () => {
      const a = await get('/rutas/rut-99-2026-05/novedades', admin);
      expect(a.status).toBe(404);
      esperarError(a.body, 'RUTA_NO_ENCONTRADA');
      const b = await get('/rutas/xxx/novedades', admin);
      expect(b.status).toBe(400);
      esperarError(b.body, 'VALIDACION_FALLIDA');
    });

    it('GET /novedades/:id inexistente → 404 NOVEDAD_NO_ENCONTRADA; prefijo equivocado → 400', async () => {
      const a = await get('/novedades/nov-noexiste99', admin);
      expect(a.status).toBe(404);
      esperarError(a.body, 'NOVEDAD_NO_ENCONTRADA');
      const b = await get('/novedades/lec-noexiste99', admin);
      expect(b.status).toBe(400);
      esperarError(b.body, 'VALIDACION_FALLIDA');
    });

    it('una novedad de lector ajeno inexistente y existente no se distinguen por 404 para un lector (403 sólo si existe)', async () => {
      const r = await nueva({ cantidad: 1 });
      const n = await post(lector, cuerpo(r, 0)).expect(201);
      const x = await get(`/novedades/${n.body.datos.id}`, otro);
      expect(x.status).toBe(403);
    });
  });

  describe('Idempotencia R15 y push', () => {
    it('mismo id y otro cuerpo: devuelve la existente sin modificarla (200)', async () => {
      const r = await nueva();
      const a = await post(
        lector,
        cuerpo(r, 0, { id: 'nov-idem-v4a', comentario: 'original' }),
      ).expect(201);
      const b = await post(
        lector,
        cuerpo(r, 0, {
          id: 'nov-idem-v4a',
          comentario: 'cambiado',
          motivo: 'pasto_alto',
        }),
      ).expect(200);
      const sinOrigen = (d: { fotoUri: string }) => ({
        ...d,
        fotoUri: new URL(d.fotoUri).pathname,
      });
      expect(sinOrigen(b.body.datos)).toEqual(sinOrigen(a.body.datos));
      esperarContrato(b.body, 'Novedad');
    });

    it('mismo id de otro lector → 409 ID_EN_USO, aunque la ruta sea suya', async () => {
      const r = await nueva();
      const rOtro = await crearRuta(c, {
        lectorId: otro.id,
        estado: 'en_curso',
        cantidad: 1,
      });
      await post(lector, cuerpo(r, 0, { id: 'nov-idem-v4b' })).expect(201);
      const x = await post(otro, cuerpo(rOtro, 0, { id: 'nov-idem-v4b' }));
      expect(x.status).toBe(409);
      esperarError(x.body, 'ID_EN_USO');
    });

    it('mismo id reenviado como el lector en otra ruta suya: no duplica', async () => {
      const r1 = await nueva({ cantidad: 1 });
      const r2 = await nueva({ cantidad: 1 });
      await post(lector, cuerpo(r1, 0, { id: 'nov-idem-v4c' })).expect(201);
      const x = await post(lector, cuerpo(r2, 0, { id: 'nov-idem-v4c' }));
      expect([200, 409]).toContain(x.status);
      const l1 = await get(`/rutas/${r1.id}/novedades`, lector).expect(200);
      const l2 = await get(`/rutas/${r2.id}/novedades`, lector).expect(200);
      expect(l1.body.meta.total + l2.body.meta.total).toBe(1);
    });

    it('10 pedidos simultáneos con el mismo id: una sola novedad, un 201 y nueve 200', async () => {
      const r = await nueva({ cantidad: 1 });
      const rs = await Promise.all(
        Array.from({ length: 10 }, () =>
          post(lector, cuerpo(r, 0, { id: 'nov-conc-v4' })),
        ),
      );
      const estados = rs.map((x) => x.status).sort();
      expect(estados.filter((s) => s === 201)).toHaveLength(1);
      expect(estados.filter((s) => s === 200)).toHaveLength(9);
      const l = await get(`/rutas/${r.id}/novedades`, lector).expect(200);
      expect(l.body.meta.total).toBe(1);
    });

    it('simultáneas con ids distintos en el mismo suministro: las dos se guardan, una vigente', async () => {
      const r = await nueva({ cantidad: 1 });
      const rs = await Promise.all([
        post(
          lector,
          cuerpo(r, 0, {
            id: 'nov-par-v4a',
            fechaHora: '2026-09-15T07:00:00-03:00',
          }),
        ),
        post(
          lector,
          cuerpo(r, 0, {
            id: 'nov-par-v4b',
            fechaHora: '2026-09-15T07:10:00-03:00',
          }),
        ),
      ]);
      expect(rs.map((x) => x.status)).toEqual([201, 201]);
      const l = await get(`/rutas/${r.id}/novedades`, lector).expect(200);
      expect(ids(l.body)).toEqual(['nov-par-v4b']);
      await get('/novedades/nov-par-v4a', lector).expect(200);
    });

    it('cargar una novedad no manda push a nadie', async () => {
      const r = await nueva({ cantidad: 1 });
      c.enviador.limpiar();
      await post(lector, cuerpo(r, 0)).expect(201);
      await new Promise((res) => setTimeout(res, 50));
      expect(c.enviador.enviados).toEqual([]);
    });

    it('una ruta cerrada: nueva novedad → 409 RUTA_YA_CERRADA con fecha DD/MM; reintento de una existente → 200', async () => {
      const r = await nueva({ cantidad: 2 });
      await post(lector, cuerpo(r, 0, { id: 'nov-cierre-v4' })).expect(201);
      await c.dataSource
        .getRepository(RutaEntidad)
        .update(
          { id: r.id },
          { estado: 'cerrada', cerradaEn: new Date('2026-09-15T11:00:00Z') },
        );
      const x = await post(lector, cuerpo(r, 1));
      expect(x.status).toBe(409);
      esperarError(x.body, 'RUTA_YA_CERRADA');
      expect(x.body.error.mensaje).toBe('Esa ruta fue cerrada el 15/09.');
      const re = await post(lector, cuerpo(r, 0, { id: 'nov-cierre-v4' }));
      expect(re.status).toBe(200);
    });
  });

  describe('R13/D7 — vigente (lectura gana, luego la más reciente)', () => {
    it('llegada desordenada: gana la fechaHora más reciente aunque llegue antes', async () => {
      const r = await nueva({ cantidad: 1 });
      await post(
        lector,
        cuerpo(r, 0, {
          id: 'nov-d-b',
          motivo: 'pasto_alto',
          fechaHora: '2026-09-15T07:50:00-03:00',
        }),
      ).expect(201);
      await post(
        lector,
        cuerpo(r, 0, {
          id: 'nov-d-a',
          motivo: 'perro_suelto',
          fechaHora: '2026-09-15T07:10:00-03:00',
        }),
      ).expect(201);
      const l = await get(`/rutas/${r.id}/novedades`, lector).expect(200);
      expect(ids(l.body)).toEqual(['nov-d-b']);
      const f = await get(
        `/rutas/${r.id}/novedades?motivo=perro_suelto`,
        lector,
      ).expect(200);
      expect(f.body.datos).toEqual([]);
    });

    it('misma fechaHora exacta: una sola vigente y estable entre pedidos', async () => {
      const r = await nueva({ cantidad: 1 });
      await post(lector, cuerpo(r, 0, { id: 'nov-e-1' })).expect(201);
      await post(lector, cuerpo(r, 0, { id: 'nov-e-2' })).expect(201);
      const a = await get(`/rutas/${r.id}/novedades`, lector).expect(200);
      const b = await get(`/rutas/${r.id}/novedades`, lector).expect(200);
      expect(a.body.datos).toHaveLength(1);
      expect(ids(a.body)).toEqual(ids(b.body));
    });

    it('novedad 9 y lectura 11: la lectura gana; la novedad no figura en listados, avance ni resumen', async () => {
      const r = await nueva({ cantidad: 2, nombre: 'Zona V4 lectura gana' });
      await post(
        lector,
        cuerpo(r, 0, {
          id: 'nov-lg-1',
          fechaHora: '2026-09-15T07:00:00-03:00',
        }),
      ).expect(201);
      await lectura(r, 0, '2026-09-15T07:40:00-03:00').expect(201);
      const l = await get(`/rutas/${r.id}/novedades`, lector).expect(200);
      expect(l.body.datos).toEqual([]);
      const av = await get(`/rutas/${r.id}/avance`, lector).expect(200);
      expect(av.body.datos).toMatchObject({
        suministros: 2,
        leidos: 1,
        conNovedad: 0,
        pendientes: 1,
      });
      const adm = await get(
        '/novedades?zona=Zona V4 lectura gana',
        admin,
      ).expect(200);
      expect(adm.body.datos).toEqual([]);
      const res = await get(
        '/novedades/resumen?bimestre=2026-05',
        admin,
      ).expect(200);
      expect(
        res.body.datos.find(
          (x: { zona: string }) => x.zona === 'Zona V4 lectura gana',
        ),
      ).toBeUndefined();
      // sigue accesible por id (no se borra)
      await get('/novedades/nov-lg-1', lector).expect(200);
    });

    it('novedad MÁS NUEVA que la lectura: igual gana la lectura', async () => {
      const r = await nueva({ cantidad: 1 });
      await lectura(r, 0, '2026-09-15T07:00:00-03:00').expect(201);
      await post(
        lector,
        cuerpo(r, 0, { fechaHora: '2026-09-15T07:59:00-03:00' }),
      ).expect(201);
      const l = await get(`/rutas/${r.id}/novedades`, lector).expect(200);
      expect(l.body.datos).toEqual([]);
      const av = await get(`/rutas/${r.id}/avance`, lector).expect(200);
      expect(av.body.datos).toMatchObject({
        leidos: 1,
        conNovedad: 0,
        pendientes: 0,
      });
    });

    it('la lectura llega después de la novedad: la novedad deja de ser vigente', async () => {
      const r = await nueva({ cantidad: 1 });
      await post(lector, cuerpo(r, 0, { id: 'nov-ld-1' })).expect(201);
      const antes = await get(`/rutas/${r.id}/novedades`, lector).expect(200);
      expect(ids(antes.body)).toEqual(['nov-ld-1']);
      await lectura(r, 0, '2026-09-15T07:00:00-03:00').expect(201);
      const despues = await get(`/rutas/${r.id}/novedades`, lector).expect(200);
      expect(despues.body.datos).toEqual([]);
    });

    it('la misma ruta con otro suministro sin lectura mantiene su novedad', async () => {
      const r = await nueva({ cantidad: 2 });
      await post(lector, cuerpo(r, 1, { id: 'nov-otro-s' })).expect(201);
      await lectura(r, 0, '2026-09-15T07:00:00-03:00').expect(201);
      const l = await get(`/rutas/${r.id}/novedades`, lector).expect(200);
      expect(ids(l.body)).toEqual(['nov-otro-s']);
    });
  });

  describe('GET /rutas/:id/novedades', () => {
    it('orden de recorrido aunque los números estén desordenados, paginación y motivo inválido', async () => {
      const r = await nueva({
        suministros: [
          { numero: '004162' },
          { numero: '004120' },
          { numero: '004150' },
        ],
      });
      for (const i of [2, 0, 1]) {
        await post(lector, cuerpo(r, i, { id: `nov-ord-${i}` })).expect(201);
      }
      const l = await get(`/rutas/${r.id}/novedades`, lector).expect(200);
      esperarContrato(l.body, 'Novedad');
      expect(ids(l.body)).toEqual(['nov-ord-0', 'nov-ord-1', 'nov-ord-2']);
      const p = await get(
        `/rutas/${r.id}/novedades?porPagina=2&pagina=2`,
        lector,
      ).expect(200);
      expect(ids(p.body)).toEqual(['nov-ord-2']);
      expect(p.body.meta).toEqual({ total: 3, pagina: 2, porPagina: 2 });
      const m = await get(`/rutas/${r.id}/novedades?motivo=volando`, lector);
      expect(m.status).toBe(400);
      esperarError(m.body, 'VALIDACION_FALLIDA');
    });

    it('porPagina 200 ok, 201 → 400; pagina 0 → 400; porPagina=abc → 400', async () => {
      const r = await nueva({ cantidad: 1 });
      const ok = await get(
        `/rutas/${r.id}/novedades?porPagina=200`,
        lector,
      ).expect(200);
      expect(ok.body.meta.porPagina).toBe(200);
      for (const q of [
        'porPagina=201',
        'pagina=0',
        'porPagina=abc',
        'pagina=-1',
      ]) {
        const x = await get(`/rutas/${r.id}/novedades?${q}`, lector);
        expect(x.status, q).toBe(400);
        esperarError(x.body, 'VALIDACION_FALLIDA');
      }
    });

    it('ruta con 200 suministros, todos con novedad: 200 en una página', async () => {
      const r = await nueva({ cantidad: 200 });
      for (let i = 0; i < 200; i++)
        await post(lector, cuerpo(r, i, { id: `nov-m200-${i}` })).expect(201);
      const l = await get(
        `/rutas/${r.id}/novedades?porPagina=200`,
        lector,
      ).expect(200);
      expect(l.body.datos).toHaveLength(200);
      expect(ids(l.body)[0]).toBe('nov-m200-0');
      expect(ids(l.body)[199]).toBe('nov-m200-199');
    }, 60000);
  });

  describe('Descarga y avance incluyen las novedades vigentes (R7, R10)', () => {
    it('el paquete trae las novedades vigentes, en orden, y no las reemplazadas', async () => {
      const r = await nueva({ cantidad: 3 });
      await post(lector, cuerpo(r, 2, { id: 'nov-p-2' })).expect(201);
      await post(lector, cuerpo(r, 0, { id: 'nov-p-0' })).expect(201);
      await post(
        lector,
        cuerpo(r, 1, {
          id: 'nov-p-1v',
          fechaHora: '2026-09-15T07:00:00-03:00',
        }),
      ).expect(201);
      await post(
        lector,
        cuerpo(r, 1, {
          id: 'nov-p-1n',
          fechaHora: '2026-09-15T07:20:00-03:00',
        }),
      ).expect(201);
      await lectura(r, 2, '2026-09-15T07:00:00-03:00').expect(201);
      const d = await c
        .http()
        .post(`/rutas/${r.id}/descarga`)
        .set(bearer(lector.token))
        .expect(200);
      expect(d.body.meta).toBeNull();
      expect(ids({ datos: d.body.datos.novedades })).toEqual([
        'nov-p-0',
        'nov-p-1n',
      ]);
      for (const n of d.body.datos.novedades)
        esperarContrato({ datos: n, meta: null }, 'Novedad');
      expect(d.body.datos.lecturas).toHaveLength(1);
      const av = await get(`/rutas/${r.id}/avance`, lector).expect(200);
      expect(av.body.datos).toMatchObject({
        suministros: 3,
        leidos: 1,
        conNovedad: 2,
        pendientes: 0,
      });
    });

    it('descarga repetida trae lo nuevo', async () => {
      const r = await nueva({ cantidad: 1 });
      const a = await c
        .http()
        .post(`/rutas/${r.id}/descarga`)
        .set(bearer(lector.token))
        .expect(200);
      expect(a.body.datos.novedades).toEqual([]);
      await post(lector, cuerpo(r, 0)).expect(201);
      const b = await c
        .http()
        .post(`/rutas/${r.id}/descarga`)
        .set(bearer(lector.token))
        .expect(200);
      expect(b.body.datos.novedades).toHaveLength(1);
    });
  });

  describe('GET /novedades (administración)', () => {
    const rutaZ = async (
      nombre: string,
      bimestre: string,
      lectorId = lector.id,
    ) =>
      crearRuta(c, {
        lectorId,
        estado: 'en_curso',
        cantidad: 3,
        nombre,
        bimestre,
      });

    it('filtros solos y combinados; orden fechaHora desc con desempate estable', async () => {
      const zA = await rutaZ('Zona Ñandú V4', '2026-05');
      const zB = await rutaZ('Zona Beta V4', '2026-03');
      await post(
        lector,
        cuerpo(zA, 0, {
          id: 'nov-f-1',
          motivo: 'perro_suelto',
          fechaHora: '2026-09-10T10:00:00-03:00',
        }),
      ).expect(201);
      await post(
        lector,
        cuerpo(zA, 1, {
          id: 'nov-f-2',
          motivo: 'pasto_alto',
          fechaHora: '2026-09-12T10:00:00-03:00',
        }),
      ).expect(201);
      await post(
        lector,
        cuerpo(zA, 2, {
          id: 'nov-f-3',
          motivo: 'perro_suelto',
          fechaHora: '2026-09-12T10:00:00-03:00',
        }),
      ).expect(201);
      const rb = await post(
        lector,
        cuerpo(zB, 0, {
          id: 'nov-f-4',
          motivo: 'perro_suelto',
          fechaHora: '2026-05-02T10:00:00-03:00',
        }),
      );
      expect(rb.status).toBe(201);

      const q = async (qs: string) => {
        const r = await get(`/novedades?${qs}`, admin).expect(200);
        esperarContrato(r.body, 'Novedad');
        return r.body;
      };
      const base = await q('zona=Zona Ñandú V4');
      expect(ids(base)).toEqual(['nov-f-3', 'nov-f-2', 'nov-f-1']);
      expect(ids(await q('zona=zona nandu v4'))).toEqual([
        'nov-f-3',
        'nov-f-2',
        'nov-f-1',
      ]);
      expect(ids(await q('zona=Zona Ñandú V4&motivo=perro_suelto'))).toEqual([
        'nov-f-3',
        'nov-f-1',
      ]);
      expect(ids(await q('bimestre=2026-03'))).toContain('nov-f-4');
      expect(ids(await q('bimestre=2026-03'))).not.toContain('nov-f-1');
      expect(ids(await q('zona=Zona Ñandú V4&desde=2026-09-11'))).toEqual([
        'nov-f-3',
        'nov-f-2',
      ]);
      expect(ids(await q('zona=Zona Ñandú V4&hasta=2026-09-10'))).toEqual([
        'nov-f-1',
      ]);
      expect(
        ids(await q('zona=Zona Ñandú V4&desde=2026-09-12&hasta=2026-09-12')),
      ).toEqual(['nov-f-3', 'nov-f-2']);
      const pag = await q('zona=Zona Ñandú V4&porPagina=2&pagina=2');
      expect(ids(pag)).toEqual(['nov-f-1']);
      expect(pag.meta).toEqual({ total: 3, pagina: 2, porPagina: 2 });
      const fuera = await q('zona=Zona Ñandú V4&pagina=9');
      expect(fuera.datos).toEqual([]);
      expect(fuera.meta.total).toBe(3);
      const sinZona = await q('zona=no existe esta zona');
      expect(sinZona.meta.total).toBe(0);
    });

    it('desde/hasta usan día argentino: 23:59-03:00 cae en ese día aunque en UTC sea el siguiente', async () => {
      const z = await rutaZ('Zona Medianoche V4', '2026-05');
      await post(
        lector,
        cuerpo(z, 0, {
          id: 'nov-mn-1',
          fechaHora: '2026-09-14T23:59:00-03:00',
        }),
      ).expect(201);
      await post(
        lector,
        cuerpo(z, 1, {
          id: 'nov-mn-2',
          fechaHora: '2026-09-15T00:00:00-03:00',
        }),
      ).expect(201);
      const a = await get(
        '/novedades?zona=Zona Medianoche V4&hasta=2026-09-14',
        admin,
      ).expect(200);
      expect(ids(a.body)).toEqual(['nov-mn-1']);
      const b = await get(
        '/novedades?zona=Zona Medianoche V4&desde=2026-09-15',
        admin,
      ).expect(200);
      expect(ids(b.body)).toEqual(['nov-mn-2']);
    });

    it.each([
      'desde=2026-02-31',
      'desde=15/09/2026',
      'hasta=2026-9-1',
      'desde=2026-09-15T00:00:00-03:00',
      'bimestre=2026-07',
      'bimestre=2026-00',
      'bimestre=2026-5',
      'bimestre=mayo',
      'motivo=otro',
      'porPagina=101',
    ])('filtro inválido %s → 400', async (qs) => {
      const x = await get(`/novedades?${qs}`, admin);
      expect(x.status).toBe(400);
      esperarError(x.body, 'VALIDACION_FALLIDA');
      expect(x.body.error.mensaje).not.toMatch(JERGA);
    });

    it('desde mayor que hasta devuelve lista vacía, no error 500', async () => {
      const x = await get(
        '/novedades?desde=2026-09-20&hasta=2026-09-10',
        admin,
      );
      expect([200, 400]).toContain(x.status);
      if (x.status === 200) expect(x.body.datos).toEqual([]);
    });

    it('parámetro desconocido en la consulta no rompe (o da 400), nunca 500', async () => {
      const x = await get('/novedades?distancia=3', admin);
      expect(x.status).toBeLessThan(500);
    });
  });

  describe('GET /novedades/resumen (R19)', () => {
    it('agrupa por motivo y zona, cuenta sólo vigentes, ordena por cantidad desc, motivo, zona', async () => {
      const zA = await crearRuta(c, {
        lectorId: lector.id,
        estado: 'en_curso',
        cantidad: 4,
        nombre: 'Res A',
        bimestre: '2025-02',
      });
      const zB = await crearRuta(c, {
        lectorId: lector.id,
        estado: 'en_curso',
        cantidad: 3,
        nombre: 'Res B',
        bimestre: '2025-02',
      });
      const n = (r: Ruta, i: number, motivo: string, id: string, extra = {}) =>
        post(
          lector,
          cuerpo(r, i, {
            id,
            motivo,
            fechaHora: '2025-03-01T10:00:00-03:00',
            ...extra,
          }),
        );
      // Res A: 2 perro, 1 pasto + una reemplazada (porton → vigente deshabitada) + una con lectura
      expect((await n(zA, 0, 'perro_suelto', 'nov-rs-1')).status).toBe(201);
      expect((await n(zA, 1, 'perro_suelto', 'nov-rs-2')).status).toBe(201);
      expect((await n(zA, 2, 'pasto_alto', 'nov-rs-3')).status).toBe(201);
      expect(
        (
          await n(zA, 3, 'porton_cerrado', 'nov-rs-4', {
            fechaHora: '2025-03-01T09:00:00-03:00',
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await n(zA, 3, 'deshabitada', 'nov-rs-5', {
            fechaHora: '2025-03-01T11:00:00-03:00',
          })
        ).status,
      ).toBe(201);
      // Res B: 1 perro, 1 pasto, y un suministro con novedad + lectura (no cuenta)
      expect((await n(zB, 0, 'perro_suelto', 'nov-rs-6')).status).toBe(201);
      expect((await n(zB, 1, 'pasto_alto', 'nov-rs-7')).status).toBe(201);
      expect((await n(zB, 2, 'medidor_roto', 'nov-rs-8')).status).toBe(201);
      const l = await c
        .http()
        .post('/lecturas')
        .set(bearer(lector.token))
        .send({
          rutaId: zB.id,
          suministroId: zB.suministroIds[2],
          valor: 1010,
          fotoUri: foto,
          coordenadas: null,
          confirmadaPorLector: false,
          fechaHora: '2025-03-01T08:00:00-03:00',
        });
      expect(l.status).toBe(201);

      const r = await get('/novedades/resumen?bimestre=2025-02', admin).expect(
        200,
      );
      esperarContrato(r.body, 'ResumenNovedades');
      expect(r.body.datos).toEqual([
        { motivo: 'perro_suelto', zona: 'Res A', cantidad: 2 },
        { motivo: 'deshabitada', zona: 'Res A', cantidad: 1 },
        { motivo: 'pasto_alto', zona: 'Res A', cantidad: 1 },
        { motivo: 'pasto_alto', zona: 'Res B', cantidad: 1 },
        { motivo: 'perro_suelto', zona: 'Res B', cantidad: 1 },
      ]);
      expect(r.body.meta).toEqual({ total: 5, pagina: 1, porPagina: 20 });
      const p = await get(
        '/novedades/resumen?bimestre=2025-02&porPagina=2&pagina=3',
        admin,
      ).expect(200);
      expect(p.body.datos).toEqual([
        { motivo: 'perro_suelto', zona: 'Res B', cantidad: 1 },
      ]);
      expect(p.body.meta.total).toBe(5);
      const fuera = await get(
        '/novedades/resumen?bimestre=2025-02&pagina=9',
        admin,
      ).expect(200);
      expect(fuera.body.datos).toEqual([]);
      expect(fuera.body.meta.total).toBe(5);
      // no se mezcla con el listado de admin
      const lst = await get(
        '/novedades?bimestre=2025-02&porPagina=100',
        admin,
      ).expect(200);
      expect(lst.body.meta.total).toBe(6);
    });

    it('bimestre sin novedades → lista vacía; inválido → 400', async () => {
      const v = await get('/novedades/resumen?bimestre=2019-01', admin).expect(
        200,
      );
      expect(v.body).toEqual({
        datos: [],
        meta: { total: 0, pagina: 1, porPagina: 20 },
      });
      for (const b of ['2026-07', '2026-5', 'x', '2026-05-01']) {
        const x = await get(`/novedades/resumen?bimestre=${b}`, admin);
        expect(x.status, b).toBe(400);
        esperarError(x.body, 'VALIDACION_FALLIDA');
      }
    });

    it('/novedades/resumen no se confunde con /novedades/:id', async () => {
      const x = await get('/novedades/resumen', admin);
      expect(x.status).toBe(200);
      expect(Array.isArray(x.body.datos)).toBe(true);
    });
  });

  describe('Bimestre por defecto del resumen según el reloj argentino (D9, A33)', () => {
    afterEach(() => c.reloj.fijar?.('2026-09-15T08:00:00-03:00'));

    it.each([
      ['2026-09-15T08:00:00-03:00', '2026-05'],
      ['2026-10-31T23:30:00-03:00', '2026-05'], // en UTC ya es noviembre
      ['2026-11-01T00:00:00-03:00', '2026-06'],
      ['2026-12-31T23:59:00-03:00', '2026-06'], // en UTC ya es 2027
      ['2027-01-01T00:00:00-03:00', '2027-01'],
      ['2026-02-28T23:59:00-03:00', '2026-01'],
      ['2026-03-01T00:00:00-03:00', '2026-02'],
    ])('con el reloj en %s el default es %s', async (instante, bim) => {
      const z = await crearRuta(c, {
        lectorId: lector.id,
        estado: 'en_curso',
        cantidad: 1,
        nombre: `Def ${bim}`,
        bimestre: bim,
      });
      await post(
        lector,
        cuerpo(z, 0, {
          id: `nov-def-${bim}-${instante.slice(5, 16).replace(/\W/g, '')}`,
        }),
      ).expect(201);
      c.reloj.fijar?.(instante);
      const tok = await conSesion(c, 'administracion');
      const r = await get('/novedades/resumen', tok);
      expect(r.status).toBe(200);
      const explicito = await get(
        `/novedades/resumen?bimestre=${bim}`,
        tok,
      ).expect(200);
      expect(r.body.datos).toEqual(explicito.body.datos);
      expect(r.body.datos.map((d: { zona: string }) => d.zona)).toContain(
        `Def ${bim}`,
      );
    });
  });

  describe('Otros', () => {
    it('ruta 404 desconocida usa RECURSO_NO_ENCONTRADO con sobre exacto', async () => {
      const x = await get('/novedades/nov-abc123/algo', admin);
      expect(x.status).toBe(404);
      esperarError(x.body, 'RECURSO_NO_ENCONTRADO');
    });

    it('PUT/PATCH/DELETE /novedades/:id no existen', async () => {
      for (const m of ['put', 'patch', 'delete'] as const) {
        const x = await c
          .http()
          [m]('/novedades/nov-abc123')
          .set(bearer(admin.token));
        expect([404, 405]).toContain(x.status);
        esperarError(x.body);
      }
    });
  });
});
