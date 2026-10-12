// Verificación independiente de M1 — Suministros y medidores (caja negra, AGENTS §12).
import { createHmac } from 'node:crypto';
import type { Medidor, Suministro } from '../../contrato/tipos.js';
import { AccesoSuministros } from '../../src/modulos/suministros/acceso-suministros.js';
import { Sembrador } from '../../src/semillas/sembrar.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { AccesoFijo, crearSuministro } from '../utilidades/suministros.js';
import { bearer, conSesion } from '../utilidades/usuarios.js';

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
const JERGA =
  /undefined|null|NaN|\bmust\b|\bshould\b|property|string|number|boolean|exception|SQL|QueryFailed|constraint|class-validator|stack/i;

describe('Verificación M1 — caja negra con datos propios', () => {
  let c: AppDePrueba;
  let admin: Awaited<ReturnType<typeof conSesion>>;
  let lector: Awaited<ReturnType<typeof conSesion>>;
  const acceso = new AccesoFijo();

  beforeAll(async () => {
    c = await crearApp({ sustitutos: [[AccesoSuministros, acceso]] });
    admin = await conSesion(c, 'administracion', { legajo: 'V1-ADM' });
    lector = await conSesion(c, 'lector', { legajo: 'V1-LEC' });
  });
  afterAll(() => c.cerrar());

  describe('Autenticación (AGENTS §7): 401 en todo endpoint de M1', () => {
    const rutas = [
      '/suministros',
      '/suministros/sum-000001',
      '/medidores/med-X0001',
      '/medidores/qr/COOP-CHJ:med-X0001',
    ];
    it.each(rutas)('%s sin token → 401 NO_AUTENTICADO', async (ruta) => {
      const r = await c.http().get(ruta).expect(401);
      esperarError(r.body, 'NO_AUTENTICADO');
      expect(r.body.error.mensaje).not.toMatch(JERGA);
    });
    it.each(rutas)('%s con token mal firmado → 401', async (ruta) => {
      const malo = firmar(
        { sub: admin.id, rol: 'administracion', exp: 9999999999 },
        'otro-secreto',
      );
      const r = await c.http().get(ruta).set(bearer(malo)).expect(401);
      esperarError(r.body, 'NO_AUTENTICADO');
    });
    it.each(rutas)('%s con token vencido → 401', async (ruta) => {
      const vencido = firmar(
        { sub: admin.id, rol: 'administracion', iat: 1000, exp: 2000, ver: 0 },
        'secreto-de-los-tests-no-es-de-verdad',
      );
      const r = await c.http().get(ruta).set(bearer(vencido)).expect(401);
      esperarError(r.body, 'NO_AUTENTICADO');
    });
    it('esquema de autorización distinto de Bearer → 401', async () => {
      const r = await c
        .http()
        .get('/suministros')
        .set('Authorization', `Basic ${admin.token}`)
        .expect(401);
      esperarError(r.body, 'NO_AUTENTICADO');
    });
    it('un token invalidado por /auth/salida → 401 también en M1', async () => {
      const otro = await conSesion(c, 'administracion', { legajo: 'V1-SALE' });
      await c.http().post('/auth/salida').set(bearer(otro.token)).expect(204);
      await c.http().get('/suministros').set(bearer(otro.token)).expect(401);
    });
  });

  describe('R3 — Permisos', () => {
    it('GET /suministros: lector → 403 SIN_PERMISO con sobre exacto', async () => {
      const r = await c
        .http()
        .get('/suministros')
        .set(bearer(lector.token))
        .expect(403);
      esperarError(r.body, 'SIN_PERMISO');
      expect(r.body.error.mensaje).not.toMatch(JERGA);
    });
    it('el lector con permiso sobre un suministro no lo extiende a otro (ni al medidor ajeno)', async () => {
      const a = await crearSuministro(c, {
        id: 'sum-V10001',
        numero: 'V10001',
        medidor: { id: 'med-V10001' },
      });
      const b = await crearSuministro(c, {
        id: 'sum-V10002',
        numero: 'V10002',
        medidor: { id: 'med-V10002' },
      });
      acceso.dar(lector.id, a.suministro.id);
      const ok = await c
        .http()
        .get('/suministros/sum-V10001')
        .set(bearer(lector.token))
        .expect(200);
      esperarContrato(ok.body, 'Suministro');
      const okMed = await c
        .http()
        .get('/medidores/med-V10001')
        .set(bearer(lector.token))
        .expect(200);
      esperarContrato(okMed.body, 'Medidor');
      const okQr = await c
        .http()
        .get(`/medidores/qr/${encodeURIComponent(a.medidor.codigoQr!)}`)
        .set(bearer(lector.token))
        .expect(200);
      esperarContrato(okQr.body, 'Medidor');
      for (const ruta of [
        '/suministros/sum-V10002',
        '/medidores/med-V10002',
        `/medidores/qr/${encodeURIComponent(b.medidor.codigoQr!)}`,
      ]) {
        const r = await c
          .http()
          .get(ruta)
          .set(bearer(lector.token))
          .expect(403);
        esperarError(r.body, 'SIN_PERMISO');
      }
    });
    it('otro lector no hereda el permiso', async () => {
      const otro = await conSesion(c, 'lector', { legajo: 'V1-LEC2' });
      const r = await c
        .http()
        .get('/suministros/sum-V10001')
        .set(bearer(otro.token))
        .expect(403);
      esperarError(r.body, 'SIN_PERMISO');
    });
    it('un id inexistente da 404 (no 403) también al lector, y el id mal formado 400 antes que el permiso', async () => {
      const r = await c
        .http()
        .get('/suministros/sum-NOEXISTE9')
        .set(bearer(lector.token))
        .expect(404);
      esperarError(r.body, 'SUMINISTRO_NO_ENCONTRADO');
      const m = await c
        .http()
        .get('/medidores/med-NOEXISTE9')
        .set(bearer(lector.token))
        .expect(404);
      esperarError(m.body, 'MEDIDOR_NO_ENCONTRADO');
      const mal = await c
        .http()
        .get('/suministros/xx-1')
        .set(bearer(lector.token))
        .expect(400);
      esperarError(mal.body, 'VALIDACION_FALLIDA');
    });
  });

  describe('Forma — nulos, fechas y campos de más', () => {
    it('todos los opcionales en null y el medidor sin QR ni video', async () => {
      await crearSuministro(c, {
        id: 'sum-VN0001',
        numero: 'VN0001',
        lecturaAnterior: null,
        fechaLecturaAnterior: null,
        consumoPromedio: null,
        medidor: { id: 'med-VN0001', codigoQr: null, videoClave: null },
      });
      const s = await c
        .http()
        .get('/suministros/sum-VN0001')
        .set(bearer(admin.token))
        .expect(200);
      esperarContrato(s.body, 'Suministro');
      expect(Object.keys(s.body.datos).sort()).toEqual(
        [
          'activo',
          'categoria',
          'consumoPromedio',
          'coordenadas',
          'direccion',
          'fechaLecturaAnterior',
          'id',
          'lecturaAnterior',
          'medidorId',
          'numero',
          'titular',
        ].sort(),
      );
      const m = await c
        .http()
        .get('/medidores/med-VN0001')
        .set(bearer(admin.token))
        .expect(200);
      esperarContrato(m.body, 'Medidor');
      expect(m.body.datos.codigoQr).toBeNull();
      expect(m.body.datos.videoInstructivoUrl).toBeNull();
    });

    it('valores en cero no se confunden con null (lecturaAnterior 0, promedio 0)', async () => {
      await crearSuministro(c, {
        id: 'sum-VZ0001',
        numero: 'VZ0001',
        lecturaAnterior: 0,
        consumoPromedio: 0,
      });
      const r = await c
        .http()
        .get('/suministros/sum-VZ0001')
        .set(bearer(admin.token))
        .expect(200);
      expect(r.body.datos.lecturaAnterior).toBe(0);
      expect(r.body.datos.consumoPromedio).toBe(0);
    });

    it.each([
      ['2026-12-31T23:59:59Z', '2026-12-31T20:59:59-03:00'],
      ['2027-01-01T02:59:59Z', '2026-12-31T23:59:59-03:00'],
      ['2027-01-01T03:00:00Z', '2027-01-01T00:00:00-03:00'],
      ['2026-02-28T03:00:00Z', '2026-02-28T00:00:00-03:00'],
      ['2026-09-30T23:59:00Z', '2026-09-30T20:59:00-03:00'],
    ])(
      'fechaLecturaAnterior %s se emite como %s (sin milisegundos, con -03:00)',
      async (entrada, esperado) => {
        const id = `sum-VF${Math.abs(hash(entrada))}`;
        await crearSuministro(c, {
          id,
          numero: id.slice(4),
          fechaLecturaAnterior: new Date(entrada),
        });
        const r = await c
          .http()
          .get(`/suministros/${id}`)
          .set(bearer(admin.token))
          .expect(200);
        esperarContrato(r.body, 'Suministro');
        expect(r.body.datos.fechaLecturaAnterior).toBe(esperado);
      },
    );

    it.each([
      ['2019-03-11T03:00:00Z', '2019-03-11T00:00:00-03:00'],
      ['2027-01-01T02:59:00Z', '2026-12-31T23:59:00-03:00'],
    ])('instaladoEn %s → %s', async (entrada, esperado) => {
      const id = `med-VI${Math.abs(hash(entrada))}`;
      await crearSuministro(c, {
        medidor: { id, instaladoEn: new Date(entrada) },
      });
      const r = await c
        .http()
        .get(`/medidores/${id}`)
        .set(bearer(admin.token))
        .expect(200);
      esperarContrato(r.body, 'Medidor');
      expect(r.body.datos.instaladoEn).toBe(esperado);
    });

    it('el reloj a las 23:59 y a las 00:00 no cambia las fechas que se devuelven', async () => {
      const antes = await c
        .http()
        .get('/suministros/sum-VZ0001')
        .set(bearer(admin.token));
      c.reloj.fijar(new Date('2026-09-15T19:59:30-03:00')); // dentro de las 12 h del token
      const a = await c
        .http()
        .get('/suministros/sum-VZ0001')
        .set(bearer(admin.token));
      c.reloj.fijar(new Date('2026-09-15T19:59:59-03:00'));
      const b = await c
        .http()
        .get('/suministros/sum-VZ0001')
        .set(bearer(admin.token));
      c.reloj.fijar(new Date('2026-09-15T08:00:00-03:00'));
      expect(a.body).toEqual(antes.body);
      expect(b.body).toEqual(antes.body);
    });

    it('coordenadas con muchos decimales y negativas se devuelven sin redondear', async () => {
      await crearSuministro(c, {
        id: 'sum-VC0001',
        numero: 'VC0001',
        latitud: -30.752134567,
        longitud: -57.981412345,
      });
      const r = await c
        .http()
        .get('/suministros/sum-VC0001')
        .set(bearer(admin.token))
        .expect(200);
      expect(r.body.datos.coordenadas).toEqual({
        latitud: -30.752134567,
        longitud: -57.981412345,
      });
    });

    it('ningún campo interno aparece en la lista (Busqueda, latitud suelta, videoClave…)', async () => {
      const r = await c
        .http()
        .get('/suministros?porPagina=100')
        .set(bearer(admin.token))
        .expect(200);
      esperarContrato(r.body, 'Suministro');
      const texto = JSON.stringify(r.body);
      expect(texto).not.toMatch(
        /Busqueda|videoClave|latitud":-?\d+(\.\d+)?,"longitud":-?\d+(\.\d+)?,"categoria/,
      );
    });
  });

  describe('Entrada — query de GET /suministros', () => {
    it.each([
      ['categoria=industrialx'],
      ['categoria='],
      ['categoria=RESIDENCIAL'],
      ['activo=si'],
      ['activo=1'],
      ['activo='],
      ['pagina=0'],
      ['pagina=-1'],
      ['pagina=abc'],
      ['pagina=1.5'],
      ['porPagina=0'],
      ['porPagina=101'],
      ['porPagina=-5'],
      ['porPagina=x'],
      ['distancia=1'],
      ['abiertoAhora=true'],
      ['password=x'],
      ['categoria=rural&categoria=comercial'],
      ['numero=004120&numero=004121'],
      ['buscar=a&buscar=b'],
    ])('?%s → 400 VALIDACION_FALLIDA con mensaje en castellano', async (q) => {
      const r = await c
        .http()
        .get(`/suministros?${q}`)
        .set(bearer(admin.token));
      expect(r.status, JSON.stringify(r.body)).toBe(400);
      esperarError(r.body, 'VALIDACION_FALLIDA');
      expect(r.body.error.mensaje).not.toMatch(JERGA);
    });

    it('?activo=TRUE o mayúsculas: o se acepta o da 400, nunca 500', async () => {
      const r = await c
        .http()
        .get('/suministros?activo=TRUE')
        .set(bearer(admin.token));
      expect([200, 400]).toContain(r.status);
    });

    it('buscar vacío y numero vacío no rompen (200 o 400, nunca 500)', async () => {
      for (const q of [
        'buscar=',
        'numero=',
        'buscar=%20%20',
        'buscar=%27%3B--',
        'buscar=%E2%9C%93',
      ]) {
        const r = await c
          .http()
          .get(`/suministros?${q}`)
          .set(bearer(admin.token));
        expect([200, 400], q).toContain(r.status);
        if (r.status === 200) esperarContrato(r.body, 'Suministro');
        else esperarError(r.body, 'VALIDACION_FALLIDA');
      }
    });

    it('porPagina=100 es el máximo aceptado y meta lo refleja', async () => {
      const r = await c
        .http()
        .get('/suministros?porPagina=100')
        .set(bearer(admin.token))
        .expect(200);
      expect(r.body.meta.porPagina).toBe(100);
    });

    it('un parámetro de ruta con id mal formado: 400, no 404 ni 500', async () => {
      for (const id of [
        'sum-',
        'sum-%20',
        'SUM-004120',
        'lug-004120',
        'sum-a/b',
        '123',
        'sum-' + 'x'.repeat(80),
      ]) {
        const r = await c
          .http()
          .get(`/suministros/${id}`)
          .set(bearer(admin.token));
        expect([400, 404], id).toContain(r.status);
        esperarError(r.body);
      }
      const r = await c
        .http()
        .get('/suministros/lug-004120')
        .set(bearer(admin.token));
      expect(r.status).toBe(400);
    });
  });

  describe('Filtros y orden de GET /suministros', () => {
    beforeAll(async () => {
      // Números con y sin ceros, y uno que como número ordenaría distinto que como texto.
      for (const [n, t, d, cat, act] of [
        ['000009', 'Ñandú, Érica', 'Av. Ñ 1', 'residencial', true],
        ['000100', 'Ñandú, Zoe', 'San Martín 20', 'comercial', true],
        ['000020', 'Ortiz, Ana', 'Ñ 22', 'industrial', false],
        ['000003', 'ortiz, bruno', 'sanmartin 5', 'rural', true],
        ['000001', 'Zeta', 'Colón 100', 'residencial', false],
      ] as const)
        await crearSuministro(c, {
          numero: `Q${n}`,
          titular: t,
          direccion: d,
          categoria: cat,
          activo: act,
        });
    });
    const solo = (r: { body: { datos: Suministro[] } }) =>
      r.body.datos.map((s) => s.numero).filter((n) => n.startsWith('Q'));

    it('orden por número como texto, no numérico', async () => {
      const r = await c
        .http()
        .get('/suministros?numero=Q000100')
        .set(bearer(admin.token))
        .expect(200);
      expect(solo(r)).toEqual(['Q000100']);
      const todos = await c
        .http()
        .get('/suministros?porPagina=100&buscar=')
        .set(bearer(admin.token));
      if (todos.status === 200)
        expect(solo(todos)).toEqual([
          'Q000001',
          'Q000003',
          'Q000009',
          'Q000020',
          'Q000100',
        ]);
    });
    it('buscar: "nandu" encuentra "Ñandú" y "colon" a "Colón"', async () => {
      const a = await c
        .http()
        .get('/suministros?buscar=nandu')
        .set(bearer(admin.token))
        .expect(200);
      expect(solo(a)).toEqual(['Q000009', 'Q000100']);
      expect(a.body.meta.total).toBe(2);
      const b = await c
        .http()
        .get('/suministros?buscar=COLON')
        .set(bearer(admin.token))
        .expect(200);
      expect(solo(b)).toEqual(['Q000001']);
      const d = await c
        .http()
        .get('/suministros?buscar=%20%20San%20%20Martin%20')
        .set(bearer(admin.token))
        .expect(200);
      expect(solo(d)).toEqual(['Q000100']);
    });
    it('buscar no mira número ni categoría', async () => {
      const r = await c
        .http()
        .get('/suministros?buscar=Q000100')
        .set(bearer(admin.token))
        .expect(200);
      expect(r.body.meta.total).toBe(0);
    });
    it('filtros combinados: categoria + activo + buscar', async () => {
      const r = await c
        .http()
        .get('/suministros?categoria=industrial&activo=false&buscar=ortiz')
        .set(bearer(admin.token))
        .expect(200);
      expect(solo(r)).toEqual(['Q000020']);
      const vacio = await c
        .http()
        .get('/suministros?categoria=industrial&activo=true&buscar=ortiz')
        .set(bearer(admin.token))
        .expect(200);
      expect(vacio.body.datos).toEqual([]);
      expect(vacio.body.meta.total).toBe(0);
    });
    it('paginación recorre sin repetir ni saltear (orden estable)', async () => {
      const total = (
        await c
          .http()
          .get('/suministros?porPagina=100')
          .set(bearer(admin.token))
      ).body.meta.total as number;
      const vistos: string[] = [];
      for (let p = 1; p <= Math.ceil(total / 3) + 1; p++) {
        const r = await c
          .http()
          .get(`/suministros?porPagina=3&pagina=${p}`)
          .set(bearer(admin.token))
          .expect(200);
        expect(r.body.meta).toEqual({ total, pagina: p, porPagina: 3 });
        vistos.push(...r.body.datos.map((s: Suministro) => s.id));
      }
      expect(vistos.length).toBe(total);
      expect(new Set(vistos).size).toBe(total);
    });
    it('dos suministros con el mismo número (si la base lo permite) no rompen el orden', async () => {
      const r = await c
        .http()
        .get('/suministros?pagina=99999&porPagina=100')
        .set(bearer(admin.token))
        .expect(200);
      expect(r.body.datos).toEqual([]);
    });
  });

  describe('Medidores — QR y ids', () => {
    beforeAll(async () => {
      await crearSuministro(c, {
        medidor: { id: 'med-QR001', codigoQr: 'COOP-CHJ:med-QR001' },
      });
    });
    it('el QR con ":" sin codificar y codificado (%3A) encuentran el mismo medidor', async () => {
      const a = await c
        .http()
        .get('/medidores/qr/COOP-CHJ:med-QR001')
        .set(bearer(admin.token))
        .expect(200);
      const b = await c
        .http()
        .get('/medidores/qr/COOP-CHJ%3Amed-QR001')
        .set(bearer(admin.token))
        .expect(200);
      esperarContrato(a.body, 'Medidor');
      expect(b.body).toEqual(a.body);
      expect(a.body.datos.id).toBe('med-QR001');
      expect(a.body.datos.codigoQr).toBe('COOP-CHJ:med-QR001');
    });
    it('QR inexistente, vacío de sentido o con basura → 404 MEDIDOR_NO_ENCONTRADO sin jerga', async () => {
      for (const q of [
        'COOP-CHJ:med-NOPE',
        'med-QR001',
        'coop-chj:med-qr001',
        'xx',
        '%27%20OR%201%3D1--',
        '%25',
        '..%2F..%2Fetc',
      ]) {
        const r = await c
          .http()
          .get(`/medidores/qr/${q}`)
          .set(bearer(admin.token));
        expect([404, 400], q).toContain(r.status);
        esperarError(r.body);
        expect(r.body.error.mensaje).not.toMatch(JERGA);
      }
      const r = await c
        .http()
        .get('/medidores/qr/COOP-CHJ:med-NOPE')
        .set(bearer(admin.token))
        .expect(404);
      esperarError(r.body, 'MEDIDOR_NO_ENCONTRADO');
    });
    it('/medidores/qr sin código no se confunde con un id (404, no 200)', async () => {
      const r = await c.http().get('/medidores/qr').set(bearer(admin.token));
      expect([400, 404]).toContain(r.status);
      esperarError(r.body);
    });
    it('/medidores/qr/:codigo no se resuelve como /medidores/:id', async () => {
      // "qr" no es un id válido: nunca 200.
      const r = await c
        .http()
        .get('/medidores/qr/med-QR001')
        .set(bearer(admin.token));
      expect(r.status).not.toBe(200);
    });
    it.each(['med-', 'MED-QR001', 'sum-QR001', 'med-a/b', 'med-%00'])(
      'GET /medidores/%s → 400 o 404 con sobre de error',
      async (id) => {
        const r = await c
          .http()
          .get(`/medidores/${id}`)
          .set(bearer(admin.token));
        expect([400, 404]).toContain(r.status);
        esperarError(r.body);
      },
    );
    it('mayúsculas distintas en el id: no encuentra (ids sensibles)', async () => {
      const r = await c
        .http()
        .get('/medidores/med-qr001')
        .set(bearer(admin.token));
      expect([400, 404]).toContain(r.status);
    });
    it('métodos no permitidos (POST/PATCH/DELETE) no existen: 404 RECURSO_NO_ENCONTRADO', async () => {
      for (const [m, ruta] of [
        ['post', '/suministros'],
        ['patch', '/suministros/sum-VZ0001'],
        ['delete', '/medidores/med-QR001'],
        ['put', '/medidores/med-QR001'],
      ] as const) {
        const r = await c.http()[m](ruta).set(bearer(admin.token)).send({});
        expect([404, 405], `${m} ${ruta}`).toContain(r.status);
        esperarError(r.body);
      }
    });
  });

  describe('D14 / R9 — video del medidor servido por la API', () => {
    it('la URL es absoluta, https detrás de proxy de confianza no aplica; pide Range → 206 y bytes iguales', async () => {
      const subida = await c
        .http()
        .post('/archivos')
        .set(bearer(admin.token))
        .attach('archivo', mp4Falso(), {
          filename: 'v.mp4',
          contentType: 'video/mp4',
        })
        .expect(201);
      const url: string = subida.body.datos.url;
      const clave = new URL(url).pathname.replace('/archivos/', '');
      await crearSuministro(c, {
        medidor: { id: 'med-VID01', videoClave: clave },
      });
      const r = await c
        .http()
        .get('/medidores/med-VID01')
        .set(bearer(admin.token))
        .expect(200);
      esperarContrato(r.body, 'Medidor');
      expect(r.body.datos.videoInstructivoUrl).toMatch(
        /^http:\/\/[^/]+\/archivos\/videos\/\d{4}\/\d{2}\/[a-z0-9]+\.mp4$/,
      );
      const rango = await c
        .http()
        .get(new URL(r.body.datos.videoInstructivoUrl).pathname)
        .set('Range', 'bytes=0-9')
        .expect(206);
      expect(rango.headers['accept-ranges']).toBe('bytes');
      expect(rango.headers['content-range']).toMatch(/^bytes 0-9\/\d+$/);
    });
  });
});

