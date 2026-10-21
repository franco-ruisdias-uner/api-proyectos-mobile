// Verificación independiente de M2 — Crear y seguir (ESPECIFICACION §4 M2, R1–R8, R18, §6). Caja negra.
import { JwtService } from '@nestjs/jwt';
import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import {
  crearTipo,
  crearZona,
  cuadradoAlrededorDe,
} from '../utilities/catalogs.js';
import {
  crearOperador,
  crearVecino,
  type UsuarioDePrueba,
} from '../utilities/users.js';
import {
  cuerpoReporte,
  crearCambio,
  crearReporte,
  ROCAMORA,
  subirArchivo,
  subirAudio,
} from '../utilities/reports.js';
import { JPEG, M4A, MP4 } from '../utilities/files.js';
import { CambioDeEstado } from '../../src/modules/reports/status-change.entity.js';
import { FotoDeReporte } from '../../src/modules/reports/photo.entity.js';
import { Reporte } from '../../src/modules/reports/report.entity.js';

const JERGA =
  /\b(must|should|property|undefined|null|cannot|exception|invalid|string|boolean|number|array|entity|column|constraint|sql|jwt|payload|body|nested|whitelist)\b/i;

let ctx: AppDePrueba;
let vecino: UsuarioDePrueba;
let vecinoBase: UsuarioDePrueba;
let otro: UsuarioDePrueba;
let operador: UsuarioDePrueba;
let tipoId: string;
let zonaId: string;
let fotoUrl: string;

beforeAll(async () => {
  ctx = await crearApp();
  vecino = await crearVecino(ctx, {
    nombre: 'Norma Secreta',
    email: 'norma.secreta@privado.ar',
    telefono: '3446-555123',
  });
  vecinoBase = vecino;
  otro = await crearVecino(ctx);
  operador = await crearOperador(ctx);
  tipoId = (await crearTipo(ctx, { id: 'tip-bache' })).id;
  zonaId = (
    await crearZona(ctx, {
      id: 'zon-norte',
      limite: cuadradoAlrededorDe(ROCAMORA.latitud, ROCAMORA.longitud),
    })
  ).id;
  fotoUrl = await subirArchivo(ctx, vecino);
});
afterAll(() => ctx.cerrar());

beforeEach(async () => {
  vecino = vecinoBase;
  ctx.reloj.mover(new Date('2026-09-14T10:00:00-03:00'));
  await ctx.dataSource.getRepository(CambioDeEstado).clear();
  await ctx.dataSource.getRepository(FotoDeReporte).clear();
  await ctx.dataSource.getRepository(Reporte).clear();
});

const crear = (
  quien: UsuarioDePrueba,
  extra: Record<string, unknown> = {},
  url = fotoUrl,
) =>
  ctx
    .http()
    .post('/reportes')
    .set(...quien.auth)
    .send(cuerpoReporte(url, tipoId, extra));

const CLAVES_REPORTE = [
  'id',
  'codigo',
  'tipoId',
  'descripcion',
  'audioUrl',
  'fotos',
  'coordenadas',
  'direccion',
  'zonaId',
  'estado',
  'autorId',
  'cuadrillaId',
  'duplicadoDe',
  'adhesiones',
  'creadoEn',
  'sincronizado',
].sort();

