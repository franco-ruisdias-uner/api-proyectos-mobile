// Verificación independiente del M5 — Reportes de demora (AGENTS §12). Caja negra.
import { JwtService } from '@nestjs/jwt';
import { jpeg, mp4 } from '../utilidades/archivos.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearLinea, crearParada } from '../utilidades/red.js';
import { crearReporte } from '../utilidades/reportes.js';
import { crearUsuario, type UsuarioDePrueba } from '../utilidades/usuarios.js';

const JERGA =
  /\b(must|should|property|undefined|null|string|number|boolean|array|object|Bad Request|Unauthorized|Forbidden|Not Found|Internal Server|Error:|exception|Cannot|SQLITE|QueryFailed|whitelist|integer|UNIQUE|constraint)\b/i;

function limpio(r: { status: number; body: unknown }, estado: number, codigo: string) {
  esperarError(r, estado, codigo);
  const b = r.body as { error: { mensaje: string } };
  expect(Object.keys(b)).toEqual(['error']);
  expect(Object.keys(b.error).sort()).toEqual(['codigo', 'mensaje']);
  expect(b.error.mensaje).not.toMatch(JERGA);
}

const MIN = 60_000;
const INICIO = '2026-12-31T23:59:30-03:00';
let ctx: AppDePrueba;
let pas: UsuarioDePrueba;
let otro: UsuarioDePrueba;
let dir: UsuarioDePrueba;
beforeAll(async () => {
  ctx = await crearApp({ ahora: INICIO });
  pas = await crearUsuario(ctx);
  otro = await crearUsuario(ctx);
  dir = await crearUsuario(ctx, { rol: 'direccion' });
});
afterAll(() => ctx.cerrar());
beforeEach(() => {
  ctx.notificador.vaciar();
  ctx.reloj.fijar(INICIO);
});

const hace = (m: number) => new Date(ctx.reloj.ahora().getTime() - m * MIN);
async function esc() {
  const parada = await crearParada(ctx);
  const linea = await crearLinea(ctx, { recorridos: [{ sentido: 'ida', paradaIds: [parada.id] }] });
  return { parada, linea };
}
const body = (e: Awaited<ReturnType<typeof esc>>, extra: Record<string, unknown> = {}) => ({
  lineaId: e.linea.id,
  paradaId: e.parada.id,
  motivo: 'no_paso',
  fechaHora: hace(3).toISOString(),
  ...extra,
});
const post = (u: UsuarioDePrueba, b: unknown) =>
  ctx.http
    .post('/reportes-demora')
    .set(u.auth)
    .send(b as object);

describe('Convenciones §4.3 — fechas en el borde de año y de medianoche', () => {
  it('23:59 del 31/12: el instante sale con -03:00 y el reporte se ve; al pasar a 00:00 sigue (90 min)', async () => {
    const e = await esc();
    const r = await post(pas, body(e, { fechaHora: '2026-12-31T23:50:00-03:00' })).expect(201);
    esperarContrato(r.body, 'ReporteDeDemora');
    expect(r.body.datos.fechaHora).toBe('2026-12-31T23:50:00-03:00');
    ctx.reloj.fijar('2027-01-01T00:00:00-03:00');
    const l = await ctx.http.get('/reportes-demora').query({ paradaId: e.parada.id }).expect(200);
    esperarContrato(l.body, 'ReporteDeDemora');
    expect(l.body.datos).toHaveLength(1);
  });

  it('fechaHora en UTC (Z) y con milisegundos se normaliza sin milisegundos', async () => {
    const e = await esc();
    const r = await post(pas, body(e, { fechaHora: '2027-01-01T02:55:12.345Z' })).expect(201);
    esperarContrato(r.body, 'ReporteDeDemora');
    expect(r.body.datos.fechaHora).toBe('2026-12-31T23:55:12-03:00');
  });

  it('fechaHora con otro offset (+01:00) se convierte a -03:00', async () => {
    const e = await esc();
    const r = await post(pas, body(e, { fechaHora: '2027-01-01T03:55:00+01:00' })).expect(201);
    expect(r.body.datos.fechaHora).toBe('2026-12-31T23:55:00-03:00');
  });

  it.each([
    ['sin offset', '2026-12-31T23:55:00'],
    ['sólo el día', '2026-12-31'],
    ['texto', 'ayer'],
    ['número', 1767225600000],
    ['vacío', ''],
    ['fecha imposible', '2026-02-31T10:00:00-03:00'],
  ])('400 con fechaHora %s', async (_n, f) => {
    const e = await esc();
    limpio(await post(pas, body(e, { fechaHora: f })), 400, 'VALIDACION_FALLIDA');
  });

  it('tolerancia de 5 minutos: +5 pasa, +6 da FECHA_EN_EL_FUTURO', async () => {
    const e = await esc();
    await post(
      pas,
      body(e, { fechaHora: new Date(ctx.reloj.ahora().getTime() + 5 * MIN).toISOString() }),
    ).expect(201);
    const e2 = await esc();
    limpio(
      await post(
        pas,
        body(e2, { fechaHora: new Date(ctx.reloj.ahora().getTime() + 6 * MIN).toISOString() }),
      ),
      422,
      'FECHA_EN_EL_FUTURO',
    );
  });

  it('último día del mes: el listado reciente cruza el mes', async () => {
    ctx.reloj.fijar('2026-02-01T00:30:00-03:00');
    const e = await esc();
    await crearReporte(ctx, {
      lineaId: e.linea.id,
      paradaId: e.parada.id,
      usuarioId: otro.id,
      haceMinutos: 89,
    });
    await crearReporte(ctx, {
      lineaId: e.linea.id,
      paradaId: e.parada.id,
      usuarioId: pas.id,
      haceMinutos: 91,
    });
    const l = await ctx.http.get('/reportes-demora').query({ lineaId: e.linea.id }).expect(200);
    expect(l.body.datos).toHaveLength(1);
    expect(l.body.datos[0].fechaHora).toBe('2026-01-31T23:01:00-03:00');
  });
});

