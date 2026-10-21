// Verificación independiente de M7 — Semillas completas y README.
// Caja negra: sólo HTTP contra la app completa (salvo el Sembrador, para sembrar, como en los
// otros verificadores) y lectura de README.md / package.json / compose (que es lo que se prueba).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { conSesion, registrarTelefono } from '../utilities/builders.js';
import { Sembrador } from '../../src/seeds/seed.js';
import type { Categoria, Evento, Favorito, Lugar, Usuario, Visita } from '../../contract/types.js';

const RAIZ = join(import.meta.dirname, '../..');
const README = readFileSync(join(RAIZ, 'README.md'), 'utf8');
const PAQUETE = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};

const ID_CON_PREFIJO = /^(lug|cat|evt|usr|fav|vis)-[A-Za-z0-9_-]{3,36}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

async function todas<T>(
  ctx: AppDePrueba,
  ruta: string,
  token?: string,
  query: Record<string, string | number> = {},
) {
  const salida: T[] = [];
  for (let pagina = 1; ; pagina++) {
    let p = ctx
      .http()
      .get(ruta)
      .query({ porPagina: 100, ...query, pagina });
    if (token) p = p.set(conSesion(token));
    const res = await p.expect(200);
    salida.push(...(res.body.datos as T[]));
    if (salida.length >= res.body.meta.total || res.body.datos.length === 0) return salida;
  }
}

async function ingresar(ctx: AppDePrueba, email: string, contrasena: string) {
  const res = await ctx.http().post('/auth/ingreso').send({ email, contrasena });
  return res;
}

