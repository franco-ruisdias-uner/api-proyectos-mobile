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
import { M4A } from '../utilities/files.js';
import { CambioDeEstado } from '../../src/modules/reports/status-change.entity.js';
import { FotoDeReporte } from '../../src/modules/reports/photo.entity.js';
import { Reporte } from '../../src/modules/reports/report.entity.js';
import { Zona } from '../../src/modules/catalogs/zone.entity.js';

let ctx: AppDePrueba;
let vecino: UsuarioDePrueba;
let otro: UsuarioDePrueba;
let tipoId: string;
let zonaId: string;
let fotoUrl: string;

beforeAll(async () => {
  ctx = await crearApp();
  vecino = await crearVecino(ctx);
  otro = await crearVecino(ctx);
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
  await ctx.dataSource.getRepository(CambioDeEstado).clear();
  await ctx.dataSource.getRepository(FotoDeReporte).clear();
  await ctx.dataSource.getRepository(Reporte).clear();
});

const crear = (
  quien: UsuarioDePrueba,
  cuerpo: Record<string, unknown> = cuerpoReporte(fotoUrl, tipoId),
) =>
  ctx
    .http()
    .post('/reportes')
    .set(...quien.auth)
    .send(cuerpo);

describe('POST /reportes', () => {
  it('M2 — crea el reporte con la forma del PRD y completa lo del servidor', async () => {
    const res = await crear(vecino);
    expect(res.status).toBe(201);
    esperarContrato(res, 'Reporte');
    const r = res.body.datos;
    expect(r).toMatchObject({
      codigo: 'GCHU-2026-00001',
      tipoId,
      descripcion: 'Pozo grande frente al número 1240.',
      audioUrl: null,
      coordenadas: ROCAMORA,
      direccion: 'Rocamora 1240',
      zonaId,
      estado: 'recibido',
      autorId: vecino.usuario.id,
      cuadrillaId: null,
      duplicadoDe: null,
      adhesiones: 0,
      creadoEn: '2026-09-14T09:22:00-03:00',
      sincronizado: true,
    });
    expect(r.id).toMatch(/^rep-[a-z0-9]{12}$/);
    expect(r.fotos).toHaveLength(1);
    expect(r.fotos[0]).toMatchObject({ url: fotoUrl, momento: 'problema' });
    expect(r.fotos[0].id).toMatch(/^fot-/);
  });

  it('R6 — creadoEn con Z se normaliza a -03:00', async () => {
    const res = await crear(
      vecino,
      cuerpoReporte(fotoUrl, tipoId, { creadoEn: '2026-09-14T12:22:00Z' }),
    );
    expect(res.status).toBe(201);
    expect(res.body.datos.creadoEn).toBe('2026-09-14T09:22:00-03:00');
  });

  it('crea el primer CambioDeEstado: recibido, sin comentario ni operador, con fecha = creadoEn', async () => {
    const res = await crear(vecino);
    const cambios = await ctx
      .http()
      .get(`/reportes/${res.body.datos.id}/cambios`);
    expect(cambios.status).toBe(200);
    esperarContrato(cambios, 'CambioDeEstado');
    expect(cambios.body.datos).toHaveLength(1);
    expect(cambios.body.datos[0]).toMatchObject({
      reporteId: res.body.datos.id,
      estado: 'recibido',
      comentario: null,
      operadorId: null,
      fechaHora: '2026-09-14T09:22:00-03:00',
    });
    expect(cambios.body.datos[0].id).toMatch(/^cam-/);
  });

  it('R1 — dos fotos y audio', async () => {
    const otraFoto = await subirArchivo(ctx, vecino);
    const audio = await subirAudio(ctx, vecino);
    const res = await crear(
      vecino,
      cuerpoReporte(fotoUrl, tipoId, {
        fotos: [{ id: 'fot-abc123', url: fotoUrl }, { url: otraFoto }],
        audioUrl: audio,
      }),
    );
    expect(res.status).toBe(201);
    esperarContrato(res, 'Reporte');
    expect(res.body.datos.fotos.map((f: { url: string }) => f.url)).toEqual([
      fotoUrl,
      otraFoto,
    ]);
    expect(res.body.datos.fotos[0].id).toBe('fot-abc123');
    expect(res.body.datos.audioUrl).toBe(audio);
  });

  it('las URLs salen con el origen del pedido (Host)', async () => {
    const res = await ctx
      .http()
      .post('/reportes')
      .set(...vecino.auth)
      .set('Host', '10.0.0.5:3000')
      .send(cuerpoReporte(fotoUrl, tipoId));
    expect(res.status).toBe(201);
    expect(res.body.datos.fotos[0].url).toMatch(
      /^http:\/\/10\.0\.0\.5:3000\/archivos\/imagenes\//,
    );
  });

  describe('R1 — Sin foto no hay reporte', () => {
    it.each([
      ['fotos vacío', { fotos: [] }],
      ['fotos null', { fotos: null }],
    ])('%s → FOTO_REQUERIDA', async (_c, extra) => {
      esperarError(
        await crear(vecino, cuerpoReporte(fotoUrl, tipoId, extra)),
        422,
        'FOTO_REQUERIDA',
      );
    });

    it('fotos ausente → FOTO_REQUERIDA', async () => {
      const cuerpo = cuerpoReporte(fotoUrl, tipoId);
      delete cuerpo.fotos;
      esperarError(await crear(vecino, cuerpo), 422, 'FOTO_REQUERIDA');
    });

    it('más de dos fotos del problema → VALIDACION_FALLIDA', async () => {
      const res = await crear(
        vecino,
        cuerpoReporte(fotoUrl, tipoId, {
          fotos: [{ url: fotoUrl }, { url: fotoUrl }, { url: fotoUrl }],
        }),
      );
      esperarError(res, 400, 'VALIDACION_FALLIDA');
    });

    it('fotos que no es una lista → VALIDACION_FALLIDA', async () => {
      esperarError(
        await crear(vecino, cuerpoReporte(fotoUrl, tipoId, { fotos: 'x' })),
        400,
        'VALIDACION_FALLIDA',
      );
    });
  });

  describe('R2 — Las URLs tienen que venir de POST /archivos', () => {
    it.each([
      ['de otro sitio', 'https://ejemplo.com/foto.jpg'],
      ['local del teléfono', 'file:///data/user/0/foto.jpg'],
      [
        'de esta API pero de un archivo que no existe',
        'http://localhost/archivos/imagenes/2026/09/aaaaaaaaaaaaaaaaaaaaaaaa.jpg',
      ],
    ])('foto %s → ARCHIVO_NO_SUBIDO', async (_c, url) => {
      const res = await crear(
        vecino,
        cuerpoReporte(fotoUrl, tipoId, { fotos: [{ url }] }),
      );
      esperarError(res, 422, 'ARCHIVO_NO_SUBIDO');
    });

    it('audioUrl de otro sitio → ARCHIVO_NO_SUBIDO', async () => {
      const res = await crear(
        vecino,
        cuerpoReporte(fotoUrl, tipoId, {
          audioUrl: 'https://ejemplo.com/a.m4a',
        }),
      );
      esperarError(res, 422, 'ARCHIVO_NO_SUBIDO');
    });

    it('una foto que en realidad es un audio subido → ARCHIVO_NO_SUBIDO', async () => {
      const audio = await subirArchivo(ctx, vecino, M4A, 'nota.m4a');
      esperarError(
        await crear(
          vecino,
          cuerpoReporte(fotoUrl, tipoId, { fotos: [{ url: audio }] }),
        ),
        422,
        'ARCHIVO_NO_SUBIDO',
      );
    });

    it('un audioUrl que en realidad es una foto → ARCHIVO_NO_SUBIDO', async () => {
      esperarError(
        await crear(
          vecino,
          cuerpoReporte(fotoUrl, tipoId, { audioUrl: fotoUrl }),
        ),
        422,
        'ARCHIVO_NO_SUBIDO',
      );
    });

    it('no crea nada si falla', async () => {
      await crear(
        vecino,
        cuerpoReporte(fotoUrl, tipoId, { audioUrl: 'https://x.com/a.m4a' }),
      );
      expect(await ctx.dataSource.getRepository(Reporte).count()).toBe(0);
      expect(await ctx.dataSource.getRepository(FotoDeReporte).count()).toBe(0);
    });
  });

  describe('R3 — descripcion y audioUrl pueden ser null', () => {
    it('los dos null', async () => {
      const res = await crear(
        vecino,
        cuerpoReporte(fotoUrl, tipoId, { descripcion: null, audioUrl: null }),
      );
      expect(res.status).toBe(201);
      expect(res.body.datos.descripcion).toBeNull();
      expect(res.body.datos.audioUrl).toBeNull();
    });

    it('los dos ausentes', async () => {
      const cuerpo = cuerpoReporte(fotoUrl, tipoId);
      delete cuerpo.descripcion;
      delete cuerpo.audioUrl;
      const res = await crear(vecino, cuerpo);
      expect(res.status).toBe(201);
      expect(res.body.datos.descripcion).toBeNull();
      expect(res.body.datos.audioUrl).toBeNull();
    });

    it.each(['', '   '])('descripcion %j se guarda null', async (d) => {
      const res = await crear(
        vecino,
        cuerpoReporte(fotoUrl, tipoId, { descripcion: d }),
      );
      expect(res.status).toBe(201);
      expect(res.body.datos.descripcion).toBeNull();
    });
  });

  describe('R4 — Código de seguimiento', () => {
    it('es correlativo', async () => {
      const a = await crear(vecino);
      const b = await crear(otro);
      expect(a.body.datos.codigo).toBe('GCHU-2026-00001');
      expect(b.body.datos.codigo).toBe('GCHU-2026-00002');
    });

    it('usa el año de creadoEn y cada año lleva su cuenta', async () => {
      const viejo = await crear(
        vecino,
        cuerpoReporte(fotoUrl, tipoId, {
          creadoEn: '2025-12-31T23:30:00-03:00',
        }),
      );
      const nuevo = await crear(vecino);
      expect(viejo.body.datos.codigo).toBe('GCHU-2025-00001');
      expect(nuevo.body.datos.codigo).toBe('GCHU-2026-00001');
    });

    it('continúa después del último que ya existe', async () => {
      await crearReporte(ctx, {
        autorId: vecino.usuario.id,
        tipoId,
        zonaId,
        codigo: 'GCHU-2026-00412',
      });
      const res = await crear(vecino);
      expect(res.body.datos.codigo).toBe('GCHU-2026-00413');
    });

    it('5 creaciones simultáneas → 5 códigos distintos y consecutivos', async () => {
      const fotos = await Promise.all(
        [1, 2, 3, 4, 5].map(() => subirArchivo(ctx, vecino)),
      );
      const respuestas = await Promise.all(
        fotos.map((f) => crear(vecino, cuerpoReporte(f, tipoId))),
      );
      expect(respuestas.map((r) => r.status)).toEqual([
        201, 201, 201, 201, 201,
      ]);
      const codigos = respuestas
        .map((r) => r.body.datos.codigo as string)
        .sort();
      expect(codigos).toEqual([
        'GCHU-2026-00001',
        'GCHU-2026-00002',
        'GCHU-2026-00003',
        'GCHU-2026-00004',
        'GCHU-2026-00005',
      ]);
    });
  });

  describe('R5 — La zona la decide el servidor', () => {
    it('un punto fuera de las zonas → FUERA_DE_LA_CIUDAD', async () => {
      const res = await crear(
        vecino,
        cuerpoReporte(fotoUrl, tipoId, {
          coordenadas: { latitud: -34.6, longitud: -58.4 },
        }),
      );
      esperarError(res, 422, 'FUERA_DE_LA_CIUDAD');
    });

    it('ignora un zonaId que mande el cliente (campo no admitido)', async () => {
      const res = await crear(
        vecino,
        cuerpoReporte(fotoUrl, tipoId, { zonaId: 'zon-otra' }),
      );
      esperarError(res, 400, 'VALIDACION_FALLIDA');
    });

    it('elige la zona que contiene el punto', async () => {
      const sur = await crearZona(ctx, {
        limite: cuadradoAlrededorDe(-33.05, -58.5),
      });
      const res = await crear(
        vecino,
        cuerpoReporte(fotoUrl, tipoId, {
          coordenadas: { latitud: -33.05, longitud: -58.5 },
        }),
      );
      expect(res.body.datos.zonaId).toBe(sur.id);
      await ctx.dataSource.getRepository(Zona).delete({ id: sur.id });
    });
  });

  describe('R6 — Idempotencia (cola offline)', () => {
    it('el mismo cuerpo dos veces deja un registro y las dos respuestas son iguales', async () => {
      const cuerpo = cuerpoReporte(fotoUrl, tipoId, { id: 'rep-k3x9abc' });
      const a = await crear(vecino, cuerpo);
      const b = await crear(vecino, cuerpo);
      expect(a.status).toBe(201);
      expect(b.status).toBe(200);
      expect(b.body).toEqual(a.body);
      expect(a.body.datos.id).toBe('rep-k3x9abc');
      expect(await ctx.dataSource.getRepository(Reporte).count()).toBe(1);
      expect(await ctx.dataSource.getRepository(CambioDeEstado).count()).toBe(
        1,
      );
      expect(await ctx.dataSource.getRepository(FotoDeReporte).count()).toBe(1);
    });

    it('dos pedidos simultáneos con el mismo id → un solo reporte', async () => {
      const cuerpo = cuerpoReporte(fotoUrl, tipoId, { id: 'rep-simultaneo1' });
      const [a, b] = await Promise.all([
        crear(vecino, cuerpo),
        crear(vecino, cuerpo),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 201]);
      expect(a.body.datos.id).toBe(b.body.datos.id);
      expect(await ctx.dataSource.getRepository(Reporte).count()).toBe(1);
    });

    it('el id es de otro usuario → 409 ID_EN_USO', async () => {
      await crear(
        vecino,
        cuerpoReporte(fotoUrl, tipoId, { id: 'rep-ajeno01' }),
      );
      const res = await crear(
        otro,
        cuerpoReporte(fotoUrl, tipoId, { id: 'rep-ajeno01' }),
      );
      esperarError(res, 409, 'ID_EN_USO');
      expect(await ctx.dataSource.getRepository(Reporte).count()).toBe(1);
    });

    it('el id de una foto ya usada por otro reporte → 409 ID_EN_USO', async () => {
      await crear(
        vecino,
        cuerpoReporte(fotoUrl, tipoId, {
          fotos: [{ id: 'fot-repetida', url: fotoUrl }],
        }),
      );
      const res = await crear(
        vecino,
        cuerpoReporte(fotoUrl, tipoId, {
          fotos: [{ id: 'fot-repetida', url: fotoUrl }],
        }),
      );
      esperarError(res, 409, 'ID_EN_USO');
    });

    it('dos fotos con el mismo id en el mismo pedido → VALIDACION_FALLIDA', async () => {
      const res = await crear(
        vecino,
        cuerpoReporte(fotoUrl, tipoId, {
          fotos: [
            { id: 'fot-igual1', url: fotoUrl },
            { id: 'fot-igual1', url: fotoUrl },
          ],
        }),
      );
      esperarError(res, 400, 'VALIDACION_FALLIDA');
    });

    it('creadoEn en el futuro → FECHA_EN_EL_FUTURO', async () => {
      const res = await crear(
        vecino,
        cuerpoReporte(fotoUrl, tipoId, {
          creadoEn: '2026-09-14T11:00:00-03:00',
        }),
      );
      esperarError(res, 422, 'FECHA_EN_EL_FUTURO');
    });

    it('creadoEn dentro de la tolerancia de 5 minutos se acepta', async () => {
      const res = await crear(
        vecino,
        cuerpoReporte(fotoUrl, tipoId, {
          creadoEn: '2026-09-14T10:04:00-03:00',
        }),
      );
      expect(res.status).toBe(201);
    });
  });

  describe('R7 — Tipo', () => {
    it('inexistente → TIPO_NO_ENCONTRADO', async () => {
      const res = await crear(vecino, cuerpoReporte(fotoUrl, 'tip-noexiste'));
      esperarError(res, 422, 'TIPO_NO_ENCONTRADO');
    });
  });

  describe('validaciones', () => {
    it.each([
      ['sin tipoId', { tipoId: undefined }],
      ['tipoId sin el prefijo', { tipoId: 'bache' }],
      ['tipoId número', { tipoId: 5 }],
      ['id sin el prefijo rep-', { id: 'abc123' }],
      ['id de otra entidad', { id: 'usr-abc123' }],
      ['sin coordenadas', { coordenadas: undefined }],
      [
        'latitud que no es número',
        { coordenadas: { latitud: 'a', longitud: -58.5 } },
      ],
      [
        'latitud fuera de rango',
        { coordenadas: { latitud: 95, longitud: -58.5 } },
      ],
      [
        'longitud fuera de rango',
        { coordenadas: { latitud: -33, longitud: -181 } },
      ],
      [
        'coordenadas con un campo de más',
        { coordenadas: { ...ROCAMORA, altura: 3 } },
      ],
      ['sin dirección', { direccion: undefined }],
      ['dirección vacía', { direccion: '  ' }],
      ['dirección de 201 caracteres', { direccion: 'x'.repeat(201) }],
      ['descripción que no es texto', { descripcion: 5 }],
      [
        'descripción de más de 1000 caracteres',
        { descripcion: 'x'.repeat(1001) },
      ],
      ['sin creadoEn', { creadoEn: undefined }],
      ['creadoEn sin offset', { creadoEn: '2026-09-14T09:22:00' }],
      ['creadoEn que no es fecha', { creadoEn: 'ayer' }],
      ['creadoEn número', { creadoEn: 1789000000 }],
      ['foto sin url', { fotos: [{ id: 'fot-abc' }] }],
      [
        'id de foto sin el prefijo',
        { fotos: [{ id: 'xyz', url: 'http://a/b' }] },
      ],
      [
        'foto con momento (lo pone el servidor)',
        { fotos: [{ url: 'http://a/b', momento: 'arreglo' }] },
      ],
      ['un campo que no existe', { estado: 'resuelto' }],
      ['autorId (lo pone el servidor)', { autorId: 'usr-otro' }],
      ['codigo (lo pone el servidor)', { codigo: 'GCHU-2026-00001' }],
    ])('400 VALIDACION_FALLIDA: %s', async (_c, extra) => {
      const res = await crear(vecino, cuerpoReporte(fotoUrl, tipoId, extra));
      esperarError(res, 400, 'VALIDACION_FALLIDA');
      expect(res.body.error.mensaje).not.toMatch(/undefined|should|must/i);
    });

    it('el mensaje nombra el campo en castellano', async () => {
      const res = await crear(
        vecino,
        cuerpoReporte(fotoUrl, tipoId, { direccion: undefined }),
      );
      expect(res.body.error.mensaje).toBe('Falta la dirección.');
    });

    it('sin cuerpo → 400', async () => {
      const res = await ctx
        .http()
        .post('/reportes')
        .set(...vecino.auth);
      esperarError(res, 400, 'VALIDACION_FALLIDA');
    });
  });

  it('401 sin token', async () => {
    const res = await ctx
      .http()
      .post('/reportes')
      .send(cuerpoReporte(fotoUrl, tipoId));
    esperarError(res, 401, 'NO_AUTENTICADO');
  });

  it('un operador también puede crear (es un usuario con sesión)', async () => {
    const op = await crearOperador(ctx);
    const res = await crear(op);
    expect(res.status).toBe(201);
    expect(res.body.datos.autorId).toBe(op.usuario.id);
  });

  it('no manda ninguna push (el recibido inicial no avisa)', async () => {
    ctx.notificador.limpiar();
    await crear(vecino);
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas).toHaveLength(0);
  });
});