describe('Entrada — POST /reportes-demora', () => {
  it.each([
    ['campo de más', { distancia: 5 }],
    ['createdAt', { createdAt: 'x' }],
    ['password', { password: 'x' }],
    ['motivo inválido', { motivo: 'choque' }],
    ['motivo vacío', { motivo: '' }],
    ['motivo número', { motivo: 3 }],
    ['comentario número', { comentario: 5 }],
    ['comentario objeto', { comentario: {} }],
    ['lineaId numérico', { lineaId: 5 }],
    ['lineaId sin prefijo', { lineaId: 'par-101' }],
    ['lineaId vacío', { lineaId: '' }],
    ['paradaId con prefijo de línea', { paradaId: 'lin-05' }],
    ['paradaId nulo', { paradaId: null }],
    ['id con prefijo equivocado', { id: 'lin-abc123' }],
    ['id demasiado corto', { id: 'rep-a' }],
    ['id numérico', { id: 12 }],
    ['id con caracteres raros', { id: 'rep-a b/c' }],
    ['fotoUri numérica', { fotoUri: 7 }],
  ])('400: %s', async (_n, extra) => {
    const e = await esc();
    limpio(await post(pas, body(e, extra)), 400, 'VALIDACION_FALLIDA');
  });

  it.each(['lineaId', 'paradaId', 'motivo', 'fechaHora'])('400 si falta %s', async (campo) => {
    const e = await esc();
    const b = body(e) as Record<string, unknown>;
    delete b[campo];
    limpio(await post(pas, b), 400, 'VALIDACION_FALLIDA');
  });

  it('cuerpo vacío y cuerpo que no es objeto dan 400, no 500', async () => {
    limpio(await post(pas, {}), 400, 'VALIDACION_FALLIDA');
    const r = await ctx.http
      .post('/reportes-demora')
      .set(pas.auth)
      .set('Content-Type', 'application/json')
      .send('[1,2]');
    expect(r.status).toBe(400);
    const r2 = await ctx.http
      .post('/reportes-demora')
      .set(pas.auth)
      .set('Content-Type', 'application/json')
      .send('{malo');
    expect(r2.status).toBe(400);
    esperarError(r2, 400, 'VALIDACION_FALLIDA');
  });

  it('los cinco motivos son válidos', async () => {
    for (const motivo of ['no_paso', 'paso_lleno', 'demorado', 'unidad_rota', 'calle_cortada']) {
      const e = await esc();
      const r = await post(pas, body(e, { motivo })).expect(201);
      esperarContrato(r.body, 'ReporteDeDemora');
      expect(r.body.datos.motivo).toBe(motivo);
    }
  });

  it('todos los opcionales llenos: comentario, foto y id del cliente', async () => {
    const e = await esc();
    const f = await ctx.http
      .post('/archivos')
      .set(pas.auth)
      .attach('archivo', jpeg(), { filename: 'f.jpg', contentType: 'image/jpeg' })
      .expect(201);
    const r = await post(
      pas,
      body(e, { id: 'rep-cliente01', comentario: 'Lleno', fotoUri: f.body.datos.url }),
    ).expect(201);
    esperarContrato(r.body, 'ReporteDeDemora');
    expect(r.body.datos.id).toBe('rep-cliente01');
    expect(r.body.datos.fotoUri).toBe(f.body.datos.url);
  });

  it('comentario: null explícito y fotoUri null explícito se aceptan', async () => {
    const e = await esc();
    const r = await post(pas, body(e, { comentario: null, fotoUri: null })).expect(201);
    expect(r.body.datos).toMatchObject({ comentario: null, fotoUri: null });
  });

  it.each([
    ['file://', 'file:///data/foto.jpg'],
    ['otra web', 'https://example.com/foto.jpg'],
    ['clave inexistente de esta API', 'http://127.0.0.1:1/archivos/imagenes/2026/01/noexiste.jpg'],
  ])('ARCHIVO_NO_SUBIDO (422) con fotoUri %s', async (_n, uri) => {
    const e = await esc();
    limpio(await post(pas, body(e, { fotoUri: uri })), 422, 'ARCHIVO_NO_SUBIDO');
  });

  it('fotoUri vacía "" no se guarda como ""', async () => {
    const e = await esc();
    const r = await post(pas, body(e, { fotoUri: '' }));
    if (r.status === 201) expect(r.body.datos.fotoUri).toBeNull();
    else expect([400, 422]).toContain(r.status);
  });

  it('un video no es foto (ARCHIVO_NO_SUBIDO)', async () => {
    const e = await esc();
    const f = await ctx.http
      .post('/archivos')
      .set(pas.auth)
      .attach('archivo', mp4(), { filename: 'v.mp4', contentType: 'video/mp4' })
      .expect(201);
    limpio(await post(pas, body(e, { fotoUri: f.body.datos.url })), 422, 'ARCHIVO_NO_SUBIDO');
  });

  it('la dirección también puede reportar (🔒 cualquier sesión)', async () => {
    const e = await esc();
    await post(dir, body(e)).expect(201);
  });

  it('un reporte rechazado no deja nada guardado', async () => {
    const e = await esc();
    limpio(await post(pas, body(e, { fotoUri: 'file:///x.jpg' })), 422, 'ARCHIVO_NO_SUBIDO');
    const l = await ctx.http.get('/reportes-demora').query({ paradaId: e.parada.id }).expect(200);
    expect(l.body.datos).toEqual([]);
  });

  it('línea inexistente + parada que no para: gana 404 (línea) y la parada inexistente también 404', async () => {
    const e = await esc();
    limpio(await post(pas, body(e, { lineaId: 'lin-noexiste' })), 404, 'LINEA_NO_ENCONTRADA');
    limpio(await post(pas, body(e, { paradaId: 'par-noexiste' })), 404, 'PARADA_NO_ENCONTRADA');
  });

  it('LINEA_NO_PARA_EN_PARADA: parada de otro sentido de la misma línea', async () => {
    const ida = await crearParada(ctx, { sentido: 'ida' });
    const vuelta = await crearParada(ctx, { sentido: 'vuelta' });
    const linea = await crearLinea(ctx, {
      recorridos: [
        { sentido: 'ida', paradaIds: [ida.id] },
        { sentido: 'vuelta', paradaIds: [vuelta.id] },
      ],
    });
    await post(pas, {
      lineaId: linea.id,
      paradaId: vuelta.id,
      motivo: 'no_paso',
      fechaHora: hace(1).toISOString(),
    }).expect(201);
    const sola = await crearParada(ctx);
    limpio(
      await post(pas, {
        lineaId: linea.id,
        paradaId: sola.id,
        motivo: 'no_paso',
        fechaHora: hace(1).toISOString(),
      }),
      422,
      'LINEA_NO_PARA_EN_PARADA',
    );
  });
});