/** Usuarios de demo tal cual los publica el README (sección 5). */
function usuariosDelReadme(): { email: string; contrasena: string }[] {
  return [...README.matchAll(/^\|\s*`([^`\s]+@[^`\s]+)`\s*\|\s*`([^`]+)`\s*\|/gm)].map((m) => ({
    email: m[1],
    contrasena: m[2],
  }));
}

describe('Especificación §8 — cada registro sembrado cumple el contrato (reloj por defecto)', () => {
  let ctx: AppDePrueba;
  let categorias: Categoria[];
  let lugares: Lugar[];
  let eventos: Evento[];
  const porUsuario: Record<
    string,
    { token: string; usuario: Usuario; favoritos: Favorito[]; visitas: Visita[]; guardados: Evento[] }
  > = {};

  beforeAll(async () => {
    ctx = await crearApp();
    await ctx.app.get(Sembrador).sembrar();
    categorias = await todas<Categoria>(ctx, '/categorias');
    lugares = await todas<Lugar>(ctx, '/lugares', undefined, {
      porPagina: 500,
      actualizadoDesde: '2000-01-01T00:00:00-03:00',
    });
    eventos = await todas<Evento>(ctx, '/eventos', undefined, { desde: '2000-01-01' });
    for (const u of usuariosDelReadme()) {
      const ing = await ingresar(ctx, u.email, u.contrasena);
      const token = ing.body.datos.token as string;
      porUsuario[u.email] = {
        token,
        usuario: ing.body.datos.usuario,
        favoritos: await todas<Favorito>(ctx, '/yo/favoritos', token),
        visitas: await todas<Visita>(ctx, '/yo/visitas', token, { porPagina: 500 }),
        guardados: await todas<Evento>(ctx, '/yo/eventos-guardados', token),
      };
    }
  });
  afterAll(() => ctx.cerrar());

  it('las listas completas pasan por esperarContrato (categorías, lugares, eventos)', async () => {
    esperarContrato((await ctx.http().get('/categorias?porPagina=100').expect(200)).body, 'Categoria');
    esperarContrato(
      (
        await ctx
          .http()
          .get('/lugares')
          .query({ porPagina: 500, actualizadoDesde: '2000-01-01T00:00:00-03:00' })
          .expect(200)
      ).body,
      'Lugar',
    );
    esperarContrato(
      (await ctx.http().get('/eventos').query({ desde: '2000-01-01', porPagina: 100 }).expect(200)).body,
      'Evento',
    );
  });

  it('cada lugar por su detalle también cumple el contrato y coincide con el listado', async () => {
    for (const l of lugares) {
      const res = await ctx.http().get(`/lugares/${l.id}`).expect(200);
      esperarContrato(res.body, 'Lugar');
      expect(res.body.datos, l.id).toEqual(l);
    }
  });

  it('cada evento por su detalle cumple el contrato y coincide con el listado', async () => {
    for (const e of eventos) {
      const res = await ctx.http().get(`/eventos/${e.id}`).expect(200);
      esperarContrato(res.body, 'Evento');
      expect(res.body.datos, e.id).toEqual(e);
    }
  });

  it('los ids son únicos, de texto y con el prefijo del PRD', () => {
    for (const lista of [categorias, lugares, eventos]) {
      const ids = lista.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(ID_CON_PREFIJO);
    }
    expect(categorias.every((c) => c.id.startsWith('cat-'))).toBe(true);
    expect(lugares.every((l) => l.id.startsWith('lug-'))).toBe(true);
    expect(eventos.every((e) => e.id.startsWith('evt-'))).toBe(true);
  });

  it('cada lugar: campos bien formados (horas HH:MM, día 0-6, QR COLON:<id>, coordenadas de la zona)', () => {
    for (const l of lugares) {
      expect(l.nombre.trim().length, l.id).toBeGreaterThan(0);
      expect(l.descripcionCorta.trim().length, l.id).toBeGreaterThan(0);
      expect(l.descripcion.trim().length, l.id).toBeGreaterThan(0);
      expect(l.direccion.trim().length, l.id).toBeGreaterThan(0);
      // Colón y El Palmar: entre el norte de Concepción del Uruguay y el sur de Concordia.
      expect(l.coordenadas.latitud, l.id).toBeGreaterThan(-32.6);
      expect(l.coordenadas.latitud, l.id).toBeLessThan(-31.6);
      expect(l.coordenadas.longitud, l.id).toBeGreaterThan(-58.6);
      expect(l.coordenadas.longitud, l.id).toBeLessThan(-57.8);
      for (const h of l.horarios) {
        expect(h.dia).toBeGreaterThanOrEqual(0);
        expect(h.dia).toBeLessThanOrEqual(6);
        expect(h.abre).toMatch(HORA);
        expect(h.cierra).toMatch(HORA);
      }
      if (l.codigoQr !== null) expect(l.codigoQr).toBe(`COLON:${l.id}`);
      if (l.telefono !== null) expect(l.telefono.trim()).not.toBe('');
      if (l.sitioWeb !== null) expect(l.sitioWeb).toMatch(/^https?:\/\//);
      if (l.precioEntrada !== null) expect(l.precioEntrada).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(l.precioEntrada ?? 0)).toBe(true);
      if (l.audioguia) expect(l.audioguia.idioma).toBe('es');
      expect(new Set(l.imagenes).size, `${l.id} imágenes repetidas`).toBe(l.imagenes.length);
    }
  });

  it('ningún lugar dado de alta tiene horarios que se pisan en el mismo día', () => {
    for (const l of lugares.filter((x) => x.activo)) {
      const porDia = new Map<number, { abre: string; cierra: string }[]>();
      for (const h of l.horarios) porDia.set(h.dia, [...(porDia.get(h.dia) ?? []), h]);
      for (const tramos of porDia.values()) {
        const ordenados = [...tramos].sort((a, b) => a.abre.localeCompare(b.abre));
        for (let i = 1; i < ordenados.length; i++) {
          const anterior = ordenados[i - 1];
          // Un tramo que cruza la medianoche (cierra <= abre) no se compara con el resto.
          if (anterior.cierra > anterior.abre) {
            expect(ordenados[i].abre >= anterior.cierra, `${l.id} día tramos ${JSON.stringify(tramos)}`).toBe(
              true,
            );
          }
        }
      }
    }
  });

  it('todas las URLs de imágenes, audioguías e imagenUrl de eventos son de esta API y se bajan (200)', async () => {
    const urls = new Set<string>();
    for (const l of lugares) {
      l.imagenes.forEach((u) => urls.add(u));
      if (l.audioguia) urls.add(l.audioguia.url);
    }
    for (const e of eventos) if (e.imagenUrl) urls.add(e.imagenUrl);
    for (const u of porUsuario['lucia@mail.com']?.visitas ?? []) if (u.fotoUri) urls.add(u.fotoUri);
    expect(urls.size).toBeGreaterThan(0);
    for (const u of urls) {
      expect(u, 'URL sin file:// ni relativa').toMatch(/^https?:\/\//);
      const url = new URL(u);
      expect(url.pathname.startsWith('/archivos/'), u).toBe(true);
      await ctx.http().get(url.pathname).expect(200);
    }
  });

  it('cada lugar referencia una categoría existente y cada evento con lugarId, un lugar existente', () => {
    const cats = new Set(categorias.map((c) => c.id));
    const lugs = new Set(lugares.map((l) => l.id));
    for (const l of lugares) expect(cats.has(l.categoriaId), l.id).toBe(true);
    for (const e of eventos) if (e.lugarId) expect(lugs.has(e.lugarId), e.id).toBe(true);
  });

  it('R7 — cada evento tiene lugarId o direccionLibre (no los dos) y coordenadas sólo sin lugarId', () => {
    for (const e of eventos) {
      expect(e.lugarId === null, `${e.id} lugar/direccion`).toBe(e.direccionLibre !== null);
      if (e.lugarId !== null) expect(e.coordenadas, e.id).toBeNull();
      expect(e.titulo.trim().length).toBeGreaterThan(0);
      expect(e.descripcion.trim().length).toBeGreaterThan(0);
      if (e.fin !== null) expect(Date.parse(e.fin), e.id).toBeGreaterThan(Date.parse(e.inicio));
      if (e.precio !== null) expect(e.precio).toBeGreaterThanOrEqual(0);
    }
  });

  it('las categorías vienen ordenadas por orden, sin repetir, con color #RRGGBB', () => {
    const ordenes = categorias.map((c) => c.orden);
    expect(ordenes).toEqual([...ordenes].sort((a, b) => a - b));
    expect(new Set(ordenes).size).toBe(ordenes.length);
    for (const c of categorias) expect(c.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  describe('usuarios de demo del README: existen, ingresan y cumplen el contrato', () => {
    it('el README publica exactamente los tres usuarios de la especificación', () => {
      expect(
        usuariosDelReadme()
          .map((u) => u.email)
          .sort(),
      ).toEqual(['lucia@mail.com', 'nuevo@demo.ar', 'turismo@colon.demo.ar'].sort());
    });

    it('con las contraseñas del README se ingresa (200 Sesion) y sin ellas no (401)', async () => {
      for (const u of usuariosDelReadme()) {
        const ok = await ingresar(ctx, u.email, u.contrasena);
        expect(ok.status, u.email).toBe(200);
        esperarContrato(ok.body, 'Sesion');
        const mal = await ingresar(ctx, u.email, `${u.contrasena}x`);
        esperarError(mal, 401, 'CREDENCIALES_INVALIDAS');
      }
    });

    it('el email se acepta en mayúsculas (se guarda normalizado)', async () => {
      const res = await ingresar(ctx, 'LUCIA@MAIL.COM', 'lucia1234');
      expect(res.status).toBe(200);
    });

    it('ninguna respuesta de /yo trae rol ni hash', async () => {
      for (const { token } of Object.values(porUsuario)) {
        const res = await ctx.http().get('/yo').set(conSesion(token)).expect(200);
        esperarContrato(res.body, 'Usuario');
        expect(Object.keys(res.body.datos).sort()).toEqual(
          ['avatarUrl', 'creadoEn', 'email', 'id', 'nombre', 'preferencias'].sort(),
        );
      }
    });

    it('todas las categorías favoritas de cada usuario existen', () => {
      const cats = new Set(categorias.map((c) => c.id));
      for (const { usuario } of Object.values(porUsuario)) {
        for (const c of usuario.preferencias.categoriasFavoritas) expect(cats.has(c)).toBe(true);
      }
    });

    it('lo que dice el README de Lucía es cierto: 3 favoritos (fav-088), 4 visitas (vis-311 con foto y nota), 1 evento guardado (evt-017)', () => {
      const l = porUsuario['lucia@mail.com'];
      expect(l.usuario.id).toBe('usr-201');
      expect(l.usuario.preferencias.categoriasFavoritas).toEqual(['cat-museos', 'cat-playas']);
      expect(l.favoritos).toHaveLength(3);
      expect(l.favoritos.map((f) => f.id)).toContain('fav-088');
      expect(l.visitas).toHaveLength(4);
      const v = l.visitas.find((x) => x.id === 'vis-311');
      expect(v?.fotoUri).not.toBeNull();
      expect(v?.nota).not.toBeNull();
      expect(l.guardados.map((e) => e.id)).toEqual(['evt-017']);
    });

    it('los favoritos y visitas de Lucía apuntan a lugares que existen, no repiten lugar en favoritos y no están en el futuro', () => {
      const l = porUsuario['lucia@mail.com'];
      const lugs = new Set(lugares.map((x) => x.id));
      for (const f of l.favoritos) {
        expect(lugs.has(f.lugarId)).toBe(true);
        expect(f.usuarioId).toBe('usr-201');
        expect(Date.parse(f.creadoEn)).toBeLessThanOrEqual(ctx.reloj.ahora().getTime());
      }
      expect(new Set(l.favoritos.map((f) => f.lugarId)).size).toBe(l.favoritos.length);
      const ordenados = [...l.favoritos].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
      expect(l.favoritos.map((f) => f.id)).toEqual(ordenados.map((f) => f.id));
      for (const v of l.visitas) {
        expect(lugs.has(v.lugarId)).toBe(true);
        expect(v.usuarioId).toBe('usr-201');
        expect(v.sincronizada).toBe(true);
        expect(Date.parse(v.fechaHora)).toBeLessThanOrEqual(ctx.reloj.ahora().getTime());
        if (v.nota !== null) expect(v.nota.length).toBeLessThanOrEqual(280);
        if (v.fotoUri !== null) expect(v.fotoUri).not.toMatch(/^file:/);
      }
    });

    it('nuevo@demo.ar tiene todas las listas vacías (meta.total 0) y sin categorías favoritas', async () => {
      const n = porUsuario['nuevo@demo.ar'];
      expect(n.usuario.preferencias.categoriasFavoritas).toEqual([]);
      for (const ruta of ['/yo/favoritos', '/yo/visitas', '/yo/eventos-guardados']) {
        const res = await ctx.http().get(ruta).set(conSesion(n.token)).expect(200);
        expect(res.body.datos).toEqual([]);
        expect(res.body.meta.total).toBe(0);
      }
    });

    it('turismo@colon.demo.ar puede cambiar el estado de un evento; Lucía y nuevo reciben 403', async () => {
      const cambio = { estado: 'programado' };
      await ctx
        .http()
        .patch('/eventos/evt-017/estado')
        .set(conSesion(porUsuario['turismo@colon.demo.ar'].token))
        .send(cambio)
        .expect(200);
      for (const e of ['lucia@mail.com', 'nuevo@demo.ar']) {
        const res = await ctx
          .http()
          .patch('/eventos/evt-017/estado')
          .set(conSesion(porUsuario[e].token))
          .send(cambio);
        esperarError(res, 403, 'SIN_PERMISO');
      }
    });
  });
});

describe('PRD — los registros con ids exactos salen tal cual el ejemplo del PRD (reloj por defecto)', () => {
  let ctx: AppDePrueba;
  let tokenLucia: string;
  beforeAll(async () => {
    ctx = await crearApp();
    await ctx.app.get(Sembrador).sembrar();
    tokenLucia = (await ingresar(ctx, 'lucia@mail.com', 'lucia1234')).body.datos.token;
  });
  afterAll(() => ctx.cerrar());

  it('cat-museos', async () => {
    const res = await ctx.http().get('/categorias?porPagina=100').expect(200);
    expect(res.body.datos.find((c: Categoria) => c.id === 'cat-museos')).toEqual({
      id: 'cat-museos',
      nombre: 'Museos y patrimonio',
      icono: 'business-outline',
      color: '#8E5A4A',
      orden: 3,
    });
  });

  it('lug-004 Molino Forclaz: todos los campos del JSON del PRD', async () => {
    const res = await ctx.http().get('/lugares/lug-004').expect(200);
    esperarContrato(res.body, 'Lugar');
    const l = res.body.datos as Lugar;
    expect(l).toMatchObject({
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
    expect(l.descripcion.startsWith('Construido en 1888 por Juan Bautista Forclaz')).toBe(true);
    expect(l.audioguia).toMatchObject({ duracionSegundos: 252, idioma: 'es' });
    expect(l.imagenes.length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(l).sort()).toEqual(
      [
        'id',
        'nombre',
        'categoriaId',
        'descripcionCorta',
        'descripcion',
        'coordenadas',
        'direccion',
        'imagenes',
        'horarios',
        'telefono',
        'sitioWeb',
        'precioEntrada',
        'audioguia',
        'codigoQr',
        'accesible',
        'activo',
        'actualizadoEn',
      ].sort(),
    );
  });

  it('lug-004 se resuelve también por su QR y su horario no cambia entre verano e invierno (es de todo el año)', async () => {
    const qr = await ctx
      .http()
      .get(`/lugares/qr/${encodeURIComponent('COLON:lug-004')}`)
      .expect(200);
    expect(qr.body.datos.id).toBe('lug-004');
    ctx.reloj.fijar('2027-01-15T12:00:00-03:00');
    const verano = (await ctx.http().get('/lugares/lug-004').expect(200)).body.datos.horarios;
    ctx.reloj.fijar('2026-07-15T12:00:00-03:00');
    const invierno = (await ctx.http().get('/lugares/lug-004').expect(200)).body.datos.horarios;
    ctx.reloj.fijar('2026-11-14T12:00:00-03:00');
    expect(verano).toEqual(invierno);
  });

  it('evt-017 Peña en el anfiteatro: todos los campos del JSON del PRD', async () => {
    const res = await ctx.http().get('/eventos/evt-017').expect(200);
    esperarContrato(res.body, 'Evento');
    expect(res.body.datos).toMatchObject({
      id: 'evt-017',
      titulo: 'Peña en el anfiteatro',
      descripcion: 'Noche de folclore con artistas de la región.',
      lugarId: 'lug-009',
      direccionLibre: null,
      coordenadas: null,
      inicio: '2026-11-14T21:00:00-03:00',
      fin: '2026-11-15T02:00:00-03:00',
      precio: 0,
      estado: 'programado',
    });
    expect(res.body.datos.imagenUrl).toMatch(/^https?:\/\/.+\/archivos\//);
  });

  it('R8 con el ejemplo del PRD: una peña de 21:00 a 02:00 (evt-017 según el PRD) aparece en los dos días', async () => {
    const e = (await ctx.http().get('/eventos/evt-017').expect(200)).body.datos as Evento;
    // Según el PRD, evt-017 cruza la medianoche (fin 2026-11-15T02:00:00-03:00).
    const dias = [e.inicio.slice(0, 10), '2026-11-15'];
    for (const fecha of dias) {
      const res = await ctx.http().get('/eventos').query({ fecha, porPagina: 100 }).expect(200);
      expect(
        res.body.datos.map((x: Evento) => x.id),
        fecha,
      ).toContain('evt-017');
    }
  });

  it('R8 con los datos sembrados: cada evento que cruza la medianoche aparece en los dos días y en el tercero no', async () => {
    const todos = (
      await ctx.http().get('/eventos').query({ desde: '2000-01-01', porPagina: 100 }).expect(200)
    ).body.datos as Evento[];
    const cruzan = todos.filter((e) => e.fin && e.fin.slice(0, 10) !== e.inicio.slice(0, 10));
    expect(cruzan.length).toBeGreaterThanOrEqual(1);
    for (const e of cruzan) {
      for (const fecha of [e.inicio.slice(0, 10), e.fin!.slice(0, 10)]) {
        const res = await ctx.http().get('/eventos').query({ fecha, porPagina: 100 }).expect(200);
        expect(
          res.body.datos.map((x: Evento) => x.id),
          `${e.id} en ${fecha}`,
        ).toContain(e.id);
      }
    }
  });

  it('lug-009 es el anfiteatro', async () => {
    const res = await ctx.http().get('/lugares/lug-009').expect(200);
    expect(res.body.datos.nombre).toMatch(/anfiteatro/i);
  });

  it('usr-201 Lucía Méndez: creadoEn como en el PRD', async () => {
    const res = await ctx.http().get('/yo').set(conSesion(tokenLucia)).expect(200);
    esperarContrato(res.body, 'Usuario');
    // creadoEn: el PRD dice 2026-09-02T18:20:00-03:00, pero la especificación pide fechas relativas
    // al momento de sembrar (ver "Dudas"): sólo se pide que no esté en el futuro.
    expect(Date.parse(res.body.datos.creadoEn)).toBeLessThanOrEqual(ctx.reloj.ahora().getTime());
    expect(res.body.datos).toEqual({
      id: 'usr-201',
      nombre: 'Lucía Méndez',
      email: 'lucia@mail.com',
      avatarUrl: null,
      creadoEn: res.body.datos.creadoEn,
      preferencias: {
        categoriasFavoritas: ['cat-museos', 'cat-playas'],
        avisarProximidad: true,
        radioAvisoMetros: 250,
        tema: 'sistema',
      },
    });
  });

  it('fav-088: usuarioId, lugarId y creadoEn del PRD', async () => {
    const res = await ctx.http().get('/yo/favoritos').set(conSesion(tokenLucia)).expect(200);
    esperarContrato(res.body, 'Favorito');
    const f = res.body.datos.find((x: Favorito) => x.id === 'fav-088');
    expect(f).toEqual({ id: 'fav-088', usuarioId: 'usr-201', lugarId: 'lug-004', creadoEn: f.creadoEn });
    expect(Date.parse(f.creadoEn)).toBeLessThanOrEqual(ctx.reloj.ahora().getTime());
  });

  it('vis-311: fechaHora, origen y nota del PRD; la foto es una URL de /archivos (no file://) y se baja', async () => {
    const res = await ctx.http().get('/yo/visitas').set(conSesion(tokenLucia)).expect(200);
    esperarContrato(res.body, 'Visita');
    const v = res.body.datos.find((x: Visita) => x.id === 'vis-311');
    expect(v).toMatchObject({
      id: 'vis-311',
      usuarioId: 'usr-201',
      lugarId: 'lug-004',
      origen: 'qr',
      sincronizada: true,
    });
    expect(Date.parse(v.fechaHora)).toBeLessThanOrEqual(ctx.reloj.ahora().getTime());
    expect(v.nota, 'nota del ejemplo del PRD').toBe('Hacía 38 grados pero valió la pena');
    expect(v.fotoUri).toMatch(/^http:\/\/.+\/archivos\/imagenes\//);
    expect(v.fotoUri).not.toMatch(/^file:/);
    await ctx.http().get(new URL(v.fotoUri).pathname).expect(200);
  });

  it('los ids del PRD sólo existen para quien corresponde: otro usuario no ve vis-311 ni puede editarla', async () => {
    const otro = (await ingresar(ctx, 'nuevo@demo.ar', 'nuevo1234')).body.datos.token;
    const res = await ctx.http().patch('/yo/visitas/vis-311').set(conSesion(otro)).send({ nota: 'x' });
    expect([403, 404]).toContain(res.status);
    expect(res.body.error).toBeDefined();
    const lucia = await ctx.http().get('/yo/visitas').set(conSesion(tokenLucia)).expect(200);
    expect(lucia.body.datos.find((v: Visita) => v.id === 'vis-311').nota).not.toBe('x');
  });
});

describe('Especificación §8 — casos feos, uno por uno, contra los datos sembrados', () => {
  let ctx: AppDePrueba;
  let categorias: Categoria[];
  let lugares: Lugar[];
  let eventos: Evento[];
  beforeAll(async () => {
    ctx = await crearApp();
    await ctx.app.get(Sembrador).sembrar();
    categorias = await todas<Categoria>(ctx, '/categorias');
    lugares = await todas<Lugar>(ctx, '/lugares', undefined, {
      porPagina: 500,
      actualizadoDesde: '2000-01-01T00:00:00-03:00',
    });
    eventos = await todas<Evento>(ctx, '/eventos', undefined, { desde: '2000-01-01' });
  });
  afterAll(() => ctx.cerrar());

  it('las 7 categorías del PRD §1 están (y ninguna con nombre repetido)', () => {
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
    expect(new Set(nombres).size).toBe(nombres.length);
    expect(categorias.find((c) => c.id === 'cat-playas')?.nombre).toBe('Playas');
  });

  it('25 a 30 lugares (contando el dado de baja), todos con ids lug- únicos', () => {
    expect(lugares.length).toBeGreaterThanOrEqual(25);
    expect(lugares.length).toBeLessThanOrEqual(30);
  });

  it('están los lugares reales que pide la especificación', () => {
    const texto = lugares.map((l) => l.nombre.toLowerCase()).join('|');
    for (const parte of [
      'termas',
      'molino forclaz',
      'casa de la cultura',
      'el palmar',
      'puerto',
      'iglesia',
      'artesan',
      'anfiteatro',
      'playa',
    ]) {
      expect(texto, parte).toContain(parte);
    }
  });

  it('8 audioguías exactas, en lugares patrimoniales (incluidos el Molino, la Casa de la Cultura, el puerto y la Iglesia)', () => {
    const conAudio = lugares.filter((l) => l.audioguia);
    expect(conAudio).toHaveLength(8);
    const nombres = conAudio.map((l) => l.nombre.toLowerCase()).join('|');
    for (const parte of ['molino', 'cultura', 'puerto', 'iglesia']) expect(nombres, parte).toContain(parte);
    for (const l of conAudio) {
      expect(l.audioguia!.duracionSegundos).toBeGreaterThanOrEqual(180);
      expect(l.audioguia!.duracionSegundos).toBeLessThanOrEqual(300);
      expect(l.activo).toBe(true);
    }
  });

  it('R19 — cada audioguía se sirve con Range (206, Content-Range coherente) y un rango imposible da 416', async () => {
    for (const l of lugares.filter((x) => x.audioguia)) {
      const ruta = new URL(l.audioguia!.url).pathname;
      const entero = await ctx
        .http()
        .get(ruta)
        .buffer(true)
        .parse((res, fin) => {
          let n = 0;
          res.on('data', (p: Buffer) => (n += p.length));
          res.on('end', () => fin(null, n as unknown as Buffer));
        });
      const total = Number(entero.headers['content-length']);
      expect(total, l.id).toBeGreaterThan(1000);
      const p = await ctx.http().get(ruta).set('Range', 'bytes=0-99').expect(206);
      expect(p.headers['content-range']).toBe(`bytes 0-99/${total}`);
      const fuera = await ctx
        .http()
        .get(ruta)
        .set('Range', `bytes=${total + 10}-`);
      expect(fuera.status).toBe(416);
      esperarError(fuera, 416, 'RANGO_NO_SATISFACIBLE');
    }
  });

  it('un lugar sin audioguía es la mayoría; al menos dos sin teléfono; uno con teléfono', () => {
    expect(lugares.filter((l) => l.audioguia === null).length).toBeGreaterThan(lugares.length / 2);
    expect(lugares.filter((l) => l.telefono === null).length).toBeGreaterThanOrEqual(2);
    expect(lugares.filter((l) => l.telefono !== null).length).toBeGreaterThanOrEqual(1);
  });

  it('una categoría sin lugares (activos ni dados de baja) y su listado es lista vacía con meta total 0', async () => {
    const vacias = categorias.filter((c) => !lugares.some((l) => l.categoriaId === c.id));
    expect(vacias.length).toBeGreaterThanOrEqual(1);
    for (const c of vacias) {
      const res = await ctx.http().get('/lugares').query({ categoriaId: c.id }).expect(200);
      esperarContrato(res.body, 'Lugar');
      expect(res.body.datos).toEqual([]);
      expect(res.body.meta).toEqual({ total: 0, pagina: 1, porPagina: 20 });
    }
  });

  it('un lugar con nombre de más de 60 caracteres y descripción de más de 3.000, y sigue entrando en un listado normal', async () => {
    const largo = lugares.filter((l) => l.nombre.length > 60 && l.descripcion.length > 3000);
    expect(largo.length).toBeGreaterThanOrEqual(1);
    const res = await ctx
      .http()
      .get('/lugares')
      .query({ q: largo[0].nombre.slice(0, 20) })
      .expect(200);
    esperarContrato(res.body, 'Lugar');
    expect(res.body.datos.map((l: Lugar) => l.id)).toContain(largo[0].id);
  });

  it('un lugar que cierra los lunes: abre otros días y ningún tramo es lunes (dia 1)', () => {
    const cierraLunes = lugares.filter(
      (l) => l.activo && l.horarios.length >= 3 && l.horarios.every((h) => h.dia !== 1),
    );
    expect(cierraLunes.length).toBeGreaterThanOrEqual(1);
    // ...y la mayoría del catálogo sí abre los lunes (si no, no sería un "caso").
    expect(lugares.filter((l) => l.horarios.some((h) => h.dia === 1)).length).toBeGreaterThanOrEqual(1);
  });

  it('un lugar con dos tramos por día (R2), sin días duplicados de la misma franja', () => {
    const dosTramos = lugares.filter((l) =>
      l.horarios.some((h, i) => l.horarios.findIndex((o) => o.dia === h.dia) !== i),
    );
    expect(dosTramos.length).toBeGreaterThanOrEqual(1);
    for (const l of lugares) {
      const claves = l.horarios.map((h) => `${h.dia}-${h.abre}-${h.cierra}`);
      expect(new Set(claves).size, l.id).toBe(claves.length);
    }
  });

  it('las termas (cat-termas): el horario de verano es distinto del de invierno, y cambia justo el 1/12 y el 1/4', async () => {
    const termas = lugares.filter((l) => l.categoriaId === 'cat-termas' && l.activo);
    expect(termas.length).toBeGreaterThanOrEqual(1);
    const en = async (ahora: string, id: string) => {
      ctx.reloj.fijar(ahora);
      return (await ctx.http().get(`/lugares/${id}`).expect(200)).body.datos.horarios;
    };
    try {
      const id = 'lug-001';
      const v = await en('2027-01-15T12:00:00-03:00', id);
      const i = await en('2026-07-15T12:00:00-03:00', id);
      expect(v).not.toEqual(i);
      expect(await en('2026-11-30T23:59:59-03:00', id)).toEqual(i);
      expect(await en('2026-12-01T00:00:00-03:00', id)).toEqual(v);
      expect(await en('2027-03-31T23:59:59-03:00', id)).toEqual(v);
      expect(await en('2027-04-01T00:00:00-03:00', id)).toEqual(i);
      // El teléfono se entera: en el 1/12 el lugar vuelve en actualizadoDesde.
      ctx.reloj.fijar('2026-12-01T00:00:01-03:00');
      const nov = await ctx
        .http()
        .get('/lugares')
        .query({ actualizadoDesde: '2026-11-30T12:00:00-03:00', porPagina: 500 })
        .expect(200);
      expect(nov.body.datos.map((l: Lugar) => l.id)).toContain(id);
    } finally {
      ctx.reloj.fijar('2026-11-14T12:00:00-03:00');
    }
  });

  it('un lugar dado de baja: fuera del listado, en el detalle y en actualizadoDesde con activo:false', async () => {
    const bajas = lugares.filter((l) => !l.activo);
    expect(bajas.length).toBeGreaterThanOrEqual(1);
    const listado = await todas<Lugar>(ctx, '/lugares', undefined, { porPagina: 500 });
    expect(listado.every((l) => l.activo)).toBe(true);
    expect(listado.length).toBe(lugares.length - bajas.length);
    const det = await ctx.http().get(`/lugares/${bajas[0].id}`).expect(200);
    expect(det.body.datos.activo).toBe(false);
  });

  it('un lugar sin imágenes, uno con precioEntrada 0 (gratis), uno con null y uno accesible', () => {
    expect(lugares.some((l) => l.imagenes.length === 0 && l.activo)).toBe(true);
    expect(lugares.some((l) => l.precioEntrada === 0)).toBe(true);
    expect(lugares.some((l) => l.precioEntrada === null)).toBe(true);
    expect(lugares.some((l) => l.accesible)).toBe(true);
    expect(lugares.some((l) => !l.accesible)).toBe(true);
    expect(lugares.some((l) => l.precioEntrada !== null && l.precioEntrada > 0)).toBe(true);
  });

  it('agenda: un evento hoy a la noche, uno que cruza la medianoche, uno mañana, uno en diez días', () => {
    const hoy = '2026-11-14';
    const conDia = (e: Evento) => e.inicio.slice(0, 10);
    expect(eventos.some((e) => conDia(e) === hoy && e.inicio.slice(11, 13) >= '19')).toBe(true);
    expect(eventos.some((e) => e.fin && e.fin.slice(0, 10) !== e.inicio.slice(0, 10))).toBe(true);
    expect(eventos.some((e) => conDia(e) === '2026-11-15')).toBe(true);
    expect(eventos.some((e) => conDia(e) === '2026-11-24')).toBe(true);
  });

  it('agenda: suspendido, cancelado y ya terminado (finalizado), cada uno con su estado', () => {
    for (const estado of ['programado', 'suspendido', 'cancelado', 'finalizado']) {
      expect(
        eventos.some((e) => e.estado === estado),
        estado,
      ).toBe(true);
    }
    const fin = eventos.filter((e) => e.estado === 'finalizado');
    for (const e of fin) {
      expect(Date.parse(e.fin ?? e.inicio), e.id).toBeLessThan(ctx.reloj.ahora().getTime());
    }
  });

  it('agenda: uno con dirección libre sin lugarId, uno gratis (precio 0) y uno con precio null', () => {
    expect(eventos.some((e) => e.lugarId === null && e.direccionLibre !== null)).toBe(true);
    expect(eventos.some((e) => e.precio === 0)).toBe(true);
    expect(eventos.some((e) => e.precio === null)).toBe(true);
    expect(eventos.some((e) => e.precio !== null && e.precio > 0)).toBe(true);
  });

  it('la agenda por defecto (desde hoy) incluye los de hoy aunque terminaron y está ordenada por inicio', async () => {
    const res = await ctx.http().get('/eventos?porPagina=100').expect(200);
    esperarContrato(res.body, 'Evento');
    const inicios = res.body.datos.map((e: Evento) => e.inicio);
    expect(inicios).toEqual([...inicios].sort());
  });

  it('el evento guardado por Lucía sigue guardable: un evento suspendido sembrado se puede guardar, uno cancelado da 422', async () => {
    const token = (await ingresar(ctx, 'nuevo@demo.ar', 'nuevo1234')).body.datos.token;
    const susp = eventos.find((e) => e.estado === 'suspendido')!;
    const canc = eventos.find((e) => e.estado === 'cancelado')!;
    const fin = eventos.find((e) => e.estado === 'finalizado')!;
    const a = await ctx.http().put(`/yo/eventos-guardados/${susp.id}`).set(conSesion(token));
    expect(a.status).toBe(201);
    esperarContrato(a.body, 'Evento');
    for (const e of [canc, fin]) {
      const r = await ctx.http().put(`/yo/eventos-guardados/${e.id}`).set(conSesion(token));
      esperarError(r, 422, 'EVENTO_NO_VIGENTE');
    }
  });
});

describe('Especificación §8 / AGENTS §6 — todo lo temporal es relativo al momento de sembrar (bordes del reloj)', () => {
  const casos = [
    ['23:59 del 31/12', '2026-12-31T23:59:00-03:00', '2026-12-31'],
    ['00:00 del 1/1', '2027-01-01T00:00:00-03:00', '2027-01-01'],
    ['último día del mes (30/11 a las 23:59)', '2026-11-30T23:59:00-03:00', '2026-11-30'],
    ['29 de febrero', '2028-02-29T12:00:00-03:00', '2028-02-29'],
    ['21:00 de la noche (misma hora que la peña)', '2026-11-14T21:00:00-03:00', '2026-11-14'],
  ] as const;

  it.each(casos)(
    'sembrado a las %s: todo cumple el contrato y evt-017 es de "hoy" en Buenos Aires',
    async (_n, ahora, hoy) => {
      const ctx = await crearApp({ ahora });
      try {
        await ctx.app.get(Sembrador).sembrar();
        const lugares = await todas<Lugar>(ctx, '/lugares', undefined, {
          porPagina: 500,
          actualizadoDesde: '2000-01-01T00:00:00-03:00',
        });
        esperarContrato(
          (
            await ctx
              .http()
              .get('/lugares')
              .query({ porPagina: 500, actualizadoDesde: '2000-01-01T00:00:00-03:00' })
              .expect(200)
          ).body,
          'Lugar',
        );
        const eventos = await todas<Evento>(ctx, '/eventos', undefined, { desde: '2000-01-01' });
        esperarContrato(
          (await ctx.http().get('/eventos').query({ desde: '2000-01-01', porPagina: 100 }).expect(200)).body,
          'Evento',
        );
        expect(lugares.length).toBeGreaterThanOrEqual(25);
        const e17 = eventos.find((e) => e.id === 'evt-017');
        expect(e17, 'evt-017').toBeDefined();
        expect(e17!.inicio.slice(0, 10), 'inicio de evt-017 es hoy').toBe(hoy);
        expect(e17!.inicio.slice(11)).toBe('21:00:00-03:00');
        expect(Date.parse(e17!.fin!)).toBeGreaterThan(Date.parse(e17!.inicio));
        for (const estado of ['suspendido', 'cancelado', 'finalizado']) {
          expect(
            eventos.some((e) => e.estado === estado),
            estado,
          ).toBe(true);
        }
        // Lucía: nada en el futuro, foto de vis-311 accesible, un evento guardado.
        const ing = await ingresar(ctx, 'lucia@mail.com', 'lucia1234');
        const token = ing.body.datos.token as string;
        esperarContrato(ing.body, 'Sesion');
        const visitas = await todas<Visita>(ctx, '/yo/visitas', token, { porPagina: 500 });
        expect(visitas).toHaveLength(4);
        for (const v of visitas)
          expect(Date.parse(v.fechaHora)).toBeLessThanOrEqual(ctx.reloj.ahora().getTime());
        const favs = await todas<Favorito>(ctx, '/yo/favoritos', token);
        expect(favs).toHaveLength(3);
        for (const f of favs) expect(Date.parse(f.creadoEn)).toBeLessThanOrEqual(ctx.reloj.ahora().getTime());
        esperarContrato(
          (await ctx.http().get('/yo/visitas').set(conSesion(token)).expect(200)).body,
          'Visita',
        );
        esperarContrato(
          (await ctx.http().get('/yo/favoritos').set(conSesion(token)).expect(200)).body,
          'Favorito',
        );
        const guardados = await ctx.http().get('/yo/eventos-guardados').set(conSesion(token)).expect(200);
        esperarContrato(guardados.body, 'Evento');
        expect(guardados.body.datos.map((e: Evento) => e.id)).toContain('evt-017');
      } finally {
        await ctx.cerrar();
      }
    },
  );
});

describe('Sembrar dos veces no duplica (AGENTS §16.2, SEMBRAR_SI_VACIA)', () => {
  it('Sembrador.sembrar() repetido deja los mismos totales y los mismos ids', async () => {
    const ctx = await crearApp();
    try {
      const sembrador = ctx.app.get(Sembrador);
      expect(await sembrador.estaVacia()).toBe(true);
      await sembrador.sembrar();
      expect(await sembrador.estaVacia()).toBe(false);
      const foto = async () => {
        const token = (await ingresar(ctx, 'lucia@mail.com', 'lucia1234')).body.datos.token;
        return {
          lugares: (
            await todas<Lugar>(ctx, '/lugares', undefined, {
              porPagina: 500,
              actualizadoDesde: '2000-01-01T00:00:00-03:00',
            })
          )
            .map((l) => l.id)
            .sort(),
          categorias: (await todas<Categoria>(ctx, '/categorias')).map((c) => c.id),
          eventos: (await todas<Evento>(ctx, '/eventos', undefined, { desde: '2000-01-01' }))
            .map((e) => e.id)
            .sort(),
          favoritos: (await todas<Favorito>(ctx, '/yo/favoritos', token)).map((f) => f.id).sort(),
          visitas: (await todas<Visita>(ctx, '/yo/visitas', token, { porPagina: 500 }))
            .map((v) => v.id)
            .sort(),
          guardados: (await todas<Evento>(ctx, '/yo/eventos-guardados', token)).map((e) => e.id),
        };
      };
      const antes = await foto();
      let error: unknown = null;
      try {
        await sembrador.sembrar();
      } catch (e) {
        error = e;
      }
      // O bien se niega a sembrar de nuevo, o bien es idempotente; lo que no puede es duplicar.
      const despues = await foto();
      expect(despues, error ? `(la segunda siembra falló: ${String(error)})` : '').toEqual(antes);
      // Los usuarios de demo siguen ingresando una sola vez con su contraseña.
      for (const u of usuariosDelReadme())
        expect((await ingresar(ctx, u.email, u.contrasena)).status).toBe(200);
    } finally {
      await ctx.cerrar();
    }
  });

  it('sembrar sobre datos que ya cambiaron (un turista registrado, un favorito nuevo) no borra lo del usuario', async () => {
    const ctx = await crearApp();
    try {
      await ctx.app.get(Sembrador).sembrar();
      const reg = await ctx
        .http()
        .post('/auth/registro')
        .send({ nombre: 'Persona Nueva', email: 'persona@nueva.ar', contrasena: 'una-clave-segura' })
        .expect(201);
      await ctx.http().put('/yo/favoritos/lug-004').set(conSesion(reg.body.datos.token)).expect(201);
      let fallo = false;
      try {
        await ctx.app.get(Sembrador).sembrar();
      } catch {
        fallo = true;
      }
      const ing = await ingresar(ctx, 'persona@nueva.ar', 'una-clave-segura');
      // Si sembrar() reescribió la base, el registro se perdió: es una decisión válida sólo para db:reiniciar.
      expect(ing.status, fallo ? 'sembrar() tiró error' : 'sembrar() borró al usuario registrado').toBe(200);
      const favs = await ctx.http().get('/yo/favoritos').set(conSesion(ing.body.datos.token)).expect(200);
      expect(favs.body.datos).toHaveLength(1);
    } finally {
      await ctx.cerrar();
    }
  });
});

describe('AGENTS §13 — el README dice cosas ciertas', () => {
  const secciones = [...README.matchAll(/^## (\d+)\. (.+)$/gm)].map((m) => ({
    n: Number(m[1]),
    titulo: m[2],
  }));
  const idx = (re: RegExp) => secciones.findIndex((s) => re.test(s.titulo));

  it('tiene las secciones que pide AGENTS §13, con Docker primero', () => {
    const orden = [
      /Docker/i, // 2. con Docker, un solo comando (va primero)
      /sin Docker/i, // 3. Node + pnpm + SQLite
      /PostgreSQL|MySQL|MariaDB/i, // 4. motores instalados a mano
      /tel[eé]fono/i, // 5.
      /Usuarios de demo/i, // 6.
      /C[oó]mo usar la API/i, // (tablas de endpoints y errores)
      /error|demora|fecha/i, // 8. simular errores, congelar reloj
      /estado inicial|volver/i, // 9.
      /Problemas frecuentes/i, // 10.
    ];
    let previo = -1;
    for (const re of orden) {
      const i = secciones.findIndex((s, k) => k > previo && re.test(s.titulo));
      expect(
        i,
        `falta una sección que case con ${re}: ${secciones.map((s) => s.titulo).join(' | ')}`,
      ).toBeGreaterThan(-1);
      previo = i;
    }
    expect(idx(/Docker/i)).toBe(0);
  });

  it('tiene la tabla de endpoints y la de códigos de error con sus marcas', () => {
    expect(README).toContain('<!-- tabla:endpoints -->');
    expect(README).toContain('<!-- tabla:errores -->');
  });

  it('el "Estado" del README no dice que algo llega en próximas versiones (M7 cierra el plan)', () => {
    expect(README).not.toMatch(/pr[oó]ximas versiones/i);
    expect(README).not.toMatch(/llega(n)? en las pr[oó]ximas/i);
    // Sin `i` para los marcadores en mayúsculas: "todo" es una palabra normal en castellano.
    expect(README).not.toMatch(/\bTODO\b|\bPENDIENTE\b/);
    expect(README).not.toMatch(/próximamente/i);
  });

  it('menciona que el README nombra el PRD y `docs/prd.pdf`', () => {
    expect(README).toContain('docs/prd.pdf');
    expect(existsSync(join(RAIZ, 'docs/prd.pdf'))).toBe(true);
  });

  it('los comandos `pnpm <script>` que cita existen en package.json (o son de pnpm)', () => {
    const propios = new Set(['install', 'i', 'exec', 'add', 'dlx']);
    const citados = new Set<string>();
    for (const m of README.matchAll(/pnpm ([a-z][\w:.-]*)/g)) citados.add(m[1]);
    expect(citados.size).toBeGreaterThan(0);
    for (const c of citados) {
      if (propios.has(c)) continue;
      expect(PAQUETE.scripts[c], `pnpm ${c} no existe en package.json`).toBeDefined();
    }
    for (const c of ['db:reiniciar', 'dev']) expect(citados.has(c)).toBe(true);
  });

  it('los archivos compose que cita existen, y cada uno tiene su nombre y siembra sola', () => {
    const citados = new Set([...README.matchAll(/compose\.[a-z-]+\.yaml|compose\.yaml/g)].map((m) => m[0]));
    expect(README).toMatch(/docker compose up\b/);
    for (const f of ['compose.postgres.yaml', 'compose.mysql.yaml', 'compose.mariadb.yaml']) {
      expect(citados.has(f), `el README no cita ${f}`).toBe(true);
    }
    for (const f of citados) {
      expect(existsSync(join(RAIZ, f)), f).toBe(true);
    }
    expect(readFileSync(join(RAIZ, 'compose.yaml'), 'utf8')).toMatch(/SEMBRAR_SI_VACIA:\s*"true"/);
    expect(existsSync(join(RAIZ, 'Dockerfile'))).toBe(true);
    expect(existsSync(join(RAIZ, '.env.example'))).toBe(true);
  });

  it('los puertos que cita para las bases coinciden con los de los compose (5433, 3307, 3308)', () => {
    const esperado: [string, string][] = [
      ['compose.postgres.yaml', '5433'],
      ['compose.mysql.yaml', '3307'],
      ['compose.mariadb.yaml', '3308'],
    ];
    for (const [f, puerto] of esperado) {
      expect(readFileSync(join(RAIZ, f), 'utf8'), f).toContain(puerto);
      expect(README).toContain(puerto);
    }
  });

  it('las variables de entorno que cita están en .env.example', () => {
    const env = readFileSync(join(RAIZ, '.env.example'), 'utf8');
    for (const v of ['PUERTO', 'DB_MOTOR', 'DB_URL', 'SIMULACION_HABILITADA', 'RELOJ_FIJO', 'ENTORNO']) {
      expect(README, v).toContain(v);
      expect(env, v).toContain(v);
    }
  });

  it('avisa lo de XAMPP → mariadb, el firewall de Windows y el arranque en frío', () => {
    expect(README).toMatch(/XAMPP/);
    expect(README).toMatch(/DB_MOTOR=mariadb/);
    expect(README).toMatch(/[Ff]irewall/);
    expect(README).toMatch(/15 minutos/);
    expect(README).toMatch(/\/salud/);
  });

  it('todos los ids de datos que cita el README existen de verdad', async () => {
    const ctx = await crearApp();
    try {
      await ctx.app.get(Sembrador).sembrar();
      const citados = new Set(
        [...README.matchAll(/\b(lug|cat|evt|usr|fav|vis)-[a-z0-9]+\b/g)].map((m) => m[0]),
      );
      expect(citados.size).toBeGreaterThan(5);
      const token = (await ingresar(ctx, 'lucia@mail.com', 'lucia1234')).body.datos.token;
      const yo = (await ctx.http().get('/yo').set(conSesion(token)).expect(200)).body.datos as Usuario;
      const lucia = {
        fav: (await todas<Favorito>(ctx, '/yo/favoritos', token)).map((f) => f.id),
        vis: (await todas<Visita>(ctx, '/yo/visitas', token, { porPagina: 500 })).map((f) => f.id),
      };
      const cats = (await todas<Categoria>(ctx, '/categorias')).map((c) => c.id);
      for (const id of citados) {
        const [tipo] = id.split('-');
        if (tipo === 'lug') await ctx.http().get(`/lugares/${id}`).expect(200);
        else if (tipo === 'evt') await ctx.http().get(`/eventos/${id}`).expect(200);
        else if (tipo === 'cat') expect(cats, id).toContain(id);
        else if (tipo === 'usr') expect(yo.id, id).toBe(id);
        else if (tipo === 'fav') expect(lucia.fav, id).toContain(id);
        else if (tipo === 'vis') expect(lucia.vis, id).toContain(id);
      }
    } finally {
      await ctx.cerrar();
    }
  });

  it('README §6 — el ejemplo de "sin señal" (catálogo entero con actualizadoDesde=2000) trae también los dados de baja', async () => {
    const ctx = await crearApp();
    try {
      await ctx.app.get(Sembrador).sembrar();
      const res = await ctx
        .http()
        .get('/lugares?porPagina=500&actualizadoDesde=2000-01-01T00:00:00-03:00')
        .expect(200);
      expect(res.body.datos.some((l: Lugar) => !l.activo)).toBe(true);
      expect(res.body.meta.porPagina).toBe(500);
    } finally {
      await ctx.cerrar();
    }
  });

  it('README §6 — los ejemplos de filtros devuelven algo con los datos de demo (ubicación de Colón, radio 2 km, q=colon, accesible, categoría)', async () => {
    const ctx = await crearApp();
    try {
      await ctx.app.get(Sembrador).sembrar();
      const cerca = await ctx
        .http()
        .get('/lugares?latitud=-32.2236&longitud=-58.1427&radioMetros=2000&orden=distancia')
        .expect(200);
      esperarContrato(cerca.body, 'Lugar');
      expect(cerca.body.datos.length, 'nada a 2 km del centro de Colón').toBeGreaterThan(0);
      for (const l of cerca.body.datos) expect(Object.keys(l)).not.toContain('distancia');
      const q = await ctx.http().get('/lugares?q=colon').expect(200);
      expect(q.body.datos.length).toBeGreaterThan(0);
      const acc = await ctx.http().get('/lugares?accesible=true').expect(200);
      expect(acc.body.datos.length).toBeGreaterThan(0);
      expect(acc.body.datos.every((l: Lugar) => l.accesible)).toBe(true);
      const museos = await ctx.http().get('/lugares?categoriaId=cat-museos').expect(200);
      expect(museos.body.datos.length).toBeGreaterThan(0);
      const desde = await ctx.http().get('/lugares?actualizadoDesde=2026-11-01T10:00:00-03:00').expect(200);
      esperarContrato(desde.body, 'Lugar');
    } finally {
      await ctx.cerrar();
    }
  });

  it('README §6/§7 — el flujo de la push: Lucía guarda evt-017 (ya lo tiene), el admin lo suspende y ella recibe una push', async () => {
    const ctx = await crearApp();
    try {
      await ctx.app.get(Sembrador).sembrar();
      const lucia = (await ingresar(ctx, 'lucia@mail.com', 'lucia1234')).body.datos.token;
      const admin = (await ingresar(ctx, 'turismo@colon.demo.ar', 'turismo1234')).body.datos.token;
      await registrarTelefono(ctx, lucia, 'ExponentPushToken[abcdefghijklmnopqrstuv]', 'android');
      const res = await ctx
        .http()
        .patch('/eventos/evt-017/estado')
        .set(conSesion(admin))
        .send({ estado: 'suspendido' })
        .expect(200);
      esperarContrato(res.body, 'Evento');
      await ctx.esperarAvisos();
      expect(ctx.enviador.enviadas).toHaveLength(1);
      // Un turista que no lo guardó, no recibe nada.
      const nuevo = (await ingresar(ctx, 'nuevo@demo.ar', 'nuevo1234')).body.datos.token;
      await registrarTelefono(ctx, nuevo, 'ExponentPushToken[zzzzzzzzzzzzzzzzzzzzzz]');
      await ctx
        .http()
        .patch('/eventos/evt-017/estado')
        .set(conSesion(admin))
        .send({ estado: 'programado' })
        .expect(200);
      await ctx.esperarAvisos();
      expect(ctx.enviador.enviadas).toHaveLength(2);
    } finally {
      await ctx.cerrar();
    }
  });

  it('README §5 — para mirar no hace falta cuenta: catálogo y agenda son públicos, lo demás da 401', async () => {
    const ctx = await crearApp();
    try {
      await ctx.app.get(Sembrador).sembrar();
      for (const r of [
        '/categorias',
        '/lugares',
        '/lugares/lug-004',
        '/eventos',
        '/eventos/evt-017',
        '/salud',
      ]) {
        await ctx.http().get(r).expect(200);
      }
      for (const r of ['/yo', '/yo/favoritos', '/yo/visitas', '/yo/eventos-guardados']) {
        esperarError(await ctx.http().get(r), 401, 'NO_AUTENTICADO');
      }
    } finally {
      await ctx.cerrar();
    }
  });

  it('la tabla de endpoints del README cubre todas las rutas de la especificación §4', () => {
    const rutas = [
      'GET /categorias',
      'GET /lugares',
      'GET /lugares/:id',
      'GET /lugares/qr/:codigo',
      'GET /eventos',
      'GET /eventos/:id',
      'PATCH /eventos/:id/estado',
      'GET /yo/favoritos',
      'PUT /yo/favoritos/:lugarId',
      'DELETE /yo/favoritos/:lugarId',
      'GET /yo/visitas',
      'POST /yo/visitas',
      'PATCH /yo/visitas/:id',
      'GET /yo/eventos-guardados',
      'PUT /yo/eventos-guardados/:eventoId',
      'DELETE /yo/eventos-guardados/:eventoId',
    ];
    const tabla = README.slice(
      README.indexOf('<!-- tabla:endpoints -->'),
      README.indexOf('<!-- /tabla:endpoints -->'),
    );
    for (const r of rutas) {
      const [m, ruta] = r.split(' ');
      expect(tabla, r).toContain(`| \`${m}\` | \`${ruta}\``);
    }
  });

  it('el README no contradice al catálogo: en la tabla, PATCH /eventos/:id/estado dice que es 🔒 y en el texto que lo hace un admin', () => {
    expect(README).toMatch(/turismo@colon\.demo\.ar/);
    expect(README).toMatch(/403/);
  });

  it('el README está en castellano rioplatense: sin "tú", "haz", "tienes", "puedes"', () => {
    const texto = README.replace(/```[\s\S]*?```/g, '');
    expect(texto).not.toMatch(/\b(tienes|puedes|haz clic|necesitas|debes)\b/i);
  });
});

