import { crearComercio, crearRubro } from '../utilidades/comercios.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { crearUsuario, type UsuarioDePrueba } from '../utilidades/usuarios.js';

describe('M7 — Avisos: push por promo nueva (ESPECIFICACION §7, A30)', () => {
  let t: AppDePrueba;
  let tornillo: UsuarioDePrueba;
  let otro: UsuarioDePrueba;
  let n = 0;

  beforeEach(async () => {
    t = await crearApp();
    await crearRubro(t, { id: 'rub-ferreteria' });
    await crearRubro(t, { id: 'rub-gastro' });
    await crearComercio(t, {
      id: 'com-118',
      nombre: 'Ferretería El Tornillo',
      rubroId: 'rub-ferreteria',
    });
    await crearComercio(t, { id: 'com-201', nombre: 'Panadería', rubroId: 'rub-gastro' });
    await crearComercio(t, {
      id: 'com-300',
      nombre: 'Cerrado',
      rubroId: 'rub-ferreteria',
      activo: false,
    });
    tornillo = await crearUsuario(t, { rol: 'comercio', comercioId: 'com-118' });
    otro = await crearUsuario(t, { rol: 'comercio', comercioId: 'com-201' });
  });
  afterEach(() => t.cerrar());

  const vecino = async (tokens: string[], extra: { avisosActivos?: boolean } = {}) => {
    const u = await crearUsuario(t, extra);
    for (const tok of tokens) {
      await t.almacen.guardar(u.id, tok, 'ios');
    }
    return u;
  };
  const tok = () => `ExponentPushToken[v${++n}]`;
  const seguir = (u: UsuarioDePrueba, c = 'com-118') =>
    t.http().put(`/yo/favoritos/${c}`).set(u.auth).expect(200);
  const interesar = (u: UsuarioDePrueba, rubros: string[]) =>
    t.http().patch('/yo').set(u.auth).send({ rubrosDeInteres: rubros }).expect(200);
  const alta = (u: UsuarioDePrueba, cuerpo: Record<string, unknown> = {}) =>
    t
      .http()
      .post('/mi-comercio/promociones')
      .set(u.auth)
      .send({
        titulo: 'Promo',
        detalle: 'Detalle.',
        hasta: '2026-10-31T23:59:59-03:00',
        ...cuerpo,
      });
  const tokensEnviados = async () => {
    await t.avisos.esperarPendientes();
    return t.enviador.enviados.flatMap((m) => m.tokens).sort();
  };

  describe('Destinatarios armados por la API pública', () => {
    it('favorito y rubro de interés vía PUT /yo/favoritos y PATCH /yo reciben el aviso', async () => {
      const a = tok();
      const b = tok();
      const fav = await vecino([a]);
      const int = await vecino([b]);
      await seguir(fav);
      await interesar(int, ['rub-ferreteria']);
      const res = await alta(tornillo).expect(201);
      esperarContrato(res.body, 'Promocion');
      expect(await tokensEnviados()).toEqual([a, b].sort());
    });

    it('quien apaga los avisos con PATCH /yo deja de recibirlos', async () => {
      const a = tok();
      const u = await vecino([a]);
      await seguir(u);
      await t.http().patch('/yo').set(u.auth).send({ avisosActivos: false }).expect(200);
      await alta(tornillo).expect(201);
      expect(await tokensEnviados()).toEqual([]);
    });

    it('quien deja de seguir (DELETE favoritos) o saca el rubro ya no recibe', async () => {
      const a = tok();
      const b = tok();
      const f = await vecino([a]);
      const i = await vecino([b]);
      await seguir(f);
      await interesar(i, ['rub-ferreteria']);
      await t.http().delete('/yo/favoritos/com-118').set(f.auth).expect(204);
      await interesar(i, []);
      await alta(tornillo).expect(201);
      expect(await tokensEnviados()).toEqual([]);
    });

    it('cambiar el rubro de interés a otro rubro no avisa por el rubro viejo', async () => {
      const a = tok();
      const u = await vecino([a]);
      await interesar(u, ['rub-gastro']);
      await alta(tornillo).expect(201);
      expect(await tokensEnviados()).toEqual([]);
      await alta(otro).expect(201);
      expect(await tokensEnviados()).toEqual([a]);
    });

    it('un favorito de otro comercio no recibe el aviso de éste', async () => {
      const a = tok();
      const u = await vecino([a]);
      await seguir(u, 'com-201');
      await alta(tornillo).expect(201);
      expect(await tokensEnviados()).toEqual([]);
    });
  });

  describe('Una sola push por persona', () => {
    it('favorito + rubro + dos dispositivos: un mensaje, con ambos tokens y sin duplicados', async () => {
      const a = tok();
      const b = tok();
      const u = await vecino([a, b]);
      await seguir(u);
      await interesar(u, ['rub-ferreteria', 'rub-gastro']);
      await alta(tornillo).expect(201);
      const tokens = await tokensEnviados();
      expect(tokens).toEqual([a, b].sort());
      expect(new Set(tokens).size).toBe(tokens.length);
    });

    it('la misma promo creada dos veces avisa dos veces (son dos promos)', async () => {
      const a = tok();
      const u = await vecino([a]);
      await seguir(u);
      await alta(tornillo).expect(201);
      await alta(tornillo).expect(201);
      expect(await tokensEnviados()).toEqual([a, a]);
    });
  });

  describe('Quién no recibe', () => {
    it('el propio comercio, aunque tenga el token registrado y siga su rubro', async () => {
      const a = tok();
      await t.almacen.guardar(tornillo.id, a, 'ios');
      await alta(tornillo).expect(201);
      expect(await tokensEnviados()).not.toContain(a);
    });

    it('un usuario sin dispositivos no rompe nada', async () => {
      const u = await vecino([]);
      await seguir(u);
      await alta(tornillo).expect(201);
      expect(t.enviador.enviados).toEqual([]);
    });

    it('un token que pasó a otro usuario avisa sólo al nuevo dueño (si corresponde)', async () => {
      const a = tok();
      const viejo = await vecino([a]);
      await seguir(viejo);
      const nuevo = await vecino([]);
      await t.almacen.guardar(nuevo.id, a, 'ios');
      await alta(tornillo).expect(201);
      expect(await tokensEnviados()).toEqual([]);
    });
  });

  describe('Contenido del aviso', () => {
    it('título = nombre del comercio, cuerpo y datos como en A30, datos todos string', async () => {
      const a = tok();
      const u = await vecino([a]);
      await seguir(u);
      const res = await alta(tornillo, { titulo: 'Dos por uno' }).expect(201);
      await t.avisos.esperarPendientes();
      expect(t.enviador.enviados).toHaveLength(1);
      const m = t.enviador.enviados[0];
      expect(m.titulo).toBe('Ferretería El Tornillo');
      expect(m.cuerpo).toBe('Nueva promoción: Dos por uno');
      expect(m.datos).toEqual({
        tipo: 'promocion',
        promocionId: res.body.datos.id,
        comercioId: 'com-118',
      });
      for (const v of Object.values(m.datos)) expect(typeof v).toBe('string');
    });

    it('también avisa de una promo que empieza en el futuro (A30)', async () => {
      const a = tok();
      const u = await vecino([a]);
      await seguir(u);
      await alta(tornillo, { desde: '2026-10-10T08:00:00-03:00' }).expect(201);
      expect(await tokensEnviados()).toEqual([a]);
    });

    it('con descuento null o definido avisa igual', async () => {
      const a = tok();
      const u = await vecino([a]);
      await seguir(u);
      await alta(tornillo, { descuento: null }).expect(201);
      await alta(tornillo, { descuento: 20 }).expect(201);
      expect(await tokensEnviados()).toEqual([a, a]);
    });
  });

  describe('Escala', () => {
    it('150 destinatarios: se avisa a todos, sin repetir, y el alta responde 201', async () => {
      const esperados: string[] = [];
      for (let i = 0; i < 150; i++) {
        const a = tok();
        esperados.push(a);
        const u = await vecino([a]);
        await interesar(u, ['rub-ferreteria']);
      }
      await alta(tornillo).expect(201);
      const tokens = await tokensEnviados();
      expect(tokens.length).toBe(new Set(tokens).size);
      for (const e of esperados) expect(tokens).toContain(e);
    }, 60_000);
  });

  describe('Qué no avisa', () => {
    it('editar, dar de baja, 400, 403 y 401 no mandan push', async () => {
      const a = tok();
      const u = await vecino([a]);
      await seguir(u);
      const res = await alta(tornillo).expect(201);
      await t.avisos.esperarPendientes();
      t.enviador.limpiar();
      const id = res.body.datos.id;
      await t
        .http()
        .patch(`/mi-comercio/promociones/${id}`)
        .set(tornillo.auth)
        .send({ titulo: 'Nuevo' })
        .expect(200);
      await t
        .http()
        .patch(`/mi-comercio/promociones/${id}`)
        .set(otro.auth)
        .send({ titulo: 'Robo' })
        .expect(403);
      await t.http().delete(`/mi-comercio/promociones/${id}`).set(tornillo.auth).expect(204);
      const malo = await alta(tornillo, { titulo: '' }).expect(400);
      esperarError(malo.body);
      const extra = await alta(tornillo, { distancia: 3 }).expect(400);
      esperarError(extra.body);
      const vec = await alta(u).expect(403);
      esperarError(vec.body);
      await t.http().post('/mi-comercio/promociones').send({}).expect(401);
      expect(await tokensEnviados()).toEqual([]);
    });

    it('alta con promo vencida (422) o hasta <= desde (400) no avisa', async () => {
      const a = tok();
      const u = await vecino([a]);
      await seguir(u);
      await alta(tornillo, {
        desde: '2026-09-01T00:00:00-03:00',
        hasta: '2026-10-01T00:00:00-03:00',
      }).expect(422);
      // DECISIONES: hasta <= desde es 400
      await alta(tornillo, {
        desde: '2026-10-20T00:00:00-03:00',
        hasta: '2026-10-10T00:00:00-03:00',
      }).expect(400);
      expect(await tokensEnviados()).toEqual([]);
    });

    it('un comercio dado de baja que crea promo: si se acepta, no revienta (sin 500)', async () => {
      const u = await crearUsuario(t, { rol: 'comercio', comercioId: 'com-300' });
      const res = await alta(u);
      expect(res.status).toBeLessThan(500);
    });
  });

  describe('Tolerancia a fallas', () => {
    it('Expo caído: el alta responde 201 con contrato válido y la promo queda guardada', async () => {
      const a = tok();
      const u = await vecino([a]);
      await seguir(u);
      t.enviador.fallarCon = new Error('Expo caído');
      const res = await alta(tornillo, { titulo: 'Con falla' }).expect(201);
      esperarContrato(res.body, 'Promocion');
      await t.avisos.esperarPendientes();
      const lista = await t.http().get('/mi-comercio/promociones').set(tornillo.auth).expect(200);
      expect(lista.body.datos.map((p: { id: string }) => p.id)).toContain(res.body.datos.id);
      // y el siguiente alta, ya con Expo sano, avisa normalmente
      t.enviador.limpiar();
      await alta(tornillo).expect(201);
      expect(await tokensEnviados()).toEqual([a]);
    });

    it('token inválido según Expo se descarta: la baja posterior no falla y no se reenvía', async () => {
      const a = tok();
      const u = await vecino([a]);
      await seguir(u);
      t.enviador.invalidos.add(a);
      await alta(tornillo).expect(201);
      await t.avisos.esperarPendientes();
      t.enviador.limpiar();
      await alta(tornillo).expect(201);
      expect(await tokensEnviados()).toEqual([]);
      expect(await t.almacen.tokensDe([u.id])).toEqual([]);
    });
  });
});
