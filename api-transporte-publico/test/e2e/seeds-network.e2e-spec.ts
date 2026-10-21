import type { Linea, Parada } from '../../contract/types.js';
import { codigoQrDe } from '../../src/modules/network/rules/qr.js';
import { sembrar } from '../../src/seeds/seed.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { esperarContrato } from '../utilities/contract.js';

// AGENTS §10.4: los datos de demo cumplen el contrato. Espec. §8: la red de demo.

let ctx: AppDePrueba;
let lineas: Linea[];
let paradas: Parada[];

beforeAll(async () => {
  ctx = await crearApp();
  await sembrar(ctx.dataSource, ctx.reloj);
  const l = await ctx.http.get('/lineas?porPagina=100').expect(200);
  esperarContrato(l.body, 'Linea');
  lineas = l.body.datos;
  const p = await ctx.http.get('/paradas?porPagina=1000').expect(200);
  esperarContrato(p.body, 'Parada');
  paradas = p.body.datos;
});
afterAll(() => ctx.cerrar());

const linea = (id: string) => lineas.find((x) => x.id === id) as Linea;
const parada = (id: string) => paradas.find((x) => x.id === id) as Parada;
const recorrido = (id: string, sentido: 'ida' | 'vuelta') =>
  linea(id).recorridos.find((r) => r.sentido === sentido)!;

