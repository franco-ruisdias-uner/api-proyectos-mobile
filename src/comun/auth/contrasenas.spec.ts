import { hashearContrasena, verificarContrasena } from './contrasenas.js';

describe('AGENTS §7.2 — contraseñas con scrypt y sal por usuario', () => {
  it('verifica la contraseña correcta y rechaza otra', async () => {
    const hash = await hashearContrasena('clave-segura-1');
    expect(await verificarContrasena('clave-segura-1', hash)).toBe(true);
    expect(await verificarContrasena('clave-segura-2', hash)).toBe(false);
  });

  it('el hash no contiene la contraseña y cambia con cada sal', async () => {
    const a = await hashearContrasena('clave-segura-1');
    const b = await hashearContrasena('clave-segura-1');
    expect(a).not.toBe(b);
    expect(a).not.toContain('clave-segura-1');
    expect(a).toMatch(/^scrypt\$/);
  });

  it('un hash mal formado no verifica ni explota', async () => {
    expect(await verificarContrasena('x', 'cualquier-cosa')).toBe(false);
    expect(await verificarContrasena('x', 'scrypt$16384$zz$zz')).toBe(false);
  });
});
