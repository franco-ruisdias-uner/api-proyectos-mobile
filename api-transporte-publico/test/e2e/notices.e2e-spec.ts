import { LineaFavoritaEntidad } from '../../src/modules/users/favorite.entity.js';
import { AvisoLineaEntidad } from '../../src/modules/notices/notice-line.entity.js';
import { AvisoEntidad } from '../../src/modules/notices/notice.entity.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { crearAviso } from '../utilities/notices.js';
import { jpeg, mp4 } from '../utilities/files.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { crearLinea } from '../utilities/network.js';
import { crearUsuario, type UsuarioDePrueba } from '../utilities/users.js';

let ctx: AppDePrueba;
let direccion: UsuarioDePrueba;
beforeAll(async () => {
  ctx = await crearApp();
  direccion = await crearUsuario(ctx, { rol: 'direccion' });
});
afterAll(() => ctx.cerrar());
beforeEach(() => {
  ctx.notificador.vaciar();
  ctx.notificador.fallar = false;
});

const HORA = 3600_000;
const antes = (horas: number) => new Date(ctx.reloj.ahora().getTime() - horas * HORA);
const despues = (horas: number) => antes(-horas);
const iso = (d: Date) => d.toISOString();

const TRAZADO = [
  { latitud: -31.73, longitud: -60.53 },
  { latitud: -31.735, longitud: -60.52 },
];

async function subirVideo(): Promise<string> {
  const usuario = await crearUsuario(ctx);
  const r = await ctx.http
    .post('/archivos')
    .set(usuario.auth)
    .attach('archivo', mp4(), { filename: 'v.mp4', contentType: 'video/mp4' })
    .expect(201);
  return r.body.datos.url as string;
}

async function lineaConFavoritos(...usuarios: UsuarioDePrueba[]) {
  const linea = await crearLinea(ctx);
  for (const [orden, u] of usuarios.entries()) {
    await ctx.dataSource
      .getRepository(LineaFavoritaEntidad)
      .insert({ usuarioId: u.id, lineaId: linea.id, orden });
  }
  return linea;
}

