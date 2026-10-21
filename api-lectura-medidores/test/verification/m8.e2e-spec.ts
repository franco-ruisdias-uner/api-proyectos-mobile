// Verificación independiente de M8 — Semillas completas (caja negra, AGENTS §12).
// Las expectativas salen de docs/reference/class-app/mocks (reescritas acá, no importadas de src/)
// y del PRD, no de src/seeds/data.
import type {
  Lectura,
  Medidor,
  Novedad,
  Ruta,
  Suministro,
  Usuario,
} from '../../contract/types.js';
import { Sembrador } from '../../src/seeds/seed.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { bearer, ingresar } from '../utilities/users.js';

// ---------------------------------------------------------------------------------------------
// Los mocks de la app de clase, reescritos (misma lógica, tipos del PRD).
// ---------------------------------------------------------------------------------------------
type Coord = { latitud: number; longitud: number };
const rutaBrasilId = 'rut-07-2026-05';
const previousReadingAt = '2026-07-14T09:30:00-03:00';
const pinnedTitulares = [
  'Coronel, Ramona',
  'Benítez, Olga',
  'Peralta, Dora',
  'Miguez, Hector',
];
const titulares = [
  'Acosta, Mirta',
  'Fernández, Hugo',
  'Giménez, Elsa',
  'López, Carmen',
  'Martínez, Pedro',
  'Ojeda, Nelly',
  'Quiroga, Andrés',
  'Sosa, Graciela',
  'Vera, Julio',
  'Zabala, Irene',
];
const commonModels = ['agujas', 'digital', 'agujas_viejo'] as const;
const coordenadas = (i: number, o: Coord): Coord => ({
  latitud: o.latitud + i * 0.00012,
  longitud: o.longitud + (i % 2 === 0 ? 0.00008 : -0.00008),
});

const usuariosMock: [
  string,
  string,
  string,
  'lector' | 'administracion',
  boolean,
][] = [
  ['usr-011', 'L-011', 'Ramón Duarte', 'lector', true],
  ['usr-012', 'L-012', 'Silvia Fernández', 'lector', true],
  ['usr-013', 'L-013', 'Jorge Pereyra', 'lector', false],
  ['usr-014', 'L-014', 'Marta Quiroga', 'lector', true],
  ['usr-015', 'L-015', 'Carlos Ibáñez', 'lector', false],
  ['usr-016', 'L-016', 'Ana Belén Sosa', 'lector', true],
  ['usr-017', 'L-017', 'Pedro Álvarez', 'lector', true],
  ['usr-018', 'L-018', 'Lucía Romero', 'lector', false],
  ['usr-019', 'L-019', 'Héctor Gómez', 'lector', true],
  ['usr-020', 'L-020', 'Norma Cabrera', 'lector', false],
  ['usr-021', 'L-021', 'Diego Palacios', 'lector', true],
  ['usr-022', 'L-022', 'Claudia Medina', 'lector', true],
  ['usr-023', 'L-023', 'Raúl Benítez', 'lector', false],
  ['usr-024', 'L-024', 'Verónica Acosta', 'lector', true],
  ['usr-025', 'L-025', 'Miguel Torres', 'lector', false],
  ['usr-026', 'L-026', 'Graciela Núñez', 'lector', true],
  ['usr-027', 'L-027', 'Sergio Molina', 'lector', true],
  ['usr-028', 'L-028', 'Patricia Leiva', 'lector', false],
  ['usr-029', 'L-029', 'Oscar Paredes', 'lector', true],
  ['usr-030', 'L-030', 'Laura Vidal', 'administracion', false],
];

const extraRutas = [
  ['01', 'Centro', 'San Martín', 'asignada', 'usr-012'],
  ['02', 'Barrio Sur', 'Belgrano', 'en_curso', 'usr-013'],
  ['03', 'Villa Libertad', 'Urquiza', 'cerrada', 'usr-014'],
  ['04', 'Barrio Norte', 'Moreno', 'asignada', 'usr-015'],
  ['05', 'San Isidro', 'Mitre', 'en_curso', 'usr-016'],
  ['06', 'Los Pinos', 'Sarmiento', 'cerrada', 'usr-017'],
  ['08', 'La Estación', 'Rivadavia', 'asignada', 'usr-018'],
  ['09', 'Parque del Sol', 'Alberdi', 'en_curso', 'usr-019'],
  ['10', 'Barrio Oeste', 'Pellegrini', 'cerrada', 'usr-020'],
  ['11', 'Costa del Uruguay', 'Costanera', 'asignada', 'usr-021'],
  ['13', 'Santa Rosa', '25 de Mayo', 'en_curso', 'usr-022'],
  ['14', 'Las Heras', 'Las Heras', 'cerrada', 'usr-023'],
  ['15', 'San Martín', 'Independencia', 'asignada', 'usr-024'],
  ['16', 'Barrio Este', 'España', 'en_curso', 'usr-025'],
  ['17', 'El Molino', 'Italia', 'cerrada', 'usr-026'],
  ['18', 'La Floresta', 'Francia', 'asignada', 'usr-027'],
  ['19', 'Pueblo Nuevo', 'Chile', 'en_curso', 'usr-028'],
  ['20', 'Almirante Brown', 'Brown', 'cerrada', 'usr-029'],
] as const;

interface Entrada {
  ruta: string;
  s: Suministro;
  m: Medidor; // el video se compara aparte
}
const pinnedStreet = [1420, 1436, 1450, 1462];
const pinnedNumeros = ['004120', '004136', '004150', '004162'];

function brasil(i: number): Entrada {
  const numero = pinnedNumeros[i] ?? String(4200 + i).padStart(6, '0');
  const medidorId = i === 0 ? 'med-A88413' : `med-${numero}`;
  const nueva = i === 10;
  const mult = i === 25;
  const modelo = mult ? 'multiplicador' : commonModels[i % 3];
  let anterior = 1000 + i * 3;
  if (i === 0 || i === 1) anterior = 1284;
  if (i === 40) anterior = 4100;
  return {
    ruta: '07',
    m: {
      id: medidorId,
      serie: i === 0 ? 'A-88413' : `B-${numero}`,
      modelo,
      multiplicador: mult ? 10 : 1,
      digitos: 5,
      videoInstructivoUrl: null,
      codigoQr: `COOP-CHJ:${medidorId}`,
      instaladoEn:
        i === 0 ? '2019-03-11T00:00:00-03:00' : '2018-06-01T00:00:00-03:00',
    },
    s: {
      id: `sum-${numero}`,
      numero,
      titular: pinnedTitulares[i] ?? titulares[i % 10],
      direccion: `Brasil ${pinnedStreet[i] ?? 1462 + (i - 3) * 14}`,
      coordenadas: coordenadas(i, { latitud: -30.7521, longitud: -57.9814 }),
      categoria: 'residencial',
      medidorId,
      lecturaAnterior: nueva ? null : anterior,
      fechaLecturaAnterior: nueva ? null : previousReadingAt,
      consumoPromedio: nueva ? null : 18,
      activo: true,
    },
  } as Entrada;
}
function quintas(i: number): Entrada {
  const numero = String(8001 + i).padStart(6, '0');
  const medidorId = `med-Q${numero}`;
  return {
    ruta: '12',
    m: {
      id: medidorId,
      serie: `Q-${numero}`,
      modelo: commonModels[i % 3],
      multiplicador: 1,
      digitos: 5,
      videoInstructivoUrl: null,
      codigoQr: `COOP-CHJ:${medidorId}`,
      instaladoEn: '2016-11-02T00:00:00-03:00',
    },
    s: {
      id: `sum-${numero}`,
      numero,
      titular: titulares[i % 10],
      direccion: `Los Sauces ${120 + i * 16}`,
      coordenadas: coordenadas(i, { latitud: -30.72, longitud: -57.97 }),
      categoria: 'rural',
      medidorId,
      lecturaAnterior: 800 + i * 5,
      fechaLecturaAnterior: previousReadingAt,
      consumoPromedio: 18,
      activo: true,
    },
  } as Entrada;
}
function barrio(r: number, i: number): Entrada {
  const numeroRuta = extraRutas[r][0];
  const numero = `${numeroRuta}${String(i + 1).padStart(4, '0')}`;
  const medidorId = `med-${numero}`;
  return {
    ruta: numeroRuta,
    m: {
      id: medidorId,
      serie: `N-${numero}`,
      modelo: commonModels[i % 3],
      multiplicador: 1,
      digitos: 5,
      videoInstructivoUrl: null,
      codigoQr: `COOP-CHJ:${medidorId}`,
      instaladoEn: '2017-04-08T00:00:00-03:00',
    },
    s: {
      id: `sum-${numero}`,
      numero,
      titular: titulares[(r + i) % 10],
      direccion: `${extraRutas[r][2]} ${100 + i * 12}`,
      coordenadas: coordenadas(i, {
        latitud: -30.77 + r * 0.004,
        longitud: -57.99 + r * 0.003,
      }),
      categoria: i % 10 === 0 ? 'comercial' : 'residencial',
      medidorId,
      lecturaAnterior: 500 + i * 4,
      fechaLecturaAnterior: previousReadingAt,
      consumoPromedio: 18,
      activo: true,
    },
  } as Entrada;
}

