// Genera src/seeds/data/red.ts: las 14 líneas, sus paradas y sus trazados sobre calles reales
// de Paraná. Usa el servicio de rutas público de OpenStreetMap (OSRM), por eso necesita
// internet. Se corre una sola vez y el resultado va al repo: la API y los tests no dependen
// de la red. Uso: node scripts/generate-network.mjs
import { writeFileSync } from 'node:fs';

const OSRM = 'https://router.project-osrm.org';
const AGENTE = { 'User-Agent': 'uner-tp-paraná/1.0 (proyecto educativo)' };

// Lugares de referencia (coordenadas de OpenStreetMap, redondeadas).
const L = {
  SA: { lat: -31.7323, lon: -60.548, nombre: 'San Agustín' },
  PV: { lat: -31.7228, lon: -60.5252, nombre: 'Puerto Viejo' },
  PLZ: { lat: -31.733, lon: -60.5298, nombre: 'Plaza 1° de Mayo' },
  PU: { lat: -31.7193, lon: -60.5323, nombre: 'Parque Urquiza' },
  TER: { lat: -31.7396, lon: -60.5179, nombre: 'Terminal de Ómnibus' },
  HSM: { lat: -31.7318, lon: -60.5063, nombre: 'Hospital San Martín' },
  BG: { lat: -31.7114, lon: -60.5658, nombre: 'Bajada Grande' },
  VS: { lat: -31.7357, lon: -60.5133, nombre: 'Villa Sarmiento' },
  CEM: { lat: -31.7305, lon: -60.5426, nombre: 'Cementerio' },
  AM: { lat: -31.7448, lon: -60.556, nombre: 'Anacleto Medina' },
  HUM: { lat: -31.7248, lon: -60.5481, nombre: 'Barrio Humito' },
  BEL: { lat: -31.7473, lon: -60.5314, nombre: 'Barrio Belgrano' },
  THO: { lat: -31.718, lon: -60.5099, nombre: 'Barrio Thompson' },
  HER: { lat: -31.7262, lon: -60.4877, nombre: 'Barrio Hernandarias' },
  ALM: { lat: -31.74840, lon: -60.50790, nombre: 'Almafuerte' },
  P101: { lat: -31.7333, lon: -60.5241, nombre: 'Alameda y Urquiza' },
  COR: { lat: -31.7247, lon: -60.5243, nombre: 'Calle Corrientes', forzar: true }, // zona del desvío
};

// Paradas que vienen fijas (ids y nombres del PRD o de la especificación).
const FIJAS = [
  { ...L.P101, id: 'par-101', nombre: 'Alameda y Urquiza', sentido: 'ida', refugio: true, qr: true },
  // "La unidad rota de Almafuerte y Newbery" (aviso de suspensión, M4).
  { ...L.ALM, id: 'par-102', nombre: 'Almafuerte y Newbery', sentido: 'ida', refugio: true, qr: true },
];

// A — B: la ida va de B a A ("hacia A").
const LINEAS = [
  { n: 1, x: 'Terminal', y: 'Bajada Grande', color: '#D9534F', empresa: 'Central Entrerriana de Transporte', ida: [L.BG, L.PLZ, L.TER] },
  { n: 2, x: 'Parque Urquiza', y: 'Villa Sarmiento', color: '#8E44AD', empresa: 'Sociedad de Transporte Paraná', ida: [L.VS, L.COR, L.PU] },
  { n: 3, x: 'Hospital San Martín', y: 'Anacleto Medina', color: '#16A085', empresa: 'Empresa General Urquiza', ida: [L.AM, L.PLZ, L.HSM] },
  { n: 4, x: 'Plaza 1° de Mayo', y: 'Hernandarias', color: '#E67E22', empresa: 'Transporte Mariano Moreno', ida: [L.HER, L.THO, L.PLZ] },
  { n: 5, x: 'Puerto Viejo', y: 'San Agustín', color: '#1B6CA8', empresa: 'Transporte Mariano Moreno', ida: [L.SA, L.PLZ, L.P101, L.PV], completa: true, incluir: ['par-101'] },
  { n: 6, x: 'Barrio Humito', y: 'Terminal', color: '#2E8B57', empresa: 'Central Entrerriana de Transporte', ida: [L.TER, L.PLZ, L.HUM] },
  { n: 7, x: 'Puerto Viejo', y: 'Barrio Belgrano', color: '#C0392B', empresa: 'Sociedad de Transporte Paraná', ida: [L.BEL, L.PLZ, L.COR, L.PV] },
  { n: 8, x: 'Cementerio', y: 'Almafuerte', color: '#7F8C8D', empresa: 'Empresa General Urquiza', ida: [L.ALM, L.TER, L.CEM], incluir: ['par-102'] },
  { n: 9, x: 'Barrio Thompson', y: 'San Agustín', color: '#F1C40F', empresa: 'Transporte Mariano Moreno', ida: [L.SA, L.PLZ, L.COR, L.THO] },
  { n: 10, x: 'Bajada Grande', y: 'Terminal', color: '#34495E', empresa: 'Central Entrerriana de Transporte', ida: [L.TER, L.CEM, L.BG] },
  { n: 11, x: 'Villa Sarmiento', y: 'Hernandarias', color: '#95A5A6', empresa: 'Sociedad de Transporte Paraná', ida: [L.HER, L.HSM, L.VS], activa: false },
  { n: 12, x: 'Anacleto Medina', y: 'Parque Urquiza', color: '#3498DB', empresa: 'Empresa General Urquiza', ida: [L.PU, L.PLZ, L.AM] },
  { n: 13, x: 'Hospital San Martín', y: 'Barrio Humito', color: '#9B59B6', empresa: 'Sociedad de Transporte Paraná', ida: [L.HUM, L.PLZ, L.HSM] },
  { n: 14, x: 'San Agustín', y: 'Hernandarias', color: '#E91E63', empresa: 'Empresa General Urquiza', ida: [L.HER, L.THO, L.P101, L.PLZ, L.SA], completa: true, incluir: ['par-101'] },
];

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
async function pedir(ruta) {
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch(`${OSRM}${ruta}`, { headers: AGENTE });
      if (r.ok) return await r.json();
    } catch {}
    await pausa(1500 * (i + 1));
  }
  throw new Error(`OSRM no respondió: ${ruta}`);
}

