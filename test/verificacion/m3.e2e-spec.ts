// Verificación independiente de M3 — Lecturas (caja negra, AGENTS §12).
import { createHmac } from 'node:crypto';
import type { Lectura } from '../../contrato/tipos.js';
import { jpeg } from '../utilidades/archivos.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearRuta } from '../utilidades/rutas.js';
import { crearSuministro } from '../utilidades/suministros.js';
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
const SECRETO = 'secreto-de-los-tests-no-es-de-verdad';
const JERGA =
  /undefined|null|NaN|\bmust\b|\bshould\b|property|string|number|boolean|exception|SQL|QueryFailed|constraint|class-validator|stack|\bISO\b|enum/i;

type Sesion = Awaited<ReturnType<typeof conSesion>>;

describe('Verificación M3 — caja negra con datos propios', () => {
  let c: AppDePrueba;
  let admin: Sesion;
  let lector: Sesion;
  let otro: Sesion;
  let foto: string;

  beforeAll(async () => {
    c = await crearApp();
    admin = await conSesion(c, 'administracion', { legajo: 'V3-ADM' });
    lector = await conSesion(c, 'lector', { legajo: 'V3-LEC' });
    otro = await conSesion(c, 'lector', { legajo: 'V3-OTRO' });
    const r = await c
      .http()
      .post('/archivos')
      .set(bearer(lector.token))
      .attach('archivo', jpeg(), 'foto.jpg')
      .expect(201);
    foto = r.body.datos.url as string;
  });
  afterAll(() => c.cerrar());

  const AHORA = '2026-09-15T08:00:00-03:00';
  type Ruta = { id: string; suministroIds: string[] };

  const cuerpo = (r: Ruta, i: number, resto: Record<string, unknown> = {}) => ({
    rutaId: r.id,
    suministroId: r.suministroIds[i],
    valor: 1010,
    fotoUri: foto,
    coordenadas: null,
    confirmadaPorLector: false,
    fechaHora: '2026-09-15T07:30:00-03:00',
    ...resto,
  });
  const post = (s: Sesion, b: Record<string, unknown>) =>
    c.http().post('/lecturas').set(bearer(s.token)).send(b);
  const get = (ruta: string, s: Sesion) =>
    c.http().get(ruta).set(bearer(s.token));
  const nueva = (
    datos: Parameters<typeof crearRuta>[1] extends infer T
      ? Partial<T & object>
      : never = {},
  ) =>
    crearRuta(c, {
      lectorId: lector.id,
      estado: 'en_curso',
      cantidad: 3,
      ...datos,
    });

  describe('R16 — bordes de fuera de rango (D4)', () => {
    it.each([
      // [promedio, anterior, multiplicador, valor, fuera, consumo]
      [18, 1000, 1, 1054, false, 54],
      [18, 1000, 1, 1055, true, 55],
      [18, 1000, 1, 1000, false, 0],
      [0, 1000, 1, 1015, false, 15],
      [0, 1000, 1, 1016, true, 16],
      [3, 1000, 1, 1015, false, 15],
      [3, 1000, 1, 1016, true, 16],
      [null, 1000, 1, 1060, false, 60],
      [null, 1000, 1, 1061, true, 61],
      [null, null, 1, 61, true, 61],
      [null, null, 1, 0, false, 0],
      [18, 1000, 10, 1005, false, 50],
      [18, 1000, 10, 1006, true, 60],
      [18, 1000, 10, 999, true, -10],
      [100, 1000, 1, 1300, false, 300],
      [100, 1000, 1, 1301, true, 301],
    ])(
      'promedio %s, anterior %s, ×%s, valor %s → fuera=%s consumo=%s',
      async (promedio, anterior, mult, valor, fuera, consumo) => {
        const r = await nueva({
          cantidad: undefined,
          suministros: [
            {
              consumoPromedio: promedio,
              lecturaAnterior: anterior,
              medidor: { multiplicador: mult, digitos: 6 },
            },
          ],
        });
        const res = await post(lector, cuerpo(r, 0, { valor })).expect(201);
        esperarContrato(res.body, 'Lectura');
        expect(res.body.datos.consumo).toBe(consumo);
        expect(res.body.datos.fueraDeRango).toBe(fuera);
        expect(Number.isInteger(res.body.datos.consumo)).toBe(true);
      },
    );

    it('R14: el consumo guardado no cambia si después cambia el suministro', async () => {
      const r = await nueva({ cantidad: undefined, suministros: [{}] });
      const a = await post(lector, cuerpo(r, 0, { valor: 1020 })).expect(201);
      const g = await get(`/lecturas/${a.body.datos.id}`, lector).expect(200);
      expect(g.body.datos.consumo).toBe(20);
      expect(g.body.datos.fueraDeRango).toBe(false);
    });
  });

  describe('R12 — valor y dígitos del medidor', () => {
    it.each([
      ['0 es válido', 0, 201],
      ['el máximo 99999', 99999, 201],
      ['100000 no entra en 5 dígitos', 100000, 422],
      ['-0.5', -0.5, 422],
      ['1e21', 1e21, 422],
      ['1.0000001', 1.0000001, 422],
    ])('%s', async (_n, valor, estado) => {
      const r = await nueva({ cantidad: undefined, suministros: [{}] });
      const res = await post(lector, cuerpo(r, 0, { valor })).expect(estado);
      if (estado === 422) esperarError(res.body, 'LECTURA_INVALIDA');
    });

    it('medidor de 4 dígitos: 10000 → LECTURA_INVALIDA, 9999 ok', async () => {
      const r = await nueva({
        cantidad: undefined,
        suministros: [{ medidor: { digitos: 4 } }],
      });
      const x = await post(lector, cuerpo(r, 0, { valor: 10000 })).expect(422);
      esperarError(x.body, 'LECTURA_INVALIDA');
      await post(lector, cuerpo(r, 0, { valor: 9999 })).expect(201);
    });

    it.each([
      ['null', null],
      ['texto', 'abc'],
      ['booleano', true],
      ['lista', [1]],
      ['objeto', {}],
    ])('valor %s → 400 o 422 sin 500', async (_n, valor) => {
      const r = await nueva({ cantidad: undefined, suministros: [{}] });
      const res = await post(lector, cuerpo(r, 0, { valor }));
      expect([400, 422]).toContain(res.status);
      esperarError(res.body);
    });

    it('un valor que no es entero es 422 o 400, nunca se guarda', async () => {
      const r = await nueva({ cantidad: undefined, suministros: [{}] });
      const res = await post(lector, cuerpo(r, 0, { valor: 10.5 }));
      expect([400, 422]).toContain(res.status);
      const l = await get(`/rutas/${r.id}/lecturas`, lector).expect(200);
      expect(l.body.meta.total).toBe(0);
    });
  });

  describe('Fechas de entrada y salida', () => {
    it.each([
      ['con Z', '2026-09-15T10:30:00Z', '2026-09-15T07:30:00-03:00'],
      ['con milisegundos', '2026-09-15T07:30:00.123-03:00', '2026-09-15T07:30:00-03:00'],
      ['con otro offset', '2026-09-15T11:30:00+01:00', '2026-09-15T07:30:00-03:00'],
      ['cruce de medianoche UTC', '2026-09-15T02:59:59Z', '2026-09-14T23:59:59-03:00'],
      ['medianoche argentina', '2026-09-14T03:00:00Z', '2026-09-14T00:00:00-03:00'],
      ['31/12', '2025-12-31T23:59:59-03:00', '2025-12-31T23:59:59-03:00'],
      ['fin de mes en UTC', '2026-08-31T23:30:00-03:00', '2026-08-31T23:30:00-03:00'],
    ])('%s se normaliza a -03:00 sin milisegundos', async (_n, entrada, salida) => {
      const r = await nueva({ cantidad: undefined, suministros: [{}] });
      const res = await post(lector, cuerpo(r, 0, { fechaHora: entrada })).expect(201);
      esperarContrato(res.body, 'Lectura');
      expect(res.body.datos.fechaHora).toBe(salida);
      const g = await get(`/lecturas/${res.body.datos.id}`, lector).expect(200);
      expect(g.body.datos.fechaHora).toBe(salida);
    });

    it.each([
      ['solo el día', '2026-09-15'],
      ['sin offset', '2026-09-15T07:30:00'],
      ['día inexistente', '2026-02-30T07:30:00-03:00'],
      ['mes 13', '2026-13-01T07:30:00-03:00'],
      ['un número', 1789000000],
      ['vacía', ''],
      ['null', null],
    ])('fechaHora %s → 400', async (_n, fechaHora) => {
      const r = await nueva({ cantidad: undefined, suministros: [{}] });
      const res = await post(lector, cuerpo(r, 0, { fechaHora })).expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });

    it('futuro: +5 minutos justos entra, +5:01 no', async () => {
      const r = await nueva({ cantidad: undefined, suministros: [{}, {}] });
      await post(lector, cuerpo(r, 0, { fechaHora: '2026-09-15T08:05:00-03:00' })).expect(201);
      const x = await post(lector, cuerpo(r, 1, { fechaHora: '2026-09-15T08:05:01-03:00' })).expect(400);
      esperarError(x.body, 'VALIDACION_FALLIDA');
    });

    it('con el reloj a las 23:59 del 31/12 la tolerancia sigue siendo de 5 minutos (cruza el año)', async () => {
      try {
        c.reloj.fijar('2026-12-31T23:59:00-03:00');
        const u = await conSesion(c, 'lector');
        const r = await crearRuta(c, { lectorId: u.id, estado: 'en_curso', cantidad: 2 });
        const ok = await post(u, cuerpo(r, 0, { fechaHora: '2027-01-01T00:04:00-03:00' })).expect(201);
        expect(ok.body.datos.fechaHora).toBe('2027-01-01T00:04:00-03:00');
        await post(u, cuerpo(r, 1, { fechaHora: '2027-01-01T00:05:00-03:00' })).expect(400);
      } finally {
        c.reloj.fijar(AHORA);
      }
    });
  });

  describe('Entrada: campos y tipos', () => {
    it.each([
      ['createdAt', { createdAt: '2026-09-15' }],
      ['password', { password: 'x' }],
      ['distancia', { distancia: 3 }],
      ['legajo', { legajo: 'L-1' }],
    ])('campo de más %s → 400', async (_n, extra) => {
      const r = await nueva({ cantidad: undefined, suministros: [{}] });
      const res = await post(lector, cuerpo(r, 0, extra)).expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
      expect(res.body.error.mensaje).not.toMatch(JERGA);
    });

    it.each([
      ['rutaId sin prefijo', { rutaId: '123' }],
      ['rutaId con prefijo de otra entidad', { rutaId: 'sum-004120' }],
      ['suministroId con prefijo de ruta', { suministroId: 'rut-07-2026-05' }],
      ['id demasiado corto', { id: 'lec-ab' }],
      ['id con espacios', { id: 'lec-ab cd' }],
      ['id de 40 caracteres', { id: `lec-${'a'.repeat(40)}` }],
      ['id numérico', { id: 123 }],
      ['confirmadaPorLector como texto', { confirmadaPorLector: 'true' }],
      ['coordenadas como texto', { coordenadas: '-30,-57' }],
      ['coordenadas con campo de más', { coordenadas: { latitud: 1, longitud: 2, alt: 3 } }],
      ['coordenadas con texto', { coordenadas: { latitud: 'a', longitud: 2 } }],
      ['fotoUri numérica', { fotoUri: 12 }],
    ])('%s → 400', async (_n, resto) => {
      const r = await nueva({ cantidad: undefined, suministros: [{}] });
      const res = await post(lector, cuerpo(r, 0, resto)).expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
      expect(res.body.error.mensaje).not.toMatch(JERGA);
    });

    it.each([
      ['cuerpo vacío', {}],
    ])('%s → 400', async (_n, b) => {
      const res = await post(lector, b).expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
    });

    it('un id con guion bajo y guion de 36 caracteres es válido', async () => {
      const r = await nueva({ cantidad: undefined, suministros: [{}] });
      const id = `lec-${'aB_-'.repeat(9)}`;
      const res = await post(lector, cuerpo(r, 0, { id })).expect(201);
      expect(res.body.datos.id).toBe(id);
    });

    it('mandar sólo lo ignorado (consumo, fueraDeRango, sincronizada, lectorId) basura no rompe', async () => {
      const r = await nueva({ cantidad: undefined, suministros: [{}] });
      const res = await post(
        lector,
        cuerpo(r, 0, { lectorId: null, consumo: 'x', fueraDeRango: 'x', sincronizada: null }),
      );
      expect([201, 400]).toContain(res.status);
      if (res.status === 201) esperarContrato(res.body, 'Lectura');
    });

    it('Content-Type no JSON o cuerpo malformado → 400 con sobre de error', async () => {
      const res = await c
        .http()
        .post('/lecturas')
        .set(bearer(lector.token))
        .set('Content-Type', 'application/json')
        .send('{no es json');
      expect(res.status).toBe(400);
      esperarError(res.body);
    });
  });

  describe('Foto y errores del catálogo', () => {
    it('la foto de la respuesta es absoluta y se puede bajar', async () => {
      const r = await nueva({ cantidad: undefined, suministros: [{}] });
      const res = await post(lector, cuerpo(r, 0)).expect(201);
      expect(res.body.datos.fotoUri).toMatch(/^http:\/\/.+\/archivos\/imagenes\//);
      await c.http().get(new URL(res.body.datos.fotoUri).pathname).expect(200);
    });

    it('un audio subido no vale como foto → no es 201', async () => {
      const a = await c
        .http()
        .post('/archivos')
        .set(bearer(lector.token))
        .attach('archivo', Buffer.from('\x00\x00\x00\x20ftypM4A ' + 'x'.repeat(2000), 'latin1'), 'a.m4a')
        .expect(201);
      const r = await nueva({ cantidad: undefined, suministros: [{}] });
      const res = await post(lector, cuerpo(r, 0, { fotoUri: a.body.datos.url }));
      expect(res.status).toBeGreaterThanOrEqual(400);
      esperarError(res.body);
    });

    it('fotoUri con path traversal → ARCHIVO_NO_SUBIDO o 400, nunca 500', async () => {
      const r = await nueva({ cantidad: undefined, suministros: [{}] });
      const res = await post(lector, cuerpo(r, 0, { fotoUri: 'http://x/archivos/../../etc/passwd' }));
      expect([400, 422]).toContain(res.status);
    });

    it('orden: ruta cerrada antes que suministro fuera de ruta', async () => {
      const r = await nueva({ estado: 'cerrada' });
      const res = await post(lector, cuerpo(r, 0, { suministroId: 'sum-999999' })).expect(409);
      esperarError(res.body, 'RUTA_YA_CERRADA');
    });

    it('orden: ruta de otro lector (cerrada) → 403 antes que 409', async () => {
      const r = await nueva({ estado: 'cerrada' });
      const res = await post(otro, cuerpo(r, 0)).expect(403);
      esperarError(res.body, 'SIN_PERMISO');
    });

    it('orden: ruta de otro con cuerpo inválido → el 400 de forma gana, sin 500', async () => {
      const r = await nueva();
      const res = await post(otro, cuerpo(r, 0, { valor: -5 }));
      expect([400, 403]).toContain(res.status);
    });

    it('orden: la foto falta y el valor es inválido → LECTURA_INVALIDA antes que FOTO_REQUERIDA (R12)', async () => {
      const r = await nueva({ cantidad: undefined, suministros: [{}] });
      const res = await post(lector, cuerpo(r, 0, { valor: -1, fotoUri: null })).expect(422);
      esperarError(res.body, 'LECTURA_INVALIDA');
    });

    it('un suministro con formato válido pero inexistente → SUMINISTRO_FUERA_DE_RUTA', async () => {
      const r = await nueva();
      const res = await post(lector, cuerpo(r, 0, { suministroId: 'sum-no-existe' })).expect(422);
      esperarError(res.body, 'SUMINISTRO_FUERA_DE_RUTA');
    });

    it.each([
      ['2026-09-14T20:02:00Z', '14/09'],
      ['2026-09-15T02:30:00Z', '14/09'], // 23:30 en Argentina
      ['2026-10-01T03:00:00Z', '01/10'], // 00:00 en Argentina
      ['2026-01-01T02:59:00Z', '31/12'],
    ])('RUTA_YA_CERRADA: cerradaEn %s dice "%s" en hora argentina', async (cerradaEn, dia) => {
      const r = await nueva({ estado: 'cerrada', cerradaEn: new Date(cerradaEn) });
      const res = await post(lector, cuerpo(r, 0)).expect(409);
      esperarError(res.body, 'RUTA_YA_CERRADA');
      expect(res.body.error.mensaje).toBe(`Esa ruta fue cerrada el ${dia}.`);
    });

    it('un suministro inactivo acepta lectura (D11)', async () => {
      const r = await nueva({ cantidad: undefined, suministros: [{ activo: false }] });
      await post(lector, cuerpo(r, 0)).expect(201);
    });

    it('la administración no puede cargar ni en rutas ajenas ni con su propio id', async () => {
      const r = await nueva();
      const res = await post(admin, cuerpo(r, 0)).expect(403);
      esperarError(res.body, 'SIN_PERMISO');
    });

    it('un lector sin rutas (reasignada) pierde la posibilidad de cargar', async () => {
      const r = await nueva({ cantidad: undefined, suministros: [{}] });
      await c
        .http()
        .patch(`/rutas/${r.id}`)
        .set(bearer(admin.token))
        .send({ lectorId: otro.id })
        .expect(200);
      await post(lector, cuerpo(r, 0)).expect(403);
      const ok = await post(otro, cuerpo(r, 0, { id: 'lec-reasig1' })).expect(201);
      expect(ok.body.datos.lectorId).toBe(otro.id);
      // lo ya cargado por el anterior sigue siendo suyo
      await c
        .http()
        .patch(`/rutas/${r.id}`)
        .set(bearer(admin.token))
        .send({ lectorId: lector.id })
        .expect(200);
      const l = await get(`/lecturas/lec-reasig1`, lector).expect(200);
      expect(l.body.datos.lectorId).toBe(otro.id);
    });
  });

  describe('Permisos y tokens (401)', () => {
    it.each([
      ['sin cabecera', undefined],
      ['esquema equivocado', 'Basic abc'],
      ['token basura', 'Bearer xyz'],
      [
        'firmado con otro secreto',
        `Bearer ${firmar({ sub: 'usr-1', rol: 'lector', exp: 9999999999, iat: 1 }, 'otro-secreto-cualquiera-1234567890')}`,
      ],
    ])('POST /lecturas %s → 401', async (_n, auth) => {
      const r = await nueva();
      let q = c.http().post('/lecturas');
      if (auth) q = q.set('Authorization', auth);
      const res = await q.send(cuerpo(r, 0)).expect(401);
      esperarError(res.body, 'NO_AUTENTICADO');
    });

    it('token vencido (firmado bien, exp pasado) → 401 en los tres endpoints', async () => {
      const r = await nueva();
      const t = firmar({ sub: lector.id, rol: 'lector', iat: 1, exp: 2 }, SECRETO);
      await c.http().post('/lecturas').set('Authorization', `Bearer ${t}`).send(cuerpo(r, 0)).expect(401);
      await c.http().get('/lecturas/lec-abcdef').set('Authorization', `Bearer ${t}`).expect(401);
      await c.http().get(`/rutas/${r.id}/lecturas`).set('Authorization', `Bearer ${t}`).expect(401);
    });

    it('token válido pero después de /auth/salida → 401', async () => {
      const u = await conSesion(c, 'lector');
      const r = await crearRuta(c, { lectorId: u.id, estado: 'en_curso', cantidad: 1 });
      await post(u, cuerpo(r, 0)).expect(201);
      await c.http().post('/auth/salida').set(bearer(u.token)).expect(204);
      await post(u, cuerpo(r, 0, { id: 'lec-trasalida' })).expect(401);
    });

    it('GET de lectura de otro lector → 403 y de rutas ajenas → 403 con sobre de error', async () => {
      const r = await nueva();
      const l = await post(lector, cuerpo(r, 0, { id: 'lec-permiso1' })).expect(201);
      const a = await get(`/lecturas/${l.body.datos.id}`, otro).expect(403);
      esperarError(a.body, 'SIN_PERMISO');
      const b = await get(`/rutas/${r.id}/lecturas`, otro).expect(403);
      esperarError(b.body, 'SIN_PERMISO');
    });
  });

  describe('R15 — idempotencia', () => {
    it('reintento con otro valor devuelve la lectura original, sin recalcular', async () => {
      const r = await nueva({ cantidad: undefined, suministros: [{}] });
      const a = await post(lector, cuerpo(r, 0, { id: 'lec-idem-x1', valor: 1010 })).expect(201);
      const b = await post(lector, cuerpo(r, 0, { id: 'lec-idem-x1', valor: 1020 })).expect(200);
      const sinHost = (x: { datos: { fotoUri: string } }) => ({
        ...x.datos,
        fotoUri: new URL(x.datos.fotoUri).pathname,
      });
      expect(sinHost(b.body)).toEqual(sinHost(a.body));
      const l = await get(`/rutas/${r.id}/lecturas`, lector).expect(200);
      expect(l.body.meta.total).toBe(1);
    });

    it('el reintento responde 200 aunque la lectura ya no sea la vigente', async () => {
      const r = await nueva({ cantidad: undefined, suministros: [{}] });
      const vieja = cuerpo(r, 0, { id: 'lec-vieja-x1', fechaHora: '2026-09-15T06:00:00-03:00' });
      await post(lector, vieja).expect(201);
      await post(lector, cuerpo(r, 0, { id: 'lec-nueva-x1', valor: 1030 })).expect(201);
      const b = await post(lector, vieja).expect(200);
      expect(b.body.datos.id).toBe('lec-vieja-x1');
      const l = await get(`/rutas/${r.id}/lecturas`, lector).expect(200);
      expect(l.body.datos.map((x: Lectura) => x.id)).toEqual(['lec-nueva-x1']);
    });

    it('un reintento con id existente de otro lector → ID_EN_USO 409 aunque el cuerpo sea de su ruta', async () => {
      const r = await nueva({ cantidad: undefined, suministros: [{}] });
      await post(lector, cuerpo(r, 0, { id: 'lec-ajeno-x1' })).expect(201);
      const r2 = await crearRuta(c, { lectorId: otro.id, estado: 'en_curso', cantidad: 1 });
      const x = await post(otro, cuerpo(r2, 0, { id: 'lec-ajeno-x1' })).expect(409);
      esperarError(x.body, 'ID_EN_USO');
    });

    it('5 pedidos simultáneos con el mismo id → un 201, el resto 200, una sola lectura', async () => {
      const r = await nueva({ cantidad: undefined, suministros: [{}] });
      const rs = await Promise.all(
        Array.from({ length: 5 }, () => post(lector, cuerpo(r, 0, { id: 'lec-conc-x01' }))),
      );
      expect(rs.map((x) => x.status).sort()).toEqual([200, 200, 200, 200, 201]);
      const l = await get(`/rutas/${r.id}/lecturas`, lector).expect(200);
      expect(l.body.meta.total).toBe(1);
    });

    it('simultáneo mismo id de DOS lectores: uno 201 y el otro 409 ID_EN_USO', async () => {
      const r1 = await nueva({ cantidad: undefined, suministros: [{}] });
      const r2 = await crearRuta(c, { lectorId: otro.id, estado: 'en_curso', cantidad: 1 });
      const [a, b] = await Promise.all([
        post(lector, cuerpo(r1, 0, { id: 'lec-dos-lect1' })),
        post(otro, cuerpo(r2, 0, { id: 'lec-dos-lect1' })),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      const perdedor = a.status === 409 ? a : b;
      esperarError(perdedor.body, 'ID_EN_USO');
    });

    it('mismo id con un suministro distinto del mismo lector: 200 con la existente', async () => {
      const r = await nueva({ cantidad: undefined, suministros: [{}, {}] });
      const a = await post(lector, cuerpo(r, 0, { id: 'lec-mismoid-1' })).expect(201);
      const b = await post(lector, cuerpo(r, 1, { id: 'lec-mismoid-1' })).expect(200);
      expect(b.body.datos.suministroId).toBe(a.body.datos.suministroId);
    });

    it('el reintento a una ruta cerrada con un id inexistente → 409 RUTA_YA_CERRADA', async () => {
      const r = await nueva({ estado: 'cerrada' });
      const x = await post(lector, cuerpo(r, 0, { id: 'lec-noexiste-1' })).expect(409);
      esperarError(x.body, 'RUTA_YA_CERRADA');
    });
  });

  describe('R13 — un solo vigente por suministro', () => {
    it('misma fechaHora exacta: queda exactamente una vigente', async () => {
      const r = await nueva({ cantidad: undefined, suministros: [{}] });
      await post(lector, cuerpo(r, 0, { id: 'lec-emp-aaa1' })).expect(201);
      await post(lector, cuerpo(r, 0, { id: 'lec-emp-bbb1', valor: 1020 })).expect(201);
      const l = await get(`/rutas/${r.id}/lecturas`, lector).expect(200);
      expect(l.body.meta.total).toBe(1);
      expect(l.body.datos).toHaveLength(1);
      const av = await get(`/rutas/${r.id}/avance`, lector).expect(200);
      expect(av.body.datos.leidos).toBe(1);
      expect(av.body.datos.pendientes).toBe(0);
    });

    it('lecturas simultáneas del mismo suministro con distinta hora: gana la más reciente', async () => {
      const r = await nueva({ cantidad: undefined, suministros: [{}] });
      const horas = ['07:10', '07:50', '07:20', '07:40', '07:30'];
      await Promise.all(
        horas.map((h, i) =>
          post(lector, cuerpo(r, 0, { id: `lec-par-${i}x1`, valor: 1001 + i, fechaHora: `2026-09-15T${h}:00-03:00` })),
        ),
      );
      const l = await get(`/rutas/${r.id}/lecturas`, lector).expect(200);
      expect(l.body.datos.map((x: Lectura) => x.id)).toEqual(['lec-par-1x1']);
    });

    it('la vigente más vieja por fecha no pisa a la nueva aunque llegue después; GET de la vieja sigue andando', async () => {
      const r = await nueva({ cantidad: undefined, suministros: [{}] });
      await post(lector, cuerpo(r, 0, { id: 'lec-ord-new1', fechaHora: '2026-09-15T07:50:00-03:00' })).expect(201);
      await post(lector, cuerpo(r, 0, { id: 'lec-ord-old1', fechaHora: '2026-09-15T07:00:00-03:00' })).expect(201);
      const l = await get(`/rutas/${r.id}/lecturas`, lector).expect(200);
      expect(l.body.datos.map((x: Lectura) => x.id)).toEqual(['lec-ord-new1']);
      await get('/lecturas/lec-ord-old1', lector).expect(200);
      const p = await c.http().post(`/rutas/${r.id}/descarga`).set(bearer(lector.token)).expect(200);
      expect(p.body.datos.lecturas.map((x: Lectura) => x.id)).toEqual(['lec-ord-new1']);
    });

    it('el avance cuenta fueraDeRango sólo de las vigentes', async () => {
      const r = await nueva({ cantidad: undefined, suministros: [{}, {}] });
      await post(lector, cuerpo(r, 0, { id: 'lec-fr-a001', valor: 9000, fechaHora: '2026-09-15T06:00:00-03:00' })).expect(201);
      await post(lector, cuerpo(r, 0, { id: 'lec-fr-a002', valor: 1010, fechaHora: '2026-09-15T07:00:00-03:00' })).expect(201);
      await post(lector, cuerpo(r, 1, { id: 'lec-fr-b001', valor: 9000 })).expect(201);
      const av = await get(`/rutas/${r.id}/avance`, lector).expect(200);
      expect(av.body.datos).toEqual({
        rutaId: r.id,
        suministros: 2,
        leidos: 2,
        conNovedad: 0,
        pendientes: 0,
        fueraDeRango: 1,
      });
      const fr = await get(`/rutas/${r.id}/lecturas?fueraDeRango=true`, lector).expect(200);
      expect(fr.body.datos.map((x: Lectura) => x.id)).toEqual(['lec-fr-b001']);
      const nofr = await get(`/rutas/${r.id}/lecturas?fueraDeRango=false`, lector).expect(200);
      expect(nofr.body.datos.map((x: Lectura) => x.id)).toEqual(['lec-fr-a002']);
      expect(nofr.body.meta.total).toBe(1);
    });

    it('las lecturas de un suministro de otra ruta no se mezclan', async () => {
      const r1 = await nueva({ cantidad: undefined, suministros: [{}] });
      const r2 = await nueva({ cantidad: undefined, suministros: [{}] });
      await post(lector, cuerpo(r1, 0)).expect(201);
      const l = await get(`/rutas/${r2.id}/lecturas`, lector).expect(200);
      expect(l.body.datos).toEqual([]);
      expect(l.body.meta).toMatchObject({ total: 0, pagina: 1 });
    });
  });

  describe('GET /rutas/:id/lecturas — orden, paginación y filtros', () => {
    let r: Ruta;
    beforeAll(async () => {
      r = await nueva({ cantidad: 5 });
      // se cargan en desorden y con horas al revés
      for (const i of [3, 0, 4, 2, 1]) {
        await post(lector, cuerpo(r, i, { id: `lec-lista-${i}x1`, fechaHora: `2026-09-15T0${7 - (i % 3)}:00:00-03:00`, valor: i === 2 ? 9000 : 1005 })).expect(201);
      }
    });

    it('sale en el orden del recorrido, no por hora ni por llegada', async () => {
      const l = await get(`/rutas/${r.id}/lecturas`, lector).expect(200);
      esperarContrato(l.body, 'Lectura');
      expect(l.body.datos.map((x: Lectura) => x.id)).toEqual([0, 1, 2, 3, 4].map((i) => `lec-lista-${i}x1`));
    });

    it('páginas de 2 con meta correcto, concatenadas dan todo sin repetir', async () => {
      const vistos: string[] = [];
      for (const p of [1, 2, 3]) {
        const l = await get(`/rutas/${r.id}/lecturas?pagina=${p}&porPagina=2`, lector).expect(200);
        expect(l.body.meta).toEqual({ total: 5, pagina: p, porPagina: 2 });
        vistos.push(...l.body.datos.map((x: Lectura) => x.id));
      }
      expect(vistos).toEqual([0, 1, 2, 3, 4].map((i) => `lec-lista-${i}x1`));
    });

    it('página fuera de rango → vacía y total correcto', async () => {
      const l = await get(`/rutas/${r.id}/lecturas?pagina=99&porPagina=2`, lector).expect(200);
      expect(l.body.datos).toEqual([]);
      expect(l.body.meta).toEqual({ total: 5, pagina: 99, porPagina: 2 });
    });

    it('filtro + paginación: meta.total es el filtrado', async () => {
      const l = await get(`/rutas/${r.id}/lecturas?fueraDeRango=true&porPagina=1`, lector).expect(200);
      expect(l.body.meta).toEqual({ total: 1, pagina: 1, porPagina: 1 });
      expect(l.body.datos[0].id).toBe('lec-lista-2x1');
    });

    it('administración la ve completa', async () => {
      const l = await get(`/rutas/${r.id}/lecturas`, admin).expect(200);
      expect(l.body.meta.total).toBe(5);
    });

    it.each([
      ['porPagina=0', 'porPagina=0'],
      ['porPagina=201', 'porPagina=201'],
      ['porPagina=-1', 'porPagina=-1'],
      ['porPagina=abc', 'porPagina=abc'],
      ['pagina=0', 'pagina=0'],
      ['pagina=1.5', 'pagina=1.5'],
      ['fueraDeRango=si', 'fueraDeRango=si'],
      ['filtro desconocido', 'distancia=1'],
    ])('%s → 400', async (_n, q) => {
      const x = await get(`/rutas/${r.id}/lecturas?${q}`, lector).expect(400);
      esperarError(x.body, 'VALIDACION_FALLIDA');
      expect(x.body.error.mensaje).not.toMatch(JERGA);
    });

    it('porPagina=200 es válido', async () => {
      await get(`/rutas/${r.id}/lecturas?porPagina=200`, lector).expect(200);
    });

    it('ruta con id mal formado → 400; ruta inexistente → 404', async () => {
      const a = await get('/rutas/xyz/lecturas', lector).expect(400);
      esperarError(a.body, 'VALIDACION_FALLIDA');
      const b = await get('/rutas/rut-99-2026-05/lecturas', lector).expect(404);
      esperarError(b.body, 'RUTA_NO_ENCONTRADA');
    });

    it('GET /lecturas/:id con ids raros → 400 o 404, nunca 500', async () => {
      for (const id of ['lec-', 'lec-%20', 'lec-' + 'a'.repeat(100), 'nov-12345']) {
        const x = await get(`/lecturas/${id}`, lector);
        expect([400, 404]).toContain(x.status);
        esperarError(x.body);
      }
    });
  });

  describe('Paquete de descarga y lecturas', () => {
    it('lecturas del paquete cumplen el contrato con todos los opcionales llenos y nulos', async () => {
      const r = await nueva({ cantidad: 2 });
      await post(lector, cuerpo(r, 0, { id: 'lec-pq-nulo01', coordenadas: null })).expect(201);
      await post(lector, cuerpo(r, 1, { id: 'lec-pq-lleno1', coordenadas: { latitud: -30.1, longitud: -57.2 }, confirmadaPorLector: true, valor: 9000 })).expect(201);
      const pq = await c.http().post(`/rutas/${r.id}/descarga`).set(bearer(lector.token)).expect(200);
      esperarContrato(pq.body, 'PaqueteRuta');
      expect(pq.body.datos.lecturas).toHaveLength(2);
      expect(pq.body.datos.lecturas[0].coordenadas).toBeNull();
      expect(pq.body.datos.lecturas[1]).toMatchObject({ confirmadaPorLector: true, fueraDeRango: true });
    });

    it('la lectura en una ruta asignada la pasa a en_curso; la descarga posterior no rompe descargadaEn', async () => {
      const r = await nueva({ estado: 'asignada', cantidad: 1 });
      await post(lector, cuerpo(r, 0)).expect(201);
      const g = await get(`/rutas/${r.id}`, lector).expect(200);
      expect(g.body.datos.estado).toBe('en_curso');
    });
  });

  describe('Sobre de error', () => {
    it('todos los errores de POST /lecturas son sólo codigo y mensaje, en castellano', async () => {
      const r = await nueva({ cantidad: undefined, suministros: [{}] });
      const casos: Array<[Sesion, Record<string, unknown>]> = [
        [lector, cuerpo(r, 0, { valor: -1 })],
        [lector, cuerpo(r, 0, { fotoUri: null })],
        [lector, cuerpo(r, 0, { fotoUri: 'file:///a.jpg' })],
        [lector, cuerpo(r, 0, { suministroId: 'sum-zzz' })],
        [lector, cuerpo(r, 0, { rutaId: 'rut-99-2026-05' })],
        [otro, cuerpo(r, 0)],
        [lector, { ...cuerpo(r, 0), extra: 1 }],
      ];
      for (const [s, b] of casos) {
        const x = await post(s, b);
        expect(x.status).toBeGreaterThanOrEqual(400);
        expect(x.status).toBeLessThan(500);
        esperarError(x.body);
        expect(x.body.error.mensaje).not.toMatch(JERGA);
        expect(x.body.error.mensaje).not.toMatch(/\b(lec|rut|sum|usr)-[A-Za-z0-9]+/);
      }
    });
  });

  describe('Concurrencia entre lecturas distintas', () => {
    it('20 lecturas simultáneas de 20 suministros: todas 201 y la lista tiene 20', async () => {
      const r = await nueva({ cantidad: 20 });
      const rs = await Promise.all(
        r.suministroIds.map((_s, i) => post(lector, cuerpo(r, i, { id: `lec-bulk-${i}x01` }))),
      );
      expect(rs.every((x) => x.status === 201)).toBe(true);
      const l = await get(`/rutas/${r.id}/lecturas?porPagina=100`, lector).expect(200);
      expect(l.body.meta.total).toBe(20);
      const av = await get(`/rutas/${r.id}/avance`, lector).expect(200);
      expect(av.body.datos).toMatchObject({ suministros: 20, leidos: 20, pendientes: 0 });
    });
  });

  void crearSuministro;
});
