import {
  LineaFavoritaEntidad,
  ParadaFavoritaEntidad,
} from '../../src/modules/users/favorite.entity.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { crearLinea, crearParada } from '../utilities/network.js';
import { crearUsuario } from '../utilities/users.js';

let ctx: AppDePrueba;
beforeAll(async () => {
  ctx = await crearApp();
});
afterAll(() => ctx.cerrar());

describe('Espec. R16 — PUT /yo/lineas-favoritas/:lineaId', () => {
  it('agrega la línea y devuelve el Usuario (200)', async () => {
    const u = await crearUsuario(ctx);
    const linea = await crearLinea(ctx);
    const r = await ctx.http.put(`/yo/lineas-favoritas/${linea.id}`).set(u.auth).expect(200);
    esperarContrato(r.body, 'Usuario');
    expect(r.body.datos.id).toBe(u.id);
    expect(r.body.datos.lineasFavoritas).toEqual([linea.id]);
    expect(r.body.datos.paradasFavoritas).toEqual([]);
    const yo = await ctx.http.get('/yo').set(u.auth);
    expect(yo.body.datos.lineasFavoritas).toEqual([linea.id]);
  });

  it('el orden es el de alta, no el alfabético', async () => {
    const u = await crearUsuario(ctx);
    const a = await crearLinea(ctx, { id: 'lin-zz1' });
    const b = await crearLinea(ctx, { id: 'lin-aa1' });
    const c = await crearLinea(ctx, { id: 'lin-mm1' });
    for (const l of [a, b, c])
      await ctx.http.put(`/yo/lineas-favoritas/${l.id}`).set(u.auth).expect(200);
    const r = await ctx.http.get('/yo').set(u.auth);
    expect(r.body.datos.lineasFavoritas).toEqual(['lin-zz1', 'lin-aa1', 'lin-mm1']);
  });

  it('es idempotente: repetir no duplica ni cambia el orden', async () => {
    const u = await crearUsuario(ctx);
    const a = await crearLinea(ctx);
    const b = await crearLinea(ctx);
    await ctx.http.put(`/yo/lineas-favoritas/${a.id}`).set(u.auth).expect(200);
    await ctx.http.put(`/yo/lineas-favoritas/${b.id}`).set(u.auth).expect(200);
    const r = await ctx.http.put(`/yo/lineas-favoritas/${a.id}`).set(u.auth).expect(200);
    expect(r.body.datos.lineasFavoritas).toEqual([a.id, b.id]);
    expect(
      await ctx.dataSource.getRepository(LineaFavoritaEntidad).countBy({ usuarioId: u.id }),
    ).toBe(2);
  });

  it('dos pedidos simultáneos dejan un solo favorito y los dos dan 200', async () => {
    const u = await crearUsuario(ctx);
    const linea = await crearLinea(ctx);
    const rs = await Promise.all([
      ctx.http.put(`/yo/lineas-favoritas/${linea.id}`).set(u.auth),
      ctx.http.put(`/yo/lineas-favoritas/${linea.id}`).set(u.auth),
    ]);
    expect(rs.map((r) => r.status)).toEqual([200, 200]);
    expect(rs[0].body.datos.lineasFavoritas).toEqual([linea.id]);
    expect(rs[1].body.datos.lineasFavoritas).toEqual([linea.id]);
    expect(
      await ctx.dataSource.getRepository(LineaFavoritaEntidad).countBy({ usuarioId: u.id }),
    ).toBe(1);
  });

  it('los favoritos son de cada usuario', async () => {
    const u1 = await crearUsuario(ctx);
    const u2 = await crearUsuario(ctx);
    const linea = await crearLinea(ctx);
    await ctx.http.put(`/yo/lineas-favoritas/${linea.id}`).set(u1.auth).expect(200);
    const r = await ctx.http.get('/yo').set(u2.auth);
    expect(r.body.datos.lineasFavoritas).toEqual([]);
  });

  it.each(['lin-no-existe', 'xxx', 'par-101', '%'])(
    'LINEA_NO_ENCONTRADA (404) con el id %s',
    async (id) => {
      const u = await crearUsuario(ctx);
      const r = await ctx.http.put(`/yo/lineas-favoritas/${encodeURIComponent(id)}`).set(u.auth);
      esperarError(r, 404, 'LINEA_NO_ENCONTRADA');
      expect(r.body.error.mensaje).toBe('No existe esa línea.');
    },
  );

  it('un id con otras mayúsculas no es el mismo id (404), en todos los motores', async () => {
    const u = await crearUsuario(ctx);
    await crearLinea(ctx, { id: 'lin-Mayus' });
    const r = await ctx.http.put('/yo/lineas-favoritas/lin-mayus').set(u.auth);
    esperarError(r, 404, 'LINEA_NO_ENCONTRADA');
  });

  it('401 sin token', async () => {
    const linea = await crearLinea(ctx);
    esperarError(await ctx.http.put(`/yo/lineas-favoritas/${linea.id}`), 401, 'NO_AUTENTICADO');
  });

  it('también lo puede usar la Dirección (es una cuenta más)', async () => {
    const d = await crearUsuario(ctx, { rol: 'direccion' });
    const linea = await crearLinea(ctx);
    await ctx.http.put(`/yo/lineas-favoritas/${linea.id}`).set(d.auth).expect(200);
  });
});