const rad = (g) => (g * Math.PI) / 180;
function metros(a, b) {
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** Douglas-Peucker con tolerancia en metros. */
function simplificar(puntos, tolerancia) {
  if (puntos.length < 3) return puntos;
  const distancia = (p, a, b) => {
    const k = Math.cos(rad(a.lat));
    const ax = a.lon * k, ay = a.lat, bx = b.lon * k, by = b.lat, px = p.lon * k, py = p.lat;
    const dx = bx - ax, dy = by - ay;
    const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    return metros(p, { lat: ay + t * dy, lon: (ax + t * dx) / k });
  };
  let max = 0, indice = 0;
  for (let i = 1; i < puntos.length - 1; i++) {
    const d = distancia(puntos[i], puntos[0], puntos.at(-1));
    if (d > max) { max = d; indice = i; }
  }
  if (max <= tolerancia) return [puntos[0], puntos.at(-1)];
  return [...simplificar(puntos.slice(0, indice + 1), tolerancia).slice(0, -1), ...simplificar(puntos.slice(indice), tolerancia)];
}

const nombreCorto = (n) => n.replace(/^Avenida /, 'Av. ').replace(/^Comandante /, 'Cte. ').replace(/^General /, 'Gral. ').replace(/^Presidente /, 'Pres. ').replace(/^Sargento /, 'Sgto. ');

/** Calle que cruza en un punto, según las calles más cercanas que conoce OSRM. */
const cacheCruces = new Map();
async function cruce(punto, calle) {
  const clave = `${punto.lat.toFixed(5)},${punto.lon.toFixed(5)}|${calle}`;
  if (cacheCruces.has(clave)) return cacheCruces.get(clave);
  await pausa(200);
  const r = await pedir(`/nearest/v1/driving/${punto.lon},${punto.lat}?number=12`);
  const otra = (r.waypoints ?? []).find((w) => w.name && w.name !== calle && w.distance < 40)?.name ?? null;
  cacheCruces.set(clave, otra);
  return otra;
}

const paradas = []; // { id, nombre, lat, lon, sentido, refugio, qr }
const contadores = { ida: 102, vuelta: 201 };
for (const f of FIJAS) paradas.push({ ...f });

function idNuevo(sentido) {
  let id;
  do id = `par-${contadores[sentido]++}`; while (paradas.some((p) => p.id === id));
  return id;
}

/** Arma un recorrido: ruta real por OSRM, paradas en las esquinas de la ruta. */
async function recorrido(linea, sentido, puntos, separacion) {
  const coords = puntos.map((p) => `${p.lon},${p.lat}`).join(';');
  const r = await pedir(`/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`);
  const ruta = r.routes[0];
  const geometria = ruta.geometry.coordinates.map(([lon, lat]) => ({ lat, lon }));

  // Esquinas candidatas: las intersecciones de cada tramo, con el nombre de su calle.
  const candidatas = [];
  for (const tramo of ruta.legs.flatMap((l) => l.steps)) {
    for (const i of tramo.intersections) {
      candidatas.push({ lat: i.location[1], lon: i.location[0], calle: tramo.name });
    }
  }
  const indiceEnRuta = (p) => geometria.reduce((mejor, g, i) => (metros(g, p) < metros(geometria[mejor], p) ? i : mejor), 0);

  const elegidas = [{ ...geometria[0], calle: ruta.legs[0].steps[0].name, extremo: puntos[0] }];
  let acumulado = 0;
  let anterior = candidatas[0];
  for (const c of candidatas.slice(1, -1)) {
    acumulado += metros(anterior, c);
    anterior = c;
    if (acumulado >= separacion && c.calle) {
      elegidas.push(c);
      acumulado = 0;
    }
  }
  // Los puntos de paso marcados (la zona de calle Corrientes) llevan parada sí o sí.
  for (const p of puntos.filter((x) => x.forzar)) {
    const c = candidatas.filter((x) => x.calle).reduce((m, x) => (metros(x, p) < metros(m, p) ? x : m));
    if (!elegidas.includes(c)) elegidas.push({ ...c, extremo: null });
  }
  elegidas.push({ ...geometria.at(-1), calle: ruta.legs.at(-1).steps.at(-2)?.name ?? '', extremo: puntos.at(-1) });

  // Paradas fijas que tienen que estar en este recorrido.
  const ids = [];
  const desplazamiento = sentido === 'vuelta' ? { lat: 0.0001, lon: 0.00008 } : { lat: 0, lon: 0 };
  const conIndice = [];
  for (const e of elegidas) {
    const cercana = paradas.find((p) => p.sentido === sentido && metros(p, { lat: e.lat + desplazamiento.lat, lon: e.lon + desplazamiento.lon }) < 190);
    let parada = cercana;
    if (!parada) {
      const otra = e.calle ? await cruce(e, e.calle) : null;
      let nombre;
      if (e.extremo?.nombre && !['Calle Corrientes', 'Alameda y Urquiza', 'Almafuerte'].includes(e.extremo.nombre)) nombre = e.extremo.nombre;
      else nombre = otra && e.calle ? `${nombreCorto(e.calle)} y ${nombreCorto(otra)}` : nombreCorto(e.calle || e.extremo?.nombre || 'Sin nombre');
      parada = {
        id: idNuevo(sentido),
        nombre,
        lat: +(e.lat + desplazamiento.lat).toFixed(6),
        lon: +(e.lon + desplazamiento.lon).toFixed(6),
        sentido,
      };
      paradas.push(parada);
    }
    if (!conIndice.some((x) => x.parada === parada)) conIndice.push({ parada, i: indiceEnRuta(e) });
  }
  for (const id of linea.incluir ?? []) {
    const fija = paradas.find((p) => p.id === id);
    if (fija.sentido !== sentido || conIndice.some((x) => x.parada === fija)) continue;
    conIndice.push({ parada: fija, i: indiceEnRuta(fija) });
  }
  conIndice.sort((a, b) => a.i - b.i);
  ids.push(...conIndice.map((x) => x.parada.id));

  const trazado = simplificar(geometria, 7).map((p) => [+p.lat.toFixed(5), +p.lon.toFixed(5)]);
  return { sentido, destino: null, trazado, paradaIds: ids };
}

const resultado = [];
for (const l of LINEAS) {
  const separacion = l.n === 5 ? 650 : l.completa ? 1150 : 2200;
  const ida = await recorrido(l, 'ida', l.ida, separacion);
  ida.destino = `hacia ${l.x}`;
  const vuelta = await recorrido(l, 'vuelta', [...l.ida].reverse(), separacion);
  vuelta.destino = `hacia ${l.y}`;
  resultado.push({
    id: `lin-${String(l.n).padStart(2, '0')}`,
    numero: String(l.n),
    nombre: `${l.x} — ${l.y}`,
    color: l.color,
    empresa: l.empresa,
    activa: l.activa ?? true,
    recorridos: [ida, vuelta],
  });
  console.error(`lin-${l.n}: ida ${ida.paradaIds.length} paradas, vuelta ${vuelta.paradaIds.length}; total ${paradas.length}`);
}

// Refugio y código QR repartidos de forma determinística (hay con y sin).
paradas.forEach((p, i) => {
  if (p.refugio === undefined) p.refugio = i % 3 !== 2;
  if (p.qr === undefined) p.qr = i % 4 !== 3;
});
paradas.sort((a, b) => a.id.localeCompare(b.id));

const lineasTs = JSON.stringify(resultado, null, 2);
const paradasTs = JSON.stringify(
  paradas.map((p) => ({ id: p.id, nombre: p.nombre, latitud: p.lat, longitud: p.lon, sentido: p.sentido, refugio: p.refugio, codigoQr: p.qr ? `PARANA:${p.id}` : null })),
  null,
  2,
);
writeFileSync(
  'src/seeds/data/red.ts',
  `// GENERADO por scripts/generate-network.mjs (no se edita a mano). Trazados de OpenStreetMap (OSRM).
// Las coordenadas de las paradas son de las esquinas de cada trazado; son aproximadas.
import type { Sentido } from '../../../contract/types.js';

export interface ParadaSemilla {
  id: string;
  nombre: string;
  latitud: number;
  longitud: number;
  sentido: Sentido;
  refugio: boolean;
  codigoQr: string | null;
}

export interface RecorridoSemilla {
  sentido: Sentido;
  destino: string;
  /** [latitud, longitud] */
  trazado: [number, number][];
  paradaIds: string[];
}

export interface LineaSemilla {
  id: string;
  numero: string;
  nombre: string;
  color: string;
  empresa: string;
  activa: boolean;
  recorridos: RecorridoSemilla[];
}

export const PARADAS: ParadaSemilla[] = ${paradasTs};

export const LINEAS: LineaSemilla[] = ${lineasTs};
`,
);
console.error(`Listo: ${paradas.length} paradas.`);