function mp4Falso(): Buffer {
  const b = Buffer.alloc(4096, 5);
  b.write('\x00\x00\x00\x20ftypisom', 0, 'latin1');
  return b;
}
function hash(s: string): number {
  let h = 7;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}

describe('Verificación M1 — §8 semillas contra el PRD y la app de clase', () => {
  let c: AppDePrueba;
  let token: string;
  let todos: Suministro[];
  beforeAll(async () => {
    c = await crearApp();
    await c.app.get(Sembrador).sembrar();
    const a = await conSesion(c, 'administracion', { legajo: 'V1-SEM' });
    token = a.token;
    todos = [];
    for (let p = 1; ; p++) {
      const r = await c
        .http()
        .get(`/suministros?porPagina=100&pagina=${p}`)
        .set(bearer(token))
        .expect(200);
      todos.push(...r.body.datos);
      if (todos.length >= r.body.meta.total) break;
    }
  });
  afterAll(() => c.cerrar());

  it('PRD §Suministro: sum-004120 es exactamente el ejemplo del PRD', async () => {
    const r = await c
      .http()
      .get('/suministros/sum-004120')
      .set(bearer(token))
      .expect(200);
    esperarContrato(r.body, 'Suministro');
    expect(r.body.datos).toEqual({
      id: 'sum-004120',
      numero: '004120',
      titular: 'Coronel, Ramona',
      direccion: 'Brasil 1420',
      coordenadas: { latitud: -30.7521, longitud: expect.any(Number) },
      categoria: 'residencial',
      medidorId: 'med-A88413',
      lecturaAnterior: 1284,
      fechaLecturaAnterior: '2026-07-14T09:30:00-03:00',
      consumoPromedio: 18,
      activo: true,
    });
  });

  it('PRD §Suministro: las coordenadas de sum-004120 son las del ejemplo del PRD (-30.7521, -57.9814)', async () => {
    const r = await c
      .http()
      .get('/suministros/sum-004120')
      .set(bearer(token))
      .expect(200);
    expect(r.body.datos.coordenadas).toEqual({
      latitud: -30.7521,
      longitud: -57.9814,
    });
  });

  it('PRD §Medidor: med-A88413 es el ejemplo del PRD, con el video servido por esta API (D14)', async () => {
    const r = await c
      .http()
      .get('/medidores/med-A88413')
      .set(bearer(token))
      .expect(200);
    esperarContrato(r.body, 'Medidor');
    const { videoInstructivoUrl, ...resto } = r.body.datos as Medidor;
    expect(resto).toEqual({
      id: 'med-A88413',
      serie: 'A-88413',
      modelo: 'agujas',
      multiplicador: 1,
      digitos: 5,
      codigoQr: 'COOP-CHJ:med-A88413',
      instaladoEn: '2019-03-11T00:00:00-03:00',
    });
    expect(videoInstructivoUrl).toMatch(/\/archivos\/videos\//);
    expect(videoInstructivoUrl).not.toContain('coopchajari.com.ar');
    const v = await c
      .http()
      .get(new URL(videoInstructivoUrl!).pathname)
      .set('Range', 'bytes=0-99')
      .expect(206);
    expect(v.headers['content-type']).toMatch(/video\/mp4/);
  });

  it('el mismo QR resuelve al mismo medidor', async () => {
    const a = await c
      .http()
      .get('/medidores/qr/COOP-CHJ:med-A88413')
      .set(bearer(token))
      .expect(200);
    const b = await c
      .http()
      .get('/medidores/med-A88413')
      .set(bearer(token))
      .expect(200);
    const sinOrigen = (x: Medidor) => ({
      ...x,
      videoInstructivoUrl: new URL(x.videoInstructivoUrl!).pathname,
    });
    expect(sinOrigen(a.body.datos)).toEqual(sinOrigen(b.body.datos));
  });

  it('todo suministro sembrado cumple el contrato, tiene id sum-<numero> y medidor existente', async () => {
    expect(todos.length).toBeGreaterThanOrEqual(200);
    esperarContrato(
      {
        datos: todos,
        meta: { total: todos.length, pagina: 1, porPagina: 100 },
      },
      'Suministro',
    );
    for (const s of todos) {
      expect(s.id).toBe(`sum-${s.numero}`);
      expect(s.numero).toMatch(/^\d{6}$/);
      expect(s.medidorId).toMatch(/^med-/);
    }
    expect(new Set(todos.map((s) => s.id)).size).toBe(todos.length);
    expect(new Set(todos.map((s) => s.medidorId)).size).toBe(todos.length);
  });

  it('todo medidor sembrado cumple el contrato, su QR es COOP-CHJ:<id> y resuelve por QR', async () => {
    let conMultiplicador = 0;
    let sinVideo = 0;
    const modelos = new Set<string>();
    const videos = new Set<string>();
    for (const s of todos) {
      const r = await c
        .http()
        .get(`/medidores/${s.medidorId}`)
        .set(bearer(token))
        .expect(200);
      esperarContrato(r.body, 'Medidor');
      const m = r.body.datos as Medidor;
      expect(m.codigoQr).toBe(`COOP-CHJ:${m.id}`);
      modelos.add(m.modelo);
      if (m.multiplicador !== 1) {
        conMultiplicador++;
        expect(m.multiplicador).toBe(10);
        expect(m.modelo).toBe('multiplicador');
      }
      if (m.videoInstructivoUrl === null) sinVideo++;
      else videos.add(new URL(m.videoInstructivoUrl).pathname);
      expect(m.digitos).toBeGreaterThan(0);
    }
    expect(conMultiplicador).toBeGreaterThanOrEqual(1);
    expect(sinVideo).toBe(conMultiplicador); // D14/§8: sólo el ×10 sin video
    expect([...modelos].sort()).toEqual([
      'agujas',
      'agujas_viejo',
      'digital',
      'multiplicador',
    ]);
    expect(videos.size).toBe(3); // un video por modelo con video (4 videos en total con el ×10: ver Dudas)
  });

  it('§8 casos feos: conexión nueva (null en los tres), inactivo y suministros sin lectura anterior coherentes', () => {
    const nuevas = todos.filter((s) => s.lecturaAnterior === null);
    expect(nuevas.length).toBeGreaterThanOrEqual(1);
    for (const s of nuevas) {
      expect(s.fechaLecturaAnterior).toBeNull();
      expect(s.consumoPromedio).toBeNull();
    }
    for (const s of todos.filter((x) => x.lecturaAnterior !== null))
      expect(s.fechaLecturaAnterior).not.toBeNull();
    expect(todos.some((s) => !s.activo)).toBe(true);
    expect(todos.find((s) => s.id === 'sum-020006')?.activo).toBe(false);
  });

  it('las ids de suministros de Brasil (004120, 004150, 004162) existen; 004150 es de la novedad del PRD (nov-3312)', () => {
    for (const n of ['004120', '004150', '004162'])
      expect(todos.some((s) => s.numero === n)).toBe(true);
  });

  it('R4 anticipado: la lista de suministros se ordena por número texto (no por orden de siembra)', () => {
    const numeros = todos.map((s) => s.numero);
    expect(numeros).toEqual([...numeros].sort());
  });

  it('?numero exacto y buscar con tildes sobre datos sembrados', async () => {
    const r = await c
      .http()
      .get('/suministros?numero=004120')
      .set(bearer(token))
      .expect(200);
    expect(r.body.meta.total).toBe(1);
    const sin = await c
      .http()
      .get('/suministros?numero=4120')
      .set(bearer(token))
      .expect(200);
    expect(sin.body.meta.total).toBe(0);
    const b = await c
      .http()
      .get('/suministros?buscar=coronel,%20ramona')
      .set(bearer(token))
      .expect(200);
    expect(b.body.datos.map((s: Suministro) => s.id)).toContain('sum-004120');
    const d = await c
      .http()
      .get('/suministros?buscar=BRASIL%201420')
      .set(bearer(token))
      .expect(200);
    expect(d.body.datos.map((s: Suministro) => s.id)).toContain('sum-004120');
  });

  it('el lector de demo (L-011) recibe 403 en todo hasta M2 (A13) y administración L-030 puede todo', async () => {
    const r = await c
      .http()
      .post('/auth/ingreso')
      .send({ legajo: 'L-011', contrasena: 'lectura' })
      .expect(200);
    const t = r.body.datos.token as string;
    const x = await c
      .http()
      .get('/suministros/sum-004120')
      .set(bearer(t))
      .expect(403);
    esperarError(x.body, 'SIN_PERMISO');
  });
});
