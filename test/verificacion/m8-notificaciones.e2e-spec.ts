import { createHmac } from 'node:crypto';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { crearAviso } from '../utilidades/avisos.js';
import { crearReporte } from '../utilidades/reportes.js';
import { crearLinea, crearParada } from '../utilidades/red.js';
import { crearUsuario } from '../utilidades/usuarios.js';

const MENSAJE = 'Esta parte la programan ustedes. Mirá docs/NOTIFICACIONES.md.';
const TOKEN = 'ExponentPushToken[verif-m8]';

let ctx: AppDePrueba;
beforeAll(async () => {
  ctx = await crearApp({ puertosReales: true });
});
afterAll(() => ctx.cerrar());

function sobreExacto(r: { status: number; body: unknown }) {
  esperarError(r, 501, 'NO_IMPLEMENTADO');
  expect(r.body).toEqual({ error: { codigo: 'NO_IMPLEMENTADO', mensaje: MENSAJE } });
}

describe('AGENTS §19.3 — los tres endpoints responden 501 con el sobre exacto', () => {
  it.each(['pasajero', 'direccion'] as const)('con rol %s', async (rol) => {
    const u = await crearUsuario(ctx, { rol });
    sobreExacto(
      await ctx.http
        .post('/dispositivos')
        .set(u.auth)
        .send({ tokenExpo: TOKEN, plataforma: 'ios' }),
    );
    sobreExacto(await ctx.http.delete(`/dispositivos/${encodeURIComponent(TOKEN)}`).set(u.auth));
    sobreExacto(await ctx.http.post('/dispositivos/prueba').set(u.auth));
  });

  it('el 501 no es 500 ni lleva statusCode/detalles; plataforma android también', async () => {
    const u = await crearUsuario(ctx);
    const r = await ctx.http
      .post('/dispositivos')
      .set(u.auth)
      .send({ tokenExpo: 'ExpoPushToken[abc123]', plataforma: 'android' });
    sobreExacto(r);
    expect(Object.keys(r.body)).toEqual(['error']);
    expect(Object.keys(r.body.error).sort()).toEqual(['codigo', 'mensaje']);
  });

  it('un DELETE repetido sigue dando 501 (no 404 ni 204)', async () => {
    const u = await crearUsuario(ctx);
    sobreExacto(await ctx.http.delete('/dispositivos/ExponentPushToken[nunca]').set(u.auth));
    sobreExacto(await ctx.http.delete('/dispositivos/ExponentPushToken[nunca]').set(u.auth));
  });
});