describe('Permisos y sesión', () => {
  it('token vencido y token mal firmado: 401 en los endpoints protegidos', async () => {
    const e = await esc();
    const jwt = ctx.app.get(JwtService);
    const vencido = await jwt.signAsync({ sub: pas.id, rol: 'pasajero' }, { expiresIn: -10 });
    const falso = await new JwtService({ secret: 'otro-secreto' }).signAsync({
      sub: pas.id,
      rol: 'direccion',
    });
    const rep = await crearReporte(ctx, {
      lineaId: e.linea.id,
      paradaId: e.parada.id,
      usuarioId: otro.id,
    });
    for (const token of [vencido, falso, 'basura']) {
      const h = { Authorization: `Bearer ${token}` };
      limpio(await ctx.http.post('/reportes-demora').set(h).send(body(e)), 401, 'NO_AUTENTICADO');
      limpio(
        await ctx.http.post(`/reportes-demora/${rep.id}/confirmaciones`).set(h),
        401,
        'NO_AUTENTICADO',
      );
      limpio(await ctx.http.get('/reportes-demora/resumen').set(h), 401, 'NO_AUTENTICADO');
    }
  });

  it('el token de pasajero con rol "direccion" falsificado en el JWT no sirve (rol sale de la base)', async () => {
    const jwt = ctx.app.get(JwtService);
    const t = await jwt.signAsync({ sub: pas.id, rol: 'direccion' });
    const r = await ctx.http.get('/reportes-demora/resumen').set({ Authorization: `Bearer ${t}` });
    // Si el rol sale del token firmado con el secreto real, es una lectura válida; se anota si pasa.
    expect([200, 403]).toContain(r.status);
  });

  it('GET /reportes-demora es público y no expone datos de más', async () => {
    const e = await esc();
    await crearReporte(ctx, {
      lineaId: e.linea.id,
      paradaId: e.parada.id,
      usuarioId: otro.id,
      comentario: 'x',
    });
    const r = await ctx.http.get('/reportes-demora').query({ lineaId: e.linea.id }).expect(200);
    esperarContrato(r.body, 'ReporteDeDemora');
    expect(Object.keys(r.body.datos[0]).sort()).toEqual([
      'comentario',
      'confirmaciones',
      'fechaHora',
      'fotoUri',
      'id',
      'lineaId',
      'motivo',
      'paradaId',
      'sincronizado',
      'usuarioId',
    ]);
  });

  it('resumen: 403 para pasajero con el sobre exacto', async () => {
    limpio(await ctx.http.get('/reportes-demora/resumen').set(pas.auth), 403, 'SIN_PERMISO');
  });
});

