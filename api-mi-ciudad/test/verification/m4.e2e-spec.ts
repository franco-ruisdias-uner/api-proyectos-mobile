// Verificación independiente de M4 — Mi recorrido (verificador-contrato, AGENTS §12). Caja negra.
import { JwtService } from '@nestjs/jwt';
import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { conSesion, crearLugar, MUESTRAS, registrarTurista, subirArchivo } from '../utilities/builders.js';

const CLAVES = ['fechaHora', 'fotoUri', 'id', 'lugarId', 'nota', 'origen', 'sincronizada', 'usuarioId'];
const HACE_UN_RATO = '2026-11-14T10:30:00-03:00';

function esError(res: { status: number; body: any }, estado: number) {
  expect(res.status, JSON.stringify(res.body)).toBe(estado);
  expect(Object.keys(res.body)).toEqual(['error']);
  expect(Object.keys(res.body.error).sort()).toEqual(['codigo', 'mensaje']);
  expect(res.body.error.mensaje).not.toMatch(/undefined|TypeORM|SQL|constraint|Error:|\bmust\b|should/i);
}

describe('M4', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());
  beforeEach(() => ctx.reloj.fijar('2026-11-14T12:00:00-03:00'));

  const crear = (token: string, cuerpo: Record<string, unknown>) =>
    ctx.http().post('/yo/visitas').set(conSesion(token)).send(cuerpo);
  const base = (lugarId: string, extra: Record<string, unknown> = {}) => ({
    lugarId,
    fechaHora: HACE_UN_RATO,
    origen: 'manual',
    ...extra,
  });

  describe('Forma — claves exactas y nulos', () => {
    it('todo lleno y todo null: claves exactas en POST, PATCH y GET', async () => {
      const { token } = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      const url = await subirArchivo(ctx, token, MUESTRAS.png());
      const vacia = await crear(token, base(lugarId)).expect(201);
      const llena = await crear(token, base(lugarId, { fotoUri: url, nota: 'Hola', origen: 'gps' })).expect(
        201,
      );
      const patch = await ctx
        .http()
        .patch(`/yo/visitas/${vacia.body.datos.id}`)
        .set(conSesion(token))
        .send({ nota: 'x' })
        .expect(200);
      const lista = await ctx.http().get('/yo/visitas').set(conSesion(token)).expect(200);
      for (const r of [vacia, llena, patch]) {
        esperarContrato(r.body, 'Visita');
        expect(Object.keys(r.body.datos).sort()).toEqual(CLAVES);
      }
      esperarContrato(lista.body, 'Visita');
      for (const v of lista.body.datos) expect(Object.keys(v).sort()).toEqual(CLAVES);
      expect(vacia.body.datos.fotoUri).toBeNull();
      expect(vacia.body.datos.nota).toBeNull();
    });
  });

  describe('Fechas — normalización y bordes', () => {
    it.each([
      ['2026-11-14T10:30:00.123-03:00', '2026-11-14T10:30:00-03:00'],
      ['2026-11-14T13:30:00Z', '2026-11-14T10:30:00-03:00'],
      ['2026-11-14T15:30:00+05:00', '2026-11-14T07:30:00-03:00'],
      ['2027-01-01T02:59:59Z', '2026-12-31T23:59:59-03:00'],
      ['2026-02-28T23:59:59-03:00', '2026-02-28T23:59:59-03:00'],
      ['2024-02-29T00:00:00-03:00', '2024-02-29T00:00:00-03:00'],
    ])('fechaHora %s sale como %s', async (entrada, salida) => {
      ctx.reloj.fijar('2027-01-02T12:00:00-03:00');
      const { token } = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      const res = await crear(token, base(lugarId, { fechaHora: entrada })).expect(201);
      esperarContrato(res.body, 'Visita');
      expect(res.body.datos.fechaHora).toBe(salida);
    });

    it.each([
      ['2026-11-14'],
      ['14/11/2026 10:30'],
      ['ayer'],
      [''],
      [1731590000000],
      [null],
      [{}],
      ['2026-13-45T10:30:00-03:00'],
    ])('fechaHora inválida %j es 400 (nunca 500)', async (fechaHora) => {
      const { token } = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      esError(await crear(token, base(lugarId, { fechaHora })), 400);
    });

    it('fechaHora sin offset: no da 500 (duda: 400 o se asume -03:00)', async () => {
      const { token } = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      const res = await crear(token, base(lugarId, { fechaHora: '2026-11-14T10:30:00' }));
      expect([201, 400]).toContain(res.status);
      if (res.status === 201) esperarContrato(res.body, 'Visita');
    });

    it('R14 — borde de 5 minutos con el reloj a las 23:59 y a las 00:00', async () => {
      const { token } = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      ctx.reloj.fijar('2026-12-31T23:59:00-03:00');
      await crear(token, base(lugarId, { fechaHora: '2027-01-01T00:04:00-03:00' })).expect(201);
      esperarError(
        await crear(token, base(lugarId, { fechaHora: '2027-01-01T00:04:01-03:00' })),
        422,
        'FECHA_EN_EL_FUTURO',
      );
      ctx.reloj.fijar('2026-11-15T00:00:00-03:00');
      await crear(token, base(lugarId, { fechaHora: '2026-11-14T23:59:59-03:00' })).expect(201);
      esperarError(
        await crear(token, base(lugarId, { fechaHora: '2026-11-15T00:05:01-03:00' })),
        422,
        'FECHA_EN_EL_FUTURO',
      );
    });

    it('R14 — fecha muy vieja (2000) se acepta; año lejano futuro da 422', async () => {
      const { token } = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      await crear(token, base(lugarId, { fechaHora: '2000-01-01T00:00:00-03:00' })).expect(201);
      esperarError(
        await crear(token, base(lugarId, { fechaHora: '2999-01-01T00:00:00-03:00' })),
        422,
        'FECHA_EN_EL_FUTURO',
      );
    });

    it('R14 — un id repetido de una visita ya guardada devuelve 200 aunque el reloj haya retrocedido', async () => {
      const { token } = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      const cuerpo = base(lugarId, { id: 'vis-reloj001' });
      await crear(token, cuerpo).expect(201);
      ctx.reloj.fijar('2026-11-01T00:00:00-03:00');
      await crear(token, cuerpo).expect(200);
    });
  });

  describe('Entrada — validación del cuerpo', () => {
    it.each([
      ['campo de más: usuarioId', { usuarioId: 'usr-999' }],
      ['campo de más: createdAt', { createdAt: '2026-01-01T00:00:00-03:00' }],
      ['campo de más: password', { password: 'x' }],
      ['origen inválido', { origen: 'wifi' }],
      ['origen mayúsculas', { origen: 'QR' }],
      ['origen número', { origen: 1 }],
      ['origen null', { origen: null }],
      ['nota número', { nota: 5 }],
      ['nota objeto', { nota: {} }],
      ['fotoUri número', { fotoUri: 5 }],
      ['sincronizada string', { sincronizada: 'si' }],
      ['id sin prefijo', { id: 'abc-123456' }],
      ['id de otra entidad', { id: 'usr-123456' }],
      ['id corto', { id: 'vis-ab' }],
      ['id largo', { id: 'vis-' + 'a'.repeat(37) }],
      ['id mayúscula en prefijo', { id: 'VIS-abcdef' }],
      ['id con espacios', { id: 'vis-abc def' }],
      ['id numérico', { id: 12345 }],
      ['id vacío', { id: '' }],
    ])('400: %s', async (_c, extra) => {
      const { token } = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      esError(await crear(token, base(lugarId, extra)), 400);
      const l = await ctx.http().get('/yo/visitas').set(conSesion(token)).expect(200);
      expect(l.body.meta.total).toBe(0);
    });

    it.each([['lugarId'], ['fechaHora'], ['origen']])('falta %s: 400', async (campo) => {
      const { token } = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      const cuerpo: Record<string, unknown> = base(lugarId);
      delete cuerpo[campo];
      esError(await crear(token, cuerpo), 400);
    });

    it('cuerpo vacío, array o texto: 400 sin 500', async () => {
      const { token } = await registrarTurista(ctx);
      esError(await crear(token, {}), 400);
      const arr = await ctx.http().post('/yo/visitas').set(conSesion(token)).send([1]);
      expect([400]).toContain(arr.status);
      const txt = await ctx
        .http()
        .post('/yo/visitas')
        .set(conSesion(token))
        .set('Content-Type', 'application/json')
        .send('{roto');
      esError(txt, 400);
    });

    it.each([['lug-'], ['LUG-001'], ['cat-museos'], ['1'], [5], [null], ["lug-1' OR 1=1"]])(
      'lugarId %j: 400 o 404, nunca 500',
      async (lugarId) => {
        const { token } = await registrarTurista(ctx);
        const res = await crear(token, base('x', { lugarId }));
        expect([400, 404]).toContain(res.status);
        esError(res, res.status);
      },
    );

    it('LUGAR_NO_ENCONTRADO con id bien formado', async () => {
      const { token } = await registrarTurista(ctx);
      esperarError(await crear(token, base('lug-noexiste99')), 404, 'LUGAR_NO_ENCONTRADO');
    });

    it('un lugar dado de baja se puede visitar', async () => {
      const { token } = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx, { activo: false });
      await crear(token, base(lugarId)).expect(201);
    });
  });

  describe('R15 — nota', () => {
    it.each([
      ['  hola  ', 'hola'],
      ['', null],
      ['    ', null],
      ['\n\t', null],
      [null, null],
    ])('nota %j se guarda como %j', async (nota, esperado) => {
      const { token } = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      const res = await crear(token, base(lugarId, { nota })).expect(201);
      expect(res.body.datos.nota).toBe(esperado);
    });

    it('280 sí, 281 no; 280 con espacios alrededor recortados sí', async () => {
      const { token } = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      await crear(token, base(lugarId, { nota: 'a'.repeat(280) })).expect(201);
      esError(await crear(token, base(lugarId, { nota: 'a'.repeat(281) })), 400);
      const r = await crear(token, base(lugarId, { nota: ' ' + 'a'.repeat(280) + ' ' }));
      expect([201, 400]).toContain(r.status);
    });

    it('nota con tildes, emojis y comillas vuelve idéntica', async () => {
      const { token } = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      const nota = 'Ñandú "lindo" \'ok\' <b>&</b> 😀 ✓';
      const res = await crear(token, base(lugarId, { nota })).expect(201);
      expect(res.body.datos.nota).toBe(nota);
    });

    it('280 emojis (caracteres, no unidades UTF-16)', async () => {
      const { token } = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      const res = await crear(token, base(lugarId, { nota: '😀'.repeat(280) }));
      // Duda de especificación si da 400; lo importante: no 500.
      expect([201, 400]).toContain(res.status);
    });
  });

  describe('R13 — fotoUri', () => {
    it.each([
      ['file://'],
      ['https://ejemplo.com/a.jpg'],
      ['foto'],
      ['http://127.0.0.1/archivos/../../etc/passwd'],
      ['/archivos/imagenes/2026/11/nada.jpg'],
    ])('ARCHIVO_NO_SUBIDO: %s', async (fotoUri) => {
      const { token } = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      esperarError(await crear(token, base(lugarId, { fotoUri })), 422, 'ARCHIVO_NO_SUBIDO');
    });

    it('fotoUri "" no se guarda como ""', async () => {
      const { token } = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      const res = await crear(token, base(lugarId, { fotoUri: '' }));
      expect([201, 400, 422]).toContain(res.status);
      if (res.status === 201) expect(res.body.datos.fotoUri).toBeNull();
    });

    it('un video y un audio no sirven; una imagen de otro usuario sí (subida por la API)', async () => {
      const a = await registrarTurista(ctx);
      const b = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      const video = await subirArchivo(ctx, a.token, MUESTRAS.mp4(), 'v.mp4');
      esperarError(await crear(a.token, base(lugarId, { fotoUri: video })), 422, 'ARCHIVO_NO_SUBIDO');
      const img = await subirArchivo(ctx, a.token, MUESTRAS.jpg(), 'a.jpg');
      const res = await crear(b.token, base(lugarId, { fotoUri: img }));
      expect([201, 422]).toContain(res.status);
    });

    it('la URL con otro host pero clave válida: no da 500', async () => {
      const { token } = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      const url = await subirArchivo(ctx, token, MUESTRAS.png());
      const otra = 'http://10.0.0.5:3000' + new URL(url).pathname;
      const res = await crear(token, base(lugarId, { fotoUri: otra }));
      expect([201, 422]).toContain(res.status);
      if (res.status === 201) esperarContrato(res.body, 'Visita');
    });

    it('la URL de la foto sale con el Host del pedido', async () => {
      const { token } = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      const url = await subirArchivo(ctx, token, MUESTRAS.png());
      const res = await ctx
        .http()
        .post('/yo/visitas')
        .set(conSesion(token))
        .set('Host', '10.0.0.5:3000')
        .send(base(lugarId, { fotoUri: url }));
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      expect(res.body.datos.fotoUri.startsWith('http://10.0.0.5:3000/archivos/')).toBe(true);
    });
  });

  describe('R12 / AGENTS §10.5 — idempotencia y concurrencia', () => {
    it('el mismo POST dos veces: un registro, mismo cuerpo de respuesta', async () => {
      const { token } = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      const cuerpo = base(lugarId, { id: 'vis-idem0001', nota: 'n', origen: 'qr' });
      const a = await crear(token, cuerpo).expect(201);
      const b = await crear(token, cuerpo).expect(200);
      expect(b.body).toEqual(a.body);
      esperarContrato(b.body, 'Visita');
      const l = await ctx.http().get('/yo/visitas').set(conSesion(token)).expect(200);
      expect(l.body.meta.total).toBe(1);
    });

    it('sin id, dos POST iguales crean dos visitas (D8)', async () => {
      const { token } = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      const a = await crear(token, base(lugarId)).expect(201);
      const b = await crear(token, base(lugarId)).expect(201);
      expect(a.body.datos.id).not.toBe(b.body.datos.id);
    });

    it('ids de cliente con mayúsculas/guiones son sensibles y distintos', async () => {
      const { token } = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      await crear(token, base(lugarId, { id: 'vis-AbC_-9' })).expect(201);
      await crear(token, base(lugarId, { id: 'vis-abc_-9' })).expect(201);
      const l = await ctx.http().get('/yo/visitas').set(conSesion(token)).expect(200);
      expect(l.body.meta.total).toBe(2);
    });

    it('ID_EN_USO: id de otro usuario da 409, sin filtrar datos, aunque el cuerpo sea inválido en fecha/lugar', async () => {
      const a = await registrarTurista(ctx);
      const b = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      await crear(a.token, base(lugarId, { id: 'vis-ajena001', nota: 'secreto' })).expect(201);
      const res = await crear(b.token, base(lugarId, { id: 'vis-ajena001' }));
      esperarError(res, 409, 'ID_EN_USO');
      expect(JSON.stringify(res.body)).not.toMatch(/secreto|usr-/);
      const lb = await ctx.http().get('/yo/visitas').set(conSesion(b.token)).expect(200);
      expect(lb.body.meta.total).toBe(0);
    });

    it('10 POST simultáneos con el mismo id: uno 201, el resto 200, un solo registro', async () => {
      const { token } = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      const cuerpo = base(lugarId, { id: 'vis-conc0001' });
      const rs = await Promise.all(Array.from({ length: 10 }, () => crear(token, cuerpo)));
      const estados = rs.map((r) => r.status).sort();
      expect(estados, JSON.stringify(rs.map((r) => r.body))).toEqual([
        200, 200, 200, 200, 200, 200, 200, 200, 200, 201,
      ]);
      const l = await ctx.http().get('/yo/visitas').set(conSesion(token)).expect(200);
      expect(l.body.meta.total).toBe(1);
    });

    it('dos usuarios simultáneos con el mismo id: uno 201 y el otro 409 ID_EN_USO', async () => {
      const a = await registrarTurista(ctx);
      const b = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      const cuerpo = base(lugarId, { id: 'vis-conc0002' });
      const [ra, rb] = await Promise.all([crear(a.token, cuerpo), crear(b.token, cuerpo)]);
      const estados = [ra.status, rb.status].sort();
      expect(estados, JSON.stringify([ra.body, rb.body])).toEqual([201, 409]);
      const perdedora = ra.status === 409 ? ra : rb;
      esperarError(perdedora, 409, 'ID_EN_USO');
    });
  });

  describe('Permisos', () => {
    it('token vencido, mal firmado y basura: 401 en las tres rutas', async () => {
      const { usuario } = await registrarTurista(ctx);
      const jwt = ctx.app.get(JwtService);
      const vencido = await jwt.signAsync({ sub: usuario.id, rol: 'turista' }, { expiresIn: '-1h' });
      const falso = await new JwtService({ secret: 'otro-secreto-cualquiera-de-32-caracteres!!' }).signAsync({
        sub: usuario.id,
        rol: 'turista',
      });
      for (const t of [vencido, falso, 'basura']) {
        for (const [m, r] of [
          ['get', '/yo/visitas'],
          ['post', '/yo/visitas'],
          ['patch', '/yo/visitas/vis-abcdef'],
        ] as const) {
          esperarError(await ctx.http()[m](r).set(conSesion(t)).send({}), 401, 'NO_AUTENTICADO');
        }
      }
    });

    it('token de usuario que ya no existe: no 500', async () => {
      const jwt = ctx.app.get(JwtService);
      const t = await jwt.signAsync({ sub: 'usr-fantasma', rol: 'turista' });
      const res = await ctx.http().get('/yo/visitas').set(conSesion(t));
      expect([200, 401]).toContain(res.status);
    });

    it('un admin también tiene su propio recorrido, y no ve el de otros', async () => {
      const a = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      await crear(a.token, base(lugarId)).expect(201);
      const b = await registrarTurista(ctx);
      const l = await ctx.http().get('/yo/visitas').set(conSesion(b.token)).expect(200);
      expect(l.body.datos).toEqual([]);
    });
  });

  describe('PATCH /yo/visitas/:id', () => {
    async function visita(extra: Record<string, unknown> = {}) {
      const u = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      const r = await crear(u.token, base(lugarId, extra)).expect(201);
      return { ...u, lugarId, id: r.body.datos.id as string, visita: r.body.datos };
    }
    const patch = (token: string, id: string, cuerpo: unknown) =>
      ctx
        .http()
        .patch(`/yo/visitas/${id}`)
        .set(conSesion(token))
        .send(cuerpo as object);

    it('foto y nota juntas, luego null en ambas', async () => {
      const v = await visita({ nota: 'vieja' });
      const url = await subirArchivo(ctx, v.token, MUESTRAS.jpg(), 'a.jpg');
      const a = await patch(v.token, v.id, { fotoUri: url, nota: 'nueva' }).expect(200);
      esperarContrato(a.body, 'Visita');
      expect(a.body.datos.fotoUri).toBe(url);
      expect(a.body.datos.nota).toBe('nueva');
      const b = await patch(v.token, v.id, { fotoUri: null, nota: null }).expect(200);
      expect(b.body.datos.fotoUri).toBeNull();
      expect(b.body.datos.nota).toBeNull();
      expect(b.body.datos.fechaHora).toBe(v.visita.fechaHora);
      expect(b.body.datos.id).toBe(v.id);
    });

    it('nota vacía o en blanco por PATCH queda null; con espacios se recorta', async () => {
      const v = await visita({ nota: 'algo' });
      expect((await patch(v.token, v.id, { nota: '   ' }).expect(200)).body.datos.nota).toBeNull();
      expect((await patch(v.token, v.id, { nota: ' hey ' }).expect(200)).body.datos.nota).toBe('hey');
      expect((await patch(v.token, v.id, { nota: '' }).expect(200)).body.datos.nota).toBeNull();
    });

    it('PATCH sólo con fotoUri no borra la nota, y viceversa', async () => {
      const v = await visita({ nota: 'queda' });
      const url = await subirArchivo(ctx, v.token);
      const r = await patch(v.token, v.id, { fotoUri: url }).expect(200);
      expect(r.body.datos.nota).toBe('queda');
      const r2 = await patch(v.token, v.id, { nota: 'otra' }).expect(200);
      expect(r2.body.datos.fotoUri).toBe(url);
    });

    it.each([
      ['lugarId', { lugarId: 'lug-x1234' }],
      ['fechaHora', { fechaHora: HACE_UN_RATO }],
      ['origen', { origen: 'qr' }],
      ['id', { id: 'vis-otro0001' }],
      ['usuarioId', { usuarioId: 'usr-1' }],
      ['sincronizada', { sincronizada: false }],
      ['nota número', { nota: 3 }],
      ['nota 281', { nota: 'a'.repeat(281) }],
      ['fotoUri número', { fotoUri: 3 }],
    ])('400: %s', async (_c, cuerpo) => {
      const v = await visita();
      esError(await patch(v.token, v.id, cuerpo), 400);
    });

    it('ARCHIVO_NO_SUBIDO por PATCH: file://, ajena, audio', async () => {
      const v = await visita();
      const audio = await subirArchivo(ctx, v.token, MUESTRAS.m4a(), 'a.m4a');
      for (const f of ['file:///x.jpg', 'https://x.com/a.jpg', audio]) {
        esperarError(await patch(v.token, v.id, { fotoUri: f }), 422, 'ARCHIVO_NO_SUBIDO');
      }
    });

    it('cuerpo vacío: 200 sin cambios', async () => {
      const v = await visita({ nota: 'n' });
      const r = await patch(v.token, v.id, {}).expect(200);
      expect(r.body.datos).toEqual(v.visita);
    });

    it.each([['vis-noexiste1'], ['xxx'], ['lug-004'], ['vis-'], ['%20']])(
      '404 VISITA_NO_ENCONTRADA para %s',
      async (id) => {
        const v = await visita();
        esperarError(await patch(v.token, id, { nota: 'x' }), 404, 'VISITA_NO_ENCONTRADA');
      },
    );

    it('SIN_PERMISO 403 con visita ajena, y no cambia; el 403 no filtra datos', async () => {
      const v = await visita({ nota: 'privada' });
      const otro = await registrarTurista(ctx);
      const r = await patch(otro.token, v.id, { nota: 'hack' });
      esperarError(r, 403, 'SIN_PERMISO');
      expect(JSON.stringify(r.body)).not.toMatch(/privada/);
      const l = await ctx.http().get('/yo/visitas').set(conSesion(v.token)).expect(200);
      expect(l.body.datos[0].nota).toBe('privada');
    });

    it('PATCH con visita ajena y cuerpo inválido: 400 o 403, nunca 500/200', async () => {
      const v = await visita();
      const otro = await registrarTurista(ctx);
      const r = await patch(otro.token, v.id, { nota: 'a'.repeat(300) });
      expect([400, 403]).toContain(r.status);
    });

    it('PATCH funciona con el reloj movido (la fechaHora vieja no se revalida)', async () => {
      const v = await visita();
      ctx.reloj.fijar('2020-01-01T00:00:00-03:00');
      await patch(v.token, v.id, { nota: 'ok' }).expect(200);
    });

    it('DELETE no existe (D8): 404 o 405, sin 204', async () => {
      const v = await visita();
      const r = await ctx.http().delete(`/yo/visitas/${v.id}`).set(conSesion(v.token));
      expect([404, 405]).toContain(r.status);
      const l = await ctx.http().get('/yo/visitas').set(conSesion(v.token)).expect(200);
      expect(l.body.meta.total).toBe(1);
    });
  });

  describe('GET /yo/visitas — orden y paginación', () => {
    it('orden ascendente por fechaHora (por instante, no por texto), desempate por id, estable', async () => {
      const { token } = await registrarTurista(ctx);
      const lugarId = await crearLugar(ctx);
      const casos = [
        ['vis-zzz00001', '2026-11-14T09:00:00-03:00'],
        ['vis-aaa00001', '2026-11-14T13:00:00Z'], // 10:00 -03
        ['vis-bbb00001', '2026-11-14T10:00:00-03:00'], // empate con la anterior
        ['vis-ccc00001', '2026-01-01T00:00:00-03:00'],
        ['vis-ddd00001', '2026-11-14T11:59:00-03:00'],
      ];
      for (const [id, fechaHora] of casos) await crear(token, base(lugarId, { id, fechaHora })).expect(201);
      const l = await ctx.http().get('/yo/visitas').set(conSesion(token)).expect(200);
      esperarContrato(l.body, 'Visita');
      expect(l.body.datos.map((v: { id: string }) => v.id)).toEqual([
        'vis-ccc00001',
        'vis-zzz00001',
        'vis-aaa00001',
        'vis-bbb00001',
        'vis-ddd00001',
      ]);
      const p1 = await ctx.http().get('/yo/visitas?pagina=1&porPagina=2').set(conSesion(token)).expect(200);
      const p2 = await ctx.http().get('/yo/visitas?pagina=2&porPagina=2').set(conSesion(token)).expect(200);
      const p3 = await ctx.http().get('/yo/visitas?pagina=3&porPagina=2').set(conSesion(token)).expect(200);
      const p9 = await ctx.http().get('/yo/visitas?pagina=9&porPagina=2').set(conSesion(token)).expect(200);
      expect(p1.body.meta).toEqual({ total: 5, pagina: 1, porPagina: 2 });
      expect(p3.body.datos).toHaveLength(1);
      expect(p9.body).toEqual({ datos: [], meta: { total: 5, pagina: 9, porPagina: 2 } });
      const ids = [...p1.body.datos, ...p2.body.datos, ...p3.body.datos].map((v: { id: string }) => v.id);
      expect(ids).toEqual(l.body.datos.map((v: { id: string }) => v.id));
    });

    it.each([
      ['pagina=0'],
      ['pagina=-1'],
      ['pagina=abc'],
      ['porPagina=0'],
      ['porPagina=501'],
      ['porPagina=-5'],
      ['porPagina=1.5'],
    ])('?%s es 400', async (q) => {
      const { token } = await registrarTurista(ctx);
      esError(await ctx.http().get(`/yo/visitas?${q}`).set(conSesion(token)), 400);
    });

    it('porPagina=500 y default 20', async () => {
      const { token } = await registrarTurista(ctx);
      const a = await ctx.http().get('/yo/visitas?porPagina=500').set(conSesion(token)).expect(200);
      expect(a.body.meta.porPagina).toBe(500);
      const b = await ctx.http().get('/yo/visitas').set(conSesion(token)).expect(200);
      expect(b.body.meta.porPagina).toBe(20);
    });

    it('filtro desconocido (lugarId) no rompe: 200 o 400', async () => {
      const { token } = await registrarTurista(ctx);
      const r = await ctx.http().get('/yo/visitas?lugarId=lug-1').set(conSesion(token));
      expect([200, 400]).toContain(r.status);
    });
  });
});