const BRASIL = Array.from({ length: 200 }, (_, i) => brasil(i));
const QUINTAS = Array.from({ length: 20 }, (_, i) => quintas(i));
const BARRIOS = extraRutas.flatMap((_, r) =>
  Array.from({ length: 20 }, (_, i) => barrio(r, i)),
);
const TODAS = [...BRASIL, ...QUINTAS, ...BARRIOS];

const redondear = (c: Coord | null) =>
  c && {
    latitud: Math.round(c.latitud * 1e6) / 1e6,
    longitud: Math.round(c.longitud * 1e6) / 1e6,
  };

const hora = (min: number) =>
  `2026-09-15T${String(8 + Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00-03:00`;

const INDICES_LECTURA = [
  1, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 25, 40,
];
const INDICES_NOVEDAD = [
  2, 22, 23, 24, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 41, 42,
];
const MOTIVOS = [
  'perro_suelto',
  'porton_cerrado',
  'pasto_alto',
  'medidor_tapado',
  'medidor_roto',
  'deshabitada',
  'no_se_encuentra',
] as const;
const COMENTARIOS: Record<string, string> = {
  perro_suelto: 'Dos perros grandes sueltos',
  porton_cerrado: 'El portón está con candado',
  pasto_alto: 'No se llega al medidor',
  medidor_tapado: 'Hay un mueble adelante',
  medidor_roto: 'El visor está roto',
  deshabitada: 'La casa está vacía',
  no_se_encuentra: 'No aparece en el frente',
};

/** El mock, con la corrección del PRD (D19): lec-88201 va en el índice 0 (sum-004120), no en el 1. */
function lecturaMock(i: number): Lectura {
  const pos = i === 1 ? 0 : i; // el índice 1 del mock pasa al 0
  const { s, m } = BRASIL[pos];
  if (i === 1)
    return {
      id: 'lec-88201',
      rutaId: rutaBrasilId,
      suministroId: s.id,
      lectorId: 'usr-011',
      valor: 1302,
      consumo: 18,
      fotoUri: '',
      coordenadas: s.coordenadas,
      fueraDeRango: false,
      confirmadaPorLector: false,
      fechaHora: '2026-09-15T08:12:00-03:00',
      sincronizada: true,
    };
  if (i === 40)
    return {
      id: 'lec-88240',
      rutaId: rutaBrasilId,
      suministroId: s.id,
      lectorId: 'usr-011',
      valor: 86,
      consumo: -4014,
      fotoUri: '',
      coordenadas: s.coordenadas,
      fueraDeRango: true,
      confirmadaPorLector: true,
      fechaHora: '2026-09-15T09:05:00-03:00',
      sincronizada: true,
    };
  const delta = 8 + (i % 11);
  return {
    id: `lec-${88200 + i}`,
    rutaId: rutaBrasilId,
    suministroId: s.id,
    lectorId: 'usr-011',
    valor: s.lecturaAnterior! + delta,
    consumo: delta * m.multiplicador,
    fotoUri: '',
    coordenadas: s.coordenadas,
    fueraDeRango: false,
    confirmadaPorLector: false,
    fechaHora: hora(i),
    sincronizada: true,
  };
}
function novedadMock(i: number): Novedad {
  const motivo = i === 2 ? 'perro_suelto' : MOTIVOS[i % 7];
  const id = i === 2 ? 'nov-3312' : `nov-${3300 + i}`;
  return {
    id,
    rutaId: rutaBrasilId,
    suministroId: BRASIL[i].s.id,
    lectorId: 'usr-011',
    motivo,
    comentario: i !== 2 && i % 2 === 0 ? COMENTARIOS[motivo] : null,
    audioUri: null,
    fotoUri: '',
    fechaHora: i === 2 ? '2026-09-15T08:31:00-03:00' : hora(i + 5),
    sincronizada: true,
  };
}

// ---------------------------------------------------------------------------------------------
const sinOrigen = (o: unknown) =>
  JSON.parse(
    JSON.stringify(o).replace(/http:\/\/127\.0\.0\.1:\d+/g, 'http://x'),
  );
const RUTA_FOTO = /^\/archivos\/imagenes\//;
const JERGA =
  /undefined|null|NaN|\bmust\b|\bshould\b|property|exception|SQL|QueryFailed|constraint|stack/i;

async function listarTodo<T>(
  c: AppDePrueba,
  token: string,
  ruta: string,
  nombre: string,
): Promise<T[]> {
  const todos: T[] = [];
  for (let pagina = 1; ; pagina++) {
    const sep = ruta.includes('?') ? '&' : '?';
    const r = await c
      .http()
      .get(`${ruta}${sep}pagina=${pagina}&porPagina=100`)
      .set(bearer(token))
      .expect(200);
    esperarContrato(r.body, nombre);
    todos.push(...(r.body.datos as T[]));
    if (todos.length >= r.body.meta.total || r.body.datos.length === 0)
      return todos;
  }
}