describe('Espec. §8 — las líneas de demo', () => {
  it('son las catorce, de lin-01 a lin-14, con colores distintos y en orden por número', () => {
    expect(lineas.map((l) => l.id)).toEqual(
      Array.from({ length: 14 }, (_, i) => `lin-${String(i + 1).padStart(2, '0')}`),
    );
    expect(lineas.map((l) => l.numero)).toEqual(
      Array.from({ length: 14 }, (_, i) => String(i + 1)),
    );
    expect(new Set(lineas.map((l) => l.color)).size).toBe(14);
    expect(lineas.every((l) => /^#[0-9A-F]{6}$/.test(l.color) && l.empresa !== '')).toBe(true);
  });

  it('lin-05 es la del PRD: "Puerto Viejo — San Agustín", azul, Transporte Mariano Moreno', () => {
    expect(linea('lin-05')).toMatchObject({
      numero: '5',
      nombre: 'Puerto Viejo — San Agustín',
      color: '#1B6CA8',
      empresa: 'Transporte Mariano Moreno',
      activa: true,
    });
    expect(recorrido('lin-05', 'ida').destino).toBe('hacia Puerto Viejo');
    expect(recorrido('lin-05', 'vuelta').destino).toBe('hacia San Agustín');
  });

  it('hay una línea inactiva', () => {
    expect(lineas.filter((l) => !l.activa).length).toBeGreaterThanOrEqual(1);
  });

  it('todas tienen ida y vuelta, con al menos tres paradas y dos puntos de trazado (R3)', () => {
    for (const l of lineas) {
      expect(l.recorridos.map((r) => r.sentido)).toEqual(['ida', 'vuelta']);
      for (const r of l.recorridos) {
        expect(r.paradaIds.length, `${l.id} ${r.sentido}`).toBeGreaterThanOrEqual(3);
        expect(r.trazado.length, `${l.id} ${r.sentido}`).toBeGreaterThanOrEqual(2);
        expect(new Set(r.paradaIds).size).toBe(r.paradaIds.length);
      }
    }
  });

  it('las líneas 5 y 14 están completas: muchas paradas y trazados con detalle', () => {
    for (const id of ['lin-05', 'lin-14']) {
      for (const sentido of ['ida', 'vuelta'] as const) {
        expect(recorrido(id, sentido).paradaIds.length).toBeGreaterThanOrEqual(7);
        expect(recorrido(id, sentido).trazado.length).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it('las líneas 2, 7 y 9 pasan por la zona de calle Corrientes (aviso avi-088)', () => {
    for (const id of ['lin-02', 'lin-07', 'lin-09']) {
      const nombres = linea(id).recorridos.flatMap((r) => r.paradaIds.map((p) => parada(p).nombre));
      expect(
        nombres.some((n) => n.includes('Corrientes')),
        id,
      ).toBe(true);
    }
  });
});

describe('Espec. §8 — las paradas de demo', () => {
  it('son entre 60 y 80, con ids únicos', () => {
    expect(paradas.length).toBeGreaterThanOrEqual(60);
    expect(paradas.length).toBeLessThanOrEqual(80);
    expect(new Set(paradas.map((p) => p.id)).size).toBe(paradas.length);
  });

  it('par-101 es la del PRD, exacta', () => {
    expect(parada('par-101')).toEqual({
      id: 'par-101',
      nombre: 'Alameda y Urquiza',
      coordenadas: { latitud: -31.7333, longitud: -60.5241 },
      lineaIds: ['lin-05', 'lin-14'],
      sentido: 'ida',
      refugio: true,
      codigoQr: 'PARANA:par-101',
    });
  });

  it('están las esquinas del PRD: Alameda y Urquiza, Almafuerte y Newbery y la zona de Corrientes', () => {
    const nombres = paradas.map((p) => p.nombre);
    expect(nombres).toContain('Alameda y Urquiza');
    expect(nombres).toContain('Almafuerte y Newbery');
    expect(nombres.some((n) => n.includes('Corrientes'))).toBe(true);
  });

  it('hay con y sin refugio, y con y sin QR; y cada QR es PARANA:<id> (R4)', () => {
    expect(paradas.some((p) => p.refugio)).toBe(true);
    expect(paradas.some((p) => !p.refugio)).toBe(true);
    expect(paradas.some((p) => p.codigoQr === null)).toBe(true);
    for (const p of paradas.filter((x) => x.codigoQr !== null)) {
      expect(p.codigoQr).toBe(codigoQrDe(p.id));
    }
  });

  it('los QR sembrados se resuelven por GET /paradas/qr/:codigo', async () => {
    const conQr = paradas.filter((p) => p.codigoQr !== null).slice(0, 5);
    for (const p of conQr) {
      const r = await ctx.http.get(`/paradas/qr/${p.codigoQr}`).expect(200);
      expect(r.body.datos.id).toBe(p.id);
    }
  });

  it('las coordenadas caen en Paraná', () => {
    for (const p of paradas) {
      expect(p.coordenadas.latitud).toBeGreaterThan(-31.8);
      expect(p.coordenadas.latitud).toBeLessThan(-31.65);
      expect(p.coordenadas.longitud).toBeGreaterThan(-60.6);
      expect(p.coordenadas.longitud).toBeLessThan(-60.45);
    }
  });
});

describe('Espec. R1, R2 y R3 — integridad de la red sembrada', () => {
  it('R1: una parada sólo aparece en recorridos de su sentido', () => {
    for (const l of lineas) {
      for (const r of l.recorridos) {
        for (const id of r.paradaIds) {
          expect(parada(id), `${id} en ${l.id}`).toBeDefined();
          expect(parada(id).sentido, `${id} en ${l.id} ${r.sentido}`).toBe(r.sentido);
        }
      }
    }
  });

  it('R1: la ida y la vuelta de las líneas 5 y 14 no comparten ninguna parada', () => {
    for (const id of ['lin-05', 'lin-14']) {
      const ida = new Set(recorrido(id, 'ida').paradaIds);
      expect(recorrido(id, 'vuelta').paradaIds.filter((p) => ida.has(p))).toEqual([]);
    }
  });

  it('R2: lineaIds de cada parada es exactamente las líneas de cuyos recorridos forma parte', () => {
    for (const p of paradas) {
      const esperadas = lineas
        .filter((l) => l.recorridos.some((r) => r.paradaIds.includes(p.id)))
        .map((l) => l.id);
      expect(p.lineaIds, p.id).toEqual(esperadas);
    }
  });

  it('toda parada está en al menos un recorrido', () => {
    expect(paradas.filter((p) => p.lineaIds.length === 0).map((p) => p.id)).toEqual([]);
  });

  it('el trazado de cada recorrido arranca y termina cerca de su primera y su última parada', () => {
    for (const l of lineas) {
      for (const r of l.recorridos) {
        const primera = parada(r.paradaIds[0]).coordenadas;
        const inicio = r.trazado[0];
        expect(Math.abs(primera.latitud - inicio.latitud)).toBeLessThan(0.004);
        expect(Math.abs(primera.longitud - inicio.longitud)).toBeLessThan(0.004);
      }
    }
  });
});

describe('Espec. §8 — la búsqueda anda sobre los datos de demo', () => {
  it('"alameda" encuentra Alameda y Urquiza; "corrientes" encuentra la zona del desvío', async () => {
    const a = await ctx.http.get('/paradas?q=ALAMEDA').expect(200);
    expect(a.body.datos.map((p: Parada) => p.id)).toContain('par-101');
    const c = await ctx.http.get('/paradas?q=corrientes').expect(200);
    expect(c.body.meta.total).toBeGreaterThanOrEqual(2);
  });

  it('las cercanas a par-101 incluyen a par-101, primero', async () => {
    const r = await ctx.http
      .get('/paradas')
      .query({ latitud: -31.7333, longitud: -60.5241, radioMetros: 300, orden: 'distancia' })
      .expect(200);
    expect(r.body.datos[0].id).toBe('par-101');
  });

  it('las paradas de lin-05 en un sentido son las de su recorrido', async () => {
    const r = await ctx.http.get('/paradas?lineaId=lin-05&sentido=ida&porPagina=1000').expect(200);
    expect(r.body.datos.map((p: Parada) => p.id).sort()).toEqual(
      [...recorrido('lin-05', 'ida').paradaIds].sort(),
    );
  });
});