describe('Espec. §4 — GET /avisos', () => {
  it('es público y devuelve los vigentes con la forma del contrato', async () => {
    const linea = await crearLinea(ctx);
    const video = 'videos/2026/09/abcdefgh1234.mp4';
    const a = await crearAviso(ctx, {
      lineaIds: [linea.id],
      gravedad: 'desvio',
      trazadoAlternativo: TRAZADO,
      videoClave: video,
      hasta: despues(5),
    });
    const r = await ctx.http.get('/avisos').query({ lineaId: linea.id }).expect(200);
    esperarContrato(r.body, 'Aviso');
    expect(r.body.meta).toEqual({ total: 1, pagina: 1, porPagina: 20 });
    expect(r.body.datos[0]).toEqual({
      id: a.id,
      titulo: a.titulo,
      detalle: a.detalle,
      lineaIds: [linea.id],
      desde: expect.stringMatching(/-03:00$/),
      hasta: expect.stringMatching(/-03:00$/),
      gravedad: 'desvio',
      trazadoAlternativo: TRAZADO,
      videoUrl: expect.stringMatching(
        new RegExp(`^http://127\\.0\\.0\\.1:\\d+/archivos/${video}$`),
      ),
    });
  });

  it('los campos sin valor viajan como null, nunca ausentes', async () => {
    const linea = await crearLinea(ctx);
    await crearAviso(ctx, { lineaIds: [linea.id] });
    const r = await ctx.http.get('/avisos').query({ lineaId: linea.id }).expect(200);
    expect(r.body.datos[0]).toMatchObject({
      hasta: null,
      trazadoAlternativo: null,
      videoUrl: null,
    });
  });

  it('las URLs de video usan el Host del pedido', async () => {
    const linea = await crearLinea(ctx);
    await crearAviso(ctx, { lineaIds: [linea.id], videoClave: 'videos/2026/09/abcdefgh1234.mp4' });
    const r = await ctx.http
      .get('/avisos')
      .query({ lineaId: linea.id })
      .set('Host', '10.0.0.5:3000');
    expect(r.body.datos[0].videoUrl).toBe(
      'http://10.0.0.5:3000/archivos/videos/2026/09/abcdefgh1234.mp4',
    );
  });

  describe('Espec. R10 — vigentes, próximos y todos', () => {
    let linea: { id: string };
    let vigente: AvisoEntidad;
    let sinFin: AvisoEntidad;
    let proximo: AvisoEntidad;
    let terminado: AvisoEntidad;
    beforeAll(async () => {
      linea = await crearLinea(ctx);
      vigente = await crearAviso(ctx, { lineaIds: [linea.id], desde: antes(2), hasta: despues(2) });
      sinFin = await crearAviso(ctx, { lineaIds: [linea.id], desde: antes(1), hasta: null });
      proximo = await crearAviso(ctx, {
        lineaIds: [linea.id],
        desde: despues(3),
        hasta: despues(9),
      });
      terminado = await crearAviso(ctx, { lineaIds: [linea.id], desde: antes(9), hasta: antes(1) });
    });
    const ids = async (estado?: string) => {
      const r = await ctx.http
        .get('/avisos')
        .query({ lineaId: linea.id, ...(estado ? { estado } : {}) })
        .expect(200);
      esperarContrato(r.body, 'Aviso');
      return (r.body.datos as { id: string }[]).map((a) => a.id).sort();
    };

    it('por defecto, los vigentes', async () => {
      expect(await ids()).toEqual([vigente.id, sinFin.id].sort());
    });
    it('estado=vigentes', async () => {
      expect(await ids('vigentes')).toEqual([vigente.id, sinFin.id].sort());
    });
    it('estado=proximos', async () => {
      expect(await ids('proximos')).toEqual([proximo.id]);
    });
    it('estado=todos incluye lo terminado', async () => {
      expect(await ids('todos')).toEqual([vigente.id, sinFin.id, proximo.id, terminado.id].sort());
    });
    it('un aviso que empieza justo ahora es vigente; uno que termina justo ahora ya no', async () => {
      const l = await crearLinea(ctx);
      const empieza = await crearAviso(ctx, { lineaIds: [l.id], desde: ctx.reloj.ahora() });
      await crearAviso(ctx, { lineaIds: [l.id], desde: antes(1), hasta: ctx.reloj.ahora() });
      const r = await ctx.http.get('/avisos').query({ lineaId: l.id }).expect(200);
      expect(r.body.datos.map((a: { id: string }) => a.id)).toEqual([empieza.id]);
    });
    it('cambia con el reloj: lo próximo pasa a vigente', async () => {
      const l = await crearLinea(ctx);
      const a = await crearAviso(ctx, { lineaIds: [l.id], desde: despues(1) });
      const antesDeEmpezar = await ctx.http.get('/avisos').query({ lineaId: l.id });
      expect(antesDeEmpezar.body.datos).toEqual([]);
      ctx.reloj.avanzar(2 * HORA);
      try {
        const r = await ctx.http.get('/avisos').query({ lineaId: l.id });
        expect(r.body.datos.map((x: { id: string }) => x.id)).toEqual([a.id]);
      } finally {
        ctx.reloj.avanzar(-2 * HORA);
      }
    });
  });

  it('filtra por lineaId: sólo los avisos que mencionan esa línea', async () => {
    const a = await crearLinea(ctx);
    const b = await crearLinea(ctx);
    const deA = await crearAviso(ctx, { lineaIds: [a.id] });
    const deAyB = await crearAviso(ctx, { lineaIds: [a.id, b.id] });
    const deB = await crearAviso(ctx, { lineaIds: [b.id] });
    const rA = await ctx.http.get('/avisos').query({ lineaId: a.id });
    expect(rA.body.datos.map((x: { id: string }) => x.id).sort()).toEqual(
      [deA.id, deAyB.id].sort(),
    );
    const rB = await ctx.http.get('/avisos').query({ lineaId: b.id });
    expect(rB.body.datos.map((x: { id: string }) => x.id).sort()).toEqual(
      [deAyB.id, deB.id].sort(),
    );
    const r = await ctx.http.get('/avisos').query({ lineaId: a.id });
    const mixto = r.body.datos.find((x: { id: string }) => x.id === deAyB.id);
    expect(mixto.lineaIds).toEqual([a.id, b.id]);
  });

  it('una línea sin avisos (o que no existe) da lista vacía', async () => {
    const r = await ctx.http.get('/avisos').query({ lineaId: 'lin-no-existe' }).expect(200);
    esperarContrato(r.body, 'Aviso');
    expect(r.body).toEqual({ datos: [], meta: { total: 0, pagina: 1, porPagina: 20 } });
  });

  it('orden: gravedad (suspensión, desvío, informativo) y después desde descendente', async () => {
    const l = await crearLinea(ctx);
    const info = await crearAviso(ctx, {
      lineaIds: [l.id],
      gravedad: 'informativo',
      desde: antes(1),
    });
    const desvioViejo = await crearAviso(ctx, {
      lineaIds: [l.id],
      gravedad: 'desvio',
      desde: antes(10),
    });
    const desvioNuevo = await crearAviso(ctx, {
      lineaIds: [l.id],
      gravedad: 'desvio',
      desde: antes(2),
    });
    const susp = await crearAviso(ctx, {
      lineaIds: [l.id],
      gravedad: 'suspension',
      desde: antes(20),
    });
    const r = await ctx.http.get('/avisos').query({ lineaId: l.id });
    expect(r.body.datos.map((x: { id: string }) => x.id)).toEqual([
      susp.id,
      desvioNuevo.id,
      desvioViejo.id,
      info.id,
    ]);
  });

  it('pagina, y una página fuera de rango da datos [] con el total correcto', async () => {
    const l = await crearLinea(ctx);
    for (let i = 0; i < 5; i++) await crearAviso(ctx, { lineaIds: [l.id], desde: antes(i + 1) });
    const p2 = await ctx.http.get('/avisos').query({ lineaId: l.id, porPagina: 2, pagina: 2 });
    expect(p2.body.meta).toEqual({ total: 5, pagina: 2, porPagina: 2 });
    expect(p2.body.datos).toHaveLength(2);
    const p9 = await ctx.http.get('/avisos').query({ lineaId: l.id, porPagina: 2, pagina: 9 });
    expect(p9.body.datos).toEqual([]);
    expect(p9.body.meta.total).toBe(5);
  });

  it.each([
    [{ estado: 'viejos' }],
    [{ estado: '' }],
    [{ lineaId: 'par-101' }],
    [{ pagina: '0' }],
    [{ porPagina: '101' }],
    [{ porPagina: 'abc' }],
    [{ otraCosa: '1' }],
  ])('400 VALIDACION_FALLIDA con la consulta %j', async (consulta) => {
    const r = await ctx.http.get('/avisos').query(consulta);
    esperarError(r, 400, 'VALIDACION_FALLIDA');
  });
});

