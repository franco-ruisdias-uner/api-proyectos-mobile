import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarContrato } from '../utilities/contract.js';
import { conSesion } from '../utilities/builders.js';
import { duracionMp3Constante } from '../utilities/audio.js';
import { Sembrador } from '../../src/seeds/seed.js';
import { USUARIOS_SEMILLA } from '../../src/seeds/data/users.js';
import type { Categoria, Evento, Favorito, Lugar, Visita } from '../../contract/types.js';

describe('AGENTS §10.4 — Los datos de demo cumplen el contrato', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
    await ctx.app.get(Sembrador).sembrar();
  });
  afterAll(() => ctx.cerrar());

  it.each(USUARIOS_SEMILLA.map((u) => [u.email, u]))(
    '%s ingresa con su contraseña de demo',
    async (_email, u) => {
      const ingreso = await ctx
        .http()
        .post('/auth/ingreso')
        .send({ email: u.email, contrasena: u.contrasena })
        .expect(200);
      esperarContrato(ingreso.body, 'Sesion');
      const yo = await ctx.http().get('/yo').set(conSesion(ingreso.body.datos.token)).expect(200);
      esperarContrato(yo.body, 'Usuario');
      expect(yo.body.datos.id).toBe(u.id);
    },
  );

  it('especificación §8 — usr-201 es Lucía Méndez, como en el PRD', async () => {
    const ingreso = await ctx
      .http()
      .post('/auth/ingreso')
      .send({ email: 'lucia@mail.com', contrasena: 'lucia1234' });
    expect(ingreso.body.datos.usuario).toMatchObject({
      id: 'usr-201',
      nombre: 'Lucía Méndez',
      email: 'lucia@mail.com',
      avatarUrl: null,
      preferencias: {
        categoriasFavoritas: ['cat-museos', 'cat-playas'],
        avisarProximidad: true,
        radioAvisoMetros: 250,
        tema: 'sistema',
      },
    });
  });

  it('R18 — las categorías favoritas de usr-201 existen: puede volver a guardarlas', async () => {
    const ingreso = await ctx
      .http()
      .post('/auth/ingreso')
      .send({ email: 'lucia@mail.com', contrasena: 'lucia1234' });
    const res = await ctx
      .http()
      .patch('/yo')
      .set(conSesion(ingreso.body.datos.token))
      .send({ preferencias: { categoriasFavoritas: ['cat-museos', 'cat-playas'] } })
      .expect(200);
    esperarContrato(res.body, 'Usuario');
  });

  it('especificación §8 — el recorrido de Lucía: vis-311 con foto subida, una sin foto, un lugar repetido', async () => {
    const ingreso = await ctx
      .http()
      .post('/auth/ingreso')
      .send({ email: 'lucia@mail.com', contrasena: 'lucia1234' });
    const token = ingreso.body.datos.token;
    const res = await ctx.http().get('/yo/visitas').set(conSesion(token)).expect(200);
    esperarContrato(res.body, 'Visita');
    const visitas = res.body.datos as Visita[];
    expect(visitas.length).toBeGreaterThanOrEqual(3);
    const fechas = visitas.map((v) => v.fechaHora);
    expect(fechas).toEqual([...fechas].sort());
    const v311 = visitas.find((v) => v.id === 'vis-311');
    expect(v311).toMatchObject({
      usuarioId: 'usr-201',
      lugarId: 'lug-004',
      origen: 'qr',
      sincronizada: true,
    });
    expect(v311?.fotoUri).toMatch(/^http:\/\/.+\/archivos\/imagenes\//);
    await ctx
      .http()
      .get(new URL(v311?.fotoUri as string).pathname)
      .expect(200);
    expect(visitas.some((v) => v.fotoUri === null)).toBe(true);
    const porLugar = visitas.map((v) => v.lugarId);
    expect(new Set(porLugar).size).toBeLessThan(porLugar.length);
  });

  it('especificación §8 — los favoritos de Lucía cumplen el contrato y traen fav-088', async () => {
    const ingreso = await ctx
      .http()
      .post('/auth/ingreso')
      .send({ email: 'lucia@mail.com', contrasena: 'lucia1234' });
    const res = await ctx.http().get('/yo/favoritos').set(conSesion(ingreso.body.datos.token)).expect(200);
    esperarContrato(res.body, 'Favorito');
    const favoritos = res.body.datos as Favorito[];
    expect(favoritos).toHaveLength(3);
    expect(favoritos.find((f) => f.id === 'fav-088')).toMatchObject({
      usuarioId: 'usr-201',
      lugarId: 'lug-004',
    });
  });

  it('especificación §8 — el admin de demo ingresa y puede cambiar el estado de un evento', async () => {
    const ingreso = await ctx
      .http()
      .post('/auth/ingreso')
      .send({ email: 'turismo@colon.demo.ar', contrasena: 'turismo1234' })
      .expect(200);
    await ctx
      .http()
      .patch('/eventos/evt-017/estado')
      .set(conSesion(ingreso.body.datos.token))
      .send({ estado: 'programado' })
      .expect(200);
  });

  it('especificación §8 — Lucía tiene guardada la peña de hoy (evt-017)', async () => {
    const ingreso = await ctx
      .http()
      .post('/auth/ingreso')
      .send({ email: 'lucia@mail.com', contrasena: 'lucia1234' });
    const res = await ctx
      .http()
      .get('/yo/eventos-guardados')
      .set(conSesion(ingreso.body.datos.token))
      .expect(200);
    esperarContrato(res.body, 'Evento');
    expect(res.body.datos.map((e: { id: string }) => e.id)).toEqual(['evt-017']);
  });

  it('especificación §8 — el usuario nuevo no tiene favoritos ni visitas (listas vacías)', async () => {
    const ingreso = await ctx
      .http()
      .post('/auth/ingreso')
      .send({ email: 'nuevo@demo.ar', contrasena: 'nuevo1234' });
    const token = ingreso.body.datos.token;
    for (const ruta of ['/yo/visitas', '/yo/favoritos', '/yo/eventos-guardados']) {
      const res = await ctx.http().get(ruta).set(conSesion(token)).expect(200);
      expect(res.body.datos).toEqual([]);
    }
  });

  it('sembrar sólo si está vacía: no duplica', async () => {
    expect(await ctx.app.get(Sembrador).estaVacia()).toBe(false);
  });
});

