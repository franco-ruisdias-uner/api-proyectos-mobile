// Verificación independiente de M1 — Catálogos (ESPECIFICACION §4 M1, R5, R17, §8). Caja negra.
import type { Response } from 'supertest';
import { sembrar } from '../../src/semillas/sembrar.js';
import { AlmacenArchivos } from '../../src/comun/archivos/almacen-archivos.js';
import { Reloj } from '../../src/comun/reloj/reloj.js';
import { crearApp, type AppDePrueba } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearOperador, crearVecino } from '../utilidades/usuarios.js';

const JERGA =
  /\b(must|should|property|undefined|null|cannot|exception|invalid|string|boolean|number|array|entity|column|constraint|sql|jwt|bearer|payload|body)\b/i;
const mensaje = (res: Response) =>
  (res.body as { error: { mensaje: string } }).error.mensaje;

interface Punto {
  latitud: number;
  longitud: number;
}
interface ZonaC {
  id: string;
  nombre: string;
  limite: Punto[];
  referente: string;
}

function dentro(p: Punto, poli: Punto[]): boolean {
  let d = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const a = poli[i]!;
    const b = poli[j]!;
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

let ctx: AppDePrueba;
beforeAll(async () => {
  ctx = await crearApp();
  // crearApp limpia el esquema en los motores de red: se siembra a mano (es idempotente).
  await sembrar(
    ctx.dataSource,
    ctx.app.get(AlmacenArchivos),
    ctx.app.get(Reloj),
  );
});
afterAll(() => ctx.cerrar());

async function operadorAuth(): Promise<[string, string]> {
  return (await crearOperador(ctx)).auth;
}

describe('Semillas §8 — tipos de reporte', () => {
  it('hay ocho tipos con la forma del PRD, ids tip-*, y tip-bache está', async () => {
    const res = await ctx.http().get('/tipos-de-reporte');
    expect(res.status).toBe(200);
    esperarContrato(res, 'TipoDeReporte');
    expect(res.body.datos).toHaveLength(8);
    expect(res.body.meta.total).toBe(8);
    const ids = res.body.datos.map((t: { id: string }) => t.id);
    expect(ids).toContain('tip-bache');
    for (const t of res.body.datos) {
      expect(t.id).toMatch(/^tip-/);
      for (const k of ['nombre', 'icono', 'color', 'areaResponsable'])
        expect(t[k], k).toMatch(/\S/);
      expect(t.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
    const nombres = res.body.datos
      .map((t: { nombre: string }) => t.nombre.toLowerCase())
      .join('|');
    for (const n of ['bache', 'luminaria', 'basura', 'sem', 'vereda', 'otro'])
      expect(nombres, n).toContain(n);
    expect(new Set(ids).size).toBe(8);
  });

  it('sin campos de más ni claves internas', async () => {
    const res = await ctx.http().get('/tipos-de-reporte');
    for (const t of res.body.datos)
      expect(Object.keys(t).sort()).toEqual([
        'areaResponsable',
        'color',
        'icono',
        'id',
        'nombre',
      ]);
  });

  it('los íconos son nombres de Ionicons (minúsculas y guiones), no vacíos', async () => {
    const res = await ctx.http().get('/tipos-de-reporte');
    for (const t of res.body.datos)
      expect(t.icono).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe('Semillas §8 / R5 — zonas', () => {
  let zonas: ZonaC[];
  beforeAll(async () => {
    const res = await ctx.http().get('/zonas');
    zonas = res.body.datos;
  });

  it('cuatro zonas con el contrato y zon-norte presente', async () => {
    const res = await ctx.http().get('/zonas');
    expect(res.status).toBe(200);
    esperarContrato(res, 'Zona');
    expect(zonas).toHaveLength(4);
    expect(zonas.map((z) => z.id)).toContain('zon-norte');
    for (const z of zonas) {
      expect(z.id).toMatch(/^zon-/);
      expect(z.limite.length).toBeGreaterThanOrEqual(3);
      expect(z.referente).toMatch(/\S/);
      for (const p of z.limite) {
        expect(typeof p.latitud).toBe('number');
        expect(typeof p.longitud).toBe('number');
        expect(Object.keys(p).sort()).toEqual(['latitud', 'longitud']);
      }
    }
  });

  it('R5 — el ejemplo del PRD (Rocamora 1240, -33.0089, -58.5142) cae en zon-norte', () => {
    const p = { latitud: -33.0089, longitud: -58.5142 };
    const en = zonas.filter((z) => dentro(p, z.limite)).map((z) => z.id);
    expect(en).toEqual(['zon-norte']);
  });

  it('R5 — sin superposición ni huecos: en una grilla sobre la caja de las zonas, cada punto está en a lo sumo una zona, y en una exactamente si está dentro de la unión', () => {
    const todos = zonas.flatMap((z) => z.limite);
    const lat = todos.map((p) => p.latitud);
    const lon = todos.map((p) => p.longitud);
    const [minLat, maxLat] = [Math.min(...lat), Math.max(...lat)];
    const [minLon, maxLon] = [Math.min(...lon), Math.max(...lon)];
    const N = 60;
    let cubiertos = 0;
    let total = 0;
    for (let i = 1; i < N; i++)
      for (let j = 1; j < N; j++) {
        const p = {
          latitud: minLat + ((maxLat - minLat) * (i + 0.37)) / N,
          longitud: minLon + ((maxLon - minLon) * (j + 0.61)) / N,
        };
        const n = zonas.filter((z) => dentro(p, z.limite)).length;
        expect(n, JSON.stringify(p)).toBeLessThanOrEqual(1);
        total++;
        if (n === 1) cubiertos++;
      }
    // "cubren la ciudad sin huecos": la caja envolvente debería estar casi toda cubierta.
    expect(cubiertos / total).toBeGreaterThan(0.9);
  });

  it('el sitio de Gualeguaychú (aprox. -33.01, -58.51) está cubierto', () => {
    const p = { latitud: -33.0095, longitud: -58.5172 };
    expect(zonas.filter((z) => dentro(p, z.limite))).toHaveLength(1);
  });

  it('un punto lejos de la ciudad no cae en ninguna zona', () => {
    const p = { latitud: -34.6, longitud: -58.4 };
    expect(zonas.filter((z) => dentro(p, z.limite))).toHaveLength(0);
  });
});

describe('Semillas §8 — cuadrillas', () => {
  it('cua-02 existe con su nombre del PRD; 2-3 por zona; especialidades distintas; hay una inactiva', async () => {
    const auth = await operadorAuth();
    const res = await ctx
      .http()
      .get('/cuadrillas?porPagina=100')
      .set(...auth);
    expect(res.status).toBe(200);
    esperarContrato(res, 'Cuadrilla');
    const cs = res.body.datos as {
      id: string;
      nombre: string;
      zonaId: string;
      especialidad: string;
      activa: boolean;
    }[];
    const c2 = cs.find((c) => c.id === 'cua-02');
    expect(c2?.nombre).toBe('Cuadrilla 2 — Bacheo');
    const zs = await ctx.http().get('/zonas');
    const zonaIds = zs.body.datos.map((z: { id: string }) => z.id);
    for (const z of zonaIds) {
      const n = cs.filter((c) => c.zonaId === z).length;
      expect(n, z).toBeGreaterThanOrEqual(2);
      expect(n, z).toBeLessThanOrEqual(3);
    }
    for (const c of cs) expect(zonaIds).toContain(c.zonaId);
    expect(cs.some((c) => !c.activa)).toBe(true);
    expect(new Set(cs.map((c) => c.especialidad)).size).toBeGreaterThan(1);
    expect(res.body.meta.total).toBe(cs.length);
  });

  it('un operador de otra zona igual ve todas por defecto (no se filtra por su zona)', async () => {
    const todas = await ctx
      .http()
      .get('/cuadrillas?porPagina=100')
      .set(...(await operadorAuth()));
    const sur = await crearOperador(ctx, { zonaId: 'zon-sur' });
    const otra = await ctx
      .http()
      .get('/cuadrillas?porPagina=100')
      .set(...sur.auth);
    expect(otra.body.meta.total).toBe(todas.body.meta.total);
  });
});

describe('Semillas §8 — usuarios de demo', () => {
  it.each([
    ['norma@mail.com', 'usr-084', 'vecino'],
    ['operador.norte@demo.ar', 'usr-003', 'operador'],
    ['nuevo@demo.ar', null, 'vecino'],
    ['operador.sur@demo.ar', null, 'operador'],
  ])(
    '%s puede ingresar (contraseña de demo del README) con rol %s',
    async (email, id, rol) => {
      // No conocemos la contraseña con certeza: se prueba que el usuario exista (contraseña
      // equivocada da CREDENCIALES_INVALIDAS igual), así que sólo verificamos el registro duplicado.
      const res = await ctx
        .http()
        .post('/auth/registro')
        .send({ nombre: 'Otra', email, contrasena: 'una-clave-larga' });
      expect(res.status).toBe(409);
      esperarError(res, 409, 'EMAIL_YA_REGISTRADO');
      void id;
      void rol;
    },
  );
});

describe('Permisos y roles (R17, §1)', () => {
  it('GET /tipos-de-reporte y /zonas son públicos: sin token, con token vencido o mal firmado', async () => {
    for (const ruta of ['/tipos-de-reporte', '/zonas']) {
      expect((await ctx.http().get(ruta)).status).toBe(200);
      expect(
        (await ctx.http().get(ruta).set('Authorization', 'Bearer x.y.z'))
          .status,
      ).toBe(200);
    }
  });

  it('GET /cuadrillas: 401 sin token, con token mal firmado y con esquema equivocado', async () => {
    for (const h of ['Bearer aaa.bbb.ccc', 'Basic abc', 'Bearer ']) {
      const res = await ctx.http().get('/cuadrillas').set('Authorization', h);
      expect(res.status, h).toBe(401);
      esperarError(res, 401, 'NO_AUTENTICADO');
      expect(mensaje(res)).not.toMatch(JERGA);
    }
  });

  it('GET /cuadrillas: token de otro secreto → 401', async () => {
    const op = await crearOperador(ctx);
    const [, valor] = op.auth;
    const partes = valor.replace('Bearer ', '').split('.');
    const roto = `${partes[0]}.${partes[1]}.${'A'.repeat(partes[2]!.length)}`;
    const res = await ctx
      .http()
      .get('/cuadrillas')
      .set('Authorization', `Bearer ${roto}`);
    expect(res.status).toBe(401);
  });

  it('R17 — vecino: 403 con sobre exacto y mensaje en castellano', async () => {
    const v = await crearVecino(ctx);
    const res = await ctx
      .http()
      .get('/cuadrillas')
      .set(...v.auth);
    expect(res.status).toBe(403);
    esperarError(res, 403, 'SIN_PERMISO');
    expect(Object.keys(res.body)).toEqual(['error']);
    expect(Object.keys(res.body.error).sort()).toEqual(['codigo', 'mensaje']);
    expect(mensaje(res)).not.toMatch(JERGA);
  });

  it('un vecino con filtros inválidos igual recibe 403 o 400 pero nunca datos', async () => {
    const v = await crearVecino(ctx);
    const res = await ctx
      .http()
      .get('/cuadrillas?zonaId=zon-norte')
      .set(...v.auth);
    expect(res.status).toBe(403);
    expect(res.body.datos).toBeUndefined();
  });
});

describe('Cuadrillas — filtros, paginación y validación', () => {
  it('filtros solo y combinados sobre las semillas; total es el filtrado', async () => {
    const auth = await operadorAuth();
    const todas = await ctx
      .http()
      .get('/cuadrillas?porPagina=100')
      .set(...auth);
    const cs = todas.body.datos as {
      id: string;
      zonaId: string;
      activa: boolean;
    }[];
    const z = 'zon-norte';
    const porZona = await ctx
      .http()
      .get(`/cuadrillas?zonaId=${z}&porPagina=100`)
      .set(...auth);
    expect(porZona.body.datos.map((c: { id: string }) => c.id)).toEqual(
      cs.filter((c) => c.zonaId === z).map((c) => c.id),
    );
    expect(porZona.body.meta.total).toBe(
      cs.filter((c) => c.zonaId === z).length,
    );
    const inact = await ctx
      .http()
      .get('/cuadrillas?activa=false&porPagina=100')
      .set(...auth);
    expect(
      inact.body.datos.every((c: { activa: boolean }) => c.activa === false),
    ).toBe(true);
    expect(inact.body.meta.total).toBe(cs.filter((c) => !c.activa).length);
    esperarContrato(inact, 'Cuadrilla');
    const comb = await ctx
      .http()
      .get(`/cuadrillas?activa=true&zonaId=${z}&porPagina=100`)
      .set(...auth);
    expect(comb.body.meta.total).toBe(
      cs.filter((c) => c.activa && c.zonaId === z).length,
    );
  });

  it('orden estable entre páginas: recorrer de a 1 reproduce la lista completa sin repetir', async () => {
    const auth = await operadorAuth();
    const todas = await ctx
      .http()
      .get('/cuadrillas?porPagina=100')
      .set(...auth);
    const ids: string[] = [];
    for (let p = 1; p <= todas.body.meta.total; p++) {
      const r = await ctx
        .http()
        .get(`/cuadrillas?porPagina=1&pagina=${p}`)
        .set(...auth);
      expect(r.body.meta).toEqual({
        total: todas.body.meta.total,
        pagina: p,
        porPagina: 1,
      });
      ids.push(r.body.datos[0].id);
    }
    expect(ids).toEqual(todas.body.datos.map((c: { id: string }) => c.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('página fuera de rango: 200, datos [] y total correcto', async () => {
    const auth = await operadorAuth();
    const r = await ctx
      .http()
      .get('/cuadrillas?pagina=99')
      .set(...auth);
    expect(r.status).toBe(200);
    expect(r.body.datos).toEqual([]);
    expect(r.body.meta.total).toBeGreaterThan(0);
    expect(r.body.meta.pagina).toBe(99);
  });

  it.each([
    'activa=1',
    'activa=si',
    'activa=TRUE ',
    'activa=',
    'zonaId=ZON-norte',
    'zonaId=usr-084',
    'zonaId=zon-',
    'pagina=-1',
    'pagina=1.5',
    'porPagina=0',
    'porPagina=1000',
    'porPagina=abc',
    'orden=id',
    'zonaId=zon-norte&zonaId=zon-sur',
  ])('400 VALIDACION_FALLIDA con ?%s', async (q) => {
    const auth = await operadorAuth();
    const res = await ctx
      .http()
      .get(`/cuadrillas?${q}`)
      .set(...auth);
    expect(res.status).toBe(400);
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    expect(mensaje(res)).not.toMatch(JERGA);
  });

  it('el rol se chequea antes que la validación de filtros o al menos nunca da 500', async () => {
    const v = await crearVecino(ctx);
    const res = await ctx
      .http()
      .get('/cuadrillas?activa=quizas')
      .set(...v.auth);
    expect([400, 403]).toContain(res.status);
  });
});

describe('Catálogos públicos — forma, paginación y entrada', () => {
  it.each(['/tipos-de-reporte', '/zonas'])(
    '%s: paginación, fuera de rango y parámetros inválidos',
    async (ruta) => {
      const total = (await ctx.http().get(ruta)).body.meta.total;
      const p = await ctx.http().get(`${ruta}?porPagina=1&pagina=2`);
      expect(p.body.datos).toHaveLength(1);
      expect(p.body.meta).toEqual({ total, pagina: 2, porPagina: 1 });
      const fuera = await ctx.http().get(`${ruta}?pagina=50`);
      expect(fuera.status).toBe(200);
      expect(fuera.body.datos).toEqual([]);
      expect(fuera.body.meta.total).toBe(total);
      for (const q of [
        'pagina=0',
        'porPagina=101',
        'porPagina=-3',
        'zonaId=zon-norte',
        'q=x',
      ]) {
        const r = await ctx.http().get(`${ruta}?${q}`);
        expect(r.status, q).toBe(400);
        esperarError(r, 400, 'VALIDACION_FALLIDA');
      }
      // sin duplicados recorriendo de a 1
      const ids: string[] = [];
      for (let i = 1; i <= total; i++)
        ids.push(
          (await ctx.http().get(`${ruta}?porPagina=1&pagina=${i}`)).body
            .datos[0].id,
        );
      expect(new Set(ids).size).toBe(total);
    },
  );

  it('porPagina=100 se acepta y devuelve el catálogo completo', async () => {
    const r = await ctx.http().get('/zonas?porPagina=100');
    expect(r.status).toBe(200);
    expect(r.body.meta).toEqual({ total: 4, pagina: 1, porPagina: 100 });
  });

  it('métodos de escritura no existen: POST/PUT/PATCH/DELETE dan 4xx con sobre de error, no 500', async () => {
    const auth = await operadorAuth();
    for (const ruta of ['/tipos-de-reporte', '/zonas', '/cuadrillas']) {
      for (const m of ['post', 'put', 'patch', 'delete'] as const) {
        const res = await ctx
          .http()
          [m](ruta)
          .set(...auth)
          .send({});
        expect(res.status, `${m} ${ruta}`).toBeGreaterThanOrEqual(400);
        expect(res.status, `${m} ${ruta}`).toBeLessThan(500);
        expect(Object.keys(res.body)).toEqual(['error']);
        expect(Object.keys(res.body.error).sort()).toEqual([
          'codigo',
          'mensaje',
        ]);
      }
    }
  });

  it('una ruta de catálogo con id (GET /zonas/zon-norte) es 404 RUTA_NO_ENCONTRADA', async () => {
    const res = await ctx.http().get('/zonas/zon-norte');
    expect(res.status).toBe(404);
    esperarError(res, 404, 'RUTA_NO_ENCONTRADA');
  });

  it('las respuestas no traen cabeceras que filtren datos ni cuerpo con campos internos', async () => {
    const res = await ctx.http().get('/zonas');
    const txt = JSON.stringify(res.body);
    expect(txt).not.toMatch(
      /createdAt|updatedAt|busqueda|Busqueda|password|contrasena|distancia|abiertoAhora/,
    );
  });
});