describe('Espec. R16 — DELETE /yo/lineas-favoritas/:lineaId', () => {
  it('quita la línea (204 sin cuerpo) y conserva el orden de las demás', async () => {
    const u = await crearUsuario(ctx);
    const [a, b, c] = [await crearLinea(ctx), await crearLinea(ctx), await crearLinea(ctx)];
    for (const l of [a, b, c]) await ctx.http.put(`/yo/lineas-favoritas/${l.id}`).set(u.auth);
    const r = await ctx.http.delete(`/yo/lineas-favoritas/${b.id}`).set(u.auth).expect(204);
    expect(r.text).toBe('');
    const yo = await ctx.http.get('/yo').set(u.auth);
    expect(yo.body.datos.lineasFavoritas).toEqual([a.id, c.id]);
  });

  it('volver a agregarla la deja al final', async () => {
    const u = await crearUsuario(ctx);
    const [a, b] = [await crearLinea(ctx), await crearLinea(ctx)];
    for (const l of [a, b]) await ctx.http.put(`/yo/lineas-favoritas/${l.id}`).set(u.auth);
    await ctx.http.delete(`/yo/lineas-favoritas/${a.id}`).set(u.auth).expect(204);
    await ctx.http.put(`/yo/lineas-favoritas/${a.id}`).set(u.auth).expect(200);
    const yo = await ctx.http.get('/yo').set(u.auth);
    expect(yo.body.datos.lineasFavoritas).toEqual([b.id, a.id]);
  });

  it('es idempotente: borrar algo que no era favorito, o que no existe, da 204', async () => {
    const u = await crearUsuario(ctx);
    const linea = await crearLinea(ctx);
    await ctx.http.delete(`/yo/lineas-favoritas/${linea.id}`).set(u.auth).expect(204);
    await ctx.http.delete('/yo/lineas-favoritas/lin-no-existe').set(u.auth).expect(204);
    await ctx.http.delete('/yo/lineas-favoritas/%25').set(u.auth).expect(204);
  });

  it('no toca los favoritos de otro usuario', async () => {
    const u1 = await crearUsuario(ctx);
    const u2 = await crearUsuario(ctx);
    const linea = await crearLinea(ctx);
    await ctx.http.put(`/yo/lineas-favoritas/${linea.id}`).set(u1.auth);
    await ctx.http.delete(`/yo/lineas-favoritas/${linea.id}`).set(u2.auth).expect(204);
    const yo = await ctx.http.get('/yo').set(u1.auth);
    expect(yo.body.datos.lineasFavoritas).toEqual([linea.id]);
  });

  it('401 sin token', async () => {
    esperarError(await ctx.http.delete('/yo/lineas-favoritas/lin-05'), 401, 'NO_AUTENTICADO');
  });
});

