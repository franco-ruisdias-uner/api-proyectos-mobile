import { hashearContrasena, verificarContrasena } from './passwords.js';

describe('AGENTS §7.2 — Contraseñas con scrypt y sal por usuario', () => {
  it('verifica la correcta y rechaza otra', async () => {
    const hash = await hashearContrasena('una-clave-larga');
    expect(hash).not.toContain('una-clave-larga');
    expect(await verificarContrasena('una-clave-larga', hash)).toBe(true);
    expect(await verificarContrasena('otra-clave-larga', hash)).toBe(false);
  });

  it('la misma contraseña da hashes distintos (sal aleatoria)', async () => {
    const a = await hashearContrasena('una-clave-larga');
    const b = await hashearContrasena('una-clave-larga');
    expect(a).not.toBe(b);
  });

  it('un hash mal formado no verifica ni explota', async () => {
    expect(await verificarContrasena('x', 'basura')).toBe(false);
  });
});