describe('Espec. §4 — GET /avisos/:id', () => {
  it('es público y devuelve el aviso, aunque ya haya terminado', async () => {
    const l = await crearLinea(ctx);
    const a = await crearAviso(ctx, { lineaIds: [l.id], desde: antes(9), hasta: antes(1) });
    const r = await ctx.http.get(`/avisos/${a.id}`).expect(200);
    esperarContrato(r.body, 'Aviso');
    expect(r.body.datos.id).toBe(a.id);
  });

  it.each(['avi-no-existe', 'xxx', 'lin-05', '%25'])(
    'AVISO_NO_ENCONTRADO (404) con %s',
    async (id) => {
      const r = await ctx.http.get(`/avisos/${id}`);
      esperarError(r, 404, 'AVISO_NO_ENCONTRADO');
    },
  );
});

describe('Espec. §4 — POST /avisos', () => {
  const cuerpo = (lineaIds: string[], extra: Record<string, unknown> = {}) => ({
    titulo: 'Desvío por obra en calle Corrientes',
    detalle: 'Por una obra, las líneas 2, 7 y 9 no pasan por Corrientes.',
    lineaIds,
    desde: iso(antes(1)),
    gravedad: 'desvio',
    ...extra,
  });

  it('la Dirección publica un aviso (201) con id avi- y el contrato completo', async () => {
    const l = await crearLinea(ctx);
    const video = await subirVideo();
    const hasta = despues(48);
    const r = await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo([l.id], { hasta: iso(hasta), trazadoAlternativo: TRAZADO, videoUrl: video }))
      .expect(201);
    esperarContrato(r.body, 'Aviso');
    expect(r.body.datos).toMatchObject({
      id: expect.stringMatching(/^avi-[a-z0-9]{12}$/),
      lineaIds: [l.id],
      gravedad: 'desvio',
      trazadoAlternativo: TRAZADO,
      videoUrl: video,
    });
    const leido = await ctx.http.get(`/avisos/${r.body.datos.id}`).expect(200);
    expect(leido.body.datos).toEqual(r.body.datos);
  });

  it('sin hasta, trazado ni video, esos campos son null', async () => {
    const l = await crearLinea(ctx);
    const r = await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo([l.id]))
      .expect(201);
    esperarContrato(r.body, 'Aviso');
    expect(r.body.datos).toMatchObject({ hasta: null, trazadoAlternativo: null, videoUrl: null });
  });

  it('acepta null explícito en los opcionales', async () => {
    const l = await crearLinea(ctx);
    const r = await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo([l.id], { hasta: null, trazadoAlternativo: null, videoUrl: null }))
      .expect(201);
    expect(r.body.datos).toMatchObject({ hasta: null, trazadoAlternativo: null, videoUrl: null });
  });

  it('normaliza las fechas a -03:00 sin milisegundos, venga con Z o con otro offset', async () => {
    const l = await crearLinea(ctx);
    const r = await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(
        cuerpo([l.id], { desde: '2026-09-19T12:00:00.000Z', hasta: '2026-09-20T09:00:00-03:00' }),
      )
      .expect(201);
    expect(r.body.datos.desde).toBe('2026-09-19T09:00:00-03:00');
    expect(r.body.datos.hasta).toBe('2026-09-20T09:00:00-03:00');
  });

  it('conserva el orden de lineaIds', async () => {
    const a = await crearLinea(ctx);
    const b = await crearLinea(ctx);
    const c = await crearLinea(ctx);
    const r = await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo([c.id, a.id, b.id]))
      .expect(201);
    expect(r.body.datos.lineaIds).toEqual([c.id, a.id, b.id]);
  });

  it('sin sesión, 401', async () => {
    const l = await crearLinea(ctx);
    esperarError(await ctx.http.post('/avisos').send(cuerpo([l.id])), 401, 'NO_AUTENTICADO');
  });

  it('un pasajero no puede publicar (403 SIN_PERMISO) y no queda nada guardado', async () => {
    const l = await crearLinea(ctx);
    const pasajero = await crearUsuario(ctx);
    const antesDe = await ctx.dataSource.getRepository(AvisoEntidad).count();
    esperarError(
      await ctx.http
        .post('/avisos')
        .set(pasajero.auth)
        .send(cuerpo([l.id])),
      403,
      'SIN_PERMISO',
    );
    expect(await ctx.dataSource.getRepository(AvisoEntidad).count()).toBe(antesDe);
  });

  describe('400 VALIDACION_FALLIDA', () => {
    const casos: [string, (l: string) => Record<string, unknown>][] = [
      ['falta el título', (l) => ({ ...cuerpo([l]), titulo: undefined })],
      ['título vacío', (l) => cuerpo([l], { titulo: '   ' })],
      ['título que no es texto', (l) => cuerpo([l], { titulo: 5 })],
      ['título larguísimo', (l) => cuerpo([l], { titulo: 'a'.repeat(201) })],
      ['falta el detalle', (l) => ({ ...cuerpo([l]), detalle: undefined })],
      ['detalle vacío', (l) => cuerpo([l], { detalle: '' })],
      ['faltan las líneas', (l) => ({ ...cuerpo([l]), lineaIds: undefined })],
      ['lineaIds vacío', () => cuerpo([])],
      ['lineaIds que no es lista', (l) => cuerpo([l], { lineaIds: l })],
      ['lineaIds con un id mal formado', () => cuerpo(['par-101'])],
      ['lineaIds con un número', () => cuerpo([5 as unknown as string])],
      ['falta desde', (l) => ({ ...cuerpo([l]), desde: undefined })],
      ['desde sin zona', (l) => cuerpo([l], { desde: '2026-09-19T10:00:00' })],
      ['desde que no es fecha', (l) => cuerpo([l], { desde: 'mañana' })],
      [
        'desde con un día que no existe',
        (l) => cuerpo([l], { desde: '2026-02-30T10:00:00-03:00' }),
      ],
      ['desde numérico', (l) => cuerpo([l], { desde: 1789812000 })],
      ['hasta mal formado', (l) => cuerpo([l], { hasta: 'pronto' })],
      [
        'hasta igual a desde',
        (l) =>
          cuerpo([l], { desde: '2026-09-19T10:00:00-03:00', hasta: '2026-09-19T10:00:00-03:00' }),
      ],
      [
        'hasta anterior a desde',
        (l) =>
          cuerpo([l], { desde: '2026-09-19T10:00:00-03:00', hasta: '2026-09-18T10:00:00-03:00' }),
      ],
      ['falta la gravedad', (l) => ({ ...cuerpo([l]), gravedad: undefined })],
      ['gravedad inventada', (l) => cuerpo([l], { gravedad: 'grave' })],
      ['trazado con un solo punto', (l) => cuerpo([l], { trazadoAlternativo: [TRAZADO[0]] })],
      ['trazado vacío', (l) => cuerpo([l], { trazadoAlternativo: [] })],
      [
        'trazado con punto sin longitud',
        (l) => cuerpo([l], { trazadoAlternativo: [TRAZADO[0], { latitud: 1 }] }),
      ],
      [
        'trazado con latitud fuera de rango',
        (l) => cuerpo([l], { trazadoAlternativo: [TRAZADO[0], { latitud: 91, longitud: 0 }] }),
      ],
      [
        'trazado con un campo de más',
        (l) => cuerpo([l], { trazadoAlternativo: [TRAZADO[0], { ...TRAZADO[1], altura: 3 }] }),
      ],
      ['videoUrl que no es texto', (l) => cuerpo([l], { videoUrl: 7 })],
      ['un campo de más', (l) => cuerpo([l], { id: 'avi-propio' })],
      ['un campo de más (rol)', (l) => cuerpo([l], { creadoPor: 'usr-1' })],
    ];
    it.each(casos)('%s', async (_caso, armar) => {
      const l = await crearLinea(ctx);
      const r = await ctx.http.post('/avisos').set(direccion.auth).send(armar(l.id));
      esperarError(r, 400, 'VALIDACION_FALLIDA');
      expect(r.body.error.mensaje).not.toMatch(/undefined|should|must|property/i);
    });

    it('un cuerpo que no es JSON válido', async () => {
      const r = await ctx.http
        .post('/avisos')
        .set(direccion.auth)
        .set('Content-Type', 'application/json')
        .send('{"titulo"');
      esperarError(r, 400, 'VALIDACION_FALLIDA');
    });
  });

  it('LINEA_NO_ENCONTRADA (404) si alguna línea no existe, y no guarda nada', async () => {
    const l = await crearLinea(ctx);
    const antesDe = await ctx.dataSource.getRepository(AvisoEntidad).count();
    const r = await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo([l.id, 'lin-no-existe']));
    esperarError(r, 404, 'LINEA_NO_ENCONTRADA');
    expect(await ctx.dataSource.getRepository(AvisoEntidad).count()).toBe(antesDe);
  });

  it('lineaIds repetidos se guardan una sola vez', async () => {
    const l = await crearLinea(ctx);
    const r = await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo([l.id, l.id]))
      .expect(201);
    expect(r.body.datos.lineaIds).toEqual([l.id]);
  });

  describe('ARCHIVO_NO_SUBIDO (422) — el video tiene que ser de /archivos y de tipo video', () => {
    it.each([
      ['una URL de otro sitio', () => 'https://ejemplo.com/video.mp4'],
      ['un file://', () => 'file:///data/user/0/video.mp4'],
      [
        'una clave que no existe',
        () => 'http://127.0.0.1:3000/archivos/videos/2026/09/noexiste12345.mp4',
      ],
      ['un texto cualquiera', () => 'video'],
    ])('%s', async (_caso, url) => {
      const l = await crearLinea(ctx);
      const r = await ctx.http
        .post('/avisos')
        .set(direccion.auth)
        .send(cuerpo([l.id], { videoUrl: url() }));
      esperarError(r, 422, 'ARCHIVO_NO_SUBIDO');
    });

    it('una imagen subida no sirve como video', async () => {
      const l = await crearLinea(ctx);
      const subida = await ctx.http
        .post('/archivos')
        .set(direccion.auth)
        .attach('archivo', jpeg(), { filename: 'f.jpg', contentType: 'image/jpeg' })
        .expect(201);
      const r = await ctx.http
        .post('/avisos')
        .set(direccion.auth)
        .send(cuerpo([l.id], { videoUrl: subida.body.datos.url }));
      esperarError(r, 422, 'ARCHIVO_NO_SUBIDO');
    });
  });

  describe('Espec. §7 / D9 — push al crearlo', () => {
    const registrarTelefono = async (u: UsuarioDePrueba, tokenExpo: string) => {
      await ctx.registrarToken(u.id, tokenExpo, 'android');
    };

    it('la reciben quienes tienen la línea como favorita, una vez por teléfono', async () => {
      const fan = await crearUsuario(ctx);
      const otra = await crearUsuario(ctx);
      const ajeno = await crearUsuario(ctx);
      const l = await lineaConFavoritos(fan, otra);
      await registrarTelefono(fan, 'ExponentPushToken[fan-1]');
      await registrarTelefono(fan, 'ExponentPushToken[fan-2]');
      await registrarTelefono(otra, 'ExponentPushToken[otra-1]');
      await registrarTelefono(ajeno, 'ExponentPushToken[ajeno-1]');
      const r = await ctx.http
        .post('/avisos')
        .set(direccion.auth)
        .send(cuerpo([l.id]))
        .expect(201);
      await ctx.esperarPush();
      expect(ctx.notificador.enviadas.map((m) => m.tokenExpo).sort()).toEqual([
        'ExponentPushToken[fan-1]',
        'ExponentPushToken[fan-2]',
        'ExponentPushToken[otra-1]',
      ]);
      expect(ctx.notificador.enviadas[0]).toMatchObject({
        titulo: 'Desvío por obra en calle Corrientes',
        datos: { tipo: 'aviso', avisoId: r.body.datos.id },
      });
      expect(ctx.notificador.enviadas[0].cuerpo).toContain('las líneas 2, 7 y 9');
    });

    it('si tiene dos de las líneas del aviso como favoritas, recibe una sola push', async () => {
      const fan = await crearUsuario(ctx);
      const a = await lineaConFavoritos(fan);
      const b = await lineaConFavoritos(fan);
      await registrarTelefono(fan, 'ExponentPushToken[doble-1]');
      await ctx.http
        .post('/avisos')
        .set(direccion.auth)
        .send(cuerpo([a.id, b.id]))
        .expect(201);
      await ctx.esperarPush();
      expect(ctx.notificador.enviadas).toHaveLength(1);
    });

    it('no la recibe quien apagó los avisos', async () => {
      const apagado = await crearUsuario(ctx, { avisosActivos: false });
      const l = await lineaConFavoritos(apagado);
      await registrarTelefono(apagado, 'ExponentPushToken[apagado-1]');
      await ctx.http
        .post('/avisos')
        .set(direccion.auth)
        .send(cuerpo([l.id]))
        .expect(201);
      await ctx.esperarPush();
      expect(ctx.notificador.enviadas).toEqual([]);
    });

    it('se notifica aunque el aviso empiece después (D9)', async () => {
      const fan = await crearUsuario(ctx);
      const l = await lineaConFavoritos(fan);
      await registrarTelefono(fan, 'ExponentPushToken[futuro-1]');
      await ctx.http
        .post('/avisos')
        .set(direccion.auth)
        .send(cuerpo([l.id], { desde: iso(despues(24)) }))
        .expect(201);
      await ctx.esperarPush();
      expect(ctx.notificador.enviadas).toHaveLength(1);
    });

    it('un pedido rechazado no manda nada', async () => {
      const fan = await crearUsuario(ctx);
      const l = await lineaConFavoritos(fan);
      await registrarTelefono(fan, 'ExponentPushToken[rechazo-1]');
      await ctx.http
        .post('/avisos')
        .set(direccion.auth)
        .send(cuerpo([l.id], { gravedad: 'x' }))
        .expect(400);
      await ctx.esperarPush();
      expect(ctx.notificador.enviadas).toEqual([]);
    });

    it('si Expo falla, el aviso se publica igual', async () => {
      const fan = await crearUsuario(ctx);
      const l = await lineaConFavoritos(fan);
      await registrarTelefono(fan, 'ExponentPushToken[falla-1]');
      ctx.notificador.fallar = true;
      const r = await ctx.http
        .post('/avisos')
        .set(direccion.auth)
        .send(cuerpo([l.id]))
        .expect(201);
      await ctx.esperarPush();
      await ctx.http.get(`/avisos/${r.body.datos.id}`).expect(200);
    });
  });
});

