import {
  contrasenaCoincide,
  HASH_SENUELO,
  hashearContrasena,
} from './contrasenas.js';

describe('AGENTS §7.2 — Contraseñas con scrypt y sal por usuario', () => {
  it('el hash no contiene la contraseña y cambia con cada sal', async () => {
    const a = await hashearContrasena('lectura');
    const b = await hashearContrasena('lectura');
    expect(a).not.toContain('lectura');
    expect(a).not.toBe(b);
    expect(a).toMatch(/^scrypt\$/);
  });

  it('coincide sólo con la contraseña correcta', async () => {
    const hash = await hashearContrasena('una-clave-larga');
    expect(await contrasenaCoincide('una-clave-larga', hash)).toBe(true);
    expect(await contrasenaCoincide('una-clave-largA', hash)).toBe(false);
    expect(await contrasenaCoincide('', hash)).toBe(false);
  });

  it('el señuelo y los hashes rotos no coinciden con nada', async () => {
    expect(await contrasenaCoincide('lectura', HASH_SENUELO)).toBe(false);
    expect(await contrasenaCoincide('lectura', 'texto-cualquiera')).toBe(false);
  });
});