describe('Forma — Reporte con todos los opcionales en null y todos llenos', () => {
  it('nulos: descripcion, audioUrl, cuadrillaId y duplicadoDe salen como null (no ausentes ni "")', async () => {
    const res = await crear(vecino, { descripcion: null, audioUrl: null });
    expect(res.status).toBe(201);
    esperarContrato(res, 'Reporte');
    expect(Object.keys(res.body.datos).sort()).toEqual(CLAVES_REPORTE);
    expect(res.body.datos.descripcion).toBeNull();
    expect(res.body.datos.audioUrl).toBeNull();
    expect(res.body.datos.cuadrillaId).toBeNull();
    expect(res.body.datos.duplicadoDe).toBeNull();
    expect(res.body.datos.sincronizado).toBe(true);
    expect(res.body.datos.adhesiones).toBe(0);
    expect(res.body.datos.estado).toBe('recibido');
    expect(res.body.datos.zonaId).toBe(zonaId);
    expect(res.body.datos.autorId).toBe(vecino.usuario.id);
    expect(Object.keys(res.body.datos.fotos[0]).sort()).toEqual([
      'id',
      'momento',
      'url',
    ]);
  });

  it('llenos: dos fotos con id propio, audio, descripción; el orden de las fotos se conserva', async () => {
    const f2 = await subirArchivo(ctx, vecino);
    const audio = await subirAudio(ctx, vecino);
    const res = await ctx
      .http()
      .post('/reportes')
      .set(...vecino.auth)
      .send(
        cuerpoReporte(fotoUrl, tipoId, {
          id: 'rep-lleno-01',
          audioUrl: audio,
          descripcion: 'Ñandú áéíóú 😀',
          fotos: [
            { id: 'fot-uno-1', url: f2 },
            { id: 'fot-dos-2', url: fotoUrl },
          ],
        }),
      );
    expect(res.status).toBe(201);
    esperarContrato(res, 'Reporte');
    const d = res.body.datos;
    expect(d.id).toBe('rep-lleno-01');
    expect(d.audioUrl).toBe(audio);
    expect(d.descripcion).toBe('Ñandú áéíóú 😀');
    expect(d.fotos.map((f: { id: string }) => f.id)).toEqual([
      'fot-uno-1',
      'fot-dos-2',
    ]);
    expect(d.fotos.map((f: { url: string }) => f.url)).toEqual([f2, fotoUrl]);
    expect(
      d.fotos.every((f: { momento: string }) => f.momento === 'problema'),
    ).toBe(true);
    expect(d.audioUrl).toMatch(/^https?:\/\//);
  });

  it('R3 — descripcion "" se guarda null (y nunca "")', async () => {
    const res = await crear(vecino, { descripcion: '' });
    expect(res.status).toBe(201);
    expect(res.body.datos.descripcion).toBeNull();
  });

  it('R3 — descripcion sólo con espacios no vuelve "" (null o el texto recortado)', async () => {
    const res = await crear(vecino, { descripcion: '   ' });
    if (res.status === 201) {
      expect(res.body.datos.descripcion).not.toBe('');
      esperarContrato(res, 'Reporte');
    } else esperarError(res, 400, 'VALIDACION_FALLIDA');
  });

  it('R3 — audioUrl "" no rompe: o 400 o null, jamás 500 ni ""', async () => {
    const res = await crear(vecino, { audioUrl: '' });
    expect(res.status).not.toBe(500);
    if (res.status === 201) expect(res.body.datos.audioUrl).toBeNull();
  });
});

describe('Fechas — instantes con -03:00 y sin milisegundos', () => {
  it.each([
    ['con Z', '2026-09-14T12:22:00Z', '2026-09-14T09:22:00-03:00'],
    [
      'con milisegundos y Z',
      '2026-09-14T12:22:00.123Z',
      '2026-09-14T09:22:00-03:00',
    ],
    [
      'con milisegundos y -03:00',
      '2026-09-14T09:22:00.999-03:00',
      '2026-09-14T09:22:00-03:00',
    ],
    [
      'con otro offset (+02:00)',
      '2026-09-14T14:22:00+02:00',
      '2026-09-14T09:22:00-03:00',
    ],
    [
      'con offset +00:00',
      '2026-09-14T12:22:00+00:00',
      '2026-09-14T09:22:00-03:00',
    ],
  ])('creadoEn %s se normaliza', async (_c, entrada, salida) => {
    const res = await crear(vecino, { creadoEn: entrada });
    expect(res.status).toBe(201);
    expect(res.body.datos.creadoEn).toBe(salida);
    esperarContrato(res, 'Reporte');
    const cambios = await ctx
      .http()
      .get(`/reportes/${res.body.datos.id}/cambios`);
    expect(cambios.body.datos[0].fechaHora).toBe(salida);
    esperarContrato(cambios, 'CambioDeEstado');
  });

  it.each([
    ['sólo la fecha', '2026-09-14'],
    ['sin offset', '2026-09-14T09:22:00'],
    ['con espacio en vez de T', '2026-09-14 09:22:00-03:00'],
    ['día inexistente', '2026-02-30T09:22:00-03:00'],
    ['mes 13', '2026-13-01T09:22:00-03:00'],
    ['hora 25', '2026-09-14T25:22:00-03:00'],
    ['texto', 'ayer a la tarde'],
    ['null', null],
    ['objeto', {}],
    ['booleano', true],
  ])('creadoEn %s → 400', async (_c, valor) => {
    const res = await crear(vecino, { creadoEn: valor });
    esperarError(res, 400, 'VALIDACION_FALLIDA');
  });

  it('R6 — tolerancia de 5 minutos: justo 5:00 pasa, 5:01 no', async () => {
    const okRes = await crear(vecino, {
      creadoEn: '2026-09-14T10:05:00-03:00',
    });
    expect(okRes.status).toBe(201);
    const mal = await crear(vecino, { creadoEn: '2026-09-14T10:05:01-03:00' });
    esperarError(mal, 422, 'FECHA_EN_EL_FUTURO');
    const lejos = await crear(vecino, {
      creadoEn: '2027-09-14T10:00:00-03:00',
    });
    esperarError(lejos, 422, 'FECHA_EN_EL_FUTURO');
    // no dejó nada
    expect(await ctx.dataSource.getRepository(Reporte).count()).toBe(1);
  });

  it('R6 — el futuro se mide contra el reloj de la API, expresado en Z también', async () => {
    const mal = await crear(vecino, { creadoEn: '2026-09-14T13:10:00Z' }); // 10:10 -03
    esperarError(mal, 422, 'FECHA_EN_EL_FUTURO');
    const bien = await crear(vecino, { creadoEn: '2026-09-14T13:04:59Z' });
    expect(bien.status).toBe(201);
  });

  it('R4 — 31/12 23:59 (-03:00) usa el año de Buenos Aires, aunque en UTC ya sea el año nuevo', async () => {
    ctx.reloj.mover(new Date('2026-12-31T23:59:59-03:00'));
    vecino = await crearVecino(ctx);
    const res = await crear(vecino, { creadoEn: '2026-12-31T23:59:30-03:00' });
    expect(res.status).toBe(201);
    expect(res.body.datos.codigo).toBe('GCHU-2026-00001');
    const z = await crear(vecino, { creadoEn: '2027-01-01T02:30:00Z' }); // 23:30 del 31/12 en BA
    expect(z.status).toBe(201);
    expect(z.body.datos.creadoEn).toBe('2026-12-31T23:30:00-03:00');
    expect(z.body.datos.codigo).toBe('GCHU-2026-00002');
  });

  it('R4 — 00:00 del 1/1 abre el año nuevo con 00001', async () => {
    ctx.reloj.mover(new Date('2027-01-01T00:00:00-03:00'));
    vecino = await crearVecino(ctx);
    const a = await crear(vecino, { creadoEn: '2027-01-01T00:00:00-03:00' });
    expect(a.body.datos.codigo).toBe('GCHU-2027-00001');
    expect(a.body.datos.creadoEn).toBe('2027-01-01T00:00:00-03:00');
    const b = await crear(vecino, { creadoEn: '2026-12-31T23:59:59-03:00' });
    expect(b.body.datos.codigo).toBe('GCHU-2026-00001');
  });

  it('R4 — último día del mes (29/02 de un año bisiesto y 30/09)', async () => {
    ctx.reloj.mover(new Date('2028-03-01T00:00:00-03:00'));
    vecino = await crearVecino(ctx);
    const a = await crear(vecino, { creadoEn: '2028-02-29T23:59:59-03:00' });
    expect(a.status).toBe(201);
    expect(a.body.datos.creadoEn).toBe('2028-02-29T23:59:59-03:00');
    expect(a.body.datos.codigo).toBe('GCHU-2028-00001');
  });
});

describe('R4 — Código de seguimiento', () => {
  it('formato GCHU-AAAA-NNNNN, con ceros a la izquierda', async () => {
    const res = await crear(vecino);
    expect(res.body.datos.codigo).toMatch(/^GCHU-\d{4}-\d{5}$/);
    expect(res.body.datos.codigo).toBe('GCHU-2026-00001');
  });

  it('8 creaciones simultáneas de personas distintas → 8 códigos consecutivos sin huecos', async () => {
    const vecinos = await Promise.all(
      Array.from({ length: 8 }, () => crearVecino(ctx)),
    );
    const res = await Promise.all(vecinos.map((v) => crear(v)));
    expect(res.map((r) => r.status)).toEqual(Array(8).fill(201));
    const nums = res
      .map((r) => Number(r.body.datos.codigo.slice(-5)))
      .sort((a, b) => a - b);
    expect(nums).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('un reporte rechazado por validación no consume número', async () => {
    await crear(vecino, { direccion: undefined });
    await crear(vecino, { tipoId: 'tip-noexiste' });
    await crear(vecino, { coordenadas: { latitud: 0, longitud: 0 } });
    const ok = await crear(vecino);
    expect(ok.body.datos.codigo).toBe('GCHU-2026-00001');
  });

  it('la repetición idempotente no consume número', async () => {
    const a = await crear(vecino, { id: 'rep-idem-cod' });
    const b = await crear(vecino, { id: 'rep-idem-cod' });
    const c = await crear(vecino);
    expect(a.body.datos.codigo).toBe('GCHU-2026-00001');
    expect(b.body.datos.codigo).toBe('GCHU-2026-00001');
    expect(c.body.datos.codigo).toBe('GCHU-2026-00002');
  });
});

describe('R5 — zona en el servidor', () => {
  it.each([
    [
      'latitud y longitud invertidas',
      { latitud: -58.5142, longitud: -33.0089 },
    ],
    ['el ecuador', { latitud: 0, longitud: 0 }],
    [
      'a 1 km al norte',
      { latitud: ROCAMORA.latitud + 0.02, longitud: ROCAMORA.longitud },
    ],
  ])('%s → FUERA_DE_LA_CIUDAD', async (_c, coordenadas) => {
    const res = await crear(vecino, { coordenadas });
    if (res.status === 400) return; // (-58.5 de latitud es inválida)
    esperarError(res, 422, 'FUERA_DE_LA_CIUDAD');
    expect(res.body.error.mensaje).not.toMatch(JERGA);
  });

  it('coordenadas como texto → 400', async () => {
    const res = await crear(vecino, {
      coordenadas: { latitud: '-33.0089', longitud: '-58.5142' },
    });
    esperarError(res, 400, 'VALIDACION_FALLIDA');
  });

  it('coordenadas null / arreglo → 400', async () => {
    esperarError(
      await crear(vecino, { coordenadas: null }),
      400,
      'VALIDACION_FALLIDA',
    );
    esperarError(
      await crear(vecino, { coordenadas: [1, 2] }),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('las coordenadas vuelven tal cual, con la precisión enviada', async () => {
    const res = await crear(vecino, {
      coordenadas: { latitud: -33.008912345, longitud: -58.514212345 },
    });
    expect(res.body.datos.coordenadas).toEqual({
      latitud: -33.008912345,
      longitud: -58.514212345,
    });
  });
});

describe('R1/R2 — fotos y archivos', () => {
  it('R1 — fotos vacío, ausente y null → FOTO_REQUERIDA (422), mensaje sin jerga', async () => {
    for (const fotos of [[], undefined, null]) {
      const res = await crear(vecino, { fotos });
      esperarError(res, 422, 'FOTO_REQUERIDA');
      expect(res.body.error.mensaje).toBe(
        'El reporte necesita al menos una foto.',
      );
    }
  });

  it('R1 — tres fotos → 400 y no crea nada', async () => {
    const res = await crear(vecino, {
      fotos: [{ url: fotoUrl }, { url: fotoUrl }, { url: fotoUrl }],
    });
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    expect(await ctx.dataSource.getRepository(Reporte).count()).toBe(0);
  });

  it.each([
    ['https externa', 'https://ejemplo.com/foto.jpg'],
    ['file://', 'file:///var/mobile/foto.jpg'],
    ['ruta local del teléfono', '/data/user/0/cache/foto.jpg'],
    ['content://', 'content://media/external/images/1'],
    [
      'una clave de /archivos que no existe',
      'http://127.0.0.1/archivos/imagenes/2026/09/noexistenoexistenoexiste.jpg',
    ],
    [
      '/archivos con otro host',
      'https://evil.example/archivos/imagenes/2026/09/a.jpg',
    ],
    ['traversal', 'http://127.0.0.1/archivos/../../etc/passwd'],
  ])('R2 — foto %s → ARCHIVO_NO_SUBIDO (422)', async (_c, url) => {
    const res = await crear(vecino, { fotos: [{ url }] });
    esperarError(res, 422, 'ARCHIVO_NO_SUBIDO');
    expect(res.body.error.mensaje).toBe(
      'Primero hay que subir la foto o el audio.',
    );
    expect(await ctx.dataSource.getRepository(Reporte).count()).toBe(0);
  });

  it('R2 — una foto válida y otra inválida → ARCHIVO_NO_SUBIDO y no se crea nada', async () => {
    const res = await crear(vecino, {
      fotos: [{ url: fotoUrl }, { url: 'https://ejemplo.com/x.jpg' }],
    });
    esperarError(res, 422, 'ARCHIVO_NO_SUBIDO');
    expect(await ctx.dataSource.getRepository(Reporte).count()).toBe(0);
    expect(await ctx.dataSource.getRepository(FotoDeReporte).count()).toBe(0);
  });

  it('R2 — un video subido no vale como foto ni como audio', async () => {
    const video = await subirArchivo(ctx, vecino, MP4, 'v.mp4');
    esperarError(
      await crear(vecino, { fotos: [{ url: video }] }),
      422,
      'ARCHIVO_NO_SUBIDO',
    );
    esperarError(
      await crear(vecino, { audioUrl: video }),
      422,
      'ARCHIVO_NO_SUBIDO',
    );
  });

  it('R2 — audioUrl externo → ARCHIVO_NO_SUBIDO', async () => {
    esperarError(
      await crear(vecino, { audioUrl: 'https://ejemplo.com/a.m4a' }),
      422,
      'ARCHIVO_NO_SUBIDO',
    );
  });

  it('R2 — el archivo de otro usuario sí sirve (la URL es la prueba de subida)', async () => {
    const deOtro = await subirArchivo(ctx, otro, JPEG, 'o.jpg');
    const res = await crear(vecino, { fotos: [{ url: deOtro }] });
    expect(res.status).toBe(201);
  });

  it('la misma foto del mismo pedido puede repetirse sin id (no es error 500)', async () => {
    const res = await crear(vecino, {
      fotos: [{ url: fotoUrl }, { url: fotoUrl }],
    });
    expect(res.status).not.toBe(500);
  });

  it.each([
    ['["x"]', ['x']],
    ['[null]', [null]],
    ['[1]', [1]],
    ['"foto"', 'foto'],
    ['{}', {}],
    ['[[]]', [[]]],
  ])('fotos = %s → 400', async (_c, fotos) => {
    esperarError(await crear(vecino, { fotos }), 400, 'VALIDACION_FALLIDA');
  });

  it('foto con url vacía o no texto → 400', async () => {
    for (const url of ['', 5, null, {}])
      esperarError(
        await crear(vecino, { fotos: [{ url }] }),
        400,
        'VALIDACION_FALLIDA',
      );
  });

  it('ARCHIVO_NO_SUBIDO no lleva jerga técnica ni la url', async () => {
    const res = await crear(vecino, { fotos: [{ url: 'file:///x.jpg' }] });
    expect(res.body.error.mensaje).not.toMatch(/file:|http|\.jpg/);
    expect(Object.keys(res.body.error).sort()).toEqual(['codigo', 'mensaje']);
  });

  it('el audio subido como audio se acepta y sale absoluto', async () => {
    const a = await subirArchivo(ctx, vecino, M4A, 'n.m4a');
    const res = await crear(vecino, { audioUrl: a });
    expect(res.status).toBe(201);
    expect(res.body.datos.audioUrl).toBe(a);
    const bajado = await ctx.http().get(new URL(a).pathname);
    expect(bajado.status).toBe(200);
  });

  it('las URLs de fotos que salen se pueden descargar', async () => {
    const res = await crear(vecino);
    const url = new URL(res.body.datos.fotos[0].url);
    const bajado = await ctx.http().get(url.pathname);
    expect(bajado.status).toBe(200);
  });

  it('el origen sale del Host del pedido para fotos y audio (público)', async () => {
    const audio = await subirAudio(ctx, vecino);
    const c = await crear(vecino, { audioUrl: audio });
    const res = await ctx
      .http()
      .get(`/reportes/${c.body.datos.id}`)
      .set('Host', '10.0.0.5:3000');
    expect(res.body.datos.fotos[0].url).toMatch(
      /^http:\/\/10\.0\.0\.5:3000\/archivos\//,
    );
    expect(res.body.datos.audioUrl).toMatch(
      /^http:\/\/10\.0\.0\.5:3000\/archivos\//,
    );
  });

  it('una URL subida con un Host y enviada con otro también se acepta', async () => {
    const subida = await ctx
      .http()
      .post('/archivos')
      .set(...vecino.auth)
      .set('Host', '10.0.0.5:3000')
      .attach('archivo', JPEG, 'f.jpg');
    expect(subida.status).toBe(201);
    const res = await crear(vecino, {
      fotos: [{ url: subida.body.datos.url }],
    });
    expect(res.status).toBe(201);
  });
});

describe('Entrada — campos de más, tipos equivocados, ids', () => {
  it.each([
    ['password', { password: 'x' }],
    ['createdAt', { createdAt: '2026-09-14T10:00:00-03:00' }],
    ['zonaId', { zonaId: 'zon-norte' }],
    ['estado', { estado: 'resuelto' }],
    ['adhesiones', { adhesiones: 99 }],
    ['sincronizado', { sincronizado: false }],
    ['cuadrillaId', { cuadrillaId: 'cua-01' }],
    ['duplicadoDe', { duplicadoDe: 'rep-1234' }],
    ['distancia', { distancia: 3 }],
    [
      'fotos como arreglo',
      { fotos: [{ url: 'http://x', momento: 'arreglo' }] },
    ],
    ['foto con campo de más', { fotos: [{ url: 'http://x', bytes: 5 }] }],
  ])('campo de más (%s) → 400 con sobre exacto', async (_c, extra) => {
    const res = await crear(vecino, extra);
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    expect(res.body.error.mensaje).not.toMatch(JERGA);
    expect(res.body.error.mensaje).not.toMatch(/should not exist/i);
  });

  it.each([
    ['id numérico', { id: 12345 }],
    ['id con espacios', { id: 'rep-con espacio' }],
    ['id con barra', { id: 'rep-a/b' }],
    ['id muy corto (rep-ab)', { id: 'rep-ab' }],
    ['id de 37 caracteres', { id: 'rep-' + 'a'.repeat(37) }],
    ['id con prefijo de otra entidad', { id: 'fot-abcdef' }],
    ['id vacío', { id: '' }],
    ['id en mayúscula de prefijo', { id: 'REP-abcdef' }],
    ['id null', { id: null }],
    ['tipoId de otra entidad', { tipoId: 'zon-norte' }],
    ['tipoId vacío', { tipoId: '' }],
    ['tipoId null', { tipoId: null }],
    ['dirección número', { direccion: 5 }],
    ['dirección null', { direccion: null }],
    ['descripcion objeto', { descripcion: { a: 1 } }],
    ['descripcion lista', { descripcion: ['a'] }],
    [
      'latitud NaN como texto',
      { coordenadas: { latitud: 'NaN', longitud: 0 } },
    ],
    ['latitud null', { coordenadas: { latitud: null, longitud: -58.5 } }],
    ['sin longitud', { coordenadas: { latitud: -33 } }],
    ['audioUrl número', { audioUrl: 7 }],
  ])('400: %s', async (_c, extra) => {
    const res = await crear(vecino, extra);
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    expect(res.body.error.mensaje).not.toMatch(JERGA);
  });

  it('una id de 36 caracteres y con _ y - es válida', async () => {
    const id = 'rep-' + 'aB_-9'.repeat(7).slice(0, 36);
    const res = await crear(vecino, { id });
    expect(res.status).toBe(201);
    expect(res.body.datos.id).toBe(id);
  });

  it('cuerpos que no son objeto → 400', async () => {
    for (const cuerpo of [[], 'texto', 5]) {
      const res = await ctx
        .http()
        .post('/reportes')
        .set(...vecino.auth)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(cuerpo));
      esperarError(res, 400, 'VALIDACION_FALLIDA');
    }
  });

  it('JSON roto → 400 con sobre de error y sin jerga', async () => {
    const res = await ctx
      .http()
      .post('/reportes')
      .set(...vecino.auth)
      .set('Content-Type', 'application/json')
      .send('{"tipoId": ');
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    expect(res.body.error.mensaje).not.toMatch(/JSON|Unexpected|token/i);
  });

  it('cuerpo vacío objeto {} → 400', async () => {
    const res = await ctx
      .http()
      .post('/reportes')
      .set(...vecino.auth)
      .send({});
    esperarError(res, 400, 'VALIDACION_FALLIDA');
  });

  it('descripcion en el límite (1000) y dirección en el límite (200) se aceptan', async () => {
    const res = await crear(vecino, {
      descripcion: 'x'.repeat(1000),
      direccion: 'd'.repeat(200),
    });
    expect(res.status).toBe(201);
    expect(res.body.datos.descripcion).toHaveLength(1000);
  });

  it('R7 — tipoId con forma válida pero inexistente → TIPO_NO_ENCONTRADO (422)', async () => {
    const res = await crear(vecino, { tipoId: 'tip-fantasma' });
    esperarError(res, 422, 'TIPO_NO_ENCONTRADO');
    expect(res.body.error.mensaje).toBe('Elegí qué tipo de problema es.');
  });
});

describe('Permisos — autenticación en cada endpoint', () => {
  const rutas: Array<[string, string]> = [
    ['post', '/reportes'],
    ['get', '/yo/reportes'],
  ];

  it.each(rutas)('%s %s sin token → 401', async (metodo, ruta) => {
    const res = await (
      ctx.http() as unknown as Record<string, (r: string) => Promise<never>>
    )[metodo]!(ruta);
    esperarError(res as never, 401, 'NO_AUTENTICADO');
  });

  it('token vencido → 401 (POST y GET)', async () => {
    const jwt = ctx.app.get(JwtService);
    const vencido = jwt.sign(
      {
        sub: vecino.usuario.id,
        rol: 'vecino',
        exp: 1600000000,
      },
      { secret: 'secreto-solo-para-los-tests-de-la-api' },
    );
    esperarError(
      await ctx
        .http()
        .get('/yo/reportes')
        .set('Authorization', `Bearer ${vencido}`),
      401,
      'NO_AUTENTICADO',
    );
    esperarError(
      await ctx
        .http()
        .post('/reportes')
        .set('Authorization', `Bearer ${vencido}`)
        .send(cuerpoReporte(fotoUrl, tipoId)),
      401,
      'NO_AUTENTICADO',
    );
  });

  it('token mal firmado y token basura → 401', async () => {
    const jwt = ctx.app.get(JwtService);
    const falso = jwt.sign(
      { sub: vecino.usuario.id, rol: 'vecino' },
      { secret: 'otro-secreto' },
    );
    for (const t of [falso, 'basura', vecino.token + 'x']) {
      esperarError(
        await ctx
          .http()
          .get('/yo/reportes')
          .set('Authorization', `Bearer ${t}`),
        401,
        'NO_AUTENTICADO',
      );
    }
  });

  it('token de un usuario que ya no existe → 401', async () => {
    const fantasma = await crearVecino(ctx);
    await ctx.dataSource
      .getRepository('Usuario')
      .delete({ id: fantasma.usuario.id });
    esperarError(
      await ctx
        .http()
        .get('/yo/reportes')
        .set(...fantasma.auth),
      401,
      'NO_AUTENTICADO',
    );
  });

  it('el 401 se responde antes que la validación del cuerpo', async () => {
    const res = await ctx.http().post('/reportes').send({ basura: true });
    esperarError(res, 401, 'NO_AUTENTICADO');
  });

  it('GET /reportes/:id, /codigo y /cambios son públicos', async () => {
    const c = await crear(vecino);
    for (const ruta of [
      `/reportes/${c.body.datos.id}`,
      `/reportes/codigo/${c.body.datos.codigo}`,
      `/reportes/${c.body.datos.id}/cambios`,
    ]) {
      const res = await ctx.http().get(ruta);
      expect(res.status, ruta).toBe(200);
    }
  });
});

describe('R6 — Idempotencia', () => {
  it('primera 201, repetición 200, cuerpos iguales, un solo reporte, una sola foto, un solo cambio', async () => {
    const cuerpo = cuerpoReporte(fotoUrl, tipoId, {
      id: 'rep-offline-1',
      fotos: [{ id: 'fot-offline-1', url: fotoUrl }],
    });
    const a = await ctx
      .http()
      .post('/reportes')
      .set(...vecino.auth)
      .send(cuerpo);
    const b = await ctx
      .http()
      .post('/reportes')
      .set(...vecino.auth)
      .send(cuerpo);
    const c = await ctx
      .http()
      .post('/reportes')
      .set(...vecino.auth)
      .send(cuerpo);
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect(c.status).toBe(200);
    esperarContrato(b, 'Reporte');
    expect(b.body).toEqual(a.body);
    expect(c.body).toEqual(a.body);
    expect(await ctx.dataSource.getRepository(Reporte).count()).toBe(1);
    expect(await ctx.dataSource.getRepository(FotoDeReporte).count()).toBe(1);
    expect(await ctx.dataSource.getRepository(CambioDeEstado).count()).toBe(1);
  });

  it('la repetición devuelve el existente aunque el cuerpo cambie (no lo pisa)', async () => {
    const a = await crear(vecino, {
      id: 'rep-offline-2',
      descripcion: 'Original',
    });
    const b = await crear(vecino, {
      id: 'rep-offline-2',
      descripcion: 'Distinta',
      direccion: 'Otra 5',
    });
    expect(b.status).toBe(200);
    expect(b.body.datos.descripcion).toBe('Original');
    expect(b.body.datos.direccion).toBe(a.body.datos.direccion);
  });

  it('la repetición refleja el estado actual del reporte, no el inicial', async () => {
    const a = await crear(vecino, { id: 'rep-offline-3' });
    await ctx.dataSource
      .getRepository(Reporte)
      .update(
        { id: 'rep-offline-3' },
        { estado: 'en_revision', adhesiones: 4 },
      );
    const b = await crear(vecino, { id: 'rep-offline-3' });
    expect(b.status).toBe(200);
    expect(b.body.datos.estado).toBe('en_revision');
    expect(b.body.datos.adhesiones).toBe(4);
    expect(b.body.datos.codigo).toBe(a.body.datos.codigo);
  });

  it('repetir un id con la fecha ya "en el futuro" (relojes desfasados) sigue devolviendo 200', async () => {
    const a = await crear(vecino, {
      id: 'rep-offline-4',
      creadoEn: '2026-09-14T10:03:00-03:00',
    });
    expect(a.status).toBe(201);
    ctx.reloj.mover(new Date('2026-09-14T09:00:00-03:00')); // el reloj retrocede
    const b = await crear(vecino, {
      id: 'rep-offline-4',
      creadoEn: '2026-09-14T10:03:00-03:00',
    });
    expect(b.status).toBe(200);
  });

  it('cuatro pedidos simultáneos con el mismo id → un 201, tres 200, un solo registro y un cambio', async () => {
    const res = await Promise.all(
      Array.from({ length: 4 }, () =>
        crear(vecino, { id: 'rep-simultaneo-1' }),
      ),
    );
    const estados = res.map((r) => r.status).sort();
    expect(estados).toEqual([200, 200, 200, 201]);
    for (const r of res) expect(r.body.datos.codigo).toBe('GCHU-2026-00001');
    expect(await ctx.dataSource.getRepository(Reporte).count()).toBe(1);
    expect(await ctx.dataSource.getRepository(CambioDeEstado).count()).toBe(1);
    expect(await ctx.dataSource.getRepository(FotoDeReporte).count()).toBe(1);
  });

  it('el mismo id desde dos usuarios a la vez → uno gana y el otro recibe 409 ID_EN_USO', async () => {
    const res = await Promise.all([
      crear(vecino, { id: 'rep-carrera-1' }),
      crear(otro, { id: 'rep-carrera-1' }),
    ]);
    const estados = res.map((r) => r.status).sort();
    expect(estados).toEqual([201, 409]);
    const perdedor = res.find((r) => r.status === 409)!;
    esperarError(perdedor, 409, 'ID_EN_USO');
    expect(perdedor.body.error.mensaje).toBe(
      'Ese identificador ya está en uso.',
    );
    expect(await ctx.dataSource.getRepository(Reporte).count()).toBe(1);
  });

  it('ID_EN_USO: el id es de otro usuario y no se filtran sus datos', async () => {
    await crear(vecino, {
      id: 'rep-ajeno-1',
      descripcion: 'secreto del vecino',
    });
    const res = await crear(otro, { id: 'rep-ajeno-1' });
    esperarError(res, 409, 'ID_EN_USO');
    expect(JSON.stringify(res.body)).not.toContain('secreto');
  });

  it('ID_EN_USO: un operador tampoco puede reusar el id de un vecino', async () => {
    await crear(vecino, { id: 'rep-ajeno-2' });
    esperarError(
      await crear(operador, { id: 'rep-ajeno-2' }),
      409,
      'ID_EN_USO',
    );
  });

  it('id de foto de otro reporte → 409 ID_EN_USO y no crea el reporte', async () => {
    await crear(vecino, {
      id: 'rep-f-1',
      fotos: [{ id: 'fot-compartida', url: fotoUrl }],
    });
    const res = await crear(vecino, {
      id: 'rep-f-2',
      fotos: [{ id: 'fot-compartida', url: fotoUrl }],
    });
    esperarError(res, 409, 'ID_EN_USO');
    expect(await ctx.dataSource.getRepository(Reporte).count()).toBe(1);
  });

  it('un id de foto ya usado pero con un reporte del mismo id no debe dar 500 (cola con foto id fijo)', async () => {
    const cuerpo = {
      id: 'rep-f-3',
      fotos: [{ id: 'fot-fija-3', url: fotoUrl }],
    };
    const [a, b] = await Promise.all([
      crear(vecino, cuerpo),
      crear(vecino, cuerpo),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
  });

  it('un id de reporte ya usado y además fecha futura: idempotente gana o FECHA_EN_EL_FUTURO, jamás 500', async () => {
    await crear(vecino, { id: 'rep-x-1' });
    const res = await crear(vecino, {
      id: 'rep-x-1',
      creadoEn: '2030-01-01T00:00:00-03:00',
    });
    expect([200, 422]).toContain(res.status);
  });

  it('un fallo de negocio en el reintento no borra el reporte ya creado', async () => {
    await crear(vecino, { id: 'rep-x-2' });
    await crear(vecino, { id: 'rep-x-2', tipoId: 'tip-fantasma' });
    expect(await ctx.dataSource.getRepository(Reporte).count()).toBe(1);
  });
});

describe('Push — crear no avisa a nadie', () => {
  it('ni al autor ni a otros', async () => {
    ctx.notificador.enviadas.length = 0;
    await crear(vecino);
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas).toHaveLength(0);
  });
});

describe('R8 — GET /yo/reportes', () => {
  const pedir = (quien: UsuarioDePrueba, q = '') =>
    ctx
      .http()
      .get(`/yo/reportes${q}`)
      .set(...quien.auth);

  it('sólo los propios, ordenados del más nuevo al más viejo por creadoEn (no por inserción)', async () => {
    const mio = { autorId: vecino.usuario.id, tipoId, zonaId };
    const b = await crearReporte(ctx, {
      ...mio,
      creadoEn: new Date('2026-09-10T12:00:00Z'),
    });
    const c = await crearReporte(ctx, {
      ...mio,
      creadoEn: new Date('2026-09-12T12:00:00Z'),
    });
    const a = await crearReporte(ctx, {
      ...mio,
      creadoEn: new Date('2026-09-01T12:00:00Z'),
    });
    await crearReporte(ctx, { autorId: otro.usuario.id, tipoId, zonaId });
    const res = await pedir(vecino);
    expect(res.status).toBe(200);
    esperarContrato(res, 'Reporte');
    expect(res.body.datos.map((r: { id: string }) => r.id)).toEqual([
      c.id,
      b.id,
      a.id,
    ]);
    expect(res.body.meta).toEqual({ total: 3, pagina: 1, porPagina: 20 });
  });

  it('un operador ve sólo los suyos, no toda la bandeja', async () => {
    await crearReporte(ctx, { autorId: vecino.usuario.id, tipoId, zonaId });
    const res = await pedir(operador);
    expect(res.body.datos).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it('el reporte recién creado aparece en /yo/reportes de su autor y no en el de otro', async () => {
    const c = await crear(vecino);
    const mio = await pedir(vecino);
    expect(mio.body.datos.map((r: { id: string }) => r.id)).toEqual([
      c.body.datos.id,
    ]);
    expect((await pedir(otro)).body.datos).toEqual([]);
  });

  it('lista vacía con sobre y meta', async () => {
    const res = await pedir(otro);
    expect(res.body).toEqual({
      datos: [],
      meta: { total: 0, pagina: 1, porPagina: 20 },
    });
  });

  it('mismo creadoEn: orden estable entre páginas, sin repetir ni saltear', async () => {
    const mio = { autorId: vecino.usuario.id, tipoId, zonaId };
    for (let i = 0; i < 5; i++) await crearReporte(ctx, { ...mio });
    const ids: string[] = [];
    for (const pagina of [1, 2, 3]) {
      const res = await pedir(vecino, `?pagina=${pagina}&porPagina=2`);
      expect(res.body.meta).toEqual({ total: 5, pagina, porPagina: 2 });
      ids.push(...res.body.datos.map((r: { id: string }) => r.id));
    }
    expect(new Set(ids).size).toBe(5);
    const otra = await pedir(vecino, '?pagina=1&porPagina=5');
    expect(otra.body.datos.map((r: { id: string }) => r.id)).toEqual(ids);
  });

  it('página fuera de rango → datos [] con total correcto', async () => {
    await crearReporte(ctx, { autorId: vecino.usuario.id, tipoId, zonaId });
    const res = await pedir(vecino, '?pagina=99&porPagina=10');
    expect(res.status).toBe(200);
    expect(res.body.datos).toEqual([]);
    expect(res.body.meta).toEqual({ total: 1, pagina: 99, porPagina: 10 });
  });

  it.each([
    ['pagina=0', '?pagina=0'],
    ['pagina=-1', '?pagina=-1'],
    ['pagina=abc', '?pagina=abc'],
    ['pagina=1.5', '?pagina=1.5'],
    ['porPagina=0', '?porPagina=0'],
    ['porPagina=101', '?porPagina=101'],
    ['porPagina=-5', '?porPagina=-5'],
    ['porPagina=x', '?porPagina=x'],
    ['parámetro desconocido', '?estado=recibido'],
  ])('%s → 400', async (_c, q) => {
    esperarError(await pedir(vecino, q), 400, 'VALIDACION_FALLIDA');
  });

  it('porPagina=100 es el máximo válido', async () => {
    const res = await pedir(vecino, '?porPagina=100');
    expect(res.status).toBe(200);
    expect(res.body.meta.porPagina).toBe(100);
  });

  it('con todos los opcionales en null la forma cumple el contrato', async () => {
    await crearReporte(ctx, {
      autorId: vecino.usuario.id,
      tipoId,
      zonaId,
      descripcion: null,
      audioClave: null,
    });
    esperarContrato(await pedir(vecino), 'Reporte');
  });
});

describe('GET /reportes/:id y /reportes/codigo/:codigo (R18, D1, P6)', () => {
  it('R18 — no filtra nombre, email ni teléfono del autor, y sólo trae las 16 claves del tipo', async () => {
    const c = await crear(vecino);
    const res = await ctx.http().get(`/reportes/${c.body.datos.id}`);
    expect(res.status).toBe(200);
    esperarContrato(res, 'Reporte');
    expect(Object.keys(res.body.datos).sort()).toEqual(CLAVES_REPORTE);
    const texto = JSON.stringify(res.body);
    expect(texto).not.toContain('Norma Secreta');
    expect(texto).not.toContain('norma.secreta');
    expect(texto).not.toContain('555123');
    expect(res.body.datos.autorId).toBe(vecino.usuario.id);
  });

  it('el detalle con sesión de otro usuario o de operador es el mismo', async () => {
    const c = await crear(vecino);
    const a = await ctx.http().get(`/reportes/${c.body.datos.id}`);
    const b = await ctx
      .http()
      .get(`/reportes/${c.body.datos.id}`)
      .set(...operador.auth);
    const d = await ctx
      .http()
      .get(`/reportes/${c.body.datos.id}`)
      .set(...otro.auth);
    expect(b.body).toEqual(a.body);
    expect(d.body).toEqual(a.body);
  });

  it('el detalle es idéntico a lo que devolvió el POST', async () => {
    const c = await crear(vecino);
    const g = await ctx.http().get(`/reportes/${c.body.datos.id}`);
    expect(g.body).toEqual(c.body);
  });

  it('404 REPORTE_NO_ENCONTRADO con id válido inexistente', async () => {
    const res = await ctx.http().get('/reportes/rep-noexiste1');
    esperarError(res, 404, 'REPORTE_NO_ENCONTRADO');
    expect(res.body.error.mensaje).toBe('No encontramos ese reporte.');
  });

  it.each(['123', 'usr-abc12345', 'REP-abc12345', 'rep-', 'rep-a b', 'rep-ab'])(
    'id mal formado %s → 400 (P6) y no 500',
    async (id) => {
      const res = await ctx.http().get(`/reportes/${encodeURIComponent(id)}`);
      esperarError(res, 400, 'VALIDACION_FALLIDA');
    },
  );

  it('P6 — el código se acepta en minúsculas, con espacios y codificado', async () => {
    const c = await crear(vecino);
    const cod = c.body.datos.codigo as string;
    for (const v of [
      cod,
      cod.toLowerCase(),
      `%20${cod}%20`,
      encodeURIComponent(` ${cod.toLowerCase()} `),
    ]) {
      const res = await ctx.http().get(`/reportes/codigo/${v}`);
      expect(res.status, v).toBe(200);
      expect(res.body.datos.id).toBe(c.body.datos.id);
      esperarContrato(res, 'Reporte');
    }
  });

  it.each([
    'GCHU-2026-99999',
    'GCHU-2026-1',
    'GCHU-26-00001',
    'XXXX-2026-00001',
    '00001',
    'GCHU-2026-00001-x',
    "GCHU-2026-0000'",
  ])(
    'código %s inexistente o mal formado → 404 REPORTE_NO_ENCONTRADO',
    async (cod) => {
      const res = await ctx
        .http()
        .get(`/reportes/codigo/${encodeURIComponent(cod)}`);
      esperarError(res, 404, 'REPORTE_NO_ENCONTRADO');
    },
  );

  it('el código de otro año no cruza con el del año en curso', async () => {
    const c = await crear(vecino);
    const cod = (c.body.datos.codigo as string).replace('2026', '2025');
    esperarError(
      await ctx.http().get(`/reportes/codigo/${cod}`),
      404,
      'REPORTE_NO_ENCONTRADO',
    );
  });

  it('/reportes/codigo sin código no es 500 y devuelve sobre de error', async () => {
    const res = await ctx.http().get('/reportes/codigo/');
    expect([400, 404]).toContain(res.status);
    expect(res.body.error).toBeDefined();
  });

  it('el código "codigo" no se confunde con un id (/reportes/codigo/x)', async () => {
    const res = await ctx.http().get('/reportes/codigo/GCHU-2026-00001');
    esperarError(res, 404, 'REPORTE_NO_ENCONTRADO');
  });

  it('reporte en cualquier estado es visible (rechazado, resuelto)', async () => {
    for (const estado of ['rechazado', 'resuelto', 'asignado'] as const) {
      const r = await crearReporte(ctx, {
        autorId: vecino.usuario.id,
        tipoId,
        zonaId,
        estado,
      });
      const res = await ctx.http().get(`/reportes/${r.id}`);
      expect(res.status).toBe(200);
      expect(res.body.datos.estado).toBe(estado);
    }
  });

  it('fechas del reporte guardado a las 23:59 y 00:00 salen con -03:00', async () => {
    const a = await crearReporte(ctx, {
      autorId: vecino.usuario.id,
      tipoId,
      zonaId,
      creadoEn: new Date('2026-09-15T02:59:00Z'),
    });
    const b = await crearReporte(ctx, {
      autorId: vecino.usuario.id,
      tipoId,
      zonaId,
      creadoEn: new Date('2026-09-15T03:00:00Z'),
    });
    const ra = await ctx.http().get(`/reportes/${a.id}`);
    const rb = await ctx.http().get(`/reportes/${b.id}`);
    expect(ra.body.datos.creadoEn).toBe('2026-09-14T23:59:00-03:00');
    expect(rb.body.datos.creadoEn).toBe('2026-09-15T00:00:00-03:00');
  });

  it('un reporte sembrado con fotos de arreglo las muestra con momento arreglo, en orden', async () => {
    const r = await crearReporte(
      ctx,
      { autorId: vecino.usuario.id, tipoId, zonaId },
      { fotos: 2 },
    );
    const repo = ctx.dataSource.getRepository(FotoDeReporte);
    await repo.insert({
      id: 'fot-arreglo-1',
      reporteId: r.id,
      clave: 'imagenes/2026/09/' + 'b'.repeat(24) + '.jpg',
      momento: 'arreglo',
      orden: 3,
    });
    const res = await ctx.http().get(`/reportes/${r.id}`);
    esperarContrato(res, 'Reporte');
    expect(
      res.body.datos.fotos.map((f: { momento: string }) => f.momento),
    ).toEqual(['problema', 'problema', 'arreglo']);
  });
});

describe('GET /reportes/:id/cambios (P9)', () => {
  it('tras crear hay exactamente un cambio recibido, sin comentario ni operador, con ids cam-', async () => {
    const c = await crear(vecino);
    const res = await ctx.http().get(`/reportes/${c.body.datos.id}/cambios`);
    expect(res.status).toBe(200);
    esperarContrato(res, 'CambioDeEstado');
    expect(res.body.datos).toHaveLength(1);
    const cam = res.body.datos[0];
    expect(cam).toMatchObject({
      reporteId: c.body.datos.id,
      estado: 'recibido',
      comentario: null,
      operadorId: null,
      fechaHora: c.body.datos.creadoEn,
    });
    expect(cam.id).toMatch(/^cam-/);
    expect(Object.keys(cam).sort()).toEqual([
      'comentario',
      'estado',
      'fechaHora',
      'id',
      'operadorId',
      'reporteId',
    ]);
    expect(res.body.meta).toEqual({ total: 1, pagina: 1, porPagina: 20 });
  });

  it('el cambio del operador expone operadorId y comentario; orden ascendente por fechaHora aunque se inserten al revés', async () => {
    const r = await crearReporte(ctx, {
      autorId: vecino.usuario.id,
      tipoId,
      zonaId,
    });
    await crearCambio(ctx, {
      reporteId: r.id,
      estado: 'resuelto',
      operadorId: operador.usuario.id,
      comentario: 'Listo',
      fechaHora: new Date('2026-09-14T15:00:00Z'),
      secuencia: 3,
    });
    await crearCambio(ctx, {
      reporteId: r.id,
      estado: 'recibido',
      fechaHora: new Date('2026-09-14T11:00:00Z'),
      secuencia: 1,
    });
    await crearCambio(ctx, {
      reporteId: r.id,
      estado: 'en_revision',
      operadorId: operador.usuario.id,
      fechaHora: new Date('2026-09-14T13:00:00Z'),
      secuencia: 2,
    });
    const res = await ctx.http().get(`/reportes/${r.id}/cambios`);
    esperarContrato(res, 'CambioDeEstado');
    expect(res.body.datos.map((c: { estado: string }) => c.estado)).toEqual([
      'recibido',
      'en_revision',
      'resuelto',
    ]);
    expect(res.body.datos[0].operadorId).toBeNull();
    expect(res.body.datos[2]).toMatchObject({
      comentario: 'Listo',
      operadorId: operador.usuario.id,
    });
    expect(res.body.datos[2].fechaHora).toBe('2026-09-14T12:00:00-03:00');
  });

  it('sólo trae los cambios de ese reporte', async () => {
    const a = await crearReporte(ctx, {
      autorId: vecino.usuario.id,
      tipoId,
      zonaId,
    });
    const b = await crearReporte(ctx, {
      autorId: vecino.usuario.id,
      tipoId,
      zonaId,
    });
    await crearCambio(ctx, { reporteId: a.id });
    await crearCambio(ctx, { reporteId: b.id });
    await crearCambio(ctx, {
      reporteId: b.id,
      estado: 'en_revision',
      secuencia: 2,
    });
    const res = await ctx.http().get(`/reportes/${a.id}/cambios`);
    expect(res.body.datos).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('paginación de cambios y página fuera de rango', async () => {
    const r = await crearReporte(ctx, {
      autorId: vecino.usuario.id,
      tipoId,
      zonaId,
    });
    const estados = [
      'recibido',
      'en_revision',
      'asignado',
      'asignado',
      'resuelto',
    ] as const;
    for (let i = 0; i < estados.length; i++)
      await crearCambio(ctx, {
        reporteId: r.id,
        estado: estados[i]!,
        secuencia: i + 1,
        fechaHora: new Date(Date.UTC(2026, 8, 14, 12 + i)),
      });
    const p2 = await ctx
      .http()
      .get(`/reportes/${r.id}/cambios?pagina=2&porPagina=2`);
    expect(p2.body.meta).toEqual({ total: 5, pagina: 2, porPagina: 2 });
    expect(p2.body.datos.map((c: { estado: string }) => c.estado)).toEqual([
      'asignado',
      'asignado',
    ]);
    const p9 = await ctx.http().get(`/reportes/${r.id}/cambios?pagina=9`);
    expect(p9.body.datos).toEqual([]);
    expect(p9.body.meta.total).toBe(5);
    esperarError(
      await ctx.http().get(`/reportes/${r.id}/cambios?porPagina=101`),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('404 con un reporte que no existe y 400 con id mal formado', async () => {
    esperarError(
      await ctx.http().get('/reportes/rep-noexiste1/cambios'),
      404,
      'REPORTE_NO_ENCONTRADO',
    );
    esperarError(
      await ctx.http().get('/reportes/xyz/cambios'),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('cambios desde el reloj: las fechas con -03:00 a 23:59 y 00:00', async () => {
    const r = await crearReporte(ctx, {
      autorId: vecino.usuario.id,
      tipoId,
      zonaId,
    });
    await crearCambio(ctx, {
      reporteId: r.id,
      fechaHora: new Date('2026-12-31T23:59:59-03:00'),
      secuencia: 1,
    });
    await crearCambio(ctx, {
      reporteId: r.id,
      estado: 'en_revision',
      fechaHora: new Date('2027-01-01T00:00:00-03:00'),
      secuencia: 2,
    });
    const res = await ctx.http().get(`/reportes/${r.id}/cambios`);
    expect(
      res.body.datos.map((c: { fechaHora: string }) => c.fechaHora),
    ).toEqual(['2026-12-31T23:59:59-03:00', '2027-01-01T00:00:00-03:00']);
  });
});

describe('Errores — sobre exacto y mensajes en castellano', () => {
  it('ruta inexistente → 404 con sobre', async () => {
    const res = await ctx.http().get('/reportes/rep-abc12345/nada');
    expect(res.status).toBe(404);
    expect(Object.keys(res.body)).toEqual(['error']);
    expect(Object.keys(res.body.error).sort()).toEqual(['codigo', 'mensaje']);
  });

  it('método no permitido sobre las rutas del módulo no es 500 (PUT/DELETE /reportes/:id)', async () => {
    const c = await crear(vecino);
    for (const m of ['put', 'delete', 'patch'] as const) {
      const res = await ctx
        .http()
        [m](`/reportes/${c.body.datos.id}`)
        .set(...vecino.auth);
      expect(res.status, m).toBeLessThan(500);
      expect(res.status, m).toBeGreaterThanOrEqual(400);
      expect(res.body.error).toBeDefined();
    }
    expect(await ctx.dataSource.getRepository(Reporte).count()).toBe(1);
  });

  it('ningún mensaje de error de M2 tiene jerga ni ids', async () => {
    const casos = [
      await crear(vecino, { fotos: [] }),
      await crear(vecino, { tipoId: 'tip-fantasma' }),
      await crear(vecino, { creadoEn: '2030-01-01T00:00:00-03:00' }),
      await crear(vecino, { coordenadas: { latitud: 0, longitud: 0 } }),
      await crear(vecino, { fotos: [{ url: 'file:///a.jpg' }] }),
      await crear(vecino, { direccion: '' }),
      await ctx.http().get('/reportes/rep-noexiste1'),
      await ctx.http().get('/reportes/123'),
    ];
    for (const r of casos) {
      const m = r.body.error.mensaje as string;
      expect(m, JSON.stringify(r.body)).not.toMatch(JERGA);
      expect(m).not.toMatch(/rep-|tip-|usr-/);
      expect(m).toMatch(/[.?!]$/);
    }
  });

  it('el orden de validación: sin foto Y con tipo inexistente da un error de negocio, no 500', async () => {
    const res = await crear(vecino, { fotos: [], tipoId: 'tip-fantasma' });
    expect(res.status).toBe(422);
    expect(['FOTO_REQUERIDA', 'TIPO_NO_ENCONTRADO']).toContain(
      res.body.error.codigo,
    );
  });
});