describe('ESPECIFICACION §8 — Las semillas reproducen los mocks de la app de clase (sólo lectura)', () => {
  let c: AppDePrueba;
  let laura: string;
  let ramon: string;
  let usuarios: Usuario[];
  let rutas: Ruta[];
  let suministros: Suministro[];
  let medidores: Medidor[];
  let lecturas: Lectura[];
  let novedades: Novedad[];

  beforeAll(async () => {
    c = await crearApp();
    await c.app.get(Sembrador).sembrar();
    laura = await ingresar(c, { legajo: 'L-030', contrasena: 'lectura' });
    ramon = await ingresar(c, { legajo: 'L-011', contrasena: 'lectura' });
    usuarios = await listarTodo(c, laura, '/usuarios', 'Usuario');
    rutas = await listarTodo(c, laura, '/rutas', 'Ruta');
    suministros = await listarTodo(c, laura, '/suministros', 'Suministro');
    medidores = [];
    for (const s of suministros) {
      const r = await c
        .http()
        .get(`/medidores/${s.medidorId}`)
        .set(bearer(laura))
        .expect(200);
      esperarContrato(r.body, 'Medidor');
      medidores.push(r.body.datos);
    }
    lecturas = await listarTodo(
      c,
      ramon,
      `/rutas/${rutaBrasilId}/lecturas`,
      'Lectura',
    );
    novedades = await listarTodo(
      c,
      ramon,
      `/rutas/${rutaBrasilId}/novedades`,
      'Novedad',
    );
  }, 120_000);
  afterAll(() => c.cerrar());

  describe('Usuarios (mocks/roster.ts, users.ts, login.ts)', () => {
    it('los 20 usuarios, con ids, legajos, nombres, roles y biometría del mock, en orden de legajo', () => {
      const abiertas = (u: string) =>
        extraRutas
          .filter((r) => r[4] === u && r[3] !== 'cerrada')
          .map((r) => `rut-${r[0]}-2026-05`);
      const esperados = usuariosMock.map(([id, legajo, nombre, rol, bio]) => ({
        id,
        legajo,
        nombre,
        rol,
        biometriaActiva: bio,
        rutasAsignadas: id === 'usr-011' ? [rutaBrasilId] : abiertas(id),
      }));
      expect(usuarios).toEqual(esperados);
    });

    it('rutasAsignadas excluye las cerradas (§1): usr-011 no lista la 12', () => {
      expect(usuarios.find((u) => u.id === 'usr-011')!.rutasAsignadas).toEqual([
        rutaBrasilId,
      ]);
      expect(usuarios.find((u) => u.id === 'usr-030')!.rutasAsignadas).toEqual(
        [],
      );
      // lectores cuya única ruta está cerrada
      expect(usuarios.find((u) => u.id === 'usr-014')!.rutasAsignadas).toEqual(
        [],
      );
    });

    it('todos ingresan con "lectura"; el legajo sin distinguir mayúsculas; otra clave → 401 igual que legajo inexistente', async () => {
      for (const [, legajo] of usuariosMock)
        await c
          .http()
          .post('/auth/ingreso')
          .send({ legajo: legajo.toLowerCase(), contrasena: 'lectura' })
          .expect(200);
      const mala = await c
        .http()
        .post('/auth/ingreso')
        .send({ legajo: 'L-011', contrasena: 'Lectura' })
        .expect(401);
      const inexistente = await c
        .http()
        .post('/auth/ingreso')
        .send({ legajo: 'L-999', contrasena: 'lectura' })
        .expect(401);
      esperarError(mala.body, 'CREDENCIALES_INVALIDAS');
      expect(mala.body).toEqual(inexistente.body);
    });

    it('la sesión devuelve un Usuario sin campos de más (ni hash ni versión)', async () => {
      const r = await c
        .http()
        .post('/auth/ingreso')
        .send({ legajo: 'L-011', contrasena: 'lectura' })
        .expect(200);
      expect(Object.keys(r.body.datos.usuario).sort()).toEqual(
        [
          'biometriaActiva',
          'id',
          'legajo',
          'nombre',
          'rol',
          'rutasAsignadas',
        ].sort(),
      );
      expect(JSON.stringify(r.body)).not.toMatch(/scrypt|hash/i);
    });

    it('no hay registro público', async () => {
      await c
        .http()
        .post('/auth/registro')
        .send({ legajo: 'X-1', nombre: 'X', contrasena: 'lectura123' })
        .expect(404);
    });
  });

  describe('Rutas (mocks/routes.ts)', () => {
    it('20 rutas del mock: ids, nombres, lectores, estados y fechas; orden por bimestre desc y número', () => {
      const esperadas = [
        [
          '07',
          'Barrio Brasil',
          'usr-011',
          'en_curso',
          '2026-09-15T07:40:00-03:00',
          null,
        ],
        [
          '12',
          'Quintas Norte',
          'usr-011',
          'cerrada',
          '2026-09-14T07:10:00-03:00',
          '2026-09-14T17:02:00-03:00',
        ],
        ...extraRutas.map((r) => [
          r[0],
          r[1],
          r[4],
          r[3],
          r[3] === 'asignada' ? null : '2026-09-15T07:40:00-03:00',
          r[3] === 'cerrada' ? '2026-09-14T17:02:00-03:00' : null,
        ]),
      ]
        .sort((a, b) => (a[0] as string).localeCompare(b[0] as string))
        .map(([n, nombre, lectorId, estado, d, ce]) => ({
          id: `rut-${n}-2026-05`,
          numero: n,
          nombre,
          bimestre: '2026-05',
          lectorId,
          estado,
          descargadaEn: d,
          cerradaEn: ce,
        }));
      expect(rutas.map(({ suministroIds: _s, ...resto }) => resto)).toEqual(
        esperadas,
      );
    });

    it('suministroIds de cada ruta, en el orden de recorrido del mock (no ordenado por número)', () => {
      for (const r of rutas) {
        const esperados = TODAS.filter((e) => e.ruta === r.numero).map(
          (e) => e.s.id,
        );
        expect(r.suministroIds, r.id).toEqual(esperados);
      }
      expect(
        rutas.find((r) => r.id === rutaBrasilId)!.suministroIds.slice(0, 4),
      ).toEqual(['sum-004120', 'sum-004136', 'sum-004150', 'sum-004162']);
    });

    it('/rutas/:id/suministros pagina en el mismo orden (50 por defecto, 200 máx.)', async () => {
      const p1 = await c
        .http()
        .get(`/rutas/${rutaBrasilId}/suministros`)
        .set(bearer(ramon))
        .expect(200);
      expect(p1.body.meta).toEqual({ total: 200, pagina: 1, porPagina: 50 });
      expect(p1.body.datos.map((s: Suministro) => s.id)).toEqual(
        BRASIL.slice(0, 50).map((e) => e.s.id),
      );
      const p = await c
        .http()
        .get(`/rutas/${rutaBrasilId}/suministros?porPagina=200`)
        .set(bearer(ramon))
        .expect(200);
      expect(p.body.datos.map((s: Suministro) => s.id)).toEqual(
        BRASIL.map((e) => e.s.id),
      );
      await c
        .http()
        .get(`/rutas/${rutaBrasilId}/suministros?porPagina=201`)
        .set(bearer(ramon))
        .expect(400);
    });
  });

  describe('Suministros y medidores (mocks/brasil, quintas, neighborhoods)', () => {
    it('580 suministros, ordenados por número (texto), idénticos al mock salvo el inactivo de demo', () => {
      expect(suministros).toHaveLength(580);
      const esperados = [...TODAS]
        .map((e) => e.s)
        .sort((a, b) =>
          a.numero < b.numero ? -1 : a.numero > b.numero ? 1 : 0,
        );
      expect(new Set(suministros.map((s) => s.id)).size).toBe(580);
      const dif = suministros.map((s, i) => {
        const e = esperados[i];
        return {
          ...s,
          coordenadas: null,
          activo: e.activo, // se compara aparte
        };
      });
      expect(dif).toEqual(
        esperados.map((e) => ({
          ...e,
          coordenadas: null,
        })),
      );
    });

    it('las coordenadas siguen la fórmula del mock (latitud + i×0.00012; longitud ±0.00008 según la paridad del índice)', () => {
      const esperados = new Map(TODAS.map((e) => [e.s.id, e.s.coordenadas]));
      const malos = suministros.filter((s) => {
        const e = redondear(esperados.get(s.id)!)!;
        const a = redondear(s.coordenadas)!;
        return e.latitud !== a.latitud || e.longitud !== a.longitud;
      });
      // única diferencia permitida: sum-004120 manda el ejemplo del PRD (DECISIONES, como D19)
      expect(malos.map((s) => s.id)).toEqual(['sum-004120']);
      expect(malos[0].coordenadas).toEqual({
        latitud: -30.7521,
        longitud: -57.9814,
      });
    });

    it('exactamente un suministro inactivo, en una ruta de barrio, y el resto activo (§8 "además")', () => {
      const inactivos = suministros.filter((s) => !s.activo);
      expect(inactivos).toHaveLength(1);
      const ruta = rutas.find((r) =>
        r.suministroIds.includes(inactivos[0].id),
      )!;
      expect(['07', '12']).not.toContain(ruta.numero);
    });

    it('numero conserva los ceros a la izquierda y es texto', () => {
      for (const s of suministros) expect(s.numero).toMatch(/^\d{6}$/);
      expect(suministros.find((s) => s.id === 'sum-004120')!.numero).toBe(
        '004120',
      );
    });

    it('580 medidores idénticos al mock (sin video); QR = COOP-CHJ:<id>', () => {
      expect(medidores).toHaveLength(580);
      const porId = new Map(medidores.map((m) => [m.id, m]));
      for (const e of TODAS) {
        const m = porId.get(e.m.id);
        expect(m, e.m.id).toBeDefined();
        const { videoInstructivoUrl: _v, ...resto } = m!;
        const { videoInstructivoUrl: _w, ...esperado } = e.m;
        expect(resto, e.m.id).toEqual(esperado);
      }
    });

    it('PRD: med-A88413, serie A-88413, agujas, instalado el 11/03/2019, QR COOP-CHJ:med-A88413', async () => {
      const r = await c
        .http()
        .get('/medidores/med-A88413')
        .set(bearer(laura))
        .expect(200);
      expect(r.body.datos).toMatchObject({
        id: 'med-A88413',
        serie: 'A-88413',
        modelo: 'agujas',
        codigoQr: 'COOP-CHJ:med-A88413',
        instaladoEn: '2019-03-11T00:00:00-03:00',
      });
      const qr = await c
        .http()
        .get('/medidores/qr/COOP-CHJ:med-A88413')
        .set(bearer(laura))
        .expect(200);
      expect(qr.body.datos.id).toBe('med-A88413');
      const sum = await c
        .http()
        .get('/suministros/sum-004120')
        .set(bearer(laura))
        .expect(200);
      expect(sum.body.datos).toMatchObject({
        medidorId: 'med-A88413',
        direccion: 'Brasil 1420',
        titular: 'Coronel, Ramona',
        lecturaAnterior: 1284,
      });
    });

    it('un solo video por modelo, servido por esta API; el ×10 sin video', async () => {
      const porModelo = new Map<string, Set<string | null>>();
      for (const m of medidores) {
        if (!porModelo.has(m.modelo)) porModelo.set(m.modelo, new Set());
        porModelo
          .get(m.modelo)!
          .add(
            m.videoInstructivoUrl === null
              ? null
              : `http://x${new URL(m.videoInstructivoUrl).pathname}`,
          );
      }
      expect([...porModelo.keys()].sort()).toEqual([
        'agujas',
        'agujas_viejo',
        'digital',
        'multiplicador',
      ]);
      for (const [modelo, urls] of porModelo) {
        if (modelo === 'multiplicador') {
          expect([...urls]).toEqual([null]);
          continue;
        }
        expect(urls.size, modelo).toBe(1);
        const url = [...urls][0]!;
        expect(url).toMatch(/^https?:\/\/[^/]+\/archivos\/videos\/.+\.mp4$/);
        const total = await c.http().get(new URL(url).pathname).expect(200);
        expect(total.headers['content-type']).toBe('video/mp4');
        expect(Buffer.from(total.body).subarray(4, 8).toString()).toBe('ftyp');
        const len = Number(total.headers['content-length']);
        const rango = await c
          .http()
          .get(new URL(url).pathname)
          .set('Range', 'bytes=0-9')
          .expect(206);
        expect(rango.headers['content-range']).toBe(`bytes 0-9/${len}`);
        expect(rango.headers['accept-ranges']).toBe('bytes');
        const final = await c
          .http()
          .get(new URL(url).pathname)
          .set('Range', 'bytes=-5')
          .expect(206);
        expect(final.headers['content-range']).toBe(
          `bytes ${len - 5}-${len - 1}/${len}`,
        );
        await c
          .http()
          .get(new URL(url).pathname)
          .set('Range', `bytes=${len + 10}-${len + 20}`)
          .expect(416);
      }
    });
  });

  describe('Lecturas de Brasil (mocks/readings.ts) y D19', () => {
    it('20 lecturas vigentes, en orden de recorrido, iguales al mock (con lec-88201 en sum-004120)', () => {
      expect(lecturas).toHaveLength(20);
      const esperadas = INDICES_LECTURA.map(lecturaMock)
        .map((l) => ({
          ...l,
          orden: BRASIL.findIndex((e) => e.s.id === l.suministroId),
        }))
        .sort((a, b) => a.orden - b.orden);
      expect(lecturas.map((l) => l.id)).toEqual(esperadas.map((l) => l.id));
      for (let k = 0; k < 20; k++) {
        const { orden: _o, ...e } = esperadas[k];
        const { fotoUri, coordenadas: co, ...a } = lecturas[k];
        const { fotoUri: _f, coordenadas: ec, ...ee } = e;
        // lec-88225 (el ×10): el mock dice fueraDeRango false aunque da 110 m³ contra 18; ver "Dudas".
        if (a.id === 'lec-88225') {
          expect(a).toMatchObject({
            ...ee,
            fueraDeRango: true,
            confirmadaPorLector: true,
          });
        } else {
          expect(a, a.id).toEqual(ee);
        }
        expect(new URL(fotoUri).pathname).toMatch(RUTA_FOTO);
        if (a.id !== 'lec-88201') expect(redondear(co)).toEqual(redondear(ec));
        else expect(co).toEqual({ latitud: -30.7521, longitud: -57.9814 });
      }
    });

    it('PRD: lec-88201 es de sum-004120: valor 1302, consumo 18; sum-004136 queda sin lectura (D19)', () => {
      const l = lecturas.find((x) => x.id === 'lec-88201')!;
      expect(l).toMatchObject({
        suministroId: 'sum-004120',
        valor: 1302,
        consumo: 18,
        fueraDeRango: false,
        lectorId: 'usr-011',
        rutaId: rutaBrasilId,
        fechaHora: '2026-09-15T08:12:00-03:00',
        sincronizada: true,
      });
      expect(lecturas.some((x) => x.suministroId === 'sum-004136')).toBe(false);
    });

    it('consumo y fueraDeRango coinciden con las reglas R14/R16 para cada lectura sembrada', () => {
      for (const l of lecturas) {
        const e = BRASIL.find((x) => x.s.id === l.suministroId)!;
        const consumo =
          (l.valor - (e.s.lecturaAnterior ?? 0)) * e.m.multiplicador;
        expect(l.consumo, l.id).toBe(consumo);
        const ref =
          e.s.consumoPromedio === null ? 20 : Math.max(e.s.consumoPromedio, 5);
        expect(l.fueraDeRango, l.id).toBe(consumo < 0 || consumo > 3 * ref);
        expect(l.valor, l.id).toBeGreaterThanOrEqual(0);
        expect(l.valor, l.id).toBeLessThanOrEqual(99999);
      }
    });

    it('casos feos: negativa lec-88240 confirmada; ninguna lectura en la conexión nueva ni la inactiva', () => {
      const neg = lecturas.find((x) => x.id === 'lec-88240')!;
      expect(neg).toMatchObject({
        suministroId: BRASIL[40].s.id,
        valor: 86,
        consumo: -4014,
        fueraDeRango: true,
        confirmadaPorLector: true,
        fechaHora: '2026-09-15T09:05:00-03:00',
      });
      expect(
        lecturas
          .filter((l) => l.fueraDeRango)
          .every((l) => l.confirmadaPorLector),
      ).toBe(true);
      expect(
        lecturas.filter((l) => l.fueraDeRango).length,
      ).toBeGreaterThanOrEqual(2);
    });

    it('las 20 fotos se bajan: imagen JPEG con firma, 200, y con Range 206', async () => {
      for (const l of lecturas) {
        const p = new URL(l.fotoUri).pathname;
        const r = await c.http().get(p).expect(200);
        expect(r.headers['content-type']).toMatch(/^image\/jpeg/);
        expect([...Buffer.from(r.body).subarray(0, 3)]).toEqual([
          0xff, 0xd8, 0xff,
        ]);
      }
      const rango = await c
        .http()
        .get(new URL(lecturas[0].fotoUri).pathname)
        .set('Range', 'bytes=0-1')
        .expect(206);
      expect(rango.headers['content-range']).toMatch(/^bytes 0-1\/\d+$/);
    });

    it('las URLs usan el origen del pedido (Host)', async () => {
      const r = await c
        .http()
        .get(`/rutas/${rutaBrasilId}/lecturas?porPagina=3`)
        .set(bearer(ramon))
        .set('Host', '10.0.0.5:3000')
        .expect(200);
      for (const l of r.body.datos as Lectura[])
        expect(l.fotoUri.startsWith('http://10.0.0.5:3000/archivos/')).toBe(
          true,
        );
    });
  });

  describe('Novedades de Brasil (mocks/incidents.ts)', () => {
    it('20 novedades en orden de recorrido, iguales al mock', () => {
      expect(novedades).toHaveLength(20);
      const esperadas = INDICES_NOVEDAD.map((i) => ({ i, n: novedadMock(i) }));
      expect(novedades.map((n) => n.id)).toEqual(esperadas.map((e) => e.n.id));
      novedades.forEach((n, k) => {
        const { fotoUri, audioUri, ...a } = n;
        const { fotoUri: _f, audioUri: _a, ...e } = esperadas[k].n;
        expect(a, n.id).toEqual(e);
        expect(new URL(fotoUri).pathname).toMatch(RUTA_FOTO);
        if (n.id !== 'nov-3312') expect(audioUri, n.id).toBeNull();
      });
    });

    it('PRD: nov-3312 en sum-004150, perro suelto, con nota de voz subida a esta API', async () => {
      const n = novedades.find((x) => x.id === 'nov-3312')!;
      expect(n).toMatchObject({
        suministroId: 'sum-004150',
        motivo: 'perro_suelto',
        comentario: null,
        fechaHora: '2026-09-15T08:31:00-03:00',
      });
      expect(n.audioUri).toMatch(/^https?:\/\/[^/]+\/archivos\/audios\/.+/);
      const r = await c
        .http()
        .get(new URL(n.audioUri!).pathname)
        .set('Range', 'bytes=0-7')
        .expect(206);
      expect(r.headers['content-type']).toMatch(/^audio\//);
      const entero = await c
        .http()
        .get(new URL(n.audioUri!).pathname)
        .expect(200);
      expect(Buffer.from(entero.body).subarray(4, 8).toString()).toBe('ftyp');
    });

    it('hay una novedad de cada uno de los 7 motivos y ningún comentario es ""', () => {
      expect(new Set(novedades.map((n) => n.motivo)).size).toBe(7);
      for (const n of novedades) expect(n.comentario).not.toBe('');
    });

    it('las 20 fotos de novedad se bajan', async () => {
      for (const n of novedades) {
        const r = await c.http().get(new URL(n.fotoUri).pathname).expect(200);
        expect(r.headers['content-type']).toMatch(/^image\//);
      }
    });

    it('filtro ?motivo= y resumen de administración con los conteos del mock', async () => {
      const esperados = new Map<string, number>();
      for (const i of INDICES_NOVEDAD) {
        const m = novedadMock(i).motivo;
        esperados.set(m, (esperados.get(m) ?? 0) + 1);
      }
      for (const [motivo, cant] of esperados) {
        const r = await c
          .http()
          .get(`/rutas/${rutaBrasilId}/novedades?motivo=${motivo}`)
          .set(bearer(ramon))
          .expect(200);
        expect(r.body.meta.total, motivo).toBe(cant);
      }
      const res = await c
        .http()
        .get('/novedades/resumen?bimestre=2026-05&porPagina=100')
        .set(bearer(laura))
        .expect(200);
      esperarContrato(res.body, 'ResumenNovedades');
      const esperadoRes = [...esperados]
        .map(([motivo, cantidad]) => ({
          motivo,
          zona: 'Barrio Brasil',
          cantidad,
        }))
        .sort(
          (a, b) =>
            b.cantidad - a.cantidad ||
            a.motivo.localeCompare(b.motivo) ||
            a.zona.localeCompare(b.zona),
        );
      expect(res.body.datos).toEqual(esperadoRes);
      // sin bimestre: el actual según el reloj (15/09/2026 → 2026-05)
      const def = await c
        .http()
        .get('/novedades/resumen')
        .set(bearer(laura))
        .expect(200);
      expect(def.body.datos).toEqual(esperadoRes);
      const otro = await c
        .http()
        .get('/novedades/resumen?bimestre=2026-04')
        .set(bearer(laura))
        .expect(200);
      expect(otro.body).toEqual({
        datos: [],
        meta: { total: 0, pagina: 1, porPagina: 20 },
      });
      const lista = await c
        .http()
        .get('/novedades?zona=Barrio%20Brasil&porPagina=100')
        .set(bearer(laura))
        .expect(200);
      esperarContrato(lista.body, 'Novedad');
      expect(lista.body.meta.total).toBe(20);
    });
  });

  describe('Paquete de descarga y avance sobre las semillas (R7, R10)', () => {
    it('avance de Brasil: 200 / 20 leídos / 20 con novedad / 160 pendientes / 2 fuera de rango', async () => {
      const r = await c
        .http()
        .get(`/rutas/${rutaBrasilId}/avance`)
        .set(bearer(ramon))
        .expect(200);
      esperarContrato(r.body, 'AvanceRuta');
      expect(r.body.datos).toEqual({
        rutaId: rutaBrasilId,
        suministros: 200,
        leidos: 20,
        conNovedad: 20,
        pendientes: 160,
        fueraDeRango: 2,
      });
    });

    it('avance de una ruta de barrio sin carga: todo pendiente', async () => {
      const r = await c
        .http()
        .get('/rutas/rut-01-2026-05/avance')
        .set(bearer(laura))
        .expect(200);
      expect(r.body.datos).toMatchObject({
        suministros: 20,
        leidos: 0,
        conNovedad: 0,
        pendientes: 20,
        fueraDeRango: 0,
      });
    });

    it('la descarga de la 07: 200 suministros y 200 medidores uno a uno, 20 lecturas, 20 novedades, descargadaEn intacta', async () => {
      const r = await c
        .http()
        .post(`/rutas/${rutaBrasilId}/descarga`)
        .set(bearer(ramon))
        .expect(200);
      esperarContrato(r.body, 'PaqueteRuta');
      const p = r.body.datos;
      expect(p.suministros.map((s: Suministro) => s.id)).toEqual(
        BRASIL.map((e) => e.s.id),
      );
      expect(p.medidores.map((m: Medidor) => m.id)).toEqual(
        BRASIL.map((e) => e.m.id),
      );
      expect(p.lecturas).toHaveLength(20);
      expect(p.novedades).toHaveLength(20);
      expect(p.ruta.estado).toBe('en_curso');
      expect(p.ruta.descargadaEn).toBe('2026-09-15T07:40:00-03:00');
      const m25 = p.medidores[25] as Medidor;
      expect(m25).toMatchObject({
        multiplicador: 10,
        videoInstructivoUrl: null,
      });
      // sin lectura anterior (índice 10)
      expect(p.suministros[10]).toMatchObject({
        lecturaAnterior: null,
        fechaLecturaAnterior: null,
        consumoPromedio: null,
      });
    });
  });

  describe('Permisos con los usuarios sembrados (R3)', () => {
    it('/yo/rutas de Ramón: por defecto sólo la 07; con estado=cerrada la 12; con ambas, por número', async () => {
      const a = await c.http().get('/yo/rutas').set(bearer(ramon)).expect(200);
      esperarContrato(a.body, 'Ruta');
      expect(a.body.datos.map((r: Ruta) => r.id)).toEqual([rutaBrasilId]);
      const b = await c
        .http()
        .get('/yo/rutas?estado=cerrada')
        .set(bearer(ramon))
        .expect(200);
      expect(b.body.datos.map((r: Ruta) => r.id)).toEqual(['rut-12-2026-05']);
      const t = await c
        .http()
        .get('/yo/rutas?estado=en_curso,cerrada')
        .set(bearer(ramon))
        .expect(200);
      expect(t.body.datos.map((r: Ruta) => r.id)).toEqual([
        rutaBrasilId,
        'rut-12-2026-05',
      ]);
    });

    it('un lector no ve rutas, lecturas, suministros ni medidores ajenos, ni los listados de administración', async () => {
      const jorge = await ingresar(c, {
        legajo: 'L-013',
        contrasena: 'lectura',
      });
      for (const ruta of [
        `/rutas/${rutaBrasilId}`,
        `/rutas/${rutaBrasilId}/suministros`,
        `/rutas/${rutaBrasilId}/lecturas`,
        `/rutas/${rutaBrasilId}/novedades`,
        `/rutas/${rutaBrasilId}/avance`,
        '/lecturas/lec-88201',
        '/novedades/nov-3312',
        '/suministros/sum-004120',
        '/medidores/med-A88413',
        '/medidores/qr/COOP-CHJ:med-A88413',
        '/suministros',
        '/rutas',
        '/usuarios',
        '/novedades',
        '/novedades/resumen',
      ]) {
        const r = await c.http().get(ruta).set(bearer(jorge)).expect(403);
        esperarError(r.body, 'SIN_PERMISO');
        expect(r.body.error.mensaje).not.toMatch(JERGA);
      }
      await c
        .http()
        .post(`/rutas/${rutaBrasilId}/descarga`)
        .set(bearer(jorge))
        .expect(403);
    });

    it('sin token no se ve nada de los datos de demo', async () => {
      for (const ruta of [
        '/rutas',
        '/suministros/sum-004120',
        '/lecturas/lec-88201',
      ])
        esperarError(
          (await c.http().get(ruta).expect(401)).body,
          'NO_AUTENTICADO',
        );
    });

    it('administración lee lecturas y novedades por id', async () => {
      const l = await c
        .http()
        .get('/lecturas/lec-88201')
        .set(bearer(laura))
        .expect(200);
      esperarContrato(l.body, 'Lectura');
      const n = await c
        .http()
        .get('/novedades/nov-3312')
        .set(bearer(laura))
        .expect(200);
      esperarContrato(n.body, 'Novedad');
      esperarError(
        (
          await c
            .http()
            .get('/lecturas/lec-99999')
            .set(bearer(laura))
            .expect(404)
        ).body,
        'LECTURA_NO_ENCONTRADA',
      );
    });
  });

  describe('Rutas cerradas sembradas (R22): "Esa ruta fue cerrada el 14/09."', () => {
    const MENSAJE = 'Esa ruta fue cerrada el 14/09.';
    it('cerrar de nuevo la 12 → 409 con el mensaje exacto del PRD', async () => {
      const r = await c
        .http()
        .post('/rutas/rut-12-2026-05/cierre')
        .set(bearer(ramon))
        .send({ lecturaIds: [], novedadIds: [] })
        .expect(409);
      esperarError(r.body, 'RUTA_YA_CERRADA');
      expect(r.body.error.mensaje).toBe(MENSAJE);
    });

    it('descargar la 12 y editarla (admin) dan el mismo código y mensaje', async () => {
      const d = await c
        .http()
        .post('/rutas/rut-12-2026-05/descarga')
        .set(bearer(ramon))
        .expect(409);
      expect(d.body.error).toEqual({
        codigo: 'RUTA_YA_CERRADA',
        mensaje: MENSAJE,
      });
      const p = await c
        .http()
        .patch('/rutas/rut-12-2026-05')
        .set(bearer(laura))
        .send({ nombre: 'Otro nombre' })
        .expect(409);
      expect(p.body.error).toEqual({
        codigo: 'RUTA_YA_CERRADA',
        mensaje: MENSAJE,
      });
    });

    it('cargar una lectura nueva en la ruta cerrada 12 → RUTA_YA_CERRADA', async () => {
      const foto = new URL(lecturas[0].fotoUri).pathname;
      const r = await c
        .http()
        .post('/lecturas')
        .set(bearer(ramon))
        .send({
          rutaId: 'rut-12-2026-05',
          suministroId: 'sum-008001',
          valor: 820,
          fotoUri: `http://127.0.0.1${foto}`,
          coordenadas: null,
          confirmadaPorLector: false,
          fechaHora: '2026-09-15T07:30:00-03:00',
        });
      // el origen de la foto puede no coincidir con el del pedido; la regla de cerrada va primero (R12)
      expect(r.status).toBe(409);
      expect(r.body.error).toEqual({
        codigo: 'RUTA_YA_CERRADA',
        mensaje: MENSAJE,
      });
    });

    it('las otras cerradas del mock (03, 06, 10, 14, 17, 20) también cierran el 14/09', async () => {
      for (const [n, u] of [
        ['03', 'L-014'],
        ['06', 'L-017'],
        ['10', 'L-020'],
        ['14', 'L-023'],
        ['17', 'L-026'],
        ['20', 'L-029'],
      ]) {
        const t = await ingresar(c, { legajo: u, contrasena: 'lectura' });
        const r = await c
          .http()
          .post(`/rutas/rut-${n}-2026-05/cierre`)
          .set(bearer(t))
          .send({ lecturaIds: [], novedadIds: [] })
          .expect(409);
        expect(r.body.error.mensaje, n).toBe(MENSAJE);
      }
    });
  });

  describe('Idempotencia sobre datos sembrados (R15, AGENTS §10.5)', () => {
    it('reenviar lec-88201 tal cual (con su foto ya subida) → 200 con la existente, sin duplicar', async () => {
      const original = (
        await c.http().get('/lecturas/lec-88201').set(bearer(ramon)).expect(200)
      ).body.datos as Lectura;
      const r = await c
        .http()
        .post('/lecturas')
        .set(bearer(ramon))
        .send(original);
      expect(r.status).toBe(200);
      esperarContrato(r.body, 'Lectura');
      expect(sinOrigen(r.body.datos)).toEqual(sinOrigen(original));
      const lista = await c
        .http()
        .get(`/rutas/${rutaBrasilId}/lecturas?porPagina=200`)
        .set(bearer(ramon))
        .expect(200);
      expect(lista.body.meta.total).toBe(20);
    });

    it('reenviar nov-3312 tal cual → 200 con la existente', async () => {
      const original = (
        await c.http().get('/novedades/nov-3312').set(bearer(ramon)).expect(200)
      ).body.datos as Novedad;
      const r = await c
        .http()
        .post('/novedades')
        .set(bearer(ramon))
        .send(original);
      expect(r.status).toBe(200);
      expect(sinOrigen(r.body.datos)).toEqual(sinOrigen(original));
    });

    it('otro lector que manda el id de lec-88201 no lo pisa (403 o 409)', async () => {
      const original = (
        await c.http().get('/lecturas/lec-88201').set(bearer(ramon)).expect(200)
      ).body.datos as Lectura;
      const silvia = await ingresar(c, {
        legajo: 'L-012',
        contrasena: 'lectura',
      });
      const r = await c
        .http()
        .post('/lecturas')
        .set(bearer(silvia))
        .send(original);
      expect([403, 409]).toContain(r.status);
      esperarError(r.body);
    });
  });

  describe('Siembra repetida y reinicio', () => {
    it('la base ya sembrada no está vacía; sembrar otra vez no duplica nada', async () => {
      const s = c.app.get(Sembrador);
      expect(await s.estaVacia()).toBe(false);
      await s.sembrar().catch(() => undefined);
      const r = await c
        .http()
        .get('/suministros?porPagina=1')
        .set(bearer(laura))
        .expect(200);
      expect(r.body.meta.total).toBe(580);
      const u = await c
        .http()
        .get('/usuarios?porPagina=1')
        .set(bearer(laura))
        .expect(200);
      expect(u.body.meta.total).toBe(20);
      const ru = await c
        .http()
        .get('/rutas?porPagina=1')
        .set(bearer(laura))
        .expect(200);
      expect(ru.body.meta.total).toBe(20);
    });
  });
});

describe('ESPECIFICACION §8 — Cargas nuevas sobre las semillas (con escritura)', () => {
  let c: AppDePrueba;
  let laura: string;
  let ramon: string;
  let foto: string;
  let seq = 0;

  const cuerpo = (
    suministroId: string,
    valor: number,
    minuto: string,
    extra = {},
  ) => ({
    id: `lec-v8${String(++seq).padStart(4, '0')}`,
    rutaId: rutaBrasilId,
    suministroId,
    valor,
    fotoUri: foto,
    coordenadas: null,
    confirmadaPorLector: false,
    fechaHora: `2026-09-15T07:${minuto}:00-03:00`,
    ...extra,
  });

  beforeAll(async () => {
    c = await crearApp();
    await c.app.get(Sembrador).sembrar();
    laura = await ingresar(c, { legajo: 'L-030', contrasena: 'lectura' });
    ramon = await ingresar(c, { legajo: 'L-011', contrasena: 'lectura' });
    const l = await c
      .http()
      .get('/lecturas/lec-88201')
      .set(bearer(ramon))
      .expect(200);
    foto = l.body.datos.fotoUri;
  }, 120_000);
  afterAll(() => c.cerrar());

  it('conexión nueva (sum-004210, sin anterior ni promedio): consumo = valor×mult; 60 normal, 61 fuera de rango (R14/R16/D5)', async () => {
    const a = await c
      .http()
      .post('/lecturas')
      .set(bearer(ramon))
      .send(cuerpo('sum-004210', 60, '10'))
      .expect(201);
    esperarContrato(a.body, 'Lectura');
    expect(a.body.datos).toMatchObject({
      consumo: 60,
      fueraDeRango: false,
      sincronizada: true,
      lectorId: 'usr-011',
    });
    const b = await c
      .http()
      .post('/lecturas')
      .set(bearer(ramon))
      .send(cuerpo('sum-004210', 61, '11'))
      .expect(201);
    expect(b.body.datos).toMatchObject({ consumo: 61, fueraDeRango: true });
  });

  it('medidor ×10 (sum-004225, anterior 1075): (1080-1075)×10=50 normal; 1090 → 150 fuera de rango', async () => {
    const a = await c
      .http()
      .post('/lecturas')
      .set(bearer(ramon))
      .send(cuerpo('sum-004225', 1080, '12'))
      .expect(201);
    expect(a.body.datos).toMatchObject({ consumo: 50, fueraDeRango: false });
    const b = await c
      .http()
      .post('/lecturas')
      .set(bearer(ramon))
      .send(cuerpo('sum-004225', 1090, '13'))
      .expect(201);
    expect(b.body.datos).toMatchObject({ consumo: 150, fueraDeRango: true });
  });

  it('el cliente no manda lo que calcula el servidor: consumo, fueraDeRango, lectorId y sincronizada se ignoran', async () => {
    const r = await c
      .http()
      .post('/lecturas')
      .set(bearer(ramon))
      .send(
        cuerpo('sum-004300', 1000 + 3 * 100 + 9, '14', {
          consumo: 99999,
          fueraDeRango: true,
          lectorId: 'usr-012',
          sincronizada: false,
        }),
      )
      .expect(201);
    expect(r.body.datos).toMatchObject({
      consumo: 9,
      fueraDeRango: false,
      lectorId: 'usr-011',
      sincronizada: true,
    });
  });

  it('valor fuera de los 5 dígitos del medidor sembrado → LECTURA_INVALIDA; sin foto → FOTO_REQUERIDA; file:// → ARCHIVO_NO_SUBIDO', async () => {
    const a = await c
      .http()
      .post('/lecturas')
      .set(bearer(ramon))
      .send(cuerpo('sum-004301', 100000, '15'))
      .expect(422);
    esperarError(a.body, 'LECTURA_INVALIDA');
    const b = await c
      .http()
      .post('/lecturas')
      .set(bearer(ramon))
      .send({ ...cuerpo('sum-004301', 1500, '15'), fotoUri: null });
    expect([400, 422]).toContain(b.status);
    esperarError(b.body);
    const d = await c
      .http()
      .post('/lecturas')
      .set(bearer(ramon))
      .send({
        ...cuerpo('sum-004301', 1500, '15'),
        fotoUri: 'file:///lecturas/x.jpg',
      })
      .expect(422);
    esperarError(d.body, 'ARCHIVO_NO_SUBIDO');
  });

  it('un suministro de otra ruta → SUMINISTRO_FUERA_DE_RUTA; administración no carga lecturas', async () => {
    const a = await c
      .http()
      .post('/lecturas')
      .set(bearer(ramon))
      .send(cuerpo('sum-008001', 820, '16'))
      .expect(422);
    esperarError(a.body, 'SUMINISTRO_FUERA_DE_RUTA');
    const b = await c
      .http()
      .post('/lecturas')
      .set(bearer(laura))
      .send(cuerpo('sum-004302', 1000, '16'))
      .expect(403);
    esperarError(b.body, 'SIN_PERMISO');
  });

  it('R13: una lectura nueva sobre sum-004150 (que tiene nov-3312) gana: la novedad deja de ser vigente y el avance lo refleja', async () => {
    const antes = (
      await c
        .http()
        .get(`/rutas/${rutaBrasilId}/avance`)
        .set(bearer(ramon))
        .expect(200)
    ).body.datos;
    await c
      .http()
      .post('/lecturas')
      .set(bearer(ramon))
      .send(cuerpo('sum-004150', 1010, '17'))
      .expect(201);
    const novs = await c
      .http()
      .get(`/rutas/${rutaBrasilId}/novedades?porPagina=200`)
      .set(bearer(ramon))
      .expect(200);
    expect(novs.body.datos.some((n: Novedad) => n.id === 'nov-3312')).toBe(
      false,
    );
    const des = (
      await c
        .http()
        .get(`/rutas/${rutaBrasilId}/avance`)
        .set(bearer(ramon))
        .expect(200)
    ).body.datos;
    expect(des.conNovedad).toBe(antes.conNovedad - 1);
    expect(des.leidos).toBe(antes.leidos + 1);
    // nov-3312 sigue existiendo por id
    await c.http().get('/novedades/nov-3312').set(bearer(ramon)).expect(200);
  });

  it('R13: una novedad más nueva sobre una lectura sembrada (lec-88204) no la reemplaza', async () => {
    const l = (
      await c.http().get('/lecturas/lec-88204').set(bearer(ramon)).expect(200)
    ).body.datos as Lectura;
    const r = await c
      .http()
      .post('/novedades')
      .set(bearer(ramon))
      .send({
        id: 'nov-v80001',
        rutaId: rutaBrasilId,
        suministroId: l.suministroId,
        motivo: 'porton_cerrado',
        comentario: '',
        audioUri: null,
        fotoUri: foto,
        fechaHora: '2026-09-15T07:59:00-03:00',
      })
      .expect(201);
    esperarContrato(r.body, 'Novedad');
    expect(r.body.datos.comentario).toBeNull();
    const lista = await c
      .http()
      .get(`/rutas/${rutaBrasilId}/lecturas?porPagina=200`)
      .set(bearer(ramon))
      .expect(200);
    expect(lista.body.datos.some((x: Lectura) => x.id === 'lec-88204')).toBe(
      true,
    );
  });

  it('R20: cierre con un id que el servidor no tiene → 409 HAY_DATOS_SIN_SUBIR y la ruta sigue en_curso', async () => {
    const lista = (
      await c
        .http()
        .get(`/rutas/${rutaBrasilId}/lecturas?porPagina=200`)
        .set(bearer(ramon))
        .expect(200)
    ).body.datos as Lectura[];
    const novs = (
      await c
        .http()
        .get(`/rutas/${rutaBrasilId}/novedades?porPagina=200`)
        .set(bearer(ramon))
        .expect(200)
    ).body.datos as Novedad[];
    const r = await c
      .http()
      .post(`/rutas/${rutaBrasilId}/cierre`)
      .set(bearer(ramon))
      .send({
        lecturaIds: [...lista.map((l) => l.id), 'lec-nunca1', 'lec-nunca2'],
        novedadIds: [...novs.map((n) => n.id), 'nov-nunca1'],
      })
      .expect(409);
    esperarError(r.body, 'HAY_DATOS_SIN_SUBIR');
    expect(r.body.error.mensaje).toMatch(/2 lecturas/);
    expect(r.body.error.mensaje).toMatch(/1 novedad/);
    const ruta = await c
      .http()
      .get(`/rutas/${rutaBrasilId}`)
      .set(bearer(ramon))
      .expect(200);
    expect(ruta.body.datos).toMatchObject({
      estado: 'en_curso',
      cerradaEn: null,
    });
  });

  it('R21/R22: con todo recibido cierra aunque queden 160 pendientes; después cerrar de nuevo dice "cerrada el 15/09"', async () => {
    const lista = (
      await c
        .http()
        .get(`/rutas/${rutaBrasilId}/lecturas?porPagina=200`)
        .set(bearer(ramon))
        .expect(200)
    ).body.datos as Lectura[];
    const novs = (
      await c
        .http()
        .get(`/rutas/${rutaBrasilId}/novedades?porPagina=200`)
        .set(bearer(ramon))
        .expect(200)
    ).body.datos as Novedad[];
    const r = await c
      .http()
      .post(`/rutas/${rutaBrasilId}/cierre`)
      .set(bearer(ramon))
      .send({
        lecturaIds: lista.map((l) => l.id),
        novedadIds: novs.map((n) => n.id),
      })
      .expect(200);
    esperarContrato(r.body, 'Ruta');
    expect(r.body.datos).toMatchObject({
      estado: 'cerrada',
      cerradaEn: '2026-09-15T08:00:00-03:00',
      descargadaEn: '2026-09-15T07:40:00-03:00',
    });
    expect(r.body.datos.suministroIds).toHaveLength(200);
    const otra = await c
      .http()
      .post(`/rutas/${rutaBrasilId}/cierre`)
      .set(bearer(ramon))
      .send({ lecturaIds: [], novedadIds: [] })
      .expect(409);
    expect(otra.body.error).toEqual({
      codigo: 'RUTA_YA_CERRADA',
      mensaje: 'Esa ruta fue cerrada el 15/09.',
    });
    const yo = await c.http().get('/yo').set(bearer(ramon)).expect(200);
    expect(yo.body.datos.rutasAsignadas).toEqual([]);
  });

  it('R15: tras cerrarse, el reintento de una lectura que ya estaba en el servidor sigue dando 200', async () => {
    const original = (
      await c.http().get('/lecturas/lec-88201').set(bearer(ramon)).expect(200)
    ).body.datos;
    await c
      .http()
      .post('/lecturas')
      .set(bearer(ramon))
      .send(original)
      .expect(200);
  });

  it('R23: administración cierra una ruta en curso ajena (rut-02) con listas vacías', async () => {
    const r = await c
      .http()
      .post('/rutas/rut-02-2026-05/cierre')
      .set(bearer(laura))
      .send({ lecturaIds: [], novedadIds: [] })
      .expect(200);
    expect(r.body.datos).toMatchObject({
      estado: 'cerrada',
      cerradaEn: '2026-09-15T08:00:00-03:00',
    });
  });

  it('R7: la primera descarga de una ruta asignada (rut-01) pone descargadaEn y la pasa a en_curso; la segunda no lo toca', async () => {
    const silvia = await ingresar(c, {
      legajo: 'L-012',
      contrasena: 'lectura',
    });
    const a = await c
      .http()
      .post('/rutas/rut-01-2026-05/descarga')
      .set(bearer(silvia))
      .expect(200);
    expect(a.body.datos.ruta).toMatchObject({
      estado: 'en_curso',
      descargadaEn: '2026-09-15T08:00:00-03:00',
    });
    const b = await c
      .http()
      .post('/rutas/rut-01-2026-05/descarga')
      .set(bearer(silvia))
      .expect(200);
    expect(b.body.datos.ruta.descargadaEn).toBe('2026-09-15T08:00:00-03:00');
  });
});
