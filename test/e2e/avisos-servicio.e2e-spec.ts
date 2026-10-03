import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { crearUsuario } from '../utilidades/usuarios.js';

const TOKEN = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const OTRO_TOKEN = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';

describe('AGENTS §19.2 — Avisos: a quién se avisa (con los dobles en memoria de los dos puertos)', () => {
  let t: AppDePrueba;
  beforeEach(async () => {
    t = await crearApp();
  });
  afterEach(() => t.cerrar());

  const registrar = (id: string, tokenExpo: string) => t.almacen.guardar(id, tokenExpo, 'android');

  const aviso = {
    titulo: 'Promo nueva',
    cuerpo: '15% en pinturas',
    datos: { promocionId: 'pro-441' },
  };

  it('avisa a los usuarios con avisos activos, una sola vez aunque se repitan', async () => {
    const marta = await crearUsuario(t);
    await registrar(marta.id, TOKEN);
    t.avisos.avisar([marta.id, marta.id], aviso);
    await t.avisos.esperarPendientes();
    expect(t.enviador.enviados).toEqual([{ tokens: [TOKEN], ...aviso }]);
  });

  it('nadie recibe nada si tiene los avisos apagados', async () => {
    const marta = await crearUsuario(t, { avisosActivos: false });
    const jose = await crearUsuario(t);
    await registrar(marta.id, TOKEN);
    await registrar(jose.id, OTRO_TOKEN);
    t.avisos.avisar([marta.id, jose.id], aviso);
    await t.avisos.esperarPendientes();
    expect(t.enviador.enviados).toEqual([{ tokens: [OTRO_TOKEN], ...aviso }]);
  });

  it('sin tokens no se llama al enviador', async () => {
    const marta = await crearUsuario(t);
    t.avisos.avisar([marta.id], aviso);
    await t.avisos.esperarPendientes();
    expect(t.enviador.enviados).toEqual([]);
  });

  it('descarta los tokens que el enviador informa como inválidos', async () => {
    const marta = await crearUsuario(t);
    await registrar(marta.id, TOKEN);
    await registrar(marta.id, OTRO_TOKEN);
    t.enviador.invalidos.add(TOKEN);
    t.avisos.avisar([marta.id], aviso);
    await t.avisos.esperarPendientes();
    expect(await t.almacen.tokensDe([marta.id])).toEqual([OTRO_TOKEN]);
  });

  it('si el envío falla, no tira error (se loguea)', async () => {
    const marta = await crearUsuario(t);
    await registrar(marta.id, TOKEN);
    t.enviador.fallarCon = new Error('Expo no responde');
    expect(() => t.avisos.avisar([marta.id], aviso)).not.toThrow();
    await expect(t.avisos.esperarPendientes()).resolves.toBeUndefined();
  });
});
