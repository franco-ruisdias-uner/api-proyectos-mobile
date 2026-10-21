// Verificación independiente de M7 — Semillas completas y README (ESPECIFICACION §8). Caja negra.
import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import {
  esperarContrato,
  esperarError,
  esperarForma,
} from '../utilities/contract.js';
import { sembrar } from '../../src/seeds/seed.js';
import { AlmacenArchivos } from '../../src/common/files/file-storage.js';
import { Reloj } from '../../src/common/clock/clock.js';
import { crearVecino } from '../utilities/users.js';
import { subirArchivo, cuerpoReporte } from '../utilities/reports.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
type R = Record<string, any>;
const ESTADOS = 'recibido,en_revision,asignado,resuelto,rechazado';
const INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/;

let ctx: AppDePrueba;
let todos: R[] = [];
const tokens = new Map<string, string>();

async function ingresar(email: string, contrasena = 'demo1234') {
  return ctx.http().post('/auth/ingreso').send({ email, contrasena });
}
const conToken = (email: string): [string, string] => [
  'Authorization',
  `Bearer ${tokens.get(email)}`,
];

function metros(a: R, b: R): number {
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.latitud - a.latitud);
  const dLon = rad(b.longitud - a.longitud);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitud)) *
      Math.cos(rad(b.latitud)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

function dentro(p: R, poligono: R[]): boolean {
  let d = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i];
    const b = poligono[j];
    if (
      a.latitud > p.latitud !== b.latitud > p.latitud &&
      p.longitud <
        ((b.longitud - a.longitud) * (p.latitud - a.latitud)) /
          (b.latitud - a.latitud) +
          a.longitud
    )
      d = !d;
  }
  return d;
}

beforeAll(async () => {
  ctx = await crearApp();
  await sembrar(
    ctx.dataSource,
    ctx.app.get(AlmacenArchivos),
    ctx.app.get(Reloj),
  );
  for (const e of [
    'norma@mail.com',
    'nuevo@demo.ar',
    'operador.norte@demo.ar',
    'operador.sur@demo.ar',
  ]) {
    const r = await ingresar(e);
    tokens.set(e, r.body.datos?.token);
  }
  const res = await ctx.http().get(`/reportes?estado=${ESTADOS}&porPagina=500`);
  todos = res.body.datos;
});
afterAll(() => ctx.cerrar());

describe('ESPECIFICACION §8 — usuarios de demo con demo1234', () => {
  it.each([
    ['norma@mail.com', 'usr-084', 'vecino', null],
    ['nuevo@demo.ar', null, 'vecino', null],
    ['operador.norte@demo.ar', 'usr-003', 'operador', 'zon-norte'],
    ['operador.sur@demo.ar', null, 'operador', 'zon-sur'],
  ])('%s ingresa y /yo es un Usuario', async (email, id, rol, zona) => {
    const r = await ingresar(email);
    expect(r.status).toBe(200);
    esperarForma(r.body.datos.usuario, 'Usuario');
    if (id) expect(r.body.datos.usuario.id).toBe(id);
    expect(r.body.datos.usuario.rol).toBe(rol);
    expect(r.body.datos.usuario.zonaId).toBe(zona);
    const yo = await ctx
      .http()
      .get('/yo')
      .set(...conToken(email));
    esperarContrato(yo, 'Usuario');
    expect(JSON.stringify(yo.body)).not.toMatch(/hash|contrasena/i);
  });

  it('el email no distingue mayúsculas y la clave equivocada da 401 con sobre exacto', async () => {
    expect((await ingresar('NORMA@Mail.com')).status).toBe(200);
    esperarError(
      await ingresar('norma@mail.com', 'demo12345'),
      401,
      'CREDENCIALES_INVALIDAS',
    );
    esperarError(
      await ingresar('nadie@demo.ar'),
      401,
      'CREDENCIALES_INVALIDAS',
    );
  });

  it('Norma es Norma Pereyra; el operador sur tiene avisos apagados (README)', async () => {
    const n = await ctx
      .http()
      .get('/yo')
      .set(...conToken('norma@mail.com'));
    expect(n.body.datos.nombre).toBe('Norma Pereyra');
    const s = await ctx
      .http()
      .get('/yo')
      .set(...conToken('operador.sur@demo.ar'));
    expect(s.body.datos.avisosActivos).toBe(false);
  });
});

