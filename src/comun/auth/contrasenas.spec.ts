import { hashearContrasena, verificarContrasena } from './contrasenas.js';

describe('AGENTS §7.2 — Contraseñas con scrypt y sal por usuario', () => {
  it('verifica la contraseña correcta y rechaza otra', async () => {
    const hash = await hashearContrasena('una clave larga');
    expect(await verificarContrasena('una clave larga', hash)).toBe(true);
    expect(await verificarContrasena('una clave largA', hash)).toBe(false);
  });

  it('la misma contraseña da hashes distintos (sal aleatoria) y no contiene el texto', async () => {
    const a = await hashearContrasena('demo1234');
    const b = await hashearContrasena('demo1234');
    expect(a).not.toBe(b);
    expect(a).not.toContain('demo1234');
    expect(a).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  });

  it.each([[''], ['basura'], ['scrypt$zz$zz'], ['scrypt$00$00']])(
    'un hash mal formado (%j) no valida nada',
    async (hash) => {
      expect(await verificarContrasena('demo1234', hash)).toBe(false);
    },
  );
});