describe('Espec. R16 — PUT /yo/paradas-favoritas/:paradaId', () => {
  it('agrega la parada y devuelve el Usuario (200)', async () => {
    const u = await crearUsuario(ctx);
    const parada = await crearParada(ctx);
    const r = await ctx.http.put(`/yo/paradas-favoritas/${parada.id}`).set(u.auth).expect(200);
    esperarContrato(r.body, 'Usuario');
    expect(r.body.datos.paradasFavoritas).toEqual([parada.id]);
    expect(r.body.datos.lineasFavoritas).toEqual([]);
  });

  it('el orden es el de alta y es idempotente', async () => {
    const u = await crearUsuario(ctx);
    const a = await crearParada(ctx, { id: 'par-zz1' });
    const b = await crearParada(ctx, { id: 'par-aa1' });
    await ctx.http.put(`/yo/paradas-favoritas/${a.id}`).set(u.auth).expect(200);
    await ctx.http.put(`/yo/paradas-favoritas/${b.id}`).set(u.auth).expect(200);
    const r = await ctx.http.put(`/yo/paradas-favoritas/${a.id}`).set(u.auth).expect(200);
    expect(r.body.datos.paradasFavoritas).toEqual(['par-zz1', 'par-aa1']);
    expect(
      await ctx.dataSource.getRepository(ParadaFavoritaEntidad).countBy({ usuarioId: u.id }),
    ).toBe(2);
  });

  it('dos pedidos simultáneos dejan un solo favorito', async () => {
    const u = await crearUsuario(ctx);
    const parada = await crearParada(ctx);
    const rs = await Promise.all([
      ctx.http.put(`/yo/paradas-favoritas/${parada.id}`).set(u.auth),
      ctx.http.put(`/yo/paradas-favoritas/${parada.id}`).set(u.auth),
    ]);
    expect(rs.map((r) => r.status)).toEqual([200, 200]);
    expect(
      await ctx.dataSource.getRepository(ParadaFavoritaEntidad).countBy({ usuarioId: u.id }),
    ).toBe(1);
  });

  it.each(['par-no-existe', 'xxx', 'lin-05', '%'])(
    'PARADA_NO_ENCONTRADA (404) con el id %s',
    async (id) => {
      const u = await crearUsuario(ctx);
      const r = await ctx.http.put(`/yo/paradas-favoritas/${encodeURIComponent(id)}`).set(u.auth);
      esperarError(r, 404, 'PARADA_NO_ENCONTRADA');
      expect(r.body.error.mensaje).toBe('No existe esa parada.');
    },
  );

  it('401 sin token', async () => {
    esperarError(await ctx.http.put('/yo/paradas-favoritas/par-101'), 401, 'NO_AUTENTICADO');
  });
});

describe('Espec. R16 — DELETE /yo/paradas-favoritas/:paradaId', () => {
  it('quita la parada (204) y es idempotente', async () => {
    const u = await crearUsuario(ctx);
    const [a, b] = [await crearParada(ctx), await crearParada(ctx)];
    for (const p of [a, b]) await ctx.http.put(`/yo/paradas-favoritas/${p.id}`).set(u.auth);
    const r = await ctx.http.delete(`/yo/paradas-favoritas/${a.id}`).set(u.auth).expect(204);
    expect(r.text).toBe('');
    await ctx.http.delete(`/yo/paradas-favoritas/${a.id}`).set(u.auth).expect(204);
    await ctx.http.delete('/yo/paradas-favoritas/par-no-existe').set(u.auth).expect(204);
    const yo = await ctx.http.get('/yo').set(u.auth);
    expect(yo.body.datos.paradasFavoritas).toEqual([b.id]);
  });

  it('401 sin token', async () => {
    esperarError(await ctx.http.delete('/yo/paradas-favoritas/par-101'), 401, 'NO_AUTENTICADO');
  });
});

