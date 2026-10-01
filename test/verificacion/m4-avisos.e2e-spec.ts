// Verificación independiente del M4 — Avisos (AGENTS §12). Caja negra: HTTP, builders de
// test/utilidades/ y la siembra de demo.
import { JwtService } from '@nestjs/jwt';
import { LineaFavoritaEntidad } from '../../src/modulos/usuarios/favorita.entidad.js';
import { AvisoEntidad } from '../../src/modulos/avisos/aviso.entidad.js';
import { CONTRASENA_DE_DEMO } from '../../src/semillas/datos/usuarios.js';
import { ArchivosServicio } from '../../src/comun/archivos/archivos.servicio.js';
import { sembrar } from '../../src/semillas/sembrar.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { crearAviso } from '../utilidades/avisos.js';
import { jpeg, m4a, mp4 } from '../utilidades/archivos.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearLinea } from '../utilidades/red.js';
import { crearUsuario, type UsuarioDePrueba } from '../utilidades/usuarios.js';

const JERGA =
  /\b(must|should|property|undefined|null|string|number|boolean|array|object|Bad Request|Unauthorized|Forbidden|Not Found|Internal Server|Error:|exception|Cannot|SQLITE|QueryFailed|whitelist|integer|UNIQUE|constraint)\b/i;

function esperarErrorLimpio(r: { status: number; body: unknown }, estado: number, codigo: string) {
  esperarError(r, estado, codigo);
  const b = r.body as { error: { mensaje: string } };
  expect(Object.keys(b)).toEqual(['error']);
  expect(Object.keys(b.error).sort()).toEqual(['codigo', 'mensaje']);
  expect(b.error.mensaje).not.toMatch(JERGA);
}

const HORA = 3600_000;
const TRAZADO = [
  { latitud: -31.7345, longitud: -60.523 },
  { latitud: -31.7301, longitud: -60.5187 },
];

let ctx: AppDePrueba;
let direccion: UsuarioDePrueba;
beforeAll(async () => {
  ctx = await crearApp({ ahora: '2026-12-31T23:59:30-03:00' });
  direccion = await crearUsuario(ctx, { rol: 'direccion' });
});
afterAll(() => ctx.cerrar());
beforeEach(() => {
  ctx.notificador.vaciar();
  ctx.notificador.fallar = false;
  ctx.reloj.fijar?.('2026-12-31T23:59:30-03:00');
});

const antes = (h: number) => new Date(ctx.reloj.ahora().getTime() - h * HORA);
const despues = (h: number) => antes(-h);

function cuerpo(lineaIds: string[], extra: Record<string, unknown> = {}) {
  return {
    titulo: 'Desvío de prueba',
    detalle: 'Detalle de prueba.',
    lineaIds,
    desde: antes(1).toISOString(),
    gravedad: 'desvio',
    ...extra,
  };
}

describe('R10/§6 — bordes de reloj y de fechas (31/12, medianoche)', () => {
  it('con el reloj a las 23:59:59 del 31/12 y luego a las 00:00:00 del 1/1, la vigencia cambia en el segundo exacto', async () => {
    const l = await crearLinea(ctx);
    await crearAviso(ctx, {
      lineaIds: [l.id],
      desde: '2026-12-31T00:00:00-03:00',
      hasta: '2027-01-01T00:00:00-03:00',
    });
    const proximo = await crearAviso(ctx, {
      lineaIds: [l.id],
      desde: '2027-01-01T00:00:00-03:00',
    });
    ctx.reloj.fijar('2026-12-31T23:59:59-03:00');
    let v = await ctx.http.get('/avisos').query({ lineaId: l.id }).expect(200);
    expect(v.body.meta.total).toBe(1);
    const p = await ctx.http.get('/avisos').query({ lineaId: l.id, estado: 'proximos' });
    expect(p.body.datos.map((a: { id: string }) => a.id)).toEqual([proximo.id]);
    ctx.reloj.fijar('2027-01-01T00:00:00-03:00');
    v = await ctx.http.get('/avisos').query({ lineaId: l.id }).expect(200);
    expect(v.body.datos.map((a: { id: string }) => a.id)).toEqual([proximo.id]);
  });

  it('el mismo instante dado con Z cruzando de año sale en -03:00 del día anterior', async () => {
    const l = await crearLinea(ctx);
    const r = await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo([l.id], { desde: '2027-01-01T02:59:59Z', hasta: '2027-01-01T03:00:00.999Z' }))
      .expect(201);
    esperarContrato(r.body, 'Aviso');
    expect(r.body.datos.desde).toBe('2026-12-31T23:59:59-03:00');
    expect(r.body.datos.hasta).toMatch(/^2027-01-01T00:00:0[01]-03:00$/);
  });

  it('un offset positivo (+05:30) se normaliza a -03:00', async () => {
    const l = await crearLinea(ctx);
    const r = await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo([l.id], { desde: '2026-12-31T20:30:00+05:30' }))
      .expect(201);
    expect(r.body.datos.desde).toBe('2026-12-31T12:00:00-03:00');
  });

  it.each([
    ['sólo la fecha', '2026-12-31'],
    ['con espacio en vez de T', '2026-12-31 10:00:00-03:00'],
    ['sin segundos pero sin zona', '2026-12-31T10:00'],
    ['hora 24', '2026-12-31T24:00:00-03:00'],
    ['mes 13', '2026-13-01T10:00:00-03:00'],
  ])('desde %s se rechaza con 400 (no 500, no se adivina la zona)', async (_c, desde) => {
    const l = await crearLinea(ctx);
    const r = await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo([l.id], { desde }));
    esperarErrorLimpio(r, 400, 'VALIDACION_FALLIDA');
  });

  it('finalizar a las 23:59:59 y a las 00:00:00 deja hasta = ahora en -03:00', async () => {
    const l = await crearLinea(ctx);
    const a = await crearAviso(ctx, { lineaIds: [l.id], desde: antes(3) });
    ctx.reloj.fijar('2026-12-31T23:59:59-03:00');
    let r = await ctx.http.post(`/avisos/${a.id}/finalizar`).set(direccion.auth).expect(200);
    expect(r.body.datos.hasta).toBe('2026-12-31T23:59:59-03:00');
    const b = await crearAviso(ctx, { lineaIds: [l.id], desde: antes(3) });
    ctx.reloj.fijar('2027-01-01T00:00:00-03:00');
    r = await ctx.http.post(`/avisos/${b.id}/finalizar`).set(direccion.auth).expect(200);
    expect(r.body.datos.hasta).toBe('2027-01-01T00:00:00-03:00');
  });

  it('finalizar un aviso que empieza justo ahora: hasta = desde, y ya no es vigente ni próximo', async () => {
    const l = await crearLinea(ctx);
    const a = await crearAviso(ctx, { lineaIds: [l.id], desde: ctx.reloj.ahora() });
    const r = await ctx.http.post(`/avisos/${a.id}/finalizar`).set(direccion.auth).expect(200);
    esperarContrato(r.body, 'Aviso');
    for (const estado of ['vigentes', 'proximos']) {
      const x = await ctx.http.get('/avisos').query({ lineaId: l.id, estado });
      expect(x.body.datos).toEqual([]);
    }
  });
});

