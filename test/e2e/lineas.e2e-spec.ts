import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearLinea, crearParada } from '../utilidades/red.js';

let ctx: AppDePrueba;
beforeAll(async () => {
  ctx = await crearApp();
});
afterAll(() => ctx.cerrar());

describe('Espec. M1 — GET /lineas y GET /lineas/:id (PRD §1, tipo Linea)', () => {
  it('es público y devuelve la Linea con un recorrido por sentido y las paradas en orden', async () => {
    const p1 = await crearParada(ctx, { sentido: 'ida' });
    const p2 = await crearParada(ctx, { sentido: 'ida' });
    const p3 = await crearParada(ctx, { sentido: 'vuelta' });
    const linea = await crearLinea(ctx, {
      id: 'lin-05',
      numero: '5',
      nombre: 'Puerto Viejo — San Agustín',
      color: '#1B6CA8',
      empresa: 'Transporte Mariano Moreno',
      recorridos: [
        {
          sentido: 'ida',
          destino: 'hacia Puerto Viejo',
          trazado: [
            { latitud: -31.73, longitud: -60.53 },
            { latitud: -31.7333, longitud: -60.5241 },
          ],
          paradaIds: [p2.id, p1.id],
        },
        { sentido: 'vuelta', destino: 'hacia San Agustín', paradaIds: [p3.id] },
      ],
    });
    const r = await ctx.http.get(`/lineas/${linea.id}`).expect(200);
    esperarContrato(r.body, 'Linea');
    expect(r.body.datos).toEqual({
      id: 'lin-05',
      numero: '5',
      nombre: 'Puerto Viejo — San Agustín',
      color: '#1B6CA8',
      empresa: 'Transporte Mariano Moreno',
      activa: true,
      recorridos: [
        {
          sentido: 'ida',
          destino: 'hacia Puerto Viejo',
          trazado: [
            { latitud: -31.73, longitud: -60.53 },
            { latitud: -31.7333, longitud: -60.5241 },
          ],
          paradaIds: [p2.id, p1.id],
        },
        {
          sentido: 'vuelta',
          destino: 'hacia San Agustín',
          trazado: expect.any(Array),
          paradaIds: [p3.id],
        },
      ],
    });
  });

  it('una línea sin recorridos cargados tiene recorridos: [] y una inactiva dice activa: false', async () => {
    const linea = await crearLinea(ctx, { activa: false });
    const r = await ctx.http.get(`/lineas/${linea.id}`).expect(200);
    esperarContrato(r.body, 'Linea');
    expect(r.body.datos.recorridos).toEqual([]);
    expect(r.body.datos.activa).toBe(false);
  });

  it('la lista va ordenada por número ("2" antes que "14") y trae meta', async () => {
    const otra = await crearApp();
    try {
      for (const numero of ['14', '2', '10', '1', '9']) await crearLinea(otra, { numero });
      const r = await otra.http.get('/lineas').expect(200);
      esperarContrato(r.body, 'Linea');
      expect(r.body.datos.map((l: { numero: string }) => l.numero)).toEqual([
        '1',
        '2',
        '9',
        '10',
        '14',
      ]);
      expect(r.body.meta).toEqual({ total: 5, pagina: 1, porPagina: 20 });
    } finally {
      await otra.cerrar();
    }
  });

  it('la lista vacía es datos: [] con total 0', async () => {
    const otra = await crearApp();
    try {
      const r = await otra.http.get('/lineas').expect(200);
      esperarContrato(r.body, 'Linea');
      expect(r.body).toEqual({ datos: [], meta: { total: 0, pagina: 1, porPagina: 20 } });
    } finally {
      await otra.cerrar();
    }
  });

  it('pagina, y una página fuera de rango da datos: [] con el total correcto (AGENTS §4.2)', async () => {
    const otra = await crearApp();
    try {
      for (const numero of ['1', '2', '3', '4', '5']) await crearLinea(otra, { numero });
      const r = await otra.http.get('/lineas?pagina=2&porPagina=2').expect(200);
      expect(r.body.datos.map((l: { numero: string }) => l.numero)).toEqual(['3', '4']);
      expect(r.body.meta).toEqual({ total: 5, pagina: 2, porPagina: 2 });
      const fuera = await otra.http.get('/lineas?pagina=9&porPagina=2').expect(200);
      expect(fuera.body).toEqual({ datos: [], meta: { total: 5, pagina: 9, porPagina: 2 } });
    } finally {
      await otra.cerrar();
    }
  });

  it.each([
    ['pagina=0'],
    ['pagina=-1'],
    ['pagina=a'],
    ['porPagina=0'],
    ['porPagina=101'],
    ['porPagina=1.5'],
    ['pagina='],
    ['extra=1'],
  ])('VALIDACION_FALLIDA con ?%s', async (consulta) => {
    const r = await ctx.http.get(`/lineas?${consulta}`);
    esperarError(r, 400, 'VALIDACION_FALLIDA');
  });

  it('LINEA_NO_ENCONTRADA (404) si no existe, y también con un id mal formado', async () => {
    for (const id of ['lin-zzz', 'lin-', 'xx', 'par-101', 'LIN-05']) {
      const r = await ctx.http.get(`/lineas/${id}`);
      esperarError(r, 404, 'LINEA_NO_ENCONTRADA');
      expect(r.body.error.mensaje).toBe('No existe esa línea.');
    }
  });

  it('el id no distingue mayúsculas en ningún motor: LIN-05 no es lin-05', async () => {
    await crearLinea(ctx, { id: 'lin-mayus' });
    await ctx.http.get('/lineas/lin-mayus').expect(200);
    esperarError(await ctx.http.get('/lineas/LIN-MAYUS'), 404, 'LINEA_NO_ENCONTRADA');
  });

  it('no agrega campos que no están en el PRD (AGENTS §4.5)', async () => {
    const linea = await crearLinea(ctx);
    const r = await ctx.http.get(`/lineas/${linea.id}`);
    expect(Object.keys(r.body.datos).sort()).toEqual([
      'activa',
      'color',
      'empresa',
      'id',
      'nombre',
      'numero',
      'recorridos',
    ]);
  });

  it('simulación apagada en tests: X-Simular no hace nada', async () => {
    await ctx.http.get('/lineas').set('X-Simular', 'error-500').expect(200);
  });
});
