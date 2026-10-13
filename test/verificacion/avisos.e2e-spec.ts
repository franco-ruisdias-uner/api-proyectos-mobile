// Verificación independiente de M6 — Avisos (caja negra, AGENTS §12).
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearRuta } from '../utilidades/rutas.js';
import { crearSuministro } from '../utilidades/suministros.js';
import { bearer, conSesion } from '../utilidades/usuarios.js';

type Sesion = Awaited<ReturnType<typeof conSesion>>;
const tk = (n: string) => `ExponentPushToken[ver6${n}xxxxxxxxxxxxxxxx]`;

describe('Verificación M6 — Avisos de ruta nueva (Especificación §9, D17), caja negra', () => {
  let c: AppDePrueba;
  let admin: Sesion;
  let a: Sesion;
  let b: Sesion;
  let n = 0;

  const alta = (s: Sesion, token: string) =>
    c.almacenTokens.guardar(s.id, token, 'android');
  const suministros = async (k: number) => {
    const r: string[] = [];
    for (let i = 0; i < k; i++)
      r.push((await crearSuministro(c)).suministro.id);
    return r;
  };
  const numero = () => String(40 + ++n).padStart(2, '0');
  const crear = async (extra: Record<string, unknown> = {}) =>
    c
      .http()
      .post('/rutas')
      .set(bearer(admin.token))
      .send({
        numero: numero(),
        nombre: 'Barrio Brasil',
        bimestre: '2026-05',
        lectorId: a.id,
        suministroIds: await suministros(2),
        ...extra,
      });
  const parchar = (id: string, body: object, s: Sesion = admin) =>
    c.http().patch(`/rutas/${id}`).set(bearer(s.token)).send(body);
  const tokensEnviados = () =>
    c.enviador.enviados.flatMap((m) => m.tokens).sort();

  beforeAll(async () => {
    c = await crearApp();
    admin = await conSesion(c, 'administracion', { legajo: 'V6-ADM' });
    a = await conSesion(c, 'lector', { legajo: 'V6-A' });
    b = await conSesion(c, 'lector', { legajo: 'V6-B' });
    await alta(a, tk('A'));
    await alta(b, tk('B'));
    await alta(admin, tk('ADM'));
  });
  afterAll(() => c.cerrar());
  beforeEach(() => c.enviador.limpiar());

  describe('Forma del mensaje (§9)', () => {
    it('texto exacto, datos todos string, un solo mensaje para el lector, y la respuesta pasa el contrato', async () => {
      const r = await crear({ numero: '07', nombre: 'Barrio Brasil' }).then(
        (x) => x,
      );
      expect(r.status).toBe(201);
      esperarContrato(r.body, 'Ruta');
      await c.avisos.esperarPendientes();
      expect(c.enviador.enviados).toHaveLength(1);
      const m = c.enviador.enviados[0];
      expect(m.cuerpo).toBe('Tenés una ruta nueva: 07 Barrio Brasil.');
      expect(m.tokens).toEqual([tk('A')]);
      expect(typeof m.titulo).toBe('string');
      expect(m.titulo.length).toBeGreaterThan(0);
      for (const v of Object.values(m.datos)) expect(typeof v).toBe('string');
    });

    it('el nombre con tildes, comillas y signos sale tal cual', async () => {
      await crear({ nombre: 'Ñandú "Sur" & Cía. ¿ok?' }).then((x) =>
        expect(x.status).toBe(201),
      );
      await c.avisos.esperarPendientes();
      expect(c.enviador.enviados[0].cuerpo).toMatch(
        /^Tenés una ruta nueva: \d\d Ñandú "Sur" & Cía\. ¿ok\?\.$/,
      );
    });

    it('el mensaje no es jerga: sin ids de usuario ni palabras técnicas', async () => {
      await crear();
      await c.avisos.esperarPendientes();
      const m = c.enviador.enviados[0];
      expect(`${m.titulo} ${m.cuerpo}`).not.toMatch(
        /usr-|undefined|null|Expo|token|\[object/i,
      );
    });
  });

  describe('Destinatarios', () => {
    it('lector con dos dispositivos: ambos tokens reciben el aviso', async () => {
      const dos = await conSesion(c, 'lector', { legajo: 'V6-DOS' });
      await alta(dos, tk('D1'));
      await alta(dos, tk('D2'));
      await c.avisos.esperarPendientes();
      c.enviador.limpiar();
      await crear({ lectorId: dos.id });
      await c.avisos.esperarPendientes();
      expect(tokensEnviados()).toEqual([tk('D1'), tk('D2')].sort());
    });

    it('no recibe la administración que asigna ni otros lectores', async () => {
      await crear({ lectorId: a.id });
      await c.avisos.esperarPendientes();
      expect(tokensEnviados()).toEqual([tk('A')]);
    });

    it('PATCH que cambia de lector: sólo el nuevo; el anterior y la administración no', async () => {
      const r = await crear({ lectorId: a.id });
      await c.avisos.esperarPendientes();
      c.enviador.limpiar();
      const p = await parchar(r.body.datos.id, { lectorId: b.id });
      expect(p.status).toBe(200);
      esperarContrato(p.body, 'Ruta');
      await c.avisos.esperarPendientes();
      expect(tokensEnviados()).toEqual([tk('B')]);
      expect(c.enviador.enviados[0].datos.rutaId ?? r.body.datos.id).toBe(
        r.body.datos.id,
      );
    });

    it('vuelta atrás: A -> B -> A avisa a B y después a A', async () => {
      const r = await crear({ lectorId: a.id });
      await c.avisos.esperarPendientes();
      c.enviador.limpiar();
      await parchar(r.body.datos.id, { lectorId: b.id }).expect(200);
      await parchar(r.body.datos.id, { lectorId: a.id }).expect(200);
      await c.avisos.esperarPendientes();
      expect(c.enviador.enviados.flatMap((m) => m.tokens)).toEqual([
        tk('B'),
        tk('A'),
      ]);
    });

    it('en_curso también avisa al cambiar de lector (R6)', async () => {
      const ruta = await crearRuta(c, {
        numero: numero(),
        lectorId: a.id,
        estado: 'en_curso',
      });
      await parchar(ruta.id, { lectorId: b.id }).expect(200);
      await c.avisos.esperarPendientes();
      expect(tokensEnviados()).toEqual([tk('B')]);
    });

    it('PATCH con lectorId nuevo y suministroIds a la vez (ruta asignada): avisa una sola vez', async () => {
      const ruta = await crearRuta(c, {
        numero: numero(),
        lectorId: a.id,
        cantidad: 2,
      });
      const nuevos = await suministros(2);
      await parchar(ruta.id, {
        lectorId: b.id,
        suministroIds: nuevos,
      }).expect(200);
      await c.avisos.esperarPendientes();
      expect(c.enviador.enviados).toHaveLength(1);
      expect(c.enviador.enviados[0].tokens).toEqual([tk('B')]);
    });
  });

  describe('Cuándo NO se avisa', () => {
    it('PATCH sin lectorId, o con el mismo lector, no avisa', async () => {
      const r = await crear();
      await c.avisos.esperarPendientes();
      c.enviador.limpiar();
      await parchar(r.body.datos.id, { nombre: 'Otro' }).expect(200);
      await parchar(r.body.datos.id, { lectorId: a.id }).expect(200);
      await parchar(r.body.datos.id, {}).then((x) =>
        expect([200, 400]).toContain(x.status),
      );
      await c.avisos.esperarPendientes();
      expect(c.enviador.enviados).toEqual([]);
    });

    it('PATCH rechazado (ruta cerrada, lector inexistente, lector administración, ruta inexistente) no avisa y no cambia nada', async () => {
      const cerrada = await crearRuta(c, {
        numero: numero(),
        lectorId: a.id,
        estado: 'cerrada',
      });
      const abierta = await crearRuta(c, { numero: numero(), lectorId: a.id });
      const x1 = await parchar(cerrada.id, { lectorId: b.id });
      expect(x1.status).toBe(409);
      esperarError(x1.body, 'RUTA_YA_CERRADA');
      const x2 = await parchar(abierta.id, { lectorId: 'usr-noexiste' });
      expect(x2.status).toBe(422);
      esperarError(x2.body, 'LECTOR_NO_ENCONTRADO');
      const x3 = await parchar(abierta.id, { lectorId: admin.id });
      expect(x3.status).toBe(422);
      esperarError(x3.body, 'LECTOR_NO_ENCONTRADO');
      const x4 = await parchar('rut-99-2026-05', { lectorId: b.id });
      expect(x4.status).toBe(404);
      await c.avisos.esperarPendientes();
      expect(c.enviador.enviados).toEqual([]);
      const g = await c
        .http()
        .get(`/rutas/${abierta.id}`)
        .set(bearer(admin.token));
      expect(g.body.datos.lectorId).toBe(a.id);
    });

    it('PATCH con lectorId nuevo pero suministroIds inválidos en ruta en_curso (409): no avisa y el lector no cambia', async () => {
      const ruta = await crearRuta(c, {
        numero: numero(),
        lectorId: a.id,
        estado: 'en_curso',
      });
      const r = await parchar(ruta.id, {
        lectorId: b.id,
        suministroIds: await suministros(1),
      });
      expect(r.status).toBe(409);
      esperarError(r.body, 'RUTA_EN_CURSO');
      await c.avisos.esperarPendientes();
      expect(c.enviador.enviados).toEqual([]);
      const g = await c
        .http()
        .get(`/rutas/${ruta.id}`)
        .set(bearer(admin.token));
      expect(g.body.datos.lectorId).toBe(a.id);
    });

    it('POST /rutas rechazado (duplicada, suministro repetido, suministro en otra ruta, validación) no avisa', async () => {
      const ok = await crear({ numero: '88' });
      expect(ok.status).toBe(201);
      await c.avisos.esperarPendientes();
      c.enviador.limpiar();
      const dup = await crear({ numero: '88' });
      expect(dup.status).toBe(409);
      const s = await suministros(1);
      const rep = await crear({ suministroIds: [s[0], s[0]] });
      expect(rep.status).toBe(422);
      const otra = await crear({ suministroIds: ok.body.datos.suministroIds });
      expect(otra.status).toBe(409);
      esperarError(otra.body, 'SUMINISTRO_EN_OTRA_RUTA');
      const mala = await crear({ bimestre: '2026-07' });
      expect(mala.status).toBe(400);
      const extra = await crear({ avisar: true });
      expect(extra.status).toBe(400);
      await c.avisos.esperarPendientes();
      expect(c.enviador.enviados).toEqual([]);
    });

    it('un lector (o sin token) que intenta asignar rutas: 403/401 y sin aviso', async () => {
      const body = {
        numero: '77',
        nombre: 'X',
        bimestre: '2026-05',
        lectorId: b.id,
        suministroIds: await suministros(1),
      };
      const l = await c.http().post('/rutas').set(bearer(a.token)).send(body);
      expect(l.status).toBe(403);
      esperarError(l.body, 'SIN_PERMISO');
      const s = await c.http().post('/rutas').send(body);
      expect(s.status).toBe(401);
      esperarError(s.body, 'NO_AUTENTICADO');
      const ruta = await crearRuta(c, { numero: numero(), lectorId: a.id });
      const p = await parchar(ruta.id, { lectorId: b.id }, a);
      expect(p.status).toBe(403);
      await c.avisos.esperarPendientes();
      expect(c.enviador.enviados).toEqual([]);
    });

    it('otros hechos no avisan: descargar, cargar lectura/cierre no mandan push (sólo la asignación)', async () => {
      const ruta = await crearRuta(c, { numero: numero(), lectorId: a.id });
      await c
        .http()
        .post(`/rutas/${ruta.id}/descarga`)
        .set(bearer(a.token))
        .expect(200);
      await c
        .http()
        .post(`/rutas/${ruta.id}/cierre`)
        .set(bearer(a.token))
        .send({ lecturaIds: [], novedadIds: [] })
        .expect(200);
      await c.avisos.esperarPendientes();
      expect(c.enviador.enviados).toEqual([]);
    });
  });

  describe('Sin interruptor de avisos (D17) y lector sin dispositivos', () => {
    it('lector sin dispositivos: la ruta se crea y no se manda nada', async () => {
      const sin = await conSesion(c, 'lector', { legajo: 'V6-SIN' });
      const r = await crear({ lectorId: sin.id });
      expect(r.status).toBe(201);
      await c.avisos.esperarPendientes();
      expect(c.enviador.enviados).toEqual([]);
    });

    it('después de dar de baja su token, ya no recibe', async () => {
      const u = await conSesion(c, 'lector', { legajo: 'V6-BAJA' });
      await alta(u, tk('BAJA'));
      await c.almacenTokens.borrar(tk('BAJA'));
      await crear({ lectorId: u.id });
      await c.avisos.esperarPendientes();
      expect(c.enviador.enviados).toEqual([]);
    });

    it('teléfono compartido: el token pasó al otro usuario, el aviso va a quien lo tiene ahora', async () => {
      const m = await conSesion(c, 'lector', { legajo: 'V6-MAN' });
      const t = await conSesion(c, 'lector', { legajo: 'V6-TAR' });
      await alta(m, tk('SHARED'));
      await alta(t, tk('SHARED'));
      await crear({ lectorId: m.id });
      await c.avisos.esperarPendientes();
      expect(c.enviador.enviados).toEqual([]);
      await crear({ lectorId: t.id });
      await c.avisos.esperarPendientes();
      expect(tokensEnviados()).toEqual([tk('SHARED')]);
    });
  });

  describe('Errores de Expo no rompen el pedido (AGENTS §9)', () => {
    it('POST /rutas: Expo falla -> 201, la ruta existe y es legible por el lector', async () => {
      c.enviador.fallar = true;
      const r = await crear();
      expect(r.status).toBe(201);
      esperarContrato(r.body, 'Ruta');
      await c.avisos.esperarPendientes();
      const g = await c
        .http()
        .get(`/rutas/${r.body.datos.id}`)
        .set(bearer(a.token));
      expect(g.status).toBe(200);
    });

    it('PATCH: Expo falla -> 200 y el cambio de lector queda', async () => {
      const r = await crear();
      await c.avisos.esperarPendientes();
      c.enviador.fallar = true;
      const p = await parchar(r.body.datos.id, { lectorId: b.id });
      expect(p.status).toBe(200);
      expect(p.body.datos.lectorId).toBe(b.id);
      await c.avisos.esperarPendientes();
    });

    it('token inválido según Expo: se descarta, el próximo aviso no lo incluye, el pedido sigue en 201', async () => {
      const u = await conSesion(c, 'lector', { legajo: 'V6-INV' });
      await alta(u, tk('MALO'));
      await alta(u, tk('BUENO'));
      c.enviador.invalidos.add(tk('MALO'));
      expect((await crear({ lectorId: u.id })).status).toBe(201);
      await c.avisos.esperarPendientes();
      c.enviador.limpiar();
      await crear({ lectorId: u.id });
      await c.avisos.esperarPendientes();
      expect(tokensEnviados()).toEqual([tk('BUENO')]);
    });
  });

  describe('Concurrencia', () => {
    it('dos altas simultáneas de la misma ruta: una 201 y una 409, y un solo aviso', async () => {
      const ids = await suministros(2);
      const body = {
        numero: '99',
        nombre: 'Doble',
        bimestre: '2026-05',
        lectorId: a.id,
        suministroIds: ids,
      };
      const go = () =>
        c.http().post('/rutas').set(bearer(admin.token)).send(body);
      const [x, y] = await Promise.all([go(), go()]);
      expect([x.status, y.status].sort()).toEqual([201, 409]);
      await c.avisos.esperarPendientes();
      expect(c.enviador.enviados).toHaveLength(1);
    });

    it('dos PATCH simultáneos al mismo lector nuevo: el pedido no falla y a lo sumo hay dos avisos al mismo token', async () => {
      const r = await crear();
      await c.avisos.esperarPendientes();
      c.enviador.limpiar();
      const [x, y] = await Promise.all([
        parchar(r.body.datos.id, { lectorId: b.id }),
        parchar(r.body.datos.id, { lectorId: b.id }),
      ]);
      expect(x.status).toBe(200);
      expect(y.status).toBe(200);
      await c.avisos.esperarPendientes();
      expect(c.enviador.enviados.length).toBeLessThanOrEqual(2);
      expect(tokensEnviados().every((t) => t === tk('B'))).toBe(true);
    });
  });

  describe('Envío colgado (app propia, para no contaminar a las demás)', () => {
    it('un envío que nunca termina no bloquea la respuesta', async () => {
      const d = await crearApp();
      try {
        const ad = await conSesion(d, 'administracion', { legajo: 'V6C-ADM' });
        const l = await conSesion(d, 'lector', { legajo: 'V6C-L' });
        await d.almacenTokens.guardar(l.id, tk('COLG'), 'ios');
        d.enviador.enviar = () => new Promise(() => undefined);
        const sum = (await crearSuministro(d)).suministro.id;
        const r = await Promise.race([
          d
            .http()
            .post('/rutas')
            .set(bearer(ad.token))
            .send({
              numero: '05',
              nombre: 'Colgada',
              bimestre: '2026-05',
              lectorId: l.id,
              suministroIds: [sum],
            }),
          new Promise<'colgado'>((res) =>
            setTimeout(() => res('colgado'), 4000),
          ),
        ]);
        expect(r).not.toBe('colgado');
        expect((r as { status: number }).status).toBe(201);
      } finally {
        // no se espera lo pendiente: el envío nunca termina
        void d.app.close();
      }
    });
  });
});
