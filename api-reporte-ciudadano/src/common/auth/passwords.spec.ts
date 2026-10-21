import { hashearContrasena, verificarContrasena } from './passwords.js';

describe('AGENTS §7.2 — Contraseñas con scrypt y sal por usuario', () => {
  it('verifica la contraseña correcta y rechaza otra', async () => {
    const hash = await hashearContrasena('clave1234');
    expect(await verificarContrasena('clave1234', hash)).toBe(true);
    expect(await verificarContrasena('clave12345', hash)).toBe(false);
  });

  it('el hash no contiene la contraseña y cambia en cada llamada (sal aleatoria)', async () => {
    const a = await hashearContrasena('clave1234');
    const b = await hashearContrasena('clave1234');
    expect(a).not.toContain('clave1234');
    expect(a).not.toBe(b);
    expect(a.startsWith('scrypt$')).toBe(true);
  });

  it('un hash con otro formato no verifica (y no explota)', async () => {
    expect(await verificarContrasena('clave1234', 'cualquier-cosa')).toBe(
      false,
    );
    expect(await verificarContrasena('clave1234', 'scrypt$zz$zz')).toBe(false);
  });
});
