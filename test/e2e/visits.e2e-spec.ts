import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import {
  claveDe,
  conSesion,
  crearLugar,
  MUESTRAS,
  registrarTurista,
  subirArchivo,
} from '../utilities/builders.js';

const HACE_UN_RATO = '2026-11-14T10:30:00-03:00';

describe('PRD §4 — Mi recorrido: /yo/visitas', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  const crear = (token: string, cuerpo: Record<string, unknown>) =>
    ctx.http().post('/yo/visitas').set(conSesion(token)).send(cuerpo);

  it('sin token, las tres rutas dan 401', async () => {
    for (const [metodo, ruta] of [
      ['get', '/yo/visitas'],
      ['post', '/yo/visitas'],
      ['patch', '/yo/visitas/vis-abc'],
    ] as const) {
      esperarError(await ctx.http()[metodo](ruta), 401, 'NO_AUTENTICADO');
    }
  });

  it('lista vacía para quien no registró nada', async () => {
    const { token } = await registrarTurista(ctx);
    const res = await ctx.http().get('/yo/visitas').set(conSesion(token)).expect(200);
    expect(res.body).toEqual({ datos: [], meta: { total: 0, pagina: 1, porPagina: 20 } });
  });

  it('POST registra una visita (201) con la forma del contrato y nulos en lo que falta', async () => {
    const { token, usuario } = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    const res = await crear(token, { lugarId, fechaHora: HACE_UN_RATO, origen: 'qr' }).expect(201);
    esperarContrato(res.body, 'Visita');
    expect(res.body.meta).toBeNull();
    expect(res.body.datos).toEqual({
      id: expect.stringMatching(/^vis-[a-z0-9]{12}$/),
      usuarioId: usuario.id,
      lugarId,
      fechaHora: HACE_UN_RATO,
      origen: 'qr',
      fotoUri: null,
      nota: null,
      sincronizada: true,
    });
  });

  it('el instante entra con Z o con otro offset y sale normalizado a -03:00', async () => {
    const { token } = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    const res = await crear(token, {
      lugarId,
      fechaHora: '2026-11-14T13:30:00.000Z',
      origen: 'gps',
    }).expect(201);
    expect(res.body.datos.fechaHora).toBe('2026-11-14T10:30:00-03:00');
  });

  it('PRD §4 — acepta el id del cliente y la cola offline lo puede repetir (R12)', async () => {
    const { token } = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    const cuerpo = {
      id: 'vis-cola0001',
      lugarId,
      fechaHora: HACE_UN_RATO,
      origen: 'manual',
      nota: 'Linda vista',
    };
    const a = await crear(token, cuerpo).expect(201);
    const b = await crear(token, cuerpo).expect(200);
    expect(a.body.datos.id).toBe('vis-cola0001');
    expect(b.body).toEqual(a.body);
    const lista = await ctx.http().get('/yo/visitas').set(conSesion(token)).expect(200);
    expect(lista.body.meta.total).toBe(1);
  });

  it('R12 — el mismo id con otro cuerpo devuelve la visita existente, sin pisarla', async () => {
    const { token } = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    const a = await crear(token, {
      id: 'vis-cola0002',
      lugarId,
      fechaHora: HACE_UN_RATO,
      origen: 'qr',
    }).expect(201);
    const b = await crear(token, {
      id: 'vis-cola0002',
      lugarId,
      fechaHora: '2026-11-13T10:00:00-03:00',
      origen: 'gps',
      nota: 'otra',
    }).expect(200);
    expect(b.body).toEqual(a.body);
  });

  it('R12 — dos POST simultáneos con el mismo id: uno crea, otro devuelve el existente', async () => {
    const { token } = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    const cuerpo = { id: 'vis-carrera1', lugarId, fechaHora: HACE_UN_RATO, origen: 'qr' };
    const [a, b] = await Promise.all([crear(token, cuerpo), crear(token, cuerpo)]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(a.body.datos.id).toBe(b.body.datos.id);
    const lista = await ctx.http().get('/yo/visitas').set(conSesion(token)).expect(200);
    expect(lista.body.meta.total).toBe(1);
  });

  it('ID_EN_USO — un id que ya es de otro usuario da 409 y no filtra la visita ajena', async () => {
    const uno = await registrarTurista(ctx);
    const otro = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    await crear(uno.token, { id: 'vis-ajena001', lugarId, fechaHora: HACE_UN_RATO, origen: 'qr' }).expect(
      201,
    );
    const res = await crear(otro.token, {
      id: 'vis-ajena001',
      lugarId,
      fechaHora: HACE_UN_RATO,
      origen: 'qr',
    });
    esperarError(res, 409, 'ID_EN_USO');
    const propias = await ctx.http().get('/yo/visitas').set(conSesion(otro.token)).expect(200);
    expect(propias.body.datos).toEqual([]);
  });

  it.each([
    ['sin lugarId', { fechaHora: HACE_UN_RATO, origen: 'qr' }],
    ['sin fechaHora', { lugarId: 'lug-001', origen: 'qr' }],
    ['sin origen', { lugarId: 'lug-001', fechaHora: HACE_UN_RATO }],
    ['origen fuera de la lista', { lugarId: 'lug-001', fechaHora: HACE_UN_RATO, origen: 'wifi' }],
    ['fecha sin zona', { lugarId: 'lug-001', fechaHora: '2026-11-14T10:30:00', origen: 'qr' }],
    ['fecha imposible', { lugarId: 'lug-001', fechaHora: '2026-02-30T10:30:00-03:00', origen: 'qr' }],
    ['fecha numérica', { lugarId: 'lug-001', fechaHora: 1763083800, origen: 'qr' }],
    [
      'id con prefijo de otra cosa',
      { id: 'lug-abc123', lugarId: 'lug-001', fechaHora: HACE_UN_RATO, origen: 'qr' },
    ],
    ['id demasiado corto', { id: 'vis-a', lugarId: 'lug-001', fechaHora: HACE_UN_RATO, origen: 'qr' }],
    ['id numérico', { id: 311, lugarId: 'lug-001', fechaHora: HACE_UN_RATO, origen: 'qr' }],
    ['nota que no es texto', { lugarId: 'lug-001', fechaHora: HACE_UN_RATO, origen: 'qr', nota: 5 }],
    ['campo desconocido', { lugarId: 'lug-001', fechaHora: HACE_UN_RATO, origen: 'qr', usuarioId: 'usr-1' }],
  ])('400 VALIDACION_FALLIDA: %s', async (_caso, cuerpo) => {
    const { token } = await registrarTurista(ctx);
    esperarError(await crear(token, cuerpo), 400, 'VALIDACION_FALLIDA');
  });

  it('el campo sincronizada se ignora en la entrada y siempre sale true', async () => {
    const { token } = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    const res = await crear(token, {
      lugarId,
      fechaHora: HACE_UN_RATO,
      origen: 'qr',
      sincronizada: false,
    }).expect(201);
    expect(res.body.datos.sincronizada).toBe(true);
  });

  it('LUGAR_NO_ENCONTRADO — un lugar que no existe (o mal formado) da 404', async () => {
    const { token } = await registrarTurista(ctx);
    esperarError(
      await crear(token, { lugarId: 'lug-noexiste', fechaHora: HACE_UN_RATO, origen: 'qr' }),
      404,
      'LUGAR_NO_ENCONTRADO',
    );
    esperarError(
      await crear(token, { lugarId: 'xyz', fechaHora: HACE_UN_RATO, origen: 'qr' }),
      404,
      'LUGAR_NO_ENCONTRADO',
    );
  });

  it('R14 — FECHA_EN_EL_FUTURO: más de 5 minutos adelante es 422; hasta 5, se acepta', async () => {
    const { token } = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    esperarError(
      await crear(token, { lugarId, fechaHora: '2026-11-14T12:05:01-03:00', origen: 'manual' }),
      422,
      'FECHA_EN_EL_FUTURO',
    );
    esperarError(
      await crear(token, { lugarId, fechaHora: '2026-11-15T12:00:00-03:00', origen: 'manual' }),
      422,
      'FECHA_EN_EL_FUTURO',
    );
    await crear(token, { lugarId, fechaHora: '2026-11-14T12:05:00-03:00', origen: 'manual' }).expect(201);
  });

  it('R16 — se puede visitar el mismo lugar dos veces, incluso el mismo día', async () => {
    const { token } = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    await crear(token, { lugarId, fechaHora: '2026-11-14T09:00:00-03:00', origen: 'gps' }).expect(201);
    await crear(token, { lugarId, fechaHora: '2026-11-14T11:00:00-03:00', origen: 'qr' }).expect(201);
    const lista = await ctx.http().get('/yo/visitas').set(conSesion(token)).expect(200);
    expect(lista.body.meta.total).toBe(2);
  });

  it('R15 — la nota admite 280 caracteres; 281 es 400; vacía o en blanco se guarda como null', async () => {
    const { token } = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    const base = { lugarId, fechaHora: HACE_UN_RATO, origen: 'manual' };
    const larga = await crear(token, { ...base, nota: 'a'.repeat(280) }).expect(201);
    expect(larga.body.datos.nota).toHaveLength(280);
    esperarError(await crear(token, { ...base, nota: 'a'.repeat(281) }), 400, 'VALIDACION_FALLIDA');
    for (const nota of ['', '   ', null]) {
      const res = await crear(token, { ...base, nota }).expect(201);
      expect(res.body.datos.nota).toBeNull();
    }
    const conEspacios = await crear(token, { ...base, nota: '  Hermoso  ' }).expect(201);
    expect(conEspacios.body.datos.nota).toBe('Hermoso');
  });

  it('R13 — con una foto subida por POST /archivos, fotoUri vuelve como URL absoluta de la API', async () => {
    const { token } = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    const url = await subirArchivo(ctx, token, MUESTRAS.jpg(), 'foto.jpg');
    const res = await crear(token, { lugarId, fechaHora: HACE_UN_RATO, origen: 'qr', fotoUri: url }).expect(
      201,
    );
    esperarContrato(res.body, 'Visita');
    expect(res.body.datos.fotoUri).toBe(url);
    await ctx.http().get(new URL(res.body.datos.fotoUri).pathname).expect(200);
  });

  it.each([
    ['un file://', 'file:///data/user/0/visitas/vis-311.jpg'],
    ['una URL ajena', 'https://ejemplo.com/foto.jpg'],
    ['una clave que no existe', 'http://127.0.0.1:3000/archivos/imagenes/2026/11/nada.jpg'],
    ['un texto cualquiera', 'foto'],
  ])('R13 — ARCHIVO_NO_SUBIDO: %s', async (_caso, fotoUri) => {
    const { token } = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    esperarError(
      await crear(token, { lugarId, fechaHora: HACE_UN_RATO, origen: 'qr', fotoUri }),
      422,
      'ARCHIVO_NO_SUBIDO',
    );
    const lista = await ctx.http().get('/yo/visitas').set(conSesion(token)).expect(200);
    expect(lista.body.meta.total).toBe(0);
  });

  it('R13 — un audio no sirve como foto', async () => {
    const { token } = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    const url = await subirArchivo(ctx, token, MUESTRAS.m4a(), 'a.m4a');
    esperarError(
      await crear(token, { lugarId, fechaHora: HACE_UN_RATO, origen: 'qr', fotoUri: url }),
      422,
      'ARCHIVO_NO_SUBIDO',
    );
  });

  it('el lugar dado de baja se puede visitar (registro histórico)', async () => {
    const { token } = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx, { activo: false });
    await crear(token, { lugarId, fechaHora: HACE_UN_RATO, origen: 'manual' }).expect(201);
  });

  it('GET — por fechaHora ASCENDENTE (en orden), desempate por id, con paginación y sólo las mías', async () => {
    const yo = await registrarTurista(ctx);
    const otro = await registrarTurista(ctx);
    const lugarId = await crearLugar(ctx);
    const visita = (id: string, fechaHora: string) => ({ id, lugarId, fechaHora, origen: 'gps' });
    await crear(yo.token, visita('vis-orden03', '2026-11-14T11:00:00-03:00')).expect(201);
    await crear(yo.token, visita('vis-orden01', '2026-11-12T11:00:00-03:00')).expect(201);
    await crear(yo.token, visita('vis-orden02b', '2026-11-13T11:00:00-03:00')).expect(201);
    await crear(yo.token, visita('vis-orden02a', '2026-11-13T11:00:00-03:00')).expect(201);
    await crear(otro.token, visita('vis-ordenotro', '2026-11-11T11:00:00-03:00')).expect(201);
    const todas = await ctx.http().get('/yo/visitas').set(conSesion(yo.token)).expect(200);
    esperarContrato(todas.body, 'Visita');
    expect(todas.body.datos.map((v: { id: string }) => v.id)).toEqual([
      'vis-orden01',
      'vis-orden02a',
      'vis-orden02b',
      'vis-orden03',
    ]);
    expect(todas.body.meta).toEqual({ total: 4, pagina: 1, porPagina: 20 });
    const p2 = await ctx.http().get('/yo/visitas?pagina=2&porPagina=3').set(conSesion(yo.token)).expect(200);
    expect(p2.body.datos.map((v: { id: string }) => v.id)).toEqual(['vis-orden03']);
    expect(p2.body.meta).toEqual({ total: 4, pagina: 2, porPagina: 3 });
    const fuera = await ctx.http().get('/yo/visitas?pagina=9').set(conSesion(yo.token)).expect(200);
    expect(fuera.body).toEqual({ datos: [], meta: { total: 4, pagina: 9, porPagina: 20 } });
  });

  it('GET — porPagina admite hasta 500 y 501 es 400', async () => {
    const { token } = await registrarTurista(ctx);
    await ctx.http().get('/yo/visitas?porPagina=500').set(conSesion(token)).expect(200);
    esperarError(
      await ctx.http().get('/yo/visitas?porPagina=501').set(conSesion(token)),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  describe('PATCH /yo/visitas/:id', () => {
    const nueva = async (token: string) => {
      const lugarId = await crearLugar(ctx);
      const res = await crear(token, { lugarId, fechaHora: HACE_UN_RATO, origen: 'gps' }).expect(201);
      return res.body.datos as { id: string };
    };
    const parchar = (token: string, id: string, cuerpo: Record<string, unknown>) =>
      ctx.http().patch(`/yo/visitas/${id}`).set(conSesion(token)).send(cuerpo);

    it('PRD §4 — la foto llega después que la visita', async () => {
      const { token } = await registrarTurista(ctx);
      const visita = await nueva(token);
      const url = await subirArchivo(ctx, token);
      const res = await parchar(token, visita.id, { fotoUri: url }).expect(200);
      esperarContrato(res.body, 'Visita');
      expect(res.body.datos.fotoUri).toBe(url);
      expect(res.body.datos.nota).toBeNull();
      expect(res.body.datos.id).toBe(visita.id);
    });

    it('cambia sólo lo que se manda; null saca la foto o la nota', async () => {
      const { token } = await registrarTurista(ctx);
      const visita = await nueva(token);
      const url = await subirArchivo(ctx, token);
      await parchar(token, visita.id, { fotoUri: url, nota: 'Una nota' }).expect(200);
      const soloNota = await parchar(token, visita.id, { nota: 'Otra nota' }).expect(200);
      expect(soloNota.body.datos).toMatchObject({ fotoUri: url, nota: 'Otra nota' });
      const sinFoto = await parchar(token, visita.id, { fotoUri: null }).expect(200);
      expect(sinFoto.body.datos).toMatchObject({ fotoUri: null, nota: 'Otra nota' });
      const sinNota = await parchar(token, visita.id, { nota: '  ' }).expect(200);
      expect(sinNota.body.datos.nota).toBeNull();
    });

    it('un cuerpo vacío es 200 y no cambia nada; no se puede cambiar lugar, fecha ni origen', async () => {
      const { token } = await registrarTurista(ctx);
      const visita = await nueva(token);
      await parchar(token, visita.id, {}).expect(200);
      for (const campo of [
        { lugarId: 'lug-001' },
        { fechaHora: HACE_UN_RATO },
        { origen: 'qr' },
        { id: 'vis-otro1' },
      ]) {
        esperarError(await parchar(token, visita.id, campo), 400, 'VALIDACION_FALLIDA');
      }
    });

    it('400 con una nota de 281 caracteres', async () => {
      const { token } = await registrarTurista(ctx);
      const visita = await nueva(token);
      esperarError(await parchar(token, visita.id, { nota: 'a'.repeat(281) }), 400, 'VALIDACION_FALLIDA');
    });

    it('R13 — ARCHIVO_NO_SUBIDO con un file:// o una URL ajena', async () => {
      const { token } = await registrarTurista(ctx);
      const visita = await nueva(token);
      esperarError(await parchar(token, visita.id, { fotoUri: 'file:///x/y.jpg' }), 422, 'ARCHIVO_NO_SUBIDO');
      esperarError(
        await parchar(token, visita.id, { fotoUri: 'https://ejemplo.com/a.jpg' }),
        422,
        'ARCHIVO_NO_SUBIDO',
      );
    });

    it('VISITA_NO_ENCONTRADA — un id que no existe o mal formado da 404', async () => {
      const { token } = await registrarTurista(ctx);
      esperarError(await parchar(token, 'vis-noexiste', { nota: 'x' }), 404, 'VISITA_NO_ENCONTRADA');
      esperarError(await parchar(token, 'xyz', { nota: 'x' }), 404, 'VISITA_NO_ENCONTRADA');
    });

    it('SIN_PERMISO — la visita de otra persona no se puede tocar (y no cambia)', async () => {
      const uno = await registrarTurista(ctx);
      const otro = await registrarTurista(ctx);
      const visita = await nueva(uno.token);
      esperarError(await parchar(otro.token, visita.id, { nota: 'ajena' }), 403, 'SIN_PERMISO');
      const lista = await ctx.http().get('/yo/visitas').set(conSesion(uno.token)).expect(200);
      expect(lista.body.datos[0].nota).toBeNull();
    });

    it('la clave de la foto sale de /archivos: no se guarda la URL', async () => {
      const { token } = await registrarTurista(ctx);
      const visita = await nueva(token);
      const url = await subirArchivo(ctx, token);
      await parchar(token, visita.id, { fotoUri: url }).expect(200);
      const res = await ctx
        .http()
        .get('/yo/visitas')
        .set(conSesion(token))
        .set('Host', '10.0.0.5:3000')
        .expect(200);
      expect(res.body.datos[0].fotoUri).toBe(`http://10.0.0.5:3000/archivos/${claveDe(url)}`);
    });
  });
});