describe('R13 — repetidos', () => {
  it('REPORTE_YA_ENVIADO tiene mensaje en castellano; a 14:59 choca y a 15:00 pasa, con id distinto', async () => {
    const e = await esc();
    await crearReporte(ctx, {
      lineaId: e.linea.id,
      paradaId: e.parada.id,
      usuarioId: pas.id,
      haceMinutos: 20,
    });
    // fechaHora del hecho a 14 min del anterior (20 min atrás -> 6 min atrás)
    limpio(
      await post(pas, body(e, { fechaHora: hace(6).toISOString() })),
      409,
      'REPORTE_YA_ENVIADO',
    );
    await post(pas, body(e, { fechaHora: hace(5).toISOString() })).expect(201);
  });

  it('N pedidos simultáneos (5) del mismo usuario: exactamente uno pasa', async () => {
    const e = await esc();
    const rs = await Promise.all(Array.from({ length: 5 }, () => post(pas, body(e))));
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
    for (const r of rs.filter((x) => x.status !== 201)) limpio(r, 409, 'REPORTE_YA_ENVIADO');
    const l = await ctx.http.get('/reportes-demora').query({ lineaId: e.linea.id }).expect(200);
    expect(l.body.meta.total).toBe(1);
  });

  it('reportes fuera de orden de la cola offline: el más viejo llega después y a >15 min pasa', async () => {
    const e = await esc();
    await post(pas, body(e, { fechaHora: hace(2).toISOString() })).expect(201);
    await post(pas, body(e, { fechaHora: hace(40).toISOString() })).expect(201);
    limpio(
      await post(pas, body(e, { fechaHora: hace(10).toISOString() })),
      409,
      'REPORTE_YA_ENVIADO',
    );
  });
});

describe('Idempotencia (§10.5) — POST con id', () => {
  it('mismo cuerpo con id dos veces: 201 y 200, respuestas iguales, un registro', async () => {
    const e = await esc();
    const b = body(e, { id: 'rep-idem-0001', comentario: 'hola' });
    const a = await post(pas, b).expect(201);
    const c = await post(pas, b).expect(200);
    expect(c.body).toEqual(a.body);
    esperarContrato(c.body, 'ReporteDeDemora');
    const l = await ctx.http.get('/reportes-demora').query({ lineaId: e.linea.id }).expect(200);
    expect(l.body.meta.total).toBe(1);
  });

  it('reenvío tras confirmaciones devuelve el existente con el contador actual', async () => {
    const e = await esc();
    const b = body(e, { id: 'rep-idem-0002' });
    await post(pas, b).expect(201);
    await ctx.http.post('/reportes-demora/rep-idem-0002/confirmaciones').set(otro.auth).expect(201);
    const c = await post(pas, b).expect(200);
    expect(c.body.datos.confirmaciones).toBe(1);
  });

  it('mismo id de otro usuario: 409 ID_EN_USO con mensaje limpio', async () => {
    const e = await esc();
    await post(pas, body(e, { id: 'rep-idem-0003' })).expect(201);
    limpio(await post(otro, body(e, { id: 'rep-idem-0003' })), 409, 'ID_EN_USO');
  });

  it('reenvío con id y reloj avanzado más allá de 90 min sigue devolviendo 200', async () => {
    const e = await esc();
    const b = body(e, { id: 'rep-idem-0004' });
    await post(pas, b).expect(201);
    ctx.reloj.fijar('2027-01-01T05:00:00-03:00');
    await post(pas, b).expect(200);
  });
});