describe('Espec. §4 M3 — PATCH /yo', () => {
  it('cambia nombre, avisosActivos y tema, y devuelve el Usuario actualizado', async () => {
    const u = await crearUsuario(ctx, { nombre: 'Antes' });
    const linea = await crearLinea(ctx);
    await ctx.http.put(`/yo/lineas-favoritas/${linea.id}`).set(u.auth);
    const r = await ctx.http
      .patch('/yo')
      .set(u.auth)
      .send({ nombre: '  Después  ', avisosActivos: false, tema: 'oscuro' })
      .expect(200);
    esperarContrato(r.body, 'Usuario');
    expect(r.body.datos).toEqual({
      id: u.id,
      nombre: 'Después',
      email: u.email,
      lineasFavoritas: [linea.id],
      paradasFavoritas: [],
      avisosActivos: false,
      tema: 'oscuro',
    });
    const yo = await ctx.http.get('/yo').set(u.auth);
    expect(yo.body.datos).toEqual(r.body.datos);
  });

  it('es parcial: sólo cambia lo que viene', async () => {
    const u = await crearUsuario(ctx, { nombre: 'Igual', tema: 'claro', avisosActivos: false });
    const r = await ctx.http.patch('/yo').set(u.auth).send({ tema: 'sistema' }).expect(200);
    expect(r.body.datos).toMatchObject({ nombre: 'Igual', tema: 'sistema', avisosActivos: false });
  });

  it('con cuerpo vacío no cambia nada (200)', async () => {
    const u = await crearUsuario(ctx, { nombre: 'Quieto' });
    const r = await ctx.http.patch('/yo').set(u.auth).send({}).expect(200);
    expect(r.body.datos.nombre).toBe('Quieto');
  });

  it.each([
    [{ nombre: '' }, 'Falta tu nombre.'],
    [{ nombre: '   ' }, 'Falta tu nombre.'],
    [{ nombre: 'x'.repeat(101) }, 'El nombre puede tener hasta 100 letras.'],
    [{ nombre: 7 }, 'El nombre tiene que ser un texto.'],
    [{ nombre: null }, 'El nombre tiene que ser un texto.'],
    [{ avisosActivos: 'si' }, 'Los avisos tienen que ser verdadero o falso.'],
    [{ avisosActivos: null }, 'Los avisos tienen que ser verdadero o falso.'],
    [{ tema: 'rojo' }, 'El tema tiene que ser claro, oscuro o sistema.'],
    [{ tema: null }, 'El tema tiene que ser claro, oscuro o sistema.'],
    [{ email: 'otro@prueba.ar' }, 'No se esperaba el dato «email».'],
    [{ lineasFavoritas: [] }, 'No se esperaba el dato «lineasFavoritas».'],
    [{ rol: 'direccion' }, 'No se esperaba el dato «rol».'],
    [{ id: 'usr-otro' }, 'No se esperaba el dato «id».'],
  ])('400 VALIDACION_FALLIDA: %j', async (cuerpo, mensaje) => {
    const u = await crearUsuario(ctx);
    const r = await ctx.http.patch('/yo').set(u.auth).send(cuerpo);
    esperarError(r, 400, 'VALIDACION_FALLIDA');
    expect(r.body.error.mensaje).toBe(mensaje);
  });

  it('un 400 no deja cambios a medias', async () => {
    const u = await crearUsuario(ctx, { nombre: 'Intacto', tema: 'claro' });
    await ctx.http.patch('/yo').set(u.auth).send({ nombre: 'Nuevo', tema: 'rojo' }).expect(400);
    const yo = await ctx.http.get('/yo').set(u.auth);
    expect(yo.body.datos).toMatchObject({ nombre: 'Intacto', tema: 'claro' });
  });

  it('401 sin token', async () => {
    esperarError(await ctx.http.patch('/yo').send({ tema: 'oscuro' }), 401, 'NO_AUTENTICADO');
  });
});
