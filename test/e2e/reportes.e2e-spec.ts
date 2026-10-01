import { ConfirmacionDemoraEntidad } from '../../src/modulos/reportes/confirmacion-demora.entidad.js';
import { ReporteDemoraEntidad } from '../../src/modulos/reportes/reporte-demora.entidad.js';
import { jpeg, mp4 } from '../utilidades/archivos.js';
import { AHORA_POR_DEFECTO, type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearLinea, crearParada } from '../utilidades/red.js';
import { crearReporte } from '../utilidades/reportes.js';
import { crearUsuario, type UsuarioDePrueba } from '../utilidades/usuarios.js';

let ctx: AppDePrueba;
let pasajero: UsuarioDePrueba;
let direccion: UsuarioDePrueba;
beforeAll(async () => {
  ctx = await crearApp();
  pasajero = await crearUsuario(ctx);
  direccion = await crearUsuario(ctx, { rol: 'direccion' });
});
afterAll(() => ctx.cerrar());
beforeEach(() => ctx.reloj.fijar(AHORA_POR_DEFECTO));

const MIN = 60_000;
const hace = (minutos: number) => new Date(ctx.reloj.ahora().getTime() - minutos * MIN);
const iso = (d: Date) => d.toISOString();

/** Una parada y una línea que para en ella. */
async function escenario() {
  const parada = await crearParada(ctx);
  const linea = await crearLinea(ctx, { recorridos: [{ sentido: 'ida', paradaIds: [parada.id] }] });
  return { parada, linea };
}

async function subirFoto(): Promise<string> {
  const r = await ctx.http
    .post('/archivos')
    .set(pasajero.auth)
    .attach('archivo', jpeg(), { filename: 'f.jpg', contentType: 'image/jpeg' })
    .expect(201);
  return r.body.datos.url as string;
}

const cuerpoBase = (e: { parada: { id: string }; linea: { id: string } }) => ({
  lineaId: e.linea.id,
  paradaId: e.parada.id,
  motivo: 'demorado',
  fechaHora: iso(hace(5)),
});