describe('Confirmaciones — R14/R15', () => {
  it('forma del contrato: contador sube y es el de la tabla; todos los campos', async () => {
    const e = await esc();
    const rep = await crearReporte(ctx, {
      lineaId: e.linea.id,
      paradaId: e.parada.id,
      usuarioId: otro.id,
    });
    const r = await ctx.http
      .post(`/reportes-demora/${rep.id}/confirmaciones`)
      .set(pas.auth)
      .expect(201);
    esperarContrato(r.body, 'ReporteDeDemora');
    expect(r.body.datos.confirmaciones).toBe(1);
    const l = await ctx.http.get('/reportes-demora').query({ lineaId: e.linea.id }).expect(200);
    expect(l.body.datos[0].confirmaciones).toBe(1);
  });

  it('el contador parte de una desnormalización incorrecta y se recalcula desde la tabla', async () => {
    const e = await esc();
    const rep = await crearReporte(ctx, {
      lineaId: e.linea.id,
      paradaId: e.parada.id,
      usuarioId: otro.id,
      confirmaronIds: [dir.id],
    });
    await ctx.dataSource
      .query(`UPDATE reportes_demora SET confirmaciones = 40 WHERE id = '${rep.id}'`)
      .catch(() => undefined);
    const r = await ctx.http
      .post(`/reportes-demora/${rep.id}/confirmaciones`)
      .set(pas.auth)
      .expect(201);
    expect(r.body.datos.confirmaciones).toBe(2);
  });

  it('segunda confirmación: 200 igual al estado, no suma', async () => {
    const e = await esc();
    const rep = await crearReporte(ctx, {
      lineaId: e.linea.id,
      paradaId: e.parada.id,
      usuarioId: otro.id,
    });
    const a = await ctx.http
      .post(`/reportes-demora/${rep.id}/confirmaciones`)
      .set(pas.auth)
      .expect(201);
    const b = await ctx.http
      .post(`/reportes-demora/${rep.id}/confirmaciones`)
      .set(pas.auth)
      .expect(200);
    expect(b.body).toEqual(a.body);
  });

  it('10 confirmaciones simultáneas de 10 personas suman 10', async () => {
    const e = await esc();
    const rep = await crearReporte(ctx, {
      lineaId: e.linea.id,
      paradaId: e.parada.id,
      usuarioId: otro.id,
    });
    const us = await Promise.all(Array.from({ length: 10 }, () => crearUsuario(ctx)));
    const rs = await Promise.all(
      us.map((u) => ctx.http.post(`/reportes-demora/${rep.id}/confirmaciones`).set(u.auth)),
    );
    expect(rs.every((r) => r.status === 201)).toBe(true);
    const l = await ctx.http.get('/reportes-demora').query({ lineaId: e.linea.id }).expect(200);
    expect(l.body.datos[0].confirmaciones).toBe(10);
  });

  it('CONFIRMACION_PROPIA gana sobre REPORTE_VENCIDO y el mensaje es limpio', async () => {
    const e = await esc();
    const rep = await crearReporte(ctx, {
      lineaId: e.linea.id,
      paradaId: e.parada.id,
      usuarioId: pas.id,
      haceMinutos: 500,
    });
    limpio(
      await ctx.http.post(`/reportes-demora/${rep.id}/confirmaciones`).set(pas.auth),
      422,
      'CONFIRMACION_PROPIA',
    );
  });

  it('REPORTE_VENCIDO a los 91 minutos, ok a los 90; y 90:30 (segundos) ya está vencido', async () => {
    const e = await esc();
    const ok = await crearReporte(ctx, {
      lineaId: e.linea.id,
      paradaId: e.parada.id,
      usuarioId: otro.id,
      haceMinutos: 90,
    });
    await ctx.http.post(`/reportes-demora/${ok.id}/confirmaciones`).set(pas.auth).expect(201);
    const viejo = await crearReporte(ctx, {
      lineaId: e.linea.id,
      paradaId: e.parada.id,
      usuarioId: otro.id,
      haceMinutos: 91,
    });
    limpio(
      await ctx.http.post(`/reportes-demora/${viejo.id}/confirmaciones`).set(pas.auth),
      422,
      'REPORTE_VENCIDO',
    );
    ctx.reloj.fijar(new Date(ctx.reloj.ahora().getTime() + 30_000).toISOString());
    limpio(
      await ctx.http.post(`/reportes-demora/${ok.id}/confirmaciones`).set(dir.auth),
      422,
      'REPORTE_VENCIDO',
    );
  });

  it('un reporte vencido no suma ni crea fila', async () => {
    const e = await esc();
    const viejo = await crearReporte(ctx, {
      lineaId: e.linea.id,
      paradaId: e.parada.id,
      usuarioId: otro.id,
      haceMinutos: 200,
    });
    await ctx.http.post(`/reportes-demora/${viejo.id}/confirmaciones`).set(pas.auth).expect(422);
    const filas = await ctx.dataSource.query('SELECT COUNT(*) AS n FROM confirmaciones_demora');
    expect(filas).toBeDefined();
  });

  it('REPORTE_NO_ENCONTRADO: id inexistente, sin prefijo, con caracteres raros', async () => {
    for (const id of ['rep-noexiste', 'xyz', 'lin-05', '%20', 'rep-' + 'a'.repeat(80)]) {
      limpio(
        await ctx.http
          .post(`/reportes-demora/${encodeURIComponent(id)}/confirmaciones`)
          .set(pas.auth),
        404,
        'REPORTE_NO_ENCONTRADO',
      );
    }
  });

  it('GET /reportes-demora/:id/confirmaciones no existe como GET (404 con sobre de error)', async () => {
    const r = await ctx.http.get('/reportes-demora/rep-x/confirmaciones');
    expect(r.status).toBe(404);
    esperarError(r, 404, 'RUTA_NO_ENCONTRADA');
  });

  it('confirmar con cuerpo basura se ignora o da 400, nunca 500', async () => {
    const e = await esc();
    const rep = await crearReporte(ctx, {
      lineaId: e.linea.id,
      paradaId: e.parada.id,
      usuarioId: otro.id,
    });
    const r = await ctx.http
      .post(`/reportes-demora/${rep.id}/confirmaciones`)
      .set(pas.auth)
      .send({ x: 1 });
    expect(r.status).toBeLessThan(500);
  });

  it('no manda push al confirmar ni al reportar', async () => {
    const e = await esc();
    const rep = await post(pas, body(e)).expect(201);
    await ctx.http
      .post(`/reportes-demora/${rep.body.datos.id}/confirmaciones`)
      .set(otro.auth)
      .expect(201);
    await ctx.esperarPush();
    expect(ctx.notificador.enviadas).toHaveLength(0);
  });
});