describe('Especificación §8 — Catálogo de demo', () => {
  let ctx: AppDePrueba;
  let categorias: Categoria[];
  /** Todos, incluidos los dados de baja. */
  let lugares: Lugar[];
  const lugar = (id: string) => lugares.find((l) => l.id === id) as Lugar;

  beforeAll(async () => {
    ctx = await crearApp();
    await ctx.app.get(Sembrador).sembrar();
    const cats = await ctx.http().get('/categorias?porPagina=100').expect(200);
    esperarContrato(cats.body, 'Categoria');
    categorias = cats.body.datos;
    const todos = await ctx
      .http()
      .get('/lugares')
      .query({ porPagina: 500, actualizadoDesde: '2000-01-01T00:00:00-03:00' })
      .expect(200);
    // Cada registro sembrado, contra el contrato.
    esperarContrato(todos.body, 'Lugar');
    lugares = todos.body.datos;
  });
  afterAll(() => ctx.cerrar());

  it('las 7 categorías del PRD §1, con íconos de Ionicons que existen', () => {
    const nombres = categorias.map((c) => c.nombre);
    for (const n of [
      'Playas',
      'Termas',
      'Museos y patrimonio',
      'Gastronomía',
      'Artesanías',
      'Naturaleza',
      'Alojamiento',
    ]) {
      expect(nombres).toContain(n);
    }
    // Íconos de Ionicons 7 (@react-native-vector-icons/ionicons).
    const IONICONS = [
      'sunny-outline',
      'water-outline',
      'business-outline',
      'restaurant-outline',
      'color-palette-outline',
      'leaf-outline',
      'bed-outline',
      'wine-outline',
    ];
    for (const c of categorias) {
      expect(IONICONS).toContain(c.icono);
      expect(c.color).toMatch(/^#[0-9A-F]{6}$/);
    }
    expect(categorias.find((c) => c.id === 'cat-museos')).toEqual({
      id: 'cat-museos',
      nombre: 'Museos y patrimonio',
      icono: 'business-outline',
      color: '#8E5A4A',
      orden: 3,
    });
  });

  it('entre 25 y 30 lugares, todos con una categoría que existe', () => {
    expect(lugares.length).toBeGreaterThanOrEqual(25);
    expect(lugares.length).toBeLessThanOrEqual(30);
    const ids = new Set(categorias.map((c) => c.id));
    for (const l of lugares) expect(ids.has(l.categoriaId)).toBe(true);
  });

  it('lug-004 es el Molino Forclaz del ejemplo del PRD', () => {
    const molino = lugar('lug-004');
    expect(molino).toMatchObject({
      id: 'lug-004',
      nombre: 'Molino Forclaz',
      categoriaId: 'cat-museos',
      descripcionCorta: 'Molino de viento de 1888 levantado por colonos suizos.',
      coordenadas: { latitud: -32.1904, longitud: -58.1932 },
      direccion: 'Colonia San José, Ruta Provincial 26',
      horarios: [
        { dia: 2, abre: '09:00', cierra: '19:00' },
        { dia: 6, abre: '10:00', cierra: '20:00' },
      ],
      telefono: '345-4421234',
      sitioWeb: null,
      precioEntrada: 1500,
      codigoQr: 'COLON:lug-004',
      accesible: false,
      activo: true,
      actualizadoEn: '2026-08-01T10:30:00-03:00',
    });
    expect(molino.audioguia).toMatchObject({ duracionSegundos: 252, idioma: 'es' });
    expect(molino.imagenes).toHaveLength(1);
  });

  it('lug-009 es el anfiteatro (lo usa el evento evt-017 del PRD)', () => {
    expect(lugar('lug-009').nombre).toMatch(/anfiteatro/i);
  });

  it('PRD §6 — 8 audioguías, en lugares de museos y patrimonio o naturaleza, de 3 a 5 minutos', () => {
    const conAudio = lugares.filter((l) => l.audioguia);
    expect(conAudio).toHaveLength(8);
    for (const l of conAudio) {
      expect(['cat-museos', 'cat-naturaleza']).toContain(l.categoriaId);
      expect(l.audioguia?.duracionSegundos).toBeGreaterThanOrEqual(180);
      expect(l.audioguia?.duracionSegundos).toBeLessThanOrEqual(300);
    }
  });

  it('R20 — la duración de cada audioguía coincide con la del archivo (±1 s) y R19: se baja por partes', async () => {
    for (const l of lugares.filter((x) => x.audioguia)) {
      const ruta = new URL(l.audioguia!.url).pathname;
      const archivo = await ctx
        .http()
        .get(ruta)
        .buffer(true)
        .parse((res, fin) => {
          const partes: Buffer[] = [];
          res.on('data', (p: Buffer) => partes.push(p));
          res.on('end', () => fin(null, Buffer.concat(partes)));
        })
        .expect(200);
      expect(archivo.headers['content-type']).toBe('audio/mpeg');
      const real = duracionMp3Constante(archivo.body as Buffer);
      expect(Math.abs(real - l.audioguia!.duracionSegundos), l.id).toBeLessThanOrEqual(1);
      await ctx.http().get(ruta).set('Range', 'bytes=1000-1999').expect(206);
    }
  });

  it('las imágenes sembradas se pueden bajar', async () => {
    const urls = new Set(lugares.flatMap((l) => l.imagenes));
    expect(urls.size).toBeGreaterThan(0);
    for (const url of urls) {
      const res = await ctx.http().get(new URL(url).pathname).expect(200);
      expect(res.headers['content-type']).toBe('image/png');
    }
  });

  describe('casos feos que pide el PRD', () => {
    it('la mayoría sin audioguía', () => {
      expect(lugares.filter((l) => l.audioguia === null).length).toBeGreaterThan(lugares.length / 2);
    });

    it('al menos dos sin teléfono', () => {
      expect(lugares.filter((l) => l.telefono === null).length).toBeGreaterThanOrEqual(2);
    });

    it('una categoría sin lugares', async () => {
      const vacias = categorias.filter((c) => !lugares.some((l) => l.categoriaId === c.id));
      expect(vacias.length).toBeGreaterThanOrEqual(1);
      const res = await ctx.http().get('/lugares').query({ categoriaId: vacias[0].id }).expect(200);
      expect(res.body.datos).toEqual([]);
    });

    it('un nombre de más de 60 caracteres y una descripción de más de 3.000', () => {
      expect(lugares.some((l) => l.nombre.length > 60 && l.descripcion.length > 3000)).toBe(true);
    });

    it('un lugar que cierra los lunes (abre otros días)', () => {
      expect(lugares.some((l) => l.horarios.length > 0 && l.horarios.every((h) => h.dia !== 1))).toBe(true);
    });

    it('uno con dos tramos el mismo día', () => {
      expect(
        lugares.some((l) => l.horarios.some((h, i) => l.horarios.findIndex((o) => o.dia === h.dia) !== i)),
      ).toBe(true);
    });

    it('las termas tienen horario de verano distinto del de invierno', async () => {
      ctx.reloj.fijar('2027-01-15T12:00:00-03:00');
      const enVerano = (await ctx.http().get('/lugares/lug-001').expect(200)).body.datos.horarios;
      ctx.reloj.fijar('2026-07-15T12:00:00-03:00');
      const enInvierno = (await ctx.http().get('/lugares/lug-001').expect(200)).body.datos.horarios;
      ctx.reloj.fijar('2026-11-14T12:00:00-03:00');
      expect(lugar('lug-001').categoriaId).toBe('cat-termas');
      expect(enVerano).not.toEqual(enInvierno);
      expect(enVerano.length).toBeGreaterThan(0);
      expect(enInvierno.length).toBeGreaterThan(0);
    });

    it('un lugar dado de baja: no sale en el listado, sí en el detalle', async () => {
      const bajas = lugares.filter((l) => !l.activo);
      expect(bajas.length).toBeGreaterThanOrEqual(1);
      const listado = await ctx.http().get('/lugares?porPagina=500').expect(200);
      expect(listado.body.datos.map((l: Lugar) => l.id)).not.toContain(bajas[0].id);
      await ctx.http().get(`/lugares/${bajas[0].id}`).expect(200);
    });

    it('uno sin imágenes, uno gratis (0), uno con precio null y uno accesible', () => {
      expect(lugares.some((l) => l.imagenes.length === 0)).toBe(true);
      expect(lugares.some((l) => l.precioEntrada === 0)).toBe(true);
      expect(lugares.some((l) => l.precioEntrada === null)).toBe(true);
      expect(lugares.some((l) => l.accesible)).toBe(true);
    });

    it('README §7 — los casos feos que cita el README son los que hay en los datos', () => {
      expect(lugar('lug-025').nombre.length).toBeGreaterThan(60);
      expect(lugar('lug-025').descripcion.length).toBeGreaterThan(3000);
      expect(lugar('lug-003').imagenes).toEqual([]);
      expect(lugar('lug-009').horarios).toEqual([]);
      expect(lugar('lug-026').activo).toBe(false);
      expect(categorias.some((c) => c.id === 'cat-bodegas')).toBe(true);
      expect(lugares.some((l) => l.categoriaId === 'cat-bodegas')).toBe(false);
    });

    it('los QR sembrados resuelven a su lugar', async () => {
      for (const l of lugares.filter((x) => x.codigoQr)) {
        const res = await ctx
          .http()
          .get(`/lugares/qr/${encodeURIComponent(l.codigoQr!)}`)
          .expect(200);
        expect(res.body.datos.id).toBe(l.id);
      }
    });
  });
});

describe('Especificación §8 — Agenda de demo', () => {
  let ctx: AppDePrueba;
  let eventos: Evento[];

  beforeAll(async () => {
    ctx = await crearApp();
    await ctx.app.get(Sembrador).sembrar();
    const res = await ctx.http().get('/eventos').query({ desde: '2000-01-01', porPagina: 100 }).expect(200);
    esperarContrato(res.body, 'Evento');
    eventos = res.body.datos;
  });
  afterAll(() => ctx.cerrar());

  it('evt-017 es la peña en el anfiteatro (lug-009), hoy a la noche', () => {
    const e = eventos.find((x) => x.id === 'evt-017');
    expect(e).toMatchObject({
      titulo: 'Peña en el anfiteatro',
      lugarId: 'lug-009',
      inicio: '2026-11-14T21:00:00-03:00',
      estado: 'programado',
    });
  });

  it('trae los casos que pide la especificación', () => {
    const estados = eventos.map((e) => e.estado);
    for (const estado of ['programado', 'suspendido', 'cancelado', 'finalizado']) {
      expect(estados).toContain(estado);
    }
    expect(eventos.some((e) => e.lugarId === null && e.direccionLibre && e.coordenadas)).toBe(true);
    expect(eventos.some((e) => e.precio === 0)).toBe(true);
    expect(eventos.some((e) => e.precio === null)).toBe(true);
    expect(eventos.some((e) => e.fin && e.fin.slice(0, 10) !== e.inicio.slice(0, 10))).toBe(true);
    expect(eventos.some((e) => e.inicio.startsWith('2026-11-15') && e.fin === null)).toBe(true);
    expect(eventos.some((e) => e.inicio.startsWith('2026-11-24'))).toBe(true);
  });

  it('R7 — cada evento sembrado apunta a un lugar que existe', async () => {
    for (const e of eventos.filter((x) => x.lugarId)) {
      await ctx.http().get(`/lugares/${e.lugarId}`).expect(200);
    }
  });
});