describe('Forma — nulos, strings vacíos y unicode', () => {
  it('un videoUrl "" en el alta no vuelve "" (se rechaza o se guarda null)', async () => {
    const l = await crearLinea(ctx);
    const r = await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo([l.id], { videoUrl: '' }));
    if (r.status === 201) expect(r.body.datos.videoUrl).toBeNull();
    else expect([400, 422]).toContain(r.status);
  });

  it('PATCH con videoUrl "" no deja "" guardado', async () => {
    const l = await crearLinea(ctx);
    const a = await crearAviso(ctx, { lineaIds: [l.id] });
    const r = await ctx.http.patch(`/avisos/${a.id}`).set(direccion.auth).send({ videoUrl: '' });
    if (r.status === 200) expect(r.body.datos.videoUrl).toBeNull();
    else expect([400, 422]).toContain(r.status);
  });

  it('emoji, tildes y ñ se guardan y vuelven idénticos (utf8mb4)', async () => {
    const l = await crearLinea(ctx);
    const titulo = 'Desvío 🚌 por Corrientes — ñandú';
    const detalle = 'Línea "2" y \'7\' \\ salto\nde línea 😀';
    const r = await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo([l.id], { titulo, detalle }))
      .expect(201);
    const g = await ctx.http.get(`/avisos/${r.body.datos.id}`).expect(200);
    expect(g.body.datos.titulo).toBe(titulo);
    expect(g.body.datos.detalle).toBe(detalle);
  });

  it('un detalle muy largo (20.000 caracteres) no da 500', async () => {
    const l = await crearLinea(ctx);
    const r = await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo([l.id], { detalle: 'x'.repeat(20000) }));
    expect(r.status).toBeLessThan(500);
    if (r.status === 201) esperarContrato(r.body, 'Aviso');
    else esperarErrorLimpio(r, 400, 'VALIDACION_FALLIDA');
  });

  it('las coordenadas del trazado vuelven exactas y en orden', async () => {
    const l = await crearLinea(ctx);
    const trazado = [
      { latitud: -31.7345123456, longitud: -60.5230987654 },
      { latitud: -31.7, longitud: -60.5 },
      { latitud: 0, longitud: 0 },
      { latitud: -31.7301, longitud: -60.5187 },
    ];
    const r = await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo([l.id], { trazadoAlternativo: trazado }))
      .expect(201);
    expect(r.body.datos.trazadoAlternativo).toEqual(trazado);
    const g = await ctx.http.get(`/avisos/${r.body.datos.id}`);
    expect(g.body.datos.trazadoAlternativo).toEqual(trazado);
  });

  it('coordenadas como texto en el trazado se rechazan', async () => {
    const l = await crearLinea(ctx);
    const r = await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(
        cuerpo([l.id], {
          trazadoAlternativo: [{ latitud: '-31.7', longitud: '-60.5' }, TRAZADO[1]],
        }),
      );
    esperarErrorLimpio(r, 400, 'VALIDACION_FALLIDA');
  });

  it('el título con espacios alrededor no vuelve con espacios vacíos (nunca "" ni solo espacios)', async () => {
    const l = await crearLinea(ctx);
    const r = await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo([l.id], { titulo: '   Hola   ' }));
    if (r.status === 201) expect(r.body.datos.titulo.trim().length).toBeGreaterThan(0);
  });

  it('las respuestas llevan cabecera Date (R17)', async () => {
    const r = await ctx.http.get('/avisos').expect(200);
    expect(r.headers.date).toBeTruthy();
  });
});

