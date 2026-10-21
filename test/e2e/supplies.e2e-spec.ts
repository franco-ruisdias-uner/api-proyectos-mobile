import { AccesoSuministros } from '../../src/modules/supplies/supply-access.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { AccesoFijo, crearSuministro } from '../utilities/supplies.js';
import { bearer, conSesion } from '../utilities/users.js';

const numeros = (cuerpo: { datos: { numero: string }[] }) =>
  cuerpo.datos.map((s) => s.numero);

describe('M1 — GET /suministros (administración)', () => {
  let c: AppDePrueba;
  let admin: { token: string };
  beforeAll(async () => {
    c = await crearApp();
    admin = await conSesion(c, 'administracion');
    await crearSuministro(c, {
      numero: '004162',
      titular: 'Miguez, Hector',
      direccion: 'Brasil 1462',
    });
    await crearSuministro(c, {
      numero: '004120',
      titular: 'Coronel, Ramona',
      direccion: 'Brasil 1420',
    });
    await crearSuministro(c, {
      numero: '004150',
      titular: 'Peralta, Dora',
      direccion: 'Los Sauces 120',
      categoria: 'rural',
    });
    await crearSuministro(c, {
      numero: '008001',
      titular: 'Giménez, Elsa',
      direccion: 'Belgrano 100',
      categoria: 'comercial',
      activo: false,
    });
    await crearSuministro(c, {
      numero: '010001',
      titular: 'López, 50% Carmen',
      direccion: 'Mitre_5',
    });
  });
  afterAll(() => c.cerrar());

  it('ordena por número como texto y cumple el contrato', async () => {
    const r = await c
      .http()
      .get('/suministros')
      .set(bearer(admin.token))
      .expect(200);
    esperarContrato(r.body, 'Suministro');
    expect(numeros(r.body)).toEqual([
      '004120',
      '004150',
      '004162',
      '008001',
      '010001',
    ]);
    expect(r.body.meta).toEqual({ total: 5, pagina: 1, porPagina: 20 });
  });

  it('pagina y, fuera de rango, devuelve datos vacíos con el total', async () => {
    const p2 = await c
      .http()
      .get('/suministros?pagina=2&porPagina=2')
      .set(bearer(admin.token))
      .expect(200);
    esperarContrato(p2.body, 'Suministro');
    expect(numeros(p2.body)).toEqual(['004162', '008001']);
    expect(p2.body.meta).toEqual({ total: 5, pagina: 2, porPagina: 2 });
    const fuera = await c
      .http()
      .get('/suministros?pagina=9')
      .set(bearer(admin.token))
      .expect(200);
    expect(fuera.body).toEqual({
      datos: [],
      meta: { total: 5, pagina: 9, porPagina: 20 },
    });
  });

  it('numero filtra por coincidencia exacta, con los ceros', async () => {
    const r = await c
      .http()
      .get('/suministros?numero=004120')
      .set(bearer(admin.token))
      .expect(200);
    expect(numeros(r.body)).toEqual(['004120']);
    const sinCeros = await c
      .http()
      .get('/suministros?numero=4120')
      .set(bearer(admin.token))
      .expect(200);
    expect(sinCeros.body).toEqual({
      datos: [],
      meta: { total: 0, pagina: 1, porPagina: 20 },
    });
  });

  it('buscar encuentra por titular o por dirección, sin importar mayúsculas ni tildes', async () => {
    const t = await c
      .http()
      .get('/suministros?buscar=gimenez')
      .set(bearer(admin.token))
      .expect(200);
    expect(numeros(t.body)).toEqual(['008001']);
    const d = await c
      .http()
      .get('/suministros?buscar=BRASIL')
      .set(bearer(admin.token))
      .expect(200);
    expect(numeros(d.body)).toEqual(['004120', '004162']);
    expect(d.body.meta.total).toBe(2);
  });

  it('buscar no toma % ni _ como comodines', async () => {
    const pct = await c
      .http()
      .get('/suministros?buscar=%25')
      .set(bearer(admin.token))
      .expect(200);
    expect(numeros(pct.body)).toEqual(['010001']);
    const guion = await c
      .http()
      .get('/suministros?buscar=_')
      .set(bearer(admin.token))
      .expect(200);
    expect(numeros(guion.body)).toEqual(['010001']);
    const nada = await c
      .http()
      .get('/suministros?buscar=zzz')
      .set(bearer(admin.token))
      .expect(200);
    expect(nada.body.meta.total).toBe(0);
  });

  it('buscar y paginar juntos dan el total filtrado', async () => {
    const r = await c
      .http()
      .get('/suministros?buscar=brasil&porPagina=1&pagina=2')
      .set(bearer(admin.token))
      .expect(200);
    expect(numeros(r.body)).toEqual(['004162']);
    expect(r.body.meta).toEqual({ total: 2, pagina: 2, porPagina: 1 });
  });

  it('filtra por categoría', async () => {
    const r = await c
      .http()
      .get('/suministros?categoria=rural')
      .set(bearer(admin.token))
      .expect(200);
    expect(numeros(r.body)).toEqual(['004150']);
  });

  it('filtra por activo', async () => {
    const no = await c
      .http()
      .get('/suministros?activo=false')
      .set(bearer(admin.token))
      .expect(200);
    expect(numeros(no.body)).toEqual(['008001']);
    expect(no.body.datos[0].activo).toBe(false);
    const si = await c
      .http()
      .get('/suministros?activo=true')
      .set(bearer(admin.token))
      .expect(200);
    expect(si.body.meta.total).toBe(4);
  });

  it('combina los filtros', async () => {
    const r = await c
      .http()
      .get('/suministros?buscar=brasil&categoria=residencial&activo=true')
      .set(bearer(admin.token))
      .expect(200);
    expect(numeros(r.body)).toEqual(['004120', '004162']);
    const ninguno = await c
      .http()
      .get('/suministros?buscar=brasil&categoria=rural')
      .set(bearer(admin.token))
      .expect(200);
    expect(ninguno.body.meta.total).toBe(0);
  });

  it.each([
    ['categoria=agropecuaria', 'categoría'],
    ['activo=quizas', 'activo'],
    ['pagina=0', 'página'],
    ['porPagina=101', 'por página'],
  ])('400 VALIDACION_FALLIDA con ?%s', async (consulta) => {
    const r = await c
      .http()
      .get(`/suministros?${consulta}`)
      .set(bearer(admin.token))
      .expect(400);
    esperarError(r.body, 'VALIDACION_FALLIDA');
  });

  it('401 sin token', async () => {
    const r = await c.http().get('/suministros').expect(401);
    esperarError(r.body, 'NO_AUTENTICADO');
  });

  it('403 SIN_PERMISO para un lector (R3)', async () => {
    const lector = await conSesion(c, 'lector');
    const r = await c
      .http()
      .get('/suministros')
      .set(bearer(lector.token))
      .expect(403);
    esperarError(r.body, 'SIN_PERMISO');
  });
});

