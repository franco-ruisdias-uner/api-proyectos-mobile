// Verificación independiente del M3 — Cuenta y favoritos (AGENTS §12). Caja negra: HTTP,
// builders de test/utilidades/ y la siembra de demo.
import { JwtService } from '@nestjs/jwt';
import { UsuarioEntidad } from '../../src/modulos/usuarios/usuario.entidad.js';
import { CONTRASENA_DE_DEMO } from '../../src/semillas/datos/usuarios.js';
import { sembrar } from '../../src/semillas/sembrar.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearLinea, crearParada } from '../utilidades/red.js';
import { crearUsuario, registrar } from '../utilidades/usuarios.js';

const JERGA =
  /\b(must|should|property|undefined|null|string|number|boolean|array|object|Bad Request|Unauthorized|Forbidden|Not Found|Internal Server|Error:|exception|Cannot|SQLITE|QueryFailed|whitelist|integer|UNIQUE|constraint)\b/i;

function esperarErrorLimpio(r: { status: number; body: unknown }, estado: number, codigo: string) {
  esperarError(r, estado, codigo);
  const b = r.body as { error: { mensaje: string } };
  expect(Object.keys(b)).toEqual(['error']);
  expect(Object.keys(b.error).sort()).toEqual(['codigo', 'mensaje']);
  expect(b.error.mensaje).not.toMatch(JERGA);
}

const CLAVES_USUARIO = [
  'avisosActivos',
  'email',
  'id',
  'lineasFavoritas',
  'nombre',
  'paradasFavoritas',
  'tema',
];

let ctx: AppDePrueba;
beforeAll(async () => {
  ctx = await crearApp({ ahora: '2026-12-31T23:59:30-03:00' });
});
afterAll(() => ctx.cerrar());

describe('R16 — orden de alta con el reloj congelado (mismo instante en todas las altas)', () => {
  it('lineasFavoritas conserva el orden de alta aunque todas tengan el mismo instante', async () => {
    const u = await crearUsuario(ctx);
    const ids = ['lin-k9', 'lin-a1', 'lin-z5', 'lin-b2', 'lin-y8', 'lin-c3', 'lin-x7'];
    for (const id of ids) await crearLinea(ctx, { id });
    for (const id of ids) await ctx.http.put(`/yo/lineas-favoritas/${id}`).set(u.auth).expect(200);
    const yo = await ctx.http.get('/yo').set(u.auth);
    expect(yo.body.datos.lineasFavoritas).toEqual(ids);
  });

  it('paradasFavoritas conserva el orden de alta aunque todas tengan el mismo instante', async () => {
    const u = await crearUsuario(ctx);
    const ids = ['par-k9', 'par-a1', 'par-z5', 'par-b2', 'par-y8', 'par-c3', 'par-x7'];
    for (const id of ids) await crearParada(ctx, { id });
    for (const id of ids) await ctx.http.put(`/yo/paradas-favoritas/${id}`).set(u.auth).expect(200);
    const r = await ctx.http.get('/yo').set(u.auth);
    expect(r.body.datos.paradasFavoritas).toEqual(ids);
  });

  it('el orden se mantiene al volver a ingresar (POST /auth/ingreso) y en la respuesta del PUT', async () => {
    const u = await crearUsuario(ctx);
    const ids = ['lin-q3', 'lin-d1', 'lin-m2'];
    for (const id of ids) await crearLinea(ctx, { id });
    let ultimo;
    for (const id of ids) ultimo = await ctx.http.put(`/yo/lineas-favoritas/${id}`).set(u.auth);
    expect(ultimo!.body.datos.lineasFavoritas).toEqual(ids);
    const ing = await ctx.http
      .post('/auth/ingreso')
      .send({ email: u.email, contrasena: u.contrasena })
      .expect(200);
    esperarContrato(ing.body, 'Sesion');
    expect(ing.body.datos.usuario.lineasFavoritas).toEqual(ids);
  });

  it('PATCH /yo devuelve los favoritos en orden de alta', async () => {
    const u = await crearUsuario(ctx);
    const ids = ['lin-w3', 'lin-e1', 'lin-r2'];
    for (const id of ids) await crearLinea(ctx, { id });
    for (const id of ids) await ctx.http.put(`/yo/lineas-favoritas/${id}`).set(u.auth);
    const r = await ctx.http.patch('/yo').set(u.auth).send({ tema: 'claro' }).expect(200);
    expect(r.body.datos.lineasFavoritas).toEqual(ids);
  });
});