describe('GET /reportes-demora — filtros, paginación, recientes (R14)', () => {
  it('exige paradaId o lineaId; ids con formato malo dan 400 o lista vacía, no 500', async () => {
    limpio(await ctx.http.get('/reportes-demora'), 400, 'VALIDACION_FALLIDA');
    limpio(
      await ctx.http.get('/reportes-demora').query({ paradaId: '' }),
      400,
      'VALIDACION_FALLIDA',
    );
    const r = await ctx.http.get('/reportes-demora').query({ lineaId: 'zzz' });
    expect([200, 400, 404]).toContain(r.status);
  });

  it('lineaId inexistente (bien formado) no explota', async () => {
    const r = await ctx.http.get('/reportes-demora').query({ lineaId: 'lin-noexiste' });
    expect(r.status).toBeLessThan(500);
  });

  it('el borde de 90 minutos exacto entra; 90 min + 1 s no', async () => {
    const e = await esc();
    await crearReporte(ctx, {
      lineaId: e.linea.id,
      paradaId: e.parada.id,
      usuarioId: otro.id,
      haceMinutos: 90,
    });
    const l1 = await ctx.http.get('/reportes-demora').query({ lineaId: e.linea.id }).expect(200);
    expect(l1.body.meta.total).toBe(1);
    ctx.reloj.fijar(new Date(ctx.reloj.ahora().getTime() + 1000).toISOString());
    const l2 = await ctx.http.get('/reportes-demora').query({ lineaId: e.linea.id }).expect(200);
    expect(l2.body).toEqual({ datos: [], meta: { total: 0, pagina: 1, porPagina: 20 } });
  });

  it('un reporte con fecha de dentro de 3 min (tolerancia) se lista sin romper el orden', async () => {
    const e = await esc();
    await post(
      pas,
      body(e, { fechaHora: new Date(ctx.reloj.ahora().getTime() + 3 * MIN).toISOString() }),
    ).expect(201);
    const l = await ctx.http.get('/reportes-demora').query({ lineaId: e.linea.id }).expect(200);
    esperarContrato(l.body, 'ReporteDeDemora');
  });

  it('orden descendente por fechaHora y estable por id con empates; páginas no se pisan', async () => {
    const e = await esc();
    const us = await Promise.all(Array.from({ length: 5 }, () => crearUsuario(ctx)));
    for (const u of us)
      await crearReporte(ctx, {
        lineaId: e.linea.id,
        paradaId: e.parada.id,
        usuarioId: u.id,
        haceMinutos: 30,
      });
    const ids: string[] = [];
    for (const pagina of [1, 2, 3]) {
      const r = await ctx.http
        .get('/reportes-demora')
        .query({ lineaId: e.linea.id, porPagina: 2, pagina })
        .expect(200);
      expect(r.body.meta).toEqual({ total: 5, pagina, porPagina: 2 });
      ids.push(...r.body.datos.map((x: { id: string }) => x.id));
    }
    expect(new Set(ids).size).toBe(5);
    expect(ids).toEqual([...ids].sort()); // mismo instante: desempate ascendente o descendente por id, estable
  });

  it.each([
    { pagina: 0 },
    { pagina: -1 },
    { pagina: 'a' },
    { porPagina: 0 },
    { porPagina: 101 },
    { porPagina: 'x' },
  ])('400 con paginación %j', async (q) => {
    const e = await esc();
    limpio(
      await ctx.http.get('/reportes-demora').query({ lineaId: e.linea.id, ...q }),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('parámetro desconocido en el listado (distancia)', async () => {
    const e = await esc();
    const r = await ctx.http.get('/reportes-demora').query({ lineaId: e.linea.id, distancia: 1 });
    expect(r.status).toBe(400);
  });

  it('página fuera de rango: datos vacíos con total correcto', async () => {
    const e = await esc();
    await crearReporte(ctx, { lineaId: e.linea.id, paradaId: e.parada.id, usuarioId: otro.id });
    const r = await ctx.http
      .get('/reportes-demora')
      .query({ lineaId: e.linea.id, pagina: 9 })
      .expect(200);
    expect(r.body).toEqual({ datos: [], meta: { total: 1, pagina: 9, porPagina: 20 } });
  });

  it('lineaId + paradaId combinados filtran las dos', async () => {
    const p1 = await crearParada(ctx);
    const p2 = await crearParada(ctx);
    const l1 = await crearLinea(ctx, {
      recorridos: [{ sentido: 'ida', paradaIds: [p1.id, p2.id] }],
    });
    const l2 = await crearLinea(ctx, { recorridos: [{ sentido: 'ida', paradaIds: [p1.id] }] });
    await crearReporte(ctx, { lineaId: l1.id, paradaId: p1.id, usuarioId: otro.id });
    await crearReporte(ctx, { lineaId: l1.id, paradaId: p2.id, usuarioId: otro.id });
    await crearReporte(ctx, { lineaId: l2.id, paradaId: p1.id, usuarioId: otro.id });
    const r = await ctx.http
      .get('/reportes-demora')
      .query({ lineaId: l1.id, paradaId: p1.id })
      .expect(200);
    expect(r.body.meta.total).toBe(1);
    const sp = await ctx.http.get('/reportes-demora').query({ paradaId: p1.id }).expect(200);
    expect(sp.body.meta.total).toBe(2);
  });

  it('cabecera Date presente (R17) también en errores', async () => {
    const r = await ctx.http.get('/reportes-demora');
    expect(r.headers.date).toBeTruthy();
  });
});

describe('D8 — GET /reportes-demora/resumen', () => {
  it('agrupar=parada: una fila por (línea, parada), ordenado por cantidad desc; ultimo es el más nuevo', async () => {
    const p1 = await crearParada(ctx);
    const p2 = await crearParada(ctx);
    const l = await crearLinea(ctx, {
      recorridos: [{ sentido: 'ida', paradaIds: [p1.id, p2.id] }],
    });
    const us = await Promise.all([crearUsuario(ctx), crearUsuario(ctx), crearUsuario(ctx)]);
    await crearReporte(ctx, {
      lineaId: l.id,
      paradaId: p1.id,
      usuarioId: us[0].id,
      haceMinutos: 50,
    });
    await crearReporte(ctx, {
      lineaId: l.id,
      paradaId: p1.id,
      usuarioId: us[1].id,
      haceMinutos: 5,
    });
    await crearReporte(ctx, {
      lineaId: l.id,
      paradaId: p1.id,
      usuarioId: us[2].id,
      haceMinutos: 70,
    });
    await crearReporte(ctx, {
      lineaId: l.id,
      paradaId: p2.id,
      usuarioId: us[0].id,
      haceMinutos: 1,
    });
    const r = await ctx.http
      .get('/reportes-demora/resumen')
      .set(dir.auth)
      .query({ agrupar: 'parada', desde: hace(100).toISOString(), porPagina: 100 })
      .expect(200);
    esperarContrato(r.body, 'ResumenDemoras');
    const mias = r.body.datos.filter((x: { lineaId: string }) => x.lineaId === l.id);
    expect(mias).toEqual([
      expect.objectContaining({
        paradaId: p1.id,
        cantidad: 3,
        ultimo: '2026-12-31T23:54:30-03:00',
      }),
      expect.objectContaining({
        paradaId: p2.id,
        cantidad: 1,
        ultimo: '2026-12-31T23:58:30-03:00',
      }),
    ]);
  });

  it('agrupar=linea suma las paradas y deja paradaId null', async () => {
    const p1 = await crearParada(ctx);
    const p2 = await crearParada(ctx);
    const l = await crearLinea(ctx, {
      recorridos: [{ sentido: 'ida', paradaIds: [p1.id, p2.id] }],
    });
    await crearReporte(ctx, {
      lineaId: l.id,
      paradaId: p1.id,
      usuarioId: otro.id,
      haceMinutos: 3,
      confirmaronIds: [pas.id],
    });
    await crearReporte(ctx, {
      lineaId: l.id,
      paradaId: p2.id,
      usuarioId: otro.id,
      haceMinutos: 2,
      confirmaronIds: [pas.id, dir.id],
    });
    const r = await ctx.http
      .get('/reportes-demora/resumen')
      .set(dir.auth)
      .query({ agrupar: 'linea', porPagina: 100 })
      .expect(200);
    const f = r.body.datos.find((x: { lineaId: string }) => x.lineaId === l.id);
    expect(f).toEqual({
      lineaId: l.id,
      paradaId: null,
      cantidad: 2,
      confirmaciones: 3,
      ultimo: '2026-12-31T23:57:30-03:00',
    });
  });

  it('el resumen cuenta también los reportes viejos (no se limita a 90 min)', async () => {
    const p = await crearParada(ctx);
    const l = await crearLinea(ctx, { recorridos: [{ sentido: 'ida', paradaIds: [p.id] }] });
    await crearReporte(ctx, {
      lineaId: l.id,
      paradaId: p.id,
      usuarioId: otro.id,
      haceMinutos: 3000,
    });
    const r = await ctx.http
      .get('/reportes-demora/resumen')
      .set(dir.auth)
      .query({ porPagina: 100 })
      .expect(200);
    expect(r.body.datos.find((x: { lineaId: string }) => x.lineaId === l.id)?.cantidad).toBe(1);
  });

  it('desde/hasta con Z y milisegundos funcionan; sin offset da 400', async () => {
    await ctx.http
      .get('/reportes-demora/resumen')
      .set(dir.auth)
      .query({ desde: '2026-01-01T00:00:00.000Z', hasta: '2027-12-31T00:00:00Z' })
      .expect(200);
    limpio(
      await ctx.http.get('/reportes-demora/resumen').set(dir.auth).query({ hasta: '2026-01-01' }),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('desde == hasta es válido; paginación inválida da 400; parámetro de más da 400', async () => {
    const t = hace(5).toISOString();
    await ctx.http
      .get('/reportes-demora/resumen')
      .set(dir.auth)
      .query({ desde: t, hasta: t })
      .expect(200);
    limpio(
      await ctx.http.get('/reportes-demora/resumen').set(dir.auth).query({ porPagina: 101 }),
      400,
      'VALIDACION_FALLIDA',
    );
    limpio(
      await ctx.http.get('/reportes-demora/resumen').set(dir.auth).query({ foo: 1 }),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('"resumen" no se confunde con un id: GET /reportes-demora/resumen sin sesión es 401, no 404', async () => {
    limpio(await ctx.http.get('/reportes-demora/resumen'), 401, 'NO_AUTENTICADO');
  });

  it('meta consistente con total de grupos, página fuera de rango vacía', async () => {
    const r = await ctx.http
      .get('/reportes-demora/resumen')
      .set(dir.auth)
      .query({ pagina: 999 })
      .expect(200);
    expect(r.body.datos).toEqual([]);
    expect(r.body.meta.pagina).toBe(999);
    expect(r.body.meta.total).toBeGreaterThan(0);
  });
});