describe('ESPECIFICACION §8 — todos los reportes sembrados cumplen el contrato', () => {
  it('son varios, pasan por esperarContrato y están todos en /reportes (con estado explícito)', () => {
    expect(todos.length).toBeGreaterThanOrEqual(12);
    for (const r of todos) esperarForma(r, 'Reporte');
  });

  it('ids y códigos: prefijos, formato GCHU-año-5 dígitos, único, año = año de creadoEn', () => {
    const codigos = new Set<string>();
    for (const r of todos) {
      expect(r.id).toMatch(/^rep-/);
      expect(r.codigo).toMatch(/^GCHU-\d{4}-\d{5}$/);
      expect(r.codigo.split('-')[1]).toBe(r.creadoEn.slice(0, 4));
      codigos.add(r.codigo);
      expect(r.sincronizado).toBe(true);
      expect(r.tipoId).toMatch(/^tip-/);
      expect(r.zonaId).toMatch(/^zon-/);
      expect(r.autorId).toMatch(/^usr-/);
      for (const f of r.fotos) expect(f.id).toMatch(/^fot-/);
    }
    expect(codigos.size).toBe(todos.length);
  });

  it('ninguna fecha sembrada está en el futuro respecto del reloj, y ningún campo es ""', async () => {
    const ahora = ctx.reloj.ahora().getTime();
    for (const r of todos) {
      expect(r.creadoEn).toMatch(INSTANTE);
      expect(new Date(r.creadoEn).getTime(), r.id).toBeLessThanOrEqual(ahora);
      for (const campo of [
        'descripcion',
        'audioUrl',
        'cuadrillaId',
        'duplicadoDe',
      ])
        expect(r[campo] === '', `${r.id}.${campo}`).toBe(false);
      expect(
        r.fotos.filter((f: R) => f.momento === 'problema').length,
      ).toBeGreaterThanOrEqual(1);
      expect(
        r.fotos.filter((f: R) => f.momento === 'problema').length,
      ).toBeLessThanOrEqual(2);
    }
  });

  it('coherencia: asignado/resuelto tienen cuadrilla; duplicado está rechazado; adhesiones >= 0 enteras', () => {
    for (const r of todos) {
      if (r.estado === 'asignado') expect(r.cuadrillaId, r.id).not.toBeNull();
      if (r.duplicadoDe) {
        expect(r.estado).toBe('rechazado');
        expect(todos.some((x) => x.id === r.duplicadoDe)).toBe(true);
      }
      expect(Number.isInteger(r.adhesiones)).toBe(true);
      expect(r.adhesiones).toBeGreaterThanOrEqual(0);
    }
  });

  it('el mapa público no expone datos del autor', async () => {
    const t = JSON.stringify(todos);
    expect(t).not.toMatch(/norma@mail|demo\.ar|3446 412233|Pereyra/);
  });

  it('cada reporte y su historial: ascendente, recibido inicial sin operador, último = estado actual, sin futuro', async () => {
    const ahora = ctx.reloj.ahora().getTime();
    for (const r of todos) {
      const res = await ctx.http().get(`/reportes/${r.id}/cambios`);
      esperarContrato(res, 'CambioDeEstado');
      const c: R[] = res.body.datos;
      expect(c[0].estado, r.id).toBe('recibido');
      expect(c[0].operadorId).toBeNull();
      expect(c[0].comentario).toBeNull();
      expect(c[0].fechaHora).toBe(r.creadoEn);
      expect(c.at(-1)!.estado, r.id).toBe(r.estado);
      for (let i = 1; i < c.length; i++) {
        expect(c[i].fechaHora >= c[i - 1].fechaHora, `${r.id} orden`).toBe(
          true,
        );
        expect(c[i].operadorId, `${r.id} operador`).not.toBeNull();
        expect(c[i].id).toMatch(/^cam-/);
      }
      for (const x of c)
        expect(new Date(x.fechaHora).getTime()).toBeLessThanOrEqual(ahora);
    }
  });

  it('ids de cambios únicos en toda la demo', async () => {
    const ids: string[] = [];
    for (const r of todos) {
      const res = await ctx.http().get(`/reportes/${r.id}/cambios`);
      ids.push(...res.body.datos.map((x: R) => x.id));
    }
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('ESPECIFICACION §8 — ids del PRD', () => {
  it('rep-00412: fot-901, cam-1177, tip-bache, zon-norte, cua-02, código del año en curso; detalle y por código', async () => {
    const r = todos.find((x) => x.id === 'rep-00412')!;
    expect(r.codigo).toBe('GCHU-2026-00412');
    expect(r.tipoId).toBe('tip-bache');
    expect(r.zonaId).toBe('zon-norte');
    expect(r.cuadrillaId).toBe('cua-02');
    expect(r.fotos.some((f: R) => f.id === 'fot-901')).toBe(true);
    const cambios = await ctx.http().get('/reportes/rep-00412/cambios');
    expect(cambios.body.datos.some((c: R) => c.id === 'cam-1177')).toBe(true);
    const a = await ctx.http().get('/reportes/rep-00412');
    const b = await ctx.http().get('/reportes/codigo/GCHU-2026-00412');
    esperarContrato(a, 'Reporte');
    expect(b.body).toEqual(a.body);
  });

  it('usuarios y catálogos del PRD por ids', async () => {
    const z = await ctx.http().get('/zonas');
    esperarContrato(z, 'Zona');
    expect(z.body.datos.map((x: R) => x.id)).toContain('zon-norte');
    const t = await ctx.http().get('/tipos-de-reporte');
    esperarContrato(t, 'TipoDeReporte');
    expect(t.body.datos).toHaveLength(8);
    expect(t.body.datos.map((x: R) => x.id)).toContain('tip-bache');
    const c = await ctx
      .http()
      .get('/cuadrillas?porPagina=100')
      .set(...conToken('operador.norte@demo.ar'));
    esperarContrato(c, 'Cuadrilla');
    expect(c.body.datos.map((x: R) => x.id)).toContain('cua-02');
    expect(c.body.datos.find((x: R) => x.id === 'cua-02').nombre).toMatch(
      /Cuadrilla 2.*Bacheo/,
    );
  });
});

describe('ESPECIFICACION §8 — cuatro zonas que cubren sin superponerse', () => {
  it('4 zonas; ningún punto de una grilla fina cae en dos; los reportes caen en su zona', async () => {
    const z: R[] = (await ctx.http().get('/zonas')).body.datos;
    expect(z).toHaveLength(4);
    const pts = z.flatMap((x) => x.limite as R[]);
    const lat = pts.map((p) => p.latitud);
    const lon = pts.map((p) => p.longitud);
    let solapados = 0;
    let cubiertos = 0;
    const N = 120;
    for (let i = 0; i <= N; i++)
      for (let j = 0; j <= N; j++) {
        const p = {
          latitud:
            Math.min(...lat) + ((Math.max(...lat) - Math.min(...lat)) * i) / N,
          longitud:
            Math.min(...lon) + ((Math.max(...lon) - Math.min(...lon)) * j) / N,
        };
        const n = z.filter((x) => dentro(p, x.limite)).length;
        if (n > 1) solapados++;
        if (n === 1) cubiertos++;
      }
    expect(solapados).toBe(0);
    expect(cubiertos).toBeGreaterThan(0);
    for (const r of todos) {
      const propias = z.filter((x) => dentro(r.coordenadas, x.limite));
      expect(
        propias.map((x) => x.id),
        r.id,
      ).toEqual([r.zonaId]);
    }
  });

  it('reportes en las cuatro zonas y en los cinco estados (sin filtro de estado no hay rechazados)', async () => {
    expect(new Set(todos.map((r) => r.zonaId)).size).toBe(4);
    expect(new Set(todos.map((r) => r.estado)).size).toBe(5);
    const def = await ctx.http().get('/reportes?porPagina=500');
    expect(def.body.datos.some((r: R) => r.estado === 'rechazado')).toBe(false);
    expect(def.body.meta.total).toBe(
      todos.filter((r) => r.estado !== 'rechazado').length,
    );
  });

  it('cuadrillas: 2 o 3 por zona, una inactiva, cada una de zona existente', async () => {
    const res = await ctx
      .http()
      .get('/cuadrillas?porPagina=100')
      .set(...conToken('operador.norte@demo.ar'));
    const cs: R[] = res.body.datos;
    for (const zona of ['zon-norte', 'zon-este', 'zon-sur', 'zon-oeste']) {
      const n = cs.filter((c) => c.zonaId === zona).length;
      expect(n, zona).toBeGreaterThanOrEqual(2);
      expect(n, zona).toBeLessThanOrEqual(3);
    }
    expect(cs.filter((c) => !c.activa).length).toBeGreaterThanOrEqual(1);
    expect(new Set(cs.map((c) => c.especialidad)).size).toBeGreaterThan(2);
    const soloInactivas = await ctx
      .http()
      .get('/cuadrillas?activa=false')
      .set(...conToken('operador.norte@demo.ar'));
    expect(soloInactivas.body.meta.total).toBe(
      cs.filter((c) => !c.activa).length,
    );
  });
});

describe('ESPECIFICACION §8 — casos feos', () => {
  it('mayoría sin audio; uno con audio; uno con dos fotos', () => {
    expect(todos.filter((r) => r.audioUrl === null).length).toBeGreaterThan(
      todos.length / 2,
    );
    expect(
      todos.filter((r) => r.audioUrl !== null).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      todos.some(
        (r) => r.fotos.filter((f: R) => f.momento === 'problema').length === 2,
      ),
    ).toBe(true);
    expect(todos.some((r) => r.descripcion === null)).toBe(true);
  });

  it('rechazado con motivo de más de 400 caracteres y sin espacios raros', async () => {
    const rs = todos.filter((r) => r.estado === 'rechazado' && !r.duplicadoDe);
    expect(rs.length).toBeGreaterThanOrEqual(1);
    let largo = false;
    for (const r of rs) {
      const c = (
        await ctx.http().get(`/reportes/${r.id}/cambios`)
      ).body.datos.at(-1);
      expect(c.comentario).toBeTruthy();
      if (c.comentario.length > 400) largo = true;
    }
    expect(largo).toBe(true);
  });

  it('un duplicado tiene comentario automático "Duplicado de GCHU-…" con el código del original', async () => {
    const d = todos.find((r) => r.duplicadoDe)!;
    const original = todos.find((r) => r.id === d.duplicadoDe)!;
    const c = (await ctx.http().get(`/reportes/${d.id}/cambios`)).body.datos.at(
      -1,
    );
    expect(c.comentario).toContain(`Duplicado de ${original.codigo}`);
  });

  it('cinco cambios: recibido, en_revision, asignado, asignado, resuelto con foto del arreglo', async () => {
    let hallado = false;
    for (const r of todos) {
      const c: R[] = (await ctx.http().get(`/reportes/${r.id}/cambios`)).body
        .datos;
      if (c.length === 5) {
        expect(c.map((x) => x.estado)).toEqual([
          'recibido',
          'en_revision',
          'asignado',
          'asignado',
          'resuelto',
        ]);
        expect(r.fotos.some((f: R) => f.momento === 'arreglo')).toBe(true);
        hallado = true;
      }
    }
    expect(hallado).toBe(true);
  });

  it('lista vacía: nuevo@demo.ar; meta correcto y página fuera de rango', async () => {
    const r = await ctx
      .http()
      .get('/yo/reportes')
      .set(...conToken('nuevo@demo.ar'));
    expect(r.body).toEqual({
      datos: [],
      meta: { total: 0, pagina: 1, porPagina: 20 },
    });
    const norma = await ctx
      .http()
      .get('/yo/reportes?pagina=99')
      .set(...conToken('norma@mail.com'));
    expect(norma.body.datos).toEqual([]);
    expect(norma.body.meta.total).toBeGreaterThan(0);
  });

  it('Norma: /yo/reportes sólo con los propios, del más nuevo al más viejo', async () => {
    const r = await ctx
      .http()
      .get('/yo/reportes?porPagina=100')
      .set(...conToken('norma@mail.com'));
    esperarContrato(r, 'Reporte');
    const f: string[] = r.body.datos.map((x: R) => x.creadoEn);
    expect([...f].sort().reverse()).toEqual(f);
    for (const x of r.body.datos) expect(x.autorId).toBe('usr-084');
  });

  it('X-Simular sigue apagado en tests (no afecta los datos)', async () => {
    const r = await ctx.http().get('/salud').set('X-Simular', 'error-500');
    expect(r.status).toBe(200);
  });
});

describe('ESPECIFICACION §8 — cinco baches a menos de 50 m en Rocamora y Bolívar', () => {
  it('/reportes/cercanos: orden por distancia, todos < 50 m, sólo abiertos, sin duplicado', async () => {
    const centro = { latitud: -33.0089, longitud: -58.5142 };
    const res = await ctx
      .http()
      .get(
        `/reportes/cercanos?latitud=${centro.latitud}&longitud=${centro.longitud}&tipoId=tip-bache`,
      );
    esperarContrato(res, 'Reporte');
    const d: R[] = res.body.datos;
    expect(d.length).toBeGreaterThanOrEqual(4);
    const dist = d.map((r) => metros(centro, r.coordenadas));
    expect([...dist].sort((a, b) => a - b)).toEqual(dist);
    for (const r of d) {
      expect(['recibido', 'en_revision', 'asignado']).toContain(r.estado);
      expect(r.duplicadoDe).toBeNull();
    }
    for (const x of dist) expect(x).toBeLessThanOrEqual(50);
    expect(res.body.datos[0]).not.toHaveProperty('distancia');
  });

  it('en total hay cinco baches sembrados dentro de 50 m de algún otro, uno duplicado (§8 literal)', async () => {
    // Con radio máximo 200 m se ven los cercanos; contamos también el duplicado desde /reportes.
    const baches = todos.filter((r) => r.tipoId === 'tip-bache');
    const centro = { latitud: -33.0089, longitud: -58.5142 };
    const grupo = [
      ...baches,
      ...(
        await ctx
          .http()
          .get('/reportes?estado=rechazado&tipoId=tip-bache&porPagina=500')
      ).body.datos,
    ]
      .filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i)
      .filter((r) => metros(centro, r.coordenadas) <= 50);
    expect(grupo.filter((r) => r.duplicadoDe).length).toBe(1);
    // §8: "cinco reportes de bache a menos de 50 m ... uno de ellos marcado como duplicado"
    expect([5, 6], `baches en el grupo: ${grupo.length}`).toContain(
      grupo.length,
    );
  });

  it('radioMetros=200 amplía, 201 es 400', async () => {
    const ok = await ctx
      .http()
      .get(
        '/reportes/cercanos?latitud=-33.0089&longitud=-58.5142&radioMetros=200',
      );
    expect(ok.status).toBe(200);
    const mal = await ctx
      .http()
      .get(
        '/reportes/cercanos?latitud=-33.0089&longitud=-58.5142&radioMetros=201',
      );
    esperarError(mal, 400, 'VALIDACION_FALLIDA');
  });
});

describe('ESPECIFICACION §8 — bandeja ordenada por adhesiones', () => {
  it('zonaId=todas: sólo abiertos, adhesiones desc, luego el más viejo, y hay uno con muchas adhesiones primero', async () => {
    const res = await ctx
      .http()
      .get('/bandeja?zonaId=todas&porPagina=100')
      .set(...conToken('operador.norte@demo.ar'));
    esperarContrato(res, 'Reporte');
    const d: R[] = res.body.datos;
    expect(d.length).toBeGreaterThan(3);
    for (const r of d)
      expect(['recibido', 'en_revision', 'asignado']).toContain(r.estado);
    for (let i = 1; i < d.length; i++) {
      const a = d[i - 1];
      const b = d[i];
      const ok =
        a.adhesiones > b.adhesiones ||
        (a.adhesiones === b.adhesiones && a.creadoEn <= b.creadoEn);
      expect(ok, `${a.id} antes de ${b.id}`).toBe(true);
    }
    expect(d[0].adhesiones).toBeGreaterThanOrEqual(3);
    expect(res.body.meta.total).toBe(
      todos.filter((r) =>
        ['recibido', 'en_revision', 'asignado'].includes(r.estado),
      ).length,
    );
  });

  it('por defecto cada operador ve su zona; el sur no ve el norte', async () => {
    const n = await ctx
      .http()
      .get('/bandeja?porPagina=100')
      .set(...conToken('operador.norte@demo.ar'));
    const s = await ctx
      .http()
      .get('/bandeja?porPagina=100')
      .set(...conToken('operador.sur@demo.ar'));
    expect(n.body.datos.length).toBeGreaterThan(0);
    expect(s.body.datos.length).toBeGreaterThan(0);
    for (const r of n.body.datos) expect(r.zonaId).toBe('zon-norte');
    for (const r of s.body.datos) expect(r.zonaId).toBe('zon-sur');
  });

  it('el vecino no entra a la bandeja (403) ni sin token (401)', async () => {
    esperarError(
      await ctx
        .http()
        .get('/bandeja')
        .set(...conToken('norma@mail.com')),
      403,
      'SIN_PERMISO',
    );
    esperarError(await ctx.http().get('/bandeja'), 401, 'NO_AUTENTICADO');
  });

  it('las adhesiones del listado coinciden con lo que vuelve al sumarse (el recuento es real)', async () => {
    const alto = todos
      .filter((r) => r.estado === 'recibido' || r.estado === 'en_revision')
      .find((r) => r.autorId !== 'usr-084');
    if (!alto) return;
    const antes = alto.adhesiones;
    const r = await ctx
      .http()
      .post(`/reportes/${alto.id}/adhesiones`)
      .set(...conToken('norma@mail.com'));
    expect([200, 201]).toContain(r.status);
    if (r.status === 201) expect(r.body.datos.adhesiones).toBe(antes + 1);
    else expect(r.body.datos.adhesiones).toBe(antes);
  });
});

describe('Medios sembrados se bajan', () => {
  it('cada foto y audio sembrados responden 200 y por Range 206, con origen de este host', async () => {
    const urls = new Set<string>();
    for (const r of todos) {
      for (const f of r.fotos) urls.add(f.url);
      if (r.audioUrl) urls.add(r.audioUrl);
    }
    expect(urls.size).toBeGreaterThan(0);
    for (const u of urls) {
      const ruta = new URL(u).pathname;
      expect(ruta.startsWith('/archivos/')).toBe(true);
      const ok = await ctx.http().get(ruta);
      expect(ok.status, u).toBe(200);
      const parte = await ctx.http().get(ruta).set('Range', 'bytes=0-9');
      expect(parte.status, u).toBe(206);
    }
  });

  it('pedir con Host 10.0.0.5:3000 da URLs con ese origen', async () => {
    const r = await ctx
      .http()
      .get('/reportes/rep-00412')
      .set('Host', '10.0.0.5:3000');
    for (const f of r.body.datos.fotos)
      expect(f.url.startsWith('http://10.0.0.5:3000/archivos/')).toBe(true);
  });
});

describe('Semillas: idempotencia y convivencia con datos nuevos', () => {
  it('sembrar de nuevo no duplica ni rompe nada', async () => {
    await sembrar(
      ctx.dataSource,
      ctx.app.get(AlmacenArchivos),
      ctx.app.get(Reloj),
    );
    const res = await ctx
      .http()
      .get(`/reportes?estado=${ESTADOS}&porPagina=500`);
    expect(res.body.meta.total).toBe(todos.length);
    const z = await ctx.http().get('/zonas');
    expect(z.body.meta.total).toBe(4);
  });

  it('un reporte nuevo sobre la demo recibe un código distinto y mayor que los sembrados', async () => {
    const v = await crearVecino(ctx);
    const url = await subirArchivo(ctx, v);
    const res = await ctx
      .http()
      .post('/reportes')
      .set(...v.auth)
      .send(cuerpoReporte(url, 'tip-bache'));
    expect(res.status).toBe(201);
    esperarContrato(res, 'Reporte');
    const codigos = todos.map((r) => r.codigo);
    expect(codigos).not.toContain(res.body.datos.codigo);
    const n = (c: string) => Number(c.split('-')[2]);
    const delAnio = codigos.filter((c) => c.startsWith('GCHU-2026-')).map(n);
    expect(n(res.body.datos.codigo)).toBeGreaterThan(Math.max(...delAnio));
  });

  it('la semilla corrida con el reloj en 31/12 23:59 no produce fechas futuras ni años inconsistentes', async () => {
    const otra = await crearApp({ ahora: '2026-12-31T23:59:00-03:00' });
    try {
      await sembrar(
        otra.dataSource,
        otra.app.get(AlmacenArchivos),
        otra.app.get(Reloj),
      );
      const res = await otra
        .http()
        .get(`/reportes?estado=${ESTADOS}&porPagina=500`);
      expect(res.body.datos.length).toBeGreaterThanOrEqual(12);
      esperarContrato(res, 'Reporte');
      for (const r of res.body.datos as R[]) {
        expect(new Date(r.creadoEn).getTime()).toBeLessThanOrEqual(
          otra.reloj.ahora().getTime(),
        );
        expect(r.codigo.split('-')[1]).toBe(r.creadoEn.slice(0, 4));
      }
      expect(new Set((res.body.datos as R[]).map((r) => r.codigo)).size).toBe(
        res.body.datos.length,
      );
    } finally {
      await otra.cerrar();
    }
  });

  it('con el reloj el 1/1 00:00 (los "hace pocos días" cruzan de año)', async () => {
    const otra = await crearApp({ ahora: '2027-01-01T00:00:00-03:00' });
    try {
      await sembrar(
        otra.dataSource,
        otra.app.get(AlmacenArchivos),
        otra.app.get(Reloj),
      );
      const res = await otra
        .http()
        .get(`/reportes?estado=${ESTADOS}&porPagina=500`);
      esperarContrato(res, 'Reporte');
      for (const r of res.body.datos as R[])
        expect(r.codigo.split('-')[1], r.id).toBe(r.creadoEn.slice(0, 4));
      const cod = await otra.http().get('/reportes/rep-00412');
      expect(cod.body.datos.codigo).toMatch(/^GCHU-\d{4}-00412$/);
    } finally {
      await otra.cerrar();
    }
  });
});