describe('GET /yo/reportes', () => {
  it('R8 — devuelve sólo los propios, del más nuevo al más viejo', async () => {
    const base = { tipoId, zonaId };
    const viejo = await crearReporte(ctx, {
      ...base,
      autorId: vecino.usuario.id,
      creadoEn: new Date('2026-09-01T12:00:00Z'),
    });
    const nuevo = await crearReporte(ctx, {
      ...base,
      autorId: vecino.usuario.id,
      creadoEn: new Date('2026-09-10T12:00:00Z'),
      estado: 'rechazado',
    });
    await crearReporte(ctx, { ...base, autorId: otro.usuario.id });
    const res = await ctx
      .http()
      .get('/yo/reportes')
      .set(...vecino.auth);
    expect(res.status).toBe(200);
    esperarContrato(res, 'Reporte');
    expect(res.body.datos.map((r: { id: string }) => r.id)).toEqual([
      nuevo.id,
      viejo.id,
    ]);
    expect(res.body.meta).toEqual({ total: 2, pagina: 1, porPagina: 20 });
  });

  it('lista vacía', async () => {
    const res = await ctx
      .http()
      .get('/yo/reportes')
      .set(...otro.auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      datos: [],
      meta: { total: 0, pagina: 1, porPagina: 20 },
    });
  });

  it('paginación y página fuera de rango; empate de fecha por id descendente', async () => {
    const mismaFecha = new Date('2026-09-10T12:00:00Z');
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      ids.push(
        (
          await crearReporte(ctx, {
            tipoId,
            zonaId,
            autorId: vecino.usuario.id,
            creadoEn: mismaFecha,
          })
        ).id,
      );
    }
    const orden = [...ids].sort().reverse();
    const p1 = await ctx
      .http()
      .get('/yo/reportes?porPagina=2')
      .set(...vecino.auth);
    expect(p1.body.datos.map((r: { id: string }) => r.id)).toEqual(
      orden.slice(0, 2),
    );
    expect(p1.body.meta).toEqual({ total: 3, pagina: 1, porPagina: 2 });
    const p2 = await ctx
      .http()
      .get('/yo/reportes?porPagina=2&pagina=2')
      .set(...vecino.auth);
    expect(p2.body.datos.map((r: { id: string }) => r.id)).toEqual(
      orden.slice(2),
    );
    const p9 = await ctx
      .http()
      .get('/yo/reportes?pagina=9')
      .set(...vecino.auth);
    expect(p9.body).toEqual({
      datos: [],
      meta: { total: 3, pagina: 9, porPagina: 20 },
    });
  });

  it.each(['pagina=0', 'porPagina=101', 'porPagina=abc'])(
    '400 con %s',
    async (q) => {
      const res = await ctx
        .http()
        .get(`/yo/reportes?${q}`)
        .set(...vecino.auth);
      esperarError(res, 400, 'VALIDACION_FALLIDA');
    },
  );

  it('401 sin token', async () => {
    esperarError(await ctx.http().get('/yo/reportes'), 401, 'NO_AUTENTICADO');
  });
});