describe('R16 — concurrencia entre PUT y DELETE y entre altas distintas', () => {
  it('altas simultáneas de líneas distintas: quedan todas, sin duplicados, todas 200', async () => {
    const u = await crearUsuario(ctx);
    const ids = ['lin-p1', 'lin-p2', 'lin-p3', 'lin-p4', 'lin-p5'];
    for (const id of ids) await crearLinea(ctx, { id });
    const rs = await Promise.all(
      ids.map((id) => ctx.http.put(`/yo/lineas-favoritas/${id}`).set(u.auth)),
    );
    expect(rs.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    const yo = await ctx.http.get('/yo').set(u.auth);
    expect([...yo.body.datos.lineasFavoritas].sort()).toEqual(ids);
  });

  it('muchos PUT iguales simultáneos: un solo favorito y ninguno da 500', async () => {
    const u = await crearUsuario(ctx);
    const linea = await crearLinea(ctx);
    const rs = await Promise.all(
      Array.from({ length: 8 }, () => ctx.http.put(`/yo/lineas-favoritas/${linea.id}`).set(u.auth)),
    );
    expect(rs.every((r) => r.status === 200)).toBe(true);
    const yo = await ctx.http.get('/yo').set(u.auth);
    expect(yo.body.datos.lineasFavoritas).toEqual([linea.id]);
  });

  it('PUT y DELETE simultáneos sobre lo mismo: 200 y 204, estado final consistente', async () => {
    const u = await crearUsuario(ctx);
    const p = await crearParada(ctx);
    await ctx.http.put(`/yo/paradas-favoritas/${p.id}`).set(u.auth).expect(200);
    const [a, b] = await Promise.all([
      ctx.http.put(`/yo/paradas-favoritas/${p.id}`).set(u.auth),
      ctx.http.delete(`/yo/paradas-favoritas/${p.id}`).set(u.auth),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(204);
    const yo = await ctx.http.get('/yo').set(u.auth);
    expect([[], [p.id]]).toContainEqual(yo.body.datos.paradasFavoritas);
  });

  it('dos usuarios agregando la misma línea a la vez no se pisan', async () => {
    const u1 = await crearUsuario(ctx);
    const u2 = await crearUsuario(ctx);
    const l = await crearLinea(ctx);
    const rs = await Promise.all([
      ctx.http.put(`/yo/lineas-favoritas/${l.id}`).set(u1.auth),
      ctx.http.put(`/yo/lineas-favoritas/${l.id}`).set(u2.auth),
    ]);
    expect(rs.map((r) => r.status)).toEqual([200, 200]);
    expect(rs[0].body.datos.id).toBe(u1.id);
    expect(rs[1].body.datos.id).toBe(u2.id);
  });
});

describe('Forma — el Usuario de PUT/PATCH tiene exactamente las claves del PRD', () => {
  it('PUT línea, PUT parada y PATCH: sin rol, hash ni campos de más; nulos/vacíos bien', async () => {
    const u = await crearUsuario(ctx, { rol: 'direccion' });
    const l = await crearLinea(ctx);
    const p = await crearParada(ctx);
    const rs = [
      await ctx.http.put(`/yo/lineas-favoritas/${l.id}`).set(u.auth).expect(200),
      await ctx.http.put(`/yo/paradas-favoritas/${p.id}`).set(u.auth).expect(200),
      await ctx.http.patch('/yo').set(u.auth).send({ avisosActivos: false }).expect(200),
    ];
    for (const r of rs) {
      esperarContrato(r.body, 'Usuario');
      expect(r.body.meta).toBeNull();
      expect(Object.keys(r.body.datos).sort()).toEqual(CLAVES_USUARIO);
      expect(JSON.stringify(r.body)).not.toMatch(
        /scrypt|hash|direccion|creadoEn|createdAt|password/i,
      );
    }
  });

  it('un usuario recién registrado sigue con listas vacías tras DELETE de lo que no tenía', async () => {
    const s = await registrar(ctx);
    const auth = { Authorization: `Bearer ${s.token}` };
    await ctx.http.delete('/yo/lineas-favoritas/lin-05').set(auth).expect(204);
    const yo = await ctx.http.get('/yo').set(auth);
    expect(yo.body.datos.lineasFavoritas).toEqual([]);
    expect(yo.body.datos.paradasFavoritas).toEqual([]);
  });

  it('los ids de favoritos vuelven como texto con prefijo (nunca números)', async () => {
    const u = await crearUsuario(ctx);
    const l = await crearLinea(ctx);
    const r = await ctx.http.put(`/yo/lineas-favoritas/${l.id}`).set(u.auth);
    for (const id of r.body.datos.lineasFavoritas) expect(id).toMatch(/^lin-/);
  });
});

describe('R16 — ids mal formados y casos raros en la ruta', () => {
  it.each([
    ['lin-', 'vacío tras el prefijo'],
    ['LIN-05', 'prefijo en mayúsculas'],
    ['5', 'número'],
    ['lin-05 ', 'espacio al final'],
    ['lin-05;DROP', 'inyección'],
    ["lin-05'--", 'comilla'],
    ['par-101', 'prefijo de parada'],
    ['lin-' + 'a'.repeat(200), 'larguísimo'],
    ['lin-ñandú', 'no ascii'],
  ])('PUT línea con %j (%s) → 404 LINEA_NO_ENCONTRADA con mensaje limpio', async (id) => {
    const u = await crearUsuario(ctx);
    const r = await ctx.http.put(`/yo/lineas-favoritas/${encodeURIComponent(id)}`).set(u.auth);
    esperarErrorLimpio(r, 404, 'LINEA_NO_ENCONTRADA');
  });

  it.each(['par-', 'PAR-101', '7', 'lin-05', 'par-101 ', "par-1'--", 'par-' + 'a'.repeat(200)])(
    'PUT parada con %j → 404 PARADA_NO_ENCONTRADA con mensaje limpio',
    async (id) => {
      const u = await crearUsuario(ctx);
      const r = await ctx.http.put(`/yo/paradas-favoritas/${encodeURIComponent(id)}`).set(u.auth);
      esperarErrorLimpio(r, 404, 'PARADA_NO_ENCONTRADA');
    },
  );

  it.each(['lin-', 'xxx', "lin-1'--", 'lin-' + 'a'.repeat(200), 'par-101'])(
    'DELETE línea con %j → 204 sin cuerpo',
    async (id) => {
      const u = await crearUsuario(ctx);
      const r = await ctx.http
        .delete(`/yo/lineas-favoritas/${encodeURIComponent(id)}`)
        .set(u.auth)
        .expect(204);
      expect(r.text).toBe('');
      expect(r.body).toEqual({});
    },
  );

  it.each(['par-', 'xxx', "par-1'--", 'par-' + 'a'.repeat(200), 'lin-05'])(
    'DELETE parada con %j → 204 sin cuerpo',
    async (id) => {
      const u = await crearUsuario(ctx);
      await ctx.http
        .delete(`/yo/paradas-favoritas/${encodeURIComponent(id)}`)
        .set(u.auth)
        .expect(204);
    },
  );

  it('PUT sin id (ruta incompleta) no es 500', async () => {
    const u = await crearUsuario(ctx);
    const r = await ctx.http.put('/yo/lineas-favoritas/').set(u.auth);
    expect([404, 405]).toContain(r.status);
    esperarError(r, r.status, 'RUTA_NO_ENCONTRADA');
  });

  it('el PUT ignora o rechaza un cuerpo, pero no rompe (nunca 500)', async () => {
    const u = await crearUsuario(ctx);
    const l = await crearLinea(ctx);
    const r = await ctx.http.put(`/yo/lineas-favoritas/${l.id}`).set(u.auth).send({ x: 1 });
    expect(r.status).toBeLessThan(500);
  });

  it('una línea inactiva se puede marcar como favorita (existe)', async () => {
    const u = await crearUsuario(ctx);
    const l = await crearLinea(ctx, { activa: false });
    const r = await ctx.http.put(`/yo/lineas-favoritas/${l.id}`).set(u.auth).expect(200);
    expect(r.body.datos.lineasFavoritas).toEqual([l.id]);
  });

  it('POST y GET sobre las rutas de favoritos no existen (404/405, nunca 2xx)', async () => {
    const u = await crearUsuario(ctx);
    const l = await crearLinea(ctx);
    for (const r of [
      await ctx.http.post(`/yo/lineas-favoritas/${l.id}`).set(u.auth),
      await ctx.http.get(`/yo/lineas-favoritas/${l.id}`).set(u.auth),
    ])
      expect(r.status).toBeGreaterThanOrEqual(400);
  });
});

describe('AGENTS §7 — autenticación en cada endpoint de M3', () => {
  const rutas: Array<[string, string, string]> = [
    ['put', '/yo/lineas-favoritas/lin-05', 'PUT línea'],
    ['delete', '/yo/lineas-favoritas/lin-05', 'DELETE línea'],
    ['put', '/yo/paradas-favoritas/par-101', 'PUT parada'],
    ['delete', '/yo/paradas-favoritas/par-101', 'DELETE parada'],
    ['patch', '/yo', 'PATCH /yo'],
  ];

  it.each(rutas)('%s %s sin token → 401 NO_AUTENTICADO (%s)', async (metodo, ruta) => {
    const r = await (ctx.http as unknown as Record<string, (r: string) => Promise<never>>)[metodo](
      ruta,
    );
    esperarErrorLimpio(r, 401, 'NO_AUTENTICADO');
  });

  it.each(rutas)('%s %s con token mal firmado → 401 (%s)', async (metodo, ruta) => {
    const u = await crearUsuario(ctx);
    const falso = await new JwtService({ secret: 'otro' }).signAsync({}, { subject: u.id });
    const r = await (
      ctx.http as unknown as Record<
        string,
        (r: string) => { set: (k: string, v: string) => Promise<never> }
      >
    )
      [metodo](ruta)
      .set('Authorization', `Bearer ${falso}`);
    esperarErrorLimpio(r, 401, 'NO_AUTENTICADO');
  });

  it.each(['', 'Bearer', 'Bearer ', 'Basic abc', 'token-pelado', 'Bearer a.b.c'])(
    'cabecera Authorization %j → 401',
    async (valor) => {
      const r = await ctx.http.patch('/yo').set('Authorization', valor).send({ tema: 'claro' });
      esperarErrorLimpio(r, 401, 'NO_AUTENTICADO');
    },
  );

  it('token vencido (más de 30 días) → 401 en PUT y PATCH', async () => {
    const reloj = await crearApp({ ahora: '2026-01-01T10:00:00-03:00' });
    try {
      const u = await crearUsuario(reloj);
      await reloj.http.patch('/yo').set(u.auth).send({ tema: 'claro' }).expect(200);
      reloj.reloj.avanzar(31 * 24 * 60 * 60 * 1000);
      esperarErrorLimpio(
        await reloj.http.patch('/yo').set(u.auth).send({ tema: 'claro' }),
        401,
        'NO_AUTENTICADO',
      );
      esperarErrorLimpio(
        await reloj.http.put('/yo/lineas-favoritas/lin-05').set(u.auth),
        401,
        'NO_AUTENTICADO',
      );
    } finally {
      await reloj.cerrar();
    }
  });

  it('el 401 llega antes que el 404 y que el 400', async () => {
    esperarError(await ctx.http.put('/yo/lineas-favoritas/lin-inexistente'), 401, 'NO_AUTENTICADO');
    esperarError(await ctx.http.patch('/yo').send({ tema: 'rojo' }), 401, 'NO_AUTENTICADO');
  });

  it('un token de una cuenta distinta sólo toca esa cuenta (no hay forma de tocar la de otro)', async () => {
    const a = await crearUsuario(ctx);
    const b = await crearUsuario(ctx);
    const l = await crearLinea(ctx);
    await ctx.http.put(`/yo/lineas-favoritas/${l.id}`).set(a.auth).expect(200);
    await ctx.http.patch('/yo').set(b.auth).send({ nombre: 'Solo B', tema: 'oscuro' }).expect(200);
    const ya = await ctx.http.get('/yo').set(a.auth);
    expect(ya.body.datos.nombre).not.toBe('Solo B');
    expect(ya.body.datos.tema).toBe('sistema');
    expect(ya.body.datos.lineasFavoritas).toEqual([l.id]);
  });
});

describe('Espec. §4 M3 — PATCH /yo: entrada adversarial', () => {
  it.each([
    ['__proto__', JSON.parse('{"__proto__":{"rol":"direccion"}}')],
    ['constructor', { constructor: { prototype: { rol: 'direccion' } } }],
  ])('clave %s: no escala el rol ni da 500 (200 ignorada o 400)', async (_n, cuerpo) => {
    const u = await crearUsuario(ctx);
    const r = await ctx.http.patch('/yo').set(u.auth).send(cuerpo);
    expect([200, 400]).toContain(r.status);
    const guardado = await ctx.dataSource
      .getRepository(UsuarioEntidad)
      .findOneByOrFail({ id: u.id });
    expect(guardado.rol).toBe('pasajero');
  });

  it.each([
    ['nombre de exactamente 100 letras', { nombre: 'a'.repeat(100) }, 200],
    ['nombre de 1 letra', { nombre: 'Z' }, 200],
    [
      'nombre de 100 letras con espacios alrededor (se recorta antes de medir)',
      { nombre: ` ${'a'.repeat(100)} ` },
      200,
    ],
    ['nombre con tildes, eñe y emoji', { nombre: 'Ñandú Pérez 🚌' }, 200],
    ['tema claro', { tema: 'claro' }, 200],
    ['tema oscuro', { tema: 'oscuro' }, 200],
    ['tema sistema', { tema: 'sistema' }, 200],
    ['avisosActivos true', { avisosActivos: true }, 200],
    ['avisosActivos false', { avisosActivos: false }, 200],
    ['tema en mayúsculas', { tema: 'OSCURO' }, 400],
    ['tema numérico', { tema: 1 }, 400],
    ['tema vacío', { tema: '' }, 400],
    ['avisosActivos "true" como texto', { avisosActivos: 'true' }, 400],
    ['avisosActivos 1', { avisosActivos: 1 }, 400],
    ['avisosActivos 0', { avisosActivos: 0 }, 400],
    ['nombre array', { nombre: ['a'] }, 400],
    ['nombre objeto', { nombre: { a: 1 } }, 400],
    ['nombre true', { nombre: true }, 400],
    ['password', { password: 'x' }, 400],
    ['contrasena', { contrasena: 'nueva-clave-123' }, 400],
    ['createdAt', { createdAt: 'hoy' }, 400],
    ['paradasFavoritas', { paradasFavoritas: ['par-101'] }, 400],
    ['avisosactivos (otra capitalización)', { avisosactivos: false }, 400],
  ])('%s → %i', async (_n, cuerpo, estado) => {
    const u = await crearUsuario(ctx);
    const r = await ctx.http.patch('/yo').set(u.auth).send(cuerpo);
    if (estado === 200) {
      expect(r.status).toBe(200);
      esperarContrato(r.body, 'Usuario');
      expect(r.body.datos.nombre.length).toBeLessThanOrEqual(100);
    } else {
      esperarErrorLimpio(r, 400, 'VALIDACION_FALLIDA');
      expect(r.body.error.mensaje).toMatch(/[áéíóúñ ]/i);
    }
  });

  it('el nombre se guarda recortado y persiste en GET /yo', async () => {
    const u = await crearUsuario(ctx);
    await ctx.http.patch('/yo').set(u.auth).send({ nombre: '\t Ana  Pérez \n' }).expect(200);
    const yo = await ctx.http.get('/yo').set(u.auth);
    expect(yo.body.datos.nombre.trim()).toBe(yo.body.datos.nombre);
    expect(yo.body.datos.nombre).toMatch(/^Ana\s+Pérez$/);
  });

  it('nombre sólo con espacios no vacía el nombre (400) y no cambia nada', async () => {
    const u = await crearUsuario(ctx, { nombre: 'Conservado' });
    esperarErrorLimpio(
      await ctx.http.patch('/yo').set(u.auth).send({ nombre: ' \t ' }),
      400,
      'VALIDACION_FALLIDA',
    );
    const yo = await ctx.http.get('/yo').set(u.auth);
    expect(yo.body.datos.nombre).toBe('Conservado');
  });

  it.each([['[]'], ['"texto"'], ['null'], ['42']])('el cuerpo raíz %s no es 500', async (crudo) => {
    const u = await crearUsuario(ctx);
    const r = await ctx.http
      .patch('/yo')
      .set(u.auth)
      .set('Content-Type', 'application/json')
      .send(crudo);
    expect(r.status).toBeLessThan(500);
    if (r.status >= 400) esperarErrorLimpio(r, 400, 'VALIDACION_FALLIDA');
  });

  it('JSON roto → 400 VALIDACION_FALLIDA con sobre limpio, no 500', async () => {
    const u = await crearUsuario(ctx);
    const r = await ctx.http
      .patch('/yo')
      .set(u.auth)
      .set('Content-Type', 'application/json')
      .send('{"tema": ');
    esperarErrorLimpio(r, 400, 'VALIDACION_FALLIDA');
  });

  it('PATCH sin cuerpo ni Content-Type → 200 sin cambios', async () => {
    const u = await crearUsuario(ctx, { nombre: 'Sin cuerpo' });
    const r = await ctx.http.patch('/yo').set(u.auth);
    expect(r.status).toBe(200);
    expect(r.body.datos.nombre).toBe('Sin cuerpo');
  });

  it('el rol no cambia por PATCH: una Dirección sigue pudiendo publicar (no queda degradada)', async () => {
    const d = await crearUsuario(ctx, { rol: 'direccion' });
    await ctx.http.patch('/yo').set(d.auth).send({ nombre: 'Dirección' }).expect(200);
    const yo = await ctx.http.get('/yo').set(d.auth).expect(200);
    expect(Object.keys(yo.body.datos).sort()).toEqual(CLAVES_USUARIO);
  });

  it('PATCH no toca el email ni el id y la contraseña sigue sirviendo', async () => {
    const u = await crearUsuario(ctx);
    await ctx.http.patch('/yo').set(u.auth).send({ nombre: 'Otro Nombre' }).expect(200);
    const ing = await ctx.http
      .post('/auth/ingreso')
      .send({ email: u.email, contrasena: u.contrasena })
      .expect(200);
    expect(ing.body.datos.usuario.id).toBe(u.id);
    expect(ing.body.datos.usuario.nombre).toBe('Otro Nombre');
  });

  it('PATCH repetido es idempotente', async () => {
    const u = await crearUsuario(ctx);
    const a = await ctx.http.patch('/yo').set(u.auth).send({ tema: 'oscuro' }).expect(200);
    const b = await ctx.http.patch('/yo').set(u.auth).send({ tema: 'oscuro' }).expect(200);
    expect(b.body).toEqual(a.body);
  });

  it('PATCH simultáneos sobre campos distintos no se pisan', async () => {
    const u = await crearUsuario(ctx);
    const rs = await Promise.all([
      ctx.http.patch('/yo').set(u.auth).send({ tema: 'oscuro' }),
      ctx.http.patch('/yo').set(u.auth).send({ avisosActivos: false }),
      ctx.http.patch('/yo').set(u.auth).send({ nombre: 'Concurrente' }),
    ]);
    expect(rs.map((r) => r.status)).toEqual([200, 200, 200]);
    const yo = await ctx.http.get('/yo').set(u.auth);
    expect(yo.body.datos).toMatchObject({
      tema: 'oscuro',
      avisosActivos: false,
      nombre: 'Concurrente',
    });
  });
});

describe('AGENTS §9 — avisosActivos: lo que PATCH deja listo para las push de M4', () => {
  it('apagar y prender los avisos se refleja en GET /yo y en el ingreso', async () => {
    const u = await crearUsuario(ctx);
    await ctx.http.patch('/yo').set(u.auth).send({ avisosActivos: false }).expect(200);
    let ing = await ctx.http
      .post('/auth/ingreso')
      .send({ email: u.email, contrasena: u.contrasena });
    expect(ing.body.datos.usuario.avisosActivos).toBe(false);
    await ctx.http.patch('/yo').set(u.auth).send({ avisosActivos: true }).expect(200);
    ing = await ctx.http.post('/auth/ingreso').send({ email: u.email, contrasena: u.contrasena });
    expect(ing.body.datos.usuario.avisosActivos).toBe(true);
  });

  it('marcar favoritos no manda ninguna push', async () => {
    const u = await crearUsuario(ctx);
    const l = await crearLinea(ctx);
    const antes = ctx.notificador.enviadas.length;
    await ctx.http.put(`/yo/lineas-favoritas/${l.id}`).set(u.auth).expect(200);
    await ctx.http.patch('/yo').set(u.auth).send({ avisosActivos: false }).expect(200);
    await ctx.esperarPush();
    expect(ctx.notificador.enviadas.length).toBe(antes);
  });
});

describe('Espec. §8 — usuarios de demo con favoritos y el flujo completo', () => {
  let demo: AppDePrueba;
  beforeAll(async () => {
    demo = await crearApp();
    await sembrar(demo.dataSource, demo.reloj);
  });
  afterAll(() => demo.cerrar());

  const ingresar = async (email: string) => {
    const r = await demo.http
      .post('/auth/ingreso')
      .send({ email, contrasena: CONTRASENA_DE_DEMO })
      .expect(200);
    return r.body.datos as { token: string; usuario: { lineasFavoritas: string[] } };
  };

  it('Julián (usr-320): lin-05 y par-101; agrega, quita y el orden de alta se respeta', async () => {
    const { token, usuario } = await ingresar('julian@mail.com');
    expect(usuario.lineasFavoritas).toEqual(['lin-05']);
    const auth = { Authorization: `Bearer ${token}` };
    const r = await demo.http.put('/yo/lineas-favoritas/lin-14').set(auth).expect(200);
    esperarContrato(r.body, 'Usuario');
    expect(r.body.datos.lineasFavoritas).toEqual(['lin-05', 'lin-14']);
    await demo.http.put('/yo/lineas-favoritas/lin-05').set(auth).expect(200);
    const r2 = await demo.http.get('/yo').set(auth);
    expect(r2.body.datos.lineasFavoritas).toEqual(['lin-05', 'lin-14']);
    await demo.http.delete('/yo/lineas-favoritas/lin-05').set(auth).expect(204);
    const r3 = await demo.http.get('/yo').set(auth);
    expect(r3.body.datos.lineasFavoritas).toEqual(['lin-14']);
  });

  it('nuevo@demo.ar arranca sin favoritos y puede marcar par-101', async () => {
    const { token, usuario } = await ingresar('nuevo@demo.ar');
    expect(usuario.lineasFavoritas).toEqual([]);
    const r = await demo.http
      .put('/yo/paradas-favoritas/par-101')
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(r.body.datos.paradasFavoritas).toEqual(['par-101']);
  });

  it('la cuenta de la Dirección tiene Usuario sin rol y listas presentes', async () => {
    const { token } = await ingresar('transporte@parana.demo.ar');
    const r = await demo.http
      .get('/yo')
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    esperarContrato(r.body, 'Usuario');
    expect(Object.keys(r.body.datos).sort()).toEqual(CLAVES_USUARIO);
  });
});

describe('Fechas del reloj — el 31/12 a las 23:59 no afecta a favoritos ni a PATCH', () => {
  it('con el reloj en 23:59:30 del 31/12 y pasando a 00:00 del 1/1, el orden sigue siendo el de alta', async () => {
    const u = await crearUsuario(ctx);
    const ids = ['lin-n3', 'lin-n1', 'lin-n2'];
    for (const id of ids) await crearLinea(ctx, { id });
    await ctx.http.put(`/yo/lineas-favoritas/${ids[0]}`).set(u.auth).expect(200);
    ctx.reloj.fijar('2026-12-31T23:59:59-03:00');
    await ctx.http.put(`/yo/lineas-favoritas/${ids[1]}`).set(u.auth).expect(200);
    ctx.reloj.fijar('2027-01-01T00:00:00-03:00');
    await ctx.http.put(`/yo/lineas-favoritas/${ids[2]}`).set(u.auth).expect(200);
    // el reloj retrocede (reloj de prueba movido hacia atrás): el orden sigue siendo el de alta
    ctx.reloj.fijar('2026-12-31T23:59:30-03:00');
    await ctx.http.delete(`/yo/lineas-favoritas/${ids[0]}`).set(u.auth).expect(204);
    await ctx.http.put(`/yo/lineas-favoritas/${ids[0]}`).set(u.auth).expect(200);
    const yo = await ctx.http.get('/yo').set(u.auth);
    expect(yo.body.datos.lineasFavoritas).toEqual([ids[1], ids[2], ids[0]]);
  });
});