describe('AGENTS §19.3 — 401 y 400 van antes que el 501', () => {
  it('sin token: 401 en los tres', async () => {
    esperarError(
      await ctx.http.post('/dispositivos').send({ tokenExpo: TOKEN, plataforma: 'ios' }),
      401,
      'NO_AUTENTICADO',
    );
    esperarError(
      await ctx.http.delete(`/dispositivos/${encodeURIComponent(TOKEN)}`),
      401,
      'NO_AUTENTICADO',
    );
    esperarError(await ctx.http.post('/dispositivos/prueba'), 401, 'NO_AUTENTICADO');
  });

  it('token mal firmado o basura: 401', async () => {
    for (const t of ['basura', 'a.b.c']) {
      esperarError(
        await ctx.http.post('/dispositivos/prueba').set({ Authorization: `Bearer ${t}` }),
        401,
        'NO_AUTENTICADO',
      );
    }
  });

  it('token vencido o firmado con otro secreto: 401', async () => {
    const u = await crearUsuario(ctx);
    const firmar = (secreto: string, exp: number) => {
      const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const cuerpo = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: u.id, rol: 'pasajero', iat: exp - 100, exp })}`;
      return `${cuerpo}.${createHmac('sha256', secreto).update(cuerpo).digest('base64url')}`;
    };
    const pasado = Math.floor(ctx.reloj.ahora().getTime() / 1000) - 3600;
    const futuro = Math.floor(ctx.reloj.ahora().getTime() / 1000) + 3600;
    for (const t of [firmar('secreto-de-los-tests', pasado), firmar('otro-secreto', futuro)]) {
      esperarError(
        await ctx.http.post('/dispositivos/prueba').set({ Authorization: `Bearer ${t}` }),
        401,
        'NO_AUTENTICADO',
      );
    }
    // control: el firmador es correcto
    const ok = await ctx.http
      .post('/dispositivos/prueba')
      .set({ Authorization: `Bearer ${firmar('secreto-de-los-tests', futuro)}` });
    expect(ok.status).toBe(501);
  });

  it.each([
    ['sin tokenExpo', { plataforma: 'ios' }],
    ['tokenExpo vacío', { tokenExpo: '', plataforma: 'ios' }],
    ['tokenExpo numérico', { tokenExpo: 123, plataforma: 'ios' }],
    ['sin plataforma', { tokenExpo: TOKEN }],
    ['plataforma inválida', { tokenExpo: TOKEN, plataforma: 'windows' }],
    ['campo de más', { tokenExpo: TOKEN, plataforma: 'ios', usuarioId: 'usr-1' }],
    ['cuerpo vacío', {}],
  ])('POST /dispositivos %s: 400 VALIDACION_FALLIDA', async (_n, cuerpo) => {
    const u = await crearUsuario(ctx);
    const r = await ctx.http.post('/dispositivos').set(u.auth).send(cuerpo);
    esperarError(r, 400, 'VALIDACION_FALLIDA');
    expect(r.body.error.mensaje).not.toMatch(/whitelist|should not exist|must be|property/i);
  });

  it('GET /dispositivos no existe: 404 RUTA_NO_ENCONTRADA', async () => {
    const u = await crearUsuario(ctx);
    esperarError(await ctx.http.get('/dispositivos').set(u.auth), 404, 'RUTA_NO_ENCONTRADA');
  });
});

describe('Decisión A50 — prueba con avisos apagados', () => {
  it('responde 200 con enviadas 0 sin llegar al 501', async () => {
    const u = await crearUsuario(ctx, { avisosActivos: false });
    const r = await ctx.http.post('/dispositivos/prueba').set(u.auth);
    expect(r.status).toBe(200);
    esperarContrato(r.body, 'PruebaDePush');
    expect(r.body.datos).toEqual({ enviadas: 0 });
  });
});

describe('AGENTS §19.3 — los flujos que avisan siguen respondiendo igual', () => {
  const cuerpoAviso = (lineaId: string) => ({
    titulo: 'Desvío por obra',
    detalle: 'Por obras en calle Corrientes.',
    gravedad: 'desvio',
    lineaIds: [lineaId],
    desde: '2026-09-19T08:00:00-03:00',
    hasta: null,
    trazadoAlternativo: null,
    videoUrl: null,
  });

  it('POST /avisos, PATCH, finalizar con favoritos activos y apagados', async () => {
    const dir = await crearUsuario(ctx, { rol: 'direccion' });
    const fan = await crearUsuario(ctx);
    const apagado = await crearUsuario(ctx, { avisosActivos: false });
    const linea = await crearLinea(ctx);
    await ctx.http.put(`/yo/lineas-favoritas/${linea.id}`).set(fan.auth).expect(200);
    await ctx.http.put(`/yo/lineas-favoritas/${linea.id}`).set(apagado.auth).expect(200);

    const c = await ctx.http.post('/avisos').set(dir.auth).send(cuerpoAviso(linea.id));
    expect(c.status).toBe(201);
    esperarContrato(c.body, 'Aviso');
    await ctx.esperarPush();

    const p = await ctx.http
      .patch(`/avisos/${c.body.datos.id}`)
      .set(dir.auth)
      .send({ titulo: 'Nuevo título' });
    expect(p.status).toBe(200);
    esperarContrato(p.body, 'Aviso');
    expect(p.body.datos.titulo).toBe('Nuevo título');
    await ctx.esperarPush();

    const f = await ctx.http.post(`/avisos/${c.body.datos.id}/finalizar`).set(dir.auth);
    expect(f.status).toBe(200);
    esperarContrato(f.body, 'Aviso');
    expect(f.body.datos.hasta).toBe('2026-09-19T10:30:00-03:00');
    await ctx.esperarPush();
  });

  it('aviso con rol equivocado sigue dando 403 y sin sesión 401', async () => {
    const u = await crearUsuario(ctx);
    const linea = await crearLinea(ctx);
    esperarError(
      await ctx.http.post('/avisos').set(u.auth).send(cuerpoAviso(linea.id)),
      403,
      'SIN_PERMISO',
    );
    esperarError(await ctx.http.post('/avisos').send(cuerpoAviso(linea.id)), 401, 'NO_AUTENTICADO');
  });

  it('aviso futuro creado: 201 sin que el envío pendiente rompa nada', async () => {
    const dir = await crearUsuario(ctx, { rol: 'direccion' });
    const linea = await crearLinea(ctx);
    const r = await ctx.http
      .post('/avisos')
      .set(dir.auth)
      .send({ ...cuerpoAviso(linea.id), desde: '2026-09-25T08:00:00-03:00' });
    expect(r.status).toBe(201);
    esperarContrato(r.body, 'Aviso');
    await ctx.esperarPush();
  });

  it('reportes: crear, confirmar, listar', async () => {
    const autor = await crearUsuario(ctx);
    const otro = await crearUsuario(ctx);
    const parada = await crearParada(ctx);
    const linea = await crearLinea(ctx, {
      recorridos: [{ sentido: 'ida', paradaIds: [parada.id] }],
    });
    const c = await ctx.http.post('/reportes-demora').set(autor.auth).send({
      lineaId: linea.id,
      paradaId: parada.id,
      motivo: 'demorado',
      fechaHora: '2026-09-19T10:20:00-03:00',
    });
    expect(c.status).toBe(201);
    esperarContrato(c.body, 'ReporteDeDemora');
    const k = await ctx.http
      .post(`/reportes-demora/${c.body.datos.id}/confirmaciones`)
      .set(otro.auth);
    expect(k.status).toBe(201);
    esperarContrato(k.body, 'ReporteDeDemora');
    expect(k.body.datos.confirmaciones).toBe(1);
    const l = await ctx.http.get(`/reportes-demora?paradaId=${parada.id}`);
    expect(l.status).toBe(200);
    esperarContrato(l.body, 'ReporteDeDemora');
    await crearReporte(ctx, { lineaId: linea.id, paradaId: parada.id, usuarioId: otro.id });
  });

  it('favoritos y PATCH /yo (incluido apagar avisos)', async () => {
    const u = await crearUsuario(ctx);
    const linea = await crearLinea(ctx);
    const parada = await crearParada(ctx);
    const a = await ctx.http.put(`/yo/lineas-favoritas/${linea.id}`).set(u.auth);
    expect(a.status).toBe(200);
    esperarContrato(a.body, 'Usuario');
    const b = await ctx.http.put(`/yo/paradas-favoritas/${parada.id}`).set(u.auth);
    expect(b.status).toBe(200);
    esperarContrato(b.body, 'Usuario');
    await ctx.http.delete(`/yo/lineas-favoritas/${linea.id}`).set(u.auth).expect(204);
    await ctx.http.delete(`/yo/paradas-favoritas/${parada.id}`).set(u.auth).expect(204);
    const p = await ctx.http
      .patch('/yo')
      .set(u.auth)
      .send({ avisosActivos: false, tema: 'oscuro' });
    expect(p.status).toBe(200);
    esperarContrato(p.body, 'Usuario');
    expect(p.body.datos).toMatchObject({ avisosActivos: false, tema: 'oscuro' });
    esperarError(
      await ctx.http.patch('/yo').set(u.auth).send({ dispositivos: [] }),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('GET /salud y GET /avisos siguen públicos y con contrato', async () => {
    const linea = await crearLinea(ctx);
    await crearAviso(ctx, { lineaIds: [linea.id] });
    const r = await ctx.http.get('/avisos');
    expect(r.status).toBe(200);
    esperarContrato(r.body, 'Aviso');
    await ctx.http.get('/salud').expect(200);
  });
});