describe('GET /reportes/:id', () => {
  it('es público y devuelve el Reporte completo (con autorId, sin datos del autor)', async () => {
    const r = await crearReporte(
      ctx,
      { tipoId, zonaId, autorId: vecino.usuario.id, descripcion: 'Un pozo' },
      { fotos: 2 },
    );
    const res = await ctx.http().get(`/reportes/${r.id}`);
    expect(res.status).toBe(200);
    esperarContrato(res, 'Reporte');
    expect(res.body.datos).toMatchObject({
      id: r.id,
      codigo: r.codigo,
      autorId: vecino.usuario.id,
      descripcion: 'Un pozo',
    });
    expect(res.body.datos.fotos).toHaveLength(2);
    expect(JSON.stringify(res.body)).not.toContain(vecino.usuario.email);
  });

  it('404 REPORTE_NO_ENCONTRADO', async () => {
    esperarError(
      await ctx.http().get('/reportes/rep-noexiste'),
      404,
      'REPORTE_NO_ENCONTRADO',
    );
  });

  it('400 con un id mal formado', async () => {
    esperarError(
      await ctx.http().get('/reportes/123'),
      400,
      'VALIDACION_FALLIDA',
    );
  });
});

describe('GET /reportes/codigo/:codigo', () => {
  it('D2 — devuelve el reporte por su número de seguimiento, sin sesión', async () => {
    const r = await crearReporte(ctx, {
      tipoId,
      zonaId,
      autorId: vecino.usuario.id,
      codigo: 'GCHU-2026-00412',
    });
    const res = await ctx.http().get('/reportes/codigo/GCHU-2026-00412');
    expect(res.status).toBe(200);
    esperarContrato(res, 'Reporte');
    expect(res.body.datos.id).toBe(r.id);
  });

  it('acepta minúsculas y espacios de más', async () => {
    const r = await crearReporte(ctx, {
      tipoId,
      zonaId,
      autorId: vecino.usuario.id,
      codigo: 'GCHU-2026-00412',
    });
    const res = await ctx.http().get('/reportes/codigo/gchu-2026-00412%20');
    expect(res.status).toBe(200);
    expect(res.body.datos.id).toBe(r.id);
  });

  it.each(['GCHU-2026-99999', 'cualquiera', 'GCHU-2026-1'])(
    '404 REPORTE_NO_ENCONTRADO con %s',
    async (codigo) => {
      esperarError(
        await ctx.http().get(`/reportes/codigo/${codigo}`),
        404,
        'REPORTE_NO_ENCONTRADO',
      );
    },
  );
});