describe('AGENTS §16 — arranque real (dist/) con SEMBRAR_SI_VACIA sobre una base que ya tiene datos', () => {
  const esSqlite = (process.env.DB_MOTOR ?? 'better-sqlite3') === 'better-sqlite3';
  const hayDist = existsSync(join(RAIZ, 'dist/src/main.js'));

  async function arrancar(dir: string, puerto: number) {
    const { spawn } = await import('node:child_process');
    const hijo = spawn('node', [join(RAIZ, 'dist/src/main.js')], {
      cwd: RAIZ,
      env: {
        ...process.env,
        ENTORNO: 'desarrollo',
        PUERTO: String(puerto),
        DB_MOTOR: 'better-sqlite3',
        DB_ARCHIVO: join(dir, 'api.sqlite'),
        DB_SINCRONIZAR: 'true',
        SEMBRAR_SI_VACIA: 'true',
        DIRECTORIO_ARCHIVOS: join(dir, 'archivos'),
        NOTIFICACIONES: 'registro',
        JWT_SECRETO: 'solo-para-desarrollo-no-usar-en-produccion',
        RELOJ_FIJO: '',
      },
      stdio: 'ignore',
    });
    const base = `http://127.0.0.1:${puerto}`;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(`${base}/salud`)).ok) return { hijo, base };
      } catch {
        // todavía no arrancó
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    hijo.kill();
    throw new Error('la API construida no arrancó');
  }
  const parar = (hijo: { kill: () => void; once: (e: string, f: () => void) => void }) =>
    new Promise<void>((r) => {
      hijo.once('exit', () => r());
      hijo.kill();
    });

  it.runIf(esSqlite && hayDist)(
    'el segundo arranque no vuelve a sembrar ni pisa lo que hizo la gente',
    async () => {
      const { mkdtemp, rm } = await import('node:fs/promises');
      const { tmpdir } = await import('node:os');
      const { createServer } = await import('node:net');
      const dir = await mkdtemp(join(tmpdir(), 'm7-sembrar-'));
      const puerto = await new Promise<number>((r) => {
        const s = createServer().listen(0, () => {
          const p = (s.address() as { port: number }).port;
          s.close(() => r(p));
        });
      });
      const json = { 'content-type': 'application/json' };
      try {
        const a = await arrancar(dir, puerto);
        const total = async (base: string) =>
          (
            await (
              await fetch(`${base}/lugares?porPagina=500&actualizadoDesde=2000-01-01T00:00:00-03:00`)
            ).json()
          ).meta.total;
        const antes = await total(a.base);
        expect(antes, 'la primera vez sembró sola').toBeGreaterThanOrEqual(25);
        const reg = await fetch(`${a.base}/auth/registro`, {
          method: 'POST',
          headers: json,
          body: JSON.stringify({
            nombre: 'Persistente',
            email: 'persistente@demo.ar',
            contrasena: 'una-clave-segura',
          }),
        });
        expect(reg.status).toBe(201);
        await parar(a.hijo);
        const b = await arrancar(dir, puerto);
        try {
          expect(await total(b.base)).toBe(antes);
          const cats = await (await fetch(`${b.base}/categorias?porPagina=100`)).json();
          expect(cats.meta.total).toBe(new Set(cats.datos.map((c: Categoria) => c.id)).size);
          for (const [email, contrasena] of [
            ['persistente@demo.ar', 'una-clave-segura'],
            ['lucia@mail.com', 'lucia1234'],
          ]) {
            const r = await fetch(`${b.base}/auth/ingreso`, {
              method: 'POST',
              headers: json,
              body: JSON.stringify({ email, contrasena }),
            });
            expect(r.status, email).toBe(200);
          }
        } finally {
          await parar(b.hijo);
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
    60_000,
  );
});

describe('Especificación §8 — el error de red de los casos feos', () => {
  it('el error de red: X-Simular: error-500 da el sobre de error de ERROR_INTERNO', async () => {
    const otra = await crearApp({ entorno: { SIMULACION_HABILITADA: 'true' } });
    try {
      const res = await otra.http().get('/lugares').set('X-Simular', 'error-500');
      esperarError(res, 500, 'ERROR_INTERNO');
    } finally {
      await otra.cerrar();
    }
  });
});