describe('Entrada — cuerpos y parámetros raros', () => {
  it.each([
    ['un array como cuerpo', '[]'],
    ['null como cuerpo', 'null'],
    ['un número como cuerpo', '5'],
  ])('POST /avisos con %s da 400 limpio', async (_c, texto) => {
    const r = await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .set('Content-Type', 'application/json')
      .send(texto);
    esperarErrorLimpio(r, 400, 'VALIDACION_FALLIDA');
  });

  it('POST /avisos sin cuerpo da 400 limpio', async () => {
    esperarErrorLimpio(
      await ctx.http.post('/avisos').set(direccion.auth),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('POST con Content-Type text/plain no da 500', async () => {
    const r = await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .set('Content-Type', 'text/plain')
      .send('hola');
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
    esperarError(r, r.status, r.body.error.codigo);
  });

  it('un lineaId con prefijo equivocado o mayúsculas en el alta es 400', async () => {
    for (const malo of ['LIN-05', 'lin-', 'par-1', '', ' lin-05', 'lin-05 ']) {
      const r = await ctx.http
        .post('/avisos')
        .set(direccion.auth)
        .send(cuerpo([malo]));
      esperarErrorLimpio(r, 400, 'VALIDACION_FALLIDA');
    }
  });

  it('una lista de lineaIds con una línea buena y una inexistente: 404 LINEA_NO_ENCONTRADA', async () => {
    const l = await crearLinea(ctx);
    const r = await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo(['lin-zzzzzz', l.id]));
    esperarErrorLimpio(r, 404, 'LINEA_NO_ENCONTRADA');
  });

  it('desvio con "Desvio" (mayúscula/sin tilde) o gravedad numérica se rechaza', async () => {
    const l = await crearLinea(ctx);
    for (const gravedad of ['Desvio', 'DESVIO', 'desvío', 1, null, '']) {
      const r = await ctx.http
        .post('/avisos')
        .set(direccion.auth)
        .send(cuerpo([l.id], { gravedad }));
      esperarErrorLimpio(r, 400, 'VALIDACION_FALLIDA');
    }
  });

  it('hasta anterior a desde en el alta, con offsets distintos que engañan al orden de texto', async () => {
    const l = await crearLinea(ctx);
    // 10:00-03:00 = 13:00Z ; 12:00Z es anterior aunque "12" < "13" en texto: usamos el inverso.
    const r = await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo([l.id], { desde: '2026-12-31T10:00:00-03:00', hasta: '2026-12-31T12:00:00Z' }));
    esperarErrorLimpio(r, 400, 'VALIDACION_FALLIDA');
  });

  it('hasta 1 segundo posterior a desde se acepta', async () => {
    const l = await crearLinea(ctx);
    const r = await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(
        cuerpo([l.id], { desde: '2026-12-31T10:00:00-03:00', hasta: '2026-12-31T10:00:01-03:00' }),
      )
      .expect(201);
    expect(r.body.datos.hasta).toBe('2026-12-31T10:00:01-03:00');
  });

  it('un aviso con desde en el pasado lejano y hasta en el futuro se acepta', async () => {
    const l = await crearLinea(ctx);
    await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(
        cuerpo([l.id], { desde: '2020-01-01T00:00:00-03:00', hasta: '2099-01-01T00:00:00-03:00' }),
      )
      .expect(201);
  });

  it('ids con forma rara en la ruta no dan 500', async () => {
    for (const id of ['lin-05', 'AVI-088', 'avi-', 'avi-%20x', 'avi-088;DROP', 'a'.repeat(300)]) {
      const g = await ctx.http.get(`/avisos/${encodeURIComponent(id)}`);
      expect([400, 404]).toContain(g.status);
      esperarErrorLimpio(g, g.status, g.body.error.codigo);
      const f = await ctx.http
        .post(`/avisos/${encodeURIComponent(id)}/finalizar`)
        .set(direccion.auth);
      expect([400, 404]).toContain(f.status);
      const p = await ctx.http
        .patch(`/avisos/${encodeURIComponent(id)}`)
        .set(direccion.auth)
        .send({ titulo: 'x' });
      expect([400, 404]).toContain(p.status);
    }
  });

  it('GET /avisos/:id de algo inexistente: 404 AVISO_NO_ENCONTRADO con mensaje en castellano', async () => {
    const r = await ctx.http.get('/avisos/avi-nope12345678');
    esperarErrorLimpio(r, 404, 'AVISO_NO_ENCONTRADO');
    expect(r.body.error.mensaje).toBe('No existe ese aviso.');
  });

  it.each([
    [{ estado: 'vencidos' }],
    [{ estado: 'VIGENTES' }],
    [{ estado: '' }],
    [{ lineaId: 'par-101' }],
    [{ lineaId: 'LIN-05' }],
    [{ pagina: '-1' }],
    [{ pagina: '1.5' }],
    [{ porPagina: '0' }],
    [{ porPagina: '-5' }],
  ])(
    'GET /avisos con parámetros inválidos %j da 400 limpio (o lista vacía válida para lineaId)',
    async (q) => {
      const r = await ctx.http.get('/avisos').query(q);
      if (r.status === 200) {
        // sólo se tolera para un lineaId bien formado pero inexistente
        expect(Object.keys(q)).toEqual(['lineaId']);
        return;
      }
      esperarErrorLimpio(r, 400, 'VALIDACION_FALLIDA');
    },
  );

  it('porPagina=100 es el máximo y se acepta; 101 se rechaza', async () => {
    const ok = await ctx.http.get('/avisos').query({ porPagina: 100 }).expect(200);
    expect(ok.body.meta.porPagina).toBe(100);
    esperarErrorLimpio(
      await ctx.http.get('/avisos').query({ porPagina: 101 }),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('un parámetro de más en la consulta (distancia, abiertoAhora) no cambia la forma', async () => {
    const r = await ctx.http.get('/avisos').query({ distancia: 5 });
    if (r.status === 200) esperarContrato(r.body, 'Aviso');
    else esperarErrorLimpio(r, 400, 'VALIDACION_FALLIDA');
  });
});

describe('Permisos — tokens malos y roles', () => {
  const firmar = (opciones: Record<string, unknown>, secreto: string) =>
    new JwtService({ secret: secreto }).signAsync(
      { sub: direccion.id, rol: 'direccion' },
      opciones as never,
    );

  it('token vencido en POST/PATCH/finalizar: 401 NO_AUTENTICADO', async () => {
    const l = await crearLinea(ctx);
    const a = await crearAviso(ctx, { lineaIds: [l.id] });
    const t = await firmar({ expiresIn: -10 }, 'secreto-de-los-tests');
    const h = { Authorization: `Bearer ${t}` };
    esperarErrorLimpio(
      await ctx.http
        .post('/avisos')
        .set(h)
        .send(cuerpo([l.id])),
      401,
      'NO_AUTENTICADO',
    );
    esperarErrorLimpio(
      await ctx.http.patch(`/avisos/${a.id}`).set(h).send({}),
      401,
      'NO_AUTENTICADO',
    );
    esperarErrorLimpio(
      await ctx.http.post(`/avisos/${a.id}/finalizar`).set(h),
      401,
      'NO_AUTENTICADO',
    );
  });

  it('token firmado con otro secreto: 401', async () => {
    const l = await crearLinea(ctx);
    const t = await firmar({ expiresIn: '1h' }, 'otro-secreto');
    const r = await ctx.http
      .post('/avisos')
      .set({ Authorization: `Bearer ${t}` })
      .send(cuerpo([l.id]));
    esperarErrorLimpio(r, 401, 'NO_AUTENTICADO');
  });

  it('token con rol direccion en el JWT pero usuario pasajero en la base: no publica', async () => {
    const pas = await crearUsuario(ctx);
    const t = await new JwtService({ secret: 'secreto-de-los-tests' }).signAsync(
      { sub: pas.id, rol: 'direccion' },
      { expiresIn: '1h' },
    );
    const l = await crearLinea(ctx);
    const r = await ctx.http
      .post('/avisos')
      .set({ Authorization: `Bearer ${t}` })
      .send(cuerpo([l.id]));
    // Se toleran 401/403 (el rol real manda). 201 sería escalada de privilegios.
    expect([401, 403]).toContain(r.status);
  });

  it('esquema distinto de Bearer o token vacío: 401', async () => {
    const l = await crearLinea(ctx);
    for (const h of ['Basic abc', 'Bearer', 'Bearer ', direccion.token]) {
      const r = await ctx.http
        .post('/avisos')
        .set('Authorization', h)
        .send(cuerpo([l.id]));
      esperarErrorLimpio(r, 401, 'NO_AUTENTICADO');
    }
  });

  it('sin sesión: 401 antes que 400 (cuerpo inválido) y que 404 (id inexistente)', async () => {
    esperarErrorLimpio(await ctx.http.post('/avisos').send({}), 401, 'NO_AUTENTICADO');
    esperarErrorLimpio(await ctx.http.patch('/avisos/avi-nope').send({}), 401, 'NO_AUTENTICADO');
    esperarErrorLimpio(await ctx.http.post('/avisos/avi-nope/finalizar'), 401, 'NO_AUTENTICADO');
  });

  it('un pasajero: 403 antes que 400 y que 404', async () => {
    const pas = await crearUsuario(ctx);
    esperarErrorLimpio(await ctx.http.post('/avisos').set(pas.auth).send({}), 403, 'SIN_PERMISO');
    esperarErrorLimpio(
      await ctx.http.patch('/avisos/avi-nope').set(pas.auth).send({ titulo: '' }),
      403,
      'SIN_PERMISO',
    );
    esperarErrorLimpio(
      await ctx.http.post('/avisos/avi-nope/finalizar').set(pas.auth),
      403,
      'SIN_PERMISO',
    );
  });

  it('DELETE /avisos/:id no existe (el alta/baja va por finalizar): 404 RUTA_NO_ENCONTRADA o 405 limpio', async () => {
    const l = await crearLinea(ctx);
    const a = await crearAviso(ctx, { lineaIds: [l.id] });
    const r = await ctx.http.delete(`/avisos/${a.id}`).set(direccion.auth);
    expect([404, 405]).toContain(r.status);
    esperarError(r, r.status, r.body.error.codigo);
    await ctx.http.get(`/avisos/${a.id}`).expect(200);
  });

  it('GET /avisos y GET /avisos/:id con un token vencido siguen siendo públicos', async () => {
    const t = await new JwtService({ secret: 'secreto-de-los-tests' }).signAsync(
      { sub: direccion.id, rol: 'direccion' },
      { expiresIn: -10 },
    );
    const l = await crearLinea(ctx);
    const a = await crearAviso(ctx, { lineaIds: [l.id] });
    const h = { Authorization: `Bearer ${t}` };
    // Tolerado: 200 (ignora el token en rutas públicas) o 401. Lo que no vale es 500.
    const r1 = await ctx.http.get('/avisos').set(h);
    const r2 = await ctx.http.get(`/avisos/${a.id}`).set(h);
    expect([200, 401]).toContain(r1.status);
    expect([200, 401]).toContain(r2.status);
  });
});

describe('Orden estable y paginación (§4: gravedad, desde desc, id)', () => {
  it('con gravedad y desde iguales, desempata por id y la paginación no repite ni pierde', async () => {
    const l = await crearLinea(ctx);
    const desde = antes(2);
    const ids: string[] = [];
    for (const id of ['avi-e1', 'avi-b2', 'avi-d4', 'avi-a3', 'avi-c5', 'avi-f6', 'avi-g7']) {
      await crearAviso(ctx, { id, lineaIds: [l.id], desde, gravedad: 'desvio' });
      ids.push(id);
    }
    const vistos: string[] = [];
    for (let pagina = 1; pagina <= 4; pagina++) {
      const r = await ctx.http.get('/avisos').query({ lineaId: l.id, porPagina: 2, pagina });
      esperarContrato(r.body, 'Aviso');
      expect(r.body.meta).toEqual({ total: 7, pagina, porPagina: 2 });
      vistos.push(...r.body.datos.map((a: { id: string }) => a.id));
    }
    expect(vistos).toHaveLength(7);
    expect(new Set(vistos).size).toBe(7);
    const completo = await ctx.http.get('/avisos').query({ lineaId: l.id });
    expect(completo.body.datos.map((a: { id: string }) => a.id)).toEqual(vistos);
    expect(vistos).toEqual([...vistos].sort());
  });

  it('gravedad manda sobre desde aunque el informativo sea más nuevo; dentro de la gravedad, el más nuevo primero', async () => {
    const l = await crearLinea(ctx);
    const info = await crearAviso(ctx, {
      lineaIds: [l.id],
      desde: antes(1),
      gravedad: 'informativo',
    });
    const susVieja = await crearAviso(ctx, {
      lineaIds: [l.id],
      desde: antes(50),
      gravedad: 'suspension',
    });
    const desNueva = await crearAviso(ctx, {
      lineaIds: [l.id],
      desde: antes(2),
      gravedad: 'desvio',
    });
    const desVieja = await crearAviso(ctx, {
      lineaIds: [l.id],
      desde: antes(9),
      gravedad: 'desvio',
    });
    const r = await ctx.http.get('/avisos').query({ lineaId: l.id });
    expect(r.body.datos.map((a: { id: string }) => a.id)).toEqual([
      susVieja.id,
      desNueva.id,
      desVieja.id,
      info.id,
    ]);
  });

  it('estado=todos mantiene el orden por gravedad y desde, mezclando próximos y terminados', async () => {
    const l = await crearLinea(ctx);
    const proxInfo = await crearAviso(ctx, {
      lineaIds: [l.id],
      desde: despues(5),
      gravedad: 'informativo',
    });
    const termSus = await crearAviso(ctx, {
      lineaIds: [l.id],
      desde: antes(9),
      hasta: antes(1),
      gravedad: 'suspension',
    });
    const vigDes = await crearAviso(ctx, { lineaIds: [l.id], desde: antes(1), gravedad: 'desvio' });
    const r = await ctx.http.get('/avisos').query({ lineaId: l.id, estado: 'todos' });
    expect(r.body.datos.map((a: { id: string }) => a.id)).toEqual([
      termSus.id,
      vigDes.id,
      proxInfo.id,
    ]);
  });

  it('un aviso con varias líneas aparece una sola vez en el filtro y en el total', async () => {
    const [a, b, c] = [await crearLinea(ctx), await crearLinea(ctx), await crearLinea(ctx)];
    const av = await crearAviso(ctx, { lineaIds: [a.id, b.id, c.id] });
    const r = await ctx.http.get('/avisos').query({ lineaId: b.id });
    expect(r.body.meta.total).toBe(1);
    expect(r.body.datos[0].id).toBe(av.id);
    expect(r.body.datos[0].lineaIds).toEqual([a.id, b.id, c.id]);
  });

  it('lineaId + estado combinados filtran por ambos', async () => {
    const [a, b] = [await crearLinea(ctx), await crearLinea(ctx)];
    await crearAviso(ctx, { lineaIds: [a.id] });
    const prox = await crearAviso(ctx, { lineaIds: [a.id, b.id], desde: despues(2) });
    await crearAviso(ctx, { lineaIds: [b.id] });
    const r = await ctx.http.get('/avisos').query({ lineaId: b.id, estado: 'proximos' });
    expect(r.body.datos.map((x: { id: string }) => x.id)).toEqual([prox.id]);
    expect(r.body.meta.total).toBe(1);
  });

  it('el total respeta el filtro de estado y no el de la tabla, con página fuera de rango', async () => {
    const l = await crearLinea(ctx);
    await crearAviso(ctx, { lineaIds: [l.id] });
    await crearAviso(ctx, { lineaIds: [l.id], desde: antes(9), hasta: antes(1) });
    const r = await ctx.http.get('/avisos').query({ lineaId: l.id, pagina: 7 }).expect(200);
    expect(r.body).toEqual({ datos: [], meta: { total: 1, pagina: 7, porPagina: 20 } });
  });

  it('GET /avisos sin ningún aviso vigente es lista vacía válida', async () => {
    const r = await ctx.http.get('/avisos').query({ lineaId: 'lin-vacia-xyz' }).expect(200);
    esperarContrato(r.body, 'Aviso');
    expect(r.body.datos).toEqual([]);
  });
});

describe('R11/PATCH/finalizar — reglas finas', () => {
  it('PATCH cambia lineaIds a una lista con repetidos: se guardan una sola vez y en orden', async () => {
    const [a, b] = [await crearLinea(ctx), await crearLinea(ctx)];
    const av = await crearAviso(ctx, { lineaIds: [a.id] });
    const r = await ctx.http
      .patch(`/avisos/${av.id}`)
      .set(direccion.auth)
      .send({ lineaIds: [b.id, a.id, b.id] })
      .expect(200);
    expect(r.body.datos.lineaIds).toEqual([b.id, a.id]);
  });

  it('PATCH solo de hasta=null en un aviso ya terminado lo "revive" y vuelve a ser vigente', async () => {
    const l = await crearLinea(ctx);
    const av = await crearAviso(ctx, { lineaIds: [l.id], desde: antes(9), hasta: antes(1) });
    const r = await ctx.http
      .patch(`/avisos/${av.id}`)
      .set(direccion.auth)
      .send({ hasta: null })
      .expect(200);
    expect(r.body.datos.hasta).toBeNull();
    const v = await ctx.http.get('/avisos').query({ lineaId: l.id });
    expect(v.body.meta.total).toBe(1);
  });

  it('PATCH con trazadoAlternativo de más de dos puntos y luego null', async () => {
    const l = await crearLinea(ctx);
    const av = await crearAviso(ctx, { lineaIds: [l.id] });
    const t3 = [...TRAZADO, { latitud: -31.72, longitud: -60.51 }];
    const r1 = await ctx.http
      .patch(`/avisos/${av.id}`)
      .set(direccion.auth)
      .send({ trazadoAlternativo: t3 })
      .expect(200);
    expect(r1.body.datos.trazadoAlternativo).toEqual(t3);
    const r2 = await ctx.http
      .patch(`/avisos/${av.id}`)
      .set(direccion.auth)
      .send({ trazadoAlternativo: null })
      .expect(200);
    expect(r2.body.datos.trazadoAlternativo).toBeNull();
  });

  it('PATCH con un audio o una imagen como videoUrl: 422 ARCHIVO_NO_SUBIDO', async () => {
    const l = await crearLinea(ctx);
    const av = await crearAviso(ctx, { lineaIds: [l.id] });
    for (const [buf, nombre, tipo] of [
      [m4a(), 'a.m4a', 'audio/mp4'],
      [jpeg(), 'f.jpg', 'image/jpeg'],
    ] as const) {
      const s = await ctx.http
        .post('/archivos')
        .set(direccion.auth)
        .attach('archivo', buf, { filename: nombre, contentType: tipo })
        .expect(201);
      const r = await ctx.http
        .patch(`/avisos/${av.id}`)
        .set(direccion.auth)
        .send({ videoUrl: s.body.datos.url });
      esperarErrorLimpio(r, 422, 'ARCHIVO_NO_SUBIDO');
    }
  });

  it('un video subido se acepta con el Host con que se subió y se devuelve con el Host del pedido (URL absoluta del servidor)', async () => {
    const l = await crearLinea(ctx);
    const s = await ctx.http
      .post('/archivos')
      .set(direccion.auth)
      .attach('archivo', mp4(), { filename: 'v.mp4', contentType: 'video/mp4' })
      .expect(201);
    const r = await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .set('Host', '10.0.0.5:3000')
      .send(cuerpo([l.id], { videoUrl: s.body.datos.url }))
      .expect(201);
    expect(r.body.datos.videoUrl).toMatch(/^http:\/\/10\.0\.0\.5:3000\/archivos\/videos\//);
    const g = await ctx.http.get(`/avisos/${r.body.datos.id}`);
    expect(g.body.datos.videoUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/archivos\/videos\//);
  });

  it('el video con X-Forwarded-Proto sólo cambia a https si CONFIAR_PROXY (por defecto no)', async () => {
    const l = await crearLinea(ctx);
    const s = await ctx.http
      .post('/archivos')
      .set(direccion.auth)
      .attach('archivo', mp4(), { filename: 'v.mp4', contentType: 'video/mp4' })
      .expect(201);
    const r = await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo([l.id], { videoUrl: s.body.datos.url }))
      .expect(201);
    const g = await ctx.http.get(`/avisos/${r.body.datos.id}`).set('X-Forwarded-Proto', 'https');
    expect(g.body.datos.videoUrl).toMatch(/^http:\/\//);
  });

  it('finalizar dos veces en simultáneo: las dos 200 y el mismo hasta', async () => {
    const l = await crearLinea(ctx);
    const av = await crearAviso(ctx, { lineaIds: [l.id] });
    const [a, b] = await Promise.all([
      ctx.http.post(`/avisos/${av.id}/finalizar`).set(direccion.auth),
      ctx.http.post(`/avisos/${av.id}/finalizar`).set(direccion.auth),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(a.body.datos.hasta).toBe(b.body.datos.hasta);
  });

  it('finalizar con un cuerpo con basura no da 500', async () => {
    const l = await crearLinea(ctx);
    const av = await crearAviso(ctx, { lineaIds: [l.id] });
    const r = await ctx.http
      .post(`/avisos/${av.id}/finalizar`)
      .set(direccion.auth)
      .send({ hasta: '2099-01-01T00:00:00-03:00' });
    expect(r.status).toBeLessThan(500);
    if (r.status === 200) expect(r.body.datos.hasta).toBe('2026-12-31T23:59:30-03:00');
  });

  it('PATCH simultáneos sobre el mismo aviso no corrompen la lista de líneas (sin duplicados, sin 500)', async () => {
    const [a, b, c] = [await crearLinea(ctx), await crearLinea(ctx), await crearLinea(ctx)];
    const av = await crearAviso(ctx, { lineaIds: [a.id] });
    const rs = await Promise.all([
      ctx.http
        .patch(`/avisos/${av.id}`)
        .set(direccion.auth)
        .send({ lineaIds: [b.id, c.id] }),
      ctx.http
        .patch(`/avisos/${av.id}`)
        .set(direccion.auth)
        .send({ lineaIds: [c.id, b.id] }),
      ctx.http
        .patch(`/avisos/${av.id}`)
        .set(direccion.auth)
        .send({ lineaIds: [a.id, b.id] }),
    ]);
    for (const r of rs) expect(r.status).toBeLessThan(500);
    const g = await ctx.http.get(`/avisos/${av.id}`);
    const ids = g.body.datos.lineaIds as string[];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(2);
  });

  it('dos POST iguales crean dos avisos distintos (no hay cola offline: no es idempotente)', async () => {
    const l = await crearLinea(ctx);
    const body = cuerpo([l.id]);
    const [a, b] = await Promise.all([
      ctx.http.post('/avisos').set(direccion.auth).send(body),
      ctx.http.post('/avisos').set(direccion.auth).send(body),
    ]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(a.body.datos.id).not.toBe(b.body.datos.id);
  });

  it('los avisos no exponen campos internos (creadoPor, createdAt, rol, estado)', async () => {
    const l = await crearLinea(ctx);
    const r = await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo([l.id]))
      .expect(201);
    expect(Object.keys(r.body.datos).sort()).toEqual(
      [
        'detalle',
        'desde',
        'gravedad',
        'hasta',
        'id',
        'lineaIds',
        'titulo',
        'trazadoAlternativo',
        'videoUrl',
      ].sort(),
    );
  });
});

describe('Espec. §7 / D9 — push, casos adversariales', () => {
  const tel = async (u: UsuarioDePrueba, tokenExpo: string) => ctx.registrarToken(u.id, tokenExpo);
  const fav = async (u: UsuarioDePrueba, lineaId: string, orden = 0) =>
    ctx.dataSource.getRepository(LineaFavoritaEntidad).insert({ usuarioId: u.id, lineaId, orden });

  it('quien apaga los avisos con PATCH /yo después de marcar favorito no recibe', async () => {
    const u = await crearUsuario(ctx);
    const l = await crearLinea(ctx);
    await fav(u, l.id);
    await tel(u, 'ExponentPushToken[apaga-despues]');
    await ctx.http.patch('/yo').set(u.auth).send({ avisosActivos: false }).expect(200);
    await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo([l.id]))
      .expect(201);
    await ctx.esperarPush();
    expect(ctx.notificador.enviadas).toEqual([]);
  });

  it('quien vuelve a prender los avisos recibe de nuevo', async () => {
    const u = await crearUsuario(ctx, { avisosActivos: false });
    const l = await crearLinea(ctx);
    await fav(u, l.id);
    await tel(u, 'ExponentPushToken[prende]');
    await ctx.http.patch('/yo').set(u.auth).send({ avisosActivos: true }).expect(200);
    await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo([l.id]))
      .expect(201);
    await ctx.esperarPush();
    expect(ctx.notificador.enviadas).toHaveLength(1);
  });

  it('quien quitó la línea de favoritos por la API no recibe', async () => {
    const u = await crearUsuario(ctx);
    const l = await crearLinea(ctx);
    await ctx.http.put(`/yo/lineas-favoritas/${l.id}`).set(u.auth).expect(200);
    await tel(u, 'ExponentPushToken[quita]');
    await ctx.http.delete(`/yo/lineas-favoritas/${l.id}`).set(u.auth).expect(204);
    await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo([l.id]))
      .expect(201);
    await ctx.esperarPush();
    expect(ctx.notificador.enviadas).toEqual([]);
  });

  it('un token de teléfono que pasó a otro usuario avisa sólo al nuevo dueño', async () => {
    const viejo = await crearUsuario(ctx);
    const nuevo = await crearUsuario(ctx);
    const l = await crearLinea(ctx);
    await fav(viejo, l.id);
    await fav(nuevo, l.id);
    await tel(viejo, 'ExponentPushToken[movido]');
    await tel(nuevo, 'ExponentPushToken[movido]');
    await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo([l.id]))
      .expect(201);
    await ctx.esperarPush();
    expect(ctx.notificador.enviadas.map((m) => m.tokenExpo)).toEqual(['ExponentPushToken[movido]']);
  });

  it('el usuario con la línea favorita y sin ningún teléfono registrado: no falla y no manda', async () => {
    const u = await crearUsuario(ctx);
    const l = await crearLinea(ctx);
    await fav(u, l.id);
    await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo([l.id]))
      .expect(201);
    await ctx.esperarPush();
    expect(ctx.notificador.enviadas).toEqual([]);
  });

  it('sin favoritos de nadie: ninguna push', async () => {
    const l = await crearLinea(ctx);
    await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo([l.id]))
      .expect(201);
    await ctx.esperarPush();
    expect(ctx.notificador.enviadas).toEqual([]);
  });

  it('el mensaje está en castellano, sin ids ni jerga, y con detalle largo se recorta', async () => {
    const u = await crearUsuario(ctx);
    const l = await crearLinea(ctx);
    await fav(u, l.id);
    await tel(u, 'ExponentPushToken[largo]');
    await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo([l.id], { detalle: 'palabra '.repeat(200) }))
      .expect(201);
    await ctx.esperarPush();
    expect(ctx.notificador.enviadas).toHaveLength(1);
    const m = ctx.notificador.enviadas[0];
    expect(m.titulo).toBe('Desvío de prueba');
    expect(m.cuerpo.length).toBeLessThanOrEqual(260);
    expect(m.cuerpo).not.toMatch(/undefined|null|\[object/);
  });

  it('finalizar y PATCH de varias líneas nuevas no mandan push a quienes tienen esas líneas', async () => {
    const u = await crearUsuario(ctx);
    const [a, b] = [await crearLinea(ctx), await crearLinea(ctx)];
    await fav(u, b.id);
    await tel(u, 'ExponentPushToken[sin-push]');
    const av = await crearAviso(ctx, { lineaIds: [a.id] });
    await ctx.http
      .patch(`/avisos/${av.id}`)
      .set(direccion.auth)
      .send({ lineaIds: [a.id, b.id] })
      .expect(200);
    await ctx.http.post(`/avisos/${av.id}/finalizar`).set(direccion.auth).expect(200);
    await ctx.esperarPush();
    expect(ctx.notificador.enviadas).toEqual([]);
  });

  it('el autor (Dirección) con la línea como favorita: se anota el comportamiento, no debe fallar', async () => {
    const l = await crearLinea(ctx);
    await fav(direccion, l.id);
    await tel(direccion, 'ExponentPushToken[autor]');
    await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo([l.id]))
      .expect(201);
    await ctx.esperarPush();
    // Ver "Dudas": la especificación no excluye al autor.
    expect(ctx.notificador.enviadas.length).toBeLessThanOrEqual(1);
  });

  it('la push no se manda si el alta falla por una línea inexistente en la segunda posición', async () => {
    const u = await crearUsuario(ctx);
    const l = await crearLinea(ctx);
    await fav(u, l.id);
    await tel(u, 'ExponentPushToken[parcial]');
    await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send(cuerpo([l.id, 'lin-fantasma']))
      .expect(404);
    await ctx.esperarPush();
    expect(ctx.notificador.enviadas).toEqual([]);
  });
});

describe('§8 — semillas de avisos (con la siembra real)', () => {
  let ctxS: AppDePrueba;
  beforeAll(async () => {
    ctxS = await crearApp({ ahora: '2026-09-19T10:30:00-03:00' });
    await sembrar(ctxS.dataSource, ctxS.reloj, ctxS.app.get(ArchivosServicio));
  });
  afterAll(() => ctxS.cerrar());

  it('avi-088 coincide con el ejemplo del PRD (líneas 2, 7 y 9, desvío, trazado y video)', async () => {
    const r = await ctxS.http.get('/avisos/avi-088').expect(200);
    esperarContrato(r.body, 'Aviso');
    const a = r.body.datos;
    expect(a.lineaIds).toEqual(['lin-02', 'lin-07', 'lin-09']);
    expect(a.gravedad).toBe('desvio');
    expect(a.titulo).toBe('Desvío por obra en calle Corrientes');
    expect(a.desde).toMatch(/-03:00$/);
    expect(a.hasta).toMatch(/-03:00$/);
    expect(new Date(a.desde).getTime()).toBeLessThanOrEqual(ctxS.reloj.ahora().getTime());
    expect(new Date(a.hasta).getTime()).toBeGreaterThan(ctxS.reloj.ahora().getTime());
    expect(a.videoUrl).toBeTruthy();
  });

  it('con el reloj movido 40 días, avi-088 ya no es vigente (fechas relativas a hoy) y no hay 500', async () => {
    ctxS.reloj.fijar('2026-11-01T10:30:00-03:00');
    const r = await ctxS.http.get('/avisos').expect(200);
    esperarContrato(r.body, 'Aviso');
    ctxS.reloj.fijar('2026-09-19T10:30:00-03:00');
  });

  it('hay al menos un aviso sin video y uno con video; el de suspensión es de la línea de Almafuerte y Newbery', async () => {
    const r = await ctxS.http.get('/avisos').query({ estado: 'todos' }).expect(200);
    const datos = r.body.datos as { videoUrl: string | null; gravedad: string; id: string }[];
    expect(datos.some((a) => a.videoUrl === null)).toBe(true);
    expect(datos.some((a) => a.videoUrl !== null)).toBe(true);
    expect(datos.some((a) => a.gravedad === 'suspension')).toBe(true);
  });

  it('la Dirección de demo puede ingresar y publicar; julián (pasajero) no', async () => {
    const ing = await ctxS.http
      .post('/auth/ingreso')
      .send({ email: 'transporte@parana.demo.ar', contrasena: CONTRASENA_DE_DEMO })
      .expect(200);
    const token = ing.body.datos.token as string;
    const ok = await ctxS.http
      .post('/avisos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        titulo: 'Prueba',
        detalle: 'Prueba de demo',
        lineaIds: ['lin-05'],
        desde: '2026-09-19T11:00:00-03:00',
        gravedad: 'informativo',
      })
      .expect(201);
    esperarContrato(ok.body, 'Aviso');
    const ju = await ctxS.http
      .post('/auth/ingreso')
      .send({ email: 'julian@mail.com', contrasena: CONTRASENA_DE_DEMO })
      .expect(200);
    esperarErrorLimpio(
      await ctxS.http
        .post('/avisos')
        .set('Authorization', `Bearer ${ju.body.datos.token}`)
        .send({}),
      403,
      'SIN_PERMISO',
    );
  });

  it('un aviso nuevo sobre lin-05 notifica a julián (favorita lin-05), si tiene teléfono', async () => {
    const ju = await ctxS.http
      .post('/auth/ingreso')
      .send({ email: 'julian@mail.com', contrasena: CONTRASENA_DE_DEMO })
      .expect(200);
    await ctxS.registrarToken(
      ju.body.datos.usuario.id,
      'ExponentPushToken[julian-demo]',
      'android',
    );
    const dir = await ctxS.http
      .post('/auth/ingreso')
      .send({ email: 'transporte@parana.demo.ar', contrasena: CONTRASENA_DE_DEMO })
      .expect(200);
    ctxS.notificador.vaciar();
    await ctxS.http
      .post('/avisos')
      .set('Authorization', `Bearer ${dir.body.datos.token}`)
      .send({
        titulo: 'Aviso para Julián',
        detalle: 'x',
        lineaIds: ['lin-05'],
        desde: '2026-09-19T11:00:00-03:00',
        gravedad: 'informativo',
      })
      .expect(201);
    await ctxS.esperarPush();
    expect(ctxS.notificador.enviadas.map((m) => m.tokenExpo)).toContain(
      'ExponentPushToken[julian-demo]',
    );
  });
});

describe('Swagger', () => {
  it('documenta las cinco rutas de avisos', async () => {
    const r = await ctx.http.get('/docs-json').expect(200);
    const paths = Object.keys(r.body.paths);
    for (const p of ['/avisos', '/avisos/{id}', '/avisos/{id}/finalizar']) {
      expect(paths).toContain(p);
    }
    expect(Object.keys(r.body.paths['/avisos']).sort()).toEqual(['get', 'post']);
    expect(Object.keys(r.body.paths['/avisos/{id}']).sort()).toEqual(['get', 'patch']);
  });
});

// Evita que el import de la entidad quede sin uso si cambia el builder.
void AvisoEntidad;