describe('GET /reportes/:id/cambios', () => {
  it('es público y ordena por fechaHora ascendente', async () => {
    const r = await crearReporte(ctx, {
      tipoId,
      zonaId,
      autorId: vecino.usuario.id,
    });
    const op = await crearOperador(ctx);
    const t = (h: number) => new Date(Date.UTC(2026, 8, 14, h));
    await crearCambio(ctx, {
      reporteId: r.id,
      estado: 'asignado',
      operadorId: op.usuario.id,
      fechaHora: t(15),
      secuencia: 3,
      comentario: 'A la cuadrilla 2',
    });
    await crearCambio(ctx, {
      reporteId: r.id,
      estado: 'recibido',
      fechaHora: t(12),
      secuencia: 1,
    });
    await crearCambio(ctx, {
      reporteId: r.id,
      estado: 'en_revision',
      operadorId: op.usuario.id,
      fechaHora: t(13),
      secuencia: 2,
    });
    const res = await ctx.http().get(`/reportes/${r.id}/cambios`);
    expect(res.status).toBe(200);
    esperarContrato(res, 'CambioDeEstado');
    expect(res.body.datos.map((c: { estado: string }) => c.estado)).toEqual([
      'recibido',
      'en_revision',
      'asignado',
    ]);
    expect(res.body.datos[2]).toMatchObject({
      comentario: 'A la cuadrilla 2',
      operadorId: op.usuario.id,
      fechaHora: '2026-09-14T12:00:00-03:00',
    });
    expect(res.body.meta).toEqual({ total: 3, pagina: 1, porPagina: 20 });
  });

  it('misma fecha: desempata por el orden en que ocurrieron', async () => {
    const r = await crearReporte(ctx, {
      tipoId,
      zonaId,
      autorId: vecino.usuario.id,
    });
    const fechaHora = new Date(Date.UTC(2026, 8, 14, 15));
    await crearCambio(ctx, {
      reporteId: r.id,
      estado: 'asignado',
      fechaHora,
      secuencia: 2,
    });
    await crearCambio(ctx, {
      reporteId: r.id,
      estado: 'en_revision',
      fechaHora,
      secuencia: 1,
    });
    const res = await ctx.http().get(`/reportes/${r.id}/cambios`);
    expect(res.body.datos.map((c: { estado: string }) => c.estado)).toEqual([
      'en_revision',
      'asignado',
    ]);
  });

  it('un reporte sin cambios devuelve lista vacía', async () => {
    const r = await crearReporte(ctx, {
      tipoId,
      zonaId,
      autorId: vecino.usuario.id,
    });
    const res = await ctx.http().get(`/reportes/${r.id}/cambios`);
    expect(res.body).toEqual({
      datos: [],
      meta: { total: 0, pagina: 1, porPagina: 20 },
    });
  });

  it('404 si el reporte no existe', async () => {
    esperarError(
      await ctx.http().get('/reportes/rep-noexiste/cambios'),
      404,
      'REPORTE_NO_ENCONTRADO',
    );
  });
});
