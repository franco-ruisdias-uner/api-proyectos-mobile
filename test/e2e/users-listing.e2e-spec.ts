import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { bearer, conSesion, crearUsuario } from '../utilities/users.js';

describe('M0 — GET /usuarios (orden, paginación y filtros)', () => {
  let d: AppDePrueba;
  let token: string;
  beforeAll(async () => {
    d = await crearApp();
    token = (
      await conSesion(d, 'administracion', {
        legajo: 'L-030',
        nombre: 'Laura Vidal',
      })
    ).token;
    await crearUsuario(d, { legajo: 'L-012', nombre: 'Silvia Fernández' });
    await crearUsuario(d, { legajo: 'l-011', nombre: 'Ramón Duarte' });
    await crearUsuario(d, { legajo: 'L-026', nombre: 'Graciela Núñez' });
    await crearUsuario(d, { legajo: 'L-020', nombre: 'Norma Cabrera' });
  });
  afterAll(() => d.cerrar());

  it('ordena por legajo (sin importar mayúsculas) y pagina', async () => {
    const r = await d.http().get('/usuarios').set(bearer(token)).expect(200);
    esperarContrato(r.body, 'Usuario');
    expect(r.body.datos.map((u: { legajo: string }) => u.legajo)).toEqual([
      'l-011',
      'L-012',
      'L-020',
      'L-026',
      'L-030',
    ]);
    expect(r.body.meta).toEqual({ total: 5, pagina: 1, porPagina: 20 });

    const p2 = await d
      .http()
      .get('/usuarios?pagina=2&porPagina=2')
      .set(bearer(token))
      .expect(200);
    esperarContrato(p2.body, 'Usuario');
    expect(p2.body.datos.map((u: { legajo: string }) => u.legajo)).toEqual([
      'L-020',
      'L-026',
    ]);
    expect(p2.body.meta).toEqual({ total: 5, pagina: 2, porPagina: 2 });
  });

  it('página fuera de rango → datos vacíos con el total', async () => {
    const r = await d
      .http()
      .get('/usuarios?pagina=9')
      .set(bearer(token))
      .expect(200);
    expect(r.body).toEqual({
      datos: [],
      meta: { total: 5, pagina: 9, porPagina: 20 },
    });
  });

  it('filtra por rol', async () => {
    const r = await d
      .http()
      .get('/usuarios?rol=administracion')
      .set(bearer(token))
      .expect(200);
    esperarContrato(r.body, 'Usuario');
    expect(r.body.datos.map((u: { legajo: string }) => u.legajo)).toEqual([
      'L-030',
    ]);
    expect(r.body.meta.total).toBe(1);
  });

  it.each([
    ['nunez', ['L-026']],
    ['NÚÑEZ', ['L-026']],
    ['ramon', ['l-011']],
    ['l-01', ['l-011', 'L-012']],
    ['  silvia  ', ['L-012']],
    ['nadie', []],
  ])(
    'buscar=%o por legajo o nombre, sin mayúsculas ni tildes',
    async (buscar, legajos) => {
      const r = await d
        .http()
        .get('/usuarios')
        .query({ buscar })
        .set(bearer(token))
        .expect(200);
      esperarContrato(r.body, 'Usuario');
      expect(r.body.datos.map((u: { legajo: string }) => u.legajo)).toEqual(
        legajos,
      );
      expect(r.body.meta.total).toBe(legajos.length);
    },
  );

  it('rol y buscar combinados', async () => {
    const r = await d
      .http()
      .get('/usuarios')
      .query({ rol: 'lector', buscar: 'laura' })
      .set(bearer(token))
      .expect(200);
    expect(r.body.datos).toEqual([]);
  });

  it.each([
    ['rol=jefe', 'El rol tiene que ser "lector" o "administracion".'],
    ['pagina=0', 'La página tiene que ser 1 o más.'],
    ['porPagina=101', 'La cantidad por página no puede pasar de 100.'],
    ['pagina=abc', 'La página tiene que ser un número entero.'],
    ['orden=nombre', 'El dato "orden" no corresponde a este pedido.'],
  ])('?%s → 400', async (query, mensaje) => {
    const r = await d
      .http()
      .get(`/usuarios?${query}`)
      .set(bearer(token))
      .expect(400);
    esperarError(r.body, 'VALIDACION_FALLIDA');
    expect(r.body.error.mensaje).toBe(mensaje);
  });
});