describe('M1 — GET /suministros (lista vacía)', () => {
  it('sin suministros: datos vacíos y total 0', async () => {
    const c = await crearApp();
    try {
      const admin = await conSesion(c, 'administracion');
      const r = await c
        .http()
        .get('/suministros')
        .set(bearer(admin.token))
        .expect(200);
      expect(r.body).toEqual({
        datos: [],
        meta: { total: 0, pagina: 1, porPagina: 20 },
      });
    } finally {
      await c.cerrar();
    }
  });
});

describe('M1 — GET /suministros/:id', () => {
  let c: AppDePrueba;
  const acceso = new AccesoFijo();
  beforeAll(async () => {
    c = await crearApp({ sustitutos: [[AccesoSuministros, acceso]] });
  });
  afterAll(() => c.cerrar());

  it('administración lo ve con todos los campos del PRD', async () => {
    const admin = await conSesion(c, 'administracion');
    await crearSuministro(c, {
      id: 'sum-004120',
      numero: '004120',
      titular: 'Coronel, Ramona',
      direccion: 'Brasil 1420',
      latitud: -30.7521,
      longitud: -57.9814,
      lecturaAnterior: 1284,
      fechaLecturaAnterior: new Date('2026-07-14T12:30:00Z'),
      consumoPromedio: 18,
      medidor: { id: 'med-A88413' },
    });
    const r = await c
      .http()
      .get('/suministros/sum-004120')
      .set(bearer(admin.token))
      .expect(200);
    esperarContrato(r.body, 'Suministro');
    expect(r.body.datos).toEqual({
      id: 'sum-004120',
      numero: '004120',
      titular: 'Coronel, Ramona',
      direccion: 'Brasil 1420',
      coordenadas: { latitud: -30.7521, longitud: -57.9814 },
      categoria: 'residencial',
      medidorId: 'med-A88413',
      lecturaAnterior: 1284,
      fechaLecturaAnterior: '2026-07-14T09:30:00-03:00',
      consumoPromedio: 18,
      activo: true,
    });
  });

  it('una conexión nueva viaja con null (no ausente ni "")', async () => {
    const admin = await conSesion(c, 'administracion');
    await crearSuministro(c, {
      id: 'sum-004204',
      numero: '004204',
      lecturaAnterior: null,
      fechaLecturaAnterior: null,
      consumoPromedio: null,
    });
    const r = await c
      .http()
      .get('/suministros/sum-004204')
      .set(bearer(admin.token))
      .expect(200);
    esperarContrato(r.body, 'Suministro');
    expect(r.body.datos).toMatchObject({
      lecturaAnterior: null,
      fechaLecturaAnterior: null,
      consumoPromedio: null,
    });
  });

  it('un lector lo ve si está en una de sus rutas', async () => {
    const lector = await conSesion(c, 'lector');
    await crearSuministro(c, { id: 'sum-004300', numero: '004300' });
    acceso.dar(lector.id, 'sum-004300');
    const r = await c
      .http()
      .get('/suministros/sum-004300')
      .set(bearer(lector.token))
      .expect(200);
    esperarContrato(r.body, 'Suministro');
  });

  it('un lector no ve uno que no es de sus rutas: 403, no 404 (R3)', async () => {
    const lector = await conSesion(c, 'lector');
    await crearSuministro(c, { id: 'sum-004301', numero: '004301' });
    const r = await c
      .http()
      .get('/suministros/sum-004301')
      .set(bearer(lector.token))
      .expect(403);
    esperarError(r.body, 'SIN_PERMISO');
  });

  it('404 SUMINISTRO_NO_ENCONTRADO si no existe (administración y lector)', async () => {
    const admin = await conSesion(c, 'administracion');
    const lector = await conSesion(c, 'lector');
    for (const t of [admin.token, lector.token]) {
      const r = await c
        .http()
        .get('/suministros/sum-999999')
        .set(bearer(t))
        .expect(404);
      esperarError(r.body, 'SUMINISTRO_NO_ENCONTRADO');
    }
  });

  it('400 con un id que no tiene la forma de un suministro', async () => {
    const admin = await conSesion(c, 'administracion');
    const r = await c
      .http()
      .get('/suministros/med-1')
      .set(bearer(admin.token))
      .expect(400);
    esperarError(r.body, 'VALIDACION_FALLIDA');
  });

  it('401 sin token', async () => {
    const r = await c.http().get('/suministros/sum-004120').expect(401);
    esperarError(r.body, 'NO_AUTENTICADO');
  });
});