describe('Espec. §4 — POST /reportes-demora', () => {
  it('crea el reporte con la forma del contrato (201)', async () => {
    const e = await escenario();
    const foto = await subirFoto();
    const r = await ctx.http
      .post('/reportes-demora')
      .set(pasajero.auth)
      .send({ ...cuerpoBase(e), comentario: '  Hace rato  ', fotoUri: foto })
      .expect(201);
    esperarContrato(r.body, 'ReporteDeDemora');
    expect(r.body.datos).toEqual({
      id: expect.stringMatching(/^rep-[a-z0-9]{12}$/),
      lineaId: e.linea.id,
      paradaId: e.parada.id,
      usuarioId: pasajero.id,
      motivo: 'demorado',
      comentario: 'Hace rato',
      fotoUri: foto,
      confirmaciones: 0,
      fechaHora: '2026-09-19T10:25:00-03:00',
      sincronizado: true,
    });
  });

  it('sin comentario ni foto, viajan como null', async () => {
    const e = await escenario();
    const r = await ctx.http
      .post('/reportes-demora')
      .set(pasajero.auth)
      .send({ ...cuerpoBase(e), comentario: '   ' })
      .expect(201);
    expect(r.body.datos).toMatchObject({ comentario: null, fotoUri: null });
  });

  it('acepta el reporte entero de la cola offline e ignora usuarioId, confirmaciones y sincronizado', async () => {
    const e = await escenario();
    const r = await ctx.http
      .post('/reportes-demora')
      .set(pasajero.auth)
      .send({
        ...cuerpoBase(e),
        id: 'rep-offline1',
        usuarioId: 'usr-otro',
        confirmaciones: 40,
        sincronizado: false,
      })
      .expect(201);
    esperarContrato(r.body, 'ReporteDeDemora');
    expect(r.body.datos).toMatchObject({
      id: 'rep-offline1',
      usuarioId: pasajero.id,
      confirmaciones: 0,
      sincronizado: true,
    });
  });

  it('acepta un instante con Z y lo devuelve con -03:00', async () => {
    const e = await escenario();
    const r = await ctx.http
      .post('/reportes-demora')
      .set(pasajero.auth)
      .send({ ...cuerpoBase(e), fechaHora: '2026-09-19T13:20:00Z' })
      .expect(201);
    expect(r.body.datos.fechaHora).toBe('2026-09-19T10:20:00-03:00');
  });

  it('401 sin token', async () => {
    const e = await escenario();
    esperarError(
      await ctx.http.post('/reportes-demora').send(cuerpoBase(e)),
      401,
      'NO_AUTENTICADO',
    );
  });

  describe('400 por cada validación', () => {
    it.each([
      ['falta lineaId', { lineaId: undefined }],
      ['falta paradaId', { paradaId: undefined }],
      ['falta motivo', { motivo: undefined }],
      ['falta fechaHora', { fechaHora: undefined }],
      ['motivo desconocido', { motivo: 'se_rompio' }],
      ['lineaId con otro prefijo', { lineaId: 'par-1' }],
      ['paradaId numérico', { paradaId: 12 }],
      ['id con otro prefijo', { id: 'lin-abc' }],
      ['id demasiado corto', { id: 'rep-a' }],
      ['fechaHora sin zona', { fechaHora: '2026-09-19T10:00:00' }],
      ['fechaHora inexistente', { fechaHora: '2026-02-30T10:00:00-03:00' }],
      ['fechaHora numérica', { fechaHora: 1790000000 }],
      ['comentario demasiado largo', { comentario: 'a'.repeat(501) }],
      ['comentario no texto', { comentario: 5 }],
      ['campo desconocido', { gravedad: 'alta' }],
    ])('%s', async (_nombre, cambio) => {
      const e = await escenario();
      const r = await ctx.http
        .post('/reportes-demora')
        .set(pasajero.auth)
        .send({ ...cuerpoBase(e), ...cambio });
      esperarError(r, 400, 'VALIDACION_FALLIDA');
    });
  });

  it('LINEA_NO_ENCONTRADA y PARADA_NO_ENCONTRADA (404)', async () => {
    const e = await escenario();
    esperarError(
      await ctx.http
        .post('/reportes-demora')
        .set(pasajero.auth)
        .send({ ...cuerpoBase(e), lineaId: 'lin-noexiste' }),
      404,
      'LINEA_NO_ENCONTRADA',
    );
    esperarError(
      await ctx.http
        .post('/reportes-demora')
        .set(pasajero.auth)
        .send({ ...cuerpoBase(e), paradaId: 'par-noexiste' }),
      404,
      'PARADA_NO_ENCONTRADA',
    );
  });

  describe('R12 — la línea tiene que parar en esa parada', () => {
    it('LINEA_NO_PARA_EN_PARADA (422)', async () => {
      const e = await escenario();
      const otra = await crearParada(ctx);
      esperarError(
        await ctx.http
          .post('/reportes-demora')
          .set(pasajero.auth)
          .send({ ...cuerpoBase(e), paradaId: otra.id }),
        422,
        'LINEA_NO_PARA_EN_PARADA',
      );
      expect(
        await ctx.dataSource.getRepository(ReporteDemoraEntidad).countBy({ lineaId: e.linea.id }),
      ).toBe(0);
    });
  });

  describe('R12 — la fecha no puede ser futura (tolerancia de 5 minutos)', () => {
    it.each([
      [-5, 201],
      [-6, 422],
      [-120, 422],
    ])('fecha %i minutos atrás → %i', async (minutos, estado) => {
      const e = await escenario();
      const r = await ctx.http
        .post('/reportes-demora')
        .set(pasajero.auth)
        .send({ ...cuerpoBase(e), fechaHora: iso(hace(minutos)) });
      if (estado === 201) expect(r.status).toBe(201);
      else esperarError(r, 422, 'FECHA_EN_EL_FUTURO');
    });

    it('una fecha vieja se acepta (la cola offline puede subir tarde)', async () => {
      const e = await escenario();
      await ctx.http
        .post('/reportes-demora')
        .set(pasajero.auth)
        .send({ ...cuerpoBase(e), fechaHora: iso(hace(60 * 24)) })
        .expect(201);
    });
  });

  describe('R12 — la foto tiene que estar subida', () => {
    it.each([
      ['una URL de otro sitio', 'https://example.com/foto.jpg'],
      ['un file://', 'file:///data/user/0/foto.jpg'],
      [
        'un archivo de esta API que no existe',
        'http://127.0.0.1:1/archivos/imagenes/2026/09/noexiste12345.jpg',
      ],
    ])('%s → ARCHIVO_NO_SUBIDO', async (_nombre, fotoUri) => {
      const e = await escenario();
      esperarError(
        await ctx.http
          .post('/reportes-demora')
          .set(pasajero.auth)
          .send({ ...cuerpoBase(e), fotoUri }),
        422,
        'ARCHIVO_NO_SUBIDO',
      );
    });

    it('un video no vale como foto', async () => {
      const e = await escenario();
      const r = await ctx.http
        .post('/archivos')
        .set(pasajero.auth)
        .attach('archivo', mp4(), { filename: 'v.mp4', contentType: 'video/mp4' })
        .expect(201);
      esperarError(
        await ctx.http
          .post('/reportes-demora')
          .set(pasajero.auth)
          .send({ ...cuerpoBase(e), fotoUri: r.body.datos.url }),
        422,
        'ARCHIVO_NO_SUBIDO',
      );
    });
  });

  describe('R13 — un reporte por línea y parada cada 15 minutos', () => {
    it('REPORTE_YA_ENVIADO (409) dentro de los 15 minutos', async () => {
      const e = await escenario();
      await crearReporte(ctx, { ...ids(e), usuarioId: pasajero.id, haceMinutos: 10 });
      esperarError(
        await ctx.http
          .post('/reportes-demora')
          .set(pasajero.auth)
          .send({ ...cuerpoBase(e), fechaHora: iso(hace(5)) }),
        409,
        'REPORTE_YA_ENVIADO',
      );
    });

    it('a los 15 minutos justos ya se puede', async () => {
      const e = await escenario();
      await crearReporte(ctx, { ...ids(e), usuarioId: pasajero.id, haceMinutos: 20 });
      await ctx.http
        .post('/reportes-demora')
        .set(pasajero.auth)
        .send({ ...cuerpoBase(e), fechaHora: iso(hace(5)) })
        .expect(201);
    });

    it('otra persona, otra línea u otra parada no chocan', async () => {
      const e = await escenario();
      await crearReporte(ctx, { ...ids(e), usuarioId: pasajero.id, haceMinutos: 10 });
      const otro = await crearUsuario(ctx);
      await ctx.http.post('/reportes-demora').set(otro.auth).send(cuerpoBase(e)).expect(201);
      const e2 = await escenario();
      await ctx.http.post('/reportes-demora').set(pasajero.auth).send(cuerpoBase(e2)).expect(201);
    });

    it('dos pedidos simultáneos iguales (sin id): uno pasa y el otro da REPORTE_YA_ENVIADO', async () => {
      const e = await escenario();
      const pedir = () => ctx.http.post('/reportes-demora').set(pasajero.auth).send(cuerpoBase(e));
      const [a, b] = await Promise.all([pedir(), pedir()]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      expect(
        await ctx.dataSource
          .getRepository(ReporteDemoraEntidad)
          .count({ where: { usuarioId: pasajero.id, lineaId: e.linea.id } }),
      ).toBe(1);
    });
  });

  describe('AGENTS §10.5 — idempotencia por id', () => {
    it('el mismo cuerpo dos veces deja un registro y las dos respuestas son iguales (201 y 200)', async () => {
      const e = await escenario();
      const cuerpo = { ...cuerpoBase(e), id: 'rep-cola0001', comentario: 'Sigue sin pasar' };
      const primera = await ctx.http
        .post('/reportes-demora')
        .set(pasajero.auth)
        .send(cuerpo)
        .expect(201);
      const segunda = await ctx.http
        .post('/reportes-demora')
        .set(pasajero.auth)
        .send(cuerpo)
        .expect(200);
      esperarContrato(segunda.body, 'ReporteDeDemora');
      expect(segunda.body).toEqual(primera.body);
      expect(
        await ctx.dataSource.getRepository(ReporteDemoraEntidad).countBy({ id: 'rep-cola0001' }),
      ).toBe(1);
    });

    it('el reenvío devuelve el existente aunque ya haya pasado el plazo de R13', async () => {
      const e = await escenario();
      const cuerpo = { ...cuerpoBase(e), id: 'rep-cola0002' };
      await ctx.http.post('/reportes-demora').set(pasajero.auth).send(cuerpo).expect(201);
      ctx.reloj.avanzar(3 * MIN);
      await ctx.http.post('/reportes-demora').set(pasajero.auth).send(cuerpo).expect(200);
    });

    it('un id que es de otra persona → ID_EN_USO (409)', async () => {
      const e = await escenario();
      const otro = await crearUsuario(ctx);
      await crearReporte(ctx, {
        ...ids(e),
        usuarioId: otro.id,
        id: 'rep-ajeno001',
        haceMinutos: 60,
      });
      esperarError(
        await ctx.http
          .post('/reportes-demora')
          .set(pasajero.auth)
          .send({ ...cuerpoBase(e), id: 'rep-ajeno001' }),
        409,
        'ID_EN_USO',
      );
    });

    it('dos pedidos simultáneos con el mismo id dejan un registro', async () => {
      const e = await escenario();
      const pedir = () =>
        ctx.http
          .post('/reportes-demora')
          .set(pasajero.auth)
          .send({ ...cuerpoBase(e), id: 'rep-cola0003' });
      const [a, b] = await Promise.all([pedir(), pedir()]);
      expect([a.status, b.status].sort()).toEqual([200, 201]);
      expect(a.body).toEqual(b.body);
    });

    it('dos personas a la vez con el mismo id: una gana y la otra recibe ID_EN_USO', async () => {
      const e = await escenario();
      const otro = await crearUsuario(ctx);
      const pedir = (u: UsuarioDePrueba) =>
        ctx.http
          .post('/reportes-demora')
          .set(u.auth)
          .send({ ...cuerpoBase(e), id: 'rep-carrera01' });
      const [a, b] = await Promise.all([pedir(pasajero), pedir(otro)]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      expect(
        await ctx.dataSource.getRepository(ReporteDemoraEntidad).countBy({ id: 'rep-carrera01' }),
      ).toBe(1);
    });
  });

  it('no manda push (la espec. §7 no lo pide)', async () => {
    const e = await escenario();
    ctx.notificador.vaciar();
    await ctx.http.post('/reportes-demora').set(pasajero.auth).send(cuerpoBase(e)).expect(201);
    expect(ctx.notificador.enviadas).toHaveLength(0);
  });
});

const ids = (e: { parada: { id: string }; linea: { id: string } }) => ({
  lineaId: e.linea.id,
  paradaId: e.parada.id,
});

describe('Espec. §4 — GET /reportes-demora', () => {
  it('es público; sólo los de los últimos 90 minutos, el más nuevo primero', async () => {
    const e = await escenario();
    const a = await crearReporte(ctx, { ...ids(e), usuarioId: pasajero.id, haceMinutos: 60 });
    const b = await crearReporte(ctx, { ...ids(e), usuarioId: pasajero.id, haceMinutos: 5 });
    const limite = await crearReporte(ctx, { ...ids(e), usuarioId: pasajero.id, haceMinutos: 90 });
    await crearReporte(ctx, { ...ids(e), usuarioId: pasajero.id, haceMinutos: 91 });
    const r = await ctx.http.get('/reportes-demora').query({ paradaId: e.parada.id }).expect(200);
    esperarContrato(r.body, 'ReporteDeDemora');
    expect(r.body.datos.map((x: { id: string }) => x.id)).toEqual([b.id, a.id, limite.id]);
    expect(r.body.meta).toEqual({ total: 3, pagina: 1, porPagina: 20 });
  });

  it('exige paradaId o lineaId (VALIDACION_FALLIDA)', async () => {
    esperarError(await ctx.http.get('/reportes-demora'), 400, 'VALIDACION_FALLIDA');
    esperarError(
      await ctx.http.get('/reportes-demora').query({ paradaId: 'lin-1' }),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('filtra por línea, por parada y por las dos', async () => {
    const e = await escenario();
    const otraLinea = await crearLinea(ctx, {
      recorridos: [{ sentido: 'ida', paradaIds: [e.parada.id] }],
    });
    const r1 = await crearReporte(ctx, { ...ids(e), usuarioId: pasajero.id });
    const r2 = await crearReporte(ctx, {
      lineaId: otraLinea.id,
      paradaId: e.parada.id,
      usuarioId: pasajero.id,
    });
    const idsDe = async (q: Record<string, string>) =>
      (await ctx.http.get('/reportes-demora').query(q).expect(200)).body.datos
        .map((x: { id: string }) => x.id)
        .sort();
    expect(await idsDe({ paradaId: e.parada.id })).toEqual([r1.id, r2.id].sort());
    expect(await idsDe({ lineaId: otraLinea.id })).toEqual([r2.id]);
    expect(await idsDe({ lineaId: e.linea.id, paradaId: e.parada.id })).toEqual([r1.id]);
  });

  it('lista vacía: una parada sin reportes', async () => {
    const e = await escenario();
    const r = await ctx.http.get('/reportes-demora').query({ paradaId: e.parada.id }).expect(200);
    esperarContrato(r.body, 'ReporteDeDemora');
    expect(r.body).toEqual({ datos: [], meta: { total: 0, pagina: 1, porPagina: 20 } });
  });

  it('pagina y desempata por id; una página fuera de rango da datos vacíos con el total', async () => {
    const e = await escenario();
    for (let i = 0; i < 5; i++) {
      await crearReporte(ctx, { ...ids(e), usuarioId: pasajero.id, haceMinutos: 10 });
    }
    const q = { paradaId: e.parada.id, porPagina: 2 };
    const p1 = await ctx.http
      .get('/reportes-demora')
      .query({ ...q, pagina: 1 })
      .expect(200);
    const p3 = await ctx.http
      .get('/reportes-demora')
      .query({ ...q, pagina: 3 })
      .expect(200);
    const p9 = await ctx.http
      .get('/reportes-demora')
      .query({ ...q, pagina: 9 })
      .expect(200);
    expect(p1.body.meta).toEqual({ total: 5, pagina: 1, porPagina: 2 });
    expect(p1.body.datos).toHaveLength(2);
    expect(p3.body.datos).toHaveLength(1);
    expect(p9.body).toEqual({ datos: [], meta: { total: 5, pagina: 9, porPagina: 2 } });
    const idsP1 = p1.body.datos.map((x: { id: string }) => x.id);
    expect(idsP1).toEqual([...idsP1].sort());
  });

  it('400 con porPagina fuera de rango', async () => {
    const e = await escenario();
    esperarError(
      await ctx.http.get('/reportes-demora').query({ paradaId: e.parada.id, porPagina: 101 }),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('el reloj se mueve: un reporte reciente deja de mostrarse a los 90 minutos', async () => {
    const e = await escenario();
    await crearReporte(ctx, { ...ids(e), usuarioId: pasajero.id, haceMinutos: 80 });
    const pedir = async () =>
      (await ctx.http.get('/reportes-demora').query({ paradaId: e.parada.id })).body.meta.total;
    expect(await pedir()).toBe(1);
    ctx.reloj.avanzar(11 * MIN);
    expect(await pedir()).toBe(0);
  });

  it('R17: la respuesta lleva la cabecera Date', async () => {
    const e = await escenario();
    const r = await ctx.http.get('/reportes-demora').query({ paradaId: e.parada.id });
    expect(r.headers.date).toBeTruthy();
  });
});

describe('Espec. §4 — POST /reportes-demora/:id/confirmaciones', () => {
  it('confirma: 201 con el reporte actualizado', async () => {
    const e = await escenario();
    const autor = await crearUsuario(ctx);
    const rep = await crearReporte(ctx, { ...ids(e), usuarioId: autor.id });
    const r = await ctx.http
      .post(`/reportes-demora/${rep.id}/confirmaciones`)
      .set(pasajero.auth)
      .expect(201);
    esperarContrato(r.body, 'ReporteDeDemora');
    expect(r.body.datos).toMatchObject({ id: rep.id, confirmaciones: 1 });
  });

  it('R15: una vez por persona; la segunda da 200 y no cuenta de nuevo', async () => {
    const e = await escenario();
    const autor = await crearUsuario(ctx);
    const rep = await crearReporte(ctx, { ...ids(e), usuarioId: autor.id });
    await ctx.http.post(`/reportes-demora/${rep.id}/confirmaciones`).set(pasajero.auth).expect(201);
    const r = await ctx.http
      .post(`/reportes-demora/${rep.id}/confirmaciones`)
      .set(pasajero.auth)
      .expect(200);
    expect(r.body.datos.confirmaciones).toBe(1);
    expect(
      await ctx.dataSource.getRepository(ConfirmacionDemoraEntidad).countBy({ reporteId: rep.id }),
    ).toBe(1);
  });

  it('R15: confirmaciones de varias personas se suman (también a la vez)', async () => {
    const e = await escenario();
    const autor = await crearUsuario(ctx);
    const rep = await crearReporte(ctx, { ...ids(e), usuarioId: autor.id });
    const personas = await Promise.all([1, 2, 3, 4].map(() => crearUsuario(ctx)));
    const rs = await Promise.all(
      personas.map((p) => ctx.http.post(`/reportes-demora/${rep.id}/confirmaciones`).set(p.auth)),
    );
    expect(rs.map((x) => x.status)).toEqual([201, 201, 201, 201]);
    const guardado = await ctx.dataSource
      .getRepository(ReporteDemoraEntidad)
      .findOneByOrFail({ id: rep.id });
    expect(guardado.confirmaciones).toBe(4);
    const lista = await ctx.http.get('/reportes-demora').query({ paradaId: e.parada.id });
    expect(lista.body.datos[0].confirmaciones).toBe(4);
  });

  it('R15: el mismo pasajero dos veces a la vez cuenta una sola', async () => {
    const e = await escenario();
    const autor = await crearUsuario(ctx);
    const rep = await crearReporte(ctx, { ...ids(e), usuarioId: autor.id });
    const pedir = () =>
      ctx.http.post(`/reportes-demora/${rep.id}/confirmaciones`).set(pasajero.auth);
    const [a, b] = await Promise.all([pedir(), pedir()]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(
      (await ctx.dataSource.getRepository(ReporteDemoraEntidad).findOneByOrFail({ id: rep.id }))
        .confirmaciones,
    ).toBe(1);
  });

  it('CONFIRMACION_PROPIA (422)', async () => {
    const e = await escenario();
    const rep = await crearReporte(ctx, { ...ids(e), usuarioId: pasajero.id });
    esperarError(
      await ctx.http.post(`/reportes-demora/${rep.id}/confirmaciones`).set(pasajero.auth),
      422,
      'CONFIRMACION_PROPIA',
    );
  });

  it('R14: REPORTE_VENCIDO (422) pasados los 90 minutos, y a los 90 todavía se puede', async () => {
    const e = await escenario();
    const autor = await crearUsuario(ctx);
    const viejo = await crearReporte(ctx, { ...ids(e), usuarioId: autor.id, haceMinutos: 91 });
    const justo = await crearReporte(ctx, { ...ids(e), usuarioId: autor.id, haceMinutos: 90 });
    esperarError(
      await ctx.http.post(`/reportes-demora/${viejo.id}/confirmaciones`).set(pasajero.auth),
      422,
      'REPORTE_VENCIDO',
    );
    await ctx.http
      .post(`/reportes-demora/${justo.id}/confirmaciones`)
      .set(pasajero.auth)
      .expect(201);
  });

  it('REPORTE_NO_ENCONTRADO (404), también con un id mal formado', async () => {
    esperarError(
      await ctx.http.post('/reportes-demora/rep-noexiste/confirmaciones').set(pasajero.auth),
      404,
      'REPORTE_NO_ENCONTRADO',
    );
    esperarError(
      await ctx.http.post('/reportes-demora/xyz/confirmaciones').set(pasajero.auth),
      404,
      'REPORTE_NO_ENCONTRADO',
    );
  });

  it('401 sin token', async () => {
    esperarError(
      await ctx.http.post('/reportes-demora/rep-abc/confirmaciones'),
      401,
      'NO_AUTENTICADO',
    );
  });
});

describe('Espec. §4 — GET /reportes-demora/resumen (Dirección)', () => {
  it('401 sin token y 403 siendo pasajero', async () => {
    esperarError(await ctx.http.get('/reportes-demora/resumen'), 401, 'NO_AUTENTICADO');
    esperarError(
      await ctx.http.get('/reportes-demora/resumen').set(pasajero.auth),
      403,
      'SIN_PERMISO',
    );
  });

  it('agrupa por línea (por defecto) con cantidad, confirmaciones y último', async () => {
    const e = await escenario();
    const a = await crearUsuario(ctx);
    await crearReporte(ctx, {
      ...ids(e),
      usuarioId: a.id,
      haceMinutos: 60,
      confirmaronIds: [pasajero.id, direccion.id],
    });
    await crearReporte(ctx, {
      ...ids(e),
      usuarioId: a.id,
      haceMinutos: 20,
      confirmaronIds: [pasajero.id],
    });
    const r = await ctx.http
      .get('/reportes-demora/resumen')
      .set(direccion.auth)
      .query({ desde: iso(hace(120)) })
      .expect(200);
    esperarContrato(r.body, 'ResumenDemoras');
    const mio = r.body.datos.find((x: { lineaId: string }) => x.lineaId === e.linea.id);
    expect(mio).toEqual({
      lineaId: e.linea.id,
      paradaId: null,
      cantidad: 2,
      confirmaciones: 3,
      ultimo: '2026-09-19T10:10:00-03:00',
    });
  });

  it('agrupa por parada y filtra por desde y hasta (incluidos)', async () => {
    const e = await escenario();
    const a = await crearUsuario(ctx);
    await crearReporte(ctx, { ...ids(e), usuarioId: a.id, haceMinutos: 300 });
    await crearReporte(ctx, { ...ids(e), usuarioId: a.id, haceMinutos: 200 });
    await crearReporte(ctx, { ...ids(e), usuarioId: a.id, haceMinutos: 100 });
    const r = await ctx.http
      .get('/reportes-demora/resumen')
      .set(direccion.auth)
      .query({ agrupar: 'parada', desde: iso(hace(250)), hasta: iso(hace(100)) })
      .expect(200);
    esperarContrato(r.body, 'ResumenDemoras');
    const mio = r.body.datos.filter((x: { lineaId: string }) => x.lineaId === e.linea.id);
    expect(mio).toEqual([expect.objectContaining({ paradaId: e.parada.id, cantidad: 2 })]);
  });

  it('sin reportes en el rango: lista vacía', async () => {
    const r = await ctx.http
      .get('/reportes-demora/resumen')
      .set(direccion.auth)
      .query({ desde: '2020-01-01T00:00:00-03:00', hasta: '2020-01-02T00:00:00-03:00' })
      .expect(200);
    expect(r.body).toEqual({ datos: [], meta: { total: 0, pagina: 1, porPagina: 20 } });
  });

  it.each([
    ['agrupar inválido', { agrupar: 'hora' }],
    ['desde sin zona', { desde: '2026-09-01T00:00:00' }],
    [
      'hasta anterior a desde',
      { desde: '2026-09-02T00:00:00-03:00', hasta: '2026-09-01T00:00:00-03:00' },
    ],
  ])('400: %s', async (_n, q) => {
    esperarError(
      await ctx.http.get('/reportes-demora/resumen').set(direccion.auth).query(q),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('pagina el resumen', async () => {
    const r = await ctx.http
      .get('/reportes-demora/resumen')
      .set(direccion.auth)
      .query({ porPagina: 1 })
      .expect(200);
    expect(r.body.meta.porPagina).toBe(1);
    expect(r.body.datos.length).toBeLessThanOrEqual(1);
  });
});
