import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { conSesion, MUESTRAS, registrarTurista, subirArchivo } from '../utilities/builders.js';

describe('AGENTS §7.1 — GET /yo', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('devuelve el Usuario del PRD, sin rol ni hash', async () => {
    const { token, usuario } = await registrarTurista(ctx, { nombre: 'Lucía' });
    const res = await ctx.http().get('/yo').set(conSesion(token)).expect(200);
    esperarContrato(res.body, 'Usuario');
    expect(res.body.datos).toEqual(usuario);
  });

  it('NO_AUTENTICADO sin token', async () => {
    esperarError(await ctx.http().get('/yo'), 401, 'NO_AUTENTICADO');
  });
});

describe('AGENTS §7.1 y R18 — PATCH /yo', () => {
  let ctx: AppDePrueba;
  let token: string;
  beforeEach(async () => {
    ctx = await crearApp();
    ({ token } = await registrarTurista(ctx, { nombre: 'Lucía' }));
  });
  afterEach(() => ctx.cerrar());

  const patch = (cuerpo: object) => ctx.http().patch('/yo').set(conSesion(token)).send(cuerpo);

  it('cambia el nombre', async () => {
    const res = await patch({ nombre: '  Lucía Méndez  ' }).expect(200);
    esperarContrato(res.body, 'Usuario');
    expect(res.body.datos.nombre).toBe('Lucía Méndez');
    const yo = await ctx.http().get('/yo').set(conSesion(token));
    expect(yo.body.datos.nombre).toBe('Lucía Méndez');
  });

  it('un cuerpo vacío no cambia nada', async () => {
    const antes = await ctx.http().get('/yo').set(conSesion(token));
    const res = await patch({}).expect(200);
    expect(res.body.datos).toEqual(antes.body.datos);
  });

  it('R18 — preferencias se mezcla campo a campo', async () => {
    await patch({ preferencias: { tema: 'oscuro' } }).expect(200);
    const res = await patch({ preferencias: { radioAvisoMetros: 500, avisarProximidad: false } }).expect(200);
    esperarContrato(res.body, 'Usuario');
    expect(res.body.datos.preferencias).toEqual({
      categoriasFavoritas: [],
      avisarProximidad: false,
      radioAvisoMetros: 500,
      tema: 'oscuro',
    });
  });

  it.each([100, 250, 500])('R18 — radioAvisoMetros %i es válido', async (radio) => {
    const res = await patch({ preferencias: { radioAvisoMetros: radio } }).expect(200);
    expect(res.body.datos.preferencias.radioAvisoMetros).toBe(radio);
  });

  it.each([
    [
      { preferencias: { radioAvisoMetros: 300 } },
      'La distancia de aviso tiene que ser 100, 250 o 500 metros.',
    ],
    [
      { preferencias: { radioAvisoMetros: '250' } },
      'La distancia de aviso tiene que ser 100, 250 o 500 metros.',
    ],
    [{ preferencias: { tema: 'rosa' } }, 'El tema tiene que ser claro, oscuro o sistema.'],
    [{ preferencias: { avisarProximidad: 'si' } }, 'El aviso de lugares cercanos tiene que ser sí o no.'],
    [{ preferencias: { avisarProximidad: null } }, 'El aviso de lugares cercanos tiene que ser sí o no.'],
    [
      { preferencias: { categoriasFavoritas: 'cat-museos' } },
      'Las categorías favoritas tienen que ser una lista.',
    ],
    [
      { preferencias: { categoriasFavoritas: ['museos'] } },
      'Alguna de las categorías elegidas no es válida.',
    ],
    [{ preferencias: 'oscuro' }, 'Las preferencias no son válidas.'],
    [{ nombre: '' }, 'El nombre no puede quedar vacío.'],
    [{ nombre: null }, 'El nombre no puede quedar vacío.'],
    [{ avatarUrl: 42 }, 'La foto de perfil no es válida.'],
  ])('VALIDACION_FALLIDA: %j', async (cuerpo, mensaje) => {
    const res = await patch(cuerpo);
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    expect(res.body.error.mensaje).toBe(mensaje);
  });

  it.each([
    { email: 'otro@mail.com' },
    { id: 'usr-otro' },
    { creadoEn: '2020-01-01T00:00:00-03:00' },
    { preferencias: { color: 'rojo' } },
  ])('campos que no se pueden cambiar → VALIDACION_FALLIDA: %j', async (cuerpo) => {
    esperarError(await patch(cuerpo), 400, 'VALIDACION_FALLIDA');
  });

  it('R18 — CATEGORIA_NO_ENCONTRADA con una categoría que no existe', async () => {
    esperarError(
      await patch({ preferencias: { categoriasFavoritas: ['cat-inexistente'] } }),
      422,
      'CATEGORIA_NO_ENCONTRADA',
    );
  });

  it('R18 — una lista de categorías vacía es válida', async () => {
    const res = await patch({ preferencias: { categoriasFavoritas: [] } }).expect(200);
    expect(res.body.datos.preferencias.categoriasFavoritas).toEqual([]);
  });

  it('R18 — avatarUrl subida por /archivos se guarda y vuelve absoluta con el origen del pedido', async () => {
    const url = await subirArchivo(ctx, token);
    const clave = new URL(url).pathname;
    const res = await patch({ avatarUrl: url }).set('Host', '10.0.0.5:3000').expect(200);
    esperarContrato(res.body, 'Usuario');
    expect(res.body.datos.avatarUrl).toBe(`http://10.0.0.5:3000${clave}`);
    const yo = await ctx.http().get('/yo').set(conSesion(token)).set('Host', '192.168.0.10:3000');
    expect(yo.body.datos.avatarUrl).toBe(`http://192.168.0.10:3000${clave}`);
  });

  it('avatarUrl: null saca la foto', async () => {
    await patch({ avatarUrl: await subirArchivo(ctx, token) }).expect(200);
    const res = await patch({ avatarUrl: null }).expect(200);
    expect(res.body.datos.avatarUrl).toBeNull();
  });

  it.each([
    ['un file:// del teléfono', 'file:///data/user/0/host.exp/cache/foto.jpg'],
    ['una URL de otro sitio', 'https://otro-sitio.com/fotos/perfil.jpg'],
    ['una clave que no existe', 'http://127.0.0.1/archivos/imagenes/2026/11/noexiste1234.jpg'],
    ['texto cualquiera', 'mi foto'],
  ])('R18 — ARCHIVO_NO_SUBIDO con %s', async (_caso, url) => {
    esperarError(await patch({ avatarUrl: url }), 422, 'ARCHIVO_NO_SUBIDO');
  });

  it('R18 — ARCHIVO_NO_SUBIDO si el avatar no es una imagen', async () => {
    const audio = await subirArchivo(ctx, token, MUESTRAS.m4a(), 'audio.m4a');
    esperarError(await patch({ avatarUrl: audio }), 422, 'ARCHIVO_NO_SUBIDO');
  });

  it('NO_AUTENTICADO sin token', async () => {
    esperarError(await ctx.http().patch('/yo').send({ nombre: 'X' }), 401, 'NO_AUTENTICADO');
  });
});
