import { hashContrasena, verificarContrasena } from './contrasenas.js';

describe('AGENTS §7.2 — Contraseñas con scrypt y sal por usuario', () => {
  it('verifica la contraseña correcta y rechaza otra', async () => {
    const hash = await hashContrasena('clave-segura-123');
    expect(await verificarContrasena('clave-segura-123', hash)).toBe(true);
    expect(await verificarContrasena('clave-segura-124', hash)).toBe(false);
  });

  it('la misma contraseña da hashes distintos (sal aleatoria) y no la contiene', async () => {
    const a = await hashContrasena('clave-segura-123');
    const b = await hashContrasena('clave-segura-123');
    expect(a).not.toBe(b);
    expect(a).not.toContain('clave-segura-123');
  });

  it('un hash con otro formato no valida', async () => {
    expect(await verificarContrasena('x', 'md5$abc')).toBe(false);
  });
});
