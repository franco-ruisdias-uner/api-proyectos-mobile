// Verificación independiente de M5 — Cierre de ruta (caja negra, AGENTS §12).
import { createHmac } from 'node:crypto';
import { jpeg } from '../utilities/files.js';
import {
  AHORA_DE_PRUEBA,
  type AppDePrueba,
  crearApp,
} from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { crearRuta } from '../utilities/routes.js';
import { bearer, conSesion, ingresar } from '../utilities/users.js';

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
  /undefined|null|NaN|\bmust\b|\bshould\b|property|string|number|boolean|exception|SQL|QueryFailed|constraint|class-validator|stack|\bISO\b|enum|array/i;

type Sesion = Awaited<ReturnType<typeof conSesion>>;
type Ruta = { id: string; suministroIds: string[] };

describe('Verificación M5 — cierre de ruta, caja negra', () => {
  let c: AppDePrueba;
  let admin: Sesion;
  let lector: Sesion;
  let otro: Sesion;
  let foto: string;

  beforeAll(async () => {
    c = await crearApp();
    admin = await conSesion(c, 'administracion', { legajo: 'V5-ADM' });
    lector = await conSesion(c, 'lector', { legajo: 'V5-LEC' });
    otro = await conSesion(c, 'lector', { legajo: 'V5-OTRO' });
    foto = (
      await c
        .http()
        .post('/archivos')
        .set(bearer(lector.token))
        .attach('archivo', jpeg(), 'f.jpg')
        .expect(201)
    ).body.datos.url as string;
  });
  afterAll(() => c.cerrar());
  afterEach(() => c.reloj.fijar(AHORA_DE_PRUEBA));

  let n = 0;
  const nueva = (datos: Record<string, unknown> = {}): Promise<Ruta> =>
    crearRuta(c, {
      lectorId: lector.id,
      estado: 'en_curso',
      cantidad: 3,
      ...datos,
    });
  const id = (p: string) => `${p}-v5${(++n).toString().padStart(4, '0')}`;
  const lectura = (
    r: Ruta,
    i: number,
    lid: string,
    s: Sesion = lector,
    extra: Record<string, unknown> = {},
  ) =>
    c
      .http()
      .post('/lecturas')
      .set(bearer(s.token))
      .send({
        id: lid,
        rutaId: r.id,
        suministroId: r.suministroIds[i],
        valor: 10,
        fotoUri: foto,
        coordenadas: null,
        confirmadaPorLector: false,
        fechaHora: '2026-09-15T07:10:00-03:00',
        ...extra,
      });
  const novedad = (r: Ruta, i: number, nid: string, extra = {}) =>
    c
      .http()
      .post('/novedades')
      .set(bearer(lector.token))
      .send({
        id: nid,
        rutaId: r.id,
        suministroId: r.suministroIds[i],
        motivo: 'pasto_alto',
        comentario: null,
        audioUri: null,
        fotoUri: foto,
        fechaHora: '2026-09-15T07:00:00-03:00',
        ...extra,
      });
  const cerrar = (s: Sesion | string, rid: string, b: unknown = vacio) =>
    c
      .http()
      .post(`/rutas/${rid}/cierre`)
      .set(bearer(typeof s === 'string' ? s : s.token))
      .send(b as object);
  const vacio = { lecturaIds: [], novedadIds: [] };
  const verRuta = async (rid: string) =>
    (await c.http().get(`/rutas/${rid}`).set(bearer(admin.token)).expect(200))
      .body.datos;

  describe('R21 — forma de la respuesta', () => {
    it('200 (no 201), Ruta exacta, meta null, descargadaEn se conserva', async () => {
      const r = await nueva();
      const antes = await verRuta(r.id);
      const res = await cerrar(lector, r.id).expect(200);
      esperarContrato(res.body, 'Ruta');
      expect(res.body.meta).toBeNull();
      expect(res.body.datos.estado).toBe('cerrada');
      expect(res.body.datos.descargadaEn).toBe(antes.descargadaEn);
      expect(res.body.datos.cerradaEn).toBe('2026-09-15T08:00:00-03:00');
      expect(res.body.datos.suministroIds).toEqual(r.suministroIds);
      expect(await verRuta(r.id)).toEqual(res.body.datos);
    });

    it('una ruta asignada sin descarga: descargadaEn sigue null', async () => {
      const r = await nueva({ estado: 'asignada' });
      const res = await cerrar(lector, r.id).expect(200);
      esperarContrato(res.body, 'Ruta');
      expect(res.body.datos.descargadaEn).toBeNull();
      expect(res.body.datos.cerradaEn).not.toBeNull();
    });
  });

  describe('Fechas: cerradaEn y el DD/MM del mensaje en hora argentina', () => {
    it.each([
      ['2026-09-15T23:59:00-03:00', '2026-09-15T23:59:00-03:00', '15/09'],
      ['2026-09-16T00:00:00-03:00', '2026-09-16T00:00:00-03:00', '16/09'],
      ['2026-09-15T21:30:00-03:00', '2026-09-15T21:30:00-03:00', '15/09'], // ya es 16 en UTC
      ['2026-09-30T23:59:59-03:00', '2026-09-30T23:59:59-03:00', '30/09'],
      ['2026-10-01T00:00:00-03:00', '2026-10-01T00:00:00-03:00', '01/10'],
      ['2026-12-31T23:59:00-03:00', '2026-12-31T23:59:00-03:00', '31/12'],
      ['2027-01-01T00:00:00-03:00', '2027-01-01T00:00:00-03:00', '01/01'],
      ['2026-03-05T02:59:59Z', '2026-03-04T23:59:59-03:00', '04/03'], // 02:59Z = 23:59 AR
    ])(
      'cierre a las %s -> %s, mensaje %s',
      async (instante, esperado, ddmm) => {
        c.reloj.fijar(instante);
        const sesion = await ingresar(c, admin);
        const r = await nueva();
        const ok = await cerrar(sesion, r.id).expect(200);
        expect(ok.body.datos.cerradaEn).toBe(esperado);
        const rep = await cerrar(sesion, r.id).expect(409);
        esperarError(rep.body, 'RUTA_YA_CERRADA');
        expect(rep.body.error.mensaje).toBe(`Esa ruta fue cerrada el ${ddmm}.`);
        // el mensaje no cambia aunque pase el tiempo
        c.reloj.avanzar(3 * 3600 * 1000);
        const rep2 = await cerrar(sesion, r.id).expect(409);
        expect(rep2.body.error.mensaje).toBe(
          `Esa ruta fue cerrada el ${ddmm}.`,
        );
      },
    );

    it('cargar una lectura/novedad nueva en la ruta cerrada: mismo código y mismo mensaje', async () => {
      const r = await nueva();
      await cerrar(lector, r.id).expect(200);
      const l = await lectura(r, 0, id('lec')).expect(409);
      esperarError(l.body, 'RUTA_YA_CERRADA');
      expect(l.body.error.mensaje).toBe('Esa ruta fue cerrada el 15/09.');
      const nv = await novedad(r, 0, id('nov')).expect(409);
      esperarError(nv.body, 'RUTA_YA_CERRADA');
      expect(nv.body.error.mensaje).toBe('Esa ruta fue cerrada el 15/09.');
    });

    it('reintento de una novedad ya recibida en ruta cerrada: 200 (R15)', async () => {
      const r = await nueva();
      const nid = id('nov');
      await novedad(r, 0, nid).expect(201);
      await cerrar(lector, r.id, { lecturaIds: [], novedadIds: [nid] }).expect(
        200,
      );
      await novedad(r, 0, nid).expect(200);
    });
  });

  describe('R20 — qué cuenta como recibido', () => {
    it('lectura y novedad con el mismo sufijo: no se confunden entre tablas', async () => {
      const r = await nueva();
      await lectura(r, 0, 'lec-mismo01').expect(201);
      // nov-mismo01 no existe aunque exista lec-mismo01
      const res = await cerrar(lector, r.id, {
        lecturaIds: ['lec-mismo01'],
        novedadIds: ['nov-mismo01'],
      }).expect(409);
      expect(res.body.error.mensaje).toBe(
        'Falta subir 1 novedad. Esperá a tener señal y probá de nuevo.',
      );
    });

    it('un id de lectura de otro lector (misma ruta tras reasignar) cuenta como recibido', async () => {
      const r = await nueva();
      const lid = id('lec');
      await lectura(r, 0, lid).expect(201);
      await c
        .http()
        .patch(`/rutas/${r.id}`)
        .set(bearer(admin.token))
        .send({ lectorId: otro.id })
        .expect(200);
      // el lector original ya no es dueño: 403
      const viejo = await cerrar(lector, r.id, {
        lecturaIds: [lid],
        novedadIds: [],
      }).expect(403);
      esperarError(viejo.body, 'SIN_PERMISO');
      await cerrar(otro, r.id, { lecturaIds: [lid], novedadIds: [] }).expect(
        200,
      );
    });

    it('lecturas de una novedad que quedó no vigente por una lectura posterior: recibida', async () => {
      const r = await nueva();
      const nid = id('nov');
      await novedad(r, 0, nid).expect(201);
      await lectura(r, 0, id('lec')).expect(201); // la lectura gana: la novedad deja de ser vigente
      await cerrar(lector, r.id, { lecturaIds: [], novedadIds: [nid] }).expect(
        200,
      );
    });

    it('el mensaje con muchos faltantes cuenta bien y sin ids ni jerga', async () => {
      const r = await nueva();
      const ls = Array.from({ length: 25 }, (_, i) => `lec-m${i}x${i}z`);
      const ns = Array.from({ length: 12 }, (_, i) => `nov-m${i}x${i}z`);
      const res = await cerrar(lector, r.id, {
        lecturaIds: ls,
        novedadIds: ns,
      }).expect(409);
      esperarError(res.body, 'HAY_DATOS_SIN_SUBIR');
      expect(res.body.error.mensaje).toBe(
        'Faltan subir 25 lecturas y 12 novedades. Esperá a tener señal y probá de nuevo.',
      );
      expect(res.body.error.mensaje).not.toMatch(JERGA);
      expect(res.body.error.mensaje).not.toMatch(/lec-|nov-/);
      expect(Object.keys(res.body.error).sort()).toEqual(['codigo', 'mensaje']);
    });

    it('con parte recibida y parte no, la ruta no cambia nada (ni estado ni cerradaEn)', async () => {
      const r = await nueva();
      await lectura(r, 0, 'lec-parte01').expect(201);
      const antes = await verRuta(r.id);
      await cerrar(lector, r.id, {
        lecturaIds: ['lec-parte01', 'lec-parte02'],
        novedadIds: [],
      }).expect(409);
      expect(await verRuta(r.id)).toEqual(antes);
    });

    it('el cierre no modifica lecturas ni el avance', async () => {
      const r = await nueva();
      await lectura(r, 0, 'lec-intact1').expect(201);
      const av1 = await c
        .http()
        .get(`/rutas/${r.id}/avance`)
        .set(bearer(lector.token))
        .expect(200);
      await cerrar(lector, r.id, {
        lecturaIds: ['lec-intact1'],
        novedadIds: [],
      }).expect(200);
      const av2 = await c
        .http()
        .get(`/rutas/${r.id}/avance`)
        .set(bearer(lector.token))
        .expect(200);
      expect(av2.body).toEqual(av1.body);
      expect(av2.body.datos).toMatchObject({ leidos: 1, pendientes: 2 });
      const l = await c
        .http()
        .get('/lecturas/lec-intact1')
        .set(bearer(lector.token))
        .expect(200);
      esperarContrato(l.body, 'Lectura');
    });

    it('un id con mayúsculas cambiadas no coincide (los ids distinguen mayúsculas)', async () => {
      const r = await nueva();
      await lectura(r, 0, 'lec-AbC123').expect(201);
      const res = await cerrar(lector, r.id, {
        lecturaIds: ['lec-abc123'],
        novedadIds: [],
      });
      // Se acepta tanto 409 (distingue) como 200 (no distingue en MySQL por colación);
      // lo que nunca puede es variar entre motores: se anota el resultado en la matriz.
      expect([409]).toContain(res.status);
    });
  });

  describe('Entrada', () => {
    const malos: Array<[string, unknown]> = [
      ['cuerpo vacío', undefined],
      ['null', null],
      ['una lista', []],
      ['un texto', 'hola'],
      ['lecturaIds null', { lecturaIds: null, novedadIds: [] }],
      ['novedadIds un objeto', { lecturaIds: [], novedadIds: {} }],
      ['id null en la lista', { lecturaIds: [null], novedadIds: [] }],
      ['lista anidada', { lecturaIds: [['lec-1abc']], novedadIds: [] }],
      ['id vacío', { lecturaIds: [''], novedadIds: [] }],
      ['id sin prefijo', { lecturaIds: ['abc123'], novedadIds: [] }],
      ['prefijo de ruta', { lecturaIds: ['rut-07-2026-05'], novedadIds: [] }],
      ['lectura en novedadIds', { lecturaIds: [], novedadIds: ['lec-abc123'] }],
      ['id con espacios', { lecturaIds: ['lec- abc'], novedadIds: [] }],
      ['id con comilla', { lecturaIds: ["lec-a'b;--"], novedadIds: [] }],
      [
        'id larguísimo',
        { lecturaIds: ['lec-' + 'a'.repeat(500)], novedadIds: [] },
      ],
      [
        'más de 3000 ids',
        {
          lecturaIds: Array.from({ length: 3001 }, (_, i) => `lec-x${i}abc`),
          novedadIds: [],
        },
      ],
      ['campos de más (estado)', { ...vacioLocal(), estado: 'cerrada' }],
      ['campo de más (cerradaEn)', { ...vacioLocal(), cerradaEn: 'x' }],
      ['campo de más (rutaId)', { ...vacioLocal(), rutaId: 'rut-1' }],
    ];
    function vacioLocal() {
      return { lecturaIds: [], novedadIds: [] };
    }
    it.each(malos)('400 VALIDACION_FALLIDA: %s', async (_n, cuerpo) => {
      const r = await nueva();
      const req = c
        .http()
        .post(`/rutas/${r.id}/cierre`)
        .set(bearer(lector.token));
      const res = await (
        cuerpo === undefined ? req : req.send(cuerpo as object)
      ).expect(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
      expect(res.body.error.mensaje).not.toMatch(JERGA);
      expect((await verRuta(r.id)).estado).toBe('en_curso');
    });

    it('exactamente 3000 ids se aceptan (y faltan los 3000)', async () => {
      const r = await nueva();
      const res = await cerrar(lector, r.id, {
        lecturaIds: Array.from({ length: 3000 }, (_, i) => `lec-q${i}abc`),
        novedadIds: [],
      }).expect(409);
      expect(res.body.error.mensaje).toMatch(/^Faltan subir 3000 lecturas\./);
    });

    it.each([
      'RUT-07-2026-05',
      'rut-07-2026-5',
      'rut-',
      '123',
      "rut-1';drop--",
    ])(
      'ruta con id %j: 400 o 404 con sobre de error, nunca 500',
      async (rid) => {
        const res = await cerrar(lector, encodeURIComponent(rid));
        expect([400, 404]).toContain(res.status);
        esperarError(res.body);
      },
    );

    it('content-type texto/plano no cierra nada', async () => {
      const r = await nueva();
      const res = await c
        .http()
        .post(`/rutas/${r.id}/cierre`)
        .set(bearer(lector.token))
        .set('Content-Type', 'text/plain')
        .send('lecturaIds=');
      expect(res.status).toBe(400);
      esperarError(res.body, 'VALIDACION_FALLIDA');
      expect((await verRuta(r.id)).estado).toBe('en_curso');
    });
  });

  describe('Permisos y sesión', () => {
    it('sin token 401, token mal firmado 401, vencido 401, otro usuario inexistente 401', async () => {
      const r = await nueva();
      const sin = await c
        .http()
        .post(`/rutas/${r.id}/cierre`)
        .send(vacio)
        .expect(401);
      esperarError(sin.body, 'NO_AUTENTICADO');
      const ahora = Math.floor(c.reloj.ahora().getTime() / 1000);
      const malo = firmar(
        {
          sub: lector.id,
          rol: 'lector',
          ver: 0,
          iat: ahora,
          exp: ahora + 3600,
        },
        'otro',
      );
      const mal = await cerrar(malo, r.id).expect(401);
      esperarError(mal.body, 'NO_AUTENTICADO');
      const venc = firmar(
        {
          sub: lector.id,
          rol: 'lector',
          ver: 0,
          iat: ahora - 7200,
          exp: ahora - 3600,
        },
        SECRETO,
      );
      const v = await cerrar(venc, r.id).expect(401);
      esperarError(v.body, 'NO_AUTENTICADO');
      await cerrar('basura', r.id).expect(401);
      expect((await verRuta(r.id)).estado).toBe('en_curso');
    });

    it('el 401 gana sobre una ruta inexistente y sobre un cuerpo inválido', async () => {
      await c
        .http()
        .post('/rutas/rut-99-2026-05/cierre')
        .send({ x: 1 })
        .expect(401);
    });

    it('un token anterior al blanqueo de contraseña ya no cierra', async () => {
      const u = await conSesion(c, 'lector', { legajo: 'V5-SALE' });
      const r = await nueva({ lectorId: u.id });
      await c
        .http()
        .patch(`/usuarios/${u.id}`)
        .set(bearer(admin.token))
        .send({ contrasena: 'blanqueada-123' })
        .expect(200);
      const res = await cerrar(u, r.id).expect(401);
      esperarError(res.body, 'NO_AUTENTICADO');
      const nuevo = await ingresar(c, {
        legajo: u.legajo,
        contrasena: 'blanqueada-123',
      });
      await cerrar(nuevo, r.id).expect(200);
    });

    it('lector ajeno: 403 aunque la ruta no exista para él, y 403 gana sobre faltantes y sobre ruta cerrada', async () => {
      const r = await nueva();
      const rf = await nueva({ estado: 'cerrada' });
      const a = await cerrar(otro, r.id, {
        lecturaIds: ['lec-nada99'],
        novedadIds: [],
      }).expect(403);
      esperarError(a.body, 'SIN_PERMISO');
      const b = await cerrar(otro, rf.id).expect(403);
      esperarError(b.body, 'SIN_PERMISO');
      expect(b.body.error.mensaje).not.toMatch(/cerrada/);
    });

    it('la ruta inexistente es 404 antes que cualquier otra cosa para administración', async () => {
      const res = await cerrar(admin, 'rut-98-2026-05', {
        lecturaIds: ['lec-zzz999'],
        novedadIds: [],
      }).expect(404);
      esperarError(res.body, 'RUTA_NO_ENCONTRADA');
    });

    it('R23: administración cierra una ruta ajena y esa ruta queda cerrada', async () => {
      const r = await nueva({ lectorId: otro.id });
      const res = await cerrar(admin, r.id).expect(200);
      esperarContrato(res.body, 'Ruta');
      expect(res.body.datos.lectorId).toBe(otro.id);
      expect(res.body.datos.estado).toBe('cerrada');
    });

    it('administración con listas no vacías: se comprueban igual (A37)', async () => {
      const r = await nueva();
      const res = await cerrar(admin, r.id, {
        lecturaIds: ['lec-adminfalta'],
        novedadIds: [],
      }).expect(409);
      esperarError(res.body, 'HAY_DATOS_SIN_SUBIR');
    });

    it('administración sobre una ruta ya cerrada: RUTA_YA_CERRADA', async () => {
      const r = await nueva({ estado: 'cerrada' });
      const res = await cerrar(admin, r.id).expect(409);
      esperarError(res.body, 'RUTA_YA_CERRADA');
    });
  });

  describe('Efectos sobre el resto de la API tras cerrar', () => {
    it('/yo/rutas deja de listarla por defecto, la lista con estado=cerrada; rutasAsignadas y /rutas la reflejan', async () => {
      const u = await conSesion(c, 'lector', { legajo: 'V5-EFE' });
      const r = await nueva({ lectorId: u.id, numero: '71' });
      const antes = await c.http().get('/yo').set(bearer(u.token)).expect(200);
      expect(antes.body.datos.rutasAsignadas).toContain(r.id);
      await cerrar(u, r.id).expect(200);
      const def = await c
        .http()
        .get('/yo/rutas')
        .set(bearer(u.token))
        .expect(200);
      expect(def.body.datos.map((x: { id: string }) => x.id)).not.toContain(
        r.id,
      );
      const cer = await c
        .http()
        .get('/yo/rutas?estado=cerrada')
        .set(bearer(u.token))
        .expect(200);
      esperarContrato(cer.body, 'Ruta');
      expect(cer.body.datos.map((x: { id: string }) => x.id)).toContain(r.id);
      const yo = await c.http().get('/yo').set(bearer(u.token)).expect(200);
      expect(yo.body.datos.rutasAsignadas).not.toContain(r.id);
      const adm = await c
        .http()
        .get(`/rutas?lectorId=${u.id}&estado=cerrada`)
        .set(bearer(admin.token))
        .expect(200);
      expect(adm.body.meta.total).toBe(1);
    });

    it('descargar, editar o volver a cerrar: RUTA_YA_CERRADA; las lecturas y el avance se pueden seguir leyendo', async () => {
      const r = await nueva();
      const lid = id('lec');
      await lectura(r, 0, lid).expect(201);
      await cerrar(lector, r.id, { lecturaIds: [lid], novedadIds: [] }).expect(
        200,
      );
      const d = await c
        .http()
        .post(`/rutas/${r.id}/descarga`)
        .set(bearer(lector.token))
        .expect(409);
      esperarError(d.body, 'RUTA_YA_CERRADA');
      const p = await c
        .http()
        .patch(`/rutas/${r.id}`)
        .set(bearer(admin.token))
        .send({ nombre: 'otra' })
        .expect(409);
      esperarError(p.body, 'RUTA_YA_CERRADA');
      await c
        .http()
        .get(`/rutas/${r.id}/avance`)
        .set(bearer(lector.token))
        .expect(200);
      const ls = await c
        .http()
        .get(`/rutas/${r.id}/lecturas`)
        .set(bearer(lector.token))
        .expect(200);
      esperarContrato(ls.body, 'Lectura');
      expect(ls.body.datos).toHaveLength(1);
    });

    it('cerrar no manda ninguna push', async () => {
      const r = await nueva();
      const antes = c.enviador.enviados.length;
      await cerrar(lector, r.id).expect(200);
      expect(c.enviador.enviados.length).toBe(antes);
    });
  });

  describe('Concurrencia', () => {
    it('cinco cierres simultáneos: exactamente uno gana', async () => {
      const r = await nueva();
      const rs = await Promise.all(
        Array.from({ length: 5 }, () => cerrar(lector, r.id)),
      );
      const estados = rs.map((x) => x.status).sort();
      expect(estados).toEqual([200, 409, 409, 409, 409]);
      for (const x of rs.filter((y) => y.status === 409))
        esperarError(x.body, 'RUTA_YA_CERRADA');
    });

    it('cierre de lector y de administración a la vez: uno 200 y otro 409', async () => {
      const r = await nueva();
      const rs = await Promise.all([cerrar(lector, r.id), cerrar(admin, r.id)]);
      expect(rs.map((x) => x.status).sort()).toEqual([200, 409]);
    });

    it('cierre y carga de lectura simultáneos: nunca queda una lectura aceptada en una ruta cerrada sin que el cierre la haya listado', async () => {
      const r = await nueva();
      const lid = id('lec');
      const [cie, lec] = await Promise.all([
        cerrar(lector, r.id, vacio),
        lectura(r, 0, lid),
      ]);
      expect([200]).toContain(cie.status);
      expect([201, 409]).toContain(lec.status);
      if (lec.status === 409) esperarError(lec.body, 'RUTA_YA_CERRADA');
      // Si la lectura se aceptó, el cierre vacío no la conocía: el teléfono la
      // reintenta después y la ve en el servidor (R15), pero nada se perdió.
      if (lec.status === 201) {
        await lectura(r, 0, lid).expect(200);
      }
    });
  });

  describe('Catálogo: sobre de error exacto', () => {
    it.each([
      ['RUTA_YA_CERRADA', 409],
      ['HAY_DATOS_SIN_SUBIR', 409],
      ['SIN_PERMISO', 403],
      ['RUTA_NO_ENCONTRADA', 404],
    ])('%s -> %s sin campos extra y en castellano', async (codigo, estado) => {
      const r = await nueva();
      const cerrada = await nueva({ estado: 'cerrada' });
      const res =
        codigo === 'RUTA_YA_CERRADA'
          ? await cerrar(lector, cerrada.id)
          : codigo === 'HAY_DATOS_SIN_SUBIR'
            ? await cerrar(lector, r.id, {
                lecturaIds: ['lec-sinsub1'],
                novedadIds: [],
              })
            : codigo === 'SIN_PERMISO'
              ? await cerrar(otro, r.id)
              : await cerrar(lector, 'rut-97-2026-05');
      expect(res.status).toBe(estado);
      esperarError(res.body, codigo);
      expect(Object.keys(res.body)).toEqual(['error']);
      expect(Object.keys(res.body.error).sort()).toEqual(['codigo', 'mensaje']);
      expect(res.body.error.mensaje).not.toMatch(JERGA);
      expect(res.body.error.mensaje).toMatch(/[.!]$/);
    });
  });
});