describe('Espec. §4 — PATCH /avisos/:id', () => {
  it('edita sólo lo que viene y devuelve el aviso (200)', async () => {
    const [a, b] = [await crearLinea(ctx), await crearLinea(ctx)];
    const aviso = await crearAviso(ctx, {
      lineaIds: [a.id],
      gravedad: 'informativo',
      hasta: despues(5),
    });
    const r = await ctx.http
      .patch(`/avisos/${aviso.id}`)
      .set(direccion.auth)
      .send({ titulo: 'Nuevo título', gravedad: 'suspension', lineaIds: [b.id, a.id] })
      .expect(200);
    esperarContrato(r.body, 'Aviso');
    expect(r.body.datos).toMatchObject({
      id: aviso.id,
      titulo: 'Nuevo título',
      detalle: aviso.detalle,
      gravedad: 'suspension',
      lineaIds: [b.id, a.id],
    });
    expect(r.body.datos.hasta).not.toBeNull();
    const leido = await ctx.http.get(`/avisos/${aviso.id}`);
    expect(leido.body.datos).toEqual(r.body.datos);
  });

  it('{} no cambia nada (200)', async () => {
    const l = await crearLinea(ctx);
    const aviso = await crearAviso(ctx, { lineaIds: [l.id] });
    const antesDe = await ctx.http.get(`/avisos/${aviso.id}`);
    const r = await ctx.http.patch(`/avisos/${aviso.id}`).set(direccion.auth).send({}).expect(200);
    expect(r.body.datos).toEqual(antesDe.body.datos);
  });

  it('null borra hasta, trazado y video', async () => {
    const l = await crearLinea(ctx);
    const aviso = await crearAviso(ctx, {
      lineaIds: [l.id],
      hasta: despues(5),
      trazadoAlternativo: TRAZADO,
      videoClave: 'videos/2026/09/abcdefgh1234.mp4',
    });
    const r = await ctx.http
      .patch(`/avisos/${aviso.id}`)
      .set(direccion.auth)
      .send({ hasta: null, trazadoAlternativo: null, videoUrl: null })
      .expect(200);
    expect(r.body.datos).toMatchObject({ hasta: null, trazadoAlternativo: null, videoUrl: null });
  });

  it('puede cambiar el video por otro subido', async () => {
    const l = await crearLinea(ctx);
    const aviso = await crearAviso(ctx, { lineaIds: [l.id] });
    const video = await subirVideo();
    const r = await ctx.http
      .patch(`/avisos/${aviso.id}`)
      .set(direccion.auth)
      .send({ videoUrl: video })
      .expect(200);
    expect(r.body.datos.videoUrl).toBe(video);
  });

  it('no dispara push (D9)', async () => {
    const fan = await crearUsuario(ctx);
    const l = await lineaConFavoritos(fan);
    await ctx.registrarToken(fan.id, 'ExponentPushToken[patch-1]');
    const aviso = await crearAviso(ctx, { lineaIds: [l.id] });
    await ctx.http
      .patch(`/avisos/${aviso.id}`)
      .set(direccion.auth)
      .send({ titulo: 'Otro' })
      .expect(200);
    await ctx.esperarPush();
    expect(ctx.notificador.enviadas).toEqual([]);
  });

  it('se valida hasta contra el desde ya guardado (400)', async () => {
    const l = await crearLinea(ctx);
    const aviso = await crearAviso(ctx, { lineaIds: [l.id], desde: antes(1) });
    const r = await ctx.http
      .patch(`/avisos/${aviso.id}`)
      .set(direccion.auth)
      .send({ hasta: iso(antes(2)) });
    esperarError(r, 400, 'VALIDACION_FALLIDA');
  });

  it('se valida desde contra el hasta ya guardado (400)', async () => {
    const l = await crearLinea(ctx);
    const aviso = await crearAviso(ctx, { lineaIds: [l.id], desde: antes(5), hasta: antes(1) });
    const r = await ctx.http
      .patch(`/avisos/${aviso.id}`)
      .set(direccion.auth)
      .send({ desde: iso(despues(1)) });
    esperarError(r, 400, 'VALIDACION_FALLIDA');
  });

  it.each([
    [{ titulo: '' }],
    [{ titulo: null }],
    [{ detalle: null }],
    [{ lineaIds: [] }],
    [{ lineaIds: null }],
    [{ desde: null }],
    [{ gravedad: null }],
    [{ gravedad: 'otra' }],
    [{ trazadoAlternativo: [{ latitud: 1, longitud: 1 }] }],
    [{ id: 'avi-otro' }],
  ])('400 VALIDACION_FALLIDA con %j', async (cambios) => {
    const l = await crearLinea(ctx);
    const aviso = await crearAviso(ctx, { lineaIds: [l.id] });
    esperarError(
      await ctx.http.patch(`/avisos/${aviso.id}`).set(direccion.auth).send(cambios),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('LINEA_NO_ENCONTRADA y ARCHIVO_NO_SUBIDO, sin dejar cambios a medias', async () => {
    const l = await crearLinea(ctx);
    const aviso = await crearAviso(ctx, { lineaIds: [l.id], titulo: 'Original' });
    esperarError(
      await ctx.http
        .patch(`/avisos/${aviso.id}`)
        .set(direccion.auth)
        .send({ titulo: 'Cambiado', lineaIds: ['lin-fantasma'] }),
      404,
      'LINEA_NO_ENCONTRADA',
    );
    esperarError(
      await ctx.http
        .patch(`/avisos/${aviso.id}`)
        .set(direccion.auth)
        .send({ titulo: 'Cambiado', videoUrl: 'https://x.com/v.mp4' }),
      422,
      'ARCHIVO_NO_SUBIDO',
    );
    const leido = await ctx.http.get(`/avisos/${aviso.id}`);
    expect(leido.body.datos.titulo).toBe('Original');
    expect(leido.body.datos.lineaIds).toEqual([l.id]);
  });

  it('AVISO_NO_ENCONTRADO (404)', async () => {
    const r = await ctx.http
      .patch('/avisos/avi-no-existe')
      .set(direccion.auth)
      .send({ titulo: 'x' });
    esperarError(r, 404, 'AVISO_NO_ENCONTRADO');
  });

  it('401 sin sesión y 403 siendo pasajero', async () => {
    const l = await crearLinea(ctx);
    const aviso = await crearAviso(ctx, { lineaIds: [l.id] });
    const pasajero = await crearUsuario(ctx);
    esperarError(
      await ctx.http.patch(`/avisos/${aviso.id}`).send({ titulo: 'x' }),
      401,
      'NO_AUTENTICADO',
    );
    esperarError(
      await ctx.http.patch(`/avisos/${aviso.id}`).set(pasajero.auth).send({ titulo: 'x' }),
      403,
      'SIN_PERMISO',
    );
  });
});

describe('Espec. §4 — POST /avisos/:id/finalizar', () => {
  it('pone hasta = ahora y el aviso deja de ser vigente', async () => {
    const l = await crearLinea(ctx);
    const aviso = await crearAviso(ctx, { lineaIds: [l.id], hasta: despues(30) });
    const r = await ctx.http.post(`/avisos/${aviso.id}/finalizar`).set(direccion.auth).expect(200);
    esperarContrato(r.body, 'Aviso');
    expect(r.body.datos.hasta).toBe('2026-09-19T10:30:00-03:00');
    const vigentes = await ctx.http.get('/avisos').query({ lineaId: l.id });
    expect(vigentes.body.datos).toEqual([]);
    const todos = await ctx.http.get('/avisos').query({ lineaId: l.id, estado: 'todos' });
    expect(todos.body.datos).toHaveLength(1);
  });

  it('no manda push', async () => {
    const l = await crearLinea(ctx);
    const aviso = await crearAviso(ctx, { lineaIds: [l.id] });
    await ctx.http.post(`/avisos/${aviso.id}/finalizar`).set(direccion.auth).expect(200);
    await ctx.esperarPush();
    expect(ctx.notificador.enviadas).toEqual([]);
  });

  it('es idempotente: si ya terminó, queda como estaba', async () => {
    const l = await crearLinea(ctx);
    const aviso = await crearAviso(ctx, { lineaIds: [l.id], desde: antes(9), hasta: antes(3) });
    const r = await ctx.http.post(`/avisos/${aviso.id}/finalizar`).set(direccion.auth).expect(200);
    expect(r.body.datos.hasta).toBe((await ctx.http.get(`/avisos/${aviso.id}`)).body.datos.hasta);
    const dos = await ctx.http
      .post(`/avisos/${aviso.id}/finalizar`)
      .set(direccion.auth)
      .expect(200);
    expect(dos.body).toEqual(r.body);
  });

  it('finalizar dos veces seguidas un vigente da lo mismo', async () => {
    const l = await crearLinea(ctx);
    const aviso = await crearAviso(ctx, { lineaIds: [l.id] });
    const a = await ctx.http.post(`/avisos/${aviso.id}/finalizar`).set(direccion.auth).expect(200);
    const b = await ctx.http.post(`/avisos/${aviso.id}/finalizar`).set(direccion.auth).expect(200);
    expect(b.body).toEqual(a.body);
  });

  it('finalizar uno próximo lo cancela: queda terminado y nunca llega a ser vigente', async () => {
    const l = await crearLinea(ctx);
    const aviso = await crearAviso(ctx, { lineaIds: [l.id], desde: despues(3), hasta: despues(9) });
    const r = await ctx.http.post(`/avisos/${aviso.id}/finalizar`).set(direccion.auth).expect(200);
    expect(r.body.datos.desde).toBe(r.body.datos.hasta);
    ctx.reloj.avanzar(10 * HORA);
    try {
      const vigentes = await ctx.http.get('/avisos').query({ lineaId: l.id });
      expect(vigentes.body.datos).toEqual([]);
    } finally {
      ctx.reloj.avanzar(-10 * HORA);
    }
  });

  it('AVISO_NO_ENCONTRADO (404), 401 y 403', async () => {
    const l = await crearLinea(ctx);
    const aviso = await crearAviso(ctx, { lineaIds: [l.id] });
    const pasajero = await crearUsuario(ctx);
    esperarError(
      await ctx.http.post('/avisos/avi-no-existe/finalizar').set(direccion.auth),
      404,
      'AVISO_NO_ENCONTRADO',
    );
    esperarError(await ctx.http.post(`/avisos/${aviso.id}/finalizar`), 401, 'NO_AUTENTICADO');
    esperarError(
      await ctx.http.post(`/avisos/${aviso.id}/finalizar`).set(pasajero.auth),
      403,
      'SIN_PERMISO',
    );
    expect((await ctx.http.get(`/avisos/${aviso.id}`)).body.datos.hasta).toBeNull();
  });
});

describe('Integridad', () => {
  it('cada aviso tiene al menos una línea en su tabla', async () => {
    const l = await crearLinea(ctx);
    const r = await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send({
        titulo: 'T',
        detalle: 'D',
        lineaIds: [l.id],
        desde: iso(antes(1)),
        gravedad: 'informativo',
      })
      .expect(201);
    expect(
      await ctx.dataSource.getRepository(AvisoLineaEntidad).countBy({ avisoId: r.body.datos.id }),
    ).toBe(1);
  });
});
